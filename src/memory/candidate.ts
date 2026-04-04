import { writeNote, type WriteResult } from "../vault/writer.js";
import { readNote } from "../vault/reader.js";
import { config } from "../config.js";

export interface MemoryCandidateInput {
  entityId: string;
  fact: string;
  evidence: string[];
  confidence?: "high" | "medium" | "low";
  tags?: string[];
  sessionId?: string;
}

export function createMemoryCandidate(input: MemoryCandidateInput): WriteResult {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const slug = input.fact
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 40)
    .replace(/-$/, "");

  const id = `mem-${dateStr}-${slug}`;
  const relativePath = `${config.dirs.agentMemory}/candidates/${id}.md`;

  const frontmatter = {
    id,
    type: "memory-fact",
    title: input.fact.slice(0, 100),
    aliases: [],
    tags: input.tags || ["memory"],
    entities: [input.entityId],
    entity_id: input.entityId,
    status: "active",
    visibility: "agent-readable",
    source_type: "agent",
    review_status: "draft",
    confidence: input.confidence || "medium",
    evidence: input.evidence,
    created_at: dateStr,
    updated_at: dateStr,
  };

  return writeNote(relativePath, frontmatter, input.fact, "kb_create_memory_candidate", input.sessionId);
}

export function promoteMemoryCandidate(candidatePath: string): WriteResult {
  const candidatesPrefix = `${config.dirs.agentMemory}/candidates/`;
  const promotedPrefix = `${config.dirs.agentMemory}/promoted/`;

  if (!candidatePath.startsWith(candidatesPrefix)) {
    return {
      success: false,
      path: candidatePath,
      error: `Invalid candidate path: must be under ${candidatesPrefix}`,
    };
  }

  const parsed = readNote(candidatePath);
  if (!parsed) {
    return { success: false, path: candidatePath, error: "Candidate not found" };
  }

  const filename = candidatePath.slice(candidatesPrefix.length);
  if (filename.includes("/") || filename.includes("..")) {
    return { success: false, path: candidatePath, error: "Invalid candidate filename" };
  }

  const promotedPath = promotedPrefix + filename;
  const fm = {
    ...parsed.frontmatter,
    review_status: "promoted",
    updated_at: new Date().toISOString().slice(0, 10),
  };

  return writeNote(promotedPath, fm, parsed.content, "kb_promote_memory");
}
