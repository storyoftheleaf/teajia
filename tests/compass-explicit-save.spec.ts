import { test, expect } from './fixtures';
import { installCompassHarness, openCompass, expectNoUnhandledCompassApi } from './helpers/compassHarness';

test.use({ launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] }, permissions: ['microphone'] });

test('Source status ignores other teas and Retry saves the current tea through foreground admission', async ({ page }) => {
  await installCompassHarness(page);
  await page.route('**/api/compass/sync', route => route.fulfill({ status: 503, json: { reason: 'background_paused' } }));
  let refuse = true;
  const savedIds: string[] = [];
  await page.route('**/api/compass/entries/*/save', async route => {
    savedIds.push(route.request().postDataJSON().entry.id);
    if (refuse) await route.fulfill({ status: 503, json: { error: 'Connection interrupted. Your changes are kept here.' } });
    else await route.fallback();
  });
  await openCompass(page, 'flow');
  await page.evaluate(async () => {
    const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
    useTeaCompassStore.setState({ syncError: true });
  });
  await expect(page.getByText('Not saved. Retry', { exact: true })).toHaveCount(0);
  const name = page.getByPlaceholder('Tea name').filter({ visible: true });
  await name.fill('Current tea with a working retry');
  await page.getByRole('button', { name: 'Save changes to this tea', exact: true }).filter({ visible: true }).click();
  await expect(page.getByRole('alert').filter({ visible: true })).toContainText('Connection interrupted');
  refuse = false;
  await page.getByRole('button', { name: 'Retry saving this tea', exact: true }).filter({ visible: true }).click();
  await expect(page.getByRole('status').filter({ hasText: /^Saved$/, visible: true })).toHaveText('Saved');
  await expect(name).toHaveValue('Current tea with a working retry');
  expect(savedIds).toHaveLength(2);
  expect(new Set(savedIds).size).toBe(1);
  await page.evaluate(async () => {
    const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
    useTeaCompassStore.setState({ syncError: true });
  });
  await expect(page.getByText('Not saved. Retry', { exact: true })).toHaveCount(0);
  expectNoUnhandledCompassApi(page);
});

test('Source Save waits for the exact tea acknowledgement and works while periodic sync is paused', async ({page})=>{
 await installCompassHarness(page);
 await page.route('**/api/compass/sync',route=>route.fulfill({status:503,json:{code:'shared_allowance_paused',reason:'background_paused'}}));
 let finish!:()=>void;
 const held=new Promise<void>(resolve=>{finish=resolve});
 let saved:any;
 await page.route('**/api/compass/entries/*/save',async route=>{saved=route.request().postDataJSON();await held;await route.fallback()});
 await openCompass(page,'flow');
 const name=page.getByPlaceholder('Tea name').filter({visible:true});
 await name.fill('Acknowledged Source tea');
 await page.getByRole('button',{name:'Save tea',exact:true}).filter({visible:true}).click();
 await expect.poll(()=>saved?.entry?.name).toBe('Acknowledged Source tea');
 await expect(name).toHaveValue('Acknowledged Source tea');
 await expect(page.getByRole('button',{name:'Save tea',exact:true}).filter({visible:true})).toBeDisabled();
 finish();
 await expect(name).toHaveValue('');
 await page.getByRole('tab',{name:'Library',exact:true}).filter({visible:true}).click();
 await expect(page.getByRole('button',{name:'Edit tea name: Acknowledged Source tea',exact:true})).toBeVisible();
 expectNoUnhandledCompassApi(page);
});

test('a refused Source Save keeps the same editor and retries the same tea ID',async({page})=>{
 await installCompassHarness(page);
 let reject=true;const ids:string[]=[];
 await page.route('**/api/compass/entries/*/save',async route=>{ids.push(route.request().postDataJSON().entry.id);if(reject)await route.fulfill({status:503,json:{error:'Save temporarily unavailable'}});else await route.fallback()});
 await openCompass(page,'flow');
 const name=page.getByPlaceholder('Tea name').filter({visible:true});await name.fill('Retained Source tea');
 const save=page.getByRole('button',{name:'Save tea',exact:true}).filter({visible:true});await save.click();
 await expect(page.getByRole('alert').filter({visible:true})).toContainText('Save temporarily unavailable');
 await expect(name).toHaveValue('Retained Source tea');
 reject=false;await save.click();await expect(name).toHaveValue('');
 expect(new Set(ids).size).toBe(1);
 expectNoUnhandledCompassApi(page);
});

test.describe('Source recorder with paused periodic sync', () => {
  test('a browser recording attaches once to its own tea and stays saved after reload', async ({ page }) => {
    const transcript = 'This tea has a floral aroma and a honey finish.';
    const recordingId = 'source-status-recording';
    const audioUrl = `/api/transcriptions/${recordingId}/audio`;
    let attachedTeaId = '';
    let uploadedBytes = 0;
    const notes: Record<string, unknown>[] = [];
    await installCompassHarness(page);
    await page.route('**/api/compass/sync', route => route.fulfill({ status: 503, json: { reason: 'background_paused' } }));
    await page.route('**/api/notes', route => route.fulfill({ json: { notes } }));
    await page.route('**/api/transcribe', async route => {
      const request = route.request();
      const form = await new Response(new Uint8Array(request.postDataBuffer()!), { headers: { 'content-type': request.headers()['content-type'] } }).formData();
      uploadedBytes = (form.get('file') as File).size;
      await route.fulfill({ json: { text: transcript, recording_id: recordingId, audio_url: audioUrl } });
    });
    await page.route(`**/api/transcriptions/${recordingId}/attach`, async route => {
      attachedTeaId = route.request().postDataJSON().compass_entry_id;
      const timestamp = new Date().toISOString();
      const note = { id: `recording-${recordingId}`, compass_entry_id: attachedTeaId, text: transcript, author_id: 'test-admin-uid', author_name: 'You', source_type: 'voice', visibility: 'private', created_at: timestamp };
      notes.splice(0, notes.length, note);
      await route.fulfill({ json: { recording_id: recordingId, audio_url: audioUrl, clip: { url: audioUrl, transcript, timestamp }, note, entry: {} } });
    });
    await openCompass(page, 'flow');
    await page.getByPlaceholder('Tea name').filter({ visible: true }).fill('Browser microphone status test');
    await page.getByRole('button', { name: 'Tap to record a note', exact: true }).filter({ visible: true }).click();
    const stop = page.getByTestId('curate-notes-band').filter({ visible: true }).getByRole('button', { name: 'Stop recording', exact: true });
    await expect(stop).toBeVisible();
    // Native MediaRecorder needs an audio chunk before Stop.
    await page.waitForTimeout(800);
    await stop.click();
    await expect.poll(() => attachedTeaId).not.toBe('');
    await expect.poll(() => page.evaluate(async () => {
      const { useNotesStore } = await import('/src/lib/notesStore.ts');
      return useNotesStore.getState().notes.filter(note => note.sourceType === 'voice').map(note => ({ text: note.text, tea: note.compassEntryId, synced: note.synced }));
    })).toEqual([{ text: transcript, tea: attachedTeaId, synced: true }]);
    expect(uploadedBytes).toBeGreaterThan(100);
    await expect(page.getByText('Not saved. Retry', { exact: true })).toHaveCount(0);
    await page.reload();
    await expect.poll(() => page.evaluate(async () => {
      const { useNotesStore } = await import('/src/lib/notesStore.ts');
      return useNotesStore.getState().notes.filter(note => note.sourceType === 'voice').map(note => ({ text: note.text, tea: note.compassEntryId, synced: note.synced }));
    })).toEqual([{ text: transcript, tea: attachedTeaId, synced: true }]);
    expectNoUnhandledCompassApi(page);
  });
});
