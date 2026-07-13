import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearImportDraft,
  importDraftStorageKey,
  loadImportDraft,
  saveImportDraft,
  type ImportDraftSnapshot,
} from './importDraftStorage';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe('Curate import draft storage', () => {
  let storage: Storage;

  beforeEach(() => { storage = new MemoryStorage(); });

  it('recovers paste, Journey, and attachment descriptors only for the same account', () => {
    const snapshot: ImportDraftSnapshot = {
      text: '2024 Shan Lin Xi, 2 × 150g',
      journeyId: 'journey-taiwan',
      attachments: [{ id: 'file-1', name: 'invoice.pdf', size: 6144, type: 'application/pdf', kind: 'file' }],
    };

    saveImportDraft('account-a', snapshot, storage);

    expect(loadImportDraft('account-a', storage)).toEqual(snapshot);
    expect(loadImportDraft('account-b', storage)).toBeNull();
    expect(storage.getItem(importDraftStorageKey('account-a'))).not.toContain('fileBody');
  });

  it('clears only the selected account draft', () => {
    saveImportDraft('account-a', { text: 'A', journeyId: null, attachments: [] }, storage);
    saveImportDraft('account-b', { text: 'B', journeyId: null, attachments: [] }, storage);

    clearImportDraft('account-a', storage);

    expect(loadImportDraft('account-a', storage)).toBeNull();
    expect(loadImportDraft('account-b', storage)?.text).toBe('B');
  });

  it('rejects malformed and legacy draft payloads without leaking them across accounts', () => {
    storage.setItem(importDraftStorageKey('account-a'), JSON.stringify({ version: 99, text: 'old' }));
    storage.setItem(importDraftStorageKey('account-b'), '{bad json');

    expect(loadImportDraft('account-a', storage)).toBeNull();
    expect(loadImportDraft('account-b', storage)).toBeNull();
  });
});
