/**
 * CLI: vault layout print / migrate / write-layout snapshot.
 * Usage: node dist/cli.js <command> [options]
 */
import { config as loadDotenv } from "dotenv";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { readFileSync, writeFileSync } from "fs";
import {
  DEFAULT_VAULT_DIRS,
  parseVaultLayoutFile,
  serializeVaultLayoutFile,
  LAYOUT_FILE_NAME,
  type VaultDirs,
} from "./vault-layout.js";
import { migrateVaultLayout, readLayoutFileFromVault } from "./migrate-vault-layout.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(__dirname, "../.env"), quiet: true });

function applyCliEnvOverrides(argv: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--vault-path" && argv[i + 1]) {
      process.env.KB_VAULT_PATH = argv[i + 1];
      i++;
      continue;
    }
    out.push(argv[i]);
  }
  return out;
}

const argv = applyCliEnvOverrides(process.argv.slice(2));

const { config } = await import("./config.js");

function printHelp(): void {
  console.log(`kb-mcp-server — vault layout tools

Commands:
  vault-dirs print              Print effective directory mapping (env + defaults)
  vault-dirs migrate            Move on-disk folders from saved/old layout to current env
  vault-dirs write-layout       Write ${LAYOUT_FILE_NAME} to match current env (no moves)

Options (all commands):
  --vault-path <dir>            Override KB_VAULT_PATH for this invocation

migrate options:
  --dry-run                     Show planned moves only
  --from <file>                 JSON layout file for the "old" layout (overrides vault/${LAYOUT_FILE_NAME})
  --from-defaults               Use built-in default folder names as the old layout (ignore layout file)

After migrate, start the MCP server or call kb_reindex so SQLite matches moved files.
`);
}

function cmdPrint(): void {
  console.log(
    JSON.stringify(
      {
        vaultPath: config.vaultPath,
        dirs: config.dirs,
        writableDirs: config.writableDirs,
      },
      null,
      2
    )
  );
}

function cmdWriteLayout(): void {
  const path = join(config.vaultPath, LAYOUT_FILE_NAME);
  writeFileSync(path, serializeVaultLayoutFile(config.dirs), "utf-8");
  console.log(`Wrote ${path}`);
}

function parseMigrateArgs(args: string[]): {
  dryRun: boolean;
  fromFile?: string;
  fromDefaults: boolean;
} {
  let dryRun = false;
  let fromFile: string | undefined;
  let fromDefaults = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dry-run") {
      dryRun = true;
    } else if (args[i] === "--from-defaults") {
      fromDefaults = true;
    } else if (args[i] === "--from" && args[i + 1]) {
      fromFile = args[i + 1];
      i++;
    }
  }
  return { dryRun, fromFile, fromDefaults };
}

function cmdMigrate(args: string[]): void {
  const { dryRun, fromFile, fromDefaults } = parseMigrateArgs(args);

  let oldDirs: VaultDirs;
  if (fromDefaults) {
    oldDirs = DEFAULT_VAULT_DIRS;
  } else if (fromFile) {
    oldDirs = parseVaultLayoutFile(readFileSync(fromFile, "utf-8")).dirs;
  } else {
    const fromVault = readLayoutFileFromVault(config.vaultPath);
    if (fromVault) {
      oldDirs = fromVault;
    } else {
      oldDirs = DEFAULT_VAULT_DIRS;
      console.error(
        `No ${LAYOUT_FILE_NAME} in vault — assuming previous on-disk layout matches built-in defaults. ` +
          `Use --from <file> or run vault-dirs write-layout after a known-good state.`
      );
    }
  }

  const newDirs = config.dirs;
  console.error(`Migrating vault at ${config.vaultPath}`);
  console.error(`Dry run: ${dryRun}`);

  const result = migrateVaultLayout(config.vaultPath, oldDirs, newDirs, { dryRun });

  console.log(JSON.stringify(result, null, 2));

  if (!dryRun && result.layoutFileWritten) {
    console.error(`\nNext: rebuild the search index (start the MCP server or use kb_reindex).`);
  }
}

const [cmd, sub, ...rest] = argv;

if (argv.length === 0 || argv[0] === "-h" || argv[0] === "--help") {
  printHelp();
  process.exit(0);
}

if (cmd === "vault-dirs" && sub === "print") {
  cmdPrint();
} else if (cmd === "vault-dirs" && sub === "write-layout") {
  cmdWriteLayout();
} else if (cmd === "vault-dirs" && sub === "migrate") {
  cmdMigrate(rest);
} else {
  console.error("Unknown command. Try: vault-dirs print | vault-dirs migrate | vault-dirs write-layout");
  printHelp();
  process.exit(1);
}
