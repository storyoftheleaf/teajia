import { useEffect, useRef, useState } from 'react';
import { Button } from '../../../components/shared/Button';
import { API_URL, api, authedFetch, type ApiRequestInit } from '../../../lib/api';
import { selectHasBundle, useAppStore } from '../../../lib/store';

type Props = {
  productId: string;
  entryId?: string;
  introduction: string;
  live: boolean;
  onApply: (text: string) => Promise<void>;
  onCompareChange: (comparing: boolean) => void;
};
type Scope = NonNullable<ApiRequestInit['expectedAuth']>;
type Review = { current: string; candidate: string; live: boolean };

const sameScope = ({ accountId, userId }: Scope) => {
  const app = useAppStore.getState();
  return app.activeAccountId === accountId && app.activeUserId === userId && selectHasBundle(app, 'catalog');
};

async function readReview(scope: Scope, productId: string, entryId: string): Promise<Review> {
  const [holding, result] = await Promise.all([
    authedFetch(`${API_URL}/api/products/${encodeURIComponent(productId)}`, { expectedAuth: scope, cache: 'no-store' }),
    api.compass.list(undefined, { expectedAuth: scope }),
  ]);
  const entry = (result?.entries ?? []).find((row: { id: string; account_id: string }) => row.id === entryId && row.account_id === scope.accountId);
  if (!entry || holding?.account_id !== scope.accountId || holding.id !== productId
    || (holding.source_compass_entry_id ? holding.source_compass_entry_id !== entry.id : entry.draft_product_id !== productId)) {
    throw new Error('The linked Curate tea is unavailable in this account.');
  }
  return {
    current: typeof holding.description === 'string' ? holding.description : '',
    candidate: typeof entry.description === 'string' ? entry.description : '',
    live: Boolean(holding.is_public && holding.shown_in_shop && ['Active', 'Sold Out'].includes(holding.status)),
  };
}

export function ShopIntroductionReview(props: Props) {
  const accountId = useAppStore(state => state.activeAccountId);
  const userId = useAppStore(state => state.activeUserId);
  const allowed = useAppStore(state => selectHasBundle(state, 'catalog'));
  return <IntroductionReview key={JSON.stringify([accountId, userId, props.productId, props.entryId])}
    {...props} scope={accountId && userId && allowed ? { accountId, userId } : undefined} />;
}

function IntroductionReview({ productId, entryId, introduction, live, onApply, onCompareChange, scope }: Props & { scope?: Scope }) {
  const [open, setOpen] = useState(false);
  const [review, setReview] = useState<Review>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const run = async (action: (scope: Scope, entryId: string) => Promise<void>) => {
    if (pending.current || !scope || !entryId || !sameScope(scope)) return;
    pending.current = true; setBusy(true); setError('');
    try { await action(scope, entryId); }
    catch (cause) {
      if (mounted.current && sameScope(scope)) setError(cause instanceof Error ? cause.message : 'Could not save the Shop introduction.');
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const closeReview = () => { setOpen(false); onCompareChange(false); };
  const openReview = () => void run(async (scope, entryId) => {
    setMessage(''); setReview(undefined); setOpen(true); onCompareChange(true);
    const next = await readReview(scope, productId, entryId);
    if (mounted.current && sameScope(scope)) setReview(next);
  });
  const apply = () => void run(async (scope, entryId) => {
    if (!review?.candidate.trim() || review.candidate === review.current) return;
    const latest = await readReview(scope, productId, entryId);
    if (!mounted.current || !sameScope(scope)) return;
    if (latest.current !== review.current || latest.candidate !== review.candidate || latest.live !== review.live) {
      setReview(latest);
      throw new Error('The saved text or listing visibility changed. Review the updated comparison before applying.');
    }
    await onApply(latest.candidate);
    if (mounted.current && sameScope(scope)) {
      closeReview();
      setMessage('Shop introduction updated.');
    }
  });

  return <section aria-label="Shop introduction" className="min-w-0 space-y-1.5">
    <div className="flex flex-wrap items-center justify-between gap-x-2">
      <h3 className="text-ui-13 font-medium text-tea-text">Shop introduction</h3>
      {scope && entryId && <Button type="button" variant="plain"
        className="tap-target min-h-tap text-ui-12 text-tea-text-sec hover:text-tea-text"
        disabled={busy} onClick={openReview}>{open ? 'Reload saved wording' : 'Review Curate description'}</Button>}
    </div>
    {!open && <p className="whitespace-pre-wrap break-words text-ui-13 text-tea-text-sec">
      {introduction.trim() ? introduction : 'No Shop introduction saved.'}
    </p>}
    {message && <p role="status" className="text-ui-13 text-tea-text-sec">{message}</p>}
    {scope && open && <div role="group" aria-label="Compare listing wording">
      <div className="mx-auto max-w-4xl space-y-3 px-3 pb-3">
        {review && <>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="min-w-0 rounded-md border border-tea-border p-3">
              <h3 className="text-ui-13 font-medium text-tea-text">{review.live ? 'Current Shop copy' : 'Current listing draft'}</h3>
              <p className="mt-1 whitespace-pre-wrap break-words text-ui-13 text-tea-text-sec">{review.current.trim() ? review.current : 'No Shop introduction saved.'}</p>
            </div>
            <div className="min-w-0 rounded-md border border-tea-border p-3">
              <h3 className="text-ui-13 font-medium text-tea-text">Saved Curate description</h3>
              <p className="mt-1 whitespace-pre-wrap break-words text-ui-13 text-tea-text-sec">{review.candidate.trim() ? review.candidate : 'No description saved in Curate.'}</p>
            </div>
          </div>
          {review.candidate.trim() && (review.candidate === review.current
            ? <p className="text-ui-13 text-tea-text-sec">The listing already uses this wording.</p>
            : <p className="text-ui-13 text-tea-text-sec">{review.live || live ? 'Applying replaces the introduction on the live listing.' : 'Applying saves the introduction to this listing draft.'}</p>)}
        </>}
        {busy && <p role="status" className="text-ui-13 text-tea-text-sec">{review ? 'Saving…' : 'Loading saved descriptions…'}</p>}
        {error && <p role="alert" className="text-ui-13 text-tea-text-sec">{error}</p>}
        <div className="flex flex-wrap justify-between gap-2">
          <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={closeReview}>Cancel</Button>
          <Button type="button" size="sm" disabled={busy || !review?.candidate.trim() || review.current === review.candidate}
            onClick={apply}>Approve and apply wording</Button>
        </div>
      </div>
    </div>}
  </section>;
}
