import { createHash } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";
import { config } from "../config.js";
import { getDb } from "./sqlite.js";
import { listAllNotes } from "../vault/reader.js";
import { parseNote } from "../vault/parser.js";

export interface IndexStats {
  total: number;
  added: number;
  updated: number;
  removed: number;
  unchanged: number;
  errors: number;
}

export function reindexVault(): IndexStats {
  const db = getDb();
  const allPaths = listAllNotes();
  const stats: IndexStats = {
    total: allPaths.length,
    added: 0,
    updated: 0,
    removed: 0,
    unchanged: 0,
    errors: 0,
  };

  const existingHashes = new Map<string, string>();
  const rows = db.prepare("SELECT path, content_hash FROM notes").all() as {
    path: string;
    content_hash: string;
  }[];
  for (const row of rows) {
    existingHashes.set(row.path, row.content_hash);
  }

  const seenPaths = new Set<string>();

  const insertNote = db.prepare(`
    INSERT OR REPLACE INTO notes (id, path, title, type, visibility, source_type, review_status, status, created_at, updated_at, content_hash, content)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const deleteNote = db.prepare("DELETE FROM notes WHERE path = ?");
  const deleteAliases = db.prepare("DELETE FROM aliases WHERE note_id = ?");
  const deleteLinks = db.prepare("DELETE FROM links WHERE src_id = ?");
  const deleteEntities = db.prepare("DELETE FROM entities WHERE note_id = ?");
  const deleteTags = db.prepare("DELETE FROM tags WHERE note_id = ?");
  const deleteFts = db.prepare("DELETE FROM notes_fts WHERE id = ?");

  const insertAlias = db.prepare("INSERT INTO aliases (note_id, alias) VALUES (?, ?)");
  const insertLink = db.prepare("INSERT INTO links (src_id, dst_title, link_type) VALUES (?, ?, 'wiki')");
  const insertEntity = db.prepare("INSERT OR IGNORE INTO entities (entity_id, note_id, entity_type) VALUES (?, ?, ?)");
  const insertTag = db.prepare("INSERT INTO tags (note_id, tag) VALUES (?, ?)");
  const insertFts = db.prepare("INSERT INTO notes_fts (id, title, content, tags, aliases) VALUES (?, ?, ?, ?, ?)");

  const indexAll = db.transaction(() => {
    for (const relPath of allPaths) {
      seenPaths.add(relPath);

      try {
        const fullPath = join(config.vaultPath, relPath);
        const raw = readFileSync(fullPath, "utf-8");
        const hash = createHash("sha256").update(raw).digest("hex").slice(0, 16);

        if (existingHashes.get(relPath) === hash) {
          stats.unchanged++;
          continue;
        }

        const parsed = parseNote(raw);
        const fm = parsed.frontmatter;
        const noteId = fm.id || relPath;

        // Clear old data
        deleteAliases.run(noteId);
        deleteLinks.run(noteId);
        deleteEntities.run(noteId);
        deleteTags.run(noteId);
        deleteFts.run(noteId);

        insertNote.run(
          noteId,
          relPath,
          fm.title || relPath,
          fm.type || null,
          fm.visibility || "agent-readable",
          fm.source_type || "human",
          fm.review_status || "draft",
          fm.status || "active",
          dateToString(fm.created_at),
          dateToString(fm.updated_at),
          hash,
          parsed.content
        );

        // Aliases
        for (const alias of fm.aliases) {
          insertAlias.run(noteId, alias);
        }
        // Also index title as alias
        if (fm.title) {
          insertAlias.run(noteId, fm.title);
        }

        // Wikilinks
        for (const link of parsed.wikilinks) {
          insertLink.run(noteId, link);
        }

        // Entities
        for (const entityId of fm.entities) {
          insertEntity.run(entityId, noteId, fm.type || null);
        }

        // Tags
        for (const tag of fm.tags) {
          insertTag.run(noteId, tag);
        }

        // FTS
        insertFts.run(
          noteId,
          fm.title || "",
          parsed.content,
          fm.tags.join(" "),
          fm.aliases.join(" ")
        );

        if (existingHashes.has(relPath)) {
          stats.updated++;
        } else {
          stats.added++;
        }
      } catch (err) {
        stats.errors++;
        console.error(`Index error for ${relPath}:`, err);
      }
    }

    // Remove notes no longer in vault
    for (const [path] of existingHashes) {
      if (!seenPaths.has(path)) {
        const row = db.prepare("SELECT id FROM notes WHERE path = ?").get(path) as
          | { id: string }
          | undefined;
        if (row) {
          deleteAliases.run(row.id);
          deleteLinks.run(row.id);
          deleteEntities.run(row.id);
          deleteTags.run(row.id);
          deleteFts.run(row.id);
          deleteNote.run(path);
          stats.removed++;
        }
      }
    }
  });

  indexAll();

  // Resolve link dst_id from dst_title
  resolveLinks();

  return stats;
}

function dateToString(val: unknown): string | null {
  if (val == null) return null;
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return String(val);
}

function resolveLinks(): void {
  const db = getDb();
  db.exec(`
    UPDATE links SET dst_id = (
      SELECT n.id FROM notes n
      WHERE n.title = links.dst_title
      UNION
      SELECT a.note_id FROM aliases a
      WHERE a.alias = links.dst_title
      LIMIT 1
    )
    WHERE dst_id IS NULL
  `);
}
