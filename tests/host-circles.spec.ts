/**
 * Launch 5, M4, circles and series, at phone size, with mocked routes
 * (todo/plans/guests-and-tea-masters-launch-5-run.md, package M4).
 *
 * On their own page, a host makes a circle, names it, puts one of their own
 * tables in it and takes it out again. Making one is a step in the address,
 * so back closes the form. Nothing on the page counts anything.
 *
 * Needs a site started with VITE_FEW_HOSTS_OPEN=true and
 * VITE_CIRCLES_OPEN=true, and is skipped otherwise.
 */
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

test.skip(
  process.env.VITE_FEW_HOSTS_OPEN !== 'true' || process.env.VITE_CIRCLES_OPEN !== 'true',
  'Needs a site started with VITE_FEW_HOSTS_OPEN=true and VITE_CIRCLES_OPEN=true',
);
test.use({ viewport: { width: 390, height: 844 } });

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const token = [encode({ alg: 'HS256', typ: 'JWT' }), encode({
  sub: 'ana', email: 'ana@example.test', name: 'Ana Host', role: 'user', memberships: [],
  active_account_id: null, exp: Math.floor(Date.now() / 1000) + 3600,
}), 'signature'].join('.');

type Circle = { id: string; name: string; kind: 'circle' | 'series'; created_at: string; tables: Array<Record<string, unknown>> };

const TABLE = {
  id: 't-thursday', slug: 'thursday-abc', title: 'Thursday at Ana’s table', event_date: '2099-03-05T10:00:00.000Z',
  timezone: 'Asia/Makassar', door: 'request', seats: 6, lifecycle_status: 'published',
  guests: { confirmed: 0, requested: 0, waitlist: 0 }, link: 'https://www.teajia.com/event/thursday-abc',
};

async function noSideScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

async function openHostPage(page: Page) {
  const state = { circles: [] as Circle[], made: [] as unknown[], placed: [] as unknown[] };
  await page.addInitScript(jwt => localStorage.setItem('teajia_token', jwt), token);
  await page.route('**/api/**', async route => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    const method = request.method();
    if (pathname === '/api/me/hosting') return route.fulfill({ json: { approved: false, account_id: 'ana-personal', doors: ['request'] } });
    if (pathname === '/api/me/tables' && method === 'GET') return route.fulfill({ json: { tables: [TABLE] } });
    if (pathname === '/api/me/circles' && method === 'GET') return route.fulfill({ json: { circles: state.circles } });
    if (pathname === '/api/me/circles' && method === 'POST') {
      const body = request.postDataJSON() as { name: string; kind: 'circle' | 'series' };
      state.made.push(body);
      const circle = { id: 'c-1', ...body, created_at: '2099-01-01 00:00:00', tables: [] };
      state.circles = [circle, ...state.circles];
      return route.fulfill({ status: 201, json: { circle } });
    }
    const place = pathname.match(/^\/api\/me\/tables\/([^/]+)\/circle$/);
    if (place && method === 'PUT') {
      const body = request.postDataJSON() as { circle_id: string | null };
      state.placed.push({ table: decodeURIComponent(place[1]), ...body });
      state.circles = state.circles.map(circle => ({
        ...circle,
        tables: circle.id === body.circle_id
          ? [{ id: TABLE.id, title: TABLE.title, event_date: TABLE.event_date, timezone: TABLE.timezone, lifecycle_status: 'published' }]
          : circle.tables.filter(table => table.id !== place[1]),
      }));
      return route.fulfill({ json: { ok: true } });
    }
    return route.fulfill({ json: {} });
  });
  await page.goto('/account/host');
  await expect(page.getByRole('heading', { name: 'Circles and series', level: 2 })).toBeVisible();
  return state;
}

test('a host makes a circle, puts a table in it and takes it out', async ({ page }) => {
  const state = await openHostPage(page);
  const section = page.getByTestId('host-circles');

  await section.getByRole('button', { name: 'Make a circle or series' }).click();
  await expect(page).toHaveURL(/[?&]circle=new/);
  // Back closes the form: it is a step in the address.
  await page.goBack();
  await expect(section.getByTestId('host-circle-new')).toHaveCount(0);
  await page.goForward();
  const form = section.getByTestId('host-circle-new');
  await expect(form).toBeVisible();

  const make = form.getByRole('button', { name: 'Make it' });
  await expect(make).toBeDisabled();
  await form.getByRole('textbox', { name: 'Name' }).fill('Thursday tea');
  await expect(form.getByLabel('A circle: one table that meets again')).toBeChecked();
  await noSideScroll(page);
  await make.click();

  expect(state.made).toEqual([{ name: 'Thursday tea', kind: 'circle' }]);
  await expect(page).not.toHaveURL(/circle=/);
  const card = section.getByTestId('host-circle');
  await expect(card.getByRole('heading', { name: 'Thursday tea' })).toBeVisible();
  await expect(card.getByText('No tables in it yet.')).toBeVisible();

  await card.getByLabel('Put a table in').selectOption(TABLE.id);
  await card.getByRole('button', { name: 'Put it in' }).click();
  expect(state.placed).toEqual([{ table: TABLE.id, circle_id: 'c-1' }]);
  await expect(card.getByText(/Thursday at Ana’s table/)).toBeVisible();
  await expect(card.getByLabel('Put a table in')).toHaveCount(0);
  await noSideScroll(page);
  // Nothing here counts anything.
  await expect(section).not.toContainText(/\d+ (times|tables|guests|meetings)/);

  await card.getByRole('button', { name: 'Take out' }).click();
  expect(state.placed).toEqual([{ table: TABLE.id, circle_id: 'c-1' }, { table: TABLE.id, circle_id: null }]);
  await expect(card.getByText('No tables in it yet.')).toBeVisible();
});
