import { useAppStore } from './store';
import { api, hasToken } from './api';
import type { CustomerTasting, TastingRecord, TastingData } from '../types';

const BACKGROUND_REQUEST = { background: true } as const;

// Convert CustomerTasting → API payload shape (snake_case).
// `note` and `tastings` are sent as JSON strings; the worker stores them as TEXT.
function toApiPayload(entry: CustomerTasting): Record<string, any> {
  return {
    id: entry.id,
    product_id: entry.productId,
    product_name: entry.productName,
    product_type: entry.productType,
    product_image: entry.productImage ?? null,
    note: JSON.stringify(entry.note),
    tastings: JSON.stringify(entry.tastings),
    compass_entry_id: entry.compassEntryId ?? null,
    created_at: entry.createdAt,
    archived: entry.archived ? 1 : 0,
  };
}

export async function persistTastingJournalEntry(entry: CustomerTasting): Promise<void> {
  await api.tastingJournal.sync([toApiPayload(entry)]);
  useAppStore.setState(state => ({
    tastingJournal: state.tastingJournal.map(item => item.id === entry.id ? { ...item, synced: true } : item),
  }));
}

function safeParse<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') return (value ?? fallback) as T;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

// Convert API response row → CustomerTasting.
// Tolerant of legacy rows (pre-migration) that store flat fields instead of JSON.
function fromApiRow(row: Record<string, any>): CustomerTasting {
  const productId = row.product_id;
  const createdAt = row.created_at || new Date().toISOString();

  // New shape: server returns `note` and `tastings` as JSON.
  if (row.note || row.tastings) {
    const note = safeParse<CustomerTasting['note']>(row.note, {
      tasting: {} as TastingData,
      updatedAt: createdAt,
    });
    const tastings = safeParse<TastingRecord[]>(row.tastings, []);
    return {
      id: row.id,
      productId,
      productName: row.product_name,
      productType: row.product_type || '',
      productImage: row.product_image ?? undefined,
      note,
      tastings: tastings.length > 0 ? tastings : [{ id: row.id, createdAt, tasting: note.tasting }],
      compassEntryId: row.compass_entry_id ?? undefined,
      createdAt,
      accountId: row.account_id ?? undefined,
      archived: !!row.archived,
      synced: true,
    };
  }

  // Legacy shape: a single tasting per row. Wrap into the new shape.
  const tasting = safeParse<TastingData>(row.tasting, {} as TastingData);
  const personalNote = row.personal_note ?? undefined;
  const rating = row.rating ?? undefined;
  return {
    id: row.id,
    productId,
    productName: row.product_name,
    productType: row.product_type || '',
    productImage: row.product_image ?? undefined,
    note: {
      tasting,
      personalNote,
      rating,
      updatedAt: createdAt,
    },
    tastings: [{
      id: row.id,
      createdAt,
      tasting,
      sourceType: row.source_type ?? undefined,
      eventId: row.event_id ?? undefined,
      eventTitle: row.event_title ?? undefined,
    }],
    compassEntryId: row.compass_entry_id ?? undefined,
    createdAt,
    accountId: row.account_id ?? undefined,
    archived: false,
    synced: true,
  };
}

/**
 * Merge two CustomerTasting entries that target the same productId. Used both
 * by the client during hydration (server vs local conflict on productId) and
 * conceptually by the server-side dedupe migration. Tastings are merged by id,
 * note is taken from whichever side has the most recent updatedAt.
 */
function mergeEntries(a: CustomerTasting, b: CustomerTasting): CustomerTasting {
  const tastingsById = new Map<string, TastingRecord>();
  for (const t of [...a.tastings, ...b.tastings]) tastingsById.set(t.id, t);
  const tastings = [...tastingsById.values()].sort(
    (x, y) => new Date(x.createdAt).getTime() - new Date(y.createdAt).getTime()
  );
  const note = new Date(a.note.updatedAt).getTime() >= new Date(b.note.updatedAt).getTime()
    ? a.note
    : b.note;
  // Prefer the older id and createdAt to keep stable references.
  const olderCreated = new Date(a.createdAt).getTime() <= new Date(b.createdAt).getTime() ? a : b;
  return {
    ...olderCreated,
    productName: a.productName || b.productName,
    productType: a.productType || b.productType,
    productImage: a.productImage ?? b.productImage,
    note,
    tastings,
    archived: a.archived && b.archived,
    synced: a.synced && b.synced,
  };
}

/**
 * Syncs unsynced tasting journal entries to D1. Quick-note sentinel rows
 * (productId === 'quick-note') are skipped, and dropped from local state.
 */
export async function syncTastingJournal(): Promise<number> {
  if (!hasToken()) return 0;

  const { tastingJournal } = useAppStore.getState();
  // Drop legacy quick-note sentinels client-side. The server-side migration
  // also deletes them; this is the client's parallel pass.
  const validJournal = tastingJournal.filter(e => e.productId && e.productId !== 'quick-note');
  if (validJournal.length !== tastingJournal.length) {
    useAppStore.setState({ tastingJournal: validJournal });
  }

  const unsynced = validJournal.filter(e => !e.synced);
  if (unsynced.length === 0) return 0;

  try {
    const payload = unsynced.map(toApiPayload);
    await api.tastingJournal.sync(payload, BACKGROUND_REQUEST);

    useAppStore.setState(state => ({
      tastingJournal: state.tastingJournal.map(e =>
        unsynced.some(u => u.id === e.id) ? { ...e, synced: true } : e
      ),
    }));

    return unsynced.length;
  } catch (err) {
    console.warn('[TastingJournal] Sync failed:', err);
    return 0;
  }
}

/**
 * Hydrates the tasting journal from D1. Conflict key is (productId), not (id),
 * because a local-offline entry may have a different uuid than the server's.
 * For each productId, take the union of tastings and the most recent note.
 */
export async function hydrateTastingJournal(): Promise<void> {
  if (!hasToken()) return;

  try {
    const data = await api.tastingJournal.list(BACKGROUND_REQUEST);
    const rows = Array.isArray(data?.entries) ? data.entries
      : Array.isArray(data) ? data
      : [];
    const serverEntries: CustomerTasting[] = rows.map(fromApiRow);

    useAppStore.setState(state => {
      const local = state.tastingJournal.filter(e => e.productId && e.productId !== 'quick-note');
      const byProductId = new Map<string, CustomerTasting>();

      for (const entry of local) byProductId.set(entry.productId, entry);
      for (const server of serverEntries) {
        const existing = byProductId.get(server.productId);
        if (!existing) {
          byProductId.set(server.productId, { ...server, synced: true });
          continue;
        }
        // If local is unsynced, merge but keep `synced: false` so it gets pushed.
        const merged = mergeEntries(existing, server);
        byProductId.set(server.productId, {
          ...merged,
          synced: existing.synced && server.synced,
        });
      }

      const merged = [...byProductId.values()].sort(
        (a, b) => new Date(b.note.updatedAt).getTime() - new Date(a.note.updatedAt).getTime()
      );
      return { tastingJournal: merged };
    });
  } catch (err) {
    console.warn('[TastingJournal] Hydration failed:', err);
  }
}
