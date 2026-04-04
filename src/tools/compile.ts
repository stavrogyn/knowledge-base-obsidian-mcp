import { compileRawToWiki } from "../memory/compiler.js";
import { appendToNote } from "../vault/writer.js";

export const compileRawToolDef = {
  name: "kb_compile_raw",
  description:
    "Compile a raw source document into a wiki article. " +
    "Takes a raw source path and compiled summary/analysis, creates a structured " +
    "wiki article in 01-wiki/. Use this to grow the wiki from ingested sources.",
  inputSchema: {
    type: "object" as const,
    properties: {
      raw_path: {
        type: "string",
        description: "Path to the raw source document (in 00-raw/)",
      },
      title: {
        type: "string",
        description: "Title for the wiki article",
      },
      summary: {
        type: "string",
        description: "Compiled summary/analysis of the source",
      },
      concepts: {
        type: "array",
        items: { type: "string" },
        description: "Key concepts extracted from the source",
      },
      entities: {
        type: "array",
        items: { type: "string" },
        description: "Entity IDs related to this article",
      },
      related_articles: {
        type: "array",
        items: { type: "string" },
        description: "Titles of related existing wiki articles (will be linked)",
      },
      tags: {
        type: "array",
        items: { type: "string" },
        description: "Tags for categorization",
      },
      directory: {
        type: "string",
        description:
          "Target subdirectory within 01-wiki/ (e.g., 'books-and-resources' or 'tech/ai'). " +
          "If omitted, the article is created directly in 01-wiki/.",
      },
    },
    required: ["raw_path", "title", "summary", "concepts", "entities", "related_articles"],
  },
};

export function handleCompileRaw(args: {
  raw_path: string;
  title: string;
  summary: string;
  concepts: string[];
  entities: string[];
  related_articles: string[];
  tags?: string[];
  directory?: string;
}): object {
  const result = compileRawToWiki({
    rawPath: args.raw_path,
    title: args.title,
    summary: args.summary,
    concepts: args.concepts,
    entities: args.entities,
    relatedArticles: args.related_articles,
    tags: args.tags,
    directory: args.directory,
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
        text: `Wiki article compiled at ${result.path}`,
      },
    ],
  };
}

export const updateIndexToolDef = {
  name: "kb_update_index",
  description:
    "Update an index file in 07-indexes/. Use this to maintain master-index.md, " +
    "concepts.md, projects.md, and other index files as the knowledge base grows.",
  inputSchema: {
    type: "object" as const,
    properties: {
      index_path: {
        type: "string",
        description: "Relative path to the index file (e.g., '07-indexes/master-index.md')",
      },
      section: {
        type: "string",
        description: "Content to append to the index file",
      },
    },
    required: ["index_path", "section"],
  },
};

export function handleUpdateIndex(args: {
  index_path: string;
  section: string;
}): object {
  const result = appendToNote(args.index_path, args.section, "kb_update_index");

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
        text: `Index updated: ${result.path}`,
      },
    ],
  };
}
