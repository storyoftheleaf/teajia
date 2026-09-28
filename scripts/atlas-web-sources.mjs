#!/usr/bin/env node
// Tea Atlas: build a source out of many saved web articles (one PDF each).
//
// The Add source page (/tea-atlas/add) turns ONE PDF into ONE source. A shop's
// blog saved page by page is the other shape: many PDFs, one source, one issue
// ("Articles"), one article per PDF. This runs the same reader and the same
// package builder as that page (src/atlas/add/*) in Node, then records the
// source the way the page does (articles/, added/<id>/manifest.json,
// added/sources.json), so `npm run atlas:upload` puts it in the index and
// search and keeps it on every rebuild. docs/TEA_ATLAS.md.
//
//   node scripts/atlas-web-sources.mjs --out <dir>            build only, to look at
//   node scripts/atlas-web-sources.mjs --out <dir> --send     build, then send to the bucket
//
// Text only for now: pictures are a second pass.

import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { extractPdf } from '../src/atlas/add/extract.ts';
import { buildSourcePackage, suggestTopics } from '../src/atlas/add/buildPackage.ts';
import { repairLigatures, wordCount } from '../src/atlas/add/text.ts';
import { cleanWebBlocks, vocabularyOf } from './atlas-web-clean.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WISDOM = join(homedir(), 'Documents/Files/2 Areas/Brands/Teajia/Reference/Tea wisdom');
const EXPORT = join(WISDOM, 'Atlas/_export');

/** The two shops, and how their saved pages are named. */
export const WEB_SOURCES = [
  {
    match: / – The Chinese Tea Shop\.pdf$/,
    details: {
      name: 'The Chinese Tea Shop',
      kind: 'article',
      subtitle: 'Guides and essays from the shop’s website',
      credit: 'The Chinese Tea Shop, thechineseteashop.com',
      year: '',
      issueLabel: 'Articles',
    },
  },
  {
    match: / — Ooika \(覆い香\)\.pdf$/,
    details: {
      name: 'Ooika',
      kind: 'article',
      subtitle: 'Articles from the Ooika tea journal',
      credit: 'Ooika, ooika.co',
      year: '',
      issueLabel: 'Articles',
    },
  },
];

/** "How To Buy Chinese Tea - By Daniel Lui – The Chinese Tea Shop.pdf" → title and author. */
export function titleFromFile(file, match) {
  let title = file.replace(match, '').replace(/_/g, '?').replace(/\s+–-\s+/g, ' – ').trim();
  let author = '';
  const by = / - By (.+)$/.exec(title);
  if (by) { author = by[1].trim(); title = title.slice(0, by.index).trim(); }
  return { title, author };
}

async function readPdf(path, vocabulary) {
  const task = pdfjs.getDocument({ data: new Uint8Array(readFileSync(path)), verbosity: 0 });
  const pdf = await task.promise;
  // Text only: every picture is left out for now.
  const doc = await extractPdf(pdf, { ops: pdfjs.OPS, onPicture: () => false });
  await task.destroy();
  // "di\u0000erent" → "different": the pair that makes a word Global Tea Hut uses.
  return repairLigatures(doc, w => vocabulary.has(w));
}

/** Build one source from all its PDFs, in file-name order. */
export async function buildWebSource(spec, files, topics, vocabulary) {
  const articles = [];
  let manifest = null;
  for (const file of files) {
    const doc = await readPdf(join(WISDOM, file), vocabulary);
    const { title, author } = titleFromFile(file, spec.match);
    const pkg = buildSourcePackage({ doc, details: spec.details, sections: [{ title, author, start: 0, topics: [] }], pictures: new Map(), topics });
    const a = pkg.articles[0];
    const blocks = cleanWebBlocks(a.blocks, title);
    let id = a.id;
    for (let n = 2; articles.some(x => x.id === id); n++) id = `${a.id}-${n}`;
    articles.push({ ...a, id, order: articles.length, author, blocks, words: wordCount(blocks), topics: suggestTopics(title, blocks, topics) });
    manifest ??= pkg.manifest;
  }
  const used = new Set(articles.flatMap(a => a.topics));
  manifest.sources[0].issues[0].articles = articles.map(a => a.id);
  manifest.topics = topics.filter(t => used.has(t.id)).map(t => ({ id: t.id, name: t.name, category: t.category, aliases: t.aliases ?? [] }));
  manifest.articles = articles.map(({ blocks: _b, ...meta }) => meta);
  return { manifest, articles };
}

const BUCKET = 'teajia-atlas-private';

function wrangler(args, { quiet = true } = {}) {
  const remote = args[1] === 'object' || args[1] === 'bulk' ? ['--remote'] : [];
  const r = spawnSync('npx', ['wrangler', ...args, ...remote], { cwd: join(ROOT, 'worker'), encoding: 'utf8', stdio: quiet ? 'pipe' : 'inherit' });
  return { ok: r.status === 0, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

/**
 * Send built sources the way the Add source page does (src/atlas/add/publish.ts):
 * articles, then added/<id>/manifest.json, then added/sources.json. Then
 * `atlas:upload` rebuilds the index and search with them in. Sending again
 * replaces this script's own articles; nothing of Global Tea Hut is touched,
 * because every key starts with the new source's issue id.
 */
function send(out, built) {
  const dev = wrangler(['r2', 'bucket', 'dev-url', 'get', BUCKET]);
  const dom = wrangler(['r2', 'bucket', 'domain', 'list', BUCKET]);
  if (!/disabled/i.test(dev.out) || !/no custom domains/i.test(dom.out)) throw new Error(`${BUCKET} is not private, or could not be checked. Nothing sent.`);
  console.log('✓ Bucket is private');

  const pkgIds = new Set(JSON.parse(readFileSync(join(EXPORT, 'manifest.json'), 'utf8')).sources.map(x => x.id));
  const regFile = join(out, 'sources.json');
  const got = wrangler(['r2', 'object', 'get', `${BUCKET}/added/sources.json`, '--file', regFile]);
  const registry = got.ok && existsSync(regFile) ? JSON.parse(readFileSync(regFile, 'utf8')) : { format: 1, sources: [] };

  for (const { manifest, articles } of built) {
    const src = manifest.sources[0];
    if (pkgIds.has(src.id)) throw new Error(`${src.name}: the package already has a source with the id ${src.id}.`);
    const dir = join(out, src.id);
    const list = join(dir, 'bulk.json');
    writeFileSync(list, JSON.stringify(articles.map(a => ({ key: `articles/${a.id}.json`, file: join(dir, 'articles', `${a.id}.json`) }))));
    const put = wrangler(['r2', 'bulk', 'put', BUCKET, '--filename', list, '--content-type', 'application/json', '--concurrency', '6', '--force'], { quiet: false });
    if (!put.ok) throw new Error(`${src.name}: the articles did not all send. Run again.`);
    if (!wrangler(['r2', 'object', 'put', `${BUCKET}/added/${src.id}/manifest.json`, '--file', join(dir, 'manifest.json'), '--content-type', 'application/json']).ok) {
      throw new Error(`${src.name}: its record did not save. Run again.`);
    }
    if (!registry.sources.some(x => x.id === src.id)) registry.sources.push({ id: src.id, name: src.name, addedAt: new Date().toISOString() });
    console.log(`✓ Sent ${src.name}: ${articles.length} articles`);
  }
  writeFileSync(regFile, JSON.stringify(registry));
  if (!wrangler(['r2', 'object', 'put', `${BUCKET}/added/sources.json`, '--file', regFile, '--content-type', 'application/json']).ok) {
    throw new Error('The list of added sources did not save. Run again.');
  }
  console.log(`✓ Added sources now: ${registry.sources.map(x => x.name).join(', ')}`);
  console.log('▶ Rebuilding the index and search (npm run atlas:upload)');
  const up = spawnSync('node', [join(ROOT, 'scripts/atlas-upload.mjs')], { cwd: ROOT, stdio: 'inherit' });
  if (up.status !== 0) throw new Error('atlas:upload failed; run `npm run atlas:upload` again.');
}

async function main() {
  const args = process.argv.slice(2);
  const out = resolve(args[args.indexOf('--out') + 1] || join(process.env.TMPDIR || '/tmp', 'atlas-web-sources'));
  const topics = JSON.parse(readFileSync(join(EXPORT, 'manifest.json'), 'utf8')).topics;
  // Spelling reference for letters the PDFs lost: every word Global Tea Hut uses.
  const texts = [];
  for (const f of readdirSync(join(EXPORT, 'articles'))) {
    for (const b of JSON.parse(readFileSync(join(EXPORT, 'articles', f), 'utf8')).blocks) if (b.v) texts.push(b.v);
  }
  const vocabulary = vocabularyOf(texts);
  const pdfs = readdirSync(WISDOM).filter(f => f.endsWith('.pdf')).sort();
  const built = [];
  for (const spec of WEB_SOURCES) {
    const files = pdfs.filter(f => spec.match.test(f));
    const pkg = await buildWebSource(spec, files, topics, vocabulary);
    const src = pkg.manifest.sources[0];
    const dir = join(out, src.id);
    mkdirSync(join(dir, 'articles'), { recursive: true });
    writeFileSync(join(dir, 'manifest.json'), JSON.stringify(pkg.manifest, null, 1));
    for (const a of pkg.articles) writeFileSync(join(dir, 'articles', `${a.id}.json`), JSON.stringify(a));
    const words = pkg.articles.reduce((n, a) => n + a.words, 0);
    console.log(`✓ ${src.name}: ${pkg.articles.length} articles, ${words.toLocaleString()} words → ${dir}`);
    built.push(pkg);
  }
  if (args.includes('--send')) send(out, built);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(err => { console.error(`✗ ${err.stack || err.message}`); process.exit(1); });
}
