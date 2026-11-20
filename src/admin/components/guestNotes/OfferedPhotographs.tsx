import { photographShape } from '../../../lib/photographShape';
import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { familyApi } from '../../../lib/familyApi';
import type { FamilyOfferedPhotograph } from '../../../lib/familyContract';
import { mediaUrl } from '../../../lib/mediaUrl';
import { Chip, SectionHeading, TextAction, dayLabel, errorSentence } from './parts';

/**
 * Photographs members offered to Teajia, with what the shop can do with each.
 *
 * Use puts it on the tea page, Make lead picture makes it the credited picture
 * for the tea, Pass declines it, and Restore undoes the last of those: a lead
 * steps back to what the tea showed before, so the earlier picture is never
 * lost. Hide takes it off every page at once and Show brings it back.
 *
 * A photograph its author has removed from their own page stays here, marked,
 * because the shop keeps the right to use what was offered.
 */
type Offered = FamilyOfferedPhotograph & { hidden: boolean };
type Action = 'place' | 'lead' | 'pass' | 'restore';

export const OFFERED_KEY = ['family-offered-photographs'] as const;

function statusWords(photo: Offered): string | null {
  if (photo.shop_use === 'lead') return 'Lead picture';
  if (photo.shop_use === 'placed') return 'On the tea';
  if (photo.shop_use === 'passed') return 'Passed';
  return null;
}

function PhotographRow({ photo }: { photo: Offered }) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: OFFERED_KEY });

  const decide = useMutation({
    mutationFn: (action: Action) => { setError(null); return familyApi.shop.decide(photo.id, action); },
    onSuccess: refresh,
    onError: cause => setError(errorSentence(cause, 'Could not save that choice.')),
  });
  const hide = useMutation({
    mutationFn: async (hidden: boolean) => {
      setError(null);
      const target = { target_kind: 'photograph' as const, target_id: photo.id };
      if (hidden) await familyApi.shop.hide(target);
      else await familyApi.shop.unhide(target);
    },
    onSuccess: refresh,
    onError: cause => setError(errorSentence(cause, 'Could not change that.')),
  });
  const pending = decide.isPending || hide.isPending;
  const status = statusWords(photo);

  return (
    <li data-testid="offered-photograph" data-photograph-id={photo.id} className="flex gap-3 border-b border-tea-border py-4 last:border-b-0">
      <a href={mediaUrl(photo.full_url)} target="_blank" rel="noreferrer" className="block shrink-0" aria-label={`Open the photograph of ${photo.product_name ?? 'this tea'}`}>
        <img
          src={mediaUrl(photo.small_url)}
          width={photo.small_width}
          height={photo.small_height}
          alt={`${photo.product_name ?? 'Tea'} by ${photo.author.name}`}
          loading="lazy"
          data-shape={photographShape(photo.small_width, photo.small_height)}
          className="offered-photo h-24 object-cover"
        />
      </a>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-ui-12 font-medium text-tea-text">{photo.product_name ?? 'A tea'}</span>
          <span className="text-ui-11 text-tea-text-sec">{photo.author.name}</span>
          <span className="text-ui-10 uppercase tracking-[0.14em] text-tea-text-dim">{dayLabel(photo.offered_at)}</span>
        </div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {status && <Chip>{status}</Chip>}
          {photo.hidden && <Chip>Hidden</Chip>}
          {photo.removed_by_author && <Chip>Off their page</Chip>}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-4">
          {photo.shop_use !== 'placed' && photo.shop_use !== 'lead' && (
            <TextAction onClick={() => decide.mutate('place')} disabled={pending}>Use</TextAction>
          )}
          {photo.shop_use !== 'lead' && (
            <TextAction onClick={() => decide.mutate('lead')} disabled={pending}>Make lead picture</TextAction>
          )}
          {photo.shop_use === 'none' && (
            <TextAction tone="quiet" onClick={() => decide.mutate('pass')} disabled={pending}>Pass</TextAction>
          )}
          {photo.shop_use !== 'none' && (
            <TextAction tone="quiet" onClick={() => decide.mutate('restore')} disabled={pending}>
              {photo.shop_use === 'lead' ? 'Restore earlier picture' : 'Restore'}
            </TextAction>
          )}
          <TextAction tone="quiet" onClick={() => hide.mutate(!photo.hidden)} disabled={pending}>
            {photo.hidden ? 'Show again' : 'Hide'}
          </TextAction>
        </div>
        {error && <p role="alert" className="mt-1 text-ui-11 text-tea-text-sec">{error}</p>}
      </div>
    </li>
  );
}

export function OfferedPhotographs() {
  const [showDecided, setShowDecided] = useState(false);
  const query = useQuery({ queryKey: OFFERED_KEY, queryFn: () => familyApi.shop.offered() });
  const photos = query.data?.photographs ?? [];
  // What is live on a tea stays in view so Restore is one tap away; only a pass is tucked behind the toggle.
  const waiting = useMemo(() => photos.filter(p => p.shop_use === 'none'), [photos]);
  const inUse = useMemo(() => photos.filter(p => p.shop_use === 'lead' || p.shop_use === 'placed'), [photos]);
  const passed = useMemo(() => photos.filter(p => p.shop_use === 'passed'), [photos]);
  const shown = showDecided ? [...waiting, ...inUse, ...passed] : [...waiting, ...inUse];

  if (query.isError) {
    return (
      <section aria-label="Photographs offered" className="mt-8">
        <SectionHeading>Photographs offered</SectionHeading>
        <p role="alert" className="mt-2 text-ui-12 text-tea-text-sec">Could not read the photographs.</p>
        <TextAction onClick={() => { void query.refetch(); }}>Try again</TextAction>
      </section>
    );
  }
  // Nothing offered yet: nothing to show, so no empty heading.
  if (photos.length === 0) return null;

  return (
    <section aria-label="Photographs offered" className="mt-8">
      <SectionHeading
        aside={passed.length > 0 && (
          <TextAction tone="quiet" onClick={() => setShowDecided(value => !value)}>
            {showDecided ? 'Hide passed' : `Show ${passed.length} passed`}
          </TextAction>
        )}
      >
        Photographs offered
      </SectionHeading>
      <p className="mt-1 text-ui-12 text-tea-text-sec">
        {waiting.length === 0
          ? 'Nothing new to look at.'
          : `${waiting.length} photograph${waiting.length === 1 ? '' : 's'} waiting.`}
      </p>
      {shown.length > 0 && (
        <ul className="mt-2">
          {shown.map(photo => <PhotographRow key={photo.id} photo={photo} />)}
        </ul>
      )}
    </section>
  );
}
