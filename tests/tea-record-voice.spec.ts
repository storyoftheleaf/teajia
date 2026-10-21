import { test, expect, type Page } from './fixtures';
import { installCompassHarness, openCompass, expectNoUnhandledCompassApi } from './helpers/compassHarness';

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

test('phone shared tea recording stores one canonical voice note without rewriting source fields', async ({ page }) => {
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
    await route.fulfill({ json: { text: transcript, recording_id: `recording-${transcriptions}` } });
  });
  await page.route('**/api/transcriptions/*', async route => {
    expect(route.request().method()).toBe('DELETE');
    await route.fulfill({ json: { ok: true } });
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
  await row.getByRole('button', { name: `More about ${source.name}`, exact: true }).click();
  const record = page.getByTestId('library-entry-detail').filter({ visible: true });
  await expect(record).toBeVisible();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const microphone = record.getByRole('button', { name: 'Record a note', exact: true });
    await microphone.click();
    await expect(microphone).toContainText('Stop recording');
    await microphone.click();
    await expect(microphone).toBeEnabled();
    await expect.poll(() => transcriptions).toBe(attempt + 1);
    await expect.poll(async () => (await state(page)).notes.length).toBe(1);
  }
  expect(capturedContexts).toEqual([`curate:test-admin-uid:acct-bali:${entryId}`, `curate:test-admin-uid:acct-bali:${entryId}`]);
  const saved = await state(page);
  expect(saved.notes[0]).toMatchObject({ accountId: 'acct-bali', authorId: 'test-admin-uid', compassEntryId: entryId, sourceType: 'voice', visibility: 'private', text: transcript });
  expect(saved.entry).toMatchObject({ id: entryId, notes: source.notes, description: source.description, type: source.type, year: source.year, priceAmount: source.price_amount });
  await expect.poll(() => synchronized.filter(note => note.compass_entry_id === entryId).length).toBeGreaterThan(0);
  expect(new Set(synchronized.filter(note => note.compass_entry_id === entryId).map(note => note.id)).size).toBe(1);
  expect(extractionCalls).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await record.getByText('Source material', { exact: true }).click();
  await expect(record.getByRole('textbox', { name: 'Voice note from You', exact: true })).toHaveValue(transcript);
  await expect(record.locator('p').filter({ hasText: transcript })).toHaveCount(1);
  await page.screenshot({ path: '/private/tmp/tea-record-phone-voice-source.png', fullPage: true, animations: 'disabled' });
  await record.getByRole('textbox', { name: 'Voice note from You', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: '/private/tmp/tea-record-phone-voice-note.png', fullPage: true, animations: 'disabled' });
  await expectNoUnhandledCompassApi(page);
});
