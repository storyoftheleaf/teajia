import { afterEach, describe, expect, it, vi } from 'vitest';
import { canRecoverLegacyLocalWork, collectLegacyLocalRecovery } from './LegacyLocalRecovery';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { useNotesStore } from '../../lib/notesStore';
import { useAppStore } from '../../lib/store';
import { clearToken, setToken } from '../../lib/api';
import { createEmptyEntry } from './types';

function memoryStorage(values: Record<string, string>): Storage {
  const rows = new Map(Object.entries(values));
  return {
    get length() { return rows.size; }, clear: () => rows.clear(),
    getItem: key => rows.get(key) ?? null, key: index => [...rows.keys()][index] ?? null,
    removeItem: key => { rows.delete(key); }, setItem: (key, value) => { rows.set(key, value); },
  };
}

describe('restricted Curate local recovery', () => {
  afterEach(() => { clearToken(); vi.unstubAllGlobals(); });
  it('checks current owner role and actor again at download time', () => {
    const storage = memoryStorage({});
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('sessionStorage', memoryStorage({}));
    vi.stubGlobal('window', { dispatchEvent: vi.fn() });
    const jwt = (userId: string, platformRole: string) => `h.${btoa(JSON.stringify({ sub: userId, active_account_id: 'acct-a', platform_role: platformRole }))}.s`;
    useAppStore.setState({ activeAccountId: 'acct-a', activeUserId: 'user-a', platformRole: 'platform_owner' });
    setToken(jwt('user-a', 'platform_owner'));
    expect(canRecoverLegacyLocalWork('acct-a', 'user-a')).toBe(true);
    useAppStore.setState({ platformRole: null });
    expect(canRecoverLegacyLocalWork('acct-a', 'user-a')).toBe(false);
    useAppStore.setState({ platformRole: 'platform_owner' });
    setToken(jwt('user-a', 'platform_admin'));
    expect(canRecoverLegacyLocalWork('acct-a', 'user-a')).toBe(false);
    setToken(jwt('user-b', 'platform_owner'));
    expect(canRecoverLegacyLocalWork('acct-a', 'user-a')).toBe(false);
  });
  it('exports only unidentified local fragments with their source and leaves bytes untouched', () => {
    const oldDraft = { ...createEmptyEntry('tea'), id: 'old-draft', draftAccountId: 'acct-a', name: 'Old draft' };
    const privateB = { ...createEmptyEntry('tea'), id: 'b-private', name: 'B private' };
    useTeaCompassStore.setState({
      entriesByAccount: { 'acct-a': [oldDraft], 'person:acct-a:user-b': [privateB] },
      draftsByAccount: { 'acct-a': { pendingEntries: [oldDraft], activeEntryId: oldDraft.id, sessionEntryIds: [oldDraft.id] } },
      workspaceByPerson: {}, encounterContextByAccount: {}, deletedIdsByAccount: {}, pendingPromotionsByAccount: {},
    });
    useNotesStore.setState({ notesByPerson: { __legacy_unscoped__: [] }, sessionsByPerson: {} });
    const oldPaste = '{"version":1,"text":"Unknown owner"}';
    const oldCorrection = '{"english_name":"Old correction"}';
    const storage = memoryStorage({
      'teajia-compass-legacy-recovery': ' exact original compass envelope ',
      'teajia-notes-legacy-recovery': ' exact original notes envelope ',
      'teajia-curate-import-draft:acct-a': oldPaste,
      'teajia-curate-correction:acct-a:batch:line': oldCorrection,
      'curate-said:old-draft:recording': '{"parts":[]}',
      'teajia-curate-import-draft:person:acct-a:user-b': '{"text":"B private"}',
    });
    const report = collectLegacyLocalRecovery('acct-a', storage);
    expect(report.ownership).toBe('unknown');
    expect(report.parts).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'teajia-compass.entriesByAccount', key: 'acct-a', value: [oldDraft] }),
      expect.objectContaining({ source: 'localStorage', key: 'teajia-compass-legacy-recovery', value: ' exact original compass envelope ' }),
      expect.objectContaining({ source: 'localStorage', key: 'teajia-notes-legacy-recovery', value: ' exact original notes envelope ' }),
      expect.objectContaining({ source: 'localStorage', key: 'teajia-curate-import-draft:acct-a', value: oldPaste }),
      expect.objectContaining({ source: 'localStorage', key: 'teajia-curate-correction:acct-a:batch:line', value: oldCorrection }),
    ]));
    expect(JSON.stringify(report)).not.toContain('B private');
    expect(storage.getItem('teajia-curate-import-draft:acct-a')).toBe(oldPaste);
    expect(storage.getItem('teajia-curate-correction:acct-a:batch:line')).toBe(oldCorrection);
  });
});
