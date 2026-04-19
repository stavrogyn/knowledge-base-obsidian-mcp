import { resolve, normalize, sep } from "path";

/** Logical vault buckets (folder names are configurable). */
export const VAULT_DIR_KEYS = [
  "raw",
  "wiki",
  "projects",
  "people",
  "decisions",
  "agentMemory",
  "sessions",
  "indexes",
  "templates",
  "archive",
] as const;

export type VaultDirKey = (typeof VAULT_DIR_KEYS)[number];

export type VaultDirs = Record<VaultDirKey, string>;

export const DEFAULT_VAULT_DIRS: VaultDirs = {
  raw: "00-raw",
  wiki: "01-wiki",
  projects: "02-projects",
  people: "03-people",
  decisions: "04-decisions",
  agentMemory: "05-agent-memory",
  sessions: "06-sessions",
  indexes: "07-indexes",
  templates: "08-templates",
  archive: "99-archive",
};

const ENV_KEY_MAP: Record<VaultDirKey, string> = {
  raw: "KB_DIR_RAW",
  wiki: "KB_DIR_WIKI",
  projects: "KB_DIR_PROJECTS",
  people: "KB_DIR_PEOPLE",
  decisions: "KB_DIR_DECISIONS",
  agentMemory: "KB_DIR_AGENT_MEMORY",
  sessions: "KB_DIR_SESSIONS",
  indexes: "KB_DIR_INDEXES",
  templates: "KB_DIR_TEMPLATES",
  archive: "KB_DIR_ARCHIVE",
};

function normalizeDirSegment(v: string): string {
  const n = normalize(v.trim()).split(sep).join("/").replace(/^\/+/, "");
  if (!n || n.includes("..")) {
    throw new Error(`Invalid vault directory segment: ${JSON.stringify(v)}`);
  }
  return n;
}

function parseJsonDirs(raw: string): Partial<VaultDirs> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error("KB_VAULT_DIRS_JSON is not valid JSON");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("KB_VAULT_DIRS_JSON must be a JSON object");
  }
  const out: Partial<VaultDirs> = {};
  for (const key of VAULT_DIR_KEYS) {
    const v = (parsed as Record<string, unknown>)[key];
    if (v !== undefined) {
      if (typeof v !== "string") {
        throw new Error(`KB_VAULT_DIRS_JSON.${key} must be a string`);
      }
      out[key] = normalizeDirSegment(v);
    }
  }
  return out;
}

/**
 * Merge env-based overrides into defaults: KB_VAULT_DIRS_JSON, then KB_DIR_* vars.
 */
export function loadVaultDirsFromEnv(): VaultDirs {
  let merged: VaultDirs = { ...DEFAULT_VAULT_DIRS };

  const json = process.env.KB_VAULT_DIRS_JSON?.trim();
  if (json) {
    merged = { ...merged, ...parseJsonDirs(json) };
  }

  for (const key of VAULT_DIR_KEYS) {
    const envName = ENV_KEY_MAP[key];
    const v = process.env[envName]?.trim();
    if (v) {
      merged = { ...merged, [key]: normalizeDirSegment(v) };
    }
  }

  assertUniqueDirValues(merged);
  return merged;
}

export function assertUniqueDirValues(dirs: VaultDirs): void {
  const seen = new Map<string, VaultDirKey>();
  for (const key of VAULT_DIR_KEYS) {
    const v = dirs[key];
    const prev = seen.get(v);
    if (prev !== undefined) {
      throw new Error(
        `Duplicate vault directory path "${v}" for keys "${prev}" and "${key}". Each logical folder must map to a distinct path.`
      );
    }
    seen.set(v, key);
  }
}

/** Writable top-level dirs for agent tools (derived from layout). */
export function writableDirsFromLayout(dirs: VaultDirs): string[] {
  return [dirs.wiki, dirs.agentMemory, dirs.sessions, dirs.indexes];
}

export const LAYOUT_FILE_NAME = ".kb-vault-layout.json";

export interface VaultLayoutFile {
  version: 1;
  dirs: VaultDirs;
}

export function parseVaultLayoutFile(content: string): VaultLayoutFile {
  const parsed = JSON.parse(content) as unknown;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Layout file must be a JSON object");
  }
  const v = (parsed as { version?: unknown }).version;
  if (v !== 1) {
    throw new Error(`Unsupported layout file version: ${String(v)}`);
  }
  const dirs = (parsed as { dirs?: unknown }).dirs;
  if (!dirs || typeof dirs !== "object") {
    throw new Error("Layout file must contain dirs");
  }
  const out: Partial<VaultDirs> = {};
  for (const key of VAULT_DIR_KEYS) {
    const val = (dirs as Record<string, unknown>)[key];
    if (typeof val !== "string") {
      throw new Error(`Layout dirs.${key} must be a string`);
    }
    out[key] = normalizeDirSegment(val);
  }
  const full = out as VaultDirs;
  assertUniqueDirValues(full);
  return { version: 1, dirs: full };
}

export function serializeVaultLayoutFile(dirs: VaultDirs): string {
  assertUniqueDirValues(dirs);
  const body: VaultLayoutFile = { version: 1, dirs };
  return JSON.stringify(body, null, 2) + "\n";
}
