/**
 * Launch 2, slice H6: a tea for the table, at phone size, with mocked routes
 * (todo/plans/guests-and-tea-masters-launch-2-run.md, "Sol, H6").
 *
 * The page exists only while Launch 2 is open, so this spec needs a site
 * started with VITE_FEW_HOSTS_OPEN=true and is skipped otherwise.
 */
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

test.skip(process.env.VITE_FEW_HOSTS_OPEN !== 'true', 'Needs a site started with VITE_FEW_HOSTS_OPEN=true');
test.use({ viewport: { width: 390, height: 844 } });

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const token = [encode({ alg: 'HS256', typ: 'JWT' }), encode({
  sub: 'ana', email: 'ana@example.test', name: 'Ana Host', role: 'user', memberships: [],
  active_account_id: null, exp: Math.floor(Date.now() / 1000) + 3600,
}), 'signature'].join('.');

// A small photograph, 8 by 6 pixels.
const PHOTO = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAGCAIAAABxZ0isAAAAEUlEQVR4nGNoSHDAihgGUgIA33c2AWgCUREAAAAASUVORK5CYII=',
  'base64',
);
const PHOTO_URL = 'https://media.teajia.co/accounts/ana-personal/host-teas/t-ana/framed.jpg';

type Tea = {
  id: string; name: string; source: 'shop' | 'chest' | 'name'; product_id: string | null;
  brew_order: number; from: string | null; photo_url: string | null;
};

const MATCHES = [
  { source: 'shop', id: 'p-shou', name: '2015 Shou Brick', type: 'Shou', year: '2015' },
  { source: 'chest', id: 'p-ana', name: 'Shoulder of the mountain oolong', type: 'Oolong', year: null },
];

function tableState() {
  return {
    table: {
      id: 't-ana', slug: 'ana-next', title: 'Ana’s next table', event_date: new Date(Date.now() + 7 * 86400000).toISOString(),
      timezone: 'Asia/Makassar', door: 'request', seats: 4, seats_taken: 0, lifecycle_status: 'published',
      requires_approval: 1, public_visibility: 'unlisted', link: 'https://teajia.test/event/ana-next',
    },
    guests: [],
    teas: [] as Tea[],
    doors: ['request', 'link'],
  };
}

async function openTeas(page: Page, state: ReturnType<typeof tableState>, saves: unknown[]) {
  let made = 0;
  await page.addInitScript(jwt => localStorage.setItem('teajia_token', jwt), token);
  await page.route('https://media.teajia.co/**', route => route.fulfill({ contentType: 'image/png', body: PHOTO }));
  await page.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/api/me/tables/t-ana' && request.method() === 'GET') return route.fulfill({ json: state });
    if (url.pathname === '/api/me/tables/t-ana/tea-search') {
      const q = (url.searchParams.get('q') ?? '').toLowerCase();
      return route.fulfill({ json: { matches: MATCHES.filter(match => match.name.toLowerCase().includes(q)) } });
    }
    if (url.pathname === '/api/me/tables/t-ana/teas' && request.method() === 'PUT') {
      const body = request.postDataJSON() as { teas: Array<Partial<Tea>> };
      saves.push(body.teas);
      state.teas = body.teas.map((tea, index) => ({
        id: tea.id ?? `m-${++made}`, name: tea.name!, source: tea.source ?? 'name', product_id: tea.product_id ?? null,
        brew_order: index + 1, from: tea.from ?? null, photo_url: tea.photo_url ?? null,
      }));
      return route.fulfill({ json: { teas: state.teas } });
    }
    if (url.pathname === '/api/me/tables/t-ana/teas/photo' && request.method() === 'POST') {
      return route.fulfill({ status: 201, json: { url: PHOTO_URL } });
    }
    if (url.pathname === '/api/me/hosting') return route.fulfill({ json: { approved: true, account_id: 'ana-personal', doors: ['request', 'link'] } });
    return route.fulfill({ json: {} });
  });
  await page.goto('/account/host/t-ana?part=teas');
  await expect(page.getByRole('heading', { name: 'Teas', level: 2 })).toBeVisible();
}

async function noSideScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

const teaNames = (page: Page) => page.locator('[data-host-tea] p').filter({ hasText: /^\d+\. / });

test('a shop tea, a chest tea and a typed name are added, one is taken off, and the order holds after reload', async ({ page }) => {
  const saves: unknown[] = [];
  const state = tableState();
  await openTeas(page, state, saves);
  await expect(page.getByText('No teas listed. That is fine.')).toBeVisible();
  await noSideScroll(page);

  const field = page.getByLabel('Add a tea');
  await field.fill('sho');
  const options = page.locator('[data-host-tea-matches] button');
  await expect(options).toHaveCount(3);
  await expect(options.nth(0)).toContainText('2015 Shou Brick');
  await expect(options.nth(0)).toContainText('From Teajia’s shop');
  await expect(options.nth(1)).toContainText('Shoulder of the mountain oolong');
  await expect(options.nth(1)).toContainText('From your Tea Chest');
  await expect(options.nth(2)).toHaveText("Add 'sho' as written");
  await noSideScroll(page);

  await options.nth(0).click();
  await expect(teaNames(page)).toHaveText(['1. 2015 Shou Brick']);
  await expect(field).toHaveValue('');

  await field.fill('shoulder');
  await page.locator('[data-host-tea-match="chest"]').click();
  await expect(teaNames(page)).toHaveText(['1. 2015 Shou Brick', '2. Shoulder of the mountain oolong']);

  await field.fill('Spring green from Mei');
  await page.getByRole('button', { name: "Add 'Spring green from Mei' as written" }).click();
  await expect(teaNames(page)).toHaveText(['1. 2015 Shou Brick', '2. Shoulder of the mountain oolong', '3. Spring green from Mei']);
  expect(saves.at(-1)).toEqual([
    expect.objectContaining({ source: 'shop', product_id: 'p-shou', name: '2015 Shou Brick' }),
    expect.objectContaining({ source: 'chest', product_id: 'p-ana', name: 'Shoulder of the mountain oolong' }),
    expect.objectContaining({ source: 'name', name: 'Spring green from Mei' }),
  ]);

  // No price, stock or cost on this screen.
  await expect(page.locator('[data-host-part="teas"]')).not.toContainText(/\$|price|stock|cost|grams/i);

  await page.getByRole('button', { name: 'Take Shoulder of the mountain oolong off the table' }).click();
  await expect(teaNames(page)).toHaveText(['1. 2015 Shou Brick', '2. Spring green from Mei']);
  await noSideScroll(page);

  await page.reload();
  await expect(teaNames(page)).toHaveText(['1. 2015 Shou Brick', '2. Spring green from Mei']);
  await noSideScroll(page);
});

test('where a tea is from and its photograph are optional, and the photograph opens in the photo editor first', async ({ page }) => {
  const saves: unknown[] = [];
  const state = tableState();
  state.teas = [{ id: 'm-1', name: 'Spring green from Mei', source: 'name', product_id: null, brew_order: 1, from: null, photo_url: null }];
  await openTeas(page, state, saves);
  const row = page.locator('[data-host-tea="m-1"]');
  await expect(row.getByLabel('Where it is from')).toHaveValue('');

  await row.getByLabel('Where it is from').fill('A garden above Lishan');
  await row.getByLabel('Where it is from').blur();
  await expect(page.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible();
  expect(saves.at(-1)).toEqual([expect.objectContaining({ id: 'm-1', from: 'A garden above Lishan' })]);

  await row.locator('[data-host-tea-photo-input="m-1"]').setInputFiles({ name: 'tea.png', mimeType: 'image/png', buffer: PHOTO });
  const editor = page.getByRole('dialog');
  await expect(editor).toBeVisible();
  await editor.getByRole('button', { name: 'Use photo' }).click();
  await expect(row.getByRole('img', { name: 'Photograph of Spring green from Mei' })).toHaveAttribute('src', PHOTO_URL);
  expect(saves.at(-1)).toEqual([expect.objectContaining({ id: 'm-1', from: 'A garden above Lishan', photo_url: PHOTO_URL })]);
  await noSideScroll(page);
});
