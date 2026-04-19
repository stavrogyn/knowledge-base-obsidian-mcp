import {
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { join, basename as basenamePath } from "path";
import { parseVaultLayoutFile } from "./vault-layout.js";
import type { VaultDirs } from "./vault-layout.js";
import { VAULT_DIR_KEYS, assertUniqueDirValues, serializeVaultLayoutFile, LAYOUT_FILE_NAME } from "./vault-layout.js";

const STAGING_DIR = ".kb-layout-migrate-staging";

export interface MigrateResult {
  moved: { key: string; from: string; to: string }[];
  merged: { key: string; into: string }[];
  skipped: { key: string; reason: string }[];
  layoutFileWritten: string | null;
}

function mergeTreeInto(src: string, dest: string, conflicts: string[]): void {
  if (!existsSync(src)) return;
  mkdirSync(dest, { recursive: true });
  for (const name of readdirSync(src)) {
    const fromPath = join(src, name);
    const toPath = join(dest, name);
    const isDir = statSync(fromPath).isDirectory();
    if (isDir) {
      if (existsSync(toPath)) {
        if (statSync(toPath).isDirectory()) {
          mergeTreeInto(fromPath, toPath, conflicts);
          rmSync(fromPath, { recursive: true });
        } else {
          conflicts.push(`cannot merge directory into file: ${toPath}`);
        }
      } else {
        renameSync(fromPath, toPath);
      }
    } else if (existsSync(toPath)) {
      const fallback = join(dest, `${name}.migrated.${Date.now()}`);
      renameSync(fromPath, fallback);
      conflicts.push(`file name clash at ${name} — incoming kept as ${basenamePath(fallback)}`);
    } else {
      renameSync(fromPath, toPath);
    }
  }
}

/**
 * Move on-disk vault folders from `oldDirs` layout to `newDirs` using a staging directory
 * so renames (including swaps) do not overwrite each other.
 */
export function migrateVaultLayout(
  vaultRoot: string,
  oldDirs: VaultDirs,
  newDirs: VaultDirs,
  options?: { dryRun?: boolean }
): MigrateResult {
  assertUniqueDirValues(oldDirs);
  assertUniqueDirValues(newDirs);

  const dryRun = options?.dryRun ?? false;
  const result: MigrateResult = {
    moved: [],
    merged: [],
    skipped: [],
    layoutFileWritten: null,
  };

  const staging = join(vaultRoot, STAGING_DIR);

  const needsWork = VAULT_DIR_KEYS.filter((k) => oldDirs[k] !== newDirs[k]);
  if (needsWork.length === 0) {
    result.skipped.push({ key: "_all", reason: "old and new layouts are identical" });
    return result;
  }

  // Phase 1: old paths -> staging (only if source exists and differs from target)
  const staged = new Map<string, string>(); // key -> stage path

  for (const key of VAULT_DIR_KEYS) {
    const fromRel = oldDirs[key];
    const toRel = newDirs[key];
    if (fromRel === toRel) continue;

    const fromAbs = join(vaultRoot, fromRel);
    if (!existsSync(fromAbs)) {
      result.skipped.push({ key, reason: `source missing: ${fromRel}` });
      continue;
    }

    const stageAbs = join(staging, key);
    if (dryRun) {
      result.moved.push({ key, from: fromRel, to: `${STAGING_DIR}/${key} (dry-run)` });
    } else {
      mkdirSync(staging, { recursive: true });
      if (existsSync(stageAbs)) {
        rmSync(stageAbs, { recursive: true });
      }
      renameSync(fromAbs, stageAbs);
      staged.set(key, stageAbs);
      result.moved.push({ key, from: fromRel, to: `${STAGING_DIR}/${key}` });
    }
  }

  if (dryRun) {
    return result;
  }

  // Phase 2: staging -> final paths (merge if destination exists)
  for (const key of VAULT_DIR_KEYS) {
    const stageAbs = join(staging, key);
    if (!staged.has(key)) continue;

    const toRel = newDirs[key];
    const toAbs = join(vaultRoot, toRel);

    if (!existsSync(toAbs)) {
      renameSync(stageAbs, toAbs);
      result.moved.push({ key, from: `${STAGING_DIR}/${key}`, to: toRel });
    } else {
      const conflicts: string[] = [];
      mergeTreeInto(stageAbs, toAbs, conflicts);
      rmSync(stageAbs, { recursive: true });
      result.merged.push({ key, into: toRel });
      for (const c of conflicts) {
        result.skipped.push({ key, reason: c });
      }
    }
  }

  if (existsSync(staging)) {
    try {
      const left = readdirSync(staging);
      if (left.length === 0) {
        rmSync(staging, { recursive: true });
      }
    } catch {
      /* ignore */
    }
  }

  const layoutPath = join(vaultRoot, LAYOUT_FILE_NAME);
  writeFileSync(layoutPath, serializeVaultLayoutFile(newDirs), "utf-8");
  result.layoutFileWritten = layoutPath;

  return result;
}

export function readLayoutFileFromVault(vaultRoot: string): VaultDirs | null {
  const p = join(vaultRoot, LAYOUT_FILE_NAME);
  if (!existsSync(p)) return null;
  return parseVaultLayoutFile(readFileSync(p, "utf-8")).dirs;
}
