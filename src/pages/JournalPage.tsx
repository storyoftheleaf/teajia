import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { TastingJournal } from '../components/tasting/TastingJournal';
import { TastingSession, type TastingItem } from '../components/tasting/TastingSession';
import { PersonalTeaLinks } from '../components/account/PersonalTeaLinks';
import { useJournalHydration } from '../hooks/useJournalHydration';
import { api } from '../lib/api';
import type { CellarItem } from '../lib/teaChestTypes';

export interface JournalDeepLink {
  productId: string | null;
  entryId: string | null;
  chestItemId?: string;
  recordId?: string;
}

export function readJournalDeepLink(search: string): JournalDeepLink {
  const params = new URLSearchParams(search);
  const recordId = params.get('tasting')?.trim();
  const chestItemId = params.get('chest')?.trim();
  return {
    ...(recordId ? { recordId } : {}),
    ...(chestItemId ? { chestItemId } : {}),
    productId: params.get('tea')?.trim() || null,
    entryId: params.get('entry')?.trim() || null,
  };
}

export function journalTastingForDeepLink(deepLink: JournalDeepLink, items: CellarItem[]): TastingItem | null {
  if (!deepLink.chestItemId) return null;
  const item = items.find(candidate => candidate.id === deepLink.chestItemId);
  if (!item) return null;
  return {
    id: item.linkedProductId || `member-tea:chest:${item.id}`,
    name: item.name,
    type: item.type || undefined,
    image: item.imageUrl || undefined,
  };
}

export default function JournalPage() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const { scopeKey, fetchError } = useJournalHydration();
  const deepLink = readJournalDeepLink(search);
  const chest = useQuery({
    queryKey: ['cellar'],
    queryFn: () => api.cellar.list(),
    enabled: !!deepLink.chestItemId,
    staleTime: 1000 * 60,
  });
  const chestTasting = journalTastingForDeepLink(deepLink, chest.data?.items ?? []);

  return (
    <>
      {fetchError && (
        <div role="status" className="px-4 py-2 text-ui-12 text-tea-text-sec border-b border-tea-border">
          {fetchError}
        </div>
      )}
      <TastingJournal
        key={JSON.stringify([scopeKey, deepLink])}
        onBack={() => navigate(-1)}
        onOrderTea={(teaId) => navigate(`/shop/product/${teaId}`)}
        initialProductId={deepLink.productId}
        initialEntryId={deepLink.entryId}
        initialRecordId={deepLink.recordId}
      />
      {chestTasting && (
        <TastingSession
          key={chestTasting.id}
          item={chestTasting}
          onClose={() => navigate(-1)}
        />
      )}
      <div className="mx-auto max-w-3xl px-4 pb-nav-gap-lg md:px-6">
        <PersonalTeaLinks current="journal" />
      </div>
    </>
  );
}
