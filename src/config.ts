import { resolve } from "path";
import { homedir } from "os";

function resolveHome(p: string): string {
  if (p.startsWith("~/")) return resolve(homedir(), p.slice(2));
  return resolve(p);
}

export const config = {
  vaultPath: resolveHome(process.env.KB_VAULT_PATH || "~/knowledge-base"),
  dbPath: resolveHome(
    process.env.KB_DB_PATH || "~/knowledge-base/.kb-index.db"
  ),

  dirs: {
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
  },

  writableDirs: [
    "01-wiki",
    "05-agent-memory",
    "06-sessions",
    "07-indexes",
  ],

  retrieval: {
    maxNotes: 8,
    maxTokens: 8000,
    ftsTopK: 15,
    approxTokensPerChar: 0.25,
  },
} as const;
