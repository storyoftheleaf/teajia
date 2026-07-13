import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { candidateDraft, dismissCandidate, promoteCandidate, refreshTastingNoteCandidates, TastingNoteReviewQueue, TastingNoteReviewQueueError, type TastingNoteCandidate } from './TastingNoteReviewQueue';

const candidate: TastingNoteCandidate = {
  id: 'candidate-1', journalEntryId: 'entry-1', noteKey: 'section-1',
  productId: 'product-1', status: 'starred', sourceText: 'Long mineral finish',
  finalText: 'Long mineral finish', attributionName: null, attributionDetail: null,
  createdAt: '2026-07-12T00:00:00Z', updatedAt: '2026-07-12T00:00:00Z',
};

function renderQueue(client: QueryClient) {
  return renderToStaticMarkup(<QueryClientProvider client={client}><TastingNoteReviewQueue /></QueryClientProvider>);
}

describe('TastingNoteReviewQueue', () => {
  it('builds an editable publication draft without ranking fields', () => {
    const draft = candidateDraft(candidate);

    expect(draft).toEqual({ editedText: 'Long mineral finish', attributionName: '', attributionDetail: '' });
    expect(Object.keys(draft).join(' ')).not.toMatch(/vote|rank|score/i);
  });

  it('renders React Query loading and editable success states', () => {
    expect(renderQueue(new QueryClient())).toContain('Loading review candidates');
    const client = new QueryClient();
    client.setQueryData(['tasting-note-candidates', 'starred'], [candidate]);
    const html = renderQueue(client);
    expect(html).toContain('Long mineral finish');
    expect(html).toContain('Published impression');
    expect(html).toContain('Attribution name');
    expect(html).toContain('Promote impression');
    expect(html).toContain('Dismiss');
    expect(html).not.toMatch(/vote|rank|score/i);
  });

  it('renders error retry and invalidates the queue after decisions', async () => {
    const html = renderToStaticMarkup(<TastingNoteReviewQueueError onRetry={() => undefined} />);
    expect(html).toContain('Could not load review candidates');
    expect(html).toContain('Try again');
    const client = { invalidateQueries: vi.fn().mockResolvedValue(undefined) } as unknown as QueryClient;
    await refreshTastingNoteCandidates(client);
    expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['tasting-note-candidates'] });
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
