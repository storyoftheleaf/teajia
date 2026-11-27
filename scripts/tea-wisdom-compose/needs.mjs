#!/usr/bin/env node
// What the Wisdom Base still needs before a tea's entry can be composed.
// Spec: docs/TEA_WISDOM_BASE.md, "When a new tea is posted: what the Wisdom Base needs".
//
//   node scripts/tea-wisdom-compose/needs.mjs --products <public-products.json> [--ids a,b] [--type Shou]
//
// Prints, per tea, what the Wisdom Base covers and what it is missing, then the
// most-needed missing pages across all teas. Read-only: it reads the product
// file and the local Wisdom pages and claims, and writes nothing. The check is
// the shop's own wisdomNeeds() (src/wisdom/reference/wisdomNeeds.ts), bundled
// for Node, run against published pages and the drafts, so a page written but
// not yet approved reads as drafted.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { buildWisdom } from '../tea-reference-markdown/lib/page-builder.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => (
  value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]?.startsWith('--') ? 'true' : all[index + 1] ?? 'true']] : pairs
), []));
if (!args.products) { console.error('Pass --products <file> (the public product list).'); process.exit(2); }

const bundle = path.join(os.tmpdir(), `tea-wisdom-needs-${process.pid}.mjs`);
await build({ entryPoints: [path.join(ROOT, 'src', 'wisdom', 'reference', 'wisdomNeeds.ts')], bundle: true, format: 'esm', platform: 'node', outfile: bundle, logLevel: 'error' });
const { wisdomNeeds } = await import(pathToFileURL(bundle).href);
await fs.rm(bundle, { force: true });

const wisdom = await buildWisdom({
  pagesDirectory: path.join(ROOT, 'data', 'tea-reference', 'pages'),
  translationsPath: path.join(ROOT, 'data', 'tea-reference', 'private', 'translations.json'),
  claimsPath: path.join(ROOT, 'data', 'tea-reference', 'claims.json'),
});
const sources = {
  published: { pages: wisdom.registry.pages, claims: wisdom.claims },
  drafts: { pages: wisdom.draftPages, claims: wisdom.draftClaims },
};

const all = JSON.parse(await fs.readFile(path.resolve(args.products), 'utf8'));
let products = (Array.isArray(all) ? all : all.products ?? []).filter(product => product.type && !product.teaware_category);
if (args.type) products = products.filter(product => new RegExp(args.type, 'i').test(product.type));
if (args.ids) products = products.filter(product => args.ids.split(',').includes(product.id));

const STATE = { written: 'covered', drafted: 'drafted', record: 'record', missing: 'missing' };
const pad = (text, width) => String(text).padEnd(width);
const wanted = new Map();

for (const product of products) {
  const needs = wisdomNeeds(product, sources);
  console.log(`\n${product.product_name}${product.origin_region ? `  (${[product.origin_region, product.origin_country].filter(Boolean).join(', ')})` : ''}`);
  for (const need of needs) {
    console.log(`  ${pad(STATE[need.state], 8)} ${pad(need.kind, 9)} ${pad(need.label, 26)} ${need.why}`);
    if (need.covered) continue;
    const key = `${need.kind}:${need.label}`;
    const entry = wanted.get(key) ?? { ...need, teas: 0 };
    entry.teas += 1;
    wanted.set(key, entry);
  }
}

const ranked = [...wanted.values()].sort((left, right) => right.teas - left.teas || left.label.localeCompare(right.label));
console.log(`\n${products.length} tea(s) checked. Most-needed pages:`);
if (!ranked.length) console.log('  none: every tea is covered');
for (const need of ranked) {
  console.log(`  ${need.label} (${need.kind}): ${need.teas} tea${need.teas === 1 ? '' : 's'}, ${need.why.charAt(0).toLowerCase()}${need.why.slice(1)}`);
}
