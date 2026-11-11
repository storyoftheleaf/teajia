import { describe, expect, it } from 'vitest';
import { upsertTastingById } from './sampleTastings';

const t = (id: string, note: string, createdAt = '2026-01-01') => ({ id, note, createdAt });

describe('saving a sample tasting more than once in one opening', () => {
  it('appends a tasting with a new id', () => {
    expect(upsertTastingById([t('a', 'one')], t('b', 'two'))).toHaveLength(2);
    expect(upsertTastingById(undefined, t('a', 'one'))).toEqual([t('a', 'one')]);
  });
  it('updates the existing record when the id repeats, keeping its createdAt', () => {
    const next = upsertTastingById([t('a', 'first', '2026-01-01'), t('b', 'other')], t('a', 'edited', '2026-02-02'));
    expect(next).toHaveLength(2);
    expect(next[0]).toEqual(t('a', 'edited', '2026-01-01'));
  });
});
