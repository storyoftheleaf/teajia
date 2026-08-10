#!/usr/bin/env node
import { constants } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseTeajiaPreviewArgs } from './args.mjs';
import { REPO_ROOT } from './load-preview.mjs';

export const VITE_BIN = path.join(REPO_ROOT, 'node_modules', '.bin', 'vite');

async function readableHandoff(handoffPath) {
  const resolved = path.resolve(handoffPath);
  try {
    await fs.access(resolved, constants.R_OK);
  } catch {
    throw new Error(`Cannot read Tea Reference handoff: ${resolved}`);
  }
  return resolved;
}

export async function startTeajiaPreview({
  argv,
  parentEnv = process.env,
  spawnProcess = spawn,
}) {
  const options = parseTeajiaPreviewArgs(argv);
  const handoffPath = await readableHandoff(options.handoffPath);
  const child = spawnProcess(VITE_BIN, ['--mode', 'tea-reference-preview'], {
    cwd: REPO_ROOT,
    env: { ...parentEnv, TEA_REFERENCE_HANDOFF_PATH: handoffPath },
    stdio: 'inherit',
  });

  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', code => resolve(code ?? 1));
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    process.exitCode = await startTeajiaPreview({ argv: process.argv.slice(2) });
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
