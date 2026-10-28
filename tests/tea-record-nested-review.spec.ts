import { test, expect } from './fixtures';
import { installCompassHarness, expectNoUnhandledCompassApi } from './helpers/compassHarness';

const teaName = 'Nested review Shuixian';
const tea = {
  id: 'nested-review-shuixian', name: teaName, category: 'tea', type: 'Oolong',
  form: 'Loose', status: 'noted', decision: 'selected', notes: '',
  description: 'Existing shop description', photos: '[]', audio_clips: '[]',
  price_amount: 80, price_currency: 'Yuan', price_per_unit_grams: 100,
  created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z',
};

for (const [screen, width, height] of [['desktop', 1360, 900], ['phone', 390, 844]] as const) {
  test(`${screen}: a workspace opened from the tea drawer accepts pointer and keyboard input without saving`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await installCompassHarness(page, { compassEntries: [tea] });
    const writes: string[] = [];
    page.on('request', request => {
      const path = new URL(request.url()).pathname;
      if (request.method() !== 'GET' && (path === '/api/compass/sync' || path.includes('/ar-create/links'))) writes.push(path);
    });
    await page.route('**/api/curate/ar-create/status', route => route.fulfill({ json: { connected: true, paired: true, canSearch: true } }));
    await page.goto('/admin/compass?tab=library', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: `Edit details for ${teaName}`, exact: true }).click();
    const details = page.getByRole('dialog', { name: 'Tea details', exact: true });
    await details.getByRole('tab', { name: 'Notes', exact: true }).click();
    const initialWrites = writes.length;
    await details.getByRole('button', { name: 'Build this tea', exact: true }).click();
    const workspace = page.getByRole('dialog', { name: 'Build this tea', exact: true });
    await workspace.getByRole('button', { name: 'Link a talk from AR Create', exact: true }).click();
    const search = workspace.getByRole('textbox', { name: 'Find a talk', exact: true });
    await search.fill('Shuixian');
    await expect(search).toBeFocused();
    await expect(search).toHaveValue('Shuixian');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `/private/tmp/tea-review-controls-${screen}.png`, animations: 'disabled' });
    await workspace.getByRole('button', { name: 'Discard changes', exact: true }).click();
    await expect(workspace).not.toBeVisible();
    await expect(details.getByRole('tab', { name: 'Notes', exact: true })).toBeVisible();
    expect(writes).toHaveLength(initialWrites);
    await expectNoUnhandledCompassApi(page);
  });
}
