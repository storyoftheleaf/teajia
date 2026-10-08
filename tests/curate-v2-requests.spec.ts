/**
 * Curate v2: what it SENDS. Every write the page makes during a walk is
 * recorded (method, path, body) and held to the shop's money rules: a cost
 * with its currency, a blank sent as a blank and never as 0, one order in one
 * money, no second record for a vendor the shop already has, nothing the
 * person entered overwritten.
 */
import { test, expect, type Page } from './fixtures';
import {
  compassCreatedCustomers,
  compassRequestCount,
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
});
