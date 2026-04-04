import { getDb } from "../index/sqlite.js";

export interface NoteRef {
  id: string;
  path: string;
  title: string;
  type: string | null;
}

export function getBacklinks(noteId: string): NoteRef[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT DISTINCT n.id, n.path, n.title, n.type
       FROM links l
       JOIN notes n ON n.id = l.src_id
       WHERE l.dst_id = ? AND n.visibility != 'private'`
    )
    .all(noteId) as NoteRef[];
}

export function getOutlinks(noteId: string): NoteRef[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT DISTINCT n.id, n.path, n.title, n.type
       FROM links l
       JOIN notes n ON n.id = l.dst_id
       WHERE l.src_id = ? AND l.dst_id IS NOT NULL AND n.visibility != 'private'`
    )
    .all(noteId) as NoteRef[];
}

export function getNeighborhood(noteId: string, maxDepth: number = 1): NoteRef[] {
  const visited = new Set<string>([noteId]);
  let frontier = [noteId];
  const results: NoteRef[] = [];

  for (let depth = 0; depth < maxDepth; depth++) {
    const nextFrontier: string[] = [];
    for (const current of frontier) {
      const backlinks = getBacklinks(current);
      const outlinks = getOutlinks(current);
      for (const ref of [...backlinks, ...outlinks]) {
        if (!visited.has(ref.id)) {
          visited.add(ref.id);
          results.push(ref);
          nextFrontier.push(ref.id);
        }
      }
    }
    frontier = nextFrontier;
  }

  return results;
}

export function getRecentSessions(entityId: string, limit: number = 5): NoteRef[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT DISTINCT n.id, n.path, n.title, n.type
       FROM entities e
       JOIN notes n ON n.id = e.note_id
       WHERE e.entity_id = ? AND n.type = 'session'
       ORDER BY n.updated_at DESC
       LIMIT ?`
    )
    .all(entityId, limit) as NoteRef[];
}

export function getRecentNotes(
  scope?: string,
  limit: number = 10
): NoteRef[] {
  const db = getDb();
  let sql = `
    SELECT id, path, title, type
    FROM notes
    WHERE visibility != 'private'
  `;
  const params: unknown[] = [];

  if (scope) {
    sql += ` AND path LIKE ?`;
    params.push(`${scope}%`);
  }

  sql += ` ORDER BY updated_at DESC LIMIT ?`;
  params.push(limit);

  return db.prepare(sql).all(...params) as NoteRef[];
}
