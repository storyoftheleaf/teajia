import { useId, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { api } from '../../lib/api';
import { useAppStore } from '../../lib/store';

const fieldStyle = 'min-h-tap w-full rounded-md border border-tea-border bg-tea-bg p-[var(--space-2)] text-tea-text focus-visible:border-tea-gold';
const labelStyle = `${TYPOGRAPHY_CLASSES.label} text-tea-text-sec`;

type Offer = { sourceText: string; attributionName: string; status: 'starred' | 'promoted' | 'dismissed' };
const offerStatus = { starred: 'Awaiting review', promoted: 'Approved', dismissed: 'Declined' };

export function TastingExcerptOffer({ productId, entryId, privateSentence }: {
  productId: string;
  entryId: string;
  privateSentence: string;
}) {
  const id = useId();
  const client = useQueryClient();
  const viewer = useAppStore(state => state.activeUserId);
  const [excerpt, setExcerpt] = useState<string | null>(null);
  const [byline, setByline] = useState('');
  const excerptText = excerpt ?? privateSentence;
  const offerKey = ['tasting-excerpt-offer', viewer, entryId];
  const offer = useQuery<Offer | null>({
    queryKey: offerKey,
    queryFn: () => api.tastingExcerptOffers.get(entryId),
    retry: false,
  });

  const changeOffer = useMutation({
    mutationFn: async (withdraw: boolean) => {
      if (withdraw) {
        await api.tastingExcerptOffers.withdraw(entryId);
        return null;
      }
      return await api.tastingExcerptOffers.offer(entryId, { excerpt: excerptText.trim(), byline: byline.trim() }) as Offer;
    },
    onSuccess: pendingOffer => {
      client.setQueryData(offerKey, pendingOffer);
      setExcerpt(null);
      setByline('');
      void client.invalidateQueries({ queryKey: ['product-impressions', productId] });
      void client.invalidateQueries({ queryKey: ['main-tasting-excerpts'] });
    },
  });

  return (
    <>
      {offer.isError && (
        <div className="mt-[var(--space-3)]">
          <p role="alert" className={TYPOGRAPHY_CLASSES.accountMeta}>Could not load the excerpt offer.</p>
          <button type="button" className="btn-secondary btn-sm" onClick={() => void offer.refetch()}>Retry</button>
        </div>
      )}
      {offer.isSuccess && (
        <div className="mt-[var(--space-4)] border-t border-tea-border pt-[var(--space-3)]">
          <h3 className={TYPOGRAPHY_CLASSES.h3}>Offer an excerpt</h3>
          {offer.data ? (
            <div className="mt-[var(--space-2)] grid gap-[var(--space-2)]">
              <blockquote className={TYPOGRAPHY_CLASSES.bodyLight}>
                <p>“{offer.data.sourceText}”</p>
                <footer className={TYPOGRAPHY_CLASSES.accountMeta}>{offer.data.attributionName}</footer>
              </blockquote>
              <div className="flex flex-wrap items-center gap-[var(--space-3)]">
                <span className={TYPOGRAPHY_CLASSES.accountMeta}>{offerStatus[offer.data.status]}</span>
                <button type="button" className="btn-secondary btn-sm" onClick={() => changeOffer.mutate(true)} disabled={changeOffer.isPending}>Withdraw offer</button>
              </div>
              {!privateSentence.includes(offer.data.sourceText) && (
                <p className={TYPOGRAPHY_CLASSES.accountMeta}>Your offer still contains the original excerpt. Withdraw it to offer updated words.</p>
              )}
            </div>
          ) : privateSentence.trim() && (
            <form className="mt-[var(--space-2)] grid gap-[var(--space-2)]" onSubmit={event => { event.preventDefault(); changeOffer.mutate(false); }}>
              <p className={TYPOGRAPHY_CLASSES.accountMeta}>Choose words from your saved note and a byline for public credit.</p>
              <label className={labelStyle} htmlFor={`${id}-excerpt`}>Excerpt</label>
              <textarea id={`${id}-excerpt`} rows={2} className={fieldStyle} value={excerptText} onChange={event => setExcerpt(event.target.value)} required disabled={changeOffer.isPending} />
              <label className={labelStyle} htmlFor={`${id}-byline`}>Public byline</label>
              <input id={`${id}-byline`} className={fieldStyle} value={byline} onChange={event => setByline(event.target.value)} required disabled={changeOffer.isPending} />
              <button className="btn-secondary btn-sm justify-self-start" disabled={!excerptText.trim() || !privateSentence.includes(excerptText.trim()) || !byline.trim() || changeOffer.isPending}>Send for approval</button>
            </form>
          )}
          {changeOffer.isError && <p role="alert" className={TYPOGRAPHY_CLASSES.accountMeta}>{changeOffer.error.message}</p>}
        </div>
      )}
    </>
  );
}
