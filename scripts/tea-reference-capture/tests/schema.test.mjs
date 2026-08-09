import test from 'node:test';
import assert from 'node:assert/strict';

import { validateAllowlist } from '../schema.mjs';

const source = {
  sourceId: 'tbrs-qingxin',
  url: 'https://www.tbrs.gov.tw/ws.php?id=4699',
  publisher: 'Taiwan Tea and Beverage Research Station',
  publisherRole: 'institute',
  sourceFamily: 'tbrs-cultivar',
  language: 'zh-Hant',
  accessPolicy: 'allowed',
  adapter: 'tbrs-cultivar',
  adapterVersion: '1',
  permittedEntityKinds: ['cultivar'],
  permittedClaimScopes: ['identity', 'cultivar_potential'],
  rateLimitMs: 1500,
};

test('accepts an allowlisted source with explicit roles and scope', () => {
  const result = validateAllowlist({ schemaVersion: 1, sources: [source] });
  assert.equal(result.sources.length, 1);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.sources[0]), true);
});

test('rejects a batch larger than twelve sources', () => {
  const sources = Array.from({ length: 13 }, (_, i) => ({ ...source, sourceId: `source-${i}` }));
  assert.throws(() => validateAllowlist({ schemaVersion: 1, sources }), /maximum is 12/i);
});

test('rejects duplicate source IDs', () => {
  assert.throws(() => validateAllowlist({ schemaVersion: 1, sources: [source, source] }), /duplicate source id/i);
});

test('rejects non-HTTP source URLs', () => {
  assert.throws(() => validateAllowlist({ schemaVersion: 1, sources: [{ ...source, url: 'file:///tmp/source.html' }] }), /http/i);
});

test('rejects blocked sources', () => {
  assert.throws(() => validateAllowlist({ schemaVersion: 1, sources: [{ ...source, accessPolicy: 'blocked' }] }), /blocked/i);
});

test('rejects undeclared publisher roles', () => {
  assert.throws(() => validateAllowlist({ schemaVersion: 1, sources: [{ ...source, publisherRole: 'sellerish' }] }), /publisher role/i);
});

test('rejects personal tasting as an extractable source scope', () => {
  assert.throws(() => validateAllowlist({ schemaVersion: 1, sources: [{ ...source, permittedClaimScopes: ['personal_tasting'] }] }), /personal tasting/i);
});
