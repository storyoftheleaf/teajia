import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import {
  inspectCatalogueProduct,
  normalizeCatalogueEnvelope,
} from './audit-shop-catalogue.mjs';

const validTea = (overrides = {}) => ({
  id: 'tea-1',
  category: 'tea',
  name: 'Moonlight White',
  year: String(new Date().getFullYear() - 2),
  price_per_gram: '0.25',
  description: 'Soft florals with a clean finish.',
  ...overrides,
});

const validPublicApiTea = {
  id: 'tea-public-1',
  type: 'White',
  product_name: 'Moonlight White',
  year: String(new Date().getFullYear() - 2),
  retail_price_per_gram_usd: 0.25,
  fixed_retail_price_usd: null,
  description: 'Soft florals with a clean finish.',
};

describe('shop catalogue audit', () => {
  it('returns no findings for a valid tea', () => {
    assert.deepEqual(inspectCatalogueProduct(validTea()), []);
  });

  it('accepts the public products API tea shape', () => {
    assert.deepEqual(inspectCatalogueProduct(validPublicApiTea), []);
  });

  it('reports stable public catalogue finding codes', () => {
    assert.deepEqual(inspectCatalogueProduct(validTea({ name: '  ' })), ['INVALID_NAME']);
    assert.deepEqual(inspectCatalogueProduct(validTea({ price_per_gram: '0' })), ['ZERO_PRICE']);
    assert.deepEqual(
      inspectCatalogueProduct(validTea({ description: 'Comments are going to go here.' })),
      ['PLACEHOLDER_COPY'],
    );
    assert.deepEqual(inspectCatalogueProduct(validTea({ name: 'moonlight white' })), ['INCONSISTENT_CASE']);
    assert.deepEqual(
      inspectCatalogueProduct({
        id: 'set-1',
        category: 'set',
        name: 'Quiet Evening Set',
        price: 40,
        items: [{ itemId: 'tea-internal-17' }],
      }),
      ['UNRESOLVED_SET_ITEM'],
    );
    assert.deepEqual(
      inspectCatalogueProduct(validTea({
        year: String(new Date().getFullYear() - 8),
        description: 'A two-year-old tea with settled sweetness.',
      })),
      ['STALE_AGE_COPY'],
    );
  });

  it('never includes private field contents in findings', () => {
    const secret = 'customer-private-token';
    const findings = inspectCatalogueProduct(validTea({
      name: '',
      customer_email: secret,
      secret_notes: secret,
    }));

    assert.deepEqual(findings, ['INVALID_NAME']);
    assert.equal(JSON.stringify(findings).includes(secret), false);
  });

  it('normalizes common array and API object envelopes', () => {
    const products = [validTea()];
    assert.equal(normalizeCatalogueEnvelope(products), products);
    assert.equal(normalizeCatalogueEnvelope({ products }), products);
    assert.equal(normalizeCatalogueEnvelope({ data: products }), products);
    assert.equal(normalizeCatalogueEnvelope({ data: { products } }), products);
  });

  it('reads stdin, exits 2 for findings, and never prints private fields', () => {
    const secret = 'must-not-print';
    const script = fileURLToPath(new URL('./audit-shop-catalogue.mjs', import.meta.url));
    const result = spawnSync(process.execPath, [script], {
      encoding: 'utf8',
      input: JSON.stringify([validTea({ name: '', secret_notes: secret })]),
    });

    assert.equal(result.status, 2);
    assert.match(result.stdout, /INVALID_NAME/);
    assert.equal(result.stdout.includes(secret), false);
    assert.equal(result.stderr, '');
  });
});

describe('catalogue coverage mode', () => {
  it('reports vintage and origin coverage without treating unknowns as facts', () => {
    const script = fileURLToPath(new URL('./audit-shop-catalogue.mjs', import.meta.url));
    const products = [
      { type: 'White', year: '2017', origin_country: 'China', origin_region: 'Fuding, Fujian' },
      { type: 'Oolong', year: 'Unknown', origin_country: 'Taiwan', origin_region: 'Unknown' },
      { type: 'Teaware', teaware_category: 'pot', year: '1980', origin_country: 'China', material: 'Clay', capacity_ml: 180 },
      { type: 'Teaware', teaware_category: 'cup', material: 'Unknown', capacity_ml: 0 },
    ];
    const result = spawnSync(process.execPath, [script, '--coverage'], {
      encoding: 'utf8', input: JSON.stringify({ products }),
    });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {
      products: 4,
      tea: { total: 2, vintage: 1, country: 2, region: 1, multipleOriginLevels: 1, form: 0 },
      teaware: { total: 2, material: 1, capacity: 1 },
    });
  });
});

it('refuses an API error envelope instead of reporting an empty catalogue as healthy', () => {
  const script = fileURLToPath(new URL('./audit-shop-catalogue.mjs', import.meta.url));
  for (const args of [[], ['--coverage']]) {
    const result = spawnSync(process.execPath, [script, ...args], {
      encoding: 'utf8', input: JSON.stringify({ error: 'Upstream unavailable' }),
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /no product list/i);
    assert.equal(result.stdout, '');
  }
});
