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
  if (!path.isAbsolute(handoffPath)) {
    throw new Error('Tea Reference handoff path must be absolute');
  }
  const resolved = handoffPath;
  let stats;
  try {
    [, stats] = await Promise.all([
      fs.access(resolved, constants.R_OK),
      fs.stat(resolved),
    ]);
  } catch {
    throw new Error(`Cannot read Tea Reference handoff: ${resolved}`);
  }
  if (!stats.isFile()) throw new Error(`Tea Reference handoff must be a regular file: ${resolved}`);
  return resolved;
}

export async function startTeajiaPreview({
  argv,
  parentEnv = process.env,
  spawnProcess = spawn,
  signalTarget = process,
  viteBin = VITE_BIN,
  viteArgs = ['--mode', 'tea-reference-preview'],
}) {
  const options = parseTeajiaPreviewArgs(argv);
  const handoffPath = await readableHandoff(options.handoffPath);
  const child = spawnProcess(viteBin, viteArgs, {
    cwd: REPO_ROOT,
    env: { ...parentEnv, TEA_REFERENCE_HANDOFF_PATH: handoffPath },
    stdio: 'inherit',
  });

  const forwardSignal = signal => {
    if (child.exitCode == null && child.signalCode == null) child.kill(signal);
  };
  const onSigint = () => forwardSignal('SIGINT');
  const onSigterm = () => forwardSignal('SIGTERM');
  signalTarget.on('SIGINT', onSigint);
  signalTarget.on('SIGTERM', onSigterm);

  try {
    return await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', code => resolve(code ?? 1));
    });
  } finally {
    signalTarget.off('SIGINT', onSigint);
    signalTarget.off('SIGTERM', onSigterm);
  }
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
