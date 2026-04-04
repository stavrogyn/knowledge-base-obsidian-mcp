import Database from "better-sqlite3";
import { config } from "../config.js";

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(config.dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initSchema(db);
  }
  return db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      path TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      type TEXT,
      visibility TEXT DEFAULT 'agent-readable',
      source_type TEXT DEFAULT 'human',
      review_status TEXT DEFAULT 'draft',
      status TEXT DEFAULT 'active',
      created_at TEXT,
      updated_at TEXT,
      content_hash TEXT NOT NULL,
      content TEXT
    );

    CREATE TABLE IF NOT EXISTS aliases (
      note_id TEXT NOT NULL,
      alias TEXT NOT NULL COLLATE NOCASE,
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS links (
      src_id TEXT NOT NULL,
      dst_title TEXT NOT NULL,
      dst_id TEXT,
      link_type TEXT DEFAULT 'wiki',
      FOREIGN KEY (src_id) REFERENCES notes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS entities (
      entity_id TEXT NOT NULL,
      note_id TEXT NOT NULL,
      entity_type TEXT,
      PRIMARY KEY (entity_id, note_id),
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tags (
      note_id TEXT NOT NULL,
      tag TEXT NOT NULL COLLATE NOCASE,
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_aliases_alias ON aliases(alias);
    CREATE INDEX IF NOT EXISTS idx_links_src ON links(src_id);
    CREATE INDEX IF NOT EXISTS idx_links_dst ON links(dst_title);
    CREATE INDEX IF NOT EXISTS idx_links_dst_id ON links(dst_id);
    CREATE INDEX IF NOT EXISTS idx_entities_entity ON entities(entity_id);
    CREATE INDEX IF NOT EXISTS idx_tags_tag ON tags(tag);
    CREATE INDEX IF NOT EXISTS idx_notes_type ON notes(type);
    CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at);
  `);

  // FTS5 virtual table -- created separately to avoid IF NOT EXISTS issues
  try {
    db.exec(`
      CREATE VIRTUAL TABLE notes_fts USING fts5(
        id UNINDEXED,
        title,
        content,
        tags,
        aliases,
        tokenize='porter unicode61'
      );
    `);
  } catch {
    // Table already exists
  }
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
