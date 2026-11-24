import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildWisdom,
  DRAFT_PARTS_DIRECTORY,
  PUBLIC_PARTS_DIRECTORY,
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
// The article API serves public claim IDs to readers. Only an article's authorized
// editors can read the retained wording of a revision used in that article.
const publicPages = new Set(built.registry.pages.map(page => page.id));
const publicClaims = new Set(built.claims.map(claim => claim.claimId));
const articleClaims = built.draftClaims
  .filter(claim => publicPages.has(claim.pageId) && claim.previousRevisions?.length)
  .map(claim => ({
    id: claim.claimId,
    public: publicClaims.has(claim.claimId),
    withdrawn: claim.reviewState === 'withdrawn',
    revisions: claim.previousRevisions.map(({ rev, text }) => ({ rev, text })),
  }));

const entries = await approvedEntries(ENTRIES_DIRECTORY, built.claims);
const wordingPackets = JSON.parse(await fs.readFile(path.join(REPO_ROOT, 'worker/src/wisdomWordingReview.json'), 'utf8'));
const reviewedWording = Object.fromEntries(wordingPackets.flatMap(({ id }) => {
  const entry = entries[id];
  if (!entry) return [];
  const text = entry.paragraphs.map(paragraph => paragraph.text.replace(/\[([^\]]+)\]\([a-z0-9-]+:[a-z0-9-]+\)/g, '$1')).join('\n\n');
  return [[id, text]];
}));

const outputs = [
  ['generatedPages.ts', renderGeneratedRegistry(built.registry)],
  ...renderGeneratedClaims(built.claims),
  ...renderGeneratedDraftClaims(built),
  [path.join(REPO_ROOT, 'worker/src/articleWisdomClaimIndex.json'), JSON.stringify(articleClaims, null, 2) + '\n'],
  ['generatedEntries.ts', renderGeneratedEntries(entries)],
  [path.join(REPO_ROOT, 'worker/src/wisdomWordingEntries.json'), JSON.stringify(reviewedWording, null, 2) + '\n'],
];

for (const [fileName, output] of outputs) {
  const outputPath = path.resolve(REFERENCE_DIRECTORY, fileName);
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
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, output);
  }
}

// Each parts directory holds only what this run wrote; a leftover part is stale.
const written = new Set(outputs.map(([fileName]) => path.resolve(REFERENCE_DIRECTORY, fileName)));
for (const directory of [DRAFT_PARTS_DIRECTORY, PUBLIC_PARTS_DIRECTORY]) {
  const partsDirectory = path.join(REFERENCE_DIRECTORY, directory);
  let present = [];
  try {
    present = await fs.readdir(partsDirectory);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  for (const name of present) {
    const partPath = path.join(partsDirectory, name);
    if (written.has(partPath)) continue;
    if (args.has('--check')) {
      throw new Error(`Generated ${directory}/${name} is stale; run npm run tea-reference:pages`);
    }
    await fs.rm(partPath);
  }
}
