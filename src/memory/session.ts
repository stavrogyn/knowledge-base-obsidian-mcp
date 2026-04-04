import { writeNote, type WriteResult } from "../vault/writer.js";
import { config } from "../config.js";

export interface SessionSummaryInput {
  userIntent: string;
  decisionsDiscussed: string[];
  keyFacts: string[];
  entitiesMentioned: string[];
  followUpItems?: string[];
  sessionId?: string;
}

export function writeSessionSummary(input: SessionSummaryInput): WriteResult {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const slug = input.userIntent
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 40)
    .replace(/-$/, "");

  const id = `sess-${dateStr}-${slug}`;
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, "0");

  const relativePath = `${config.dirs.sessions}/${year}/${month}/${id}.md`;

  const entityIds = input.entitiesMentioned.length > 0 ? input.entitiesMentioned : [id];

  const frontmatter = {
    id,
    type: "session",
    title: `Session: ${input.userIntent.slice(0, 80)}`,
    aliases: [],
    tags: ["session"],
    entities: entityIds,
    status: "active",
    visibility: "agent-readable",
    source_type: "agent",
    review_status: "draft",
    created_at: dateStr,
    updated_at: dateStr,
    confidence: "high",
  };

  const body = buildSessionBody(input);

  return writeNote(relativePath, frontmatter, body, "kb_write_session_summary", input.sessionId);
}

function buildSessionBody(input: SessionSummaryInput): string {
  const sections: string[] = [];

  sections.push(`## User Intent\n\n${input.userIntent}`);

  if (input.decisionsDiscussed.length > 0) {
    sections.push(
      `## Decisions Discussed\n\n${input.decisionsDiscussed.map((d) => `- ${d}`).join("\n")}`
    );
  }

  if (input.keyFacts.length > 0) {
    sections.push(
      `## Key Facts\n\n${input.keyFacts.map((f) => `- ${f}`).join("\n")}`
    );
  }

  if (input.entitiesMentioned.length > 0) {
    sections.push(
      `## Entities Mentioned\n\n${input.entitiesMentioned.map((e) => `- ${e}`).join("\n")}`
    );
  }

  if (input.followUpItems && input.followUpItems.length > 0) {
    sections.push(
      `## Follow-up Items\n\n${input.followUpItems.map((f) => `- ${f}`).join("\n")}`
    );
  }

  return sections.join("\n\n");
}
