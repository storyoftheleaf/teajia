import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildRegistry, renderGeneratedRegistry } from './lib/page-builder.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PAGES_DIRECTORY = path.join(REPO_ROOT, 'data', 'tea-reference', 'pages');
const TRANSLATIONS_PATH = path.join(REPO_ROOT, 'data', 'tea-reference', 'private', 'translations.json');
const OUTPUT_PATH = path.join(REPO_ROOT, 'src', 'wisdom', 'reference', 'generatedPages.ts');

const args = new Set(process.argv.slice(2));
for (const arg of args) {
  if (arg !== '--check') throw new Error(`Unknown argument: ${arg}`);
}

const registry = await buildRegistry({
  pagesDirectory: PAGES_DIRECTORY,
  translationsPath: TRANSLATIONS_PATH,
});
const output = renderGeneratedRegistry(registry);

if (args.has('--check')) {
  let existing = '';
  try {
    existing = await fs.readFile(OUTPUT_PATH, 'utf8');
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  if (existing !== output) {
    throw new Error('Generated Tea Reference registry is stale; run npm run tea-reference:pages');
  }
} else {
  await fs.writeFile(OUTPUT_PATH, output);
}
