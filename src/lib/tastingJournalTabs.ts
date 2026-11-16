import type { CustomerTasting, TastingRecord } from '../types';
import { mergeJournalSides } from './tastingJournalMerge';
import { capTastingJournal } from './tastingJournalCap';

/**
 * Two copies of one tea's journal entry joined by the shared rule in
 * `tastingJournalMerge.ts`: sittings united by id, and the side whose note was
 * edited later keeps its note (the first side wins a tie). Used when the shop's
 * copy is pulled (`tastingJournalSync.ts`) and when another tab writes the
 * journal (below).
 */
export function mergeJournalEntries(a: CustomerTasting, b: CustomerTasting): CustomerTasting {
  const { note, tastings } = mergeJournalSides<CustomerTasting['note'], TastingRecord>(a, b);
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
 * Every open tab holds the journal in memory and writes its whole copy back to
 * localStorage on any change to the store, so a tab that never heard about
 * another tab's tasting used to erase it on its next write. When another tab
 * writes, this tab joins that tab's journal into its own:
 *
 * - A tea only the other tab has is added, first, as that tab added it.
 * - A tea this tab has not touched since the stored copy it last saw (the
 *   event's old value) takes the other tab's copy whole, so an archive, a
 *   restore or an edit made there arrives here.
 * - A tea both tabs changed is merged with `mergeJournalEntries`, so nothing
 *   either tab recorded is dropped.
 * - A tea only this tab has is kept. Nothing is ever removed here.
 *
 * Returns `local` itself when nothing changed, so the caller can skip a write
 * and two tabs cannot keep answering each other.
 */
export function joinOtherTabJournal(
  local: CustomerTasting[],
  other: CustomerTasting[],
  lastSeen: CustomerTasting[] | null = null,
): CustomerTasting[] {
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const seenById = new Map((lastSeen ?? []).map(entry => [entry.id, entry]));
  const result = [...local];
  const added: CustomerTasting[] = [];
  let changed = false;

  for (const theirs of other) {
    if (!theirs || typeof theirs.id !== 'string') continue;
    let index = result.findIndex(entry => entry.id === theirs.id);
    if (index < 0 && !theirs.archived) {
      index = result.findIndex(entry => !entry.archived && entry.productId === theirs.productId);
    }
    if (index < 0) {
      added.push(theirs);
      changed = true;
      continue;
    }
    const ours = result[index];
    if (same(ours, theirs)) continue;
    const seen = seenById.get(ours.id);
    const untouchedHere = !!seen && same(seen, ours);
    const joined = untouchedHere ? theirs : mergeJournalEntries(ours, theirs);
    if (same(joined, ours)) continue;
    result[index] = joined;
    changed = true;
  }

  if (!changed) return local;
  // This tab's order is kept. The other tab puts a new tea first, so its new
  // teas go first here too, in its order.
  return capTastingJournal([...added, ...result]);
}

/** The journal inside one stored value of the persisted store, or null. */
export function journalInStoredValue(text: string | null | undefined): CustomerTasting[] | null {
  if (typeof text !== 'string') return null;
  try {
    const journal = (JSON.parse(text) as { state?: { tastingJournal?: unknown } })?.state?.tastingJournal;
    return Array.isArray(journal) ? journal as CustomerTasting[] : null;
  } catch {
    return null;
  }
}

/**
 * The other tab's stored value with only its journal replaced. Setting the
 * journal makes this tab write its whole saved state, and this tab's cart,
 * favourites and settings can be older than the ones the other tab just
 * wrote. Writing this back keeps theirs. Null when the text is unreadable.
 */
export function storedValueWithJournal(text: string | null | undefined, journal: CustomerTasting[]): string | null {
  if (typeof text !== 'string') return null;
  try {
    const stored = JSON.parse(text) as { state?: Record<string, unknown> };
    if (!stored || typeof stored !== 'object' || !stored.state || typeof stored.state !== 'object') return null;
    return JSON.stringify({ ...stored, state: { ...stored.state, tastingJournal: journal } });
  } catch {
    return null;
  }
}

interface JournalStore {
  getState(): { tastingJournal: CustomerTasting[] };
  setState(partial: { tastingJournal: CustomerTasting[] }): void;
}

/**
 * Listens for another tab writing the persisted store under `key` and joins
 * only its journal into this tab. Nothing else in the store (cart, sign-in,
 * settings) is read into this tab, and what the other tab stored for them is
 * left as it wrote it.
 */
export function listenForOtherTabJournal(store: JournalStore, key: string): () => void {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key !== key) return;
    const other = journalInStoredValue(event.newValue);
    if (!other) return;
    const local = store.getState().tastingJournal;
    const joined = joinOtherTabJournal(local, other, journalInStoredValue(event.oldValue));
    if (joined === local) return;
    store.setState({ tastingJournal: joined });
    // That write stored this tab's copy of everything. Put the other tab's
    // newer cart, favourites and settings back, with the joined journal.
    const kept = storedValueWithJournal(event.newValue, store.getState().tastingJournal);
    if (kept) {
      try { window.localStorage.setItem(key, kept); } catch { /* storage full or blocked: the journal is still joined in memory */ }
    }
  };
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}
