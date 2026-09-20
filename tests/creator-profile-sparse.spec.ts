import { expect, test } from './fixtures';
import { collectErrors, meaningfulErrors, mockCreatorApi, noHorizontalOverflow, setTheme } from './helpers/creatorFixtures';

// The floor. Wei Chen has a portrait, a name, a role and one paragraph, and
// nothing else. The page has to read as finished: no hub, no divider for a
// section that is not there, nothing that says "coming soon", and every word
// hers.

test.describe('creator profile, sparse (Wei Chen)', () => {
  test('renders the cover and one paragraph, and nothing for the sections she does not have', async ({ page }) => {
    const errors = collectErrors(page);
    await mockCreatorApi(page);
    await page.goto('/people/wei-chen');
    await expect(page.getByRole('heading', { level: 1, name: 'Wei Chen' })).toBeVisible();

    const cover = page.getByTestId('profile-cover');
    await expect(cover).toContainText('Tea master');
    await expect(cover.locator('h1 .italic')).toHaveText('Chen');
    await expect(cover).toContainText('I started sourcing oolong from Wuyi Shan in 2019.');

    const body = await page.locator('body').innerText();
    const lower = body.toLowerCase();
    // innerText carries the caps text-transform, so the divider reads "IN MY WORDS".
    expect(lower).toContain('in my words');
    expect(body).toContain('I am still learning the mountain every season.');
    expect(lower).not.toContain('coming soon');
    expect(body).not.toContain('Something went wrong');
    expect(body).not.toContain('→');

    // No hub: not one cell exists for her. And no divider for absent things.
    await expect(page.getByTestId('profile-hub')).toHaveCount(0);
    for (const missing of ['profile-gallery', 'profile-words', 'profile-teas', 'profile-hosting', 'profile-house', 'profile-reach']) {
      await expect(page.getByTestId(missing)).toHaveCount(0);
    }
    for (const absent of ['hands on', 'the teas', 'hosting', 'my table', 'reach me']) expect(lower).not.toContain(absent);

    // The way out is still there.
    await expect(page.getByRole('link', { name: 'All people', exact: true })).toHaveAttribute('href', '/people');

    expect(await noHorizontalOverflow(page)).toBe(true);
    expect(meaningfulErrors(errors), 'console errors on /people/wei-chen').toHaveLength(0);
    await page.screenshot({ path: 'test-results/creator-profile-wei-chen-dark.png', fullPage: true });
  });

  test('reads the same in light mode', async ({ page }) => {
    await mockCreatorApi(page);
    await setTheme(page, 'light');
    await page.goto('/people/wei-chen');
    await expect(page.getByRole('heading', { level: 1, name: 'Wei Chen' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.classList.contains('light'))).toBe(true);
    expect(await noHorizontalOverflow(page)).toBe(true);
    await page.screenshot({ path: 'test-results/creator-profile-wei-chen-light.png', fullPage: true });
  });

  test('a person nobody has published is a not-found, not a blank page', async ({ page }) => {
    await mockCreatorApi(page);
    await page.goto('/people/nobody-here');
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  });
});
