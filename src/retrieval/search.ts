import { resolveEntity, type EntityInfo } from "./entity.js";
import { getBacklinks, getNeighborhood, getRecentSessions } from "./structural.js";
import { ftsSearch, type FtsResult } from "../index/fts.js";
import { readNote } from "../vault/reader.js";
import { config } from "../config.js";

export interface ContextNote {
  id: string;
  path: string;
  title: string;
  type: string | null;
  source: "entity" | "structural" | "fts";
  score: number;
  content?: string;
}

export interface ContextPack {
  notes: ContextNote[];
  totalTokensEstimate: number;
  entityMatches: EntityInfo[];
}

export function buildContextPack(
  query: string,
  options?: {
    entityHints?: string[];
    maxNotes?: number;
    maxTokens?: number;
    includeContent?: boolean;
  }
): ContextPack {
  const maxNotes = options?.maxNotes ?? config.retrieval.maxNotes;
  const maxTokens = options?.maxTokens ?? config.retrieval.maxTokens;
  const includeContent = options?.includeContent ?? true;

  const candidates = new Map<string, ContextNote>();
  const entityMatches: EntityInfo[] = [];

  // Step 1: Entity resolution from query terms and hints
  const terms = extractQueryTerms(query);
  const allTerms = [...terms, ...(options?.entityHints || [])];

  for (const term of allTerms) {
    const entity = resolveEntity(term);
    if (entity) {
      entityMatches.push(entity);
      addCandidate(candidates, {
        id: entity.noteId,
        path: entity.path,
        title: entity.title,
        type: entity.type,
        source: "entity",
        score: 100,
      });

      // Step 2: Structural expansion for matched entities
      const neighbors = getNeighborhood(entity.noteId, 1);
      for (const n of neighbors) {
        addCandidate(candidates, {
          id: n.id,
          path: n.path,
          title: n.title,
          type: n.type,
          source: "structural",
          score: 50,
        });
      }

      const sessions = getRecentSessions(entity.entityId, 3);
      for (const s of sessions) {
        addCandidate(candidates, {
          id: s.id,
          path: s.path,
          title: s.title,
          type: s.type,
          source: "structural",
          score: 60,
        });
      }
    }
  }

  // Step 3: FTS search
  const ftsResults = ftsSearch(query, { topK: config.retrieval.ftsTopK });
  for (const result of ftsResults) {
    addCandidate(candidates, {
      id: result.id,
      path: result.path,
      title: result.title,
      type: result.type,
      source: "fts",
      score: 30 + Math.abs(result.rank) * 10,
    });
  }

  // Step 4: Rank and select
  let ranked = [...candidates.values()].sort((a, b) => b.score - a.score);
  ranked = ranked.slice(0, maxNotes);

  // Step 5: Load content with budget
  let totalTokens = 0;
  if (includeContent) {
    for (const note of ranked) {
      const parsed = readNote(note.path);
      if (parsed) {
        const tokens = Math.ceil(parsed.content.length * config.retrieval.approxTokensPerChar);
        if (totalTokens + tokens > maxTokens) {
          // Include truncated content
          const remaining = maxTokens - totalTokens;
          const charBudget = Math.floor(remaining / config.retrieval.approxTokensPerChar);
          note.content = parsed.content.slice(0, charBudget) + "\n\n[...truncated]";
          totalTokens = maxTokens;
          break;
        }
        note.content = parsed.content;
        totalTokens += tokens;
      }
    }
  }

  return { notes: ranked, totalTokensEstimate: totalTokens, entityMatches };
}

function addCandidate(
  map: Map<string, ContextNote>,
  note: ContextNote
): void {
  const existing = map.get(note.id);
  if (existing) {
    existing.score = Math.max(existing.score, note.score);
    if (note.source === "entity") existing.source = "entity";
  } else {
    map.set(note.id, note);
  }
}

function extractQueryTerms(query: string): string[] {
  const terms: string[] = [];

  // Try the full query first (for alias matching like "AI Knowledge Base System")
  terms.push(query.trim());

  // Extract contiguous capitalized phrases (e.g., "Model Context Protocol")
  const capitalPhraseRe = /(?:[A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*)+)/g;
  let match: RegExpExecArray | null;
  while ((match = capitalPhraseRe.exec(query)) !== null) {
    terms.push(match[0]);
  }

  // Individual words (> 2 chars)
  const words = query
    .split(/[\s,;?!.]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2);
  terms.push(...words);

  return [...new Set(terms)];
}
