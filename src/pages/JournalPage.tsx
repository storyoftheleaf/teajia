import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TastingJournal } from '../components/tasting/TastingJournal';
import { api, hasToken } from '../lib/api';
import { useAppStore } from '../lib/store';

function fromApiRow(row: Record<string, any>) {
  return {
    id: row.id,
    teaId: row.product_id ?? 'unknown',
    teaName: row.product_name ?? 'Unknown Tea',
    teaType: row.product_type || '',
    teaImage: row.product_image ?? undefined,
    tasting: (() => {
      try { return row.tasting ? (typeof row.tasting === 'string' ? JSON.parse(row.tasting) : row.tasting) : {}; }
      catch { return {}; }
    })(),
    personalNote: row.personal_note ?? undefined,
    rating: row.rating ?? undefined,
    createdAt: row.created_at || new Date().toISOString(),
    eventId: row.event_id ?? undefined,
    eventTitle: row.event_title ?? undefined,
    sourceType: row.source_type ?? 'product',
    compassEntryId: row.compass_entry_id ?? undefined,
    synced: true,
  };
}

export default function JournalPage() {
  const navigate = useNavigate();
  const { tastingJournal } = useAppStore();
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (!hasToken()) return;
    setFetching(true);
    api.tastingJournal.list()
      .then((data: any) => {
        const rows = Array.isArray(data) ? data : (data?.entries ?? []);
        const entries = rows.map(fromApiRow);
        if (entries.length > 0) {
          useAppStore.setState(state => {
            const existingIds = new Set(state.tastingJournal.map((e: any) => e.id));
            const newEntries = entries.filter((e: any) => !existingIds.has(e.id));
            const all = [...state.tastingJournal, ...newEntries]
              .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            return { tastingJournal: all };
          });
        }
      })
      .catch((err: any) => {
        setFetchError(err?.message ?? 'Could not load journal');
      })
      .finally(() => setFetching(false));
  }, []);

  return (
    <>
      {fetchError && (
        <div className="px-4 py-2 text-ui-12 text-tea-error bg-tea-error/10 border-b border-tea-error/20">
          {fetchError}
        </div>
      )}
      <TastingJournal
        onBack={() => navigate(-1)}
        onOrderTea={(teaId) => navigate(`/shop/product/${teaId}`)}
      />
    </>
  );
}
