#!/usr/bin/env node
/** Compare every worker project diagnostic with its relocation-stable baseline. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectDiagnostics, diagnosticSignature, diffDiagnostics } from './worker-typecheck-signatures.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIST_PATH = path.join(ROOT, 'scripts/known-worker-ts-errors.txt');

try {
  const known = readFileSync(LIST_PATH, 'utf8').split('\n')
    .map(line => line.trim()).filter(line => line && !line.startsWith('#'));
  for (const line of known) {
    const signature = JSON.parse(line);
    if (!Array.isArray(signature) || signature.length !== 4 ||
      signature.some(value => typeof value !== 'string') ||
      !/^TS\d+$/.test(signature[1]) || !/^[a-f0-9]{64}$/.test(signature[2]) ||
      JSON.stringify(signature) !== line) {
      throw new Error(`Invalid baseline signature: ${line}`);
    }
  }
  const diagnostics = collectDiagnostics(ROOT);
  const actual = diagnostics.map(diagnostic => diagnosticSignature(diagnostic, ROOT));
  const drift = diffDiagnostics(known, actual);
  if (drift.length) {
    console.error('worker typecheck ratchet: unexpected or missing diagnostics:\n' + drift.join('\n'));
    process.exitCode = 1;
  } else {
    console.log(actual.length ? `worker typecheck ratchet: ${actual.length} known errors, no drift` : 'worker typecheck: clean');
  }
} catch (error) {
  console.error('worker typecheck ratchet failed:', error.message);
  process.exitCode = 1;
}
