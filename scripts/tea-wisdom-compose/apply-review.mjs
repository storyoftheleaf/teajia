#!/usr/bin/env node
// Carry Adrian's choices from the Wisdom review page into the repo
// (docs/agents/TEA-WISDOM-AGENTS.md, steps 3 and 6).
//
//   node scripts/tea-wisdom-compose/apply-review.mjs --decisions <dir> [--dry-run]
//
// <dir> holds one JSON file per decision, as the ArtifactData tool saves them
// with `out_dir` (list collection runs/<run>/decisions). For each approved
// section it runs the claim ledger's own approve; a draft page whose every
// section is now approved becomes visibility: public; then it rebuilds the
// pages and approves each approved entry through entries-cli (which refuses
// an entry whose claims are not approved yet). Send-backs are written, with
// Adrian's note, to .tea-wisdom-review/sent-back.json for the agent to route.
// It writes nothing to the shop.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mayPublish, publishedMarkdown } from './lib/review.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => (
  value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]?.startsWith('--') ? 'true' : all[index + 1] ?? 'true']] : pairs
), []));
if (!args.decisions) { console.error('Pass --decisions <dir> (the saved decision documents).'); process.exit(2); }
const dry = args['dry-run'] === 'true';

async function jsonFiles(directory) {
  const out = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) out.push(...await jsonFiles(full));
    else if (entry.name.endsWith('.json')) out.push(full);
  }
  return out;
}

const decisions = [];
for (const file of await jsonFiles(path.resolve(args.decisions))) {
  const raw = JSON.parse(await fs.readFile(file, 'utf8'));
  const doc = raw.data && typeof raw.data === 'object' ? raw.data : raw;
  if (typeof doc.item === 'string' && ['approve', 'send_back'].includes(doc.choice)) decisions.push(doc);
}
const claims = decisions.filter(d => d.kind === 'claim' && d.choice === 'approve');
const entries = decisions.filter(d => d.kind === 'entry' && d.choice === 'approve');
const sentBack = decisions.filter(d => d.choice === 'send_back');
const date = new Date().toISOString().slice(0, 10);
const run = (script, list) => {
  if (dry) { console.log(`would run: node ${script} ${list.join(' ')}`); return true; }
  try { execFileSync('node', [script, ...list], { cwd: ROOT, stdio: 'inherit' }); return true; } catch { return false; }
};

let refused = 0;
for (const claim of claims) {
  const ok = run('scripts/tea-reference-markdown/claims-cli.mjs', ['approve', claim.item, '--reason', `Approved by Adrian on the Wisdom review page, ${date}`, '--scope', claim.scope || claim.item.split(':')[0]]);
  if (!ok) refused += 1;
}

// A draft page goes public once every one of its sections is approved (lib/review.mjs).
const ledger = JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'tea-reference', 'claims.json'), 'utf8'));
const published = [];
for (const pageId of [...new Set(claims.map(claim => claim.item.split(':')[0]))]) {
  const file = path.join(ROOT, 'data', 'tea-reference', 'pages', `${pageId}.md`);
  let text;
  try { text = await fs.readFile(file, 'utf8'); } catch { continue; }
  if (!mayPublish(pageId, text, ledger.claims ?? [])) continue;
  if (!dry) await fs.writeFile(file, publishedMarkdown(text));
  published.push(pageId);
}

if (claims.length && !dry) execFileSync('npm', ['run', '--silent', 'tea-reference:pages'], { cwd: ROOT, stdio: 'inherit' });

for (const entry of entries) {
  const ok = run('scripts/tea-wisdom-compose/entries-cli.mjs', ['approve', entry.item.replace(/^entry:/, '')]);
  if (!ok) refused += 1;
}

const out = path.join(ROOT, '.tea-wisdom-review', 'sent-back.json');
if (!dry) {
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, `${JSON.stringify(sentBack.map(({ item, kind, note }) => ({ item, kind, note })), null, 2)}\n`);
}
console.log(`\n${claims.length} section(s) approved, ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} approved, ${refused} refused, ${sentBack.length} sent back`);
if (published.length) console.log(`${dry ? 'would become' : 'now'} public: ${published.join(', ')}`);
if (sentBack.length) console.log(`send-backs: ${path.relative(ROOT, out)}`);
process.exit(refused ? 1 : 0);
