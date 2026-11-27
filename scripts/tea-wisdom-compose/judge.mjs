#!/usr/bin/env node
// The Opus judge: approves waiting Wisdom sections and tea entries in Adrian's
// place, against his written rules, and holds back only what it is not sure of
// (docs/agents/TEA-WISDOM-AGENTS.md, "The judge"). Adrian, 2026-11-27: approving
// everything himself is not the right workflow.
//
//   node scripts/tea-wisdom-compose/judge.mjs [--pages a,b] [--no-entries] [--dry-run]
//
// Writes, under .tea-wisdom-review/judge-<run>/:
//   decisions/<item>.json  one per approved item, in apply-review.mjs's format
//   approved.json          the approved item keys (for the "what went up" page)
//   held.json              the item keys only Adrian can settle (his page)
//   rework.json            items sent straight back to an agent, with the fix
//   notes.json             the judge's one-line reason per item
// It changes nothing in the repo itself; apply-review.mjs does that.
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, reviewItems } from './lib/review-items.mjs';
import { judgePrompt, parseVerdict } from './lib/judge.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const VAULT_NOTES = path.join(os.homedir(), 'Documents', 'Obsidian Vault', 'Teajia', 'Research', 'tea-wisdom');
const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => (
  value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]?.startsWith('--') ? 'true' : all[index + 1] ?? 'true']] : pairs
), []));

const log = (line) => process.stdout.write(`${new Date().toISOString().slice(11, 19)}  ${line}\n`);
const rules = {
  pages: await fs.readFile(path.join(ROOT, 'docs', 'WISDOM_PAGE_STYLE.md'), 'utf8'),
  voice: await fs.readFile(path.join(ROOT, 'docs', 'PRODUCT_DESCRIPTION_STYLE.md'), 'utf8'),
};
const scopes = await readJson(path.join(ROOT, '.tea-wisdom-review', 'scopes.json'), {});
const items = await reviewItems(ROOT, { scopes, pages: args.pages ? new Set(args.pages.split(',')) : null, entries: args['no-entries'] !== 'true' });

function opus(prompt) {
  return new Promise((resolve, reject) => {
    const child = execFile('claude', ['-p', '--model', 'opus', '--no-session-persistence', '--output-format', 'text'], { maxBuffer: 4 << 20, timeout: 240_000 }, (error, stdout) => (
      error ? reject(error) : resolve(stdout)
    ));
    child.stdin.end(prompt);
  });
}

const run = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
const out = path.join(ROOT, '.tea-wisdom-review', `judge-${run}`);
const approved = [];
const held = [];
const rework = [];
const notes = {};
const noteCache = new Map();
async function researchNote(pageId) {
  if (!noteCache.has(pageId)) {
    let text = null;
    try { text = await fs.readFile(path.join(VAULT_NOTES, `${pageId}.md`), 'utf8'); } catch { /* no note */ }
    noteCache.set(pageId, text);
  }
  return noteCache.get(pageId);
}

log(`${items.length} item(s) to judge`);
if (args['dry-run'] !== 'true') await fs.mkdir(path.join(out, 'decisions'), { recursive: true });
for (const item of items) {
  let verdict;
  if (item.kind === 'entry' && item.flags.length) {
    verdict = { choice: 'rework', reason: `The checker flagged it: ${item.flags[0]}`, fix: 'Run step 5: re-compose, then cut or reword the flagged words, or send the missing fact to step 2.' };
  } else if (args['dry-run'] === 'true') {
    verdict = { choice: 'ask', reason: 'dry run, not judged' };
  } else {
    try {
      const note = item.kind === 'claim' ? await researchNote(item.group) : null;
      verdict = parseVerdict(await opus(judgePrompt(item, rules, note)));
    } catch (error) {
      verdict = { choice: 'ask', reason: `The judge could not decide (${error.message}).` };
    }
  }
  notes[item.key] = verdict.reason;
  if (verdict.choice === 'approve') approved.push(item.key);
  else if (verdict.choice === 'rework') rework.push({ item: item.key, kind: item.kind, reason: verdict.reason, fix: verdict.fix ?? '' });
  else held.push(item.key);
  log(`${verdict.choice.padEnd(7)}  ${item.key}  ${verdict.reason}`);
  if (verdict.choice === 'approve' && args['dry-run'] !== 'true') {
    const file = path.join(out, 'decisions', `${item.key.replace(/[^a-z0-9-]/gi, '_')}.json`);
    await fs.writeFile(file, `${JSON.stringify({ item: item.key, kind: item.kind, choice: 'approve', note: '', scope: item.scope ?? '', by: 'judge', reason: verdict.reason }, null, 2)}\n`);
  }
}
if (args['dry-run'] !== 'true') {
  await fs.writeFile(path.join(out, 'approved.json'), `${JSON.stringify(approved, null, 2)}\n`);
  await fs.writeFile(path.join(out, 'held.json'), `${JSON.stringify(held, null, 2)}\n`);
  await fs.writeFile(path.join(out, 'rework.json'), `${JSON.stringify(rework, null, 2)}\n`);
  await fs.writeFile(path.join(out, 'notes.json'), `${JSON.stringify(notes, null, 2)}\n`);
}
log(`done: ${approved.length} approved, ${rework.length} back to agents, ${held.length} for Adrian${args['dry-run'] === 'true' ? ' (dry run)' : ''}`);
console.log(path.relative(ROOT, out));
