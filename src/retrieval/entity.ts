import { getDb } from "../index/sqlite.js";

export interface EntityInfo {
  entityId: string;
  noteId: string;
  path: string;
  title: string;
  type: string | null;
  aliases: string[];
  tags: string[];
}

export function findEntityById(entityId: string): EntityInfo | null {
  const db = getDb();

  const row = db
    .prepare(
      `SELECT e.entity_id, e.note_id, n.path, n.title, n.type
       FROM entities e
       JOIN notes n ON n.id = e.note_id
       WHERE e.entity_id = ? AND n.visibility != 'private'
       LIMIT 1`
    )
    .get(entityId) as
    | { entity_id: string; note_id: string; path: string; title: string; type: string | null }
    | undefined;

  if (!row) return null;

  const aliases = db
    .prepare("SELECT alias FROM aliases WHERE note_id = ?")
    .all(row.note_id) as { alias: string }[];

  const tags = db
    .prepare("SELECT tag FROM tags WHERE note_id = ?")
    .all(row.note_id) as { tag: string }[];

  return {
    entityId: row.entity_id,
    noteId: row.note_id,
    path: row.path,
    title: row.title,
    type: row.type,
    aliases: aliases.map((a) => a.alias),
    tags: tags.map((t) => t.tag),
  };
}

export function findEntityByAlias(alias: string): EntityInfo | null {
  const db = getDb();

  const row = db
    .prepare(
      `SELECT a.note_id, n.path, n.title, n.type
       FROM aliases a
       JOIN notes n ON n.id = a.note_id
       WHERE a.alias = ? AND n.visibility != 'private'
       LIMIT 1`
    )
    .get(alias) as
    | { note_id: string; path: string; title: string; type: string | null }
    | undefined;

  if (!row) return null;

  const entities = db
    .prepare("SELECT entity_id FROM entities WHERE note_id = ?")
    .all(row.note_id) as { entity_id: string }[];

  const aliases = db
    .prepare("SELECT alias FROM aliases WHERE note_id = ?")
    .all(row.note_id) as { alias: string }[];

  const tags = db
    .prepare("SELECT tag FROM tags WHERE note_id = ?")
    .all(row.note_id) as { tag: string }[];

  return {
    entityId: entities[0]?.entity_id || row.note_id,
    noteId: row.note_id,
    path: row.path,
    title: row.title,
    type: row.type,
    aliases: aliases.map((a) => a.alias),
    tags: tags.map((t) => t.tag),
  };
}

export function resolveEntity(query: string): EntityInfo | null {
  return findEntityById(query) || findEntityByAlias(query);
}
