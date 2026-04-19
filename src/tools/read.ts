import { readNote, readNoteRaw } from "../vault/reader.js";
import { auditLog } from "../vault/audit.js";
import { config } from "../config.js";

export const readToolDef = {
  name: "kb_read",
  description:
    "Read a note from the knowledge base by path or title. " +
    "Returns the full note content including frontmatter metadata. " +
    `Paths are relative to the vault root (e.g., '${config.dirs.wiki}/Model Context Protocol.md').`,
  inputSchema: {
    type: "object" as const,
    properties: {
      path: {
        type: "string",
        description:
          "Note path relative to vault root, or note title (e.g., 'Model Context Protocol')",
      },
      raw: {
        type: "boolean",
        description: "If true, return raw markdown without parsing. Default: false",
      },
    },
    required: ["path"],
  },
};

export function handleRead(args: { path: string; raw?: boolean }): object {
  auditLog({
    timestamp: new Date().toISOString(),
    tool: "kb_read",
    sessionId: "current",
    action: "read",
    path: args.path,
  });

  if (args.raw) {
    const content = readNoteRaw(args.path);
    if (!content) {
      return {
        content: [{ type: "text", text: `Note not found: ${args.path}` }],
        isError: true,
      };
    }
    return { content: [{ type: "text", text: content }] };
  }

  const parsed = readNote(args.path);
  if (!parsed) {
    return {
      content: [{ type: "text", text: `Note not found: ${args.path}` }],
      isError: true,
    };
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            path: args.path,
            frontmatter: parsed.frontmatter,
            content: parsed.content,
            wikilinks: parsed.wikilinks,
            headings: parsed.headings,
          },
          null,
          2
        ),
      },
    ],
  };
}
