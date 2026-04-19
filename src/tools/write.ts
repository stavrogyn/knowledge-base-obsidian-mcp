import { writeSessionSummary, type SessionSummaryInput } from "../memory/session.js";
import { createMemoryCandidate, type MemoryCandidateInput } from "../memory/candidate.js";
import { config } from "../config.js";

export const writeSessionSummaryToolDef = {
  name: "kb_write_session_summary",
  description:
    "Write a session summary to the knowledge base. Call this at the end of a conversation " +
    "to persist what was discussed, decisions made, and key facts learned. " +
    `Summaries are stored in ${config.dirs.sessions}/ with review_status: draft.`,
  inputSchema: {
    type: "object" as const,
    properties: {
      user_intent: {
        type: "string",
        description: "Brief description of what the user wanted to accomplish",
      },
      decisions_discussed: {
        type: "array",
        items: { type: "string" },
        description: "List of decisions discussed or made during the session",
      },
      key_facts: {
        type: "array",
        items: { type: "string" },
        description: "Important facts learned during the session",
      },
      entities_mentioned: {
        type: "array",
        items: { type: "string" },
        description: "Entity IDs or names referenced during the session",
      },
      follow_up_items: {
        type: "array",
        items: { type: "string" },
        description: "Action items or follow-ups to track",
      },
    },
    required: ["user_intent", "decisions_discussed", "key_facts", "entities_mentioned"],
  },
};

export function handleWriteSessionSummary(args: {
  user_intent: string;
  decisions_discussed: string[];
  key_facts: string[];
  entities_mentioned: string[];
  follow_up_items?: string[];
}): object {
  const result = writeSessionSummary({
    userIntent: args.user_intent,
    decisionsDiscussed: args.decisions_discussed,
    keyFacts: args.key_facts,
    entitiesMentioned: args.entities_mentioned,
    followUpItems: args.follow_up_items,
  });

  if (!result.success) {
    return {
      content: [{ type: "text", text: `Error: ${result.error}` }],
      isError: true,
    };
  }

  return {
    content: [
      {
        type: "text",
        text: `Session summary written to ${result.path}`,
      },
    ],
  };
}

export const createMemoryCandidateToolDef = {
  name: "kb_create_memory_candidate",
  description:
    "Create a memory candidate -- a durable fact extracted from the current session. " +
    `Candidates are stored in ${config.dirs.agentMemory}/candidates/ with review_status: draft. ` +
    "They require human review before being promoted to the main knowledge base.",
  inputSchema: {
    type: "object" as const,
    properties: {
      entity_id: {
        type: "string",
        description: "Entity ID this fact relates to (e.g., 'proj-kb-system', 'person-user')",
      },
      fact: {
        type: "string",
        description: "The fact to remember as a clear, concise statement",
      },
      evidence: {
        type: "array",
        items: { type: "string" },
        description: "Evidence supporting this fact (session IDs, source references)",
      },
      confidence: {
        type: "string",
        enum: ["high", "medium", "low"],
        description: "Confidence level in this fact (default: medium)",
      },
      tags: {
        type: "array",
        items: { type: "string" },
        description: "Tags for categorization",
      },
    },
    required: ["entity_id", "fact", "evidence"],
  },
};

export function handleCreateMemoryCandidate(args: {
  entity_id: string;
  fact: string;
  evidence: string[];
  confidence?: "high" | "medium" | "low";
  tags?: string[];
}): object {
  const result = createMemoryCandidate({
    entityId: args.entity_id,
    fact: args.fact,
    evidence: args.evidence,
    confidence: args.confidence,
    tags: args.tags,
  });

  if (!result.success) {
    return {
      content: [{ type: "text", text: `Error: ${result.error}` }],
      isError: true,
    };
  }

  return {
    content: [
      {
        type: "text",
        text: `Memory candidate created at ${result.path}`,
      },
    ],
  };
}
