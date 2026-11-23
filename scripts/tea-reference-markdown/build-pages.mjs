import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildWisdom,
  renderGeneratedClaims,
  renderGeneratedDraftClaims,
  renderGeneratedRegistry,
} from './lib/page-builder.mjs';
import { approvedEntries, renderGeneratedEntries } from '../tea-wisdom-compose/lib/entries.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PAGES_DIRECTORY = path.join(REPO_ROOT, 'data', 'tea-reference', 'pages');
const TRANSLATIONS_PATH = path.join(REPO_ROOT, 'data', 'tea-reference', 'private', 'translations.json');
const CLAIMS_PATH = path.join(REPO_ROOT, 'data', 'tea-reference', 'claims.json');
const REFERENCE_DIRECTORY = path.join(REPO_ROOT, 'src', 'wisdom', 'reference');
const ENTRIES_DIRECTORY = path.join(REPO_ROOT, 'data', 'tea-reference', 'entries');

const args = new Set(process.argv.slice(2));
for (const arg of args) {
  if (arg !== '--check') throw new Error(`Unknown argument: ${arg}`);
}

const built = await buildWisdom({
  pagesDirectory: PAGES_DIRECTORY,
  translationsPath: TRANSLATIONS_PATH,
  claimsPath: CLAIMS_PATH,
});
const outputs = [
  ['generatedPages.ts', renderGeneratedRegistry(built.registry)],
  ['generatedClaims.ts', renderGeneratedClaims(built.claims)],
  ['generatedDraftClaims.ts', renderGeneratedDraftClaims(built)],
  ['generatedEntries.ts', renderGeneratedEntries(await approvedEntries(ENTRIES_DIRECTORY, built.claims))],
];

for (const [fileName, output] of outputs) {
  const outputPath = path.join(REFERENCE_DIRECTORY, fileName);
  if (args.has('--check')) {
    let existing = '';
    try {
      existing = await fs.readFile(outputPath, 'utf8');
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
    if (existing !== output) {
      throw new Error(`Generated ${fileName} is stale; run npm run tea-reference:pages`);
    }
  } else {
    await fs.writeFile(outputPath, output);
  }
}
