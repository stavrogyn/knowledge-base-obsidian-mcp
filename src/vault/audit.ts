import { appendFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { config } from "../config.js";

export interface AuditEntry {
  timestamp: string;
  tool: string;
  sessionId: string;
  action: string;
  path: string;
  contentHash?: string;
  query?: string;
  pathsRead?: string[];
}

const AUDIT_FILE = join(config.vaultPath, ".kb-audit.jsonl");

export function auditLog(entry: AuditEntry): void {
  const dir = dirname(AUDIT_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  appendFileSync(AUDIT_FILE, JSON.stringify(entry) + "\n", "utf-8");
}
