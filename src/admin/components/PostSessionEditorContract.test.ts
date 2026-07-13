import { describe, expect, it, vi } from 'vitest';
import { loadPostSession, postSessionEditorState, postSessionSavePayload, savePostSession } from './PostSessionEditorContract';

describe('PostSessionEditor contract', () => {
  it('reloads snake_case Worker data and legacy camelCase data', () => {
    expect(postSessionEditorState({
      tea_ledger: '{"teas":[]}', playlist_url: 'https://playlist.test', gallery_images: ['one.jpg'],
      session_notes: 'Shared recap', energy: 'contemplative', shared_tasting_notes: '["Mineral","Longan"]',
      host_notes: 'Host observation', host_changes: 'Use cooler water',
    })).toEqual({
      teaLedger: '{"teas":[]}', playlistUrl: 'https://playlist.test', gallery: ['one.jpg'],
      sessionNotes: 'Shared recap', energy: 'contemplative', sharedTastingNotes: 'Mineral\nLongan',
      hostNotes: 'Host observation', hostChanges: 'Use cooler water',
    });
    expect(postSessionEditorState({ hostNotes: 'Legacy host', hostChanges: 'Legacy change', gallery: ['legacy.jpg'] }))
      .toMatchObject({ hostNotes: 'Legacy host', hostChanges: 'Legacy change', gallery: ['legacy.jpg'] });
  });

  it('saves the exact snake_case Worker request body', () => {
    const state = {
      teaLedger: '{"teas":[]}', playlistUrl: 'https://playlist.test', gallery: ['one.jpg'],
      sessionNotes: 'Shared recap', energy: 'meditative', sharedTastingNotes: 'Mineral\nLongan',
      hostNotes: 'Host observation', hostChanges: 'Use cooler water',
    };
    expect(postSessionSavePayload(state)).toEqual({
      tea_ledger: '{"teas":[]}', playlist_url: 'https://playlist.test', gallery_images: ['one.jpg'],
      session_notes: 'Shared recap', energy: 'meditative', shared_tasting_notes: ['Mineral', 'Longan'],
      host_notes: 'Host observation', host_changes: 'Use cooler water',
    });
  });

  it('submits that body through the same save boundary used by the component', async () => {
    const submit = vi.fn().mockResolvedValue({ success: true });
    await savePostSession(submit, 'event-1', {
      teaLedger: '[]', playlistUrl: '', gallery: ['owned.jpg'], sessionNotes: 'Recap', energy: 'lively',
      sharedTastingNotes: 'Floral', hostNotes: 'Host', hostChanges: 'Change',
    });
    expect(submit).toHaveBeenCalledWith('event-1', {
      tea_ledger: '[]', playlist_url: '', gallery_images: ['owned.jpg'], session_notes: 'Recap', energy: 'lively',
      shared_tasting_notes: ['Floral'], host_notes: 'Host', host_changes: 'Change',
    });
  });

  it('save then reopen restores every field and a later save does not blank data', async () => {
    let persisted: Record<string, unknown> = {};
    const submit = vi.fn(async (_eventId: string, body: Record<string, unknown>) => { persisted = structuredClone(body); });
    const get = vi.fn(async () => structuredClone(persisted));
    const original = {
      teaLedger: '{"teas":[{"name":"Rou Gui"}]}', playlistUrl: 'https://playlist.test', gallery: ['owned.jpg'],
      sessionNotes: 'Shared recap', energy: 'contemplative', sharedTastingNotes: 'Mineral\nLongan',
      hostNotes: 'Host observation', hostChanges: 'Use cooler water',
    };
    await savePostSession(submit, 'event-1', original);
    const reopened = postSessionEditorState(await loadPostSession(get, 'event-1'));
    expect(reopened).toEqual(original);
    await savePostSession(submit, 'event-1', reopened);
    expect(persisted).toEqual(postSessionSavePayload(original));
  });
});
