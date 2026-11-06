import { useState } from 'react';
import { X } from 'lucide-react';
import { isTokenScopedToAccount } from '../../lib/api';
import { useNotesStore } from '../../lib/notesStore';
import { useAppStore } from '../../lib/store';
import { useTeaCompassStore } from '../../lib/teaCompassStore';

const UNOWNED = '__legacy_unscoped__';
const matchesLegacyBucket = (key: string, accountId: string) =>
  key === accountId || key === UNOWNED || key === `__legacy_facade__:${accountId}` || key === `__legacy_facade__:${UNOWNED}`;

const hasContent = (source: string, value: unknown): boolean => {
  if (Array.isArray(value)) return value.length > 0;
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  if (source.endsWith('draftsByAccount')) return Array.isArray(row.pendingEntries) && row.pendingEntries.length > 0;
  if (source.endsWith('workspaceByPerson')) return !!(row.lastVendorId || row.lastVendorName || row.currentSessionId || row.lastCaptureAt);
  if (source.endsWith('encounterContextByAccount')) return !!(row.journeyId || row.visitId);
  return Object.keys(row).length > 0;
};

function legacyBrowserKeys(storage: Storage, accountId: string): string[] {
  const keys: string[] = [];
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && (
        key === 'teajia-compass-legacy-recovery' ||
        key === 'teajia-notes-legacy-recovery' ||
        key === `teajia-curate-import-draft:${accountId}` ||
        key.startsWith(`teajia-curate-correction:${accountId}:`) ||
        (key.startsWith('curate-said:') && !key.startsWith('curate-said:person:'))
      )) keys.push(key);
    }
  } catch { /* Browser storage may be unavailable. */ }
  return keys;
}

export function collectLegacyLocalRecovery(accountId: string, storage: Storage) {
  const compass = useTeaCompassStore.getState();
  const notes = useNotesStore.getState();
  const parts: Array<{ source: string; key: string; value: unknown }> = [];
  const addBuckets = (source: string, buckets: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(buckets)) {
      if (matchesLegacyBucket(key, accountId) && hasContent(source, value)) {
        parts.push({ source, key, value });
      }
    }
  };
  addBuckets('teajia-compass.entriesByAccount', compass.entriesByAccount);
  addBuckets('teajia-compass.deletedIdsByAccount', compass.deletedIdsByAccount);
  addBuckets('teajia-compass.pendingPromotionsByAccount', compass.pendingPromotionsByAccount);
  addBuckets('teajia-compass.draftsByAccount', compass.draftsByAccount);
  addBuckets('teajia-compass.workspaceByPerson', compass.workspaceByPerson);
  addBuckets('teajia-compass.encounterContextByAccount', compass.encounterContextByAccount);
  for (const [key, value] of Object.entries(notes.notesByPerson)) {
    if ((key === UNOWNED || key === `__facade_copy__:${UNOWNED}`) && value.length) {
      parts.push({ source: 'teajia-notes.notesByPerson', key, value: value.filter(note => note.accountId === accountId) });
    }
  }
  for (const [key, value] of Object.entries(notes.sessionsByPerson)) {
    if ((key === UNOWNED || key === `__facade_copy__:${UNOWNED}`) && value.length) {
      parts.push({ source: 'teajia-notes.sessionsByPerson', key, value: value.filter(session => session.accountId === accountId) });
    }
  }
  for (const key of legacyBrowserKeys(storage, accountId)) {
    try { parts.push({ source: 'localStorage', key, value: storage.getItem(key) }); } catch { /* Keep recoverable parts. */ }
  }
  return { format: 'teajia-legacy-local-recovery-v1', accountId, ownership: 'unknown', parts };
}

/** Explicit owner-only export. It does not load legacy records into any account or send them to the API. */
export function LegacyLocalRecovery() {
  const accountId = useAppStore(s => s.activeAccountId);
  const userId = useAppStore(s => s.activeUserId);
  const isPlatformOwner = useAppStore(s => s.platformRole === 'platform_owner');
  const compassLegacy = useTeaCompassStore(s => [
    ['entriesByAccount', s.entriesByAccount], ['draftsByAccount', s.draftsByAccount],
    ['workspaceByPerson', s.workspaceByPerson], ['encounterContextByAccount', s.encounterContextByAccount],
    ['deletedIdsByAccount', s.deletedIdsByAccount], ['pendingPromotionsByAccount', s.pendingPromotionsByAccount],
  ].some(([source, map]) => Object.entries(map as Record<string, unknown>).some(([key, value]) =>
    matchesLegacyBucket(key, accountId ?? '') && hasContent(source as string, value))));
  const notesLegacy = useNotesStore(s => [s.notesByPerson, s.sessionsByPerson].some(map =>
    Object.entries(map).some(([key, values]) => (key === UNOWNED || key === `__facade_copy__:${UNOWNED}`) && values.some(value => value.accountId === accountId))));
  const [open, setOpen] = useState(false);
  if (!accountId || !userId || !isPlatformOwner || !isTokenScopedToAccount(accountId, userId)) return null;
  let storage: Storage;
  try { storage = localStorage; } catch { return null; }
  const hasLegacy = compassLegacy || notesLegacy || legacyBrowserKeys(storage, accountId).length > 0;
  if (!hasLegacy) return null;

  const download = () => {
    if (!isTokenScopedToAccount(accountId, userId)) return;
    const recovery = collectLegacyLocalRecovery(accountId, storage);
    const blob = new Blob([JSON.stringify(recovery, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `teajia-local-recovery-${encodeURIComponent(accountId)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return <>
    <button type="button" onClick={() => setOpen(true)} className="min-h-11 rounded-md border border-tea-border px-3 text-ui-12 text-tea-text-sec hover:text-tea-text">
      Recover older local work
    </button>
    {open && <div className="fixed inset-0 z-modal flex items-center justify-center bg-tea-bg p-4 pb-nav-gap" role="dialog" aria-modal="true" aria-label="Older local work recovery">
      <div className="w-full max-w-lg rounded-xl border border-tea-border bg-tea-elevated p-5 text-tea-text">
        <button type="button" onClick={() => setOpen(false)} aria-label="Close recovery" className="tap-target text-tea-text-sec hover:text-tea-text"><X size={20} /></button>
        <h2 className="mt-4 font-display text-ui-26">Older local work</h2>
        <p className="mt-3 text-ui-14 text-tea-text-sec">This browser holds older Curate work without a reliable author. Download a local recovery file for review. Raw backups may include work from multiple shops. Nothing here is assigned to a person, uploaded or deleted.</p>
        <div className="mt-5 flex justify-end"><button type="button" onClick={download} className="cta-solid min-h-11 rounded-md px-4 text-ui-14">Download recovery file</button></div>
      </div>
    </div>}
  </>;
}
