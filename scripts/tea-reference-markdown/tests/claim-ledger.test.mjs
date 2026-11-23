import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { applyClaimCommand, parseMarksCsv } from '../lib/claim-commands.mjs';
import { buildRegistry, buildWisdom, loadSourcePages } from '../lib/page-builder.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const page = ({ id, kind = 'major_region', parent = 'none', visibility = 'public', sourceId = 'source-a', sections }) => `---
id: ${id}
slug: ${id}
kind: ${kind}
label: ${id} label
parent: ${parent}
visibility: ${visibility}
source_ids:
  - ${sourceId}
---
${sections.map(([key, text]) => `
## ${key} heading {#${key}}

${text} [cite:${sourceId}]
`).join('')}`;

function provenance(uses, sourceId = 'source-a') {
  return {
    schema_version: 1,
    sources: [{
      source_id: sourceId,
      source_language: 'en',
      content_shape: 'reference',
      public: { publisher: 'Publisher', publisher_role_label: 'Specialist', title: 'Title', url: 'https://example.com/a' },
      evidence: [{
        evidence_id: 'EVIDENCE-A',
        locator: { heading: '', section: '', page: null, start: 0, end: 10 },
        excerpt_sha256: crypto.createHash('sha256').update('x').digest('hex'),
        uses: uses.map(([pageId, key]) => ({ page_id: pageId, section_key: key })),
      }],
    }],
    translations: [],
  };
}

const revision = (rev, text, extra = {}) => ({
  rev, origin: 'approved', scope: 'Scope', text, approved_at: '2026-11-23', reason: 'Reason', evidence_ids: ['EVIDENCE-A'], ...extra,
});

const claim = (claimId, extra = {}) => ({
  claim_id: claimId,
  axis: 'place',
  listing_eligible: false,
  applies_when: {},
  attribution: null,
  terms: [],
  status: 'approved',
  current_rev: 1,
  revisions: [revision(1, 'Approved text.')],
  withdrawn: null,
  ...extra,
});

async function fixture({ pages, uses, claims }) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'claims-'));
  const pagesDirectory = path.join(directory, 'pages');
  await fs.mkdir(pagesDirectory);
  for (const [name, markdown] of Object.entries(pages)) await fs.writeFile(path.join(pagesDirectory, `${name}.md`), markdown);
  const translationsPath = path.join(directory, 'translations.json');
  await fs.writeFile(translationsPath, JSON.stringify(provenance(uses)));
  const claimsPath = path.join(directory, 'claims.json');
  await fs.writeFile(claimsPath, JSON.stringify({ schema_version: 1, claims }));
  return { pagesDirectory, translationsPath, claimsPath };
}

test('the real ledger reproduces the committed public registry and keeps drafts out', async () => {
  const paths = {
    pagesDirectory: path.join(REPO_ROOT, 'data', 'tea-reference', 'pages'),
    translationsPath: path.join(REPO_ROOT, 'data', 'tea-reference', 'private', 'translations.json'),
  };
  const generated = await fs.readFile(path.join(REPO_ROOT, 'src', 'wisdom', 'reference', 'generatedPages.ts'), 'utf8');
  const committed = JSON.parse(generated.slice(generated.indexOf('= {') + 2, generated.indexOf(' as const')));
  const built = await buildWisdom({ ...paths, claimsPath: path.join(REPO_ROOT, 'data', 'tea-reference', 'claims.json') });
  assert.deepEqual(JSON.parse(JSON.stringify(built.registry)), committed);
  // Draft claims added to a public page (e.g. Menghai's Mengsong section) stay out of the public registry.
  assert.ok(!JSON.stringify(built.registry).includes('Naka is a Lahu village'));
});

test('an edit in Markdown stays pending: public keeps the approved text, preview shows both', async () => {
  const paths = await fixture({
    pages: { alpha: page({ id: 'alpha', sections: [['overview', 'Edited proposal text.']] }) },
    uses: [['alpha', 'overview']],
    claims: [claim('alpha:overview')],
  });
  const built = await buildWisdom(paths);
  assert.equal(built.registry.pages[0].sections[0].text, 'Approved text.');
  assert.equal(built.claims[0].text, 'Approved text.');
  assert.equal(built.claims[0].reviewState, 'approved');
  const draft = built.draftClaims[0];
  assert.equal(draft.reviewState, 'pending');
  assert.equal(draft.pendingText, 'Edited proposal text.');
});

test('text equal to an older revision still counts as pending', async () => {
  const paths = await fixture({
    pages: { alpha: page({ id: 'alpha', sections: [['overview', 'First text.']] }) },
    uses: [['alpha', 'overview']],
    claims: [claim('alpha:overview', { current_rev: 2, revisions: [revision(1, 'First text.'), revision(2, 'Second text.')] })],
  });
  const built = await buildWisdom(paths);
  assert.equal(built.draftClaims[0].reviewState, 'pending');
  assert.equal(built.claims[0].text, 'Second text.');
});

test('draft pages and draft claims never reach the public outputs', async () => {
  const paths = await fixture({
    pages: {
      alpha: page({ id: 'alpha', sections: [['overview', 'Approved text.'], ['newer', 'A new draft section.']] }),
      beta: page({ id: 'beta', visibility: 'draft', sections: [['overview', 'Draft page prose.']] }),
    },
    uses: [['alpha', 'overview'], ['alpha', 'newer'], ['beta', 'overview']],
    claims: [
      claim('alpha:overview'),
      claim('alpha:newer', { status: 'draft', current_rev: null, revisions: [] }),
      claim('beta:overview', { status: 'draft', current_rev: null, revisions: [] }),
    ],
  });
  const built = await buildWisdom(paths);
  const publicText = JSON.stringify([built.registry, built.claims]);
  assert.ok(!publicText.includes('A new draft section'));
  assert.ok(!publicText.includes('Draft page prose'));
  assert.deepEqual(built.registry.pages.map(item => item.id), ['alpha']);
  assert.deepEqual(built.registry.pages[0].sections.map(item => item.key), ['overview']);
  assert.equal(built.draftClaims.find(item => item.claimId === 'beta:overview').pendingText, 'Draft page prose.');
});

test('a withdrawn claim leaves the public outputs and a page with nothing approved disappears', async () => {
  const paths = await fixture({
    pages: { alpha: page({ id: 'alpha', sections: [['overview', 'Approved text.']] }) },
    uses: [['alpha', 'overview']],
    claims: [claim('alpha:overview', { status: 'withdrawn', withdrawn: { at: '2026-11-24', reason: 'Source corrected' } })],
  });
  const built = await buildWisdom(paths);
  assert.equal(built.claims.length, 0);
  assert.equal(built.registry.pages.length, 0);
  assert.equal(built.draftClaims[0].reviewState, 'withdrawn');
});

test('the ledger and Markdown must agree on which claims exist', async () => {
  const missingEntry = await fixture({
    pages: { alpha: page({ id: 'alpha', sections: [['overview', 'Approved text.']] }) },
    uses: [['alpha', 'overview']],
    claims: [],
  });
  await assert.rejects(buildWisdom(missingEntry), /alpha:overview has no claims\.json entry/);
  const orphan = await fixture({
    pages: { alpha: page({ id: 'alpha', sections: [['overview', 'Approved text.']] }) },
    uses: [['alpha', 'overview']],
    claims: [claim('alpha:overview'), claim('alpha:gone', { status: 'draft', current_rev: null, revisions: [] })],
  });
  await assert.rejects(buildWisdom(orphan), /alpha:gone: its Markdown section no longer exists/);
});

test('claim metadata rules are enforced', async () => {
  const base = {
    pages: { alpha: page({ id: 'alpha', sections: [['overview', 'Approved text.']] }) },
    uses: [['alpha', 'overview']],
  };
  const cases = [
    [{ axis: 'sensory_observation', listing_eligible: true }, /never listing-eligible/],
    [{ attribution: { source_id: 'source-a', source_role: 'study', sample: 'Sample' } }, /only for sensory_observation/],
    [{ axis: 'maker_history', listing_eligible: true }, /never listing-eligible/],
    [{ applies_when: { name_includes: ['naka'] } }, /only valid together with origin_includes/],
    [{ terms: [{ original: 'gongting', pinyin: 'gōngtíng', gloss: 'palace' }] }, /must contain Han script/],
    [{ revisions: [revision(1, '宫廷 grade.')] }, /must not contain Han script/],
    [{ revisions: [revision(1, 'Text.', { evidence_ids: [] })] }, /needs evidence_ids/],
    [{ revisions: [revision(1, 'Text.', { origin: 'legacy_import', legacy_ref: 'marks:x', evidence_ids: [] })] }, /only allowed on draft pages/],
  ];
  for (const [extra, pattern] of cases) {
    const paths = await fixture({ ...base, claims: [claim('alpha:overview', extra)] });
    await assert.rejects(buildWisdom(paths), pattern);
  }
});

test('a named-tea history must identify its own named tea, even when it also specifies a tea type', async () => {
  const base = {
    pages: { alpha: page({ id: 'alpha', kind: 'named_tea', sections: [['history', 'Approved text.']] }) },
    uses: [['alpha', 'history']],
  };
  for (const applies_when of [{ type: 'Shou' }, { named_tea: 'beta', type: 'Shou' }]) {
    const paths = await fixture({ ...base, claims: [claim('alpha:history', { axis: 'named_tea_history', applies_when })] });
    await assert.rejects(buildWisdom(paths), /matched to its own named tea/);
  }
});

test('leaf_grade pages need a tea_type parent and may be drafts with research still pending', async () => {
  const markdown = {
    family: page({ id: 'family', kind: 'tea_family', sections: [['overview', 'Approved text.']] }),
    shou: page({ id: 'shou', kind: 'tea_type', parent: 'family', sections: [['overview', 'Approved text.']] }),
    grade: page({ id: 'grade', kind: 'leaf_grade', parent: 'shou', visibility: 'draft', sourceId: 'not-captured-yet', sections: [['definition', 'A draft grade definition.']] }),
  };
  const paths = await fixture({
    pages: markdown,
    uses: [['family', 'overview'], ['shou', 'overview']],
    claims: [claim('family:overview'), claim('shou:overview'), claim('grade:definition', { axis: 'grade', status: 'draft', current_rev: null, revisions: [] })],
  });
  const built = await buildWisdom(paths);
  const draft = built.draftClaims.find(item => item.claimId === 'grade:definition');
  assert.deepEqual(draft.unresolvedSourceIds, ['not-captured-yet']);
  const orphanGrade = await fixture({
    pages: { ...markdown, grade: page({ id: 'grade', kind: 'leaf_grade', parent: 'family', visibility: 'draft', sections: [['definition', 'A draft grade definition.']] }) },
    uses: [['family', 'overview'], ['shou', 'overview'], ['grade', 'definition']],
    claims: [claim('family:overview'), claim('shou:overview'), claim('grade:definition', { status: 'draft', current_rev: null, revisions: [] })],
  });
  await assert.rejects(buildWisdom(orphanGrade), /leaf_grade grade must have a tea_type parent/);
});

test('approve, withdraw and import-legacy produce valid revisions', async () => {
  const paths = await fixture({
    pages: {
      family: page({ id: 'family', kind: 'tea_family', sections: [['overview', 'Approved text.']] }),
      shou: page({ id: 'shou', kind: 'tea_type', parent: 'family', sections: [['overview', 'Approved text.']] }),
      grade: page({ id: 'grade', kind: 'leaf_grade', parent: 'shou', visibility: 'draft', sections: [['definition', 'A bud-rich grade of loose ripe pu’er in the standard.']] }),
    },
    uses: [['family', 'overview'], ['shou', 'overview'], ['grade', 'definition']],
    claims: [claim('family:overview'), claim('shou:overview'), claim('grade:definition', { axis: 'grade', listing_eligible: true, applies_when: { grade: 'grade' }, status: 'draft', current_rev: null, revisions: [] })],
  });
  const { sourcePages, document } = await loadSourcePages(paths);
  let ledger = JSON.parse(await fs.readFile(paths.claimsPath, 'utf8'));
  const legacyMarks = parseMarksCsv('"id","name","chinese_name","alt_names","producer","era","applies_to_types","description"\n"grade","Grade","宫廷","","","","Shou","The highest grade, per the legacy corpus."\n');
  const run = (command, options) => {
    ledger = applyClaimCommand({ ledger, sourcePages, provenance: document, command, claimId: 'grade:definition', options, today: '2026-11-24', legacyMarks });
    return ledger.claims.find(item => item.claim_id === 'grade:definition');
  };
  let entry = run('import-legacy', { from: 'marks:grade', scope: 'General grade designation' });
  assert.equal(entry.current_rev, 1);
  assert.equal(entry.revisions[0].origin, 'legacy_import');
  entry = run('approve', { reason: 'Scoped to the loose-tea table', scope: 'Loose ripe pu’er, T/MHC 003–2020' });
  assert.equal(entry.current_rev, 2);
  assert.deepEqual(entry.revisions[1].evidence_ids, ['EVIDENCE-A']);
  assert.throws(() => run('approve', { reason: 'Again' }), /nothing to approve/);
  entry = run('withdraw', { reason: 'Test withdrawal' });
  assert.equal(entry.status, 'withdrawn');
  assert.equal(entry.current_rev, 2);
});

test('trade knowledge is written in our own words with no citation or evidence', async () => {
  const uncited = `---
id: alpha
slug: alpha
kind: major_region
label: alpha label
parent: none
visibility: public
---

## Overview {#overview}

Ripe pu’er is fermented in a damp pile before drying.
`;
  const sourcedPaths = await fixture({ pages: { alpha: uncited }, uses: [['unrelated', 'section']], claims: [claim('alpha:overview', { revisions: [revision(1, 'Ripe pu’er is fermented in a damp pile before drying.')] })] });
  await assert.rejects(buildWisdom(sourcedPaths), /sourced claim needs at least one \[cite:\] marker|does not list this claim/);
  const knowledgePaths = await fixture({
    pages: { alpha: uncited },
    uses: [['unrelated', 'section']],
    claims: [claim('alpha:overview', { basis: 'trade_knowledge', revisions: [revision(1, 'Ripe pu’er is fermented in a damp pile before drying.', { evidence_ids: [] })] })],
  });
  const built = await buildWisdom(knowledgePaths);
  assert.equal(built.claims[0].basis, 'trade_knowledge');
  assert.deepEqual(built.claims[0].sourceIds, []);
  assert.equal(built.registry.pages[0].sections[0].text, 'Ripe pu’er is fermented in a damp pile before drying.');
});
