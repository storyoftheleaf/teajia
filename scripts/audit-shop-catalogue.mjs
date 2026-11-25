#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const FINDING_CODES = [
  'INVALID_NAME',
  'ZERO_PRICE',
  'PLACEHOLDER_COPY',
  'INCONSISTENT_CASE',
  'UNRESOLVED_SET_ITEM',
  'STALE_AGE_COPY',
];

const PUBLIC_COPY_FIELDS = [
  'name',
  'product_name',
  'public_name',
  'publicName',
  'title',
  'description',
  'shortDescription',
  'experience',
  'lore',
  'processing_notes',
  'terroir',
];

const PLACEHOLDER_COPY = /comments are going to go|lorem ipsum|\b(?:todo|tbd)\b/i;
const NUMBER_WORDS = new Map([
  ['one', 1], ['two', 2], ['three', 3], ['four', 4], ['five', 5],
  ['six', 6], ['seven', 7], ['eight', 8], ['nine', 9], ['ten', 10],
  ['eleven', 11], ['twelve', 12], ['thirteen', 13], ['fourteen', 14],
  ['fifteen', 15], ['sixteen', 16], ['seventeen', 17], ['eighteen', 18],
  ['nineteen', 19], ['twenty', 20],
]);

function publicName(product) {
  for (const field of ['name', 'product_name', 'public_name', 'publicName', 'title']) {
    if (typeof product?.[field] === 'string' && product[field].trim()) return product[field].trim();
  }
  return '';
}

function publicCopy(product) {
  return PUBLIC_COPY_FIELDS
    .map(field => product?.[field])
    .filter(value => typeof value === 'string')
    .join('\n');
}

function priceFor(product) {
  const category = String(product?.category ?? product?.type ?? '').toLowerCase();
  const publicFields = ['fixed_retail_price_usd', 'retail_price_per_gram_usd'];
  const fields = category === 'tea'
    ? ['price_per_gram', 'pricePerGram', ...publicFields]
    : category === 'set'
      ? ['price', 'set_price', ...publicFields]
      : ['price_50g', 'price', 'price_per_unit', 'pricePerUnit', ...publicFields];

  const raw = fields.map(field => product?.[field]).find(value => value !== undefined && value !== null);
  if (typeof raw === 'number') return raw;
  if (typeof raw !== 'string' || !raw.trim()) return 0;
  return Number(raw.replace(/[^\d.-]/g, ''));
}

function hasUnresolvedSetItem(product) {
  if (!Array.isArray(product?.items)) return false;
  return product.items.some(item => {
    if (!item || typeof item !== 'object') return true;
    const id = String(item.itemId ?? item.item_id ?? item.id ?? '').trim();
    const name = String(item.name ?? item.publicName ?? item.public_name ?? '').trim();
    return !name || (id && name === id);
  });
}

function mentionedAge(copy) {
  const match = copy.match(/\b(\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)[ -]year[ -]old\b/i);
  if (!match) return null;
  const normalized = match[1].toLowerCase();
  return NUMBER_WORDS.get(normalized) ?? Number(normalized);
}

function hasStaleAgeCopy(product, copy) {
  const vintage = Number.parseInt(String(product?.year ?? product?.vintage ?? ''), 10);
  const age = mentionedAge(copy);
  if (!Number.isInteger(vintage) || vintage < 1900 || age === null || !Number.isFinite(age)) return false;
  return age !== new Date().getFullYear() - vintage;
}

/** Returns stable, public-safe codes only; it never copies record values into findings. */
export function inspectCatalogueProduct(product) {
  const record = product && typeof product === 'object' ? product : {};
  const name = publicName(record);
  const copy = publicCopy(record);
  const findings = new Set();

  if (!name) findings.add('INVALID_NAME');
  if (!(priceFor(record) > 0)) findings.add('ZERO_PRICE');
  if (PLACEHOLDER_COPY.test(copy)) findings.add('PLACEHOLDER_COPY');
  if (name && /^[^A-Z]*[a-z]/.test(name)) findings.add('INCONSISTENT_CASE');
  if (hasUnresolvedSetItem(record)) findings.add('UNRESOLVED_SET_ITEM');
  if (hasStaleAgeCopy(record, copy)) findings.add('STALE_AGE_COPY');

  return FINDING_CODES.filter(code => findings.has(code));
}

export function normalizeCatalogueEnvelope(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.products)) return value.products;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.data?.products)) return value.data.products;
  if (Array.isArray(value?.data?.items)) return value.data.items;
  throw new Error('No product list in the catalogue response.');
}

function knownText(value) {
  return typeof value === 'string'
    && !['', 'unknown', 'n/a', '-'].includes(value.trim().toLowerCase());
}

function coverage(products) {
  const teaware = products.filter(product => product?.type === 'Teaware'
    || product?.category === 'ware' || knownText(product?.teaware_category));
  const ware = new Set(teaware);
  const teas = products.filter(product => product && !ware.has(product) && product.category !== 'set');
  return {
    products: products.length,
    tea: {
      total: teas.length,
      vintage: teas.filter(tea => /^\d{4}$/.test(String(tea.year ?? tea.vintage ?? '').trim())).length,
      country: teas.filter(tea => knownText(tea.origin_country)).length,
      region: teas.filter(tea => knownText(tea.origin_region)).length,
      multipleOriginLevels: teas.filter(tea => typeof tea.origin_region === 'string'
        && tea.origin_region.split(',').filter(knownText).length > 1).length,
      form: teas.filter(tea => knownText(tea.form)).length,
    },
    teaware: {
      total: teaware.length,
      material: teaware.filter(item => knownText(item.material)).length,
      capacity: teaware.filter(item => Number.isFinite(Number(item.capacity_ml))
        && Number(item.capacity_ml) > 0).length,
    },
  };
}

function reportRows(products) {
  return products.flatMap(product => {
    const findings = inspectCatalogueProduct(product);
    if (findings.length === 0) return [];
    return [{
      id: String(product?.id ?? product?.product_id ?? 'Unknown'),
      name: publicName(product) || 'Unnamed product',
      findings: findings.join(', '),
    }];
  });
}

async function readStdin() {
  process.stdin.setEncoding('utf8');
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return chunks.join('');
}

async function main() {
  const args = process.argv.slice(2);
  const measureCoverage = args.includes('--coverage');
  const inputPath = args.find(arg => arg !== '--coverage');
  const source = inputPath ? await readFile(inputPath, 'utf8') : await readStdin();
  const products = normalizeCatalogueEnvelope(JSON.parse(source));
  if (measureCoverage) {
    console.log(JSON.stringify(coverage(products), null, 2));
    return;
  }
  const rows = reportRows(products);

  if (rows.length === 0) {
    console.log(`Catalogue audit passed (${products.length} products).`);
    return;
  }

  console.table(rows);
  process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(`Catalogue audit failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
