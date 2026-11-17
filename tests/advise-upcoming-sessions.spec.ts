import { expect, test } from './fixtures';
import { CORS } from './shared/media-stub';

test('Upcoming Sessions links to Events when a public session is available', async ({ page }) => {
  await page.route(/\/api\/events$/, route => route.fulfill({
    headers: CORS,
    json: [{
      id: 'session-1',
      slug: 'bali-tea-session',
      title: 'Bali Tea Session',
      event_date: new Date(Date.now() + 86_400_000).toISOString(),
      status: 'active',
    }],
  }));

  await page.goto('/advise');
  const sessions = page.getByRole('link', { name: /Upcoming Sessions/ });
  await expect(sessions).toHaveAttribute('href', '/events');
  await sessions.click();
  await expect(page).toHaveURL(/\/events$/);
  await expect(page.getByText('Bali Tea Session', { exact: true })).toBeVisible();
});

for (const status of [200, 503]) {
  test(`Upcoming Sessions stays coming soon when the events API returns ${status === 200 ? 'an empty list' : 'an error'}`, async ({ page }) => {
    await page.route(/\/api\/events$/, route => route.fulfill({
      status,
      headers: CORS,
      json: status === 200 ? [] : { error: 'Unavailable' },
    }));

    const response = page.waitForResponse(/\/api\/events$/);
    await page.goto('/advise');
    expect((await response).status()).toBe(status);
    await expect(page.getByLabel('Upcoming Sessions, coming soon')).toBeVisible();
    await expect(page.getByRole('link', { name: /Upcoming Sessions/ })).toHaveCount(0);
  });
}
