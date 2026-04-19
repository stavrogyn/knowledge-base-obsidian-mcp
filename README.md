# kb-mcp-server

An [MCP](https://modelcontextprotocol.io/) server for an Obsidian-style knowledge base: full-text search, entities and links, and guarded writes to allowed vault folders. Works with Cursor, Claude Desktop, and other MCP clients.

## Requirements

- [Node.js](https://nodejs.org/) **20+** (current LTS recommended)
- A local vault folder (Obsidian or any directory of Markdown notes)

## Quick start

1. Clone the repo and install dependencies:
  ```bash
   git clone <url> kb-mcp-server
   cd kb-mcp-server
   npm ci
  ```
2. Create an environment file from the template and point it at your vault:
  ```bash
   cp .env.template .env
  ```
   Edit `.env` and set `**KB_VAULT_PATH**` to the absolute path of your vault root (you may use `~/...`).
3. Build and verify it runs:
  ```bash
   npm run build
   npm start
  ```
   The server uses **stdio**; it is meant to be launched by an MCP client, not used interactively in a terminal.

## Cursor setup

In your MCP settings (for example `~/.cursor/mcp.json`), add the server with **absolute** paths to `node` and the built `dist/index.js`:

```json
{
  "mcpServers": {
    "user-knowledge-base": {
      "command": "/usr/local/bin/node",
      "args": ["/absolute/path/to/kb-mcp-server/dist/index.js"],
      "env": {
        "KB_VAULT_PATH": "/absolute/path/to/your/ObsidianVault"
      }
    }
  }
}
```

- If variables are set in a `.env` file **in the project root**, they are loaded when the process starts from that directory. For production, you can duplicate `KB_VAULT_PATH` / `KB_DB_PATH` in the `env` block (as above).
- The process working directory should be the repository root if you rely solely on `.env`.

## Environment variables


| Variable        | Required    | Description                                                                    |
| --------------- | ----------- | ------------------------------------------------------------------------------ |
| `KB_VAULT_PATH` | Recommended | Vault root. Default: `~/knowledge-base` (prefer setting explicitly in `.env`). |
| `KB_DB_PATH`    | No          | SQLite index file. Default: `<KB_VAULT_PATH>/.kb-index.db`.                    |


See [.env.template](.env.template) for a template.

### Vault folder layout

Default top-level folders (wiki, sessions, indexes, etc.) are defined in code. You can override them with:

- **`KB_VAULT_DIRS_JSON`** — JSON object with any of the keys: `raw`, `wiki`, `projects`, `people`, `decisions`, `agentMemory`, `sessions`, `indexes`, `templates`, `archive`
- **`KB_DIR_WIKI`**, **`KB_DIR_SESSIONS`**, … — per-folder overrides (see [.env.template](.env.template))

Each logical folder must map to a **distinct** path. Writable areas for the agent are always: wiki, agent memory, sessions, and indexes (derived from your `dirs`).

**Changing the layout on disk:** after you update env vars, run a migration so notes are moved instead of left behind:

```bash
npm run build
# Preview
node dist/cli.js vault-dirs migrate --dry-run --vault-path /path/to/vault
# Apply (uses .kb-vault-layout.json in the vault if present as the “old” layout)
node dist/cli.js vault-dirs migrate --vault-path /path/to/vault
```

- **`vault-dirs write-layout`** — writes `.kb-vault-layout.json` to match the **current** env (no file moves). Use this once you are happy with the on-disk layout, so the next migration knows the previous state.
- **`--from <file>`** — use a saved JSON layout as the old layout.
- **`--from-defaults`** — treat the built-in default folder names as the old layout (ignore `.kb-vault-layout.json`).

After migrating, run **`kb_reindex`** (or restart the MCP server) so SQLite matches the new paths.

## MCP tools

The server registers tools with the `kb_` prefix, including:

- `kb_search`, `kb_context_search` — search and context pack
- `kb_read`, `kb_get_entity`, `kb_list_recent` — reads and entity cards
- `kb_write_session_summary`, `kb_create_memory_candidate` — writes to allowed vault areas
- `kb_compile_raw`, `kb_update_index`, `kb_create_directory`
- `kb_lint`, `kb_reindex` — index maintenance

On startup, the vault is reindexed into SQLite (WAL mode).

## Development

```bash
npm run dev      # tsx src/index.ts
npm run typecheck
npm run build
```

Retrieval evaluation (requires a vault at `KB_VAULT_PATH`):

```bash
npx tsx eval/run-eval.ts
```

## Security and public repos

- **Do not commit** `.env` or any file containing secrets. The repo only ships [.env.template](.env.template) without real paths or keys.
- Do not commit private vault content, API keys, tokens, or passwords.
- `.gitignore` excludes `*.db` / WAL sidecars and `.kb-audit.jsonl` in the vault (see the file in this repo).

Before publishing, run `git status` and confirm nothing sensitive is staged; add machine-local rules to `.gitignore` or use a global gitignore if needed.

## License

MIT (see [package.json](package.json)).