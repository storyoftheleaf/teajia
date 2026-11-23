import type { CustomerTasting, TastingData, TastingRecord } from '../types';
import { noteEditedAt } from './tastingJournalMerge';
import { mergeJournalEntries } from './tastingJournalTabs';

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
    personalNote: storedNote.personalNote ?? row.personal_note ?? undefined,
    rating: storedNote.rating ?? row.rating ?? undefined,
    ...(storedNote.verdict ? { verdict: storedNote.verdict } : {}),
    ...(storedNote.wouldBuy != null ? { wouldBuy: Boolean(storedNote.wouldBuy) } : {}),
    updatedAt: storedNote.updatedAt || createdAt,
  } as CustomerTasting['note'];
  const storedTastings = parseJsonArray(row.tastings)
    .filter(value => value && typeof value === 'object' && !Array.isArray(value))
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
    tasting: note.tasting,
    sourceType: row.source_type ?? undefined,
    ...(row.event_id ? { eventId: row.event_id } : {}),
    ...(row.event_title ? { eventTitle: row.event_title } : {}),
    ...(row.event_slug ? { eventSlug: row.event_slug } : {}),
  }];
  return {
    id: String(row.id),
    productId: row.product_id,
    productName: row.product_name ?? 'Unknown Tea',
    productType: row.product_type || '',
    productImage: row.product_image ?? undefined,
    note,
    tastings,
    createdAt,
    accountId: row.account_id ?? undefined,
    archived: row.archived === true || row.archived === 1 || row.archived === '1',
    compassEntryId: row.compass_entry_id ?? undefined,
    synced: true,
  };
}

export function journalEntryMatchesId(entry: CustomerTasting, id: string | null | undefined): boolean {
  return !!id && (entry.id === id || !!entry.previousIds?.includes(id));
}

export function journalEntryTime(entry: CustomerTasting): number {
  const edited = noteEditedAt(entry.note);
  return Number.isFinite(edited) ? edited : Date.parse(entry.createdAt) || 0;
}

export function mergePulledJournal(
  localEntries: CustomerTasting[],
  serverEntries: CustomerTasting[],
  atStart: ReadonlyMap<string, CustomerTasting>,
): CustomerTasting[] {
  const byProductId = new Map<string, CustomerTasting>();
  for (const entry of localEntries) {
    if (!entry.productId || entry.productId === 'quick-note') continue;
    const existing = byProductId.get(entry.productId);
    byProductId.set(entry.productId, existing ? mergeJournalEntries(existing, entry) : entry);
  }
  for (const server of serverEntries) {
    if (!server.productId || server.productId === 'quick-note') continue;
    const local = byProductId.get(server.productId);
    if (!local) {
      byProductId.set(server.productId, server);
      continue;
    }

    // The server retains its row ID on upsert. Links to a local entry saved
    // offline can still resolve after the device learns the canonical ID.
    const legacyId = `${server.id}-legacy`;
    const normalizeLegacy = server.tastings.some(sitting => sitting.id === legacyId);
    const normalizedLocal = normalizeLegacy
      ? { ...local, tastings: local.tastings.map(sitting => sitting.id === server.id ? { ...sitting, id: legacyId } : sitting) }
      : local;
    const merged = mergeJournalEntries(normalizedLocal, server);
    const previousIds = new Set([local.id, ...(merged.previousIds ?? [])]);
    previousIds.delete(server.id);
    const before = atStart.get(server.productId);
    // A push can finish while the older pull is still returning. Preserve
    // pending archive edits and any archive or restore made during the pull.
    const keepLocalArchive = local.synced === false || before?.synced === false || before?.archived !== local.archived;
    byProductId.set(server.productId, {
      ...merged,
      id: server.id,
      previousIds: previousIds.size ? [...previousIds] : undefined,
      accountId: server.accountId ?? local.accountId,
      compassEntryId: merged.compassEntryId ?? server.compassEntryId ?? local.compassEntryId,
      archived: keepLocalArchive ? local.archived : server.archived,
      synced: local.synced && server.synced,
    });
  }
  return [...byProductId.values()].sort((a, b) => journalEntryTime(b) - journalEntryTime(a));
}
