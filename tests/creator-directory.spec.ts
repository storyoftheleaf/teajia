import { expect, test } from './fixtures';
import { collectErrors, meaningfulErrors, mockCreatorApi, noHorizontalOverflow } from './helpers/creatorFixtures';

// /people. The three fixtures render as cover cards: a 140px image on the
// left (or the identity mark), the kicker, the name with its italic gold
// surname, one line in their own words. No text sits over an image.

test.describe('the people directory', () => {
  test('renders the three fixtures as cover cards, with the identity mark where there is no photo', async ({ page }) => {
    const errors = collectErrors(page);
    await mockCreatorApi(page);
    await page.goto('/people');
    await expect(page.getByRole('heading', { level: 1, name: 'The People of Tea' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 }).locator('.italic')).toHaveText('of Tea');
    await expect(page.getByText('A room of tea masters · three people')).toBeVisible();
    await expect(page.getByText('Each page is theirs, in their own words.')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Site' })).toContainText('People · three tea masters');

    const cards = page.getByTestId('people-card');
    await expect(cards).toHaveCount(3);
    await expect(cards.nth(0)).toHaveAttribute('href', '/people/amara-osei');
    await expect(cards.nth(1)).toHaveAttribute('href', '/people/kenji-tanaka');
    await expect(cards.nth(2)).toHaveAttribute('href', '/people/wei-chen');

    // Amara has no photo: the identity mark fills the 140px box on the left.
    const amara = cards.nth(0);
    await expect(amara.getByRole('img', { name: 'Amara Osei identity mark' })).toBeVisible();
    await expect(amara.locator('img')).toHaveCount(0);
    await expect(amara).toContainText('Tea master · Portland');
    await expect(amara).toContainText('I am sourcing directly from smallholder gardens this year.');
    await expect(amara.locator('.italic').first()).toHaveText('Osei');

    // Kenji has a photo, 140px wide, the card 180px tall, and his words beside it, never over it.
    const kenji = cards.nth(1);
    const image = await kenji.locator('img').boundingBox();
    const cardBox = await kenji.boundingBox();
    expect(Math.round(image!.width)).toBe(140);
    expect(Math.round(cardBox!.height)).toBe(180);
    const nameBox = await kenji.getByText('Kenji Tanaka', { exact: true }).boundingBox();
    expect(nameBox!.x).toBeGreaterThanOrEqual(image!.x + image!.width);
    await expect(kenji).toContainText('Tea master · host · Kyoto');
    await expect(kenji).toContainText('I pour on Saturday evenings at Tanaka Tea House, four guests at most.');

    const body = await page.locator('body').innerText();
    expect(body.toLowerCase()).toContain('this season');
    expect(body).toContain('More are invited each season.');
    expect(body).not.toContain('→');
    expect(await noHorizontalOverflow(page)).toBe(true);
    expect(meaningfulErrors(errors), 'console errors on /people').toHaveLength(0);
    await page.screenshot({ path: 'test-results/creator-directory.png', fullPage: true });
  });

  test('every card is one link that opens the person', async ({ page }) => {
    await mockCreatorApi(page);
    await page.goto('/people');
    await page.getByTestId('people-card').nth(1).click();
    await expect(page).toHaveURL(/\/people\/kenji-tanaka$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Kenji Tanaka' })).toBeVisible();
  });
});
