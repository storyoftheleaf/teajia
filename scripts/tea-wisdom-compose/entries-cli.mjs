#!/usr/bin/env node
// Approve or return a composed entry.
//   node scripts/tea-wisdom-compose/entries-cli.mjs approve <productId>
//   node scripts/tea-wisdom-compose/entries-cli.mjs unapprove <productId>
// Approval is refused while any claim the entry uses is unapproved or has
// changed since; it then rebuilds src/wisdom/reference/generatedEntries.ts.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildWisdom } from '../tea-reference-markdown/lib/page-builder.mjs';
import { approvalRefusals } from './lib/entries.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const [command, id] = process.argv.slice(2);
if (!['approve', 'unapprove'].includes(command) || !id) { console.error('Usage: entries-cli.mjs approve|unapprove <productId>'); process.exit(2); }
const filePath = path.join(ROOT, 'data', 'tea-reference', 'entries', `${id}.json`);
const file = JSON.parse(await fs.readFile(filePath, 'utf8'));
if (command === 'approve') {
  const { claims } = await buildWisdom({
    pagesDirectory: path.join(ROOT, 'data', 'tea-reference', 'pages'),
    translationsPath: path.join(ROOT, 'data', 'tea-reference', 'private', 'translations.json'),
    claimsPath: path.join(ROOT, 'data', 'tea-reference', 'claims.json'),
  });
  const refusals = approvalRefusals(file, claims);
  if (refusals.length) { console.error(`Not approved: ${file.record.name}\n${refusals.map(line => `  - ${line}`).join('\n')}`); process.exit(1); }
  file.status = 'approved';
  file.approvedAt = new Date().toISOString();
  file.claimUses = file.claimUses.map(use => ({ ...use, rev: claims.find(claim => claim.claimId === use.claimId).rev }));
} else {
  file.status = 'draft';
  delete file.approvedAt;
}
await fs.writeFile(filePath, `${JSON.stringify(file, null, 2)}\n`);
execFileSync('node', [path.join(ROOT, 'scripts', 'tea-reference-markdown', 'build-pages.mjs')], { stdio: 'inherit' });
console.log(`${command === 'approve' ? 'Approved' : 'Returned to draft'}: ${file.record.name}`);
