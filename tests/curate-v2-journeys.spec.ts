/**
 * Curate v2: the journeys it must walk (todo/plans/curate-v2-journeys.md).
 * Every step says what is on screen, which tab is lit, and where Back lands.
 * Phone size only: this is what Adrian holds at the vendor's table.
 */
import { test, expect, type Page } from './fixtures';
import {
  compassCreatedCustomers,
  expectNoUnhandledCompassApi,
  installCompassHarness,
  openCurateV2,
} from './helpers/compassHarness';

const VENDORS = [
  { id: 'vendor-wang', name: 'Wang Laoshi', tags: ['vendor'] },
  { id: 'vendor-chen', name: 'Chen Family', tags: ['vendor'] },
];

const tab = (page: Page, name: string) => page.getByRole('tab', { name, exact: true });
const selectedTab = async (page: Page) => {
  const tabs = await page.getByRole('tab').all();
  const lit: string[] = [];
  for (const t of tabs) if ((await t.getAttribute('aria-selected')) === 'true') lit.push((await t.textContent() ?? '').trim());
  return lit;
};
const shot = (page: Page, name: string) => page.screenshot({ path: `test-results/curate-v2-journeys/${name}.png` });
const header = (page: Page) => page.getByTestId('table-header');
const nameLine = (page: Page) => page.getByRole('textbox', { name: 'Name the next tea' });
const overlay = (page: Page) => page.getByTestId('curate-tea-overlay');
const backFromHeader = (page: Page) => page.getByRole('button', { name: 'Back', exact: true }).first();

async function addTea(page: Page, line: string) {
  await nameLine(page).fill(line);
  await nameLine(page).press('Enter');
}

/** The scroll area that holds the current tab's body. */
const tabScroller = (page: Page) => page.getByTestId('curate-tab-body').locator('> div').first();

test.describe('Curate v2 journeys (phone)', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'Mobile Chrome', 'Journeys are walked at phone size');
  });
  test.afterEach(async ({ page }) => expectNoUnhandledCompassApi(page));

  test('Journey 1: at the table, steps 1 to 7', async ({ page }) => {
    await installCompassHarness(page, { customers: VENDORS });
    await openCurateV2(page, 'table');

    // 1. No open table: one line, nothing else.
    await expect(page.getByTestId('table-start')).toContainText('Start a table');
    await expect(header(page)).toHaveCount(0);
    await expect(nameLine(page)).toHaveCount(0);
    await expect(page.getByTestId('vendor-picker')).toHaveCount(0);
    expect(await selectedTab(page)).toEqual(['Table']);

    await shot(page, '1-no-table');

    // 2. Tap it: the vendor picker. Type "Wa", see Wang Laoshi, tap.
    await page.getByTestId('table-start').click();
    const picker = page.getByTestId('vendor-picker');
    await expect(picker).toBeVisible();
    await expect(picker.getByTestId('vendor-picker-new')).toContainText('New vendor…');
    await picker.getByRole('textbox', { name: 'Search or add a vendor' }).fill('Wa');
    await expect(picker.getByTestId('vendor-picker-new')).toContainText('New vendor "Wa"');
    await expect(picker.getByRole('button', { name: 'Chen Family' })).toHaveCount(0);
    await shot(page, '2-picker');
    await picker.getByRole('button', { name: 'Wang Laoshi' }).click();
    await expect(picker).toHaveCount(0);

    // 3. The header: vendor · 0 teas · ¥, with "new table" on the right.
    await expect(header(page)).toContainText('Wang Laoshi');
    await expect(page.getByTestId('table-count')).toHaveText('0 teas');
    await expect(page.getByLabel('Currency at this table')).toHaveValue('Yuan');
    await expect(page.getByLabel('Currency at this table').locator('option:checked')).toHaveText('¥');
    await expect(header(page).getByRole('button', { name: 'new table' })).toBeVisible();
    await expect(nameLine(page)).toBeVisible();

    // 4. Five teas, each as a row: name, year, price and unit, Taste frame, mic frame.
    await addTea(page, 'Yiwu Gushu 2019 ¥1200/cake');
    const rows = page.getByTestId('table-list').locator('.curate-v2-row').filter({ has: page.getByRole('button', { name: /^Fast tasting for/ }) });
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Yiwu Gushu');
    await expect(rows.first()).toContainText('2019');
    await expect(rows.first()).toContainText('¥1,200');
    await expect(rows.first()).toContainText('cake');
    await expect(rows.first().getByRole('button', { name: /^Fast tasting for/ })).toBeVisible();
    await expect(rows.first().getByRole('button', { name: /^Talk about/ })).toBeVisible();
    await expect(page.getByTestId('table-count')).toHaveText('1 tea');
    for (const line of ['Mengku Laobanzhang 2018 ¥450/cake', 'Bulang Shengcha 2020 ¥300/cake', 'Jingmai 2017 ¥800/cake', 'Nannuo 2021 ¥260/cake']) {
      await addTea(page, line);
    }
    await expect(rows).toHaveCount(5);
    await expect(page.getByTestId('table-count')).toHaveText('5 teas');
    // Oldest first: the pour order, newest at the bottom.
    await expect(rows.first()).toContainText('Yiwu Gushu');
    await expect(rows.last()).toContainText('Nannuo');
    expect(await selectedTab(page)).toEqual(['Table']);

    await shot(page, '4-five-teas');

    // 5. Taste on a row: six answers, close; the row reads "8 · Clean"; the frame is gold.
    const firstTaste = rows.first().getByRole('button', { name: /^Fast tasting for/ });
    await expect(firstTaste).not.toHaveClass(/is-on/);
    await firstTaste.click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    await sheet.getByRole('group', { name: 'How good' }).getByRole('button', { name: '8', exact: true }).click();
    await sheet.getByRole('group', { name: 'How clean' }).getByRole('button', { name: 'Clean', exact: true }).click();
    await sheet.getByRole('group', { name: 'How drying' }).getByRole('button', { name: 'None', exact: true }).click();
    await sheet.getByRole('group', { name: 'How full' }).getByRole('button', { name: 'Medium', exact: true }).click();
    await sheet.getByRole('group', { name: 'Tastes of' }).getByRole('button', { name: 'Sweet', exact: true }).click();
    await sheet.getByRole('group', { name: 'Stays' }).getByRole('button', { name: 'Long', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await expect(rows.first()).toContainText('8 · Clean');
    await expect(rows.first().getByRole('button', { name: /^Fast tasting for/ })).toHaveClass(/is-on/);
    expect(await selectedTab(page)).toEqual(['Table']);

    // 6. Tap a row: the tea over the Table tab, TABLE still lit. Back: the rows.
    await rows.nth(2).getByRole('button').first().click();
    await expect(overlay(page)).toBeVisible();
    await expect(overlay(page)).toHaveAttribute('data-layer', 'face');
    await expect(overlay(page)).toContainText('Bulang Shengcha');
    expect(await selectedTab(page)).toEqual(['Table']);
    await shot(page, '6-tea-over-table');
    await expect(page.getByTestId('curate-tab-body')).toHaveAttribute('inert', ''); // the rows are underneath, out of reach
    await backFromHeader(page).click();
    await expect(overlay(page)).toHaveCount(0);
    await expect(page.getByTestId('curate-tab-body')).not.toHaveAttribute('inert', '');
    await expect(rows).toHaveCount(5);
    expect(await selectedTab(page)).toEqual(['Table']);
    await expect(header(page)).toContainText('Wang Laoshi');

    // 7. New table: the picker again; afterwards the rows are empty.
    await header(page).getByRole('button', { name: 'new table' }).click();
    await expect(page.getByTestId('vendor-picker')).toBeVisible();
    await expect(page.getByTestId('table-count')).toHaveText('0 teas');
    await expect(rows).toHaveCount(0);
    // The old vendor is not shown while the new one is being chosen.
    await expect(header(page)).toContainText('Whose table?');
    await page.getByTestId('vendor-picker').getByRole('button', { name: 'Chen Family' }).click();
    await expect(header(page)).toContainText('Chen Family');
    await expect(rows).toHaveCount(0);
    await expect(page.getByTestId('table-count')).toHaveText('0 teas');

    // The previous table's teas are in Teas, and the tasted one is waiting on Today.
    await tab(page, 'Teas').click();
    await expect(page.getByText('Yiwu Gushu', { exact: false }).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText('Nannuo', { exact: false }).filter({ visible: true }).first()).toBeVisible();
    await tab(page, 'Today').click();
    await expect(page.getByRole('button', { name: /Yiwu Gushu.*Decide/ })).toBeVisible();
  });

  test('Journey 1: a new vendor is one tap and a real vendor record', async ({ page }) => {
    await installCompassHarness(page, { customers: VENDORS });
    await openCurateV2(page, 'table');
    await page.getByTestId('table-start').click();
    const picker = page.getByTestId('vendor-picker');
    await picker.getByTestId('vendor-picker-new').click();
    await picker.getByRole('textbox', { name: 'New vendor name' }).fill('Lu Zhaokai');
    await picker.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(picker).toHaveCount(0);
    await expect(header(page)).toContainText('Lu Zhaokai');
    await expect.poll(() => compassCreatedCustomers(page).length).toBe(1);
    const created = compassCreatedCustomers(page)[0];
    expect(created.name).toBe('Lu Zhaokai');
    expect(created.tags).toEqual(['vendor']);

    // A vendor can be named later: it fills every tea that has none.
    await header(page).getByRole('button', { name: 'new table' }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('vendor-picker')).toHaveCount(0);
    await expect(header(page)).toContainText('Whose table?');
    await addTea(page, 'Old Tree Red 2015 ¥500/cake');
    await addTea(page, 'Jingmai Mao Cha ¥90/100g');
    await expect(page.getByTestId('table-count')).toHaveText('2 teas');
    await header(page).getByRole('button', { name: /Whose table/ }).click();
    await page.getByTestId('vendor-picker').getByRole('textbox', { name: 'Search or add a vendor' }).fill('Che');
    await page.getByTestId('vendor-picker').getByRole('button', { name: 'Chen Family' }).click();
    await expect(header(page)).toContainText('Chen Family');
    const vendors = await page.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem('teajia-compass') || '{}');
      const all = Object.values(raw.state?.entriesByAccount ?? {}).flat() as Array<{ name: string; vendorName?: string; vendorId?: string }>;
      return all.filter((e) => /Old Tree|Jingmai Mao/.test(e.name)).map((e) => `${e.name}|${e.vendorName}|${e.vendorId}`).sort();
    });
    expect(vendors).toEqual(['Jingmai Mao Cha|Chen Family|vendor-chen', 'Old Tree Red|Chen Family|vendor-chen']);
  });

  test('Today: "Start a table" lands on the Table tab with the vendor picker open', async ({ page }) => {
    await installCompassHarness(page, { customers: VENDORS });
    await openCurateV2(page, 'today');
    await page.getByRole('button', { name: 'Start a table' }).click();
    expect(await selectedTab(page)).toEqual(['Table']);
    await expect(page.getByTestId('vendor-picker')).toBeVisible();
    await expect(header(page)).toContainText('Whose table?');
    await page.getByTestId('vendor-picker').getByRole('button', { name: 'Wang Laoshi' }).click();
    await expect(header(page)).toContainText('Wang Laoshi');
    // Back goes to where the table was started from.
    await backFromHeader(page).click();
    expect(await selectedTab(page)).toEqual(['Today']);
  });

  test('A tea opens on top of Today: TODAY stays lit and Back returns to Today', async ({ page }) => {
    await installCompassHarness(page, {
      customers: VENDORS,
      compassEntries: [{
        id: 'seeded-oolong', name: 'Seeded Oolong', category: 'tea', type: 'Oolong', status: 'noted', vendor_name: 'Chen Family',
        created_at: '2026-10-01T00:00:00.000Z', updated_at: '2026-10-01T00:00:00.000Z',
      }],
    });
    await openCurateV2(page, 'today');
    const line = page.getByRole('button', { name: /Seeded Oolong/ });
    await expect(line).toBeVisible();
    expect(await selectedTab(page)).toEqual(['Today']);

    await line.click();
    await expect(overlay(page)).toBeVisible();
    await expect(overlay(page)).toContainText('Seeded Oolong');
    expect(await selectedTab(page)).toEqual(['Today']);

    // "Edit all fields" stacks the full form on the tea; Back returns to the tea, then to Today.
    await overlay(page).getByRole('button', { name: /Edit all fields/ }).click();
    await expect(overlay(page)).toHaveAttribute('data-layer', 'card');
    expect(await selectedTab(page)).toEqual(['Today']);
    await backFromHeader(page).click();
    await expect(overlay(page)).toHaveAttribute('data-layer', 'face');
    await expect(overlay(page)).toContainText('Seeded Oolong');
    await backFromHeader(page).click();
    await expect(overlay(page)).toHaveCount(0);
    expect(await selectedTab(page)).toEqual(['Today']);
    await expect(line).toBeVisible();

    // Tapping another tab with a tea open closes it and shows that tab's own screen.
    await line.click();
    await expect(overlay(page)).toBeVisible();
    await tab(page, 'Vendors').click();
    await expect(overlay(page)).toHaveCount(0);
    expect(await selectedTab(page)).toEqual(['Vendors']);
  });

  test('A tea opened from a vendor card returns to that card, not the vendor list', async ({ page }) => {
    await installCompassHarness(page, {
      customers: VENDORS,
      compassEntries: [{
        id: 'chen-tea', name: 'Chen Dancong', category: 'tea', type: 'Oolong', status: 'noted', vendor_name: 'Chen Family', vendor_id: 'vendor-chen',
        created_at: '2026-10-01T00:00:00.000Z', updated_at: '2026-10-01T00:00:00.000Z',
      }],
    });
    await openCurateV2(page, 'today');
    await tab(page, 'Vendors').click();
    await page.getByRole('button', { name: /Chen Family/ }).first().click();
    await page.getByRole('button', { name: /Chen Dancong/ }).first().click();
    await expect(overlay(page)).toContainText('Chen Dancong');
    expect(await selectedTab(page)).toEqual(['Vendors']);
    await backFromHeader(page).click();
    await expect(overlay(page)).toHaveCount(0);
    // Still on the vendor's card, with the tea listed.
    await expect(page.getByRole('button', { name: /Chen Dancong/ }).first()).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Search vendors' })).toHaveCount(0);
  });

  test('Back returns to the Table rows scrolled where they were', async ({ page }) => {
    await installCompassHarness(page, { customers: VENDORS });
    await openCurateV2(page, 'table');
    await page.getByTestId('table-start').click();
    await page.getByTestId('vendor-picker').getByRole('button', { name: 'Chen Family' }).click();
    for (let i = 1; i <= 16; i += 1) await addTea(page, `Test Tea ${i} 2019 ¥${100 + i}/cake`);
    await expect(page.getByTestId('table-count')).toHaveText('16 teas');
    const scroller = tabScroller(page);
    await scroller.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    const before = await scroller.evaluate((el) => el.scrollTop);
    expect(before).toBeGreaterThan(100);
    await page.getByRole('button', { name: /^Test Tea 16/ }).click();
    await expect(overlay(page)).toContainText('Test Tea 16');
    await overlay(page).getByRole('button', { name: 'Back' }).click(); // the tea's own back arrow
    await expect(overlay(page)).toHaveCount(0);
    const after = await scroller.evaluate((el) => el.scrollTop);
    expect(Math.abs(after - before)).toBeLessThanOrEqual(2);
  });
});
