import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from '../../../lib/store';
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

  const activate = (accountId: string, userId = 'user-a') => useAppStore.setState({ activeAccountId: accountId, activeUserId: userId });

  beforeEach(() => { storage = new MemoryStorage(); activate('account-a'); });

  it('recovers paste, Journey, and attachment descriptors only for the same account', () => {
    const snapshot: ImportDraftSnapshot = {
      text: '2024 Shan Lin Xi, 2 × 150g',
      journeyId: 'journey-taiwan',
      attachments: [{ id: 'file-1', name: 'invoice.pdf', size: 6144, type: 'application/pdf', kind: 'file' }],
    };

    saveImportDraft('account-a', snapshot, storage);

    expect(loadImportDraft('account-a', storage)).toEqual(snapshot);
    activate('account-b');
    expect(loadImportDraft('account-b', storage)).toBeNull();
    expect(storage.getItem(importDraftStorageKey('account-a'))).not.toContain('fileBody');
  });

  it('clears only the selected account draft', () => {
    saveImportDraft('account-a', { text: 'A', journeyId: null, attachments: [] }, storage);
    activate('account-b');
    saveImportDraft('account-b', { text: 'B', journeyId: null, attachments: [] }, storage);

    activate('account-a');
    clearImportDraft('account-a', storage);

    expect(loadImportDraft('account-a', storage)).toBeNull();
    activate('account-b');
    expect(loadImportDraft('account-b', storage)?.text).toBe('B');
  });

  it('rejects malformed and legacy draft payloads without leaking them across accounts', () => {
    storage.setItem(importDraftStorageKey('account-a'), JSON.stringify({ version: 99, text: 'old' }));
    activate('account-b');
    storage.setItem(importDraftStorageKey('account-b'), '{bad json');

    activate('account-a');
    expect(loadImportDraft('account-a', storage)).toBeNull();
    activate('account-b');
    expect(loadImportDraft('account-b', storage)).toBeNull();
  });

  it('keeps same-account people separate and leaves the old account-only key untouched', () => {
    const old = JSON.stringify({ version: 1, text: 'Unknown owner', journeyId: null, attachments: [] });
    storage.setItem('teajia-curate-import-draft:account-a', old);
    saveImportDraft('account-a', { text: 'A private paste', journeyId: null, attachments: [] }, storage);
    activate('account-a', 'user-b');
    expect(loadImportDraft('account-a', storage)).toBeNull();
    saveImportDraft('account-a', { text: 'B private paste', journeyId: null, attachments: [] }, storage);
    activate('account-a', 'user-a');
    expect(loadImportDraft('account-a', storage)?.text).toBe('A private paste');
    expect(storage.getItem('teajia-curate-import-draft:account-a')).toBe(old);
  });

  it('does not break capture when storage rejects quota or privacy writes', () => {
    const unavailable = new MemoryStorage();
    unavailable.setItem = () => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); };
    unavailable.removeItem = () => { throw new DOMException('Storage disabled', 'SecurityError'); };
    const snapshot: ImportDraftSnapshot = { text: 'Keep working', journeyId: null, attachments: [] };

    expect(() => saveImportDraft('account-a', snapshot, unavailable)).not.toThrow();
    expect(() => clearImportDraft('account-a', unavailable)).not.toThrow();
  });

  it('does not break capture when browser privacy blocks access to localStorage itself', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => { throw new DOMException('Storage disabled', 'SecurityError'); } });
    try {
      expect(() => saveImportDraft('account-a', { text: 'Private', journeyId: null, attachments: [] })).not.toThrow();
      expect(() => clearImportDraft('account-a')).not.toThrow();
      expect(() => loadImportDraft('account-a')).not.toThrow();
    } finally {
      if (original) Object.defineProperty(globalThis, 'localStorage', original);
      else delete (globalThis as { localStorage?: Storage }).localStorage;
    }
  });
});
