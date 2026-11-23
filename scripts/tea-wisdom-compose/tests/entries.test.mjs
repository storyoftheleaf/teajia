import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { approvalRefusals, approvedEntries, renderGeneratedEntries } from '../lib/entries.mjs';

const claims = [{ claimId: 'shou:definition', rev: 2 }, { claimId: 'shou:brewing', rev: 1 }];
const file = (status, uses) => ({ status, record: { id: 'tea-1', name: 'Tea' }, entry: { productId: 'tea-1', paragraphs: [{ layer: 'type', text: 'A [ripe](shou:definition) tea.' }], missing: ['Photos'] }, claimUses: uses });

test('approval is refused while a claim is unapproved or has moved on', () => {
  assert.deepEqual(approvalRefusals(file('draft', [{ claimId: 'shou:definition', rev: null }, { claimId: 'shou:brewing', rev: 1 }]), claims), []);
  assert.deepEqual(approvalRefusals(file('draft', [{ claimId: 'shou:age-aged', rev: null }]), claims), ['shou:age-aged is not an approved public claim yet']);
  assert.deepEqual(approvalRefusals(file('approved', [{ claimId: 'shou:definition', rev: 1 }]), claims), ['shou:definition is at rev 2; the entry was written against rev 1']);
});

test('only approved entries whose claims still hold reach the shop, without the builder notes', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'entries-'));
  await fs.writeFile(path.join(dir, 'a.json'), JSON.stringify(file('approved', [{ claimId: 'shou:definition', rev: 2 }])));
  await fs.writeFile(path.join(dir, 'b.json'), JSON.stringify({ ...file('draft', []), record: { id: 'tea-2', name: 'Draft' } }));
  await fs.writeFile(path.join(dir, 'c.json'), JSON.stringify({ ...file('approved', [{ claimId: 'shou:definition', rev: 1 }]), record: { id: 'tea-3', name: 'Stale' } }));
  const entries = await approvedEntries(dir, claims);
  assert.deepEqual(Object.keys(entries), ['tea-1']);
  const rendered = renderGeneratedEntries(entries);
  assert.match(rendered, /"tea-1": \{/);
  assert.match(rendered, /"missing":\[\]/);
  assert.equal(renderGeneratedEntries({}).includes('= {};'), true);
});
