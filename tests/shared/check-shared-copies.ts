// Shared module "shared-modules-check", owned by mandalacodes (tests/shared/check-shared-copies.ts). Do not edit this copy: change it there, then run modules-sync.
/**
 * Finds shared-module copies that were edited in place.
 *
 * A shared module has one owner project; every other project holds a copy
 * written by `modules-sync`, which records each copy's fingerprint in
 * shared-modules.lock.json at the project root. A copy that no longer matches
 * its fingerprint was edited here instead of in its owner, and the next sync
 * would silently undo that edit. Change the owner, then run modules-sync.
 *
 * A project with no lock file holds no copies, so it has nothing to check.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const LOCK_FILE = 'shared-modules.lock.json';

interface SharedModulesLock {
  modules: Record<string, { owner: string; version: string; files: Record<string, string> }>;
}

export function findEditedCopies(projectRoot: string): string[] {
  const lockPath = join(projectRoot, LOCK_FILE);
  if (!existsSync(lockPath)) return [];
  const lock = JSON.parse(readFileSync(lockPath, 'utf8')) as SharedModulesLock;
  const edited: string[] = [];
  for (const [name, mod] of Object.entries(lock.modules)) {
    for (const [file, fingerprint] of Object.entries(mod.files)) {
      const full = join(projectRoot, file);
      const actual = existsSync(full) ? createHash('sha256').update(readFileSync(full)).digest('hex') : 'missing';
      if (actual !== fingerprint) edited.push(`${file} (from ${mod.owner}, module ${name})`);
    }
  }
  return edited;
}
