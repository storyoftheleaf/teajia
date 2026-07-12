import { describe, expect, it, vi } from 'vitest';
import { candidateDraft, dismissCandidate, promoteCandidate, type TastingNoteCandidate } from './TastingNoteReviewQueue';

describe('TastingNoteReviewQueue', () => {
  it('builds an editable publication draft without ranking fields', () => {
    const draft = candidateDraft({
      id: 'candidate-1', journalEntryId: 'entry-1', noteKey: 'section-1',
      productId: 'product-1', status: 'starred', sourceText: 'Long mineral finish',
      finalText: 'Long mineral finish', attributionName: null, attributionDetail: null,
      createdAt: '2026-07-12T00:00:00Z', updatedAt: '2026-07-12T00:00:00Z',
    } satisfies TastingNoteCandidate);

    expect(draft).toEqual({ editedText: 'Long mineral finish', attributionName: '', attributionDetail: '' });
    expect(Object.keys(draft).join(' ')).not.toMatch(/vote|rank|score/i);
  });

  it('saves edits before promotion and dismisses without ranking actions', async () => {
    const client = {
      list: vi.fn(), update: vi.fn().mockResolvedValue({}), promote: vi.fn().mockResolvedValue({}), dismiss: vi.fn().mockResolvedValue({}),
    };
    const draft = { editedText: 'Apricot over warm stone', attributionName: 'A.', attributionDetail: 'Spring table' };
    await promoteCandidate('candidate-1', draft, client);
    expect(client.update).toHaveBeenCalledWith('candidate-1', {
      edited_text: draft.editedText, attribution_name: draft.attributionName, attribution_detail: draft.attributionDetail,
    });
    expect(client.promote).toHaveBeenCalledAfter(client.update);
    await dismissCandidate('candidate-2', client);
    expect(client.dismiss).toHaveBeenCalledWith('candidate-2');
  });
});
