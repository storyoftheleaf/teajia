#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export function releaseArtifact(root, revision) {
  if (!/^[a-f0-9]{40}$/.test(revision ?? '')) throw new Error('Exact candidate revision required');
  const files = {};
  const add = path => { files[path] = digest(readFileSync(join(root, path.slice(1)))); };
  add('/index.html'); add('/version.json');
  const walk = dir => {
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.(?:js|css)$/.test(entry.name)) add('/' + relative(root, join(root, path)).replaceAll('\\', '/'));
    }
  };
  walk('assets');
  if (!Object.keys(files).some(path => path.endsWith('.js'))) throw new Error('No public JavaScript in exact build');
  if (Object.keys(files).some(path => path.startsWith('/read-assets/'))) throw new Error('Private Read asset entered public artifact');
  const version = JSON.parse(readFileSync(join(root, 'version.json'), 'utf8'));
  if (!version.buildId) throw new Error('Exact build has no build ID');
  return { revision, buildId: version.buildId, files };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [root, revision, output] = process.argv.slice(2);
  if (!root || !output) throw new Error('Usage: node build-release-artifact.mjs DIST REVISION OUTPUT');
  const runId = Number(process.env.GITHUB_RUN_ID), runAttempt = Number(process.env.GITHUB_RUN_ATTEMPT);
  if (!Number.isSafeInteger(runId) || runId < 1 || runAttempt !== 1) throw new Error('Exact CI run and first attempt required');
  if (execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() !== revision) throw new Error('CI checkout differs from candidate');
  const tree = execFileSync('git', ['rev-parse', `${revision}^{tree}`], { encoding: 'utf8' }).trim();
  writeFileSync(output, JSON.stringify({ ...releaseArtifact(root, revision), tree, runId, runAttempt }, null, 2) + '\n', { mode: 0o600 });
}
