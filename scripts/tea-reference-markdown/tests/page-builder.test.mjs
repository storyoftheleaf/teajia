import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  buildRegistry,
  codePointCompare,
  parsePageMarkdown,
  renderGeneratedRegistry,
} from '../lib/page-builder.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const PAGES_DIRECTORY = path.join(REPO_ROOT, 'data', 'tea-reference', 'pages');
const TRANSLATIONS_PATH = path.join(REPO_ROOT, 'data', 'tea-reference', 'private', 'translations.json');

const samplePage = ({
  id = 'sample',
  kind = 'major_region',
  label = 'Sample page',
  nativeName = '',
  parent = 'none',
  visibility = 'public',
  sourceId = 'source-a',
  body,
} = {}) => `---
id: ${id}
slug: ${id}
kind: ${kind}
label: ${label}
${nativeName ? `native_name: ${nativeName}\n` : ''}parent: ${parent}
visibility: ${visibility}
source_ids:
  - ${sourceId}
---

## Overview {#overview}

${body ?? `This is clear English reference prose. [cite:${sourceId}]`}
`;

const sampleProvenance = ({
  sourceId = 'source-a',
  language = 'en',
  contentShape = 'reference',
  pageId = 'sample',
  exact = '',
} = {}) => {
  const original = exact || '原始证据。';
  const evidenceId = `EVIDENCE-${sourceId.toUpperCase()}`;
  return ({
  schema_version: 1,
  sources: [{
    source_id: sourceId,
    source_language: language,
    content_shape: contentShape,
    public: {
      publisher: 'Tea Institute',
      publisher_role_label: 'Institute',
      title: 'An English source title',
      author: 'A. Writer',
      published_date: '2026-08-10',
      url: 'https://example.com/reference',
    },
    original_title: language === 'zh' ? '原始标题' : 'An English source title',
    evidence: [{
      evidence_id: evidenceId,
      locator: { heading: '', section: '', page: null, start: 0, end: 10 },
      excerpt_sha256: language === 'zh'
        ? crypto.createHash('sha256').update(original).digest('hex')
        : 'a'.repeat(64),
      uses: [{ page_id: pageId, section_key: 'overview' }],
    }],
  }],
  translations: language === 'zh' ? [{
    evidence_id: evidenceId,
    source_id: sourceId,
    locator: { heading: '', section: '', page: null, start: 0, end: 10 },
    original,
    english: 'English translation of the source evidence.',
    method: 'machine_translation',
    translator: 'OpenAI Codex',
    version: 'GPT-5',
    translated_date: '2026-08-10',
  }] : [],
  });
};

async function temporaryRegistry(pageText, provenance = sampleProvenance()) {
  return temporaryRegistryPages([{ fileName: 'page.md', text: pageText }], provenance);
}

async function temporaryRegistryPages(pageFiles, provenance) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tea-reference-pages-'));
  const pagesDirectory = path.join(root, 'pages');
  await fs.mkdir(pagesDirectory);
  await Promise.all(pageFiles.map(page => fs.writeFile(path.join(pagesDirectory, page.fileName), page.text)));
  const translationsPath = path.join(root, 'translations.json');
  await fs.writeFile(translationsPath, `${JSON.stringify(provenance)}\n`);
  return buildRegistry({ pagesDirectory, translationsPath });
}

test('parses the fixed front matter, real section keys, and compact source citations', () => {
  const page = parsePageMarkdown(samplePage({ nativeName: '普洱茶' }), 'sample.md');

  assert.deepEqual(page, {
    id: 'sample',
    slug: 'sample',
    kind: 'major_region',
    label: 'Sample page',
    visibility: 'public',
    nativeName: '普洱茶',
    parentId: undefined,
    sourceIds: ['source-a'],
    sections: [{
      key: 'overview',
      label: 'Overview',
      text: 'This is clear English reference prose.',
      sourceIds: ['source-a'],
    }],
  });
});

test('rejects malformed or unsupported citation markers instead of leaking them into public prose', () => {
  const malformedMarkers = [
    '[cite:BAD_ID]',
    '[CITE:source-a]',
    '[cite : source-a]',
    '[citation:source-a]',
    '[cite:source-a',
  ];

  for (const marker of malformedMarkers) {
    assert.throws(
      () => parsePageMarkdown(samplePage({
        body: `This is clear English reference prose. [cite:source-a] ${marker} This must not be public.`,
      }), 'malformed-citation.md'),
      /malformed or unsupported citation marker/i,
      marker,
    );
  }
});

test('rejects Han-script public prose while allowing explicit native-name metadata and private translations', async () => {
  assert.throws(
    () => parsePageMarkdown(samplePage({ body: '这是不得公开的中文正文。 [cite:source-a]' }), 'han.md'),
    /Han-script.*public prose/i,
  );

  const registry = await temporaryRegistry(
    samplePage({ nativeName: '普洱茶' }),
    sampleProvenance({ language: 'zh', exact: '完整的原文证据。' }),
  );
  assert.equal(registry.pages[0].nativeName, '普洱茶');
});

test('resolves every public citation to private provenance without exposing evidence or translation metadata', async () => {
  const registry = await temporaryRegistry(
    samplePage(),
    sampleProvenance(),
  );
  const publicJson = JSON.stringify(registry);

  assert.deepEqual(registry.pages[0].sections[0].sourceIds, ['source-a']);
  assert.deepEqual(registry.sources.map(source => source.sourceId), ['source-a']);
  assert.doesNotMatch(
    publicJson,
    /EVIDENCE-|excerpt_sha256|original_title|source_language|content_shape|locator|translation|machine_translation|OpenAI Codex|GPT-5/i,
  );
});

test('rejects a translation whose source does not own its evidence record', async () => {
  const provenance = sampleProvenance({ language: 'zh' });
  provenance.sources.push(sampleProvenance({ sourceId: 'source-b' }).sources[0]);
  provenance.translations[0].source_id = 'source-b';

  await assert.rejects(
    temporaryRegistry(samplePage(), provenance),
    /translation source.*does not own.*evidence/i,
  );
});

test('orders files and nested IDs by Unicode code point and renders byte-identical output', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tea-reference-order-'));
  const pagesDirectory = path.join(root, 'pages');
  await fs.mkdir(pagesDirectory);
  await fs.writeFile(path.join(pagesDirectory, 'a.md'), samplePage({ id: 'a-page', sourceId: 'a-source' }));
  await fs.writeFile(path.join(pagesDirectory, 'z.md'), samplePage({ id: 'z-page', sourceId: 'z-source' }));
  const provenance = {
    schema_version: 1,
    sources: [
      ...sampleProvenance({ sourceId: 'a-source', pageId: 'a-page' }).sources,
      ...sampleProvenance({ sourceId: 'z-source', pageId: 'z-page' }).sources,
    ],
    translations: [],
  };
  const translationsPath = path.join(root, 'translations.json');
  await fs.writeFile(translationsPath, JSON.stringify(provenance));

  const first = await buildRegistry({ pagesDirectory, translationsPath });
  const second = await buildRegistry({ pagesDirectory, translationsPath });
  assert.deepEqual(first.pages.map(page => page.id), ['a-page', 'z-page']);
  assert.deepEqual(first.sources.map(source => source.sourceId), ['a-source', 'z-source']);
  assert.deepEqual(['a', 'Z', '\u{10000}', '\u{E000}'].sort(codePointCompare), [
    'Z',
    'a',
    '\u{E000}',
    '\u{10000}',
  ]);
  assert.equal(renderGeneratedRegistry(first), renderGeneratedRegistry(second));
});

test('rejects route, list, and grouping research when it is modelled as a geographic place', async () => {
  for (const contentShape of ['route', 'list', 'grouping']) {
    await assert.rejects(
      temporaryRegistry(
        samplePage({ kind: 'major_region' }),
        sampleProvenance({ contentShape }),
      ),
      new RegExp(`${contentShape}.*reference_topic`, 'i'),
    );
  }
});

test('rejects multi-node page hierarchy cycles', async () => {
  const provenance = sampleProvenance();
  provenance.sources[0].evidence[0].uses = [
    { page_id: 'area-a', section_key: 'overview' },
    { page_id: 'area-b', section_key: 'overview' },
  ];

  await assert.rejects(
    temporaryRegistryPages([
      { fileName: 'a.md', text: samplePage({ id: 'area-a', kind: 'tea_area', parent: 'area-b' }) },
      { fileName: 'b.md', text: samplePage({ id: 'area-b', kind: 'tea_area', parent: 'area-a' }) },
    ], provenance),
    /hierarchy cycle.*area-a.*area-b/i,
  );
});

test('rejects invalid public parent-kind relationships', async () => {
  const cases = [
    {
      child: samplePage({ id: 'type-child', kind: 'tea_type', parent: 'region-parent' }),
      parent: samplePage({ id: 'region-parent', kind: 'major_region' }),
      expected: /tea_type.*tea_family/i,
    },
    {
      child: samplePage({ id: 'area-child', kind: 'tea_area', parent: 'family-parent' }),
      parent: samplePage({ id: 'family-parent', kind: 'tea_family' }),
      expected: /tea_area.*major_region.*tea_area/i,
    },
    {
      child: samplePage({ id: 'family-child', kind: 'tea_family', parent: 'family-parent' }),
      parent: samplePage({ id: 'family-parent', kind: 'tea_family' }),
      expected: /tea_family.*root/i,
    },
  ];

  for (const candidate of cases) {
    const provenance = sampleProvenance();
    provenance.sources[0].evidence[0].uses = [
      { page_id: /id: ([^\n]+)/.exec(candidate.child)[1], section_key: 'overview' },
      { page_id: /id: ([^\n]+)/.exec(candidate.parent)[1], section_key: 'overview' },
    ];
    await assert.rejects(
      temporaryRegistryPages([
        { fileName: 'child.md', text: candidate.child },
        { fileName: 'parent.md', text: candidate.parent },
      ], provenance),
      candidate.expected,
    );
  }
});

test('validates nine canonical Markdown files but generates only the six safely routable pages', async () => {
  const registry = await buildRegistry({
    pagesDirectory: PAGES_DIRECTORY,
    translationsPath: TRANSLATIONS_PATH,
  });

  const markdownFiles = (await fs.readdir(PAGES_DIRECTORY)).filter(fileName => fileName.endsWith('.md'));
  assert.equal(markdownFiles.length, 9);
  assert.deepEqual(registry.pages.map(page => page.id), [
    'greater-yiwu',
    'lincang',
    'menghai-county',
    'puer',
    'sheng',
    'yunnan',
  ]);
  assert.ok(registry.pages.every(page => ['tea_family', 'tea_type', 'major_region', 'tea_area'].includes(page.kind)));
  assert.doesNotMatch(JSON.stringify(registry), /reference_topic|mountain-circuit|mountain-names|xishuangbanna-tea-mountains/i);
  const publicPageIds = new Set(registry.pages.map(page => page.id));
  for (const heldId of [
    'sheng-and-shou-puer',
    'puer-geographic-hierarchy',
    'puer-village-naming',
    'oolong',
    'dark',
    'red',
    'white',
  ]) {
    assert.equal(publicPageIds.has(heldId), false, `${heldId} must remain excluded`);
  }
  assert.ok(registry.pages.every(page => !['taxonomy_term', 'exact_lot', 'personal_tasting'].includes(page.kind)));
});

test('keeps route, list, and grouping research as validated non-public Markdown drafts', async () => {
  for (const fileName of [
    'menghai-tea-mountain-circuit.md',
    'xishuangbanna-tea-mountains.md',
    'yunnan-mountain-names.md',
  ]) {
    const page = parsePageMarkdown(await fs.readFile(path.join(PAGES_DIRECTORY, fileName), 'utf8'), fileName);
    assert.equal(page.kind, 'reference_topic');
    assert.equal(page.visibility, 'draft');
  }
});

test('keeps translation provenance complete and private for every cited Chinese evidence record', async () => {
  const document = JSON.parse(await fs.readFile(TRANSLATIONS_PATH, 'utf8'));
  const translatedByEvidence = new Map(document.translations.map(record => [record.evidence_id, record]));

  for (const source of document.sources.filter(candidate => candidate.source_language === 'zh')) {
    for (const evidence of source.evidence) {
      const translation = translatedByEvidence.get(evidence.evidence_id);
      assert.ok(translation, `${evidence.evidence_id} needs a translation record`);
      assert.match(translation.original, /\p{Script=Han}/u);
      assert.doesNotMatch(translation.english, /\p{Script=Han}/u);
      assert.equal(translation.source_id, source.source_id);
      assert.deepEqual(translation.locator, evidence.locator);
      for (const field of ['method', 'translator', 'version', 'translated_date']) {
        assert.ok(translation[field], `${evidence.evidence_id} needs ${field}`);
      }
    }
  }
});
