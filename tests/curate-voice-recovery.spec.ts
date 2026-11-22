import { expect, test } from './fixtures';
import { expectNoUnhandledCompassApi, installCompassHarness, openCompass } from './helpers/compassHarness';

test.use({
  launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
  permissions: ['microphone'],
});

test('the Source Notes microphone retries the same audio after reload and saves one voice note', async ({ page }) => {
  test.setTimeout(45_000);
  const entryId = 'voice-recovery-oolong';
  const teaName = 'Charcoal Oolong';
  const transcript = 'The supplier said this tea was charcoal roasted.';
  const recordingId = '00000000-0000-4000-8000-000000000001';
  const uploadedAudio: Buffer[] = [];
  const savedNotes = new Map<string, { id: string; compass_entry_id: string; source_type: string; text: string }>();
  await installCompassHarness(page, { compassEntries: [{
    id: entryId, name: teaName, type: 'Oolong', category: 'tea', status: 'noted',
    notes: '', photos: '[]', audio_clips: '[]', updated_at: new Date().toISOString(),
  }] });
  await page.route('**/api/transcribe', async route => {
    const request = route.request();
    const body = new Response(new Uint8Array(request.postDataBuffer()!), {
      headers: { 'content-type': request.headers()['content-type'] },
    });
    const file = (await body.formData()).get('file') as File;
    uploadedAudio.push(Buffer.from(await file.arrayBuffer()));
    return uploadedAudio.length === 1
      ? route.fulfill({ status: 503, json: { error: 'Transcription provider unavailable', code: 'provider_unavailable' } })
      : route.fulfill({ json: { text: transcript, recording_id: recordingId, audio_url: `/api/transcriptions/${recordingId}/audio` } });
  });
  // The shop saves the audio and its private voice note together when the
  // recording is attached to the tea; the note's id comes from the recording.
  const attached: unknown[] = [];
  await page.route('**/api/transcriptions/**', route => {
    const request = route.request();
    const audioUrl = `/api/transcriptions/${recordingId}/audio`;
    if (request.method() === 'GET' && request.url().endsWith(audioUrl)) return route.fulfill({ contentType: 'audio/webm', body: uploadedAudio[0] });
    expect(request.method()).toBe('POST');
    expect(new URL(request.url()).pathname).toBe(`/api/transcriptions/${recordingId}/attach`);
    attached.push(request.postDataJSON());
    const createdAt = new Date().toISOString();
    const note = { id: `recording-${recordingId}`, account_id: 'acct-bali', compass_entry_id: entryId, source_type: 'voice', text: transcript, author_id: 'test-admin-uid', author_name: 'You', visibility: 'private', created_at: createdAt };
    savedNotes.set(note.id, note);
    return route.fulfill({ json: { recording_id: recordingId, audio_url: audioUrl, clip: { url: audioUrl, transcript, timestamp: createdAt, recordingId }, note, entry: {} } });
  });
  await page.route('**/api/notes', route => route.fulfill({ json: { notes: [...savedNotes.values()] } }));
  await page.route('**/api/notes/sync', route => {
    const { notes } = route.request().postDataJSON();
    for (const note of notes) savedNotes.set(note.id, note);
    return route.fulfill({ json: { syncedIds: notes.map((note: { id: string }) => note.id) } });
  });

  const openTea = async () => {
    await expect.poll(() => page.evaluate(async id => {
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      return Boolean(useTeaCompassStore.getState().getEntry(id));
    }, entryId)).toBe(true);
    await page.evaluate(async id => {
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      useTeaCompassStore.getState().setActiveEntry(id);
    }, entryId);
    await expect(page.getByPlaceholder('Tea name').filter({ visible: true })).toHaveValue(teaName);
  };

  await openCompass(page);
  await openTea();
  const notes = page.getByTestId('curate-notes-band').filter({ visible: true });
  await notes.getByRole('button', { name: 'Tap to record a note', exact: true }).click();
  const stop = notes.getByRole('button', { name: 'Stop recording', exact: true });
  await expect(stop).toBeVisible();
  // Give the fake microphone a brief recording to encode.
  await page.waitForTimeout(800);
  await stop.click();
  const retry = page.getByRole('button', { name: 'Retry', exact: true }).filter({ visible: true });
  await expect(page.getByText('Transcription unavailable. Recording saved.').filter({ visible: true })).toBeVisible();
  expect(uploadedAudio[0].byteLength).toBeGreaterThan(100);
  expect(savedNotes.size).toBe(0);

  await page.reload();
  await openTea();
  await expect(retry).toBeVisible();
  await retry.click();
  await expect(page.getByText(transcript, { exact: true }).filter({ visible: true })).toHaveCount(1);
  await expect(retry).toHaveCount(0);
  expect(uploadedAudio).toHaveLength(2);
  expect(uploadedAudio[1]).toEqual(uploadedAudio[0]);
  await expect.poll(() => [...savedNotes.values()]).toEqual([
    expect.objectContaining({ compass_entry_id: entryId, source_type: 'voice', text: transcript }),
  ]);
  expect(attached).toEqual([{ compass_entry_id: entryId }]);
  await expectNoUnhandledCompassApi(page);
});
