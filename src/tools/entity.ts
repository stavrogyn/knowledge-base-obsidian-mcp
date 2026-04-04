import { resolveEntity } from "../retrieval/entity.js";
import { getBacklinks, getNeighborhood, getRecentSessions } from "../retrieval/structural.js";
import { readNote } from "../vault/reader.js";
import { getRecentNotes } from "../retrieval/structural.js";

export const getEntityToolDef = {
  name: "kb_get_entity",
  description:
    "Get entity context from the knowledge base. Resolves an entity by ID, title, or alias, " +
    "then returns the entity card with backlinks, neighbors, and recent sessions. " +
    "Use this when you know a specific entity you need context about.",
  inputSchema: {
    type: "object" as const,
    properties: {
      entity: {
        type: "string",
        description: "Entity ID (e.g., 'proj-kb-system'), title, or alias",
      },
      include_content: {
        type: "boolean",
        description: "Include full note content (default: true)",
      },
      depth: {
        type: "number",
        description: "Neighbor expansion depth (default: 1)",
      },
    },
    required: ["entity"],
  },
};

export function handleGetEntity(args: {
  entity: string;
  include_content?: boolean;
  depth?: number;
}): object {
  const entity = resolveEntity(args.entity);
  if (!entity) {
    return {
      content: [{ type: "text", text: `Entity not found: ${args.entity}` }],
      isError: true,
    };
  }

  const backlinks = getBacklinks(entity.noteId);
  const neighbors = getNeighborhood(entity.noteId, args.depth ?? 1);
  const sessions = getRecentSessions(entity.entityId, 5);

  let content: string | undefined;
  if (args.include_content !== false) {
    const parsed = readNote(entity.path);
    content = parsed?.content;
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            entity: {
              id: entity.entityId,
              noteId: entity.noteId,
              path: entity.path,
              title: entity.title,
              type: entity.type,
              aliases: entity.aliases,
              tags: entity.tags,
            },
            content,
            backlinks: backlinks.map((b) => ({
              id: b.id,
              title: b.title,
              type: b.type,
            })),
            neighbors: neighbors.map((n) => ({
              id: n.id,
              title: n.title,
              type: n.type,
            })),
            recentSessions: sessions.map((s) => ({
              id: s.id,
              title: s.title,
              path: s.path,
            })),
          },
          null,
          2
        ),
      },
    ],
  };
}

export const listRecentToolDef = {
  name: "kb_list_recent",
  description:
    "List recently updated notes in the knowledge base. " +
    "Optionally scope to a specific directory (e.g., '06-sessions' for recent sessions).",
  inputSchema: {
    type: "object" as const,
    properties: {
      scope: {
        type: "string",
        description:
          "Directory scope (e.g., '01-wiki', '02-projects', '06-sessions'). Default: all",
      },
      limit: {
        type: "number",
        description: "Max notes to return (default: 10)",
      },
    },
  },
};

export function handleListRecent(args: {
  scope?: string;
  limit?: number;
}): object {
  const results = getRecentNotes(args.scope, args.limit ?? 10);
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            scope: args.scope || "all",
            count: results.length,
            notes: results.map((n) => ({
              id: n.id,
              path: n.path,
              title: n.title,
              type: n.type,
            })),
          },
          null,
          2
        ),
      },
    ],
  };
}
