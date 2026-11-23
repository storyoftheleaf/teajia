import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { TastingJournal } from '../components/tasting/TastingJournal';
import { PersonalTeaLinks } from '../components/account/PersonalTeaLinks';
import { useJournalHydration } from '../hooks/useJournalHydration';

export function readJournalDeepLink(search: string): { productId: string | null; entryId: string | null; recordId?: string } {
  const params = new URLSearchParams(search);
  const recordId = params.get('tasting')?.trim();
  return {
    ...(recordId ? { recordId } : {}),
    productId: params.get('tea')?.trim() || null,
    entryId: params.get('entry')?.trim() || null,
  };
}

export default function JournalPage() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const { scopeKey, fetchError } = useJournalHydration();
  const deepLink = readJournalDeepLink(search);

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
      <div className="mx-auto max-w-3xl px-4 pb-nav-gap-lg md:px-6">
        <PersonalTeaLinks current="journal" />
      </div>
    </>
  );
}
