import { describe, expect, it } from 'vitest';
import { hasJournalItemId } from './journalItemId';

describe('which tastings belong in the personal journal', () => {
  it('accepts a real product, tea or sample id', () => {
    expect(hasJournalItemId('prod_123')).toBe(true);
  });
  it('rejects the placeholder id a product being created is opened with', () => {
    expect(hasJournalItemId('new')).toBe(false);
  });
  it('rejects a missing or blank id', () => {
    expect(hasJournalItemId('')).toBe(false);
    expect(hasJournalItemId('  ')).toBe(false);
    expect(hasJournalItemId(undefined)).toBe(false);
  });
});
