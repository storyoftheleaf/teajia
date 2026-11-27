import assert from 'node:assert/strict';
import test from 'node:test';
import { mayPublish, publishedMarkdown, sectionClaimIds } from '../lib/review.mjs';

const page = (visibility) => `---\nid: naka\nkind: tea_area\nvisibility: ${visibility}\n---\n\n## Where it is {#where}\n\nText.\n\n## Known for {#known-for}\n\nText.\n`;
const claim = (key, status, origins = ['approved']) => ({ claim_id: `naka:${key}`, status, revisions: origins.map((origin, index) => ({ rev: index + 1, origin })) });

test('a draft page with every section approved may go public', () => {
  assert.deepEqual(sectionClaimIds('naka', page('draft')), ['naka:where', 'naka:known-for']);
  assert.equal(mayPublish('naka', page('draft'), [claim('where', 'approved'), claim('known-for', 'approved')]), true);
  assert.match(publishedMarkdown(page('draft')), /^visibility: public$/m);
});

test('one section still in draft keeps the page draft', () => {
  assert.equal(mayPublish('naka', page('draft'), [claim('where', 'approved'), claim('known-for', 'draft')]), false);
});

test('a legacy-import revision anywhere in the history keeps the page draft', () => {
  assert.equal(mayPublish('naka', page('draft'), [claim('where', 'approved', ['legacy_import', 'approved']), claim('known-for', 'approved')]), false);
});

test('a page that is already public is left alone', () => {
  assert.equal(mayPublish('naka', page('public'), [claim('where', 'approved'), claim('known-for', 'approved')]), false);
});
