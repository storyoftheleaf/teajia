#!/usr/bin/env node
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { captureBatch } from './capture.mjs';
import { createCliFetcher } from './fetcher.mjs';
import { writeReviewWorkbook } from './review-workbook.mjs';

const VALUE_FLAGS = new Set(['--allowlist', '--output', '--previous', '--artifact-node-modules']);

export function parseCliArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (!VALUE_FLAGS.has(flag)) throw new Error(`Unknown argument: ${flag}`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`);
    values[flag.slice(2).replaceAll('-', '_')] = value;
    index += 1;
  }
  if (!values.allowlist) throw new Error('--allowlist is required');
  if (!values.output) throw new Error('--output is required');
  return Object.freeze(values);
}

function pathWithin(root, target) {
  return target === root || target.startsWith(`${root}${path.sep}`);
}

function capturePath(cwd, value, label) {
  const base = path.resolve(cwd, 'outputs', 'tea-reference-capture');
  const target = path.resolve(cwd, value);
  if (!pathWithin(base, target) || target === base) throw new Error(`${label} must be a named run beneath outputs/tea-reference-capture`);
  return target;
}

async function loadArtifactTool(nodeModulesPath) {
  if (!nodeModulesPath) throw new Error('The bundled workbook runtime path is required via --artifact-node-modules or TEA_REFERENCE_ARTIFACT_NODE_MODULES');
  const dependencyRoot = path.resolve(nodeModulesPath);
  const stat = await fs.stat(dependencyRoot).catch(() => null);
  if (!stat?.isDirectory()) throw new Error(`Bundled workbook runtime was not found: ${dependencyRoot}`);
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'tea-reference-artifact-runtime-'));
  try {
    await fs.symlink(dependencyRoot, path.join(temp, 'node_modules'), 'dir');
    const requireFromTemp = createRequire(path.join(temp, 'resolver.cjs'));
    return requireFromTemp('@oai/artifact-tool');
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
}

export async function runCli({
  argv,
  cwd = process.cwd(),
  fetcher = null,
  workbookWriter = writeReviewWorkbook,
  artifactTool = null,
} = {}) {
  const options = parseCliArgs(argv ?? []);
  const outputRoot = capturePath(cwd, options.output, 'Output');
  const previousRun = options.previous ? capturePath(cwd, options.previous, 'Previous run') : null;
  const allowlistPath = path.resolve(cwd, options.allowlist);
  const allowlist = JSON.parse(await fs.readFile(allowlistPath, 'utf8'));
  const capture = await captureBatch({ allowlist, outputRoot, fetcher: fetcher || createCliFetcher(), previousRun });
  const toolkit = artifactTool || await loadArtifactTool(options.artifact_node_modules || process.env.TEA_REFERENCE_ARTIFACT_NODE_MODULES);
  await workbookWriter({ capture, outputPath: path.join(outputRoot, 'review.xlsx'), artifactTool: toolkit });
  return capture;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    const result = await runCli({ argv: process.argv.slice(2) });
    process.stdout.write(`${JSON.stringify({ root: result.root, manifest: result.manifest, preview: result.preview }, null, 2)}\n`);
    if (!result.manifest.complete) process.exitCode = 2;
  } catch (error) {
    process.stderr.write(`Tea Reference preview failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
