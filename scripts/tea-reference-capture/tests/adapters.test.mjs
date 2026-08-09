import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { SourceLayoutMismatchError } from '../adapters/html.mjs';
import { extractSpecialistArticle } from '../adapters/specialist-article.mjs';
import { extractTbrsCultivar } from '../adapters/tbrs-cultivar.mjs';

const fixtureDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const readFixture = (name) => fs.readFile(path.join(fixtureDir, name), 'utf8');

const specialistSource = {
  sourceId: 'specialist-yiwu',
  url: 'https://example.test/yiwu',
  publisher: 'Example Specialist',
  publisherRole: 'specialist_editorial',
  language: 'en',
  adapterVersion: '1',
  permittedEntityKinds: ['tea_area'],
  permittedClaimScopes: ['geography', 'processing', 'common_characteristics', 'historical', 'identity'],
};

const tbrsSource = {
  sourceId: 'tbrs-qingxin',
  url: 'https://example.test/qingxin',
  publisher: 'Taiwan Tea and Beverage Research Station',
  publisherRole: 'institute',
  language: 'zh-Hant',
  adapterVersion: '1',
  permittedEntityKinds: ['cultivar'],
  permittedClaimScopes: ['identity', 'cultivar_potential'],
};

test('specialist adapter captures exact paragraphs with held, scoped claims', async () => {
  const packet = extractSpecialistArticle({ source: specialistSource, html: await readFixture('specialist-article.html') });
  assert.equal(packet.metadata.title, 'Yiwu Tea Region');
  assert.equal(packet.metadata.author, 'Example Tea Researcher');
  assert.equal(packet.evidence.length, 3);
  assert.deepEqual(packet.claims.map((claim) => claim.claimScope), ['geography', 'processing', 'common_characteristics']);
  assert.equal(packet.claims.every((claim) => claim.status === 'held'), true);
  for (const evidence of packet.evidence) {
    assert.equal(packet.normalizedText.slice(evidence.start, evidence.end), evidence.exact);
  }
});

test('TBRS adapter captures explicit labelled cultivar fields', async () => {
  const packet = extractTbrsCultivar({ source: tbrsSource, html: await readFixture('tbrs-cultivar.html') });
  assert.equal(packet.metadata.title, '青心烏龍');
  assert.equal(packet.claims.length, 3);
  assert.deepEqual(packet.claims.map((claim) => claim.predicate), ['english_name', 'parentage', 'suitable_styles']);
  assert.deepEqual(packet.claims.map((claim) => claim.claimScope), ['identity', 'identity', 'cultivar_potential']);
});

test('specialist adapter fails closed when the article root disappears', () => {
  assert.throws(
    () => extractSpecialistArticle({ source: specialistSource, html: '<html><h1>Yiwu</h1></html>' }),
    SourceLayoutMismatchError,
  );
});

test('TBRS adapter fails closed when labelled fields disappear', () => {
  assert.throws(
    () => extractTbrsCultivar({ source: tbrsSource, html: '<html><main><h1>青心烏龍</h1></main></html>' }),
    SourceLayoutMismatchError,
  );
});
