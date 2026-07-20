import { describe, expect, it } from 'vitest';
import { extractImportEvidence, importFieldProvenance, importSourceExcerpt } from './importEvidence';

describe('Curate attachment interpretation', () => {
  it('turns invoice CSV rows into review lines while leaving the original file untouched', async () => {
    const exact = 'name,price,weight\nMoonlight White,18,50g\nGaiwan,24,1\n';
    const file = new File([exact], 'invoice.csv', { type: 'text/csv' });
    expect(await extractImportEvidence(file)).toBe('Moonlight White — 18 — 50g\nGaiwan — 24 — 1');
    expect(await file.text()).toBe(exact);
  });

  it('preserves the first item in headerless and single-row CSV evidence', async () => {
    expect(await extractImportEvidence(new File(['Moonlight White,18,50g\nGaiwan,24,1'], 'list.csv', { type: 'text/csv' }))).toBe('Moonlight White — 18 — 50g\nGaiwan — 24 — 1');
    expect(await extractImportEvidence(new File(['Sheng cake,42,357g'], 'single.csv', { type: 'text/csv' }))).toBe('Sheng cake — 42 — 357g');
  });

  it('extracts JSON and plain vendor lists and declines binary/image fabrication', async () => {
    expect(await extractImportEvidence(new File(['[{"name":"Sheng","price":12}]'], 'list.json', { type: 'application/json' }))).toBe('Sheng — 12');
    expect(await extractImportEvidence(new File(['Tea A\nTea B'], 'wechat.txt', { type: 'text/plain' }))).toBe('Tea A\nTea B');
    expect(await extractImportEvidence(new File(['pixels'], 'invoice.jpg', { type: 'image/jpeg' }))).toBe('');
  });

  it('shows only an exact canonical source excerpt and never relabels legacy row text as exact', () => {
    expect(importSourceExcerpt({ sourceExcerpt: '陈年六堡茶380元/500克 x1=380元' }, 'legacy normalized row')).toBe('陈年六堡茶380元/500克 x1=380元');
    expect(importSourceExcerpt({}, 'legacy normalized row')).toBeNull();
  });

  it('distinguishes every review provenance state', () => {
    const parsed = {
      fieldProvenance: {
        originalName: 'source_fact', englishName: 'canonical_match', description: 'ai_interpretation',
        form: 'not_present', classification: 'uncertain',
      },
    };
    expect(importFieldProvenance(parsed, 'originalName', '六堡茶')).toEqual({ state: 'source_fact', label: 'Source fact' });
    expect(importFieldProvenance(parsed, 'englishName', 'Liu Bao Tea')).toEqual({ state: 'canonical_match', label: 'Canonical match' });
    expect(importFieldProvenance(parsed, 'description', 'Aged tea')).toEqual({ state: 'ai_interpretation', label: 'AI interpretation' });
    expect(importFieldProvenance(parsed, 'form', null)).toEqual({ state: 'not_present', label: 'Not present' });
    expect(importFieldProvenance(parsed, 'classification', 'post-fermented')).toEqual({ state: 'uncertain', label: 'Uncertain' });
    expect(importFieldProvenance(parsed, 'year', 2006, ['year'])).toEqual({ state: 'user_edit', label: 'User edit' });
    expect(importFieldProvenance(parsed, 'year', 2006, ['parsed_data.year'])).toEqual({ state: 'user_edit', label: 'User edit' });
    expect(importFieldProvenance({ uncertainty: { english_name: 'Needs review' } }, 'englishName', 'Liu Bao')).toEqual({ state: 'uncertain', label: 'Uncertain' });
    expect(importFieldProvenance({}, 'packCount', 2)).toEqual({ state: 'source_fact', label: 'Source fact' });
    expect(importFieldProvenance({ identityResolution: { kind: 'existing', compassEntryId: 'library-1' } }, 'englishName', 'Canonical Liu Bao')).toEqual({ state: 'canonical_match', label: 'Canonical match' });
  });

  it('honors server validation before fallback field categories', () => {
    expect(importFieldProvenance({ validation: { packCount: 'ai_interpretation' } }, 'packCount', 2)).toEqual({ state: 'ai_interpretation', label: 'AI interpretation' });
    expect(importFieldProvenance({ validation: { priceAmount: 'uncertain' } }, 'lineCostExact', '800')).toEqual({ state: 'uncertain', label: 'Uncertain' });
    expect(importFieldProvenance({ validation: { quantity: 'ai_interpretation' } }, 'totalQuantityGrams', 1_000)).toEqual({ state: 'ai_interpretation', label: 'AI interpretation' });
    expect(importFieldProvenance({ validation: { translation: 'canonical_match' } }, 'englishName', 'Aged Liu Bao Tea')).toEqual({ state: 'canonical_match', label: 'Canonical match' });
    expect(importFieldProvenance({ validation: { translation: 'validated' } }, 'englishName', 'Aged Liu Bao Tea')).toEqual({ state: 'ai_interpretation', label: 'AI interpretation' });
  });

  it('keeps explicit user edits and provenance ahead of provider validation', () => {
    expect(importFieldProvenance({ validation: { packCount: 'uncertain' } }, 'packCount', 2, ['packCount'])).toEqual({ state: 'user_edit', label: 'User edit' });
    expect(importFieldProvenance({ fieldProvenance: { packCount: 'source_fact' }, validation: { packCount: 'ai_interpretation' } }, 'packCount', 2)).toEqual({ state: 'source_fact', label: 'Source fact' });
    expect(importFieldProvenance({ validation: { packCount: 'ai_interpretation' }, uncertainty: { packCount: 'Unreadable count' } }, 'packCount', 2)).toEqual({ state: 'uncertain', label: 'Uncertain' });
  });
});
