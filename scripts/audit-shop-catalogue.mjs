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
  for (const field of ['name', 'public_name', 'publicName', 'title']) {
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
  const fields = category === 'tea'
    ? ['price_per_gram', 'pricePerGram']
    : category === 'set'
      ? ['price', 'set_price']
      : ['price_50g', 'price', 'price_per_unit', 'pricePerUnit'];

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
  return [];
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
  const inputPath = process.argv[2];
  const source = inputPath ? await readFile(inputPath, 'utf8') : await readStdin();
  const products = normalizeCatalogueEnvelope(JSON.parse(source));
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
