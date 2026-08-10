import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { canonicalJson, sha256 } from '../tea-reference-capture/canonical.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const IMPORTER_PATH = path.join(REPO_ROOT, 'src', 'wisdom', 'receiving', 'previewImporter.ts');

async function loadImporter() {
  const source = await fs.readFile(IMPORTER_PATH, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
    },
    fileName: IMPORTER_PATH,
  }).outputText;
  const url = `data:text/javascript;base64,${Buffer.from(output).toString('base64')}`;
  return import(url);
}

async function readJson(filePath, label) {
  const resolved = path.resolve(filePath);
  let parsed;
  try {
    parsed = JSON.parse(await fs.readFile(resolved, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read ${label} JSON at ${resolved}: ${error.message}`);
  }
  return parsed;
}

export function verifyHandoffIntegrity(handoff) {
  const payload = {
    entities: handoff?.entities,
    claims: handoff?.claims,
    citations: handoff?.citations,
    heldBack: handoff?.heldBack,
  };
  const actual = sha256(canonicalJson(payload));
  if (actual !== handoff?.manifest?.payloadSha256) {
    throw new Error('Website handoff integrity hash does not match its canonical payload');
  }
}

export async function loadReceivingPreview({ handoffPath, existingPath = '' }) {
  const [{ previewWebsiteHandoff, EMPTY_RECEIVING_STATE }, handoff] = await Promise.all([
    loadImporter(),
    readJson(handoffPath, 'website handoff'),
  ]);
  verifyHandoffIntegrity(handoff);
  const existingDocument = existingPath ? await readJson(existingPath, 'receiving snapshot') : EMPTY_RECEIVING_STATE;
  const existing = existingDocument.projectedState ?? existingDocument;
  return previewWebsiteHandoff(handoff, existing);
}

export { REPO_ROOT };
