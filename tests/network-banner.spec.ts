import { expect, test } from '@playwright/test';

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? '/';

async function runNotesSync(page: import('@playwright/test').Page, background = false) {
  await page.evaluate(async ({ isBackground }) => {
    const { api } = await import('/src/lib/api.ts');
    await api.notes.sync([], { background: isBackground }).catch(() => undefined);
  }, { isBackground: background });
}

test('background API transport failure does not show the global banner', async ({ page }) => {
  test.setTimeout(45_000);
  await page.route('**/api/notes/sync', route => route.abort('failed'));
  await page.goto(baseUrl);

  await runNotesSync(page, true);

  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('foreground API failure shows unstable wording when the site probe also fails', async ({ page }) => {
  test.setTimeout(45_000);
  await page.route('**/api/notes/sync', route => route.abort('failed'));
  await page.route('**/version.json?probe=1', route => route.abort('failed'));
  await page.route('**/api/incidents', route => route.fulfill({
    status: 201,
    contentType: 'application/json',
    body: '{"incident":{}}',
  }));
  await page.goto(baseUrl);

  await runNotesSync(page);

  await expect(page.getByRole('alert')).toContainText('Connection is unstable. Retrying.');
});

test('foreground API failure uses server wording and clears after recovery', async ({ page }) => {
  test.setTimeout(45_000);
  await page.route('**/api/notes/sync', route => route.abort('failed'));
  await page.route('**/version.json?probe=1', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: '{}',
  }));
  await page.route('**/api/incidents', route => route.fulfill({
    status: 201,
    contentType: 'application/json',
    body: '{"incident":{}}',
  }));
  await page.goto(baseUrl);

  await runNotesSync(page);
  await expect(page.getByRole('alert')).toContainText('The server is taking too long. Retrying.');

  await page.route('**/api/notes', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: '{"notes":[]}',
  }));
  await page.evaluate(async () => {
    const { api } = await import('/src/lib/api.ts');
    await api.notes.getAll();
  });

  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('offline events use reconnect wording', async ({ page }) => {
  await page.goto(baseUrl);

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('teajia:network-error', {
      detail: { kind: 'offline' },
    }));
  });

  await expect(page.getByRole('alert')).toContainText("You're offline. Reconnect to keep going.");
  await page.getByRole('button', { name: 'Dismiss' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
});
