import { test, expect } from '@playwright/test';
import { expectNoUnhandledCompassApi, installCompassHarness, openCompass } from './helpers/compassHarness';

test.describe('Curate context retrieval', () => {
  test.beforeEach(async ({ page }) => installCompassHarness(page));
  test.afterEach(async ({ page }) => expectNoUnhandledCompassApi(page));

  test('keeps context editable after the capture has other information', async ({ page }) => {
    await openCompass(page);
    await page.getByPlaceholder('Tea name (e.g., Tieguanyin, Bingdao…)').filter({ visible: true }).fill('Context tea');
    await page.getByRole('button', { name: 'Add journey or visit context' }).click();
    await page.getByRole('button', { name: /Taiwan, Spring 2026/ }).click();
    await page.getByRole('button', { name: 'Chen Family Taipei' }).click();
    await page.getByRole('button', { name: 'Apply context' }).click();
    await page.getByRole('button', { name: /Edit context:/ }).click();
    await expect(page.getByRole('button', { name: 'Clear context' })).toBeVisible();
  });

  test('reopens a committed Library entry and persists a later context edit', async ({ page }) => {
    await openCompass(page);
    await page.getByPlaceholder('Tea name (e.g., Tieguanyin, Bingdao…)').filter({ visible: true }).fill('Committed context tea');
    await page.getByRole('button', { name: 'Add journey or visit context' }).click();
    await page.getByRole('button', { name: /Taiwan, Spring 2026/ }).click();
    await page.getByRole('button', { name: 'Chen Family Taipei' }).click();
    await page.getByRole('button', { name: 'Apply context' }).click();
    const entryId = await page.evaluate(async () => {
      // @ts-expect-error Vite exposes source modules to the browser during Playwright runs.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      const id = useTeaCompassStore.getState().activeEntryId!;
      useTeaCompassStore.getState().commitEntry(id);
      return id;
    });

    await page.getByRole('tab', { name: 'Library', exact: true }).click();
    await page.getByRole('button', { name: /Committed context tea/ }).click();
    await page.getByTitle('Edit in Capture').filter({ visible: true }).click();
    await page.getByRole('button', { name: /Edit context: Taiwan, Spring 2026 · Chen Family/ }).click();
    await page.getByRole('button', { name: 'Clear context' }).click();

    const persisted = await page.evaluate(async id => {
      // @ts-expect-error Vite exposes source modules to the browser during Playwright runs.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      const entry = useTeaCompassStore.getState().entries.find((item: any) => item.id === id);
      return { journeyId: entry?.journeyId, visitId: entry?.visitId, synced: entry?.synced };
    }, entryId);
    expect(persisted).toEqual({ journeyId: null, visitId: null, synced: false });
  });
});

test.describe('Curate context management', () => {
  test.beforeEach(async ({ page }) => installCompassHarness(page, { contextEmpty: true }));
  test.afterEach(async ({ page }) => expectNoUnhandledCompassApi(page));

  test('creates, edits, and deletes Journeys and Visits from a useful empty state', async ({ page }) => {
    await openCompass(page);
    await page.getByRole('button', { name: 'Add journey or visit context' }).click();
    await expect(page.getByText('No journeys yet')).toBeVisible();
    await expect(page.getByText('Visits can stand alone or belong to a journey.')).toBeVisible();
    await page.getByRole('button', { name: 'New journey' }).click();
    await page.getByLabel('Journey name').fill('Yunnan');
    await page.getByLabel('Journey season').fill('Autumn');
    await page.getByLabel('Journey year').fill('2026');
    await page.getByRole('button', { name: 'Save journey' }).click();
    await page.getByRole('button', { name: 'Edit journey Yunnan' }).click();
    await page.getByLabel('Journey name').fill('Yunnan edited');
    await page.getByRole('button', { name: 'Save journey' }).click();
    await page.getByRole('button', { name: 'New visit' }).click();
    await page.getByLabel('Visit vendor').selectOption('vendor-chen');
    await page.getByLabel('Visit place').fill('Kunming');
    await page.getByRole('button', { name: 'Save visit' }).click();
    await page.getByRole('button', { name: 'Edit visit Chen Family' }).click();
    await page.getByLabel('Visit place').fill('Dali');
    await page.getByRole('button', { name: 'Save visit' }).click();
    await page.getByRole('button', { name: 'Delete visit Chen Family' }).click();
    await page.getByRole('button', { name: 'Delete journey Yunnan edited' }).click();
    await expect(page.getByText('No journeys yet')).toBeVisible();
  });
});
