import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TastingJournal } from '../components/tasting/TastingJournal';
import { api, hasToken } from '../lib/api';
import { useAppStore } from '../lib/store';
import { PersonalTeaLinks } from '../components/account/PersonalTeaLinks';
import type { CustomerTasting, TastingData, TastingRecord } from '../types';

export function readJournalDeepLink(search: string): { productId: string | null; entryId: string | null } {
  const params = new URLSearchParams(search);
  return {
    productId: params.get('tea')?.trim() || null,
    entryId: params.get('entry')?.trim() || null,
  };
}

function parseJsonObject(value: unknown): Record<string, any> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value !== 'string' || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}

function parseJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; }
  catch { return []; }
}

export function fromApiRow(row: Record<string, any>): CustomerTasting {
  const createdAt = row.created_at || new Date().toISOString();
  const legacyTasting = parseJsonObject(row.tasting) as TastingData;
  const storedNote = parseJsonObject(row.note);
  const noteTasting = parseJsonObject(storedNote.tasting) as TastingData;
  const note = {
    tasting: Object.keys(noteTasting).length > 0 ? noteTasting : legacyTasting,
    ...(storedNote.personalNote ?? row.personal_note ? { personalNote: storedNote.personalNote ?? row.personal_note } : {}),
    ...(storedNote.rating ?? row.rating != null ? { rating: storedNote.rating ?? row.rating } : {}),
    ...(storedNote.verdict ? { verdict: storedNote.verdict } : {}),
    ...(storedNote.wouldBuy != null ? { wouldBuy: Boolean(storedNote.wouldBuy) } : {}),
    updatedAt: storedNote.updatedAt || createdAt,
  } as CustomerTasting['note'];
  const storedTastings = parseJsonArray(row.tastings)
    .filter(value => value && typeof value === 'object')
    .map((value, index) => {
      const tasting = value as Record<string, any>;
      return {
        ...tasting,
        id: String(tasting.id || `${row.id}-sitting-${index + 1}`),
        createdAt: tasting.createdAt || tasting.created_at || createdAt,
        tasting: parseJsonObject(tasting.tasting) as TastingData,
      } as TastingRecord;
    });
  const tastings: TastingRecord[] = storedTastings.length > 0 ? storedTastings : [{
    id: `${row.id}-legacy`,
    createdAt,
    tasting: legacyTasting,
    sourceType: row.source_type ?? 'product',
    ...(row.event_id ? { eventId: row.event_id } : {}),
    ...(row.event_title ? { eventTitle: row.event_title } : {}),
  }];
  return {
    id: String(row.id),
    productId: row.product_id ?? 'unknown',
    productName: row.product_name ?? 'Unknown Tea',
    productType: row.product_type || '',
    productImage: row.product_image ?? undefined,
    note,
    tastings,
    createdAt,
    accountId: row.account_id ?? undefined,
    archived: row.archived === true || row.archived === 1,
    compassEntryId: row.compass_entry_id ?? undefined,
    synced: true,
  };
}

export default function JournalPage() {
  const navigate = useNavigate();
  const { tastingJournal } = useAppStore();
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const deepLink = readJournalDeepLink(window.location.search);

  useEffect(() => {
    if (!hasToken()) return;
    setFetching(true);
    api.tastingJournal.list()
      .then((data: any) => {
        const rows = Array.isArray(data) ? data : (data?.entries ?? []);
        const entries = rows.map(fromApiRow);
        if (entries.length > 0) {
          useAppStore.setState(state => {
            const serverById = new Map(entries.map((entry: CustomerTasting) => [entry.id, entry]));
            const retainedLocal = state.tastingJournal.filter(entry => !serverById.has(entry.id));
            const all = [...entries, ...retainedLocal]
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
        initialProductId={deepLink.productId}
        initialEntryId={deepLink.entryId}
      />
      <div className="mx-auto max-w-3xl px-4 pb-nav-gap-lg md:px-6">
        <PersonalTeaLinks current="journal" />
      </div>
    </>
  );
}
