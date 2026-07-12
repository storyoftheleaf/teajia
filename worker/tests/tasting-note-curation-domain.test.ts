import { describe, expect, it } from 'vitest';
import { candidateToApi, parseCandidateInput } from '../src/tastingNoteCuration';

describe('tasting-note curation domain', () => {
  it('normalizes a member candidate and rejects empty source text', () => {
    expect(parseCandidateInput({ source_text: '  orchid steam ', source_tasting: { aroma: ['orchid'] } }))
      .toEqual({ sourceText: 'orchid steam', sourceTasting: JSON.stringify({ aroma: ['orchid'] }) });
    expect(() => parseCandidateInput({ source_text: ' ' })).toThrow('source_text required');
  });

  it('serializes private candidate state without leaking source tasting JSON', () => {
    expect(candidateToApi({ id: 'c', journal_entry_id: 'j', note_key: 'aroma', product_id: 'p', status: 'starred', source_text: 'orchid', source_tasting: '{"private":true}', edited_text: null, attribution_name: null, attribution_detail: null, created_at: 'now', updated_at: 'now' } as any))
      .toEqual({ id: 'c', journalEntryId: 'j', noteKey: 'aroma', productId: 'p', status: 'starred', sourceText: 'orchid', finalText: 'orchid', attributionName: null, attributionDetail: null, createdAt: 'now', updatedAt: 'now' });
  });
});
