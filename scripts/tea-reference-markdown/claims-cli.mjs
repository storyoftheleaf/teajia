// Claim ledger commands. Each run edits data/tea-reference/claims.json; commit the result for review.
//   node scripts/tea-reference-markdown/claims-cli.mjs approve <claimId> --reason "<why>" [--scope "<scope>"] [--evidence EVIDENCE-…,…]
//   node scripts/tea-reference-markdown/claims-cli.mjs withdraw <claimId> --reason "<why>"
//   node scripts/tea-reference-markdown/claims-cli.mjs import-legacy <claimId> --from marks:<id> --scope "<scope>"
// Contract: docs/_notes/tea-wisdom-claims.md
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { applyClaimCommand, parseMarksCsv } from './lib/claim-commands.mjs';
import { loadSourcePages } from './lib/page-builder.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CLAIMS_PATH = path.join(REPO_ROOT, 'data', 'tea-reference', 'claims.json');

const [command, claimId, ...rest] = process.argv.slice(2);
const options = {};
for (let index = 0; index < rest.length; index += 2) {
  const flag = rest[index];
  if (!flag?.startsWith('--') || rest[index + 1] === undefined) throw new Error(`Expected --flag value pairs, got ${flag}`);
  options[flag.slice(2)] = rest[index + 1];
}

const { sourcePages, document } = await loadSourcePages({
  pagesDirectory: path.join(REPO_ROOT, 'data', 'tea-reference', 'pages'),
  translationsPath: path.join(REPO_ROOT, 'data', 'tea-reference', 'private', 'translations.json'),
});
const legacyMarks = command === 'import-legacy'
  ? parseMarksCsv(await fs.readFile(path.join(REPO_ROOT, 'data', 'tea-wisdom-source', 'marks.csv'), 'utf8'))
  : undefined;
const ledger = JSON.parse(await fs.readFile(CLAIMS_PATH, 'utf8'));
const today = new Date().toISOString().slice(0, 10);
const next = applyClaimCommand({ ledger, sourcePages, provenance: document, command, claimId, options, today, legacyMarks });
await fs.writeFile(CLAIMS_PATH, `${JSON.stringify(next, null, 2)}\n`);
console.log(`${command} ${claimId}: done. Run npm run tea-reference:pages, then commit claims.json with the regenerated files.`);
