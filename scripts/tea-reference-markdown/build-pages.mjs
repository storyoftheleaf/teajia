import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildWisdom,
  renderGeneratedClaims,
  renderGeneratedDraftClaims,
  renderGeneratedRegistry,
} from './lib/page-builder.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PAGES_DIRECTORY = path.join(REPO_ROOT, 'data', 'tea-reference', 'pages');
const TRANSLATIONS_PATH = path.join(REPO_ROOT, 'data', 'tea-reference', 'private', 'translations.json');
const CLAIMS_PATH = path.join(REPO_ROOT, 'data', 'tea-reference', 'claims.json');
const REFERENCE_DIRECTORY = path.join(REPO_ROOT, 'src', 'wisdom', 'reference');

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

const outputs = [
  ['generatedPages.ts', renderGeneratedRegistry(built.registry)],
  ['generatedClaims.ts', renderGeneratedClaims(built.claims)],
  ['generatedDraftClaims.ts', renderGeneratedDraftClaims(built)],
  [path.join(REPO_ROOT, 'worker/src/articleWisdomClaimIndex.json'), JSON.stringify(articleClaims, null, 2) + '\n'],
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
    await fs.writeFile(outputPath, output);
  }
}
