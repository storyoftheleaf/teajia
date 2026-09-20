import { expect, test } from './fixtures';
import { collectErrors, meaningfulErrors, mockCreatorApi, noHorizontalOverflow, setTheme } from './helpers/creatorFixtures';

// The floor. Wei Chen has a portrait, a name, a role and one paragraph, and
// nothing else. The page has to read as finished: no empty hub, no empty
// sections, no placeholder for a thing that is not there, and nothing that
// says "coming soon".

test.describe('creator profile, sparse (Wei Chen)', () => {
  test('renders the masthead and one paragraph, and nothing for the sections she does not have', async ({ page }) => {
    const errors = collectErrors(page);
    await mockCreatorApi(page);
    await page.goto('/people/wei-chen');
    await expect(page.getByRole('heading', { level: 1, name: 'Wei Chen' })).toBeVisible();

    // innerText carries the caps text-transform, so the issue line reads "TEA MASTER".
    const body = await page.locator('body').innerText();
    const lower = body.toLowerCase();
    expect(lower).toContain('tea master');
    expect(body).toContain('Started sourcing oolong from Wuyi Shan in 2019.');
    // No pronouns on file, so the page says "their", never guessing from a name.
    expect(body).toContain('Their way with tea');
    expect(lower).not.toContain('coming soon');
    expect(body).not.toContain('Something went wrong');
    expect(body).not.toContain('→');

    // No hub: not one cell exists for her. And no section chrome for absent things.
    await expect(page.getByTestId('profile-hub')).toHaveCount(0);
    for (const missing of ['profile-gallery', 'profile-words', 'profile-teas', 'profile-hosting', 'profile-house', 'profile-reach']) {
      await expect(page.getByTestId(missing)).toHaveCount(0);
    }
    for (const absent of ['words', 'the teas', 'hosting', 'reach ', 'pay ']) expect(lower).not.toContain(absent);

    // The way out is still there.
    await expect(page.getByRole('link', { name: 'All people' })).toHaveAttribute('href', '/people');

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
