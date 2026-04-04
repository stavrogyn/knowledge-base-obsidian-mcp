import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, relative, extname, resolve, sep } from "path";
import { config } from "../config.js";
import { parseNote, type ParsedNote } from "./parser.js";

function isInsideVault(fullPath: string): boolean {
  const resolved = resolve(fullPath);
  const vaultRoot = resolve(config.vaultPath);
  return resolved === vaultRoot || resolved.startsWith(vaultRoot + sep);
}

export function readNote(notePath: string): ParsedNote | null {
  const fullPath = resolveNotePath(notePath);
  if (!fullPath || !existsSync(fullPath)) return null;
  const raw = readFileSync(fullPath, "utf-8");
  return parseNote(raw);
}

export function readNoteRaw(notePath: string): string | null {
  const fullPath = resolveNotePath(notePath);
  if (!fullPath || !existsSync(fullPath)) return null;
  return readFileSync(fullPath, "utf-8");
}

export function listAllNotes(): string[] {
  const notes: string[] = [];
  walkDir(config.vaultPath, notes);
  return notes;
}

function walkDir(dir: string, result: string[]): void {
  if (!existsSync(dir)) return;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(full, result);
    } else if (extname(entry.name) === ".md") {
      result.push(relative(config.vaultPath, full));
    }
  }
}

export function resolveNotePath(notePath: string): string | null {
  if (!notePath) return null;

  let candidate: string | null = null;

  if (notePath.startsWith("/")) {
    candidate = resolve(notePath);
  } else {
    candidate = resolve(config.vaultPath, notePath);
  }

  if (isInsideVault(candidate) && existsSync(candidate)) return candidate;

  if (!notePath.endsWith(".md")) {
    const withExt = candidate + ".md";
    if (isInsideVault(withExt) && existsSync(withExt)) return withExt;
  }

  const allNotes = listAllNotes();
  const target = notePath.replace(/\.md$/, "");
  for (const p of allNotes) {
    const name = p.replace(/\.md$/, "").split("/").pop();
    if (name === target) return join(config.vaultPath, p);
  }

  return null;
}

export function getNoteStats(notePath: string): { mtime: Date; size: number } | null {
  const fullPath = resolveNotePath(notePath);
  if (!fullPath || !existsSync(fullPath)) return null;
  const stat = statSync(fullPath);
  return { mtime: stat.mtime, size: stat.size };
}
