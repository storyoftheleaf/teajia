import { test, expect } from '@playwright/test';
import { expectNoUnhandledCompassApi, installCompassHarness, openCompass } from './helpers/compassHarness';

const CART_ITEM = { id: 'compass-tea-1', name: '1998 Dong Ding', chineseName: '凍頂', type: 'Oolong', vendorName: 'Chen Family', grams: 10, compassEntryId: 'compass-tea-1' };

test.describe('Current Samples behavior remains reachable', () => {
  test.afterEach(async ({ page }) => expectNoUnhandledCompassApi(page));
  test.fixme('historical labels and tasting UI has no runtime entry point', async () => {
    // SampleSetCreator and SampleLabelSheet are only re-exported; Task 8 must mount them.
  });
  test('opens the current empty Sample List from Source', async ({ page }) => {
    await installCompassHarness(page);
    await openCompass(page);
    await page.getByRole('tab', { name: 'Samples', exact: true }).click();
    await expect(page.getByText('Sample List', { exact: true }).filter({ visible: true })).toBeVisible();
    await expect(page.getByText('Your sample list is empty', { exact: true }).filter({ visible: true })).toBeVisible();
  });

  test('shows count and saves a nonempty cart as a historical set', async ({ page }) => {
    await installCompassHarness(page, { sampleCart: [CART_ITEM] });
    await openCompass(page);
    await expect(page.getByRole('tab', { name: /Samples\s*\(1\)/ }).first()).toBeVisible();
    await page.getByRole('tab', { name: /Samples\s*\(1\)/ }).first().click();
    await expect(page.getByText('1 tea · 10g').filter({ visible: true })).toBeVisible();
    await page.getByRole('button', { name: 'Save as Sample Set' }).click();
    await expect.poll(async () => page.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem('teajia-samples') || '{}');
      return saved.state?.sampleSets?.length ?? 0;
    }), { message: 'Save as Sample Set must persist a historical set' }).toBe(1);

    await page.goto('/admin/samples', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/admin\/compass\?tab=samples/, { timeout: 15_000 });
  });

  test('historical sample preserves label identity and tasting linkage', async ({ page }) => {
    await installCompassHarness(page, { sampleCart: [CART_ITEM] });
    await openCompass(page);
    await page.getByRole('tab', { name: /Samples\s*\(1\)/ }).first().click();
    await page.getByRole('button', { name: 'Save as Sample Set' }).click();
    const historical = await page.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem('teajia-samples') || '{}');
      return saved.state?.samples?.[0];
    });
    expect(historical, 'Saved sample must remain available to the historical sample tools').toMatchObject({
      name: '1998 Dong Ding', chineseName: '凍頂', type: 'Oolong', compassEntryId: 'compass-tea-1', tastings: [],
    });
  });
});
