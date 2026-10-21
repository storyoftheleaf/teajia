import { describe, expect, it } from 'vitest';
import { createEmptyEntry } from './types';
import type { Note } from '../../lib/notesStore';
import { collectTeaRecordEvidence, teaRecordExtractionText, suggestTeaRecordFacts, applyReviewedTeaFacts, teaRecordScopeMatches } from './teaRecordEvidence';

const entry = () => ({ ...createEmptyEntry('tea'), id: 'tea-1', notes: 'Spring tea from Yiwu', audioClips: [{ url: 'voice.mp3', transcript: 'Spring tea from Yiwu', timestamp: '2026-10-21T10:00:00Z' }] });
const note = (overrides: Partial<Note> = {}): Note => ({ id: 'note-1', accountId: 'account-1', compassEntryId: 'tea-1', text: 'Picked in 2019', sourceType: 'voice', authorId: 'user-1', authorName: 'Adrian', visibility: 'private', createdAt: '2026-10-21T10:00:00Z', synced: true, ...overrides });

describe('shared tea record evidence', () => {
  it('deduplicates exact text while retaining each original attribution', () => {
    const evidence = collectTeaRecordEvidence(entry(), [note(), note({ id: 'copy', text: 'Spring tea from Yiwu', sourceType: 'vendor' })], 'account-1');
    expect(evidence).toHaveLength(2);
    expect(evidence[0].text).toBe('Spring tea from Yiwu');
    expect(evidence[0].sources).toHaveLength(3);
    expect(evidence[1].sources[0].label).toContain('Adrian');
  });
  it('never reads deleted, other-account, or another tea\'s notes', () => {
    const evidence = collectTeaRecordEvidence({ ...entry(), notes: '', audioClips: [] }, [note({ accountId: 'account-2' }), note({ deleted: true }), note({ compassEntryId: 'tea-2' })], 'account-1');
    expect(evidence).toEqual([]);
  });
  it('includes migrated notes linked by the same tea key, within this account only', () => {
    const evidence = collectTeaRecordEvidence({ ...entry(), notes: '', audioClips: [], teaKey: 'shared-tea-key' }, [note({ compassEntryId: undefined, teaKey: 'shared-tea-key' }), note({ id: 'private-other-account', compassEntryId: undefined, teaKey: 'shared-tea-key', accountId: 'account-2' })], 'account-1');
    expect(evidence).toHaveLength(1);
    expect(evidence[0].sources[0].id).toBe('note:note-1');
  });
  it('keeps the request within the existing extractor limit and reports shortening', () => {
    const evidence = collectTeaRecordEvidence({ ...entry(), notes: 'a'.repeat(5000) }, [note({ text: 'b'.repeat(5000) })], 'account-1');
    const request = teaRecordExtractionText(evidence);
    expect(request.text.length).toBeLessThanOrEqual(4000);
    expect(request.shortened).toBe(true);
    expect(request.text).toContain('a');
    expect(request.text).toContain('b');
    expect(evidence[0].text).toHaveLength(5000);
  });
});

describe('reviewed tea facts', () => {
  const parts = [
    { kind: 'tea' as const, text: 'Spring 2019, Yiwu sheng cake', fields: { year: 2019, season: 'Spring', origin_region: 'Yiwu', type: 'Sheng', form: 'Cake' } },
    { kind: 'price' as const, text: '120 yuan per cake', fields: { amount: 120, currency: 'CNY', per: 'cake' } },
    { kind: 'taste' as const, text: 'Excellent', fields: { score: 10 } },
    { kind: 'story' as const, text: 'Old trees, vendor says', fields: { description: 'Ancient tree tea' } },
  ];
  it('previews only missing identity and quote facts using the canonical currency map', () => {
    const facts = suggestTeaRecordFacts({ ...entry(), year: 2020 }, parts);
    expect(facts.some(fact => fact.patch.year != null)).toBe(false);
    expect(facts.some(fact => fact.patch.priceCurrency === 'Yuan')).toBe(true);
    expect(facts.some(fact => fact.patch.originRegion === 'Yiwu')).toBe(true);
    expect(facts.some(fact => 'tasting' in fact.patch || 'description' in fact.patch || 'notes' in fact.patch)).toBe(false);
  });
  it('applies only selected facts and rechecks the latest record so typed edits survive', () => {
    const facts = suggestTeaRecordFacts(entry(), parts);
    const origin = facts.find(fact => fact.patch.originRegion)!;
    const year = facts.find(fact => fact.patch.year)!;
    expect(applyReviewedTeaFacts({ ...entry(), year: 2024 }, facts, [origin.id, year.id])).toEqual({ originRegion: 'Yiwu' });
  });
  it('preserves recorded zero and refuses a quote that conflicts with an entered unit or currency', () => {
    expect(suggestTeaRecordFacts({ ...entry(), priceAmount: 0 }, parts).some(fact => fact.patch.priceAmount != null)).toBe(false);
    expect(suggestTeaRecordFacts({ ...entry(), priceCurrency: 'USD', touchedFields: ['priceCurrency'] }, parts).some(fact => fact.patch.priceAmount != null)).toBe(false);
    expect(suggestTeaRecordFacts({ ...entry(), priceCurrency: 'USD', touchedFields: undefined }, parts).some(fact => fact.patch.priceAmount != null)).toBe(false);
    expect(suggestTeaRecordFacts({ ...entry(), form: 'Loose' }, parts).some(fact => fact.patch.priceAmount != null)).toBe(false);
  });
  it('accepts an explicitly extracted antique harvest year', () => {
    const facts = suggestTeaRecordFacts(entry(), [{ kind: 'tea', text: 'Harvested in 1920', fields: { year: 1920 } }]);
    expect(facts[0].patch).toEqual({ year: 1920 });
  });
  it('never partially applies a quote after its amount or basis was edited during review', () => {
    const facts = suggestTeaRecordFacts(entry(), parts);
    const quote = facts.find(fact => fact.patch.priceAmount != null)!;
    expect(applyReviewedTeaFacts({ ...entry(), priceAmount: 99, priceCurrency: 'USD' }, facts, [quote.id])).toEqual({});
    expect(applyReviewedTeaFacts({ ...entry(), pricePerUnitGrams: 100 }, facts, [quote.id])).toEqual({});
  });
  it('rejects stale account, user and revision scope', () => {
    const scope = { accountId: 'a', userId: 'u', revision: 1, entryId: 'tea-1' };
    expect(teaRecordScopeMatches(scope, { ...scope })).toBe(true);
    expect(teaRecordScopeMatches(scope, { ...scope, revision: 2 })).toBe(false);
    expect(teaRecordScopeMatches(scope, { ...scope, userId: 'v' })).toBe(false);
    expect(teaRecordScopeMatches(scope, { ...scope, accountId: 'b' })).toBe(false);
    expect(teaRecordScopeMatches(scope, { ...scope, entryId: 'tea-2' })).toBe(false);
  });
});

describe('asynchronous extraction review', () => {
  it('uses one read-only extraction call and discards an old-account response', async () => {
    const { loadTeaRecordReview } = await import('./teaRecordEvidence');
    const requested = { accountId: 'account-1', userId: 'user-1', revision: 1, entryId: 'tea-1' };
    let current = requested;
    let calls = 0;
    const result = await loadTeaRecordReview(entry(), [], requested, () => current, async () => {
      calls += 1;
      current = { ...requested, accountId: 'account-2', revision: 2 };
      return { parts: [{ kind: 'tea', text: '2019 tea', fields: { year: 2019 } }] };
    });
    expect(calls).toBe(1);
    expect(result).toBeNull();
  });
  it('returns a preview without changing the original tea', async () => {
    const { loadTeaRecordReview } = await import('./teaRecordEvidence');
    const original = entry();
    const scope = { accountId: 'account-1', userId: 'user-1', revision: 1, entryId: original.id };
    const result = await loadTeaRecordReview(original, [], scope, () => scope, async () => ({ parts: [{ kind: 'tea', text: '2019 tea', fields: { year: 2019 } }] }));
    expect(result?.facts[0].patch).toEqual({ year: 2019 });
    expect(original.year).toBeUndefined();
  });
});

it('refuses an oversized selection before extraction rather than silently claiming full review', async () => {
  const { loadTeaRecordReview } = await import('./teaRecordEvidence');
  const original = { ...entry(), notes: 'Long original source '.repeat(400), audioClips: [] };
  const scope = { accountId: 'account-1', userId: 'user-1', revision: 1, entryId: original.id };
  let calls = 0;
  await expect(loadTeaRecordReview(original, [], scope, () => scope, async () => { calls += 1; return { parts: [] }; })).rejects.toThrow('4,000');
  expect(calls).toBe(0);
});
