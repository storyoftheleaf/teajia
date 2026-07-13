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

export function saveImportDraft(accountId: string, draft: ImportDraftSnapshot, storage: Storage = localStorage) {
  if (!accountId) return;
  storage.setItem(importDraftStorageKey(accountId), JSON.stringify({ version: VERSION, ...draft }));
}

export function loadImportDraft(accountId: string, storage: Storage = localStorage): ImportDraftSnapshot | null {
  if (!accountId) return null;
  try {
    const value = JSON.parse(storage.getItem(importDraftStorageKey(accountId)) || 'null') as Record<string, unknown> | null;
    if (!value || value.version !== VERSION || typeof value.text !== 'string'
      || !(typeof value.journeyId === 'string' || value.journeyId === null)
      || !Array.isArray(value.attachments) || !value.attachments.every(validDescriptor)) return null;
    return { text: value.text, journeyId: value.journeyId as string | null, attachments: value.attachments };
  } catch { return null; }
}

export function clearImportDraft(accountId: string, storage: Storage = localStorage) {
  if (accountId) storage.removeItem(importDraftStorageKey(accountId));
}
