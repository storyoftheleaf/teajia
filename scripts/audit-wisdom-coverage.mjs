#!/usr/bin/env node
/**
 * Audits how well the tea wisdom base (src/wisdom) covers Adrian's own 300+
 * tea write-ups in products/.
 *
 * For every product markdown file this reports:
 *   - whether the tea name resolves against src/data/teaVarieties.ts or
 *     src/wisdom/cultivars.ts (via the real matchTeaVariety / matchCultivar)
 *   - whether the origin field resolves against src/wisdom/regions.ts
 *   - every distinct type and form value in use, flagged against the
 *     controlled vocabulary in src/wisdom/vocabulary.ts
 *
 * This reads the real app modules (bundled through esbuild the same way
 * scripts/export-wisdom-dataset.mjs does) rather than re-implementing the
 * matching logic, so the audit can never drift from what the app actually
 * resolves.
 *
 * Run: node scripts/audit-wisdom-coverage.mjs
 * Machine-readable output: node scripts/audit-wisdom-coverage.mjs --json > out.json
 */
import { build } from 'esbuild';
import { readFileSync, readdirSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const productsDir = join(root, 'products');
const tmpDir = join(tmpdir(), `teajia-wisdom-audit-${process.pid}-${Date.now()}`);
const asJson = process.argv.includes('--json');

/** Bundles a TS module to plain ESM in a throwaway temp file, then imports it. */
async function loadModule(entryPath, tmpName) {
  const outfile = join(tmpDir, tmpName);
  await build({
    entryPoints: [entryPath],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile,
    logLevel: 'silent',
  });
  return import(pathToFileURL(outfile).href);
}

mkdirSync(tmpDir, { recursive: true });
const { matchCultivar } = await loadModule(join(root, 'src/wisdom/cultivars.ts'), 'cultivars.mjs');
const { matchProducer, matchStyle, matchMark } = await loadModule(join(root, 'src/wisdom/producers.ts'), 'producers.mjs');
const { matchNamedTea } = await loadModule(join(root, 'src/wisdom/namedTeas.ts'), 'namedTeas.mjs');
const { findRegion } = await loadModule(join(root, 'src/wisdom/regions.ts'), 'regions.mjs');
const { normalizeTeaType, normalizeTeaForm, NON_TEA_TYPES } = await loadModule(join(root, 'src/wisdom/vocabulary.ts'), 'vocabulary.mjs');
const { matchTeaVariety } = await loadModule(join(root, 'src/data/teaVarieties.ts'), 'teaVarieties.mjs');
rmSync(tmpDir, { recursive: true, force: true });

// -------------------------------------------------------------- frontmatter

/** Same shape as scripts/create-new-products.mjs's parser, so results agree with it. */
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };
  const body = match[2];
  const meta = {};
  let currentKey = null;
  let currentList = null;
  for (const line of match[1].split('\n')) {
    const listMatch = line.match(/^\s+-\s+"?(.+?)"?\s*$/);
    if (listMatch && currentKey && currentList) { currentList.push(listMatch[1]); continue; }
    const kvMatch = line.match(/^(\w+):\s*(.*)$/);
    if (kvMatch) {
      if (currentKey && currentList) meta[currentKey] = currentList;
      currentKey = kvMatch[1];
      let value = kvMatch[2].trim();
      if (!value) { currentList = []; continue; }
      currentList = null;
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
        value = value.slice(1, -1);
      meta[currentKey] = value;
    }
  }
  if (currentKey && currentList) meta[currentKey] = currentList;
  return { meta, body };
}

function terroirSection(body) {
  const parts = body.split(/^## /m);
  for (let i = 1; i < parts.length; i++) {
    const nl = parts[i].indexOf('\n');
    if (nl === -1) continue;
    if (parts[i].slice(0, nl).trim().toLowerCase() === 'terroir') return parts[i].slice(nl + 1).trim();
  }
  return '';
}

// ------------------------------------------------------------------ origin

/** Mirrors create-new-products.mjs's parseOrigin: last comma segment is the
 * country, everything before it is the region descriptor. */
function splitOrigin(origin) {
  if (!origin?.trim()) return { country: null, regionPart: null, leaf: null };
  const parts = origin.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length === 1) return { country: parts[0], regionPart: null, leaf: parts[0] };
  return { country: parts[parts.length - 1], regionPart: parts.slice(0, -1).join(', '), leaf: parts[0] };
}

function resolveOrigin(origin) {
  const { country, regionPart, leaf } = splitOrigin(origin);
  const whole = findRegion(origin);
  if (whole) return { region: whole, via: 'whole-string' };
  const byRegionPart = regionPart ? findRegion(regionPart) : null;
  if (byRegionPart) return { region: byRegionPart, via: 'region-part' };
  const byLeaf = leaf ? findRegion(leaf) : null;
  if (byLeaf) return { region: byLeaf, via: 'leaf' };
  const byCountry = country ? findRegion(country) : null;
  if (byCountry) return { region: byCountry, via: 'country-only' };
  return { region: null, via: null };
}

// ----------------------------------------------------------------- walk it

function listProductFiles() {
  const files = [];
  for (const entry of readdirSync(productsDir)) {
    const full = join(productsDir, entry);
    if (!statSync(full).isDirectory()) continue;
    for (const name of readdirSync(full)) {
      if (name.endsWith('.md')) files.push(join(full, name));
    }
  }
  return files.sort();
}

const files = listProductFiles();

const results = [];
for (const file of files) {
  const content = readFileSync(file, 'utf8');
  const { meta, body } = parseFrontmatter(content);
  const names = [meta.productName, meta.chineseName].filter(Boolean);
  const variety = matchTeaVariety(...names);
  const cultivar = matchCultivar(...names);
  const producer = matchProducer(...names);
  const style = matchStyle(...names);
  const mark = matchMark(...names);
  const namedTea = matchNamedTea(...names);
  const typeNormalized = normalizeTeaType(meta.type);
  const isNonTea = NON_TEA_TYPES.includes(meta.type);
  const formNormalized = normalizeTeaForm(meta.form);
  const originResolution = resolveOrigin(meta.origin);

  results.push({
    file: file.slice(root.length + 1),
    productName: meta.productName ?? null,
    chineseName: meta.chineseName ?? null,
    producer, style, mark, namedTea,
    type: meta.type ?? null,
    form: meta.form ?? null,
    origin: meta.origin ?? null,
    terroir: terroirSection(body),
    variety: variety ? { name: variety.name, matchedOn: variety.matchedOn } : null,
    cultivar: cultivar ? { name: cultivar.name, id: cultivar.id } : null,
    typeNormalized,
    isNonTea,
    formNormalized,
    regionMatch: originResolution.region ? { name: originResolution.region.name, via: originResolution.via } : null,
  });
}

// ------------------------------------------------------------------ report

const teaResults = results.filter(r => !r.isNonTea);
const nonTeaResults = results.filter(r => r.isNonTea);

const resolvedTea = teaResults.filter(r => r.variety || r.cultivar);
const unresolvedTea = teaResults.filter(r => !r.variety && !r.cultivar);

const distinctBy = (list, field) => {
  const counts = new Map();
  for (const r of list) {
    const value = r[field];
    if (value == null) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
};

const distinctTypes = distinctBy(results, 'type');
const distinctForms = distinctBy(results, 'form');
const distinctOrigins = distinctBy(results, 'origin');

const typeGaps = distinctTypes.filter(([type]) => !normalizeTeaType(type) && !NON_TEA_TYPES.includes(type));
const formGaps = distinctForms.filter(([form]) => !normalizeTeaForm(form));

const originRows = [...new Map(results.filter(r => r.origin).map(r => [r.origin, r])).values()];
const unresolvedOrigins = originRows.filter(r => !r.regionMatch);
const weaklyResolvedOrigins = originRows.filter(r => r.regionMatch?.via === 'country-only');
const wellResolvedOrigins = originRows.filter(r => r.regionMatch && r.regionMatch.via !== 'country-only');

if (asJson) {
  console.log(JSON.stringify({
    totals: { products: results.length, tea: teaResults.length, nonTea: nonTeaResults.length },
    resolvedTea: resolvedTea.length,
    unresolvedTea: unresolvedTea.map(r => ({ file: r.file, productName: r.productName, chineseName: r.chineseName, type: r.type, origin: r.origin })),
    distinctTypes, distinctForms, distinctOrigins,
    typeGaps, formGaps,
    unresolvedOrigins: unresolvedOrigins.map(r => r.origin),
    weaklyResolvedOrigins: weaklyResolvedOrigins.map(r => ({ origin: r.origin, region: r.regionMatch.name })),
  }, null, 2));
  process.exit(0);
}

console.log(`Products scanned:        ${results.length} (${teaResults.length} tea, ${nonTeaResults.length} non-tea: teaware/misc)`);
console.log(`Tea name resolves:       ${resolvedTea.length} / ${teaResults.length}`);
console.log(`  via variety match:     ${teaResults.filter(r => r.variety).length}`);
console.log(`  via cultivar match:    ${teaResults.filter(r => r.cultivar).length}`);
console.log(`Tea name UNRESOLVED:     ${unresolvedTea.length}`);
console.log('');
// A shop's own name for a tea ("Courage") will never resolve to a shared entry
// and should not. But "recognized" has to mean something, and "it comes from
// Yunnan" is true of nearly everything, so recognition is reported in tiers
// from strongest to weakest rather than as one flattering number.
const identified = teaResults.filter(r => r.variety || r.cultivar || r.namedTea);
const attributed = teaResults.filter(r => !r.variety && !r.cultivar && !r.namedTea && (r.producer || r.style || r.mark));
const placed = teaResults.filter(r => !r.variety && !r.cultivar && !r.namedTea && !r.producer && !r.style && !r.mark && r.regionMatch);
const unknown = teaResults.filter(r => !r.variety && !r.cultivar && !r.namedTea && !r.producer && !r.style && !r.mark && !r.regionMatch);
const pct = n => `${Math.round((n / teaResults.length) * 100)}%`;
console.log('RECOGNITION, strongest first');
console.log(`  identified (plant):    ${identified.length}  ${pct(identified.length)}   the base knows the tea itself`);
console.log(`  attributed (maker):    ${attributed.length}  ${pct(attributed.length)}   producer, style or mark, but not the plant`);
console.log(`    names a producer:    ${teaResults.filter(r => r.producer).length}`);
console.log(`    names a style:       ${teaResults.filter(r => r.style).length}`);
console.log(`    names a mark:        ${teaResults.filter(r => r.mark).length}`);
console.log(`  of identified, named:  ${teaResults.filter(r => r.namedTea).length}   arrived already named, composition undisclosed`);
console.log(`  placed (origin only):  ${placed.length}  ${pct(placed.length)}   only where it grew`);
console.log(`  nothing at all:        ${unknown.length}  ${pct(unknown.length)}`);
console.log('');
console.log(`Distinct origin strings: ${distinctOrigins.length}`);
console.log(`  resolve (region/leaf):  ${wellResolvedOrigins.length}`);
console.log(`  resolve (country only): ${weaklyResolvedOrigins.length}`);
console.log(`  UNRESOLVED:             ${unresolvedOrigins.length}`);
console.log('');
console.log(`Distinct type values:    ${distinctTypes.length}, outside vocabulary: ${typeGaps.length}`);
console.log(`Distinct form values:    ${distinctForms.length}, outside vocabulary: ${formGaps.length}`);
console.log('');

if (unresolvedTea.length) {
  console.log('--- Unresolved tea names ---');
  for (const r of unresolvedTea) console.log(`  ${r.type?.padEnd(8) ?? ''} ${r.productName} (${r.chineseName ?? 'no chinese name'})  [${r.file}]`);
  console.log('');
}

console.log('--- Distinct type values ---');
for (const [type, count] of distinctTypes) {
  const known = normalizeTeaType(type) ? 'tea:' + normalizeTeaType(type) : (NON_TEA_TYPES.includes(type) ? 'non-tea' : 'GAP');
  console.log(`  ${String(count).padStart(3)}  ${type.padEnd(10)} ${known}`);
}
console.log('');

console.log('--- Distinct form values ---');
for (const [form, count] of distinctForms) {
  const known = normalizeTeaForm(form) ? 'form:' + normalizeTeaForm(form) : 'GAP';
  console.log(`  ${String(count).padStart(3)}  ${form.padEnd(12)} ${known}`);
}
console.log('');

console.log('--- Unresolved origins ---');
for (const r of unresolvedOrigins) console.log(`  ${r.origin}`);
console.log('');

console.log('--- Origins that only resolve at country level ---');
for (const r of weaklyResolvedOrigins) console.log(`  ${r.origin}  ->  ${r.regionMatch.name}`);
