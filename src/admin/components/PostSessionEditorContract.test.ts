import { describe, expect, it, vi } from 'vitest';
import { createPostSessionLoadCoordinator, createPostSessionUploadGuard, loadPostSession, postSessionEditorState, postSessionSavePayload, postSessionUploadErrorMessage, runPostSessionUpload, savePostSession } from './PostSessionEditorContract';

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

  it('ignores delayed event A when the reused editor has already loaded event B', async () => {
    let resolveA!: (value: Record<string, unknown>) => void;
    const eventA = new Promise<Record<string, unknown>>(resolve => { resolveA = resolve; });
    const get = vi.fn((eventId: string) => eventId === 'event-a'
      ? eventA
      : Promise.resolve({ event_id: 'event-b', gallery_images: ['b.jpg'], session_notes: 'B recap', host_notes: 'B host' }));
    const resets: string[] = [];
    let state = postSessionEditorState({});
    const loader = createPostSessionLoadCoordinator(get, () => { resets.push('reset'); state = postSessionEditorState({}); }, loaded => { state = loaded; });

    const loadingA = loader.load('event-a');
    const loadingB = loader.load('event-b');
    await loadingB;
    resolveA({ event_id: 'event-a', gallery_images: ['a.jpg'], session_notes: 'A recap', host_notes: 'A host' });
    await loadingA;

    expect(resets).toEqual(['reset', 'reset']);
    expect(state).toMatchObject({ gallery: ['b.jpg'], sessionNotes: 'B recap', hostNotes: 'B host' });
    expect(postSessionSavePayload(state)).toMatchObject({ gallery_images: ['b.jpg'], session_notes: 'B recap', host_notes: 'B host' });
    expect(JSON.stringify(postSessionSavePayload(state))).not.toContain('A recap');
  });

  it('ignores an event A image upload that completes after the editor moves to event B', () => {
    const gallery: string[] = [];
    const uploads = createPostSessionUploadGuard(url => gallery.push(url));
    uploads.activate('event-a');
    const eventAUpload = uploads.begin('event-a');

    uploads.activate('event-b');

    expect(eventAUpload.append('a-late.jpg')).toBe(false);
    expect(eventAUpload.isCurrent()).toBe(false);
    expect(gallery).toEqual([]);
  });

  it('suppresses every stale success side effect after event B starts uploading', async () => {
    let resolveUpload!: (url: string) => void;
    const pendingUpload = new Promise<string>(resolve => { resolveUpload = resolve; });
    const gallery: string[] = [];
    const uploads = createPostSessionUploadGuard(url => gallery.push(url));
    const success = vi.fn();
    const error = vi.fn();
    const complete = vi.fn();
    uploads.activate('event-a');
    const eventA = runPostSessionUpload(
      ['a.jpg'], uploads.begin('event-a'), async file => file, async () => pendingUpload,
      { onSuccess: success, onError: error, onComplete: complete },
    );
    await Promise.resolve();

    uploads.activate('event-b');
    uploads.begin('event-b');
    let eventBUploading = true;
    let eventBInput = 'b.jpg';
    complete.mockImplementation(() => { eventBUploading = false; eventBInput = ''; });
    resolveUpload('a-late.jpg');
    await eventA;

    expect(gallery).toEqual([]);
    expect(success).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
    expect({ eventBUploading, eventBInput }).toEqual({ eventBUploading: true, eventBInput: 'b.jpg' });
  });

  it('suppresses stale failure and cleanup after event B starts uploading', async () => {
    let rejectUpload!: (error: Error) => void;
    const pendingUpload = new Promise<string>((_resolve, reject) => { rejectUpload = reject; });
    const uploads = createPostSessionUploadGuard(() => undefined);
    const success = vi.fn();
    const error = vi.fn();
    const complete = vi.fn();
    uploads.activate('event-a');
    const eventA = runPostSessionUpload(
      ['a.jpg'], uploads.begin('event-a'), async file => file, async () => pendingUpload,
      { onSuccess: success, onError: error, onComplete: complete },
    );
    await Promise.resolve();

    uploads.activate('event-b');
    uploads.begin('event-b');
    let eventBUploading = true;
    let eventBInput = 'b.jpg';
    complete.mockImplementation(() => { eventBUploading = false; eventBInput = ''; });
    rejectUpload(new Error('A failed late'));
    await eventA;

    expect(success).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
    expect({ eventBUploading, eventBInput }).toEqual({ eventBUploading: true, eventBInput: 'b.jpg' });
  });

  it('preserves messages from duck-typed upload failures', () => {
    expect(postSessionUploadErrorMessage({ message: 'Storage quota reached' })).toBe('Storage quota reached');
    expect(postSessionUploadErrorMessage({ message: '' })).toBe('Upload failed');
    expect(postSessionUploadErrorMessage('network failure')).toBe('Upload failed');
  });

  it('suppresses every completion side effect after the editor unmounts', async () => {
    let resolveUpload!: (url: string) => void;
    const pendingUpload = new Promise<string>(resolve => { resolveUpload = resolve; });
    const gallery: string[] = [];
    const uploads = createPostSessionUploadGuard(url => gallery.push(url));
    const success = vi.fn();
    const error = vi.fn();
    const complete = vi.fn();
    uploads.activate('event-a');
    const pending = runPostSessionUpload(
      ['a.jpg'], uploads.begin('event-a'), async file => file, async () => pendingUpload,
      { onSuccess: success, onError: error, onComplete: complete },
    );
    await Promise.resolve();

    uploads.cancel();
    resolveUpload('a-after-unmount.jpg');
    await pending;

    expect(gallery).toEqual([]);
    expect(success).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
  });

  it('gives a newer same-event upload sole ownership of completion side effects', async () => {
    let resolveFirst!: (url: string) => void;
    const firstUrl = new Promise<string>(resolve => { resolveFirst = resolve; });
    const gallery: string[] = [];
    const uploads = createPostSessionUploadGuard(url => gallery.push(url));
    const firstSuccess = vi.fn();
    const firstError = vi.fn();
    const firstComplete = vi.fn();
    uploads.activate('event-a');
    const first = runPostSessionUpload(
      ['first.jpg'], uploads.begin('event-a'), async file => file, async () => firstUrl,
      { onSuccess: firstSuccess, onError: firstError, onComplete: firstComplete },
    );
    await Promise.resolve();

    const secondOperation = uploads.begin('event-a');
    resolveFirst('first-late.jpg');
    await first;

    expect(secondOperation.isCurrent()).toBe(true);
    expect(gallery).toEqual([]);
    expect(firstSuccess).not.toHaveBeenCalled();
    expect(firstError).not.toHaveBeenCalled();
    expect(firstComplete).not.toHaveBeenCalled();
  });
});
