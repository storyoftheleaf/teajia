#!/usr/bin/env node
// Tea Wisdom composer (phase 2 of todo/plans/tea-wisdom-composed-entry.md).
//
// Writes one draft entry per tea from the public record and the Wisdom claims
// that match it, with Claude on this Mac (Opus writes, Sonnet checks). Drafts
// land in data/tea-reference/entries/<productId>.json for Adrian to approve.
// Nothing is written to the shop.
//
//   node scripts/tea-wisdom-compose/compose.mjs --products <public-products.json> [--type Shou] [--ids a,b] [--limit 3]
//
// The product list is read from a file (fetch it once with curl from
// https://www.teajia.com/api/products/public). Each tea costs two model calls.
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { buildWisdom } from '../tea-reference-markdown/lib/page-builder.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ENTRIES = path.join(ROOT, 'data', 'tea-reference', 'entries');
const RULES = JSON.parse(await fs.readFile(path.join(ROOT, 'scripts', 'tea-wisdom-compose', 'rules.json'), 'utf8'));
const STYLE = await fs.readFile(path.join(ROOT, 'docs', 'PRODUCT_DESCRIPTION_STYLE.md'), 'utf8');
const EXAMPLES = await fs.readFile(path.join(ROOT, 'scripts', 'tea-wisdom-compose', 'examples.md'), 'utf8');

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => (
  value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]?.startsWith('--') ? 'true' : all[index + 1] ?? 'true']] : pairs
), []));
if (!args.products) { console.error('Pass --products <file> (the public product list).'); process.exit(2); }

const log = (line) => process.stdout.write(`${new Date().toISOString().slice(11, 19)}  ${line}\n`);

// The selection and checks are the shop's own TypeScript, bundled for Node.
const bundle = path.join(os.tmpdir(), `tea-wisdom-compose-${process.pid}.mjs`);
await build({ entryPoints: [path.join(ROOT, 'src', 'wisdom', 'compose', 'composeInputs.ts')], bundle: true, format: 'esm', platform: 'node', outfile: bundle, logLevel: 'error' });
const { composeInputs, entryProblems } = await import(pathToFileURL(bundle).href);

const wisdom = await buildWisdom({
  pagesDirectory: path.join(ROOT, 'data', 'tea-reference', 'pages'),
  translationsPath: path.join(ROOT, 'data', 'tea-reference', 'private', 'translations.json'),
  claimsPath: path.join(ROOT, 'data', 'tea-reference', 'claims.json'),
});
// Drafts are composed against draft claims too; approving an entry later requires its claims approved.
const claims = wisdom.draftClaims.map(claim => ({ ...claim, text: claim.pendingText ?? claim.text }));

function claude(model, prompt) {
  return new Promise((resolve, reject) => {
    const child = execFile('claude', ['-p', '--model', model, '--no-session-persistence', '--output-format', 'text'], { maxBuffer: 4 << 20, timeout: 240_000 }, (error, stdout) => (
      error ? reject(error) : resolve(stdout)
    ));
    child.stdin.end(prompt);
  });
}

/** The first complete JSON object in a reply, ignoring any text after it. */
function jsonFrom(text) {
  const start = text.indexOf('{');
  if (start < 0) throw new Error('no JSON object in the reply');
  for (let end = text.indexOf('}', start); end >= 0; end = text.indexOf('}', end + 1)) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch { /* keep extending */ }
  }
  throw new Error('no complete JSON object in the reply');
}

const claimBrief = (claim) => ({ id: claim.claimId, label: claim.label, text: claim.text, terms: claim.terms });

function writePrompt(inputs, fixes = []) {
  const layers = Object.fromEntries(Object.entries(inputs.layers).map(([layer, list]) => [layer, list.map(claimBrief)]));
  return `You write the one "About this tea" entry for a product page on teajia.com, a tea shop. Follow the house style guide below exactly.

THE HOUSE STYLE GUIDE
${STYLE}

HOW AN ENTRY IS BUILT
- Story paragraphs (one to three), most specific layer first: lot (from the record notes), grade, place, age, type. Use only the layers supplied. Skip a missing layer; never guess.
- The reader may already know the tea's type. Put general knowledge in a clause and lead with what is specific to this tea.
- Story paragraphs carry place, craft, history and how the tea has changed with age. No taste or texture words in them at all (no sweet, smooth, woody, earthy, aroma, notes). Those go only in the notice.
- Then one brewing paragraph, from the brewing claim, fitted to this tea's form.
- Then, only if a notice layer is supplied, one short sentence of what people often notice in the style (not this lot; never "it" or "this tea", name or describe the style), from the notice claims, and a styleName such as "ripe pu’er" or "aged ripe pu’er".
- Mark each term you take from a claim as [shown words](claim-id), using only the claim ids supplied, once per claim at most. Mark the words a reader would want to learn more about.
- From the record notes, keep only statements about this lot's own history, storage or making. Ignore tree age, altitude and anything about taste in them.
- Every number you write must come from the inputs. Write ages in words where it reads better. No dashes of any kind, no superlatives, no exclamation marks.
- Write in your own words; do not copy claim sentences whole.
- Add no general tea knowledge of your own: every general statement must come from a claim supplied. If it is not in a claim, leave it out, even if you believe it is true.
- The product name is a name, not evidence. Never say what a name refers to (a village, a mountain, a maker, a grade) unless the record's origin or a claim says so.
- Link only words a reader would want to learn about: the tea type, a process, a place, a grade, a term of art. Never link ordinary words such as "a pick" or "boiling water".
- Let the story flow: one to two paragraphs usually, joined by sense rather than by layer label. Write ages and counts in words ("thirty-six years").

TWO APPROVED ENTRIES, FOR THE VOICE (do not reuse their facts)
${EXAMPLES}

THE TEA
${JSON.stringify(inputs.record, null, 2)}

THE CLAIMS YOU MAY USE, BY LAYER
${JSON.stringify(layers, null, 2)}
${fixes.length ? `\nYOUR LAST DRAFT FAILED THESE CHECKS. FIX THEM:\n${fixes.map(fix => `- ${fix.where}: ${fix.problem}`).join('\n')}\n` : ''}
Reply with one JSON object and nothing else:
{"paragraphs":[{"layer":"lot|grade|place|age|type","text":"..."}],"brewing":{"layer":"brewing","text":"..."},"notice":{"layer":"notice","styleName":"...","text":"..."} or null}`;
}

function checkPrompt(inputs, entry) {
  return `You are checking a tea product description before a shop owner approves it. The description may only state what the inputs support.

What counts as support: the record (its name, type, form, year, origin and notes are the owner's own record of this lot and count as fact), and the claims. Plain arithmetic from them (an age from a year) and a type's general process applied to a tea of that type are supported. The notice is a sentence about the style in general, clearly labelled as such; flag it only if it says something about this lot.

List every sentence that states something beyond that support: an invented place, date, maker, tree age, process step, or a taste or texture claimed for this lot; any general statement about tea that no claim makes, even if it is true; and anything read from the product name alone (for example calling a name a village when the origin field does not say so). Wording and style are not your concern.

List only sentences you would flag. Leave supported sentences out entirely; an empty list is the expected answer for a good entry.

INPUTS
${JSON.stringify({ record: inputs.record, claims: Object.values(inputs.layers).flat().map(claimBrief) }, null, 2)}

DESCRIPTION
${JSON.stringify(entry, null, 2)}

For each flag, quote the exact unsupported words. If you cannot point to words that go beyond the inputs, do not flag the sentence.

Reply with one JSON object and nothing else: {"unsupported":[{"sentence":"...","words":"the exact unsupported words","why":"..."}]}`;
}

/** The model sometimes answers a part as a bare string; accept that, drop anything without text. */
function normalised(draft, productId, missing) {
  const part = (value, layer) => {
    if (!value) return undefined;
    // The page prints the labels; a copied "Brewing:" or "What people often notice…:" would print twice.
    const bare = text => text.replace(/^\s*(brewing|what people often notice[^:]*):\s*/i, '').trim();
    if (typeof value === 'string') return { layer, text: bare(value) };
    return typeof value.text === 'string' && value.text.trim() ? { ...value, text: bare(value.text), layer: value.layer ?? layer } : undefined;
  };
  const paragraphs = (Array.isArray(draft.paragraphs) ? draft.paragraphs : []).map(value => part(value, 'type')).filter(Boolean);
  const brewing = part(draft.brewing, 'brewing');
  const notice = part(draft.notice, 'notice');
  return { productId, paragraphs, ...(brewing ? { brewing } : {}), ...(notice ? { notice: { styleName: notice.styleName ?? 'this style', ...notice } } : {}), missing };
}

async function composeOne(product) {
  const inputs = composeInputs(product, claims, { thisYear: new Date().getFullYear(), noNotice: RULES.noNotice });
  let entry;
  let problems = [];
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    log(`${product.product_name}: writing (attempt ${attempt})`);
    const reply = await claude('opus', writePrompt(inputs, problems));
    await fs.writeFile(path.join(os.tmpdir(), `tea-wisdom-reply-${product.id}.txt`), reply);
    entry = normalised(jsonFrom(reply), product.id, inputs.missing);
    problems = entryProblems(entry, inputs);
    if (!problems.length) break;
    log(`${product.product_name}: ${problems.length} check(s) failed: ${problems.map(p => p.problem).join('; ')}`);
  }
  log(`${product.product_name}: checking against the inputs`);
  const check = jsonFrom(await claude('sonnet', checkPrompt(inputs, entry)));
  // A flag must quote words that appear in the entry; anything else is the checker thinking aloud.
  const entryText = [...entry.paragraphs, entry.brewing, entry.notice].filter(Boolean).map(part => part.text).join(' ');
  const unsupported = (check.unsupported ?? []).filter(flag => typeof flag.words === 'string' && flag.words.trim() && entryText.includes(flag.words.trim()));
  const ready = problems.length === 0 && unsupported.length === 0;
  const claimUses = [...new Set([...entry.paragraphs, entry.brewing, entry.notice].filter(Boolean)
    .flatMap(part => [...part.text.matchAll(/\]\(([a-z0-9-]+:[a-z0-9-]+)\)/g)].map(match => match[1])))]
    .map(claimId => ({ claimId, rev: claims.find(claim => claim.claimId === claimId)?.rev ?? null }));
  const file = {
    status: ready ? 'draft' : 'needs_review',
    composedAt: new Date().toISOString(),
    writer: 'claude opus', checker: 'claude sonnet',
    record: { id: product.id, name: product.product_name, chineseName: product.chinese_name ?? null, type: product.type ?? null, form: product.form ?? null, year: product.year ?? null, origin: inputs.record.origin ?? null, stockGrams: product.stock_grams ?? null, pricePerGramUsd: product.retail_price_per_gram_usd ?? null, tags: product.tasting_notes ?? [] },
    entry,
    claimUses,
    problems,
    unsupported,
  };
  await fs.writeFile(path.join(ENTRIES, `${product.id}.json`), `${JSON.stringify(file, null, 2)}\n`);
  log(`${product.product_name}: ${ready ? 'ready for review' : `needs review (${problems.length + unsupported.length} flag(s))`}`);
  return file;
}

const all = JSON.parse(await fs.readFile(path.resolve(args.products), 'utf8'));
let products = all.filter(product => product.type && !product.teaware_category);
if (args.type) products = products.filter(product => new RegExp(args.type, 'i').test(product.type));
if (args.ids) products = products.filter(product => args.ids.split(',').includes(product.id));
if (args.limit) products = products.slice(0, Number(args.limit));
await fs.mkdir(ENTRIES, { recursive: true });
log(`${products.length} tea(s) to compose, ${products.length * 2} to ${products.length * 4} model calls`);
const results = [];
for (const product of products) {
  try { results.push(await composeOne(product)); } catch (error) { log(`${product.product_name}: failed: ${error.message}`); }
}
await fs.rm(bundle, { force: true });
log(`done: ${results.filter(r => r.status === 'draft').length} ready, ${results.filter(r => r.status !== 'draft').length} need review, ${products.length - results.length} failed`);
