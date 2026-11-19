import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { api } from '../../lib/api';
import type { ReviewedDbArticle } from '../../types';
import { Button } from '../../components/shared/Button';
import { ImmersivePreview } from './ImmersivePreview';

export function EditorialPilotReview({ article, onClose, onSaved }: {
  article: ReviewedDbArticle;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const queryClient = useQueryClient();
  const [current, setCurrent] = useState(article);
  const [edition, setEdition] = useState<'current' | 'candidate'>('current');
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const pilot = current.editorial_pilot!;
  const preview = edition === 'candidate' ? pilot.candidate : current;
  const publicNow = current.status === 'published';
  const matches = pilot.approved_id === pilot.candidate_id;

  async function act(action: 'publish' | 'place' | 'withdraw' | 'reload') {
    setWorking(true);
    setMessage('');
    try {
      if (action === 'withdraw') await api.articles.unpublish(current.id, current.review_digest);
      if (action === 'publish' || action === 'place') {
        const place = pilot.placed || action === 'place';
        const digest = place ? pilot.placement_review_digest : pilot.review_digest;
        await api.articles.approveEdition(current.id, digest, pilot.candidate_id, place);
      }
      const updated = await api.articles.get(current.id);
      setCurrent(updated);
      if (action === 'reload') setEdition('current');
      if (action !== 'reload') {
        onSaved?.();
        void queryClient.invalidateQueries({ queryKey: ['read-editorial-issue'] });
        void queryClient.invalidateQueries({ queryKey: ['article', current.slug] });
        setMessage(action === 'withdraw' ? 'Edition withdrawn from Read and the public article.'
          : action === 'place' ? 'Approved edition placed in Read.' : 'Edition published at the existing address.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The change could not be saved.');
    } finally {
      setWorking(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="edition-review-title"
      className="fixed inset-x-0 top-0 bottom-nav z-modal flex min-w-0 flex-col bg-tea-bg text-tea-text">
      <header className="flex flex-wrap items-center gap-x-3 border-b border-tea-border px-4 py-2">
        <Button variant="icon" type="button" aria-label="Close" onClick={onClose}>
          <X size={18} />
        </Button>
        <h2 id="edition-review-title" className="font-semibold">WordForge editions</h2>
        <Button variant="quiet" type="button" disabled={working} onClick={() => void act('reload')} className="ml-auto">Refresh review</Button>
      </header>
      <div role="group" aria-label="Compare editions" className="grid grid-cols-2 gap-2 border-b border-tea-border p-3">
        <Button variant="plain" type="button" aria-pressed={edition === 'current'} onClick={() => setEdition('current')}
          className={`min-w-0 rounded-md border border-tea-border p-2 text-left ${edition === 'current' ? 'bg-tea-accent-sub' : 'bg-tea-surface'}`}>
          <span className="block text-ui-12 text-tea-text-sec">{publicNow ? 'Public edition' : 'Stored draft'}
            {pilot.approved_source_revision != null && ` · Revision ${pilot.approved_source_revision}`}</span>
          <span className="block break-words font-semibold">{current.title}</span>
        </Button>
        <Button variant="plain" type="button" aria-pressed={edition === 'candidate'} onClick={() => setEdition('candidate')}
          className={`min-w-0 rounded-md border border-tea-border p-2 text-left ${edition === 'candidate' ? 'bg-tea-accent-sub' : 'bg-tea-surface'}`}>
          <span className="block text-ui-12 text-tea-text-sec">WordForge revision {pilot.source_revision}</span>
          <span className="block break-words font-semibold">{pilot.candidate.title}</span>
        </Button>
      </div>
      {preview.author_name && <p className="px-4 py-2 text-ui-13 text-tea-text-sec">By {preview.author_name}</p>}
      <div className="min-h-0 flex-1">
        <ImmersivePreview blocks={preview.blocks} />
      </div>
      <footer className="border-t border-tea-border px-4 py-2">
        {message && <p role="status" className="pb-2 text-ui-13 text-tea-text-sec">{message}</p>}
        {!pilot.ready && <p className="pb-2 text-ui-13 text-tea-text-sec">Verify the staged edition’s byline and media before approval.</p>}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {publicNow && <Button variant="quiet" type="button" disabled={working} onClick={() => void act('withdraw')} className="mr-auto">Withdraw</Button>}
          {publicNow && pilot.placed && <span className="text-ui-13 text-tea-text-sec">Placed in Read</span>}
          {(!publicNow || !matches) && <Button type="button" disabled={working || edition !== 'candidate' || !pilot.ready}
            onClick={() => void act('publish')} variant="primary">
            {publicNow ? 'Replace public edition' : 'Publish reviewed edition'}
          </Button>}
          {publicNow && matches && !pilot.placed && <Button type="button" disabled={working || edition !== 'candidate' || !pilot.ready}
            onClick={() => void act('place')} variant="primary">Place in Read</Button>}
        </div>
      </footer>
    </div>
  );
}
