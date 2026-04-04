/**
 * Evaluation harness for KB MCP Server retrieval quality.
 * Run with: npx tsx eval/run-eval.ts
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Point to vault
process.env.KB_VAULT_PATH = process.env.KB_VAULT_PATH || resolve(process.env.HOME || "", "knowledge-base");

import { reindexVault } from "../src/index/indexer.js";
import { ftsSearch } from "../src/index/fts.js";
import { buildContextPack } from "../src/retrieval/search.js";
import { resolveEntity } from "../src/retrieval/entity.js";
import { getBacklinks, getNeighborhood } from "../src/retrieval/structural.js";
import { closeDb } from "../src/index/sqlite.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface EvalQuery {
  id: string;
  category: string;
  query: string;
  description: string;
  expected_entity?: string | null;
  expected_notes?: string[];
  expected_top_notes?: string[];
  expected_backlinks?: string[];
  expected_neighbors_min?: number;
  expected_min_issues?: number;
  expected_error?: boolean;
  entity?: string;
  tool?: string;
}

interface EvalResult {
  id: string;
  category: string;
  description: string;
  passed: boolean;
  details: string;
}

function main() {
  console.log("=== KB MCP Server Evaluation ===\n");

  // Index vault first
  const stats = reindexVault();
  console.log(`Indexed: ${stats.total} notes (${stats.added} new, ${stats.errors} errors)\n`);

  const queriesFile = readFileSync(resolve(__dirname, "queries.json"), "utf-8");
  const { queries } = JSON.parse(queriesFile) as { queries: EvalQuery[] };

  const results: EvalResult[] = [];

  for (const q of queries) {
    try {
      const result = evaluateQuery(q);
      results.push(result);
    } catch (err) {
      results.push({
        id: q.id,
        category: q.category,
        description: q.description,
        passed: false,
        details: `Error: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  // Print results
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log("--- Results ---\n");
  for (const r of results) {
    const mark = r.passed ? "PASS" : "FAIL";
    console.log(`[${mark}] ${r.id} (${r.category}): ${r.description}`);
    if (!r.passed) {
      console.log(`       ${r.details}`);
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log(`Score: ${((passed / results.length) * 100).toFixed(1)}%\n`);

  // Per-category breakdown
  const categories = [...new Set(results.map((r) => r.category))];
  for (const cat of categories) {
    const catResults = results.filter((r) => r.category === cat);
    const catPassed = catResults.filter((r) => r.passed).length;
    console.log(`  ${cat}: ${catPassed}/${catResults.length}`);
  }

  closeDb();
  process.exit(failed > 0 ? 1 : 0);
}

function evaluateQuery(q: EvalQuery): EvalResult {
  switch (q.category) {
    case "entity-lookup":
      return evalEntityLookup(q);
    case "fts-search":
      return evalFtsSearch(q);
    case "context-search":
      return evalContextSearch(q);
    case "structural":
      return evalStructural(q);
    default:
      return {
        id: q.id,
        category: q.category,
        description: q.description,
        passed: true,
        details: "Skipped (manual eval category)",
      };
  }
}

function evalEntityLookup(q: EvalQuery): EvalResult {
  // Try resolving the full query and extracted terms (matching real usage in buildContextPack)
  const terms = extractTermsForEval(q.query);
  let foundEntity = null;

  for (const term of terms) {
    const entity = resolveEntity(term);
    if (entity) {
      foundEntity = entity;
      break;
    }
  }

  if (q.expected_entity === null) {
    return {
      id: q.id,
      category: q.category,
      description: q.description,
      passed: foundEntity === null,
      details: foundEntity ? `Expected no entity, got ${foundEntity.entityId}` : "Correctly returned null",
    };
  }

  if (!foundEntity) {
    return {
      id: q.id,
      category: q.category,
      description: q.description,
      passed: false,
      details: `Expected entity ${q.expected_entity}, got null (tried: ${terms.join(", ")})`,
    };
  }

  const match = foundEntity.entityId === q.expected_entity || foundEntity.noteId === q.expected_entity;
  return {
    id: q.id,
    category: q.category,
    description: q.description,
    passed: match,
    details: match
      ? `Found entity ${foundEntity.entityId}`
      : `Expected ${q.expected_entity}, got ${foundEntity.entityId}`,
  };
}

function extractTermsForEval(query: string): string[] {
  const terms: string[] = [query.trim()];

  // Extract capitalized phrases
  const capitalPhraseRe = /(?:[A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*)+)/g;
  let match: RegExpExecArray | null;
  while ((match = capitalPhraseRe.exec(query)) !== null) {
    terms.push(match[0]);
  }

  // Individual words > 2 chars
  const words = query.split(/[\s,;?!.]+/).map(t => t.trim()).filter(t => t.length > 2);
  terms.push(...words);

  return [...new Set(terms)];
}

function evalFtsSearch(q: EvalQuery): EvalResult {
  const results = ftsSearch(q.query, { topK: 10 });
  const resultPaths = results.map((r) => r.path);

  if (!q.expected_notes?.length) {
    return {
      id: q.id,
      category: q.category,
      description: q.description,
      passed: true,
      details: `Got ${results.length} results`,
    };
  }

  const found = q.expected_notes.filter((p) => resultPaths.includes(p));
  const passed = found.length > 0;

  return {
    id: q.id,
    category: q.category,
    description: q.description,
    passed,
    details: passed
      ? `Found ${found.length}/${q.expected_notes.length} expected notes`
      : `Missing: ${q.expected_notes.filter((p) => !resultPaths.includes(p)).join(", ")} | Got: ${resultPaths.slice(0, 3).join(", ")}`,
  };
}

function evalContextSearch(q: EvalQuery): EvalResult {
  const pack = buildContextPack(q.query, { includeContent: false });
  const resultPaths = pack.notes.map((n) => n.path);

  if (!q.expected_top_notes?.length) {
    return {
      id: q.id,
      category: q.category,
      description: q.description,
      passed: pack.notes.length > 0,
      details: `Got ${pack.notes.length} notes in context pack`,
    };
  }

  const found = q.expected_top_notes.filter((p) => resultPaths.includes(p));
  const passed = found.length > 0;

  return {
    id: q.id,
    category: q.category,
    description: q.description,
    passed,
    details: passed
      ? `Found ${found.length}/${q.expected_top_notes.length} expected notes in top results`
      : `Missing: ${q.expected_top_notes.filter((p) => !resultPaths.includes(p)).join(", ")} | Got: ${resultPaths.slice(0, 3).join(", ")}`,
  };
}

function evalStructural(q: EvalQuery): EvalResult {
  if (!q.entity) {
    return {
      id: q.id,
      category: q.category,
      description: q.description,
      passed: false,
      details: "No entity specified for structural test",
    };
  }

  const entity = resolveEntity(q.entity);
  if (!entity) {
    return {
      id: q.id,
      category: q.category,
      description: q.description,
      passed: false,
      details: `Entity not found: ${q.entity}`,
    };
  }

  if (q.expected_backlinks) {
    const backlinks = getBacklinks(entity.noteId);
    const backlinkIds = backlinks.map((b) => b.id);
    const found = q.expected_backlinks.filter((id) => backlinkIds.includes(id));
    const passed = found.length >= q.expected_backlinks.length;
    return {
      id: q.id,
      category: q.category,
      description: q.description,
      passed,
      details: passed
        ? `Found ${found.length} expected backlinks`
        : `Missing backlinks: ${q.expected_backlinks.filter((id) => !backlinkIds.includes(id)).join(", ")}`,
    };
  }

  if (q.expected_neighbors_min !== undefined) {
    const neighbors = getNeighborhood(entity.noteId, 1);
    const passed = neighbors.length >= q.expected_neighbors_min;
    return {
      id: q.id,
      category: q.category,
      description: q.description,
      passed,
      details: `Found ${neighbors.length} neighbors (expected >= ${q.expected_neighbors_min})`,
    };
  }

  return {
    id: q.id,
    category: q.category,
    description: q.description,
    passed: true,
    details: "No assertions specified",
  };
}

main();
