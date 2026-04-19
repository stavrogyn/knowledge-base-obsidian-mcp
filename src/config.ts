import { config as loadDotenv } from "dotenv";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { homedir } from "os";
import { loadVaultDirsFromEnv, writableDirsFromLayout, type VaultDirs } from "./vault-layout.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(__dirname, "../.env"), quiet: true });

function resolveHome(p: string): string {
  if (p.startsWith("~/")) return resolve(homedir(), p.slice(2));
  return resolve(p);
}

const vaultPath = resolveHome(process.env.KB_VAULT_PATH || "~/knowledge-base");
const dbPath = process.env.KB_DB_PATH
  ? resolveHome(process.env.KB_DB_PATH)
  : join(vaultPath, ".kb-index.db");

const dirs: VaultDirs = loadVaultDirsFromEnv();

export const config = {
  vaultPath,
  dbPath,

  /** Top-level folder names (defaults + KB_VAULT_DIRS_JSON / KB_DIR_* env). */
  dirs,

  /** Agent-writable roots — derived from dirs (wiki, agent memory, sessions, indexes). */
  writableDirs: writableDirsFromLayout(dirs),

  retrieval: {
    maxNotes: 8,
    maxTokens: 8000,
    ftsTopK: 15,
    approxTokensPerChar: 0.25,
  },
} as const;
