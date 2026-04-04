import { mkdirSync, existsSync } from "fs";
import { resolve, normalize, sep } from "path";
import { config } from "../config.js";
import { writeNote, type WriteResult } from "../vault/writer.js";

export const createDirectoryToolDef = {
  name: "kb_create_directory",
  description:
    "Create a new topic directory in the knowledge base. " +
    "Creates the directory and an _index.md hub note with frontmatter. " +
    "Use this when a new topic or subtopic emerges that deserves its own section.",
  inputSchema: {
    type: "object" as const,
    properties: {
      path: {
        type: "string",
        description:
          "Relative path for the directory (e.g., '01-wiki/tech/devops' or '01-wiki/finance')",
      },
      title: {
        type: "string",
        description: "Human-readable title for the directory hub note",
      },
      aliases: {
        type: "array",
        items: { type: "string" },
        description: "Alternative names for entity resolution",
      },
      tags: {
        type: "array",
        items: { type: "string" },
        description: "Tags for the hub note",
      },
      parent_topic_id: {
        type: "string",
        description:
          "Entity ID of the parent topic (e.g., 'topic-tech' for a tech subtopic)",
      },
      description: {
        type: "string",
        description: "Short description of what this directory is about",
      },
    },
    required: ["path", "title"],
  },
};

export function handleCreateDirectory(args: {
  path: string;
  title: string;
  aliases?: string[];
  tags?: string[];
  parent_topic_id?: string;
  description?: string;
}): object {
  const normalized = normalize(args.path).split(sep).join("/");

  if (!config.writableDirs.some((dir) => normalized.startsWith(dir + "/") || normalized === dir)) {
    return {
      content: [
        {
          type: "text",
          text: `Error: directory '${normalized}' is not under a writable path. Allowed: ${config.writableDirs.join(", ")}`,
        },
      ],
      isError: true,
    };
  }

  const fullPath = resolve(config.vaultPath, normalized);
  const vaultRoot = resolve(config.vaultPath);
  if (!fullPath.startsWith(vaultRoot + sep)) {
    return {
      content: [{ type: "text", text: `Error: path escapes vault` }],
      isError: true,
    };
  }

  if (!existsSync(fullPath)) {
    mkdirSync(fullPath, { recursive: true });
  }

  const slug = normalized
    .replace(/^01-wiki\//, "")
    .replace(/\//g, "-");
  const topicId = `topic-${slug}`;
  const dateStr = new Date().toISOString().slice(0, 10);

  const entities = [topicId];
  if (args.parent_topic_id) {
    entities.push(args.parent_topic_id);
  }

  const frontmatter: Record<string, unknown> = {
    id: topicId,
    type: "wiki-article",
    title: args.title,
    aliases: args.aliases || [],
    tags: ["topic-hub", ...(args.tags || [])],
    entities,
    status: "active",
    visibility: "agent-readable",
    source_type: "agent",
    review_status: "draft",
    created_at: dateStr,
    updated_at: dateStr,
    confidence: "high",
  };

  const desc = args.description || `Хаб-заметка для раздела «${args.title}».`;
  const body = `# ${args.title}\n\n${desc}\n\n## Содержание\n\n_Пока пусто._\n`;

  const indexPath = `${normalized}/_index.md`;
  const result: WriteResult = writeNote(indexPath, frontmatter, body, "kb_create_directory");

  if (!result.success) {
    return {
      content: [{ type: "text", text: `Error creating index: ${result.error}` }],
      isError: true,
    };
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            message: `Directory created: ${normalized}/`,
            index_note: result.path,
            topic_id: topicId,
          },
          null,
          2
        ),
      },
    ],
  };
}
