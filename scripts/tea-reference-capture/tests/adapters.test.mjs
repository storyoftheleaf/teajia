import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { SourceLayoutMismatchError } from '../adapters/html.mjs';
import { extractJournalAbstract } from '../adapters/journal-abstract.mjs';
import { extractMoaPrintArticle } from '../adapters/moa-print-article.mjs';
import { extractSpecialistArticle } from '../adapters/specialist-article.mjs';
import { extractTbrsCultivar } from '../adapters/tbrs-cultivar.mjs';
import { extractVietnamGiArticle } from '../adapters/vietnam-gi-article.mjs';

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

const journalSource = {
  sourceId: 'journal-puer-study',
  url: 'https://example.test/study',
  publisher: 'Journal of Tea Science',
  publisherRole: 'academic',
  language: 'zh-Hans',
  adapterVersion: '1',
  permittedEntityKinds: ['tea_family'],
  permittedClaimScopes: ['common_characteristics'],
};

const moaSource = {
  sourceId: 'moa-ttes-24',
  url: 'https://example.test/ttes-24',
  publisher: 'Taiwan Ministry of Agriculture',
  publisherRole: 'institute',
  language: 'zh-Hant',
  adapterVersion: '1',
  permittedEntityKinds: ['cultivar'],
  permittedClaimScopes: ['identity', 'cultivar_potential', 'historical'],
};

const vietnamSource = {
  sourceId: 'ipvn-tua-chua',
  url: 'https://example.test/tua-chua',
  publisher: 'Intellectual Property Office of Vietnam',
  publisherRole: 'registry',
  language: 'en',
  adapterVersion: '1',
  permittedEntityKinds: ['tea_area'],
  permittedClaimScopes: ['legal', 'identity', 'geography', 'common_characteristics', 'processing'],
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

test('specialist adapter accepts a bounded WordPress article body', () => {
  const html = `<html><head><title>Yunnan Overview</title></head><body><main>
    <h1 class="wp-block-post-title">Pu’erh Regions: Yunnan Overview</h1>
    <div class="wp-block-post-author-name"><a>James</a></div><time datetime="2014-11-20">November 20</time>
    <div class="entry-content wp-block-post-content"><h3>Why Region is Important</h3>
    <p>Geography in the form of subregion, mountain, or village frequently matters.</p>
    <h3>A Brief History</h3><p>The Yiwu region supplied material during an earlier period.</p></div>
    <div class="wp-block-post-comments"><p>This comment must not be captured.</p></div></main></body></html>`;
  const packet = extractSpecialistArticle({ source: specialistSource, html });
  assert.equal(packet.metadata.title, 'Pu’erh Regions: Yunnan Overview');
  assert.equal(packet.metadata.author, 'James');
  assert.equal(packet.evidence.length, 2);
  assert.deepEqual(packet.claims.map(({ claimScope }) => claimScope), ['geography', 'historical']);
  assert.doesNotMatch(packet.normalizedText, /comment must not/i);
});

test('TBRS adapter fails closed when labelled fields disappear', () => {
  assert.throws(
    () => extractTbrsCultivar({ source: tbrsSource, html: '<html><main><h1>青心烏龍</h1></main></html>' }),
    SourceLayoutMismatchError,
  );
});

test('TBRS adapter accepts the live labelled-paragraph layout', () => {
  const html = `<html><head><title>臺茶12號(茶及飲料作物改良場)</title></head><body>
    <h3 class="detail_titles">臺茶12號</h3><div class="detail_txt">
    <p>茶樹品種名稱：臺茶12號</p><p>Cultivar Name：TTES No. 12</p>
    <p>品種概述：<br>又名金萱，父本硬枝紅心，母本臺農 8 號，適製烏龍茶、包種茶。</p></div></body></html>`;
  const packet = extractTbrsCultivar({ source: tbrsSource, html });
  assert.equal(packet.metadata.title, '臺茶12號');
  assert.deepEqual(packet.claims.map(({ predicate }) => predicate), ['native_name', 'english_name', 'common_characteristics']);
});

test('journal adapter captures only the exact study abstract and keeps it held', async () => {
  const packet = extractJournalAbstract({ source: journalSource, html: await readFixture('journal-abstract.html') });
  assert.equal(packet.metadata.title, '普洱茶产地研究');
  assert.equal(packet.metadata.author, '刘一, 陈二');
  assert.equal(packet.metadata.doi, '10.1000/example');
  assert.equal(packet.claims.length, 1);
  assert.equal(packet.claims[0].predicate, 'study_abstract');
  assert.equal(packet.claims[0].status, 'held');
  assert.match(packet.claims[0].uncertaintyReason, /study/i);
  assert.doesNotMatch(packet.normalizedText, /navigation/i);
});

test('MOA print adapter captures only the bounded article paragraphs', async () => {
  const packet = extractMoaPrintArticle({ source: moaSource, html: await readFixture('moa-print-article.html') });
  assert.equal(packet.metadata.title, '臺茶24號');
  assert.equal(packet.metadata.publishedDate, '108/08/06');
  assert.equal(packet.claims.length, 2);
  assert.equal(packet.claims.every(({ status }) => status === 'held'), true);
  assert.deepEqual(packet.claims.map(({ claimScope }) => claimScope), ['identity', 'cultivar_potential']);
  assert.doesNotMatch(packet.normalizedText, /footer/i);
});

test('Vietnam GI adapter captures the legal summary and article but skips captions and translator lines', async () => {
  const packet = extractVietnamGiArticle({ source: vietnamSource, html: await readFixture('vietnam-gi-article.html') });
  assert.equal(packet.metadata.title, 'Tua Chua Shan tea and raw Shan Pu-erh tea');
  assert.equal(packet.metadata.publishedDate, '23/12/2025');
  assert.equal(packet.claims.length, 3);
  assert.deepEqual(packet.claims.map(({ claimScope }) => claimScope), ['legal', 'identity', 'geography']);
  assert.equal(packet.claims.every(({ status }) => status === 'held'), true);
  assert.doesNotMatch(packet.normalizedText, /Figure|Translator|related-news/i);
});

test('new adapters fail closed when their bounded content disappears', () => {
  assert.throws(() => extractJournalAbstract({ source: journalSource, html: '<html><title>Study</title></html>' }), SourceLayoutMismatchError);
  assert.throws(() => extractMoaPrintArticle({ source: moaSource, html: '<html><h1>Tea</h1></html>' }), SourceLayoutMismatchError);
  assert.throws(() => extractVietnamGiArticle({ source: vietnamSource, html: '<html><h1>GI</h1></html>' }), SourceLayoutMismatchError);
});
