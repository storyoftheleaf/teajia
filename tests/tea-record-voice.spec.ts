import { test, expect, type Page } from './fixtures';
import { installCompassHarness, openCompass, expectNoUnhandledCompassApi } from './helpers/compassHarness';
import { openRecordSection } from './helpers/teaRecord';

const entryId = 'voice-linked-tea';
const transcript = 'The spring leaves have a clean mineral finish. Ask Chen about the harvest.';
const source = { id: entryId, name: 'Voice Mountain Tea', category: 'tea', type: 'Sheng', form: 'Loose', year: 2024, vendor_name: 'Chen Family', status: 'noted', notes: 'Original private notes must stay exact.', description: 'Original public description must stay exact.', photos: '[]', audio_clips: '[]', price_amount: 70, price_currency: 'Yuan', price_per_unit_grams: 100, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z' };
async function state(page: Page) {
  return page.evaluate(async id => {
    // @ts-expect-error Vite source import in browser fixture.
    const { useNotesStore } = await import('/src/lib/notesStore.ts');
    // @ts-expect-error Vite source import in browser fixture.
    const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
    return { notes: useNotesStore.getState().notes.filter((note: any) => note.compassEntryId === id && !note.deleted), entry: useTeaCompassStore.getState().getEntry(id) };
  }, entryId);
}

// The shop keeps each recording and answers with its id. Attaching that id to
// the tea is what saves the audio and its private voice note together, and the
// note's id comes from the recording, so one recording can never leave two notes.
const recordingId = (count: number) => `00000000-0000-4000-8000-${String(count).padStart(12, '0')}`;

test('phone shared tea recording stores one voice note per recording without rewriting source fields', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 851 });
  await installCompassHarness(page, { compassEntries: [source] });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) } });
    class FixtureRecorder {
      state = 'inactive';
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      static isTypeSupported() { return true; }
      constructor(_stream: unknown, _options?: unknown) {}
      start() { this.state = 'recording'; }
      stop() {
        this.state = 'inactive';
        this.ondataavailable?.({ data: new Blob([new Uint8Array(512)], { type: 'audio/webm' }) });
        this.onstop?.();
      }
    }
    Object.defineProperty(window, 'MediaRecorder', { configurable: true, value: FixtureRecorder });
  });
  let transcriptions = 0;
  const capturedContexts: string[] = [];
  let extractionCalls = 0;
  const synchronized: any[] = [];
  await page.route('**/api/transcribe', async route => {
    transcriptions += 1;
    capturedContexts.push(...await page.evaluate(() => new Promise<string[]>((resolve, reject) => {
      const open = indexedDB.open('teajia-capture', 1);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const read = db.transaction('pending-transcriptions', 'readonly').objectStore('pending-transcriptions').getAll();
        read.onsuccess = () => { resolve(read.result.map((record: any) => record.contextKey)); db.close(); };
        read.onerror = () => { reject(read.error); db.close(); };
      };
    })));
    expect(route.request().headers()['x-teajia-account']).toBe('acct-bali');
    const id = recordingId(transcriptions);
    await route.fulfill({ json: { text: transcript, recording_id: id, audio_url: `/api/transcriptions/${id}/audio` } });
  });
  const attached: Array<{ recording: string; body: unknown }> = [];
  await page.route('**/api/transcriptions/**', async route => {
    const request = route.request();
    const [, id, action] = new URL(request.url()).pathname.match(/\/api\/transcriptions\/([^/]+)\/([^/]+)$/) ?? [];
    if (request.method() === 'GET' && action === 'audio') return route.fulfill({ contentType: 'audio/webm', body: Buffer.alloc(512) });
    expect(request.method()).toBe('POST');
    expect(action).toBe('attach');
    expect(request.headers()['x-teajia-account']).toBe('acct-bali');
    attached.push({ recording: id, body: request.postDataJSON() });
    const audioUrl = `/api/transcriptions/${id}/audio`;
    const createdAt = new Date().toISOString();
    await route.fulfill({ json: {
      recording_id: id, audio_url: audioUrl,
      clip: { url: audioUrl, transcript, timestamp: createdAt, recordingId: id },
      note: { id: `recording-${id}`, account_id: 'acct-bali', compass_entry_id: entryId, text: transcript, source_type: 'voice', author_id: 'test-admin-uid', author_name: 'You', visibility: 'private', created_at: createdAt },
      entry: source,
    } });
  });
  await page.route('**/api/notes/sync', async route => {
    const input = route.request().postDataJSON();
    synchronized.push(...input.notes);
    await route.fulfill({ json: { syncedIds: input.notes.map((note: any) => note.id) } });
  });
  await page.route('**/api/curate/said/file', async route => {
    extractionCalls += 1;
    await route.fulfill({ json: { parts: [] } });
  });
  await openCompass(page);
  await page.getByRole('tab', { name: 'Library', exact: true }).click();
  const row = page.getByTestId(`library-entry-${entryId}`).filter({ visible: true });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: `Edit details for ${source.name}`, exact: true }).click();
  const record = page.getByTestId('library-entry-detail').filter({ visible: true });
  await expect(record).toBeVisible();
  // Recording a note is on the record's Notes tab.
  await openRecordSection(page, 'Source material');
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const microphone = record.getByRole('button', { name: 'Record a note', exact: true });
    await microphone.click();
    await expect(microphone).toContainText('Stop recording');
    await microphone.click();
    await expect(microphone).toBeEnabled();
    await expect.poll(() => transcriptions).toBe(attempt + 1);
    await expect.poll(async () => (await state(page)).notes.length).toBe(attempt + 1);
  }
  expect(attached).toEqual([1, 2].map(count => ({ recording: recordingId(count), body: { compass_entry_id: entryId } })));
  expect(capturedContexts).toEqual([`curate:test-admin-uid:acct-bali:${entryId}`, `curate:test-admin-uid:acct-bali:${entryId}`]);
  const saved = await state(page);
  expect(saved.notes[0]).toMatchObject({ accountId: 'acct-bali', authorId: 'test-admin-uid', compassEntryId: entryId, sourceType: 'voice', visibility: 'private', text: transcript });
  expect(saved.entry).toMatchObject({ id: entryId, notes: source.notes, description: source.description, type: source.type, year: source.year, priceAmount: source.price_amount });
  expect(saved.notes.map((note: any) => note.id).sort()).toEqual([1, 2].map(count => `recording-${recordingId(count)}`));
  expect(saved.entry.audioClips.map((clip: any) => clip.recordingId)).toEqual([1, 2].map(recordingId));
  // The shop wrote both notes when it attached the recordings; the device does
  // not send a second copy of either through the notes sync.
  expect(synchronized.filter(note => note.compass_entry_id === entryId)).toEqual([]);
  expect(extractionCalls).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await openRecordSection(page, 'Source material');
  await expect(record.getByRole('textbox', { name: 'Voice note from You', exact: true })).toHaveCount(2);
  await expect(record.getByRole('textbox', { name: 'Voice note from You', exact: true }).first()).toHaveValue(transcript);
  await page.screenshot({ path: test.info().outputPath('tea-record-phone-voice-source.png'), fullPage: true, animations: 'disabled' });
  await record.getByRole('textbox', { name: 'Voice note from You', exact: true }).first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: test.info().outputPath('tea-record-phone-voice-note.png'), fullPage: true, animations: 'disabled' });
  await expectNoUnhandledCompassApi(page);
});
