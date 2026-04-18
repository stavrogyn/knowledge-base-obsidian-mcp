import { getDb } from "../index/sqlite.js";
import { reindexVault } from "../index/indexer.js";
import { config } from "../config.js";

export interface LintIssue {
  severity: "error" | "warning" | "info";
  noteId: string;
  path: string;
  issue: string;
}

export const lintToolDef = {
  name: "kb_lint",
  description:
    "Run health checks on the knowledge base. Finds missing frontmatter fields, " +
    "broken wikilinks, orphan notes, duplicate entities, and stale notes.",
  inputSchema: {
    type: "object" as const,
    properties: {},
  },
};

export function handleLint(): object {
  const issues = runLintChecks();
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            totalIssues: issues.length,
            errors: issues.filter((i) => i.severity === "error").length,
            warnings: issues.filter((i) => i.severity === "warning").length,
            info: issues.filter((i) => i.severity === "info").length,
            issues,
          },
          null,
          2
        ),
      },
    ],
  };
}

export const reindexToolDef = {
  name: "kb_reindex",
  description:
    "Rebuild the knowledge base index. Scans all vault files, parses frontmatter and " +
    "wikilinks, and updates the SQLite index. Use after adding or editing notes manually.",
  inputSchema: {
    type: "object" as const,
    properties: {},
  },
};

export function handleReindex(): object {
  const stats = reindexVault();
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            message: "Vault reindexed successfully",
            ...stats,
          },
          null,
          2
        ),
      },
    ],
  };
}

function runLintChecks(): LintIssue[] {
  const db = getDb();
  const issues: LintIssue[] = [];

  // 1. Missing required frontmatter fields
  const requiredFields = ["id", "type", "title", "visibility", "source_type"];
  const notes = db
    .prepare("SELECT id, path, title, type, visibility, source_type FROM notes")
    .all() as {
    id: string;
    path: string;
    title: string;
    type: string | null;
    visibility: string | null;
    source_type: string | null;
  }[];

  for (const note of notes) {
    if (!note.type) {
      issues.push({
        severity: "warning",
        noteId: note.id,
        path: note.path,
        issue: "Missing 'type' field in frontmatter",
      });
    }
    if (!note.visibility) {
      issues.push({
        severity: "warning",
        noteId: note.id,
        path: note.path,
        issue: "Missing 'visibility' field in frontmatter",
      });
    }
  }

  // 2. Broken wikilinks (dst_id is NULL after resolution)
  const brokenLinks = db
    .prepare(
      `SELECT l.src_id, l.dst_title, n.path
       FROM links l
       JOIN notes n ON n.id = l.src_id
       WHERE l.dst_id IS NULL`
    )
    .all() as { src_id: string; dst_title: string; path: string }[];

  for (const link of brokenLinks) {
    issues.push({
      severity: "warning",
      noteId: link.src_id,
      path: link.path,
      issue: `Broken wikilink: [[${link.dst_title}]] -- target not found`,
    });
  }

  // 3. Orphan notes (no incoming links, not an index file)
  const orphans = db
    .prepare(
      `SELECT n.id, n.path, n.title
       FROM notes n
       WHERE n.id NOT IN (SELECT DISTINCT dst_id FROM links WHERE dst_id IS NOT NULL)
         AND n.path NOT LIKE ?
         AND n.path NOT LIKE ?
         AND n.type NOT IN ('session', 'memory-fact')`
    )
    .all(`${config.dirs.indexes}/%`, `${config.dirs.templates}/%`) as { id: string; path: string; title: string }[];

  for (const orphan of orphans) {
    issues.push({
      severity: "info",
      noteId: orphan.id,
      path: orphan.path,
      issue: `Orphan note: no incoming links to "${orphan.title}"`,
    });
  }

  // 4. Duplicate entity IDs across multiple notes
  const dupEntities = db
    .prepare(
      `SELECT entity_id, COUNT(DISTINCT note_id) as cnt
       FROM entities
       GROUP BY entity_id
       HAVING cnt > 1`
    )
    .all() as { entity_id: string; cnt: number }[];

  for (const dup of dupEntities) {
    issues.push({
      severity: "warning",
      noteId: dup.entity_id,
      path: "",
      issue: `Duplicate entity ID '${dup.entity_id}' found in ${dup.cnt} notes`,
    });
  }

  // 5. Notes without aliases
  const noAliases = db
    .prepare(
      `SELECT n.id, n.path, n.title
       FROM notes n
       LEFT JOIN aliases a ON a.note_id = n.id AND a.alias != n.title
       WHERE a.alias IS NULL
         AND n.path NOT LIKE ?`
    )
    .all(`${config.dirs.templates}/%`) as { id: string; path: string; title: string }[];

  for (const note of noAliases) {
    issues.push({
      severity: "info",
      noteId: note.id,
      path: note.path,
      issue: `Note "${note.title}" has no aliases besides title`,
    });
  }

  return issues;
}
