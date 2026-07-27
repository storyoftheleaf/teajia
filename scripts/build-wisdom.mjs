#!/usr/bin/env node
/**
 * Builds the tea wisdom base from the raw research CSVs in data/tea-wisdom-source.
 *
 * The raw exports are batch fragments from an earlier research pass: the same
 * cultivar appears in several files at different levels of completeness, and one
 * file (the cultivar x tea-type relationship matrix) is a full cross-product with
 * a default rating, so it is deliberately not read here.
 *
 * Output is split by weight, because the whole point is that the lean index can
 * be imported everywhere without dragging the prose along:
 *   src/wisdom/generated/cultivars.ts   lean index, safe to import anywhere
 *   src/wisdom/generated/regions.ts     lean index, safe to import anywhere
 *   src/wisdom/stories/cultivars.json   the prose, loaded on demand
 *
 * Run: node scripts/build-wisdom.mjs
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'data/tea-wisdom-source');
const generated = join(root, 'src/wisdom/generated');
const stories = join(root, 'src/wisdom/stories');

/** Minimal RFC 4180 reader; the research exports contain quoted newlines and commas. */
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += char;
      continue;
    }
    if (char === '"') { quoted = true; continue; }
    if (char === ',') { row.push(field); field = ''; continue; }
    if (char === '\r') continue;
    if (char === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift().map(name => name.trim());
  return rows
    .filter(entry => entry.some(cell => cell.trim()))
    .map(entry => Object.fromEntries(header.map((name, index) => [name, (entry[index] ?? '').trim()])));
}

const slug = value => value.normalize('NFKD').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const list = value => value.split(/[;,]/).map(entry => entry.trim()).filter(Boolean);

/** Several fields were written as JSON blobs inside a CSV cell; keep them only if they parse. */
const maybeJson = value => {
  if (!value.trim().startsWith('{')) return null;
  try { return JSON.parse(value); } catch { return null; }
};

// ---------------------------------------------------------------- cultivars

const batchDir = join(source, 'cultivar-batches');
const batches = readdirSync(batchDir).filter(name => name.endsWith('.csv'));
const byName = new Map();

const consider = row => {
  const name = (row.name_english || '').trim();
  if (!name) return;
  const weight = Object.values(row).reduce((total, value) => total + String(value ?? '').length, 0);
  const existing = byName.get(name);
  if (!existing || weight > existing.weight) byName.set(name, { weight, row });
};

for (const file of batches) parseCsv(readFileSync(join(batchDir, file), 'utf8')).forEach(consider);
parseCsv(readFileSync(join(source, 'cultivars-flat.csv'), 'utf8')).forEach(consider);

const cultivars = [...byName.values()]
  .map(({ row }) => {
    const name = row.name_english.trim();
    const year = Number.parseInt(row.development_year, 10);
    return {
      id: slug(name),
      name,
      chineseName: row.name_native?.trim() || undefined,
      altNames: list(row.also_known_as || ''),
      originCountry: row.origin_country?.trim() || undefined,
      originRegion: row.origin_region?.trim() || undefined,
      developedYear: Number.isInteger(year) ? year : undefined,
      parentage: row.parentage?.trim() || undefined,
      story: {
        description: row.description?.trim() || '',
        plantType: row.plant_type?.trim() || '',
        environment: row.optimal_environment?.trim() || '',
        processing: row.processing_suitability_details?.trim() || '',
        oxidation: row.oxidation_details?.trim() || '',
        roasting: row.roasting_details?.trim() || '',
        versatility: row.style_versatility?.trim() || '',
        distribution: maybeJson(row.geographic_distribution || ''),
        expressions: maybeJson(row.tea_expressions || ''),
        sensory: maybeJson(row.sensory_footprint || ''),
      },
    };
  })
  .sort((left, right) => left.name.localeCompare(right.name));

// ------------------------------------------------------------------ regions
// Only name / country / region / altitude / climate are kept. The export's
// `tea_types` and `cultivars` columns list ~70 entries per origin including
// cultivars from other continents, so those cross-links are not trustworthy.

const regions = parseCsv(readFileSync(join(source, 'origins.csv'), 'utf8'))
  .filter(row => row.name && row.country)
  .map(row => ({
    id: slug(row.name),
    name: row.name.trim(),
    country: row.country.trim(),
    province: row.region?.trim() || undefined,
    altitude: row.altitude_range?.trim() || undefined,
    climate: row.climate_notes?.trim() || undefined,
  }))
  .sort((left, right) => left.name.localeCompare(right.name));

// ------------------------------------------------------------------- output

mkdirSync(generated, { recursive: true });
mkdirSync(stories, { recursive: true });

const banner = (count, noun) => `// Generated by scripts/build-wisdom.mjs from data/tea-wisdom-source. Do not edit by hand.
// ${count} ${noun}. Re-run the script after changing the source CSVs.\n`;

const lean = cultivars.map(({ story, ...rest }) => rest);

writeFileSync(join(generated, 'cultivars.ts'),
  `${banner(lean.length, 'cultivars')}import type { Cultivar } from '../types';\n\nexport const CULTIVARS: Cultivar[] = ${JSON.stringify(lean, null, 2)};\n`);

writeFileSync(join(generated, 'regions.ts'),
  `${banner(regions.length, 'growing regions')}import type { Region } from '../types';\n\nexport const RESEARCH_REGIONS: Region[] = ${JSON.stringify(regions, null, 2)};\n`);

writeFileSync(join(stories, 'cultivars.json'),
  `${JSON.stringify(Object.fromEntries(cultivars.map(entry => [entry.id, entry.story])), null, 2)}\n`);

const filled = field => cultivars.filter(entry => entry.story[field]).length;
console.log(`cultivars       ${cultivars.length}  (${filled('description')} described, ${filled('parentage') || cultivars.filter(c => c.parentage).length} with parentage)`);
console.log(`regions         ${regions.length}`);
console.log(`story payload   ${(JSON.stringify(cultivars.map(c => c.story)).length / 1024).toFixed(0)} KB, loaded on demand`);
