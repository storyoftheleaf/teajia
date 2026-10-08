/**
 * Curate v2: the journeys it must walk (todo/plans/curate-v2-journeys.md).
 * Every step says what is on screen, which tab is lit, and where Back lands.
 * Phone size only: this is what Adrian holds at the vendor's table.
 */
import { test, expect, type Page } from './fixtures';
import {
  compassCreatedCustomers,
  compassRequestCount,
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
  const tabs = await page.getByRole('tablist', { name: 'Screen' }).getByRole('tab').all();
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

  // ── Journey 2, 4 and the Chinese name: Today in sections ───────────────────

  const NOW = Date.now();
  const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();
  const entry = (over: Record<string, any>) => ({
    category: 'tea', type: 'Sheng', status: 'noted', vendor_name: 'Wang Laoshi', vendor_id: 'vendor-wang',
    created_at: daysAgo(30), updated_at: daysAgo(30), photos: '[]', audio_clips: '[]', ...over,
  });
  const TODAY_DATA = {
    customers: [{ id: 'vendor-wang', name: 'Wang Laoshi', tags: ['vendor'] }, { id: 'vendor-li', name: 'Li Tea House', tags: ['vendor'], wechat: 'li-tea' }],
    compassEntries: [
      entry({ id: 'e-decide', name: 'Mengku Laobanzhang', price_amount: 450, tasting: JSON.stringify({ quality: 8, cleanliness: 'clean' }) }),
      entry({ id: 'e-sample', name: 'Bulang Sample', price_amount: 300, sample_state: 'received', vendor_name: 'Li Tea House', vendor_id: 'vendor-li' }),
      entry({ id: 'e-cost', name: 'Jingmai Maocha', price_amount: null }),
      entry({ id: 'e-way', name: 'Nannuo 2021', price_amount: 260, status: 'incoming', updated_at: daysAgo(6) }),
      entry({ id: 'e-shelve', name: 'Pasha Cake', price_amount: 420, status: 'in_stock', draft_product_id: null }),
    ],
    todos: [{ id: 'todo-1', text: 'confirm the year (about 2016)', compass_entry_id: 'e-decide', vendor_id: null, from_agent: 'GrokBot', created_at: daysAgo(1), tea_name: 'XWT-LB1 有机六堡茶1', vendor_name: null }],
    agentSuggestions: [{ batch_id: 'batch-1', found_by: 'GrokBot', url: null, vendor: 'Mengku Tea House', contact: null, note: null, found_at: daysAgo(1),
      teas: [1, 2, 3, 4].map((n) => ({ id: `s${n}`, name: `Find ${n}`, category: 'tea', type: null, year: null, price: null, note: null })) }],
  };
  const sectionTitles = (page: Page) => page.locator('[data-testid^="today-section-"] h2').allTextContents();

  test('Journey 2: Today is sections in order; a To decide line opens the tea over Today and Back returns', async ({ page }) => {
    await installCompassHarness(page, TODAY_DATA);
    await openCurateV2(page, 'today');
    await expect(page.getByTestId('today-section-shelve')).toBeVisible();
    expect(await sectionTitles(page)).toEqual(['From your agent', 'To do', 'To decide', 'Needs a cost', 'Vendors to reach', 'On the way', 'To shelve']);

    const agent = page.getByTestId('today-agent-find');
    await expect(agent).toContainText('GrokBot');
    await expect(agent).toContainText('Mengku Tea House · 4 teas');
    await expect(agent).toContainText('Pick');
    // To do: the subject first, the task after.
    await expect(page.getByTestId('today-todo')).toContainText('XWT-LB1 有机六堡茶1');
    await expect(page.getByTestId('today-todo')).toContainText('confirm the year');
    await expect(page.getByTestId('today-section-decide')).toContainText('Taste');
    await expect(page.getByTestId('today-section-vendors')).toContainText('Wang Laoshi');
    await expect(page.getByTestId('today-section-vendors')).not.toContainText('Li Tea House');
    await expect(page.getByTestId('today-section-way')).toContainText('6 days');
    await shot(page, 'j2-today-sections');

    // Tapping a To decide line opens the tea on top; TODAY stays lit; Back returns to the list.
    const line = page.getByTestId('today-section-decide').getByRole('button', { name: /Mengku Laobanzhang/ });
    await line.click();
    await expect(overlay(page)).toBeVisible();
    await expect(overlay(page)).toContainText('Mengku Laobanzhang');
    expect(await selectedTab(page)).toEqual(['Today']);
    await shot(page, 'j2-tea-over-today');
    await backFromHeader(page).click();
    await expect(overlay(page)).toHaveCount(0);
    expect(await selectedTab(page)).toEqual(['Today']);
    expect(await sectionTitles(page)).toEqual(['From your agent', 'To do', 'To decide', 'Needs a cost', 'Vendors to reach', 'On the way', 'To shelve']);
  });

  test('Journey 2: an empty section is not shown, and a signed-in Today always offers + A to-do', async ({ page }) => {
    await installCompassHarness(page, {
      customers: [{ id: 'vendor-li', name: 'Li Tea House', tags: ['vendor'], wechat: 'li-tea' }],
      compassEntries: [entry({ id: 'e-cost', name: 'Jingmai Maocha', price_amount: null })],
    });
    await openCurateV2(page, 'today');
    await expect(page.getByTestId('today-section-cost')).toBeVisible();
    expect(await sectionTitles(page)).toEqual(['To do', 'Needs a cost']);
    await expect(page.getByTestId('today-section-todo').getByRole('button', { name: '+ A to-do' })).toBeVisible();
    await shot(page, 'j2-few-sections');
  });

  test('Journey 4: Arrived moves a tea from On the way to To shelve; Shelf promotes it and the line leaves', async ({ page }) => {
    await installCompassHarness(page, TODAY_DATA);
    await openCurateV2(page, 'today');
    const way = page.getByTestId('today-section-way');
    const shelve = page.getByTestId('today-section-shelve');
    await expect(way).toContainText('Nannuo 2021');
    await expect(shelve).not.toContainText('Nannuo 2021');

    await way.getByRole('button', { name: 'Arrived: Nannuo 2021' }).click();
    await expect(page.getByTestId('today-section-way')).toHaveCount(0);
    await expect(shelve).toContainText('Nannuo 2021');
    await expect(shelve).toContainText('Pasha Cake');
    await shot(page, 'j4-arrived');

    await shelve.getByRole('button', { name: 'Shelf: Pasha Cake' }).click();
    await expect(shelve).not.toContainText('Pasha Cake');
    await expect(shelve).toContainText('Nannuo 2021');
    expect(compassRequestCount(page, 'POST /api/compass/entries/e-shelve/promote')).toBe(1);
    await shot(page, 'j4-shelved');

    await shelve.getByRole('button', { name: 'Shelf: Nannuo 2021' }).click();
    await expect(page.getByTestId('today-section-shelve')).toHaveCount(0);
    expect(compassRequestCount(page, 'POST /api/compass/entries/e-way/promote')).toBe(1);
  });

  // ── Journey 3: ordering ────────────────────────────────────────────────────

  const BUY_DATA = {
    customers: [{ id: 'vendor-wang', name: 'Wang Laoshi', tags: ['vendor'], wechat: 'wang-ls' }, { id: 'vendor-li', name: 'Li Tea House', tags: ['vendor'], wechat: 'li-tea' }],
    rates: [{ currency: 'USD', rate_to_usd: 1, last_updated: new Date().toISOString() }, { currency: 'Yuan', rate_to_usd: 7.1, last_updated: new Date().toISOString() }],
    compassEntries: [
      entry({ id: 'b-1', name: 'Mengku Laobanzhang', year: 2018, form: 'Cake', price_amount: 450, price_currency: 'Yuan', tasting: JSON.stringify({ quality: 8, cleanliness: 'clean' }) }),
      entry({ id: 'b-2', name: 'Bulang Gushu', year: 2020, form: 'Cake', price_amount: 300, price_currency: 'Yuan', tasting: JSON.stringify({ quality: 7, cleanliness: 'clean' }) }),
      entry({ id: 'b-3', name: 'Nannuo Shan', year: 2021, form: 'Cake', price_amount: 260, price_currency: 'Yuan', vendor_name: 'Li Tea House', vendor_id: 'vendor-li', tasting: JSON.stringify({ quality: 7 }) }),
    ],
  };
  const buyButton = (page: Page) => overlay(page).getByRole('radio', { name: 'Buy', exact: true });
  const orderRows = (page: Page) => page.getByTestId('order-screen').locator('.border-b').filter({ has: page.getByRole('button', { name: 'Less' }) });

  test('Journey 3: Buy puts the tea on its vendor\'s order, which opens over the tab; Back returns to the tea; Confirm moves the teas to On the way', async ({ page }) => {
    await installCompassHarness(page, BUY_DATA);
    await openCurateV2(page, 'today');
    expect(await sectionTitles(page)).toEqual(['To do', 'To decide']);

    // 1. Open a tea from Today and press Buy: the order opens on top, TODAY still lit.
    await page.getByTestId('today-section-decide').getByRole('button', { name: /Mengku Laobanzhang/ }).click();
    await expect(overlay(page)).toHaveAttribute('data-layer', 'face');
    await buyButton(page).click();
    await expect(overlay(page)).toHaveAttribute('data-layer', 'order');
    expect(await selectedTab(page)).toEqual(['Today']);
    await expect(page.getByTestId('order-vendor')).toHaveText('Wang Laoshi');
    await expect(orderRows(page)).toHaveCount(1);
    await expect(orderRows(page).first()).toContainText('Mengku Laobanzhang');
    await expect(orderRows(page).first()).toContainText('2018');
    await expect(orderRows(page).first()).toContainText('1 cake');
    await expect(orderRows(page).first()).toContainText('¥450');
    await expect(page.getByTestId('curate-order')).toHaveAttribute('data-status', 'draft');
    // Freight at the shop rate, the rate today, landed in dollars.
    await expect(page.getByLabel('Grand total')).toContainText('Freight');
    await expect(page.getByLabel('Grand total')).toContainText('7.10 today');
    await expect(page.getByLabel('Grand total')).toContainText('Landed');
    await shot(page, 'j3-1-order-over-today');

    // The amount is changed with + and −, in the same frame as its price.
    await orderRows(page).first().getByRole('button', { name: 'More' }).click();
    await expect(orderRows(page).first()).toContainText('2 cakes');
    await expect(orderRows(page).first()).toContainText('¥900');
    await orderRows(page).first().getByRole('button', { name: 'Less' }).click();
    await expect(orderRows(page).first()).toContainText('1 cake');

    // 2. Back returns to the tea (now Selected), then to Today.
    await backFromHeader(page).click();
    await expect(overlay(page)).toHaveAttribute('data-layer', 'face');
    await expect(overlay(page)).toContainText('Mengku Laobanzhang');
    await expect(buyButton(page)).toHaveAttribute('aria-checked', 'true');
    expect(await selectedTab(page)).toEqual(['Today']);
    await shot(page, 'j3-2-back-on-the-tea');
    await backFromHeader(page).click();
    await expect(overlay(page)).toHaveCount(0);
    // Bought, so it no longer waits to be decided; it is being ordered.
    await expect(page.getByTestId('today-section-decide')).not.toContainText('Mengku Laobanzhang');
    await expect(page.getByTestId('today-section-way')).toContainText('Mengku Laobanzhang');
    await expect(page.getByTestId('today-section-way')).toContainText('ordering');

    // 3. A second tea from the same vendor joins the SAME order.
    await page.getByTestId('today-section-decide').getByRole('button', { name: /Bulang Gushu/ }).click();
    await buyButton(page).click();
    await expect(overlay(page)).toHaveAttribute('data-layer', 'order');
    await expect(orderRows(page)).toHaveCount(2);
    await expect(orderRows(page).nth(0)).toContainText('Mengku Laobanzhang');
    await expect(orderRows(page).nth(1)).toContainText('Bulang Gushu');
    await expect(page.getByTestId('curate-order')).toHaveCount(1);
    await shot(page, 'j3-3-two-teas-one-order');

    // Buying the same tea again adds no second row.
    await backFromHeader(page).click();
    await buyButton(page).click(); // already Buy: toggling off then on is not needed, a second press on the lit Buy re-opens the order
    await expect(overlay(page)).toHaveAttribute('data-layer', 'order');
    await expect(orderRows(page)).toHaveCount(2);

    // 4. Message: Chinese then English, Copy for WeChat.
    await page.getByRole('button', { name: 'Message the vendor about this order' }).click();
    const message = page.getByRole('dialog');
    await expect(message).toBeVisible();
    await expect(message.getByRole('button', { name: /Copy/ })).toBeVisible();
    await shot(page, 'j3-4-message');
    await page.keyboard.press('Escape');
    await expect(message).toHaveCount(0);

    // 5. Confirm: the order is confirmed and recorded; the teas wait under On the way.
    await page.getByRole('button', { name: 'Confirm purchase' }).click();
    await expect.poll(() => compassRequestCount(page, 'POST /api/purchase-orders')).toBe(1);
    await expect(page.getByTestId('curate-order')).toHaveAttribute('data-status', 'confirmed');
    await shot(page, 'j3-5-confirmed');
    await backFromHeader(page).click(); // to the tea
    await backFromHeader(page).click(); // to Today
    await expect(overlay(page)).toHaveCount(0);
    expect(await selectedTab(page)).toEqual(['Today']);
    const way = page.getByTestId('today-section-way');
    await expect(way).toContainText('Mengku Laobanzhang');
    await expect(way).toContainText('Bulang Gushu');
    await expect(way).not.toContainText('ordering');
    await expect(page.getByTestId('today-section-decide')).not.toContainText('Bulang Gushu');
    await shot(page, 'j3-6-on-the-way');
  });

  test('Journey 3: a different vendor starts its own order; Orders lists them and a tap opens the same order screen', async ({ page }) => {
    await installCompassHarness(page, BUY_DATA);
    await openCurateV2(page, 'today');
    await page.getByTestId('today-section-decide').getByRole('button', { name: /Mengku Laobanzhang/ }).click();
    await buyButton(page).click();
    await backFromHeader(page).click();
    await backFromHeader(page).click();
    await page.getByTestId('today-section-decide').getByRole('button', { name: /Nannuo Shan/ }).click();
    await buyButton(page).click();
    await expect(page.getByTestId('order-vendor')).toHaveText('Li Tea House');
    await expect(orderRows(page)).toHaveCount(1);
    await backFromHeader(page).click();
    await backFromHeader(page).click();

    // Orders: one row per order. Tapping a draft opens the same screen over the tab.
    await tab(page, 'Orders').click();
    await expect(page.getByTestId('curate-order').filter({ visible: true })).toHaveCount(2);
    await expect(overlay(page)).toHaveCount(0);
    await shot(page, 'j3-7-orders-tab');
    await page.getByRole('button', { name: 'Open the order with Wang Laoshi' }).click();
    await expect(overlay(page)).toHaveAttribute('data-layer', 'order');
    expect(await selectedTab(page)).toEqual(['Orders']);
    await expect(page.getByTestId('order-vendor')).toHaveText('Wang Laoshi');
    await expect(orderRows(page)).toHaveCount(1);
    await expect(orderRows(page).first()).toContainText('Mengku Laobanzhang');
    await shot(page, 'j3-8-order-over-orders');

    // A tea on the order opens on top of it; Back returns to the order, then to Orders.
    await orderRows(page).first().getByRole('button', { name: 'Mengku Laobanzhang' }).click();
    await expect(overlay(page)).toHaveAttribute('data-layer', 'face');
    await backFromHeader(page).click();
    await expect(overlay(page)).toHaveAttribute('data-layer', 'order');
    await backFromHeader(page).click();
    await expect(overlay(page)).toHaveCount(0);
    expect(await selectedTab(page)).toEqual(['Orders']);

    // Taking the only tea off a draft leaves it empty and the tea no longer ordering.
    await page.getByRole('button', { name: 'Open the order with Wang Laoshi' }).click();
    await page.getByTestId('order-screen').getByRole('button', { name: 'remove' }).click();
    await expect(orderRows(page)).toHaveCount(0);
    await expect(page.getByTestId('order-screen')).toContainText('Nothing on this order yet');
    await tab(page, 'Today').click();
    await expect(page.getByTestId('today-section-way')).not.toContainText('Mengku Laobanzhang');
  });

  test('Journey 3: a tea with no vendor goes on the order for "No vendor yet"', async ({ page }) => {
    await installCompassHarness(page, {
      ...BUY_DATA,
      compassEntries: [entry({ id: 'b-4', name: 'Nameless Oolong', form: 'Cake', price_amount: 120, price_currency: 'Yuan', vendor_name: null, vendor_id: null, tasting: JSON.stringify({ quality: 6 }) })],
    });
    await openCurateV2(page, 'today');
    await page.getByTestId('today-section-decide').getByRole('button', { name: /Nameless Oolong/ }).click();
    await buyButton(page).click();
    await expect(page.getByTestId('order-vendor')).toHaveText('No vendor yet');
    await expect(orderRows(page)).toHaveCount(1);
  });

  test('Chinese name is suggested, never typed: cross leaves it empty, tick saves it', async ({ page }) => {
    await installCompassHarness(page, { ...TODAY_DATA, customers: TODAY_DATA.customers });
    await openCurateV2(page, 'today');
    await page.getByTestId('today-section-decide').getByRole('button', { name: /Mengku Laobanzhang/ }).click();
    const row = page.getByTestId('tea-face-chinese');
    await expect(row).toContainText('suggest');
    await shot(page, 'cn-1-suggest');

    // ✕ leaves it empty.
    await row.getByRole('button', { name: 'Suggest a Chinese name' }).click();
    await expect(page.getByTestId('chinese-suggestion')).toHaveText('孟库古树茶');
    await shot(page, 'cn-2-suggestion');
    await row.getByRole('button', { name: 'Discard this Chinese name' }).click();
    await expect(page.getByTestId('chinese-suggestion')).toHaveCount(0);
    await expect(row).toContainText('suggest');

    // ✓ saves it, shown as saved (no more suggest).
    await row.getByRole('button', { name: 'Suggest a Chinese name' }).click();
    await row.getByRole('button', { name: 'Keep this Chinese name' }).click();
    await expect(row).toContainText('孟库古树茶');
    await expect(row.getByRole('button', { name: 'Suggest a Chinese name' })).toHaveCount(0);
    await shot(page, 'cn-3-kept');
  });

  test('Chinese name: a failed suggestion says so in a plain sentence and can be retried', async ({ page }) => {
    await installCompassHarness(page, { ...TODAY_DATA, chineseNameFails: true });
    await openCurateV2(page, 'today');
    await page.getByTestId('today-section-decide').getByRole('button', { name: /Mengku Laobanzhang/ }).click();
    const row = page.getByTestId('tea-face-chinese');
    await row.getByRole('button', { name: 'Suggest a Chinese name' }).click();
    await expect(row.getByRole('alert')).toContainText('Could not get a suggestion');
    await expect(row.getByRole('button', { name: 'Suggest a Chinese name' })).toBeVisible();
    await shot(page, 'cn-4-error');
  });

  // ── The review pass: what was found wrong looking at screenshots ───────────

  test('Table: the entry line sits BELOW the rows (newest at the bottom) and stays in sight after adding', async ({ page }) => {
    await installCompassHarness(page, { customers: VENDORS });
    await openCurateV2(page, 'table');
    await page.getByTestId('table-start').click();
    await page.getByTestId('vendor-picker').getByRole('button', { name: 'Wang Laoshi' }).click();
    for (let i = 1; i <= 12; i += 1) await addTea(page, `Row Tea ${i} 2019 ¥${100 + i}/cake`);
    const lastRow = page.getByRole('button', { name: /^Row Tea 12/ });
    const lastBox = (await lastRow.boundingBox())!;
    const lineBox = (await nameLine(page).boundingBox())!;
    expect(lineBox.y).toBeGreaterThan(lastBox.y);
    // Just added: the line is on screen, ready for the next tea.
    await expect(nameLine(page)).toBeInViewport();
    // While a vendor is being chosen the entry line steps aside.
    await header(page).getByRole('button', { name: 'new table' }).click();
    await expect(page.getByTestId('vendor-picker')).toBeVisible();
    await expect(nameLine(page)).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(nameLine(page)).toBeVisible();
  });

  test('A tea opens as one clean layer: no second hairline, the tab behind is hidden, TEAS stays lit from the Teas tab', async ({ page }) => {
    await installCompassHarness(page, TODAY_DATA);
    await openCurateV2(page, 'teas');
    await page.getByRole('button', { name: /^Mengku Laobanzhang/ }).first().click();
    await expect(overlay(page)).toBeVisible();
    expect(await selectedTab(page)).toEqual(['Teas']);
    const edge = await overlay(page).evaluate((el) => getComputedStyle(el).borderTopWidth);
    expect(edge).toBe('0px');
    await expect(page.getByTestId('curate-tab-body')).toHaveCSS('visibility', 'hidden');
    await backFromHeader(page).click();
    await expect(overlay(page)).toHaveCount(0);
    await expect(page.getByTestId('curate-tab-body')).toHaveCSS('visibility', 'visible');
    expect(await selectedTab(page)).toEqual(['Teas']);
    // The list holds its own gutters at phone width: nothing runs to an edge.
    const row = page.getByRole('button', { name: /^Mengku Laobanzhang/ }).first();
    const box = (await row.boundingBox())!;
    expect(box.x).toBeLessThanOrEqual(1);
    const text = (await row.locator('.curate-v2-name').boundingBox())!;
    expect(text.x).toBeGreaterThanOrEqual(15);
  });

  test('Tea screen: a frame is gold only when that thing is done (Taste = tasted, Talk = recording, Note = a note exists)', async ({ page }) => {
    await installCompassHarness(page, {
      ...TODAY_DATA,
      compassEntries: [
        entry({ id: 'f-bare', name: 'Bare Tea', price_amount: 100 }),
        entry({ id: 'f-tasted', name: 'Tasted Tea', price_amount: 100, tasting: JSON.stringify({ quality: 8 }) }),
      ],
    });
    await openCurateV2(page, 'teas');
    const frames = (page: Page) => page.getByRole('group', { name: 'Do with this tea' });
    await page.getByRole('button', { name: /^Bare Tea/ }).first().click();
    for (const word of ['Taste', 'Note']) await expect(frames(page).getByRole('button', { name: word, exact: true })).not.toHaveClass(/border-tea-gold/);
    // Talk is offered only where voice is allowed; when it is, it is not gold until it is recording.
    for (const talk of await frames(page).getByRole('button', { name: /^Talk/ }).all()) await expect(talk).not.toHaveClass(/border-tea-gold/);
    // A note exists: Note is gold. Typing opens the box; the frame is gold once there are words.
    await frames(page).getByRole('button', { name: 'Note', exact: true }).click();
    await expect(frames(page).getByRole('button', { name: 'Note', exact: true })).not.toHaveClass(/border-tea-gold/);
    await overlay(page).getByRole('textbox', { name: 'Note' }).fill('Ask about storage');
    await expect(frames(page).getByRole('button', { name: 'Note', exact: true })).toHaveClass(/border-tea-gold/);
    await backFromHeader(page).click();
    await page.getByRole('button', { name: /^Tasted Tea/ }).first().click();
    await expect(frames(page).getByRole('button', { name: 'Taste', exact: true })).toHaveClass(/border-tea-gold/);
    await expect(frames(page).getByRole('button', { name: 'Note', exact: true })).not.toHaveClass(/border-tea-gold/);
  });

  test('Orders tab: rows hold 16px gutters, full-strength text, no slide-in fade', async ({ page }) => {
    await installCompassHarness(page, BUY_DATA);
    await openCurateV2(page, 'today');
    await page.getByTestId('today-section-decide').getByRole('button', { name: /Mengku Laobanzhang/ }).click();
    await buyButton(page).click();
    await backFromHeader(page).click();
    await backFromHeader(page).click();
    await tab(page, 'Orders').click();
    const card = page.getByTestId('curate-order').filter({ visible: true }).first();
    await expect(card).toBeVisible();
    // No animation wrapper fading or sliding the list in.
    const wrapper = card.locator('xpath=ancestor::div[contains(@class,"pb-8")][1]/..');
    expect(await wrapper.evaluate((el) => ({ o: getComputedStyle(el).opacity, t: getComputedStyle(el).transform }))).toEqual({ o: '1', t: 'none' });
    const heading = (await card.getByRole('button', { name: /Open the order with Wang Laoshi/ }).boundingBox())!;
    expect(heading.x).toBeGreaterThanOrEqual(15);
    const msg = (await card.getByRole('button', { name: /Message the vendor/ }).boundingBox())!;
    const vw = page.viewportSize()!.width;
    expect(msg.x + msg.width).toBeLessThanOrEqual(vw - 8);
    expect(msg.x + msg.width).toBeGreaterThanOrEqual(vw - 24);
  });

  test('Orders: an order for "No vendor yet" cannot be confirmed until a vendor is chosen, and the choice goes onto the teas', async ({ page }) => {
    await installCompassHarness(page, {
      ...BUY_DATA,
      compassEntries: [entry({ id: 'b-4', name: 'Nameless Oolong', form: 'Cake', price_amount: 120, price_currency: 'Yuan', vendor_name: null, vendor_id: null, tasting: JSON.stringify({ quality: 6 }) })],
    });
    await openCurateV2(page, 'today');
    await page.getByTestId('today-section-decide').getByRole('button', { name: /Nameless Oolong/ }).click();
    await buyButton(page).click();
    await expect(page.getByTestId('order-vendor')).toHaveText('No vendor yet');
    await expect(page.getByRole('button', { name: 'Confirm purchase' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Choose the vendor' }).click();
    const picker = page.getByTestId('order-vendor-picker').getByTestId('vendor-picker');
    await expect(picker).toBeVisible();
    await picker.getByRole('button', { name: 'Wang Laoshi' }).click();
    await expect(page.getByTestId('order-vendor')).toHaveText('Wang Laoshi');
    await expect(page.getByRole('button', { name: 'Choose the vendor' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Confirm purchase' })).toBeVisible();
    // The tea now has the vendor too.
    const vendors = await page.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem('teajia-compass') || '{}');
      const all = Object.values(raw.state?.entriesByAccount ?? {}).flat() as Array<{ name: string; vendorName?: string; vendorId?: string }>;
      return all.filter((e) => e.name === 'Nameless Oolong').map((e) => `${e.vendorName}|${e.vendorId}`);
    });
    expect(vendors).toEqual(['Wang Laoshi|vendor-wang']);
  });

  test('Orders: a confirmed order is read-only (no remove, no less, no more)', async ({ page }) => {
    await installCompassHarness(page, BUY_DATA);
    await openCurateV2(page, 'today');
    await page.getByTestId('today-section-decide').getByRole('button', { name: /Mengku Laobanzhang/ }).click();
    await buyButton(page).click();
    await expect(page.getByTestId('order-screen').getByRole('button', { name: 'remove' })).toHaveCount(1);
    await page.getByRole('button', { name: 'Confirm purchase' }).click();
    await expect(page.getByTestId('curate-order')).toHaveAttribute('data-status', 'confirmed');
    await expect(page.getByTestId('order-screen').getByRole('button', { name: 'remove' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Less' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'More' })).toHaveCount(0);
    await expect(page.getByRole('spinbutton', { name: 'Amount' })).toHaveCount(0);
    await expect(orderRows(page)).toHaveCount(0); // rows without steppers are not the editable kind
    await expect(page.getByTestId('order-screen')).toContainText('1 cake');
  });

  test('On the way: a tea and its pending receipt are ONE row; its Arrived accepts the receipt and shelves the tea', async ({ page }) => {
    await installCompassHarness(page, {
      ...TODAY_DATA,
      pendingReceipts: [{ id: 'rp-1', account_id: 'acct-bali', compass_entry_id: 'e-way', tea_name: 'Nannuo 2021', vendor_name: 'Wang Laoshi', quantity: 2, unit: 'unit', status: 'pending', created_at: daysAgo(6) }],
    });
    await openCurateV2(page, 'today');
    const way = page.getByTestId('today-section-way');
    await expect(way).toBeVisible();
    await expect(way.getByText('Nannuo 2021')).toHaveCount(1);
    await expect(way.getByRole('button', { name: /^Arrived:/ })).toHaveCount(1);
    await way.getByRole('button', { name: 'Arrived: Nannuo 2021' }).click();
    await expect.poll(() => compassRequestCount(page, 'POST /api/curate/receipt-proposals/rp-1/accept')).toBe(1);
    await expect(page.getByTestId('today-section-shelve')).toContainText('Nannuo 2021');
  });

  test('Teas tab: a row opens the tea screen on top (TEAS lit), not an in-place card', async ({ page }) => {
    await installCompassHarness(page, TODAY_DATA);
    await openCurateV2(page, 'teas');
    await page.getByRole('button', { name: /^Jingmai Maocha/ }).first().click();
    await expect(overlay(page)).toHaveAttribute('data-layer', 'face');
    await expect(overlay(page)).toContainText('Jingmai Maocha');
    expect(await selectedTab(page)).toEqual(['Teas']);
    await backFromHeader(page).click();
    await expect(overlay(page)).toHaveCount(0);
    expect(await selectedTab(page)).toEqual(['Teas']);
  });

  test('Compare: choosing teas has its action in the header (no mid-list button) and shows results', async ({ page }) => {
    await installCompassHarness(page, TODAY_DATA);
    await openCurateV2(page, 'teas');
    await page.getByRole('button', { name: 'Compare', exact: true }).click();
    await expect(page.getByRole('button', { name: /^Compare \d+ teas/ })).toHaveCount(0);
    await page.getByRole('button', { name: /^Mengku Laobanzhang/ }).click();
    await page.getByRole('button', { name: /^Jingmai Maocha/ }).click();
    await page.getByRole('button', { name: 'Compare 2 teas' }).click();
    await expect(page.getByTestId('compare-cards').locator('article')).toHaveCount(2);
    await shot(page, 'review-compare');
  });

  // ── Review pass 2 ──────────────────────────────────────────────────────────

  const fontOf = (loc: ReturnType<Page['locator']>) => loc.evaluate((el) => getComputedStyle(el).fontFamily);

  test('Edit all fields: the full card is TeaFace with every field open (Lora labels, thin frames, no slider, no fills)', async ({ page }) => {
    await installCompassHarness(page, {
      ...BUY_DATA,
      compassEntries: [entry({ id: 'f-card', name: 'Card Tea', year: 2019, form: 'Cake', price_amount: 450, price_currency: 'Yuan', price_per_unit_grams: 357,
        tasting: JSON.stringify({ quality: 8, body: ['full'], finish: ['long'], flavor: ['sweet'] }) })],
    });
    await openCurateV2(page, 'teas');
    await page.getByRole('button', { name: /^Card Tea/ }).first().click();
    await overlay(page).getByRole('button', { name: /Edit all fields/ }).click();
    const card = overlay(page);
    await expect(card).toHaveAttribute('data-layer', 'card');
    // Lora capital label on the left of each line, as the face has them.
    const label = card.locator('.curate-v2-line .curate-v2-label').first();
    expect(await fontOf(label)).toContain('Lora');
    // The score is a row of ten thin numbered frames, not a slider; the usual weights are frames too.
    await expect(card.getByRole('slider')).toHaveCount(0);
    const score = card.getByRole('radiogroup', { name: 'Quality rating' });
    await expect(score.getByRole('radio')).toHaveCount(10);
    await expect(score.getByRole('radio', { name: '8' })).toHaveClass(/is-on/);
    await expect(card.getByRole('group', { name: 'Usual weights' }).getByRole('button').first()).toBeVisible();
    // Body, Finish and Flavor are thin gold frames (3px corners), never round chips.
    const body = card.getByRole('group', { name: 'Body' }).getByRole('button', { name: /Remove/ }).first();
    await expect(body).toBeVisible();
    expect(await body.evaluate((el) => parseFloat(getComputedStyle(el).borderTopLeftRadius))).toBeLessThanOrEqual(4);
    // Pass · Sample · Buy in one frame, Done a plain word: nothing filled.
    const footer = card.getByTestId('capture-action-footer').filter({ visible: true });
    for (const word of ['Pass', 'Sample', 'Buy']) await expect(footer.getByRole('button', { name: word, exact: true })).toBeVisible();
    const done = footer.getByRole('button', { name: /^Done/ });
    await expect(done).toBeVisible();
    expect(await done.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
    await expect(card.locator('.cta-solid')).toHaveCount(0);
    // Pass marks the tea passed on, and again takes it back.
    await footer.getByRole('button', { name: 'Pass', exact: true }).click();
    await expect(card.getByRole('radio', { name: 'Passed on' })).toHaveAttribute('aria-checked', 'true');
    // No sideways scroll and every field still there.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    for (const name of ['Price', 'Grams', 'Currency']) await expect(card.getByLabel(name, { exact: true })).toBeVisible();
    await shot(page, 'review2-card');
  });

  test('Value cells that say "add" read in Lora, on the tea screen and the vendor card', async ({ page }) => {
    await installCompassHarness(page, TODAY_DATA);
    await openCurateV2(page, 'teas');
    await page.getByRole('button', { name: /^Jingmai Maocha/ }).first().click();
    const cost = overlay(page).getByTestId('tea-face-cost');
    await expect(cost).toContainText('add');
    expect(await fontOf(cost.getByText('add', { exact: true }))).toContain('Lora');
    expect(await fontOf(overlay(page).getByText('add', { exact: true }).last())).toContain('Lora');
    await backFromHeader(page).click();
    await tab(page, 'Vendors').click();
    await page.getByRole('button', { name: /Wang Laoshi/ }).first().click();
    const card = page.getByTestId('curate-vendor-card');
    await expect(card.getByText('add', { exact: true }).first()).toBeVisible();
    for (const cell of await card.getByText('add', { exact: true }).all()) expect(await fontOf(cell)).toContain('Lora');
  });

  for (const [label, entries, offered] of [
    ['no teas', [] as Array<Record<string, any>>, false],
    ['one tea', [entry({ id: 'solo', name: 'Only Tea', price_amount: 100 })], false],
    ['two teas', [entry({ id: 'one', name: 'First Tea', price_amount: 100 }), entry({ id: 'two', name: 'Second Tea', price_amount: 200 })], true],
  ] as const) {
    test(`Compare is offered only when there are two teas to compare (${label})`, async ({ page }) => {
      await installCompassHarness(page, { compassEntries: entries });
      await openCurateV2(page, 'teas');
      if (entries.length) await expect(page.getByRole('button', { name: /Tea/ }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: 'Compare', exact: true })).toHaveCount(offered ? 1 : 0);
    });
  }

  test('Choosing the vendor on a "No vendor yet" order moves its teas into that vendor\'s draft and opens it: never two drafts for one vendor', async ({ page }) => {
    await installCompassHarness(page, {
      ...BUY_DATA,
      compassEntries: [
        ...BUY_DATA.compassEntries.slice(0, 1),
        entry({ id: 'b-4', name: 'Nameless Oolong', form: 'Cake', price_amount: 120, price_currency: 'Yuan', vendor_name: null, vendor_id: null, tasting: JSON.stringify({ quality: 6 }) }),
      ],
    });
    await openCurateV2(page, 'today');
    // Wang's draft already holds Mengku.
    await page.getByTestId('today-section-decide').getByRole('button', { name: /Mengku Laobanzhang/ }).click();
    await buyButton(page).click();
    await expect(page.getByTestId('order-vendor')).toHaveText('Wang Laoshi');
    await backFromHeader(page).click();
    await backFromHeader(page).click();
    // The nameless tea starts its own draft.
    await page.getByTestId('today-section-decide').getByRole('button', { name: /Nameless Oolong/ }).click();
    await buyButton(page).click();
    await expect(page.getByTestId('order-vendor')).toHaveText('No vendor yet');
    await page.getByRole('button', { name: 'Choose the vendor' }).click();
    await page.getByTestId('order-vendor-picker').getByTestId('vendor-picker').getByRole('button', { name: 'Wang Laoshi' }).click();
    // The order on screen is now Wang's, holding both teas.
    await expect(overlay(page)).toHaveAttribute('data-layer', 'order');
    await expect(page.getByTestId('order-vendor')).toHaveText('Wang Laoshi');
    await expect(orderRows(page)).toHaveCount(2);
    await expect(orderRows(page).nth(0)).toContainText('Mengku Laobanzhang');
    await expect(orderRows(page).nth(1)).toContainText('Nameless Oolong');
    // One draft in Orders, not two.
    await backFromHeader(page).click();
    await backFromHeader(page).click();
    await tab(page, 'Orders').click();
    await expect(page.getByTestId('curate-order').filter({ visible: true })).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Open the order with Wang Laoshi' })).toHaveCount(1);
  });

  test('Orders tab: "+ Purchase order" is set like its neighbours (normal weight, single word gap)', async ({ page }) => {
    await installCompassHarness(page, {});
    await openCurateV2(page, 'orders');
    const word = page.getByText('+ Purchase order', { exact: true }).filter({ visible: true });
    await expect(word).toBeVisible();
    expect(await word.evaluate((el) => getComputedStyle(el).fontWeight)).toBe('400');
    expect(await word.evaluate((el) => getComputedStyle(el).wordSpacing)).toMatch(/^(normal|0px)$/);
  });

  // ── Review pass 3 ──────────────────────────────────────────────────────────

  const rgb = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
  const isClear = (c: string) => { const v = rgb(c); return v.length === 4 && v[3] === 0; };

  test('Full tasting is dressed for Curate: thin frames, gold when chosen, Cormorant sections, Lora labels; Back from it lands on the tea', async ({ page }) => {
    await installCompassHarness(page, BUY_DATA);
    await openCurateV2(page, 'today');
    await page.getByTestId('today-section-decide').getByRole('button', { name: /Mengku Laobanzhang/ }).click();
    await overlay(page).getByRole('button', { name: 'Full tasting' }).click();
    const session = page.locator('[data-tasting-session-overlay]');
    await expect(session).toBeVisible();
    await expect(session).toHaveClass(/curate-v2/);
    await page.waitForTimeout(700); // the panel slides in

    const medium = session.getByRole('radio', { name: 'Medium', exact: true }).first();
    const light = session.getByRole('radio', { name: 'Light', exact: true });
    await medium.click();
    // A choice is a thin frame: no fill, a 1px border, a square-ish corner.
    const frame = (loc: ReturnType<Page['locator']>) => loc.evaluate((el) => { const cs = getComputedStyle(el); return { bg: cs.backgroundColor, bgImage: cs.backgroundImage, bw: cs.borderTopWidth, radius: parseFloat(cs.borderTopLeftRadius), color: cs.borderTopColor, shadow: cs.boxShadow, font: cs.fontFamily, h: el.getBoundingClientRect().height }; });
    const off = await frame(light);
    const on = await frame(medium);
    for (const f of [off, on]) {
      expect(isClear(f.bg)).toBe(true);
      expect(f.bgImage).toBe('none');
      expect(f.bw).toBe('1px');
      expect(f.radius).toBeLessThanOrEqual(4);
      expect(f.shadow).toBe('none');
      expect(f.font).toContain('Lora');
      expect(f.h).toBeGreaterThanOrEqual(44);
    }
    expect(on.color).not.toBe(off.color); // gold when chosen
    // A section is the word large (Cormorant), a label is Lora capitals, and nothing is a pill.
    const heading = session.getByText('Texture', { exact: true });
    expect(await heading.evaluate((el) => { const cs = getComputedStyle(el); return { f: cs.fontFamily, s: parseFloat(cs.fontSize), t: cs.textTransform, b: cs.borderBottomWidth }; })).toMatchObject({ t: 'none', b: '1px' });
    expect(await heading.evaluate((el) => getComputedStyle(el).fontFamily)).toContain('Cormorant');
    expect(await heading.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(22);
    const label = session.getByText('Duration', { exact: true });
    expect(await label.evaluate((el) => getComputedStyle(el).fontFamily)).toContain('Lora');
    expect(await label.evaluate((el) => getComputedStyle(el).textTransform)).toBe('uppercase');
    const pills = await session.locator('.tasting-scroll button').evaluateAll((els) => els.filter((el) => parseFloat(getComputedStyle(el).borderTopLeftRadius) > 8).length);
    expect(pills).toBe(0);
    // The quality scale is two rows of five, each at least 44 wide.
    await page.getByRole('button', { name: /^Effect/ }).first().click();
    // The new section slides in (about 0.4s, shared with the journal); measure once it has landed.
    const settling = session.getByText('Settling', { exact: true });
    await expect.poll(async () => Math.round((await settling.boundingBox())?.x ?? -1)).toBe(16);
    const ten = await session.getByRole('radio', { name: '10', exact: true }).evaluate((el) => el.getBoundingClientRect().width);
    expect(ten).toBeGreaterThanOrEqual(44);
    // Nothing runs sideways: both columns sit inside 16px gutters, the Clear control is whole, no horizontal scroll.
    const fit = await page.evaluate(() => {
      const sc = document.querySelector('[data-tasting-session-overlay] .tasting-scroll') as HTMLElement;
      const rects = Array.from(sc.querySelectorAll('button')).map((b) => b.getBoundingClientRect()).filter((r) => r.width > 0);
      const clear = sc.querySelector('button[aria-label^="Clear"]')?.getBoundingClientRect();
      return {
        docScroll: document.documentElement.scrollWidth - window.innerWidth,
        paneScroll: sc.scrollWidth - sc.clientWidth,
        minLeft: Math.min(...rects.map((r) => r.left)),
        maxRight: Math.max(...rects.map((r) => r.right)),
        width: window.innerWidth,
        clearRight: clear ? clear.right : null,
      };
    });
    expect(fit.docScroll).toBeLessThanOrEqual(0);
    expect(fit.paneScroll).toBeLessThanOrEqual(0);
    expect(fit.minLeft).toBeGreaterThanOrEqual(15.5);
    expect(fit.maxRight).toBeLessThanOrEqual(fit.width - 15.5);
    if (fit.clearRight != null) expect(fit.clearRight).toBeLessThanOrEqual(fit.width);
    await shot(page, 'review3-full-tasting');

    // Back from the full tasting lands on the tea it came from, with the tab where it was.
    await session.getByRole('button', { name: 'Close' }).first().click();
    await page.getByRole('button', { name: 'Discard' }).click(); // there were unsaved answers
    await expect(session).toHaveCount(0);
    await expect(overlay(page)).toHaveAttribute('data-layer', 'face');
    await expect(overlay(page)).toContainText('Mengku Laobanzhang');
    expect(await selectedTab(page)).toEqual(['Today']);
  });

  test('A sheet opened from Curate: the title in Cormorant, the line under it in Lora', async ({ page }) => {
    await installCompassHarness(page, { customers: VENDORS });
    await openCurateV2(page, 'table');
    await page.getByTestId('table-start').click();
    await page.getByTestId('vendor-picker').getByRole('button', { name: 'Wang Laoshi' }).click();
    await addTea(page, 'Mengku Laobanzhang 2018 ¥450/cake');
    await page.getByRole('button', { name: /^Fast tasting for/ }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    await expect(sheet).toHaveClass(/curate-v2-sheet/);
    const title = sheet.getByRole('heading', { name: 'Mengku Laobanzhang' });
    expect(await title.evaluate((el) => getComputedStyle(el).fontFamily)).toContain('Cormorant');
    expect(await title.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(20);
    const sub = sheet.getByText('Fast tasting · saved as you tap', { exact: true });
    expect(await sub.evaluate((el) => getComputedStyle(el).fontFamily)).toContain('Lora');
    // Answers are frames of at least 44px with no fill, and the scale is two rows of five.
    const eight = sheet.getByRole('group', { name: 'How good' }).getByRole('button', { name: '8', exact: true });
    await eight.click();
    const box = await eight.evaluate((el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return { w: r.width, h: r.height, bg: cs.backgroundColor }; });
    expect(box.w).toBeGreaterThanOrEqual(44);
    expect(box.h).toBeGreaterThanOrEqual(44);
    expect(isClear(box.bg)).toBe(true);
    await shot(page, 'review3-fast-sheet');
  });

  test('Table rows: a long name wraps to two lines instead of being cut, and every control is at least 44px', async ({ page }) => {
    await installCompassHarness(page, { customers: VENDORS });
    await openCurateV2(page, 'table');
    await page.getByTestId('table-start').click();
    await page.getByTestId('vendor-picker').getByRole('button', { name: 'Wang Laoshi' }).click();
    await addTea(page, 'Mengku Laobanzhang 2018 ¥450/cake');
    await addTea(page, 'Old Tree Bulang Shengcha 2020 ¥300/cake');
    const rows = page.getByTestId('table-list').locator('.curate-v2-row').filter({ has: page.getByRole('button', { name: /^Fast tasting for/ }) });
    await expect(rows).toHaveCount(2);
    for (const name of ['Mengku Laobanzhang', 'Old Tree Bulang Shengcha']) {
      const nameEl = page.getByTestId('table-list').locator('.curate-v2-name', { hasText: name });
      const cut = await nameEl.evaluate((el) => el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1);
      expect(cut, name + ' is cut').toBe(false);
    }
    await shot(page, 'review3-table-rows');
    const small = await page.getByTestId('table-list').locator('button, select, input').evaluateAll((els) => els
      .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.height < 43.5 || r.width < 43.5); })
      .map((el) => `${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)} ${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30)}`));
    expect(small).toEqual([]);
  });

  test('Empty tabs: a single plain sentence and one action, no stray count, no junk', async ({ page }) => {
    await installCompassHarness(page, { customers: [], compassEntries: [] });
    await openCurateV2(page, 'today');
    const empty = page.getByTestId('today-empty');
    await expect(empty).toBeVisible();
    await expect(empty.locator('p')).toHaveCount(1);
    await expect(empty.getByRole('button')).toHaveCount(1);
    await expect(page.getByTestId('today-section-todo')).toHaveCount(0);
    await expect(page.getByText('Save photos to Google Drive')).toHaveCount(0);
    await expect(page.locator('ol')).toHaveCount(0);

    await tab(page, 'Teas').click();
    const teas = page.getByTestId('library-empty').filter({ visible: true });
    await expect(teas).toBeVisible();
    await expect(teas.locator('p')).toHaveCount(1);
    await expect(teas.getByRole('button')).toHaveCount(1);

    await tab(page, 'Vendors').click();
    const vendors = page.getByTestId('vendors-empty');
    await expect(vendors).toBeVisible();
    await expect(vendors.locator('p')).toHaveCount(1);
    await expect(vendors.getByRole('button', { name: 'Start a table' })).toBeVisible();
    await expect(page.getByText('00', { exact: true })).toHaveCount(0);
    await shot(page, 'review3-empty-vendors');
    await vendors.getByRole('button', { name: 'Start a table' }).click();
    expect(await selectedTab(page)).toEqual(['Table']);
    await expect(page.getByTestId('vendor-picker')).toBeVisible();
  });

  test('Vendors: loading is said before the empty sentence, and a failed read says so and can be retried', async ({ page }) => {
    await installCompassHarness(page, { customers: VENDORS });
    let down = true; // the shop is unreachable until the test says otherwise (the client retries, so a count would not hold)
    await page.route((url) => url.pathname === '/api/customers', async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      if (down) { await new Promise((r) => setTimeout(r, 700)); return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"down"}' }); }
      return route.fallback();
    });
    await openCurateV2(page, 'today');
    await tab(page, 'Vendors').click();
    // While the first read is out: loading, never the "no vendors" sentence.
    await expect(page.getByText('Loading your vendors…')).toBeVisible();
    await expect(page.getByTestId('vendors-empty')).toHaveCount(0);
    // It failed: a plain sentence and one way forward.
    const alert = page.getByRole('alert').filter({ hasText: 'could not be loaded' });
    await expect(alert).toBeVisible();
    await shot(page, 'review3-vendors-error');
    down = false;
    await alert.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('button', { name: /Wang Laoshi/ }).first()).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: 'could not be loaded' })).toHaveCount(0);
  });

  test('Today with no teas yet: a failed load says so and can be retried', async ({ page }) => {
    await installCompassHarness(page, { customers: VENDORS, compassEntries: [entry({ id: 'late-1', name: 'Late Arrival', tasting: JSON.stringify({ quality: 7 }) })] });
    let down = true;
    await page.route((url) => url.pathname === '/api/compass/entries', async (route) => {
      if (down) return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"down"}' });
      return route.fallback();
    });
    await openCurateV2(page, 'today');
    const alert = page.getByRole('alert').filter({ hasText: 'Your teas could not be loaded' });
    await expect(alert).toBeVisible();
    await expect(page.getByTestId('today-empty')).toHaveCount(0);
    down = false;
    await alert.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('button', { name: /Late Arrival/ })).toBeVisible();
  });

  test('Light mode: Today reads on parchment, names and actions keep their contrast', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('teajia_theme', 'light'));
    await installCompassHarness(page, TODAY_DATA);
    await openCurateV2(page, 'today');
    await expect(page.getByTestId('today-section-decide')).toBeVisible();
    await expect(page.locator('html')).toHaveClass(/light/);
    const ratio = await page.getByTestId('today-section-decide').getByRole('button', { name: /Mengku Laobanzhang/ }).locator('.curate-v2-name').evaluate((el) => {
      const px = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
      const lum = ([r, g, b]: number[]) => { const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      let bg = [255, 255, 255]; let n: Element | null = el;
      while (n) { const c = px(getComputedStyle(n).backgroundColor); if (c.length >= 3 && (c[3] ?? 1) === 1) { bg = c.slice(0, 3); break; } n = n.parentElement; }
      const fg = px(getComputedStyle(el).color).slice(0, 3);
      const [a, b] = [lum(fg), lum(bg)];
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });
    expect(ratio).toBeGreaterThanOrEqual(7);
    await shot(page, 'review3-light-today');
  });

  test('Full tasting opened from a row\'s sheet: closing it returns to the Table rows, not to a form nobody asked for', async ({ page }) => {
    await installCompassHarness(page, { customers: VENDORS });
    await openCurateV2(page, 'table');
    await page.getByTestId('table-start').click();
    await page.getByTestId('vendor-picker').getByRole('button', { name: 'Wang Laoshi' }).click();
    await addTea(page, 'Mengku Laobanzhang 2018 ¥450/cake');
    await page.getByRole('button', { name: /^Fast tasting for/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'More ›' }).click();
    const session = page.locator('[data-tasting-session-overlay]');
    await expect(session).toBeVisible();
    await session.getByRole('button', { name: 'Close' }).first().click();
    await expect(session).toHaveCount(0);
    await expect(overlay(page)).toHaveCount(0);
    expect(await selectedTab(page)).toEqual(['Table']);
    await expect(page.getByTestId('table-count')).toHaveText('1 tea');
  });
  // ── Review pass 4 ───────────────────────────────────────────────────────

  test('Journey 1: typing a vendor the shop already has (any case) picks that vendor and creates no second record', async ({ page }) => {
    await installCompassHarness(page, { customers: VENDORS });
    await openCurateV2(page, 'table');
    await page.getByTestId('table-start').click();
    const picker = page.getByTestId('vendor-picker');
    await picker.getByRole('textbox', { name: 'Search or add a vendor' }).fill('wang laoshi');
    await picker.getByRole('textbox', { name: 'Search or add a vendor' }).press('Enter');
    await expect(header(page)).toContainText('Wang Laoshi');
    await addTea(page, 'Yiwu Gushu 2019 ¥1200/cake');
    await page.waitForTimeout(400);
    expect(compassCreatedCustomers(page)).toEqual([]);
    const saved = await page.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem('teajia-compass') || '{}');
      const all = Object.values(raw.state?.entriesByAccount ?? {}).flat() as Array<{ name: string; vendorName?: string; vendorId?: string }>;
      return all.filter((e) => /Yiwu/.test(e.name)).map((e) => `${e.vendorName}|${e.vendorId}`);
    });
    expect(saved).toEqual(['Wang Laoshi|vendor-wang']);
  });

  test('Journey 3: Confirm records the purchase order in dollars (converted at the shop rate) and against the vendor', async ({ page }) => {
    await installCompassHarness(page, BUY_DATA);
    const posted: Array<Record<string, any>> = [];
    page.on('request', (req) => { if (req.method() === 'POST' && /\/api\/purchase-orders$/.test(req.url())) posted.push(req.postDataJSON()); });
    await openCurateV2(page, 'today');
    await page.getByTestId('today-section-decide').getByRole('button', { name: /Mengku Laobanzhang/ }).click();
    await buyButton(page).click();
    await expect(overlay(page)).toHaveAttribute('data-layer', 'order');
    await page.getByRole('button', { name: 'Confirm purchase' }).click();
    await expect.poll(() => posted.length).toBe(1);
    expect(posted[0].display_currency).toBe('Yuan');
    expect(posted[0].vendor_id).toBe('vendor-wang');
    // ¥450 at 7.1 to the dollar, not "450 dollars".
    expect(posted[0].total_usd).toBeCloseTo(450 / 7.1, 2);
  });
  test('Chinese in a name and in the hanzi rows falls to a CJK serif, never the default sans', async ({ page }) => {
    await installCompassHarness(page, {
      customers: VENDORS,
      compassEntries: [entry({ id: 'zh-1', name: 'Mengku', chinese_name: '勐库古树茶', price_amount: 100 })],
      todos: [{ id: 'todo-zh', text: 'confirm the year', compass_entry_id: 'zh-1', vendor_id: null, from_agent: 'GrokBot', created_at: daysAgo(1), tea_name: 'XWT-LB1 有机六堡茶1', vendor_name: null }],
    });
    await openCurateV2(page, 'today');
    const stack = async (sel: string) => page.locator(sel).first().evaluate((el) => getComputedStyle(el).fontFamily);
    const cjkSerif = /Songti SC|Noto Serif CJK SC|Source Han Serif SC|SimSun/;
    expect(await stack('[data-testid="today-todo"] .curate-v2-name')).toMatch(cjkSerif);
    await page.getByTestId('today-todo').getByRole('button', { name: /XWT-LB1/ }).click();
    await expect(page.getByTestId('tea-face-chinese')).toContainText('勐库古树茶');
    expect(await stack('[data-testid="tea-face-chinese"] .curate-v2-hanzi')).toMatch(cjkSerif);
  });
  test('Tea screen: a long name wraps to a second line instead of being cut at 390px', async ({ page }) => {
    await installCompassHarness(page, {
      customers: VENDORS,
      compassEntries: [entry({ id: 'long-1', name: 'Mengku Laobanzhang Gushu', year: 2018, tasting: JSON.stringify({ quality: 8 }), price_amount: 450 })],
    });
    await openCurateV2(page, 'today');
    await page.getByTestId('today-section-decide').getByRole('button', { name: /Mengku Laobanzhang Gushu/ }).click();
    const h = overlay(page).getByRole('heading', { level: 2 });
    await expect(h).toContainText('Mengku Laobanzhang Gushu');
    const box = await h.evaluate((el) => ({ clipped: el.scrollHeight > el.clientHeight + 1, lines: Math.round(el.clientHeight / parseFloat(getComputedStyle(el).lineHeight)) }));
    expect(box.clipped).toBe(false);
    expect(box.lines).toBeGreaterThanOrEqual(2);
  });
  test('Journey 2: a Vendors to reach line opens the vendor card over Today (TODAY stays lit); both Backs return to Today', async ({ page }) => {
    await installCompassHarness(page, TODAY_DATA);
    await openCurateV2(page, 'today');
    const line = page.getByTestId('today-section-vendors').getByRole('button', { name: /Wang Laoshi/ });
    await line.click();
    await expect(page.getByRole('button', { name: 'Back to vendors' })).toBeVisible();
    expect(await selectedTab(page)).toEqual(['Today']);
    // The header Back returns to the Today list.
    await backFromHeader(page).click();
    expect(await selectedTab(page)).toEqual(['Today']);
    await expect(page.getByTestId('today-section-vendors')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back to vendors' })).toHaveCount(0);
    // The card's own arrow returns to Today too, not to the vendor list.
    await line.click();
    await page.getByRole('button', { name: 'Back to vendors' }).click();
    await expect(page.getByTestId('today-section-vendors')).toBeVisible();
    expect(await selectedTab(page)).toEqual(['Today']);
    // A tab tap still shows that tab's own screen.
    await line.click();
    await tab(page, 'Vendors').click();
    await expect(page.getByRole('button', { name: 'Back to vendors' })).toHaveCount(0);
    expect(await selectedTab(page)).toEqual(['Vendors']);
    await tab(page, 'Today').click();
    await expect(page.getByTestId('today-section-vendors')).toBeVisible();
  });
});
