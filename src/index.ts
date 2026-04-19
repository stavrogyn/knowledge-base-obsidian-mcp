import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { reindexVault } from "./index/indexer.js";
import { closeDb } from "./index/sqlite.js";
import { readNoteRaw } from "./vault/reader.js";
import { config } from "./config.js";

import { searchToolDef, handleSearch, contextSearchToolDef, handleContextSearch } from "./tools/search.js";
import { readToolDef, handleRead } from "./tools/read.js";
import { getEntityToolDef, handleGetEntity, listRecentToolDef, handleListRecent } from "./tools/entity.js";
import {
  writeSessionSummaryToolDef,
  handleWriteSessionSummary,
  createMemoryCandidateToolDef,
  handleCreateMemoryCandidate,
} from "./tools/write.js";
import {
  compileRawToolDef,
  handleCompileRaw,
  updateIndexToolDef,
  handleUpdateIndex,
} from "./tools/compile.js";
import { lintToolDef, handleLint, reindexToolDef, handleReindex } from "./tools/lint.js";
import { createDirectoryToolDef, handleCreateDirectory } from "./tools/directory.js";

const server = new Server(
  {
    name: "kb-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// --- Tools ---

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    searchToolDef,
    contextSearchToolDef,
    readToolDef,
    getEntityToolDef,
    listRecentToolDef,
    writeSessionSummaryToolDef,
    createMemoryCandidateToolDef,
    compileRawToolDef,
    updateIndexToolDef,
    lintToolDef,
    reindexToolDef,
    createDirectoryToolDef,
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "kb_search":
      return handleSearch(args as Parameters<typeof handleSearch>[0]);
    case "kb_context_search":
      return handleContextSearch(args as Parameters<typeof handleContextSearch>[0]);
    case "kb_read":
      return handleRead(args as Parameters<typeof handleRead>[0]);
    case "kb_get_entity":
      return handleGetEntity(args as Parameters<typeof handleGetEntity>[0]);
    case "kb_list_recent":
      return handleListRecent(args as Parameters<typeof handleListRecent>[0]);
    case "kb_write_session_summary":
      return handleWriteSessionSummary(args as Parameters<typeof handleWriteSessionSummary>[0]);
    case "kb_create_memory_candidate":
      return handleCreateMemoryCandidate(args as Parameters<typeof handleCreateMemoryCandidate>[0]);
    case "kb_compile_raw":
      return handleCompileRaw(args as Parameters<typeof handleCompileRaw>[0]);
    case "kb_update_index":
      return handleUpdateIndex(args as Parameters<typeof handleUpdateIndex>[0]);
    case "kb_lint":
      return handleLint();
    case "kb_reindex":
      return handleReindex();
    case "kb_create_directory":
      return handleCreateDirectory(args as Parameters<typeof handleCreateDirectory>[0]);
    default:
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
});

// --- Resources ---

const RESOURCE_INDEX_FILES = {
  "kb://indexes/master": "master-index.md",
  "kb://policy/agent": "agent-policy.md",
  "kb://schema/vault": "vault-schema.md",
  "kb://indexes/concepts": "concepts.md",
  "kb://indexes/projects": "projects.md",
  "kb://indexes/recent-changes": "recent-changes.md",
} as const;

function resourceVaultPath(uri: keyof typeof RESOURCE_INDEX_FILES): string {
  return `${config.dirs.indexes}/${RESOURCE_INDEX_FILES[uri]}`;
}

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: "kb://indexes/master",
      name: "Master Index",
      description: "Central index of all knowledge base articles",
      mimeType: "text/markdown",
    },
    {
      uri: "kb://policy/agent",
      name: "Agent Policy",
      description: "Access control and write rules for the agent",
      mimeType: "text/markdown",
    },
    {
      uri: "kb://schema/vault",
      name: "Vault Schema",
      description: "Directory structure, note types, and frontmatter schema",
      mimeType: "text/markdown",
    },
    {
      uri: "kb://indexes/concepts",
      name: "Concepts Index",
      description: "Index of all concepts in the knowledge base",
      mimeType: "text/markdown",
    },
    {
      uri: "kb://indexes/projects",
      name: "Projects Index",
      description: "Overview of all projects",
      mimeType: "text/markdown",
    },
    {
      uri: "kb://indexes/recent-changes",
      name: "Recent Changes",
      description: "Changelog of recent knowledge base updates",
      mimeType: "text/markdown",
    },
  ],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri as keyof typeof RESOURCE_INDEX_FILES;
  const file = RESOURCE_INDEX_FILES[uri];

  if (!file) {
    throw new Error(`Unknown resource: ${uri}`);
  }

  const path = resourceVaultPath(uri);
  const content = readNoteRaw(path);
  if (!content) {
    throw new Error(`Resource not found: ${uri}`);
  }

  return {
    contents: [
      {
        uri: request.params.uri,
        mimeType: "text/markdown",
        text: content,
      },
    ],
  };
});

// --- Startup ---

async function main() {
  console.error("KB MCP Server starting...");

  // Index vault on startup
  const stats = reindexVault();
  console.error(
    `Indexed vault: ${stats.total} notes (${stats.added} added, ${stats.updated} updated, ${stats.unchanged} unchanged, ${stats.removed} removed, ${stats.errors} errors)`
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("KB MCP Server connected via stdio");
}

process.on("SIGINT", () => {
  closeDb();
  process.exit(0);
});

process.on("SIGTERM", () => {
  closeDb();
  process.exit(0);
});

main().catch((err) => {
  console.error("Fatal error:", err);
  closeDb();
  process.exit(1);
});
