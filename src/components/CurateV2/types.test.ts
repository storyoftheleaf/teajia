import { describe, expect, it } from 'vitest';
import { compassEntryToProductDraft, createEmptyEntry, type TeaCompassEntry } from './types';

/**
 * Item 5: the capture card used to open on Taiwan dollars and, worse, send
 * that untouched default to the server as though the operator had chosen
 * it, which permanently excluded the row from `list_unstated_costs`. Fixed
 * by defaulting the shelf's own currency (Yuan, Adrian's 2026-09-07 rule)
 * and by gating what `compassEntryToProductDraft` sends on `touchedFields`,
 * the same "inherited defaults never become content" rule the rest of
 * Curate's retention contract already uses (`entryHasDeliberateInput`).
 */
describe('createEmptyEntry', () => {
  it('opens on Yuan, not Taiwan dollars, when nobody has picked a currency yet', () => {
    expect(createEmptyEntry('tea').priceCurrency).toBe('Yuan');
  });

  it('still honors an explicit default (the remembered last-used currency)', () => {
    expect(createEmptyEntry('tea', { priceCurrency: 'HKD' }).priceCurrency).toBe('HKD');
  });

  it('starts with no touched fields, so the inherited currency is not content yet', () => {
    expect(createEmptyEntry('tea').touchedFields).toEqual([]);
  });
});

describe('compassEntryToProductDraft cost_currency', () => {
  const base: TeaCompassEntry = {
    ...createEmptyEntry('tea'),
    id: 'entry-1',
    name: 'Test Tea',
    priceAmount: 500,
  };

  it('omits cost_currency for an untouched inherited default, so the server refuses by name rather than recording a currency nobody chose', () => {
    const draft = compassEntryToProductDraft({ ...base, touchedFields: [] });
    expect(draft.cost_currency).toBeUndefined();
    expect('cost_currency' in JSON.parse(JSON.stringify(draft))).toBe(false);
  });

  it('sends cost_currency once the operator actually picks one', () => {
    const draft = compassEntryToProductDraft({ ...base, touchedFields: ['priceCurrency'], priceCurrency: 'HKD' });
    expect(draft.cost_currency).toBe('HKD');
  });

  it('does not stamp an untouched default even when other fields are touched', () => {
    const draft = compassEntryToProductDraft({ ...base, touchedFields: ['priceAmount'] });
    expect(draft.cost_currency).toBeUndefined();
  });

  it('falls back to the stored currency for a legacy entry with no touch metadata at all', () => {
    const legacy = { ...base, priceCurrency: 'HKD' as const };
    delete (legacy as { touchedFields?: string[] }).touchedFields;
    const draft = compassEntryToProductDraft(legacy);
    expect(draft.cost_currency).toBe('HKD');
  });
});
