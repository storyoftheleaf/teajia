import test from 'node:test';
import assert from 'node:assert/strict';
import { main, reviewCurateInventory } from './curate-inventory-review.mjs';
const xwt = '9fde5545-58f8-4c1f-9182-9e4d0b804d85';
const row = (id, extra = {}) => ({ id, account_id: 'a', ...extra });
const fixture = () => ({
  tea_compass_entries: [row(xwt, { user_id: 'u1', sample_state: 'requested', vendor_name: 'Vendor' }), row('other-owner', { user_id: 'u2', sample_state: 'received' }), row('foreign', { account_id: 'b', user_id: 'u1', sample_state: 'requested' })],
  tea_sample_sets: [row('empty', { name: '' }), row('set', { name: 'Batch', archived: false }), row('old', { archived: true })],
  tea_samples: [row('one', { set_id: 'set', product_id: 'p1', name: 'Tea', source_name: 'Vendor' }), row('two', { set_id: 'old', product_id: 'p1', name: 'Tea' }), row('three', { set_id: 'set', name: 'Unlinked' }), row('four', { set_id: 'set', name: 'Unlinked' })],
  customers: [row('v1', { name: 'Vendor', tags: '["vendor"]' }), row('customer', { name: 'Vendor', tags: '[]' })],
  products: [row('p1', { name: 'Tea', vendor: 'Vendor' })],
});

test('report is scoped, read-only and does not confuse contacts with vendors', () => {
  const data = fixture();
  const before = JSON.stringify(data);
  const report = reviewCurateInventory(data, { account: 'a' });
  assert.equal(JSON.stringify(data), before);
  assert.equal(report.mode, 'review_only');
  assert.equal(report.selected_counts.entries, 2);
  assert.deepEqual(report.curate_owners_in_account, { u1: 1, u2: 1 });
  assert.equal(report.empty_unnamed_sets.length, 1);
  assert.equal(report.repeated_sample_identities.find((group) => group.identity === 'product:p1').ambiguous, false);
  assert.equal(report.repeated_sample_identities.find((group) => group.identity === 'name:unlinked').ambiguous, true);
  assert.deepEqual(report.exact_single_vendor_name_candidates[0].candidate_vendor_ids, ['v1']);
  assert.equal(report.xwt_received_assertions_pending_review[0].proposed_state, 'received');
  assert.match(report.xwt_received_assertions_pending_review[0].assertion, /unverified/);
});

test('user scope excludes unknown owners and never proposes foreign XWT overrides', () => {
  const report = reviewCurateInventory(fixture(), { account: 'a', user: 'u2' });
  assert.equal(report.selected_counts.entries, 1);
  assert.equal(report.selected_counts.samples, 0);
  assert.equal(report.empty_unnamed_sets.length, 0);
  assert.equal(report.xwt_received_assertions_pending_review.length, 0);
  assert.ok(report.xwt_ids_absent_from_selected_scope.includes(xwt));
});

test('archived samples do not satisfy an active link; active samples do', () => {
  const data = fixture();
  data.tea_samples.push(row('old-link', { set_id: 'old', compass_entry_id: xwt }));
  assert.ok(reviewCurateInventory(data, { account: 'a' }).sampled_curate_missing_active_samples.some((entry) => entry.entry_id === xwt));
  data.tea_samples.push(row('current-link', { set_id: 'set', compass_entry_id: xwt }));
  assert.ok(!reviewCurateInventory(data, { account: 'a' }).sampled_curate_missing_active_samples.some((entry) => entry.entry_id === xwt));
});

test('ambiguous and unmatched names stay review candidates', () => {
  const data = fixture();
  data.customers.push(row('v2', { name: 'Vendor', tags: ['vendor'] }));
  data.products.push(row('p2', { vendor_name: 'Unknown' }));
  const report = reviewCurateInventory(data, { account: 'a' });
  assert.equal(report.exact_single_vendor_name_candidates.length, 0);
  assert.ok(report.unmatched_or_ambiguous_vendor_names.some((item) => item.match === 'ambiguous' && item.candidate_vendor_ids.length === 2));
  assert.ok(report.unmatched_or_ambiguous_vendor_names.some((item) => item.match === 'unmatched'));
});

test('invalid export ownership and CLI arguments give actionable commands', async () => {
  assert.throws(() => reviewCurateInventory(fixture()), /--account/);
  const data = fixture(); delete data.tea_samples[0].account_id;
  assert.throws(() => reviewCurateInventory(data, { account: 'a' }), /Export explicit ownership columns.*Usage:/);
  await assert.rejects(main(['file.json', '--user', 'u1']), /--account.*Usage:/);
  await assert.rejects(main(['file.json', '--account', 'a', '--delete', 'yes']), /Unknown.*Usage:/);
});
