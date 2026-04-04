import { getDb } from "./sqlite.js";

export interface FtsResult {
  id: string;
  path: string;
  title: string;
  type: string | null;
  rank: number;
  snippet: string;
}

export function ftsSearch(
  query: string,
  options?: {
    topK?: number;
    types?: string[];
    tags?: string[];
    visibility?: string[];
  }
): FtsResult[] {
  const db = getDb();
  const topK = options?.topK ?? 15;

  // Sanitize query for FTS5: escape double quotes, wrap terms
  const sanitized = query
    .replace(/"/g, '""')
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => `"${term}"`)
    .join(" OR ");

  if (!sanitized) return [];

  let sql = `
    SELECT
      f.id,
      n.path,
      n.title,
      n.type,
      rank,
      snippet(notes_fts, 2, '>>>', '<<<', '...', 40) as snippet
    FROM notes_fts f
    JOIN notes n ON n.id = f.id
    WHERE notes_fts MATCH ?
      AND n.visibility != 'private'
  `;

  const params: unknown[] = [sanitized];

  if (options?.types?.length) {
    sql += ` AND n.type IN (${options.types.map(() => "?").join(",")})`;
    params.push(...options.types);
  }

  if (options?.visibility?.length) {
    sql += ` AND n.visibility IN (${options.visibility.map(() => "?").join(",")})`;
    params.push(...options.visibility);
  }

  sql += ` ORDER BY rank LIMIT ?`;
  params.push(topK);

  const rows = db.prepare(sql).all(...params) as FtsResult[];

  // Tag filtering done post-query since tags are in a separate table
  if (options?.tags?.length) {
    const tagSet = new Set(options.tags.map((t) => t.toLowerCase()));
    return rows.filter((row) => {
      const noteTags = db
        .prepare("SELECT tag FROM tags WHERE note_id = ?")
        .all(row.id) as { tag: string }[];
      return noteTags.some((t) => tagSet.has(t.tag.toLowerCase()));
    });
  }

  return rows;
}
