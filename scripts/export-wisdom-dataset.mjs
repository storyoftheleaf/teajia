#!/usr/bin/env node
/**
 * Exports the tea wisdom base as a versioned, self-describing public dataset.
 *
 * This reads the same modules the app reads (src/wisdom, src/data/teaVarieties.ts)
 * and writes the result to public/wisdom as JSON, CSV, a README and a LICENSE.
 * It is an export of what already exists in the codebase, nothing more: no
 * fact is invented here, and the source files it reads are the single owner
 * of the underlying data.
 *
 * Run: node scripts/export-wisdom-dataset.mjs
 * Optional fixed generation date (otherwise today, in UTC): pass it as an
 * argument or set WISDOM_EXPORT_DATE, e.g.
 *   node scripts/export-wisdom-dataset.mjs 2026-07-27
 *   WISDOM_EXPORT_DATE=2026-07-27 node scripts/export-wisdom-dataset.mjs
 */
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public/wisdom');
const tmpDir = join(tmpdir(), `teajia-wisdom-export-${process.pid}-${Date.now()}`);

const VERSION = '1.0.0';
const GENERATED_AT = process.argv[2] || process.env.WISDOM_EXPORT_DATE || new Date().toISOString().slice(0, 10);

const slug = value => value.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

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
mkdirSync(outDir, { recursive: true });

const { CULTIVARS } = await loadModule(join(root, 'src/wisdom/cultivars.ts'), 'cultivars.mjs');
const { REGIONS } = await loadModule(join(root, 'src/wisdom/regions.ts'), 'regions.mjs');
const { PRODUCERS, STYLES, MARKS } = await loadModule(join(root, 'src/wisdom/producers.ts'), 'producers.mjs');
const { NAMED_TEAS } = await loadModule(join(root, 'src/wisdom/namedTeas.ts'), 'namedTeas.mjs');
const { TEA_TYPES, TEA_FORMS, SEASONS, STORAGE_STYLES } = await loadModule(join(root, 'src/wisdom/vocabulary.ts'), 'vocabulary.mjs');
const { TEA_VARIETIES } = await loadModule(join(root, 'src/data/teaVarieties.ts'), 'teaVarieties.mjs');
const { getAuthorship } = await loadModule(join(root, 'src/wisdom/authorship.ts'), 'authorship.mjs');

rmSync(tmpDir, { recursive: true, force: true });

const stories = JSON.parse(readFileSync(join(root, 'src/wisdom/stories/cultivars.json'), 'utf8'));

// ----------------------------------------------------------------- cultivars

const cultivars = CULTIVARS.map(cultivar => {
  const story = stories[cultivar.id] ?? null;
  const authorship = getAuthorship(cultivar.id);
  return {
    id: cultivar.id,
    name: cultivar.name,
    chineseName: cultivar.chineseName ?? null,
    altNames: cultivar.altNames ?? [],
    originCountry: cultivar.originCountry ?? null,
    originRegion: cultivar.originRegion ?? null,
    developedYear: cultivar.developedYear ?? null,
    parentage: cultivar.parentage ?? null,
    description: story?.description || null,
    plantType: story?.plantType || null,
    environment: story?.environment || null,
    processing: story?.processing || null,
    oxidation: story?.oxidation || null,
    roasting: story?.roasting || null,
    versatility: story?.versatility || null,
    distribution: story?.distribution ?? null,
    expressions: story?.expressions ?? null,
    sensory: story?.sensory ?? null,
    authorshipRung: authorship.rung,
  };
});

// -------------------------------------------------------------------- regions

const regions = REGIONS.map(region => ({
  id: region.id,
  name: region.name,
  country: region.country,
  province: region.province ?? null,
  altitude: region.altitude ?? null,
  climate: region.climate ?? null,
}));

// --------------------------------------------------------------- tea varieties

const seenVarietyIds = new Map();
const teaVarieties = Object.entries(TEA_VARIETIES).flatMap(([type, entries]) =>
  entries.map(entry => {
    const base = `${slug(type)}-${slug(entry.name)}`;
    const seen = seenVarietyIds.get(base) ?? 0;
    seenVarietyIds.set(base, seen + 1);
    const id = seen === 0 ? base : `${base}-${seen + 1}`;
    return {
      id,
      type,
      name: entry.name,
      chineseName: entry.chineseName ?? null,
      altNames: entry.altNames ?? [],
      region: entry.region ?? null,
    };
  })
);

// ------------------------------------------------------------------ vocabulary

const vocabulary = [
  ...TEA_TYPES.map(value => ({ axis: 'Type', value })),
  ...TEA_FORMS.map(value => ({ axis: 'Form', value })),
  ...SEASONS.map(value => ({ axis: 'Season', value })),
  ...STORAGE_STYLES.map(value => ({ axis: 'Storage', value })),
];

// ---------------------------------------------------------------------- meta

const meta = {
  name: 'Teajia Tea Wisdom Base',
  version: VERSION,
  generatedAt: GENERATED_AT,
  license: 'CC BY 4.0, see LICENSE.txt',
  homepage: 'https://teajia.com',
  contact: 'hello@teajia.com',
  counts: {
    cultivars: cultivars.length,
    regions: regions.length,
    teaVarieties: teaVarieties.length,
    producers: PRODUCERS.length,
    styles: STYLES.length,
    marks: MARKS.length,
    namedTeas: NAMED_TEAS.length,
    vocabulary: vocabulary.length,
  },
};

writeFileSync(
  join(outDir, 'tea-wisdom.json'),
  `${JSON.stringify({ meta, vocabulary, regions, cultivars, teaVarieties, producers: PRODUCERS, styles: STYLES, marks: MARKS, namedTeas: NAMED_TEAS }, null, 2)}\n`
);

// ------------------------------------------------------------------------ csv

function toCsv(rows, columns) {
  const escape = value => {
    if (value === null || value === undefined) return '';
    const text = Array.isArray(value) ? value.join(';') : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const header = columns.join(',');
  const body = rows.map(row => columns.map(column => escape(row[column])).join(',')).join('\n');
  return `${header}\n${body}\n`;
}

writeFileSync(
  join(outDir, 'tea-wisdom-cultivars.csv'),
  toCsv(cultivars, [
    'id', 'name', 'chineseName', 'altNames', 'originCountry', 'originRegion', 'developedYear', 'parentage',
    'description', 'plantType', 'environment', 'processing', 'oxidation', 'roasting', 'versatility', 'authorshipRung',
  ])
);

writeFileSync(
  join(outDir, 'tea-wisdom-regions.csv'),
  toCsv(regions, ['id', 'name', 'country', 'province', 'altitude', 'climate'])
);

writeFileSync(
  join(outDir, 'tea-wisdom-producers.csv'),
  toCsv(PRODUCERS, ['id', 'name', 'chineseName', 'altNames', 'kind', 'country', 'region', 'founded', 'notableMarks', 'description'])
);

writeFileSync(
  join(outDir, 'tea-wisdom-marks.csv'),
  toCsv(MARKS, ['id', 'name', 'chineseName', 'altNames', 'producerId', 'era', 'appliesToTypes', 'description'])
);

writeFileSync(
  join(outDir, 'tea-wisdom-styles.csv'),
  toCsv(STYLES, ['id', 'name', 'chineseName', 'altNames', 'appliesToTypes', 'region', 'description'])
);

writeFileSync(
  join(outDir, 'tea-wisdom-named-teas.csv'),
  toCsv(NAMED_TEAS, ['id', 'name', 'chineseName', 'type', 'form', 'region', 'country', 'collection', 'provenance', 'tradition', 'description'])
);

writeFileSync(
  join(outDir, 'tea-wisdom-varieties.csv'),
  toCsv(teaVarieties, ['id', 'type', 'name', 'chineseName', 'altNames', 'region'])
);

writeFileSync(
  join(outDir, 'tea-wisdom-vocabulary.csv'),
  toCsv(vocabulary, ['axis', 'value'])
);

// -------------------------------------------------------------------- license

writeFileSync(
  join(outDir, 'LICENSE.txt'),
  `Teajia Tea Wisdom Base
License: CC BY 4.0 (Creative Commons Attribution 4.0 International)
https://creativecommons.org/licenses/by/4.0/

This license covers the structured facts in this dataset: cultivar names,
breeding lineage, growing regions, tea variety names, and the controlled
vocabulary (tea types, forms, seasons, storage styles), along with the
cultivar descriptions drafted from research.

You are free to share and adapt this data for any purpose, including
commercially, as long as you give appropriate credit. Attribute as:

  Teajia Tea Wisdom Base (teajia.com), CC BY 4.0.

Carve-out: Adrian's own tea write-ups and tasting notes are NOT included in
this dataset and remain his. This dataset is the shared research layer only,
not the shop's own voice.

Corrections and additions: hello@teajia.com
`
);

// --------------------------------------------------------------------- readme

writeFileSync(
  join(outDir, 'README.md'),
  `# Teajia Tea Wisdom Base, open dataset

## What this is

A public export of Teajia's tea wisdom base: ${cultivars.length} cultivars with
breeding lineage and descriptions, ${regions.length} growing regions,
${PRODUCERS.length} producers, ${MARKS.length} marks, ${STYLES.length} styles,
${NAMED_TEAS.length} teas known only by the name they were given,
${teaVarieties.length} tea varieties, and the controlled vocabulary that ties
them together (${vocabulary.length} terms across type, form, season and
storage). This is the account-agnostic layer behind teajia.com, true
regardless of who stocks or sells a tea. It is not a product catalog, a shop
export, or Adrian's own tasting notes.

## The standard

This is not everything. The goal is to be everything. If you know something
that isn't here, send it to hello@teajia.com.

## License

CC BY 4.0. See LICENSE.txt. Adrian's own tea write-ups and tasting notes are
not included in this dataset and remain his.

## Citation

Teajia Tea Wisdom Base (teajia.com), version ${VERSION}, generated
${GENERATED_AT}, CC BY 4.0.

## Files

- \`tea-wisdom.json\`: everything in one file, with a \`meta\` block carrying
  the version, a record count per entity, and the generation date.
- \`tea-wisdom-cultivars.csv\`, \`tea-wisdom-regions.csv\`,
  \`tea-wisdom-varieties.csv\`, \`tea-wisdom-vocabulary.csv\`: flat, one file
  per entity type, for spreadsheet tools.
- \`LICENSE.txt\`

## Schema

### cultivars

| Field | Meaning |
|---|---|
| id | Stable slug, unique |
| name | English name |
| chineseName | Chinese name, when recorded |
| altNames | Other spellings, semicolon-separated in CSV |
| originCountry, originRegion | Where the cultivar was developed |
| developedYear | Year of development, when recorded |
| parentage | Breeding lineage, e.g. "TRES-2022 x Tainung #80" |
| description, plantType, environment, processing, oxidation, roasting, versatility | Prose fields, drafted from research |
| distribution, expressions, sensory | Nested detail (JSON file only: growing distribution, named expressions, sensory notes) |
| authorshipRung | \`drafted\`, \`reviewed\`, or \`authored\`. See below. |

### regions

| Field | Meaning |
|---|---|
| id | Stable slug, unique |
| name | Region name |
| country | Country |
| province | Province or prefecture, when the name alone is ambiguous |
| altitude, climate | Growing conditions, when recorded |

### teaVarieties

| Field | Meaning |
|---|---|
| id | Stable slug, unique (type and name combined) |
| type | One of the controlled tea types |
| name | Variety name |
| chineseName | Chinese name, when recorded |
| altNames | Other spellings, semicolon-separated in CSV |
| region | Typical origin, when recorded |

### vocabulary

| Field | Meaning |
|---|---|
| axis | Type, Form, Season, or Storage |
| value | The controlled word itself |

## Authorship rungs

Every cultivar entry carries one of three rungs, stated plainly rather than
hidden:

- \`drafted\`: published, sourced, not yet read by a human. This is the
  default, and covers nearly everything in this release.
- \`reviewed\`: read and corrected by a human, with a date.
- \`authored\`: written in a human's own words.

Check \`authorshipRung\` on a cultivar record before treating its description
as verified. An unreviewed entry is not wrong, only unverified.
`
);

console.log(`tea-wisdom.json        cultivars ${cultivars.length}, regions ${regions.length}, teaVarieties ${teaVarieties.length}, vocabulary ${vocabulary.length}`);
console.log(`version ${VERSION}, generated ${GENERATED_AT}`);
console.log(`written to ${outDir}`);
