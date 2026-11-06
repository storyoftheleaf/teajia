import { describe, expect, it } from 'vitest';
import { collectLegacyLocalRecovery } from './LegacyLocalRecovery';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { useNotesStore } from '../../lib/notesStore';
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
