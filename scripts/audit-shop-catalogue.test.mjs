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

describe('shop catalogue audit', () => {
  it('returns no findings for a valid tea', () => {
    assert.deepEqual(inspectCatalogueProduct(validTea()), []);
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
