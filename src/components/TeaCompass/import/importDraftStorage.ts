export interface ImportDraftAttachmentDescriptor {
  id: string;
  name: string;
  size: number;
  type: string;
  kind: 'photo' | 'file';
}

export interface ImportDraftSnapshot {
  text: string;
  journeyId: string | null;
  attachments: ImportDraftAttachmentDescriptor[];
}

const VERSION = 1;
const PREFIX = 'teajia-curate-import-draft:';

export function importDraftStorageKey(accountId: string) {
  return `${PREFIX}${accountId}`;
}

function validDescriptor(value: unknown): value is ImportDraftAttachmentDescriptor {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === 'string' && typeof row.name === 'string' && typeof row.size === 'number'
    && typeof row.type === 'string' && (row.kind === 'photo' || row.kind === 'file');
}

export function saveImportDraft(accountId: string, draft: ImportDraftSnapshot, storage?: Storage) {
  if (!accountId) return;
  try { (storage ?? localStorage).setItem(importDraftStorageKey(accountId), JSON.stringify({ version: VERSION, ...draft })); }
  catch { /* Capture remains usable when browser storage is unavailable or full. */ }
}

export function loadImportDraft(accountId: string, storage?: Storage): ImportDraftSnapshot | null {
  if (!accountId) return null;
  try {
    const value = JSON.parse((storage ?? localStorage).getItem(importDraftStorageKey(accountId)) || 'null') as Record<string, unknown> | null;
    if (!value || value.version !== VERSION || typeof value.text !== 'string'
      || !(typeof value.journeyId === 'string' || value.journeyId === null)
      || !Array.isArray(value.attachments) || !value.attachments.every(validDescriptor)) return null;
    return { text: value.text, journeyId: value.journeyId as string | null, attachments: value.attachments };
  } catch { return null; }
}

export function clearImportDraft(accountId: string, storage?: Storage) {
  if (!accountId) return;
  try { (storage ?? localStorage).removeItem(importDraftStorageKey(accountId)); }
  catch { /* Clearing an in-memory draft must not depend on browser storage. */ }
}

const correctionKey = (accountId: string, batchId: string, itemId: string) => `teajia-curate-correction:${accountId}:${batchId}:${itemId}`;

export function saveImportCorrection(accountId: string, batchId: string, itemId: string, fields: Record<string, string>, storage?: Storage) {
  if (!accountId) return;
  try { (storage ?? localStorage).setItem(correctionKey(accountId, batchId, itemId), JSON.stringify(fields)); } catch { /* Keep editing if storage is unavailable. */ }
}

export function loadImportCorrection(accountId: string, batchId: string, itemId: string, storage?: Storage): Record<string, string> | null {
  if (!accountId) return null;
  try {
    const fields: unknown = JSON.parse((storage ?? localStorage).getItem(correctionKey(accountId, batchId, itemId)) || 'null');
    return fields && typeof fields === 'object' && !Array.isArray(fields) && Object.values(fields).every(value => typeof value === 'string')
      ? fields as Record<string, string> : null;
  } catch { return null; }
}

export function clearImportCorrection(accountId: string, batchId: string, itemId: string, storage?: Storage) {
  if (!accountId) return;
  try { (storage ?? localStorage).removeItem(correctionKey(accountId, batchId, itemId)); } catch { /* Do not block a successful save. */ }
}
