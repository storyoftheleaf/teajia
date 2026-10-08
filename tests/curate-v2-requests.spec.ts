/**
 * Curate v2: what it SENDS. Every write the page makes during a walk is
 * recorded (method, path, body) and held to the shop's money rules: a cost
 * with its currency, a blank sent as a blank and never as 0, one order in one
 * money, no second record for a vendor the shop already has, nothing the
 * person entered overwritten.
 */
import { test, expect, type Page } from './fixtures';
import {
  clearCompassFailures,
  compassCreatedCustomers,
  compassRequestCount,
  delayCompassRequests,
  failCompassRequests,
  compassUpdatedCustomers,
  expectNoUnhandledCompassApi,
  installCompassHarness,
  openCurateV2,
} from './helpers/compassHarness';

type Sent = { method: string; path: string; body: any };
function record(page: Page): Sent[] {
  const sent: Sent[] = [];
  page.on('request', (req) => {
    if (req.method() === 'GET') return;
    const url = new URL(req.url());
    if (!url.pathname.startsWith('/api/')) return;
    let body: any = null;
    try { body = req.postDataJSON(); } catch { body = req.postData(); }
    sent.push({ method: req.method(), path: url.pathname, body });
  });
  return sent;
}
/** The compass entries the page has pushed, last version of each. */
const synced = (sent: Sent[]) => {
  const byId = new Map<string, Record<string, any>>();
  for (const s of sent) if (s.path === '/api/compass/sync') for (const e of s.body.entries ?? []) byId.set(e.id, e);
  return byId;
};

const VENDORS = [
  { id: 'vendor-wang', name: 'Wang Laoshi', tags: ['vendor'] },
  { id: 'vendor-chen', name: 'Chen Family', tags: ['vendor'] },
];
const tab = (page: Page, name: string) => page.getByRole('tab', { name, exact: true });
const nameLine = (page: Page) => page.getByRole('textbox', { name: 'Name the next tea' });
const tableRows = (page: Page) => page.getByTestId('table-list').locator('.curate-v2-row').filter({ has: page.getByRole('button', { name: /^Fast tasting for/ }) });
const overlay = (page: Page) => page.getByTestId('curate-tea-overlay');
const back = (page: Page) => page.getByRole('button', { name: 'Back', exact: true }).first();
const buy = (page: Page) => overlay(page).getByRole('radio', { name: 'Buy', exact: true });
async function addTea(page: Page, line: string) { await nameLine(page).fill(line); await nameLine(page).press('Enter'); }

const NOW = Date.now();
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();
const entry = (over: Record<string, any>) => ({
  category: 'tea', type: 'Sheng', status: 'noted', vendor_name: 'Wang Laoshi', vendor_id: 'vendor-wang',
  created_at: daysAgo(30), updated_at: daysAgo(30), photos: '[]', audio_clips: '[]', ...over,
});
const tasted = JSON.stringify({ quality: 8, cleanliness: 'clean' });
const RATES = [
  { currency: 'USD', rate_to_usd: 1, last_updated: new Date().toISOString() },
  { currency: 'Yuan', rate_to_usd: 7.1, last_updated: new Date().toISOString() },
  { currency: 'NT', rate_to_usd: 32, last_updated: new Date().toISOString() },
];

/** Open a tea from the Decide list on Today, press Buy, and come back to Today. */
async function buyFromToday(page: Page, name: RegExp) {
  await page.getByTestId('today-section-decide').getByRole('button', { name }).click();
  await buy(page).click();
  await expect(overlay(page)).toHaveAttribute('data-layer', 'order');
  await back(page).click();
  await back(page).click();
  await expect(overlay(page)).toHaveCount(0);
}

test.describe('Curate v2 requests (phone)', () => {
  test.beforeEach(async ({}, testInfo) => { test.skip(testInfo.project.name !== 'Mobile Chrome', 'phone only'); });
  test.afterEach(async ({ page }) => expectNoUnhandledCompassApi(page));

  test('the table: every tea is pushed with its money named, a blank as a blank, and the vendor by id', async ({ page }) => {
    await installCompassHarness(page, { customers: VENDORS });
    const sent = record(page);
    const errors: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));
    await openCurateV2(page, 'table');
    await page.getByTestId('table-start').click();
    await page.getByTestId('vendor-picker').getByRole('button', { name: 'Wang Laoshi' }).click();
    for (const line of ['Yiwu Gushu 2019 ¥1200/cake', 'Jingmai Mao Cha 90/100g', 'Bulang NT$800/jin', 'Plain tea no price']) await addTea(page, line);
    await expect.poll(() => synced(sent).size).toBe(4);
    const all = [...synced(sent).values()];
    const by = (name: string) => all.find((e) => e.name === name)!;
    expect(by('Yiwu Gushu')).toMatchObject({ price_amount: 1200, price_currency: 'Yuan', form: 'Cake', year: 2019 });
    // A price typed without a sign is in the table's money; a sign says its own.
    expect(by('Jingmai Mao Cha')).toMatchObject({ price_amount: 90, price_currency: 'Yuan', price_per_unit_grams: 100 });
    expect(by('Bulang')).toMatchObject({ price_amount: 800, price_currency: 'NT', price_per_unit_grams: 500 });
    // Nothing typed is nothing sent: never an amount of 0.
    expect(by('Plain tea no price').price_amount ?? null).toBeNull();
    for (const e of all) {
      expect(e.vendor_id).toBe('vendor-wang');
      expect(e.session_id).toBeTruthy();
      if (e.price_amount != null) expect(['Yuan', 'NT']).toContain(e.price_currency);
    }
    expect(compassCreatedCustomers(page)).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('a vendor typed before the shop\'s vendor list has arrived is still that vendor: no second record', async ({ page }) => {
    await installCompassHarness(page, { customers: VENDORS });
    await page.route('**/api/customers', async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return route.fallback();
    });
    const sent = record(page);
    await openCurateV2(page, 'table');
    await page.getByTestId('table-start').click();
    const input = page.getByTestId('vendor-picker').getByRole('textbox', { name: 'Search or add a vendor' });
    await input.fill('chen family');
    await input.press('Enter');
    await expect(page.getByTestId('table-header')).toContainText('chen family');
    await addTea(page, 'Yiwu Gushu 2019 ¥1200/cake');
    // Once the list arrives the typed name is recognised as the shop's vendor and put right on the tea.
    await expect.poll(() => [...synced(sent).values()].map((e) => e.vendor_id)).toEqual(['vendor-chen']);
    await expect(page.getByTestId('table-header')).toContainText('Chen Family');
    expect(compassCreatedCustomers(page)).toEqual([]);
  });

  test('a vendor sold in two moneys has one order in each: no order adds yuan to Taiwan dollars under one symbol', async ({ page }) => {
    await installCompassHarness(page, {
      customers: VENDORS, rates: RATES,
      compassEntries: [
        entry({ id: 'm-1', name: 'Mengku Laobanzhang', year: 2018, form: 'Cake', price_amount: 450, price_currency: 'Yuan', tasting: tasted }),
        entry({ id: 'm-2', name: 'Alishan Oolong', year: 2022, form: 'Cake', price_amount: 1800, price_currency: 'NT', tasting: tasted }),
        entry({ id: 'm-3', name: 'Bulang Gushu', year: 2020, form: 'Cake', price_amount: 300, price_currency: 'Yuan', tasting: tasted }),
      ],
    });
    const sent = record(page);
    await openCurateV2(page, 'today');
    for (const n of [/Mengku Laobanzhang/, /Alishan Oolong/, /Bulang Gushu/]) await buyFromToday(page, n);
    await tab(page, 'Orders').click();
    const rows = page.getByRole('button', { name: 'Open the order with Wang Laoshi' });
    await expect(rows).toHaveCount(2);

    const texts: string[] = [];
    for (let i = 0; i < 2; i += 1) {
      await page.getByRole('button', { name: 'Open the order with Wang Laoshi' }).nth(i).click();
      const screen = page.getByTestId('order-screen');
      texts.push(await screen.innerText());
      await page.getByRole('button', { name: 'Confirm purchase' }).click();
      await expect.poll(() => sent.filter((s) => s.path === '/api/purchase-orders').length).toBe(i + 1);
      await back(page).click();
    }
    const yuan = texts.find((t) => t.includes('¥450'))!;
    const nt = texts.find((t) => t.includes('NT$1,800'))!;
    expect(yuan).toContain('Bulang Gushu');
    expect(yuan).not.toContain('NT$');
    expect(nt).not.toContain('¥');
    expect(nt).toContain('Alishan Oolong');

    const orders = sent.filter((s) => s.path === '/api/purchase-orders').map((s) => s.body);
    const yuanPo = orders.find((o) => o.display_currency === 'Yuan')!;
    const ntPo = orders.find((o) => o.display_currency === 'NT')!;
    expect(yuanPo.total_usd).toBeCloseTo(750 / 7.1, 2);
    expect(ntPo.total_usd).toBeCloseTo(1800 / 32, 2);
    // Every line says which money its price is in.
    for (const po of orders) for (const item of JSON.parse(po.items_json)) expect(item.currency).toBe(po.display_currency);
  });

  test('a tea with no price on an order says "no price yet", leaves the totals alone, and is sent as a blank, not as 0', async ({ page }) => {
    await installCompassHarness(page, {
      customers: VENDORS, rates: RATES,
      compassEntries: [
        entry({ id: 'p-1', name: 'Mengku Laobanzhang', year: 2018, form: 'Cake', price_amount: 450, price_currency: 'Yuan', tasting: tasted }),
        entry({ id: 'p-2', name: 'Priceless Cake', form: 'Cake', price_amount: null, tasting: tasted }),
      ],
    });
    const sent = record(page);
    await openCurateV2(page, 'today');
    await buyFromToday(page, /Mengku Laobanzhang/);
    await buyFromToday(page, /Priceless Cake/);
    await tab(page, 'Orders').click();
    await page.getByRole('button', { name: 'Open the order with Wang Laoshi' }).click();
    const screen = page.getByTestId('order-screen');
    await expect(screen).toContainText('Mengku Laobanzhang');
    await expect(screen).toContainText('Priceless Cake');
    await expect(screen).toContainText('no price yet');
    await expect(screen.getByTestId('order-unpriced-note')).toContainText('1 tea has no price yet');
    // The figures are the priced tea's alone, in its money; no "0" is drawn for the other.
    const text = await screen.innerText();
    expect(text).toContain('¥450');
    expect(text).not.toMatch(/(¥|NT\$)0\b/);
    await expect(screen.getByLabel('Grand total')).toContainText('Teas¥450');

    await page.getByRole('button', { name: 'Confirm purchase' }).click();
    await expect.poll(() => sent.filter((s) => s.path === '/api/purchase-orders').length).toBe(1);
    const po = sent.find((s) => s.path === '/api/purchase-orders')!.body;
    const items = JSON.parse(po.items_json);
    expect(items.find((i: any) => i.name === 'Mengku Laobanzhang')).toMatchObject({ pricePerUnit: 450, currency: 'Yuan' });
    expect(items.find((i: any) => i.name === 'Priceless Cake').pricePerUnit).toBeNull();
    // A total that leaves a tea out is not recorded as the order's total.
    expect(po.total_usd).toBeUndefined();

    // "Mark as sent" names the order the shop recorded, by the id the shop gave it.
    await page.getByRole('button', { name: 'Mark as sent' }).click();
    await expect(page.getByRole('button', { name: 'Marked as sent' })).toBeVisible();
    const put = sent.find((s) => s.method === 'PUT' && s.path.startsWith('/api/purchase-orders/'))!;
    expect(put.path).toBe('/api/purchase-orders/po-created');
    expect(put.body).toEqual({ status: 'sent' });
  });

  test('changing your mind after Buy takes the tea off the order and back to deciding; it never falls off Today', async ({ page }) => {
    await installCompassHarness(page, {
      customers: VENDORS, rates: RATES,
      compassEntries: [
        entry({ id: 'c-1', name: 'Mengku Laobanzhang', year: 2018, form: 'Cake', price_amount: 450, price_currency: 'Yuan', tasting: tasted }),
        entry({ id: 'c-2', name: 'Bulang Gushu', year: 2020, form: 'Cake', price_amount: 300, price_currency: 'Yuan', tasting: tasted }),
      ],
    });
    await openCurateV2(page, 'today');
    const decide = page.getByTestId('today-section-decide');

    // Remove it from the order: it is waiting to be decided again.
    await decide.getByRole('button', { name: /Mengku Laobanzhang/ }).click();
    await buy(page).click();
    await page.getByTestId('order-screen').getByRole('button', { name: 'remove' }).click();
    await back(page).click();
    await expect(buy(page)).toHaveAttribute('aria-checked', 'false');
    await back(page).click();
    await expect(page.getByTestId('today-section-decide')).toContainText('Mengku Laobanzhang');
    await expect(page.getByTestId('today-section-way')).toHaveCount(0);

    // Pass after Buy: off the order, and the order that held only it is gone.
    await decide.getByRole('button', { name: /Bulang Gushu/ }).click();
    await buy(page).click();
    await back(page).click();
    await overlay(page).getByRole('radio', { name: 'Pass', exact: true }).click();
    await back(page).click();
    await expect(page.getByTestId('today-section-way')).toHaveCount(0);
    await expect(page.getByTestId('today-section-decide')).not.toContainText('Bulang Gushu');
    await tab(page, 'Orders').click();
    await expect(page.getByRole('button', { name: /Open the order with/ })).toHaveCount(0);
  });

  test('the full form\'s own Buy panel puts a vendorless tea on "No vendor yet", where it cannot be confirmed, and a message does not greet the placeholder', async ({ page }) => {
    await installCompassHarness(page, {
      customers: VENDORS, rates: RATES,
      compassEntries: [entry({ id: 'f-1', name: 'Stray Cake', form: 'Cake', price_amount: 200, price_currency: 'Yuan', vendor_name: null, vendor_id: null, tasting: tasted })],
    });
    await openCurateV2(page, 'teas');
    await page.getByRole('button', { name: /^Stray Cake/ }).first().click();
    await overlay(page).getByRole('button', { name: /Edit all fields/ }).click();
    const footer = overlay(page).getByTestId('capture-action-footer').filter({ visible: true });
    await footer.getByRole('button', { name: 'Buy', exact: true }).click();
    await overlay(page).getByRole('button', { name: 'Add to order' }).click();
    await expect.poll(() => compassRequestCount(page, 'POST /api/compass/entries/f-1/receipt-proposals')).toBe(1);
    await back(page).click();
    await back(page).click();
    await tab(page, 'Orders').click();
    await page.getByRole('button', { name: 'Open the order with No vendor yet' }).click();
    await expect(page.getByTestId('order-vendor')).toHaveText('No vendor yet');
    await expect(page.getByRole('button', { name: 'Choose the vendor' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirm purchase' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Message the vendor about this order' }).click();
    await expect(page.getByRole('dialog')).not.toContainText(/No vendor yet/i);
  });

  test('a vendor card: saving the website keeps the WeChat saved a moment before; "where" is stored whole', async ({ page }) => {
    await installCompassHarness(page, {
      customers: [{ id: 'vendor-wang', name: 'Wang Laoshi', tags: ['vendor'], city: 'Old city', address: '1 Old Road', country: 'China', contacts: JSON.stringify([{ channel: 'instagram', handle: 'wang.tea' }]) }],
      compassEntries: [entry({ id: 'v-1', name: 'Mengku', price_amount: 450, price_currency: 'Yuan' })],
    });
    await openCurateV2(page, 'today');
    await tab(page, 'Vendors').click();
    await page.getByRole('button', { name: /Wang Laoshi/ }).first().click();
    const card = page.getByTestId('curate-vendor-card');
    const fill = async (label: string, value: string) => {
      await card.getByRole('button', { name: new RegExp(`^${label}`) }).click();
      await card.getByRole('textbox', { name: label }).fill(value);
      await card.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(card.getByRole('textbox', { name: label })).toHaveCount(0);
    };
    await fill('WeChat', 'wang-ls');
    await fill('Website', 'https://wang.example');
    await fill('Where', 'Kunming, Yunnan');
    const puts = compassUpdatedCustomers(page).map((p) => p.body);
    // The list that was written for the website still holds the WeChat and Instagram handles.
    const websiteWrite = puts.find((b) => Array.isArray(b.contacts))!;
    expect(websiteWrite.contacts).toEqual(expect.arrayContaining([
      expect.objectContaining({ channel: 'wechat', handle: 'wang-ls' }),
      expect.objectContaining({ channel: 'instagram', handle: 'wang.tea' }),
      expect.objectContaining({ label: 'website', handle: 'https://wang.example' }),
    ]));
    // The old address and country are cleared with the city, or they come back beside it.
    const whereWrite = puts.find((b) => 'city' in b)!;
    expect(whereWrite).toEqual({ city: 'Kunming, Yunnan', address: null, country: null });
    expect(compassCreatedCustomers(page)).toEqual([]);
  });

  test('a vendor the shop has, named only on a tea, is one line and one record: its card writes to that record', async ({ page }) => {
    await installCompassHarness(page, {
      customers: [{ id: 'vendor-wang', name: 'Wang Laoshi', tags: ['vendor'] }],
      compassEntries: [entry({ id: 'n-1', name: 'Mengku', price_amount: 450, price_currency: 'Yuan', vendor_name: 'wang laoshi', vendor_id: null })],
    });
    await openCurateV2(page, 'today');
    await tab(page, 'Vendors').click();
    await expect(page.getByRole('button', { name: /Wang Laoshi/i })).toHaveCount(1);
    await expect(page.getByRole('button', { name: /Wang Laoshi/i })).toContainText('1 tea');
    await page.getByRole('button', { name: /Wang Laoshi/i }).click();
    const card = page.getByTestId('curate-vendor-card');
    await card.getByRole('button', { name: /^Note/ }).click();
    await card.getByRole('textbox', { name: 'Note' }).fill('Ships on Fridays');
    await card.getByRole('button', { name: 'Save', exact: true }).click();
    await expect.poll(() => compassUpdatedCustomers(page).length).toBe(1);
    expect(compassUpdatedCustomers(page)[0].id).toBe('vendor-wang');
    expect(compassCreatedCustomers(page)).toEqual([]);
  });

  test('a vendor known only by name becomes one record the first time something is saved, and a name the shop has is that record', async ({ page }) => {
    await installCompassHarness(page, {
      customers: [{ id: 'vendor-wang', name: 'Wang Laoshi', tags: ['vendor'] }],
      compassEntries: [
        entry({ id: 'o-1', name: 'Mengku', price_amount: 450, price_currency: 'Yuan', vendor_name: 'Li Tea House', vendor_id: null }),
      ],
    });
    await openCurateV2(page, 'today');
    await tab(page, 'Vendors').click();
    await page.getByRole('button', { name: /Li Tea House/ }).click();
    const card = page.getByTestId('curate-vendor-card');
    await card.getByRole('button', { name: /^WeChat/ }).click();
    await card.getByRole('textbox', { name: 'WeChat' }).fill('li-tea');
    await card.getByRole('button', { name: 'Save', exact: true }).click();
    await expect.poll(() => compassUpdatedCustomers(page).length).toBe(1);
    expect(compassCreatedCustomers(page).map((c) => c.name)).toEqual(['Li Tea House']);
  });

  test('what you said: a to-do that did not reach the shop is not "filed", and trying again sends only that one', async ({ page }) => {
    await installCompassHarness(page, {
      customers: VENDORS,
      compassEntries: [entry({ id: 's-1', name: 'Mengku', price_amount: 450, price_currency: 'Yuan', audio_clips: JSON.stringify([{ id: 'c1', timestamp: daysAgo(1), transcript: 'It is 450 a cake. Ask about the 2018 and send photos.', duration: 5 }]) })],
      saidParts: [
        { kind: 'todo', text: 'Ask about the 2018', fields: {} },
        { kind: 'todo', text: 'Send photos', fields: {} },
      ],
    });
    const sent = record(page);
    let failFirst = true;
    await page.route('**/api/curate/todos', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      const body = route.request().postDataJSON() as { text: string };
      if (failFirst && body.text === 'Send photos') { failFirst = false; return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"down"}' }); }
      return route.fulfill({ status: 201, contentType: 'application/json', body: '{"id":"todo-x"}' });
    });
    await openCurateV2(page, 'teas');
    await page.getByRole('button', { name: /^Mengku/ }).first().click();
    await overlay(page).getByTestId('tea-face-said').click();
    const sheet = page.getByTestId('said-sheet');
    await sheet.getByRole('button', { name: 'File it, part by part' }).click();
    await sheet.getByRole('button', { name: /^File 2 parts/ }).click();
    await expect(sheet).toContainText('could not be saved');
    await expect(sheet).not.toContainText('Filed');
    await expect(sheet.getByRole('button', { name: /^File 1 part/ })).toBeVisible();
    await sheet.getByRole('button', { name: /^File 1 part/ }).click();
    await expect(sheet).toContainText('Filed');
    const todos = sent.filter((s) => s.path === '/api/curate/todos').map((s) => s.body.text);
    expect(todos).toEqual(['Ask about the 2018', 'Send photos', 'Send photos']);
  });

  test('to-dos, an agent\'s find, Drive and the Chinese name each send what was asked and nothing more', async ({ page }) => {
    await installCompassHarness(page, {
      customers: VENDORS,
      compassEntries: [entry({ id: 'z-1', name: 'Mengku Laobanzhang', year: 2018, price_amount: 450, price_currency: 'Yuan', tasting: tasted })],
      todos: [{ id: 'todo-1', text: 'confirm the year', compass_entry_id: 'z-1', vendor_id: null, from_agent: 'GrokBot', created_at: daysAgo(1), tea_name: 'Mengku Laobanzhang', vendor_name: null }],
      agentSuggestions: [{ batch_id: 'batch-1', found_by: 'GrokBot', url: null, vendor: 'Mengku Tea House', contact: null, note: null, found_at: daysAgo(1),
        teas: [1, 2, 3].map((n) => ({ id: `s${n}`, name: `Find ${n}`, category: 'tea', type: null, year: null, price: null, note: null })) }],
    });
    const sent = record(page);
    const errors: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await openCurateV2(page, 'today');

    await page.getByRole('button', { name: '+ A to-do' }).click();
    await page.getByRole('textbox', { name: 'Add a to-do' }).fill('Ask Wang about the 2018');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByRole('button', { name: 'Done: confirm the year' }).click();

    await page.getByTestId('today-agent-find').click();
    await page.getByRole('checkbox', { name: 'Keep Find 1' }).click();
    await page.getByRole('checkbox', { name: 'Keep Find 3' }).click();
    await page.getByRole('button', { name: 'Add 2 to samples' }).click();

    await page.getByTestId('today-section-decide').getByRole('button', { name: /Mengku Laobanzhang/ }).click();
    await overlay(page).getByRole('button', { name: 'Suggest a Chinese name' }).click();
    await expect(overlay(page).getByTestId('chinese-suggestion')).toBeVisible();
    await overlay(page).getByRole('button', { name: 'Keep this Chinese name' }).click();

    await expect.poll(() => sent.some((s) => s.path === '/api/curate/suggestions/pick')).toBe(true);
    const bodyOf = (path: string) => sent.find((s) => s.path === path)?.body;
    expect(bodyOf('/api/curate/todos')).toEqual({ text: 'Ask Wang about the 2018' });
    expect(sent.find((s) => /\/api\/curate\/todos\/todo-1\/done$/.test(s.path))?.method).toBe('POST');
    expect(bodyOf('/api/curate/suggestions/pick')).toEqual({ pick: ['s1', 's3'], drop: ['s2'] });
    const chinese = sent.find((s) => s.path === '/api/generate-chinese-name')!.body;
    expect(chinese).toMatchObject({ name: 'Mengku Laobanzhang', year: 2018 });
    await expect.poll(() => synced(sent).get('z-1')?.chinese_name).toBe('孟库古树茶');
    // Keeping a Chinese name changes that and nothing else about the tea's money.
    expect(synced(sent).get('z-1')).toMatchObject({ price_amount: 450, price_currency: 'Yuan' });
    expect(errors).toEqual([]);
  });

  test('controls a finger can find: 44px in the agent\'s find, the filed parts, the order lines and the overview, and the order filters never print over each other', async ({ page }) => {
    await installCompassHarness(page, {
      customers: VENDORS, rates: RATES,
      compassEntries: [entry({ id: 'k-1', name: 'Mengku Laobanzhang', year: 2018, form: 'Cake', price_amount: 450, price_currency: 'Yuan', tasting: tasted, audio_clips: JSON.stringify([{ id: 'c1', timestamp: daysAgo(1), transcript: 'It is 450 a cake.', duration: 5 }]) })],
      agentSuggestions: [{ batch_id: 'b', found_by: 'GrokBot', url: null, vendor: 'Mengku Tea House', contact: null, note: null, found_at: daysAgo(1), teas: [{ id: 's1', name: 'Find 1', category: 'tea', type: null, year: 2019, price: { amount: 380, currency: 'Yuan', per_grams: 500 }, note: null }] }],
      saidParts: [{ kind: 'todo', text: 'Ask about the 2018', fields: {} }],
    });
    const box = async (loc: ReturnType<Page['locator']>) => (await loc.boundingBox())!;
    await openCurateV2(page, 'today');
    await page.getByTestId('today-agent-find').click();
    expect((await box(page.getByRole('button', { name: /Find 1/ }).first())).height).toBeGreaterThanOrEqual(43.5);
    await page.keyboard.press('Escape');
    await page.getByTestId('today-section-decide').getByRole('button', { name: /Mengku Laobanzhang/ }).click();
    await overlay(page).getByTestId('tea-face-said').click();
    await page.getByRole('button', { name: 'File it, part by part' }).click();
    for (const name of ['Keep: Ask about the 2018', 'Leave out: Ask about the 2018']) expect((await box(page.getByRole('button', { name }))).width).toBeGreaterThanOrEqual(43.5);
    await page.keyboard.press('Escape');
    await buy(page).click();
    const screen = page.getByTestId('order-screen');
    expect((await box(screen.getByRole('button', { name: 'Mengku Laobanzhang' }))).height).toBeGreaterThanOrEqual(43.5);
    expect((await box(screen.getByRole('spinbutton', { name: 'Amount' }))).height).toBeGreaterThanOrEqual(43.5);

    // On a laptop the orders list is a narrow column beside the overview.
    await page.setViewportSize({ width: 1280, height: 800 });
    await back(page).click();
    await back(page).click();
    await tab(page, 'Orders').click();
    const filters = await page.getByRole('tablist', { name: 'Which orders' }).getByRole('tab').all();
    const boxes = await Promise.all(filters.map(async (f) => (await f.boundingBox())!));
    for (let i = 0; i < boxes.length; i += 1) {
      const text = await filters[i].evaluate((el) => { const r = document.createRange(); r.selectNodeContents(el); const b = r.getBoundingClientRect(); return { left: b.left, right: b.right }; });
      expect(text.right).toBeLessThanOrEqual(boxes[i].x + boxes[i].width + 1);
      expect(text.left).toBeGreaterThanOrEqual(boxes[i].x - 1);
    }
    for (const name of ['Purchase Order Builder', 'Quick Note', 'Quick Sale']) expect((await box(page.getByRole('button', { name, exact: true }))).height).toBeGreaterThanOrEqual(43.5);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
  // ── Pass 6: the rest of what v2 sends, and what it says when a request fails ──

  /** A sentence a person can use: no status line, no column name, no stack of words in code. */
  const plain = (text: string) => {
    expect(text).not.toMatch(/Request failed|\(\d{3}\)|\b[a-z]+_[a-z_]+\b|undefined|\[object/i);
    expect(text.trim().length).toBeGreaterThan(10);
  };

  test('Confirm: a purchase order the shop did not take is said so, stays tryable, and trying again records ONE order; Mark as sent names it, and a failure to mark is not "Marked as sent"', async ({ page }) => {
    await installCompassHarness(page, {
      customers: VENDORS, rates: RATES,
      compassEntries: [entry({ id: 'po-1', name: 'Mengku Laobanzhang', year: 2018, form: 'Cake', price_amount: 450, price_currency: 'Yuan', tasting: tasted })],
      failRequests: [{ match: 'POST /api/purchase-orders', times: 1 }],
    });
    const sent = record(page);
    await openCurateV2(page, 'today');
    await buyFromToday(page, /Mengku Laobanzhang/);
    await tab(page, 'Orders').click();
    await page.getByRole('button', { name: 'Open the order with Wang Laoshi' }).click();
    await page.getByRole('button', { name: 'Confirm purchase' }).click();

    const failed = page.getByTestId('order-record-failed');
    await expect(failed).toBeVisible();
    plain(await failed.innerText());
    await expect(failed).toContainText('not recorded it yet');
    // Not offered as sent while the shop has no order to name.
    await expect(page.getByRole('button', { name: 'Mark as sent' })).toHaveCount(0);
    expect(sent.filter((s) => s.path === '/api/purchase-orders')).toHaveLength(1);

    await failed.getByRole('button', { name: 'Try again' }).click();
    await expect(failed).toHaveCount(0);
    const orders = sent.filter((s) => s.path === '/api/purchase-orders');
    expect(orders).toHaveLength(2);
    // Same order both times, in dollars, with its money named.
    expect(orders[1].body.po_number).toBe(orders[0].body.po_number);
    expect(orders[1].body.total_usd).toBeCloseTo(450 / 7.1, 2);
    expect(orders[1].body.display_currency).toBe('Yuan');

    // Mark as sent: a failure is said and the button is not turned into "Marked as sent".
    failCompassRequests(page, 'PUT /api/purchase-orders/po-created', 1);
    await page.getByRole('button', { name: 'Mark as sent' }).click();
    await expect(page.getByText('Could not mark it as sent. Try again.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Marked as sent' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Mark as sent' }).click();
    await expect(page.getByRole('button', { name: 'Marked as sent' })).toBeVisible();
    // It stays marked when the order is left and opened again.
    await back(page).click();
    await page.getByRole('button', { name: 'Open the order with Wang Laoshi' }).click();
    await expect(page.getByRole('button', { name: 'Marked as sent' })).toBeVisible();
    expect(sent.filter((s) => s.method === 'PUT' && s.path === '/api/purchase-orders/po-created')).toHaveLength(2);
  });

  test('Shelf: the tea is sent before it is shelved, shelving sends no body, a failure names the tea and keeps the line, and the money on the tea is untouched', async ({ page }) => {
    await installCompassHarness(page, {
      customers: VENDORS, rates: RATES,
      compassEntries: [
        entry({ id: 'sh-1', name: 'Shelf Cake', status: 'in_stock', form: 'Cake', price_amount: 450, price_currency: 'Yuan', price_per_unit_grams: 357, tasting: tasted }),
        entry({ id: 'sh-2', name: 'Other Cake', status: 'in_stock', form: 'Cake', price_amount: 300, price_currency: 'NT', tasting: tasted }),
      ],
      failRequests: [{ match: 'POST /api/compass/entries/sh-1/promote', times: 1 }],
    });
    const sent = record(page);
    await openCurateV2(page, 'today');
    const shelve = page.getByTestId('today-section-shelve');
    await shelve.getByRole('button', { name: 'Shelf: Shelf Cake' }).click();
    const alert = shelve.getByRole('alert');
    await expect(alert).toBeVisible();
    plain(await alert.innerText());
    await expect(alert).toContainText('Shelf Cake');
    await expect(shelve).toContainText('Shelf Cake');
    await expect(shelve).toContainText('Other Cake');
    // Try again from the same line.
    await shelve.getByRole('button', { name: 'Shelf: Shelf Cake' }).click();
    await expect(shelve).not.toContainText('Shelf Cake');
    await expect(shelve).toContainText('Other Cake');
    const promotes = sent.filter((s) => /\/promote$/.test(s.path));
    for (const p of promotes) expect(p.body ?? null).toBeNull();
    expect(promotes.every((p) => p.path === '/api/compass/entries/sh-1/promote')).toBe(true);
    // Linking the product back sends the tea again with its money exactly as it was.
    await expect.poll(() => synced(sent).get('sh-1')?.draft_product_id).toBe('product-sh-1');
    expect(synced(sent).get('sh-1')).toMatchObject({ price_amount: 450, price_currency: 'Yuan', price_per_unit_grams: 357 });
    expect(synced(sent).has('sh-2')).toBe(false);
  });

  test('Arrived on a pending receipt: accepting sends nothing but the accept, a failure is said, the row stays, and trying again moves the tea to the shelf line', async ({ page }) => {
    await installCompassHarness(page, {
      customers: VENDORS, rates: RATES,
      compassEntries: [entry({ id: 'ar-1', name: 'Nannuo 2021', status: 'incoming', form: 'Cake', price_amount: 280, price_currency: 'Yuan', tasting: tasted })],
      pendingReceipts: [{ id: 'rp-1', compass_entry_id: 'ar-1', tea_name: 'Nannuo 2021', vendor_name: 'Wang Laoshi', quantity: 2, unit: 'unit', created_at: daysAgo(3) }],
      failRequests: [{ match: 'POST /api/curate/receipt-proposals/rp-1/accept', times: 1 }],
    });
    const sent = record(page);
    await openCurateV2(page, 'today');
    const way = page.getByTestId('today-section-way');
    await way.getByRole('button', { name: 'Arrived: Nannuo 2021' }).click();
    await expect(way.getByRole('alert').or(way.locator('p.text-tea-error'))).toBeVisible();
    plain(await way.locator('p.text-tea-error').innerText());
    await expect(way).toContainText('Nannuo 2021');
    await expect(page.getByTestId('today-section-shelve')).toHaveCount(0);
    await way.getByRole('button', { name: 'Arrived: Nannuo 2021' }).click();
    await expect(page.getByTestId('today-section-shelve')).toContainText('Nannuo 2021');
    const accepts = sent.filter((s) => s.path === '/api/curate/receipt-proposals/rp-1/accept');
    expect(accepts).toHaveLength(2);
    for (const a of accepts) expect(a.body ?? null).toBeNull();
    // The tea's own money is not touched by arriving.
    await expect.poll(() => synced(sent).get('ar-1')?.status).toBe('in_stock');
    expect(synced(sent).get('ar-1')).toMatchObject({ price_amount: 280, price_currency: 'Yuan' });
  });

  test('an agent\'s find: a failed pick is said, keeps the ticks and the sheet, trying again sends the same pick once; another find opens without the old failure', async ({ page }) => {
    const find = (id: string, vendor: string) => ({ batch_id: id, found_by: 'GrokBot', url: null, vendor, contact: null, note: null, found_at: daysAgo(1),
      teas: [1, 2].map((n) => ({ id: `${id}-s${n}`, name: `${vendor} tea ${n}`, category: 'tea', type: null, year: null, price: { amount: 380, currency: 'Yuan', per_grams: 500 }, note: null })) });
    await installCompassHarness(page, {
      customers: VENDORS,
      agentSuggestions: [find('b1', 'Mengku House'), find('b2', 'Bulang House')],
      failRequests: [{ match: 'POST /api/curate/suggestions/pick', times: 1 }],
    });
    const sent = record(page);
    await openCurateV2(page, 'today');
    await page.getByTestId('today-agent-find').first().click();
    await page.getByRole('checkbox', { name: 'Keep Mengku House tea 1' }).click();
    await page.getByRole('button', { name: 'Add 1 to samples' }).click();
    const sheet = page.getByTestId('agent-finds-sheet');
    const error = sheet.locator('p.text-tea-error');
    await expect(error).toBeVisible();
    plain(await error.innerText());
    await expect(page.getByRole('checkbox', { name: 'Keep Mengku House tea 1' })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('button', { name: 'Add 1 to samples' }).click();
    await expect(sheet).toHaveCount(0);
    const picks = sent.filter((s) => s.path === '/api/curate/suggestions/pick');
    expect(picks).toHaveLength(2);
    expect(picks[1].body).toEqual({ pick: ['b1-s1'], drop: ['b1-s2'] });
    expect(picks[0].body).toEqual(picks[1].body);

    // A failure from one find is not left standing on the next.
    failCompassRequests(page, 'POST /api/curate/suggestions/pick', 1);
    await page.getByTestId('today-agent-find').filter({ hasText: 'Bulang House' }).click();
    await page.getByRole('checkbox', { name: /^Keep Bulang House tea 1/ }).click();
    await page.getByRole('button', { name: 'Add 1 to samples' }).click();
    await expect(sheet.locator('p.text-tea-error')).toBeVisible();
    await page.getByRole('button', { name: 'Not now' }).click();
    await page.getByTestId('today-agent-find').filter({ hasText: 'Mengku House' }).click();
    await expect(page.getByTestId('agent-finds-sheet').locator('p.text-tea-error')).toHaveCount(0);
  });

  test('Drive: Copy photos now sends an empty save and says how many were copied; a failure is said in words and can be tried again', async ({ page }) => {
    await installCompassHarness(page, {
      customers: VENDORS,
      compassEntries: [entry({ id: 'dr-1', name: 'Mengku', price_amount: 450, price_currency: 'Yuan' })],
      drive: { connected: true, email: 'shop@example.com', folder_url: null },
      failRequests: [{ match: 'POST /api/curate/drive/save', times: 1 }],
    });
    const sent = record(page);
    await openCurateV2(page, 'today');
    const line = page.getByTestId('curate-drive-line');
    await expect(line).toContainText('Photos are saved to Google Drive');
    await line.getByRole('button', { name: 'Copy photos now' }).click();
    const error = line.locator('p.text-tea-error');
    await expect(error).toBeVisible();
    plain(await error.innerText());
    await line.getByRole('button', { name: 'Copy photos now' }).click();
    await expect(line).toContainText('2 photos copied to Drive.');
    const saves = sent.filter((s) => s.path === '/api/curate/drive/save');
    expect(saves).toHaveLength(2);
    for (const s of saves) expect(s.body).toEqual({});
    // Nothing about a tea was sent by looking at Drive.
    expect(sent.filter((s) => s.path === '/api/compass/sync')).toEqual([]);
  });

  test('what you said: the recording goes up as it was, a price is filed in the shop\'s own money and unit, and nothing already entered is overwritten', async ({ page }) => {
    await installCompassHarness(page, {
      customers: VENDORS,
      compassEntries: [
        entry({ id: 'sd-1', name: 'Mengku', year: 2019, price_amount: null, audio_clips: JSON.stringify([{ id: 'c1', timestamp: daysAgo(1), transcript: 'Mengku 2018 sheng, 450 yuan a cake.', duration: 5 }]) }),
        entry({ id: 'sd-2', name: 'Alishan', price_amount: 1800, price_currency: 'NT', form: 'Brick', audio_clips: JSON.stringify([{ id: 'c2', timestamp: daysAgo(1), transcript: 'It is 600 yuan a cake.', duration: 5 }]) }),
      ],
      saidParts: [
        { kind: 'tea', text: 'Mengku 2018 sheng', fields: { year: 2018, type: 'Sheng', form: 'Cake' } },
        { kind: 'price', text: '450 yuan a cake', fields: { amount: 450, currency: 'CNY', per: 'cake' } },
      ],
      failRequests: [{ match: 'POST /api/curate/said/file', times: 1 }],
    });
    const sent = record(page);
    await openCurateV2(page, 'teas');
    await page.getByRole('button', { name: /^Mengku/ }).first().click();
    await overlay(page).getByTestId('tea-face-said').click();
    const sheet = page.getByTestId('said-sheet');
    await sheet.getByRole('button', { name: 'File it, part by part' }).click();
    const error = sheet.locator('p.text-tea-error');
    await expect(error).toBeVisible();
    plain(await error.innerText());
    await sheet.getByRole('button', { name: 'File it, part by part' }).click();
    await sheet.getByRole('button', { name: /^File 2 parts/ }).click();
    await expect(sheet).toContainText('Filed');
    expect(sent.filter((s) => s.path === '/api/curate/said/file')[1].body).toEqual({ text: 'Mengku 2018 sheng, 450 yuan a cake.', tea_name: 'Mengku' });
    // The price is in the shop's money (Yuan, not CNY) with its unit; the year the person typed stands.
    await expect.poll(() => synced(sent).get('sd-1')?.price_amount).toBe(450);
    expect(synced(sent).get('sd-1')).toMatchObject({ price_currency: 'Yuan', form: 'Cake', year: 2019, type: 'Sheng' });

    // A tea that already has a price keeps it: the recording does not change what was entered.
    await page.keyboard.press('Escape');
    await back(page).click();
    await page.getByRole('button', { name: /^Alishan/ }).first().click();
    await overlay(page).getByTestId('tea-face-said').click();
    await sheet.getByRole('button', { name: 'File it, part by part' }).click();
    await sheet.getByRole('button', { name: /^File 2 parts/ }).click();
    await expect(sheet).toContainText('Filed');
    await page.waitForTimeout(600);
    // Only what was empty is filled (the year); the price and shape stand.
    await expect.poll(() => synced(sent).get('sd-2')?.year).toBe(2018);
    expect(synced(sent).get('sd-2')).toMatchObject({ price_amount: 1800, price_currency: 'NT', form: 'Brick' });
  });

  test('a tea typed while the shop is slow to answer lands once: never a second row, never a second record', async ({ page }) => {
    await installCompassHarness(page, { customers: VENDORS });
    delayCompassRequests(page, 'POST /api/compass/sync', 2500);
    const sent = record(page);
    await openCurateV2(page, 'table');
    await page.getByTestId('table-start').click();
    await page.getByTestId('vendor-picker').getByRole('button', { name: 'Wang Laoshi' }).click();
    await addTea(page, 'Yiwu Gushu 2019 ¥1200/cake');
    await addTea(page, 'Bulang 2020 ¥300/cake');
    const rows = tableRows(page);
    await expect(rows).toHaveCount(2);
    // Everything has landed once the shop has answered; the rows are still two and the shop holds two.
    await expect.poll(() => compassRequestCount(page, 'POST /api/compass/sync'), { timeout: 15_000 }).toBeGreaterThan(0);
    await page.waitForTimeout(3500);
    await expect(rows).toHaveCount(2);
    const ids = new Set<string>();
    for (const s of sent) if (s.path === '/api/compass/sync') for (const e of s.body.entries ?? []) ids.add(e.id);
    expect(ids.size).toBe(2);
    await expect(page.getByTestId('curate-sync-notice')).toHaveCount(0);
  });

  test('when the shop cannot be reached, every screen says so in a sentence with Try again, nothing typed is lost, and it clears once the shop answers', async ({ page }) => {
    await installCompassHarness(page, { customers: VENDORS, failRequests: [{ match: 'POST /api/compass/sync' }] });
    const sent = record(page);
    await openCurateV2(page, 'table');
    await page.getByTestId('table-start').click();
    await page.getByTestId('vendor-picker').getByRole('button', { name: 'Wang Laoshi' }).click();
    await addTea(page, 'Yiwu Gushu 2019 ¥1200/cake');
    const notice = page.getByTestId('curate-sync-notice');
    await expect(notice).toBeVisible({ timeout: 20_000 });
    plain(await notice.innerText());
    await expect(notice).toContainText('1 change has not reached the shop yet');
    // The same sentence on the other screens.
    await tab(page, 'Today').click();
    await expect(notice).toBeVisible();
    // The fast tasting does not claim to be saved.
    await tab(page, 'Table').click();
    await page.getByRole('button', { name: /^Fast tasting for/ }).click();
    await expect(page.getByText('Not saved to the shop yet. It will try again.')).toBeVisible();
    await expect(page.getByText('Saved as you tap', { exact: true })).toHaveCount(0);
    await page.keyboard.press('Escape');
    // The shop answers: the notice goes, and the tea (with its price) is what arrives.
    clearCompassFailures(page);
    await notice.getByRole('button', { name: 'Try again' }).click();
    await expect(notice).toHaveCount(0);
    expect(synced(sent).get([...synced(sent).keys()][0])).toMatchObject({ name: 'Yiwu Gushu', price_amount: 1200, price_currency: 'Yuan' });
    await expect(tableRows(page)).toHaveCount(1);
  });
  test('Edit all fields: every money field is sent as typed and in the shop\'s own names; a cleared field is a blank, a typed 0 is a 0, and nothing else on the tea changes', async ({ page }) => {
    await installCompassHarness(page, {
      customers: VENDORS, rates: RATES,
      compassEntries: [entry({ id: 'ea-1', name: 'Card Tea', year: 2019, form: 'Cake', price_amount: 450, price_currency: 'Yuan', price_per_unit_grams: 357, chinese_name: '测试茶', notes: 'kept', tasting: tasted })],
    });
    const sent = record(page);
    const errors: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await openCurateV2(page, 'teas');
    await page.getByRole('button', { name: /^Card Tea/ }).first().click();
    await overlay(page).getByRole('button', { name: /Edit all fields/ }).click();
    const card = overlay(page);
    const price = card.getByRole('spinbutton', { name: 'Price' });
    const grams = card.getByRole('spinbutton', { name: 'Grams' });

    await price.fill('500');
    await card.getByRole('combobox', { name: 'Currency' }).selectOption('NT');
    await grams.fill('400');
    await card.getByRole('button', { name: 'Tea form' }).click();
    await page.getByRole('button', { name: 'Brick', exact: true }).click();
    await card.locator('input[type=number]').first().fill('2020');
    await expect.poll(() => synced(sent).get('ea-1')?.price_amount).toBe(500);
    await expect.poll(() => synced(sent).get('ea-1')?.form).toBe('Brick');
    expect(synced(sent).get('ea-1')).toMatchObject({
      name: 'Card Tea', price_amount: 500, price_currency: 'NT', price_per_unit_grams: 400, form: 'Brick', year: 2020,
      vendor_id: 'vendor-wang', vendor_name: 'Wang Laoshi', chinese_name: '测试茶', notes: 'kept', category: 'tea', type: 'Sheng',
    });
    expect(JSON.parse(synced(sent).get('ea-1')!.tasting)).toMatchObject({ quality: 8, cleanliness: 'clean' });

    // Cleared is a blank, never a 0.
    await price.fill('');
    await grams.fill('');
    await expect.poll(() => synced(sent).get('ea-1')?.price_amount ?? 'blank').toBe('blank');
    expect(synced(sent).get('ea-1')!.price_per_unit_grams ?? null).toBeNull();
    // A 0 the person typed is a 0: a tea that was free.
    await price.fill('0');
    await expect.poll(() => synced(sent).get('ea-1')?.price_amount).toBe(0);
    expect(synced(sent).get('ea-1')!.price_currency).toBe('NT');

    // The vendor changed from the card reaches the tea by id and name together.
    await card.getByRole('button', { name: 'Vendor Wang Laoshi' }).click();
    await card.getByRole('button', { name: 'Vendor: Wang Laoshi. Change' }).click();
    await card.getByRole('option', { name: /Chen Family/ }).or(card.getByRole('button', { name: /^Chen Family/ })).first().click();
    await expect.poll(() => synced(sent).get('ea-1')?.vendor_id).toBe('vendor-chen');
    expect(synced(sent).get('ea-1')).toMatchObject({ vendor_name: 'Chen Family', price_amount: 0, price_currency: 'NT' });
    expect(compassCreatedCustomers(page)).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('Edit all fields on a tea the shop holds with no price: the money shown is Yuan, not a stamped NT, and is stored only when a price is typed', async ({ page }) => {
    await installCompassHarness(page, {
      customers: VENDORS, rates: RATES,
      compassEntries: [
        entry({ id: 'np-1', name: 'Unpriced Tea', form: 'Cake', price_amount: null, price_currency: null, tasting: tasted }),
        entry({ id: 'np-2', name: 'Chosen Tea', form: 'Cake', price_amount: null, price_currency: null, tasting: tasted }),
      ],
    });
    const sent = record(page);
    await openCurateV2(page, 'teas');
    await page.getByRole('button', { name: /^Unpriced Tea/ }).first().click();
    await overlay(page).getByRole('button', { name: /Edit all fields/ }).click();
    const card = overlay(page);
    const currency = card.getByRole('combobox', { name: 'Currency' });
    await expect(currency).toHaveValue('Yuan');
    // Looking at it stores nothing.
    expect(synced(sent).has('np-1')).toBe(false);
    await card.getByRole('spinbutton', { name: 'Price' }).fill('1200');
    await expect.poll(() => synced(sent).get('np-1')?.price_amount).toBe(1200);
    expect(synced(sent).get('np-1')).toMatchObject({ price_amount: 1200, price_currency: 'Yuan' });
    await back(page).click();
    await back(page).click();

    // A money the person picked is theirs.
    await page.getByRole('button', { name: /^Chosen Tea/ }).first().click();
    await overlay(page).getByRole('button', { name: /Edit all fields/ }).click();
    await overlay(page).getByRole('combobox', { name: 'Currency' }).selectOption('NT');
    await overlay(page).getByRole('spinbutton', { name: 'Price' }).fill('1800');
    await expect.poll(() => synced(sent).get('np-2')?.price_amount).toBe(1800);
    expect(synced(sent).get('np-2')).toMatchObject({ price_amount: 1800, price_currency: 'NT' });
  });

  test('photos: two added back to back are both kept, a failed upload says so and keeps the first, and nothing but the photo list changes', async ({ page }) => {
    await installCompassHarness(page, {
      customers: VENDORS, rates: RATES,
      compassEntries: [entry({ id: 'ph-1', name: 'Photo Tea', form: 'Cake', price_amount: 450, price_currency: 'Yuan', price_per_unit_grams: 357, tasting: tasted })],
    });
    delayCompassRequests(page, 'POST /api/upload-image', 800);
    const sent = record(page);
    await openCurateV2(page, 'teas');
    await page.getByRole('button', { name: /^Photo Tea/ }).first().click();
    await overlay(page).getByRole('button', { name: /Edit all fields/ }).click();
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    const input = overlay(page).locator('input[type=file]').first();
    await input.setInputFiles({ name: 'one.png', mimeType: 'image/png', buffer: png });
    await input.setInputFiles({ name: 'two.png', mimeType: 'image/png', buffer: png });
    await expect.poll(() => JSON.parse(synced(sent).get('ph-1')?.photos ?? '[]').length, { timeout: 15_000 }).toBe(2);
    const photos = JSON.parse(synced(sent).get('ph-1')!.photos);
    expect(new Set(photos).size).toBe(2);
    expect(synced(sent).get('ph-1')).toMatchObject({ price_amount: 450, price_currency: 'Yuan', price_per_unit_grams: 357, form: 'Cake' });

    // A third that the shop does not take: said in a sentence (the first two stay), and tried again from the same picture.
    failCompassRequests(page, 'POST /api/upload-image', 1);
    await input.setInputFiles({ name: 'three.png', mimeType: 'image/png', buffer: png });
    const failed = overlay(page).getByTestId('photo-upload-failed');
    await expect(failed).toBeVisible({ timeout: 15_000 });
    plain(await failed.innerText());
    expect(JSON.parse(synced(sent).get('ph-1')!.photos)).toHaveLength(2);
    await failed.getByRole('button', { name: 'Try again' }).click();
    await expect(failed).toHaveCount(0);
    await expect.poll(() => JSON.parse(synced(sent).get('ph-1')?.photos ?? '[]').length, { timeout: 15_000 }).toBe(3);
    expect(new Set(JSON.parse(synced(sent).get('ph-1')!.photos)).size).toBe(3);
  });
  test('tasting: a fast tasting adds its answers to the tea\'s tasting and nothing else; the full tasting opened from it keeps them, and neither touches the money', async ({ page }) => {
    await installCompassHarness(page, {
      customers: VENDORS, rates: RATES,
      compassEntries: [entry({ id: 'ta-1', name: 'Taste Cake', form: 'Cake', price_amount: 450, price_currency: 'Yuan', price_per_unit_grams: 357, tasting: JSON.stringify({ quality: 6, body: ['full'], flavor: ['sweet'], notes: 'kept words' }) })],
    });
    const sent = record(page);
    const errors: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));
    await openCurateV2(page, 'teas');
    await page.getByRole('button', { name: /^Taste Cake/ }).first().click();
    await overlay(page).getByRole('button', { name: 'Taste', exact: true }).click();
    const sheet = page.getByRole('dialog');
    await sheet.getByRole('group', { name: 'How good' }).getByRole('button', { name: '8', exact: true }).click();
    await sheet.getByRole('group', { name: 'How clean' }).getByRole('button', { name: 'Clean', exact: true }).click();
    await sheet.getByRole('group', { name: 'Stays' }).getByRole('button', { name: 'Long', exact: true }).click();
    await expect.poll(() => JSON.parse(synced(sent).get('ta-1')?.tasting ?? '{}').finish?.[0]).toBe('finish-long');
    const fast = JSON.parse(synced(sent).get('ta-1')!.tasting);
    expect(fast).toMatchObject({ quality: 8, cleanliness: 'clean', body: ['full'], flavor: ['sweet'], finish: ['finish-long'], notes: 'kept words' });
    expect(synced(sent).get('ta-1')).toMatchObject({ price_amount: 450, price_currency: 'Yuan', price_per_unit_grams: 357, form: 'Cake' });
    // The full tasting opens on the same answers.
    await sheet.getByRole('button', { name: /Full tasting/ }).click();
    await expect(page.getByRole('radio', { name: '8' }).first()).toBeChecked();
    expect(errors).toEqual([]);
  });
  test('to-dos and the vendor card: a save the shop did not take is said in words, what was typed stays, and trying again sends it once more', async ({ page }) => {
    await installCompassHarness(page, {
      customers: [{ id: 'vendor-wang', name: 'Wang Laoshi', tags: ['vendor'] }],
      compassEntries: [entry({ id: 'td-1', name: 'Mengku', price_amount: 450, price_currency: 'Yuan', tasting: tasted })],
      todos: [{ id: 'todo-1', text: 'confirm the year', compass_entry_id: 'td-1', vendor_id: null, from_agent: null, created_at: daysAgo(1), tea_name: 'Mengku', vendor_name: null }],
      failRequests: [
        { match: 'POST /api/curate/todos', times: 1 },
        { match: 'POST /api/curate/todos/todo-1/done', times: 1 },
        { match: 'PUT /api/customers/vendor-wang', times: 1 },
      ],
    });
    const sent = record(page);
    await openCurateV2(page, 'today');
    const todo = page.getByTestId('today-section-todo');
    await todo.getByRole('button', { name: '+ A to-do' }).click();
    await todo.getByRole('textbox', { name: 'Add a to-do' }).fill('Ask Wang about the 2018');
    await todo.getByRole('button', { name: 'Add', exact: true }).click();
    const error = todo.locator('p.text-tea-error');
    await expect(error).toBeVisible();
    plain(await error.innerText());
    await expect(todo.getByRole('textbox', { name: 'Add a to-do' })).toHaveValue('Ask Wang about the 2018');
    await todo.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(todo.getByRole('textbox', { name: 'Add a to-do' })).toHaveCount(0);

    await todo.getByRole('button', { name: 'Done: confirm the year' }).click();
    await expect(todo.locator('p.text-tea-error')).toBeVisible();
    plain(await todo.locator('p.text-tea-error').innerText());
    await expect(todo.getByRole('button', { name: 'Done: confirm the year' })).toBeVisible();
    await todo.getByRole('button', { name: 'Done: confirm the year' }).click();
    await expect(todo.getByRole('button', { name: 'Done: confirm the year' })).toHaveCount(0);
    expect(sent.filter((s) => s.path === '/api/curate/todos').map((s) => s.body.text)).toEqual(['Ask Wang about the 2018', 'Ask Wang about the 2018']);
    expect(sent.filter((s) => s.path === '/api/curate/todos/todo-1/done')).toHaveLength(2);

    await tab(page, 'Vendors').click();
    await page.getByRole('button', { name: /Wang Laoshi/ }).first().click();
    const card = page.getByTestId('curate-vendor-card');
    await card.getByRole('button', { name: /^WeChat/ }).click();
    await card.getByRole('textbox', { name: 'WeChat' }).fill('wang-ls');
    await card.getByRole('button', { name: 'Save', exact: true }).click();
    const cardError = card.locator('p.text-tea-error');
    await expect(cardError).toBeVisible();
    plain(await cardError.innerText());
    await expect(card.getByRole('textbox', { name: 'WeChat' })).toHaveValue('wang-ls');
    await card.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(card.getByRole('textbox', { name: 'WeChat' })).toHaveCount(0);
    const puts = compassUpdatedCustomers(page);
    expect(puts.map((p) => p.body)).toEqual([{ wechat: 'wang-ls' }]);
    expect(compassCreatedCustomers(page)).toEqual([]);
  });
});
