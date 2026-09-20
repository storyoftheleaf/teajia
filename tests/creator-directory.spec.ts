import { expect, test } from './fixtures';
import { collectErrors, meaningfulErrors, mockCreatorApi, noHorizontalOverflow } from './helpers/creatorFixtures';

// /people. Three fixtures render as cards; the one with no photo shows the
// identity mark in the same box; no text sits over an image; the filter row
// narrows to hosts and to writers.

test.describe('the people directory', () => {
  test('renders the three fixtures as image cards, with the identity mark where there is no photo', async ({ page }) => {
    const errors = collectErrors(page);
    await mockCreatorApi(page);
    await page.goto('/people');
    await expect(page.getByRole('heading', { level: 1, name: 'People' })).toBeVisible();
    await expect(page.getByText('Tea masters, hosts and writers on Teajia')).toBeVisible();

    const cards = page.getByTestId('people-card');
    await expect(cards).toHaveCount(3);
    await expect(cards.nth(0)).toHaveAttribute('href', '/people/amara-osei');
    await expect(cards.nth(1)).toHaveAttribute('href', '/people/kenji-tanaka');
    await expect(cards.nth(2)).toHaveAttribute('href', '/people/wei-chen');

    // Amara has no photo: the identity mark fills the same 4:5 box.
    const amara = cards.nth(0);
    await expect(amara.getByRole('img', { name: 'Amara Osei identity mark' })).toBeVisible();
    await expect(amara.locator('img')).toHaveCount(0);
    await expect(amara).toContainText('Tea Master');
    await expect(amara).toContainText('Osei Tea Imports · Portland');

    // Kenji has a photo, in a 4:5 box.
    const kenji = cards.nth(1);
    const kenjiImage = kenji.locator('img');
    await expect(kenjiImage).toHaveAttribute('alt', 'Kenji Tanaka');
    const box = await kenjiImage.boundingBox();
    expect(Math.abs((box?.height ?? 0) / (box?.width ?? 1) - 1.25)).toBeLessThan(0.05);

    // Never text on the photo: every name starts below its card's image.
    for (let index = 0; index < 3; index += 1) {
      const card = cards.nth(index);
      const imageBox = await card.locator('span').first().boundingBox();
      const nameBox = await card.getByText(['Amara Osei', 'Kenji Tanaka', 'Wei Chen'][index], { exact: true }).boundingBox();
      expect(nameBox!.y).toBeGreaterThanOrEqual(imageBox!.y + imageBox!.height);
    }

    const body = await page.locator('body').innerText();
    expect(body.toLowerCase()).toContain('3 people · more are invited each season');
    expect(body).not.toContain('→');
    expect(await noHorizontalOverflow(page)).toBe(true);
    expect(meaningfulErrors(errors), 'console errors on /people').toHaveLength(0);
    await page.screenshot({ path: 'test-results/creator-directory.png', fullPage: true });
  });

  test('the filter row narrows to hosts and to writers, with the active one underlined in gold', async ({ page }) => {
    await mockCreatorApi(page);
    await page.goto('/people');
    const filter = page.getByRole('navigation', { name: 'Filter' });
    await expect(filter.getByRole('button', { name: 'All · 3' })).toHaveAttribute('aria-pressed', 'true');

    await filter.getByRole('button', { name: 'Hosts' }).click();
    await expect(page.getByTestId('people-card')).toHaveCount(1);
    await expect(page.getByTestId('people-card')).toContainText('Kenji Tanaka');
    const hostsButton = filter.getByRole('button', { name: 'Hosts' });
    await expect(hostsButton).toHaveAttribute('aria-pressed', 'true');
    // The active underline carries the gold token's triplet; the inactive cells carry no underline colour of their own.
    const underline = await hostsButton.evaluate(element => getComputedStyle(element).borderBottomColor);
    const goldTriplet = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--tea-gold-rgb').trim().split(/\s+/).join(', '));
    expect(underline.startsWith(`rgb(${goldTriplet}`) || underline.startsWith(`rgba(${goldTriplet}`)).toBe(true);
    const idle = await filter.getByRole('button', { name: 'Writers' }).evaluate(element => getComputedStyle(element).borderBottomWidth);
    expect(idle).toBe('0px');

    await filter.getByRole('button', { name: 'Writers' }).click();
    await expect(page.getByTestId('people-card')).toHaveCount(2);
    await expect(page.getByTestId('people-card').nth(0)).toContainText('Amara Osei');
    await expect(page.getByTestId('people-card').nth(1)).toContainText('Kenji Tanaka');

    await filter.getByRole('button', { name: 'All · 3' }).click();
    await expect(page.getByTestId('people-card')).toHaveCount(3);
  });
});
