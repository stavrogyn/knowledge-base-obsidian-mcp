import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname, resolve, sep, normalize } from "path";
import { createHash } from "crypto";
import { config } from "../config.js";
import { readNote } from "./reader.js";
import { buildNoteContent, type NoteFrontmatter } from "./parser.js";
import { auditLog } from "./audit.js";

export interface WriteResult {
  success: boolean;
  path: string;
  error?: string;
}

function normalizeRelative(relativePath: string): string {
  const normalized = normalize(relativePath).split(sep).join("/");
  return normalized.startsWith("/") ? normalized.slice(1) : normalized;
}

function validateWritePath(relativePath: string): string | null {
  const normalized = normalizeRelative(relativePath);

  if (normalized.startsWith("..") || normalized.includes("/../")) {
    return `Write denied: path escapes vault: ${relativePath}`;
  }

  const fullResolved = resolve(config.vaultPath, normalized);
  const vaultRoot = resolve(config.vaultPath);
  if (!fullResolved.startsWith(vaultRoot + sep)) {
    return `Write denied: resolved path escapes vault: ${relativePath}`;
  }

  if (!config.writableDirs.some((dir) => normalized.startsWith(dir + "/") || normalized === dir)) {
    return `Write denied: ${normalized} is not in a writable directory`;
  }

  return null;
}

export function isWritableDir(relativePath: string): boolean {
  return validateWritePath(relativePath) === null;
}

export function writeNote(
  relativePath: string,
  frontmatter: Record<string, unknown>,
  body: string,
  toolName: string,
  sessionId?: string
): WriteResult {
  const normalized = normalizeRelative(relativePath);
  const validationError = validateWritePath(normalized);
  if (validationError) {
    return { success: false, path: relativePath, error: validationError };
  }

  const existing = readNote(normalized);
  if (existing && existing.frontmatter.source_type === "human") {
    return {
      success: false,
      path: normalized,
      error: `Write denied: cannot overwrite human-authored note ${normalized}`,
    };
  }

  const fullPath = resolve(config.vaultPath, normalized);
  const dir = dirname(fullPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const content = buildNoteContent(frontmatter, body);
  writeFileSync(fullPath, content, "utf-8");

  const contentHash = createHash("sha256").update(content).digest("hex").slice(0, 16);

  auditLog({
    timestamp: new Date().toISOString(),
    tool: toolName,
    sessionId: sessionId || "unknown",
    action: existing ? "update" : "create",
    path: normalized,
    contentHash,
  });

  return { success: true, path: normalized };
}

export function appendToNote(
  relativePath: string,
  section: string,
  toolName: string,
  sessionId?: string
): WriteResult {
  const normalized = normalizeRelative(relativePath);
  const validationError = validateWritePath(normalized);
  if (validationError) {
    return { success: false, path: relativePath, error: validationError };
  }

  const existing = readNote(normalized);
  if (!existing) {
    return {
      success: false,
      path: normalized,
      error: `Note not found: ${normalized}`,
    };
  }

  if (existing.frontmatter.source_type === "human") {
    return {
      success: false,
      path: normalized,
      error: `Write denied: cannot modify human-authored note ${normalized}`,
    };
  }

  const fullPath = resolve(config.vaultPath, normalized);
  const newContent = existing.rawContent.trimEnd() + "\n\n" + section.trim() + "\n";
  writeFileSync(fullPath, newContent, "utf-8");

  const contentHash = createHash("sha256").update(newContent).digest("hex").slice(0, 16);

  auditLog({
    timestamp: new Date().toISOString(),
    tool: toolName,
    sessionId: sessionId || "unknown",
    action: "append",
    path: normalized,
    contentHash,
  });

  return { success: true, path: normalized };
}
