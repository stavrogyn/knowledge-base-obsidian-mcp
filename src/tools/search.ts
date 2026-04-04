import { ftsSearch } from "../index/fts.js";
import { buildContextPack } from "../retrieval/search.js";

export const searchToolDef = {
  name: "kb_search",
  description:
    "Search the knowledge base by query. Returns matching notes ranked by relevance. " +
    "Supports filtering by note type (project, person, concept, decision, session, memory-fact, wiki-article) " +
    "and tags. Use this as the primary tool for finding relevant context.",
  inputSchema: {
    type: "object" as const,
    properties: {
      query: {
        type: "string",
        description: "Search query text",
      },
      types: {
        type: "array",
        items: { type: "string" },
        description:
          "Filter by note types: project, person, concept, decision, session, memory-fact, wiki-article",
      },
      tags: {
        type: "array",
        items: { type: "string" },
        description: "Filter by tags",
      },
      top_k: {
        type: "number",
        description: "Max results to return (default: 10)",
      },
    },
    required: ["query"],
  },
};

export function handleSearch(args: {
  query: string;
  types?: string[];
  tags?: string[];
  top_k?: number;
}): object {
  const results = ftsSearch(args.query, {
    topK: args.top_k || 10,
    types: args.types,
    tags: args.tags,
  });

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            query: args.query,
            count: results.length,
            results: results.map((r) => ({
              id: r.id,
              path: r.path,
              title: r.title,
              type: r.type,
              snippet: r.snippet,
            })),
          },
          null,
          2
        ),
      },
    ],
  };
}

export const contextSearchToolDef = {
  name: "kb_context_search",
  description:
    "Build a rich context pack for a query using the full retrieval cascade: " +
    "entity resolution, structural expansion (backlinks, neighbors), FTS search, " +
    "and budget-aware content assembly. Returns up to 8 relevant notes with content. " +
    "Use this when you need deep context on a topic, not just search results.",
  inputSchema: {
    type: "object" as const,
    properties: {
      query: {
        type: "string",
        description: "Query to build context for",
      },
      entity_hints: {
        type: "array",
        items: { type: "string" },
        description: "Known entity IDs or names to prioritize",
      },
      max_notes: {
        type: "number",
        description: "Max notes in context pack (default: 8)",
      },
      max_tokens: {
        type: "number",
        description: "Max token budget (default: 8000)",
      },
    },
    required: ["query"],
  },
};

export function handleContextSearch(args: {
  query: string;
  entity_hints?: string[];
  max_notes?: number;
  max_tokens?: number;
}): object {
  const pack = buildContextPack(args.query, {
    entityHints: args.entity_hints,
    maxNotes: args.max_notes,
    maxTokens: args.max_tokens,
    includeContent: true,
  });

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            query: args.query,
            entityMatches: pack.entityMatches.map((e) => ({
              entityId: e.entityId,
              title: e.title,
              type: e.type,
            })),
            totalTokensEstimate: pack.totalTokensEstimate,
            notes: pack.notes.map((n) => ({
              id: n.id,
              path: n.path,
              title: n.title,
              type: n.type,
              source: n.source,
              content: n.content,
            })),
          },
          null,
          2
        ),
      },
    ],
  };
}
