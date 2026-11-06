import { test, expect } from './fixtures';
import { COMPASS_TOKEN, installCompassHarness, openCompass } from './helpers/compassHarness';
import { readFile } from 'node:fs/promises';

const bToken = (() => {
  const [header, body, signature] = COMPASS_TOKEN.split('.');
  const claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  return `${header}.${Buffer.from(JSON.stringify({ ...claims, sub: 'test-admin-b' })).toString('base64url')}.${signature}`;
})();

test('a shared shop renders each person’s unfinished work privately', async ({ page }) => {
  await installCompassHarness(page, { compassEntries: [{
    id: 'server-shared', name: 'Shared saved tea', category: 'tea', status: 'noted',
    photos: '[]', audio_clips: '[]', created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-01T00:00:00Z',
  }] });
  await openCompass(page);
  await page.getByPlaceholder('Tea name').filter({ visible: true }).fill('A unfinished capture');
  await page.evaluate(async token => {
    // @ts-expect-error Vite serves source modules to this local synthetic browser.
    const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
    // @ts-expect-error Vite source import.
    const { createEmptyEntry } = await import('/src/components/TeaCompass/types.ts');
    // @ts-expect-error Vite source import.
    const { useAppStore } = await import('/src/lib/store.ts');
    // @ts-expect-error Vite source import.
    const { setToken } = await import('/src/lib/api.ts');
    useTeaCompassStore.getState().addEntry({ ...createEmptyEntry('tea'), id: 'a-offline', name: 'A offline saved', synced: false });
    setToken(token);
    useAppStore.getState().setActiveUserId('test-admin-b');
  }, bToken);
  await expect(page.getByPlaceholder('Tea name').filter({ visible: true })).not.toHaveValue('A unfinished capture');
  await page.getByRole('tab', { name: 'Library', exact: true }).click();
  await expect(page.getByText('Shared saved tea', { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(page.getByText('A offline saved', { exact: true }).filter({ visible: true })).toHaveCount(0);

  await page.evaluate(async token => {
    // @ts-expect-error Vite source import.
    const { useAppStore } = await import('/src/lib/store.ts');
    // @ts-expect-error Vite source import.
    const { setToken } = await import('/src/lib/api.ts');
    setToken(token);
    useAppStore.getState().setActiveUserId('test-admin-uid');
  }, COMPASS_TOKEN);
  await page.getByRole('tab', { name: 'Source', exact: true }).click();
  await expect(page.getByPlaceholder('Tea name').filter({ visible: true })).toHaveValue('A unfinished capture');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByPlaceholder('Tea name').filter({ visible: true })).toHaveValue('A unfinished capture');
});

test('platform owner can explicitly export unidentified local work without assigning it', async ({ page }) => {
  await installCompassHarness(page);
  await openCompass(page);
  await page.evaluate(() => localStorage.setItem('teajia-curate-import-draft:acct-bali', '{"version":1,"text":"Unknown owner paste"}'));
  await page.getByRole('tab', { name: 'Library', exact: true }).click();
  await page.getByRole('button', { name: 'Recover older local work' }).click();
  await expect(page.getByRole('dialog', { name: 'Older local work recovery' })).toContainText('without a reliable author');
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download recovery file' }).click();
  const download = await event;
  const contents = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(contents).toMatchObject({ format: 'teajia-legacy-local-recovery-v1', accountId: 'acct-bali', ownership: 'unknown' });
  expect(contents.parts).toContainEqual({ source: 'localStorage', key: 'teajia-curate-import-draft:acct-bali', value: '{"version":1,"text":"Unknown owner paste"}' });
  expect(await page.evaluate(() => localStorage.getItem('teajia-curate-import-draft:acct-bali'))).toBe('{"version":1,"text":"Unknown owner paste"}');
});
