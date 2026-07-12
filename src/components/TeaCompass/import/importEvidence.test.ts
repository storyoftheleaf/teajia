import { describe, expect, it } from 'vitest';
import { extractImportEvidence } from './importEvidence';

describe('Curate attachment interpretation', () => {
  it('turns invoice CSV rows into review lines while leaving the original file untouched', async () => {
    const exact = 'name,price,weight\nMoonlight White,18,50g\nGaiwan,24,1\n';
    const file = new File([exact], 'invoice.csv', { type: 'text/csv' });
    expect(await extractImportEvidence(file)).toBe('Moonlight White — 18 — 50g\nGaiwan — 24 — 1');
    expect(await file.text()).toBe(exact);
  });

  it('extracts JSON and plain vendor lists and declines binary/image fabrication', async () => {
    expect(await extractImportEvidence(new File(['[{"name":"Sheng","price":12}]'], 'list.json', { type: 'application/json' }))).toBe('Sheng — 12');
    expect(await extractImportEvidence(new File(['Tea A\nTea B'], 'wechat.txt', { type: 'text/plain' }))).toBe('Tea A\nTea B');
    expect(await extractImportEvidence(new File(['pixels'], 'invoice.jpg', { type: 'image/jpeg' }))).toBe('');
  });
});
