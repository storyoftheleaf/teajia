import { expect, test } from '@playwright/test';

test('background API transport failure does not show the global banner', async ({ page }) => {
  test.setTimeout(45_000);
  await page.route('**/api/notes/sync', route => route.abort('failed'));
  await page.goto(process.env.PLAYWRIGHT_BASE_URL ?? '/');

  await page.evaluate(async () => {
    const { api } = await import('/src/lib/api.ts');
    await api.notes.sync([], { background: true }).catch(() => undefined);
  });

  await expect(page.getByText(/No connection/)).toHaveCount(0);
});
