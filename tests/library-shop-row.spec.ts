import { test, expect, type Page } from './fixtures';
import { expectNoUnhandledCompassApi, installCompassHarness, openCompass } from './helpers/compassHarness';

const entryId = 'library-shop-row';
const photo = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/%3E';

async function openLibrary(page: Page) {
  await installCompassHarness(page, { compassEntries: [{
    id: entryId, name: 'Cloud Peak', chinese_name: '云峰', category: 'tea',
    type: 'Sheng', year: 2024, origin_region: 'Yunnan', vendor_name: 'Chen Family',
    status: 'noted', notes: 'smoky apricot', photos: JSON.stringify([photo]),
    price_amount: 20, price_currency: 'USD', price_per_unit_grams: 10,
    created_at: '2026-10-01T00:00:00.000Z', updated_at: '2026-10-01T00:00:00.000Z',
  }] });
  await page.route(`**/api/compass/entries/${entryId}`, route => route.request().method() === 'DELETE'
    ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) })
    : route.fallback());
  await openCompass(page);
  await page.getByRole('tab', { name: 'Library', exact: true }).click();
  await expect(page.getByTestId(`library-entry-${entryId}`).filter({ visible: true })).toBeVisible();
}

async function storedStatus(page: Page) {
  return page.evaluate(async id => {
    // @ts-expect-error Vite exposes source modules to browser tests.
    const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
    return useTeaCompassStore.getState().entries.find((entry: any) => entry.id === id)?.status;
  }, entryId);
}

test.describe('Library uses the shop row with working library actions', () => {
  test.beforeEach(async ({ page }) => openLibrary(page));
  test.afterEach(async ({ page }) => expectNoUnhandledCompassApi(page));

  test('shows the shared row and visible actions without horizontal overflow', async ({ page }, testInfo) => {
    const entry = page.getByTestId(`library-entry-${entryId}`).filter({ visible: true });
    await expect(entry.locator('[data-tea-ledger-row]')).toBeVisible();
    await expect(entry).toContainText('Cloud Peak');
    const actions = entry.getByTestId(`library-entry-actions-${entryId}`);
    for (const name of ['Want', 'Buy', 'Taste', 'Edit entry', 'Delete entry']) {
      await expect(actions.getByRole('button', { name, exact: true })).toBeVisible();
    }
    await expect(actions.getByRole('button', { name: 'Add to Sample list', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.evaluate(() => Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {}))));
    await page.screenshot({ animations: 'disabled', scale: 'css', path: `/private/tmp/library-shop-${testInfo.project.name.includes('Mobile') ? 'mobile' : 'desktop'}.png`, fullPage: true });
    const box = await entry.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  });

  test('toggles Want and Sample list from the attached row', async ({ page }) => {
    const actions = page.getByTestId(`library-entry-actions-${entryId}`).filter({ visible: true });
    await actions.getByRole('button', { name: 'Want', exact: true }).click();
    await expect(actions.getByRole('button', { name: 'Wanted', exact: true })).toBeVisible();
    await expect.poll(() => storedStatus(page)).toBe('want');
    await actions.getByRole('button', { name: 'Wanted', exact: true }).click();
    await expect.poll(() => storedStatus(page)).toBe('noted');
    await actions.getByRole('button', { name: 'Add to Sample list', exact: true }).click();
    await expect(actions.getByRole('button', { name: 'Remove from Sample list', exact: true })).toBeVisible();
    expect(await page.evaluate(async id => {
      // @ts-expect-error Vite source module.
      const { useSampleCartStore } = await import('/src/samples/sampleCartStore.ts');
      return useSampleCartStore.getState().items.some((item: any) => item.compassEntryId === id);
    }, entryId)).toBe(true);
    await actions.getByRole('button', { name: 'Remove from Sample list', exact: true }).click();
    await expect(actions.getByRole('button', { name: 'Add to Sample list', exact: true })).toBeVisible();
  });

  test('opens Taste and can return to edit the same entry', async ({ page }) => {
    const actions = page.getByTestId(`library-entry-actions-${entryId}`).filter({ visible: true });
    await actions.getByRole('button', { name: 'Taste', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Close', exact: true }).filter({ visible: true })).toBeVisible();
    await page.getByRole('button', { name: 'Close', exact: true }).filter({ visible: true }).click();
    await actions.getByRole('button', { name: 'Edit entry', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'Source', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByPlaceholder('Tea name').filter({ visible: true })).toHaveValue('Cloud Peak');
  });

  test('keeps Save independent of details and handles long names and zero or missing cost', async ({ page }) => {
    const entry = page.getByTestId(`library-entry-${entryId}`).filter({ visible: true });
    await entry.getByRole('button', { name: 'Save Cloud Peak', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(entry.getByRole('button', { name: 'Unsave Cloud Peak', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(entry.getByRole('button', { name: 'Show details for Cloud Peak', exact: true })).toHaveAttribute('aria-expanded', 'false');
    await expect.poll(() => storedStatus(page)).toBe('want');
    await page.evaluate(async id => {
      // @ts-expect-error Vite source module.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      useTeaCompassStore.setState((state: any) => ({ entries: state.entries.map((item: any) => item.id === id ? {
        ...item, name: 'A long tea name from a mountain garden that must remain readable in the Library',
        originRegion: 'Wuyi Mountains, Fujian, China', priceAmount: 0,
      } : item) }));
    }, entryId);
    await expect(entry).toContainText('$0.00');
    await expect(entry).toContainText('$0.00/g');
    expect(await entry.locator('[data-tea-ledger-row]').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await page.evaluate(async id => {
      // @ts-expect-error Vite source module.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      useTeaCompassStore.setState((state: any) => ({ entries: state.entries.map((item: any) => item.id === id ? { ...item, priceAmount: undefined } : item) }));
    }, entryId);
    await expect(entry.getByText('Cost', { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test('requires confirmation before deleting the entry', async ({ page }) => {
    const entry = page.getByTestId(`library-entry-${entryId}`).filter({ visible: true });
    const actions = entry.getByTestId(`library-entry-actions-${entryId}`);
    await actions.getByRole('button', { name: 'Delete entry', exact: true }).click();
    await expect(entry).toBeVisible();
    await actions.getByRole('button', { name: 'Delete?', exact: true }).click();
    await expect(entry).toHaveCount(0);
  });

  test('keeps mobile expansion and desktop detail selection', async ({ page }, testInfo) => {
    const entry = page.getByTestId(`library-entry-${entryId}`).filter({ visible: true });
    if (testInfo.project.name.includes('Mobile')) {
      await entry.getByRole('button', { name: 'Expand Cloud Peak details', exact: true }).click();
      await expect(entry.getByRole('button', { name: 'Collapse Cloud Peak details', exact: true })).toHaveAttribute('aria-expanded', 'true');
      await expect(entry.getByRole('button', { name: 'View photo 1', exact: true })).toBeVisible();
      await entry.getByRole('button', { name: 'Collapse Cloud Peak details', exact: true }).click();
      await expect(entry.getByRole('button', { name: 'Expand Cloud Peak details', exact: true })).toHaveAttribute('aria-expanded', 'false');
    } else {
      await entry.getByRole('button', { name: 'Open Cloud Peak details', exact: true }).click();
      await expect(page.getByTestId('library-entry-detail')).toContainText('Cloud Peak');
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
