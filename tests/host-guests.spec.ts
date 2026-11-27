/**
 * Launch 2, slice H4: the host's page for one table, at phone size, with
 * mocked routes (todo/plans/guests-and-tea-masters-launch-2-run.md, "Sol, H4").
 *
 * The page exists only while Launch 2 is open, so this spec needs a site
 * started with VITE_FEW_HOSTS_OPEN=true (Playwright's own dev server inherits
 * it from the environment) and is skipped otherwise.
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

type Guest = {
  id: string; full_name: string; status: string; plus_one: number; attended: number | null; created_at: string;
  note: string | null; phone: string | null; no_photographs: boolean;
};

function tableState() {
  return {
    table: {
      id: 't-ana', slug: 'ana-next', title: 'Ana’s next table', event_date: new Date(Date.now() + 7 * 86400000).toISOString(),
      timezone: 'Asia/Makassar', door: 'request', seats: 4, seats_taken: 1, lifecycle_status: 'published',
      requires_approval: 1, public_visibility: 'unlisted', link: 'https://teajia.test/event/ana-next',
    },
    guests: [
      { id: 'g-mei', full_name: 'Mei Asks', status: 'requested', plus_one: 0, attended: null, created_at: '2026-11-26',
        note: 'First time at a tea table.', phone: '+62 812 0000 0001', no_photographs: true },
      { id: 'g-tao', full_name: 'Tao Asks', status: 'requested', plus_one: 0, attended: null, created_at: '2026-11-26',
        note: null, phone: null, no_photographs: false },
      { id: 'g-rui', full_name: 'Rui Comes', status: 'confirmed', plus_one: 0, attended: null, created_at: '2026-11-25',
        note: null, phone: null, no_photographs: false },
    ] as Guest[],
    teas: [{ id: 'm1', name: 'Spring green from a friend', product_id: null, brew_order: 1 }],
    doors: ['request', 'link'],
  };
}

async function openTable(page: Page, state: ReturnType<typeof tableState>, calls: string[]) {
  await page.addInitScript(jwt => localStorage.setItem('teajia_token', jwt), token);
  await page.route('**/api/**', async route => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    if (pathname === '/api/me/tables/t-ana' && request.method() === 'GET') return route.fulfill({ json: state });
    const answer = pathname.match(/^\/api\/me\/tables\/t-ana\/guests\/([^/]+)\/(yes|no)$/);
    if (answer && request.method() === 'PUT') {
      calls.push(`${answer[2]} ${answer[1]}`);
      const guest = state.guests.find(row => row.id === answer[1])!;
      guest.status = answer[2] === 'yes' ? 'confirmed' : 'denied';
      if (answer[2] === 'yes') state.table.seats_taken += 1;
      return route.fulfill({ json: { ok: true, status: guest.status } });
    }
    if (pathname === '/api/me/tables/t-ana' && request.method() === 'PUT') {
      const body = request.postDataJSON();
      calls.push(`change ${JSON.stringify(body)}`);
      if (body.seats !== undefined) state.table.seats = body.seats;
      return route.fulfill({ json: { ok: true } });
    }
    if (pathname === '/api/me/hosting') return route.fulfill({ json: { approved: true, account_id: 'ana-personal', doors: ['request', 'link'] } });
    return route.fulfill({ json: {} });
  });
  await page.goto('/account/host/t-ana');
  await expect(page.getByRole('heading', { name: 'Ana’s next table' })).toBeVisible();
}

async function noSideScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test('a waiting guest becomes Coming on Yes, a No moves them, and the photograph words show', async ({ page }) => {
  const calls: string[] = [];
  const state = tableState();
  await openTable(page, state, calls);
  const waiting = page.locator('[data-host-group="waiting"]');
  const coming = page.locator('[data-host-group="coming"]');
  const notComing = page.locator('[data-host-group="not-coming"]');

  await expect(page.locator('[data-host-door]')).toHaveText('I say yes to each guest');
  await expect(page.getByText('1 of 4 seats taken')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy link' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Send in WhatsApp' })).toHaveAttribute('href', /wa\.me\/\?text=.*ana-next/);

  const mei = waiting.locator('[data-host-guest="g-mei"]');
  await expect(mei.getByText('First time at a tea table.')).toBeVisible();
  await expect(mei.getByText('Please, no photographs of me')).toBeVisible();
  await expect(mei.getByRole('link', { name: 'Message in WhatsApp' })).toHaveAttribute('href', 'https://wa.me/6281200000001');
  await expect(waiting.locator('[data-host-guest="g-tao"]').getByRole('link', { name: 'Message in WhatsApp' })).toHaveCount(0);
  await expect(waiting.locator('[data-host-guest="g-tao"]').getByText('Please, no photographs of me')).toHaveCount(0);
  await noSideScroll(page);

  await mei.getByRole('button', { name: 'Yes to Mei Asks' }).click();
  await expect(coming.locator('[data-host-guest="g-mei"]')).toBeVisible();
  await expect(waiting.locator('[data-host-guest="g-mei"]')).toHaveCount(0);
  await expect(page.getByText('2 of 4 seats taken')).toBeVisible();

  await waiting.getByRole('button', { name: 'No to Tao Asks' }).click();
  await expect(notComing.locator('[data-host-guest="g-tao"]')).toBeVisible();
  await expect(waiting.getByText('Nobody is waiting.')).toBeVisible();
  expect(calls).toEqual(['yes g-mei', 'no g-tao']);
  await noSideScroll(page);
});

test('back and forward move between the parts, and seats never go below those taken', async ({ page }) => {
  const calls: string[] = [];
  await openTable(page, tableState(), calls);
  const parts = page.getByRole('group', { name: 'Parts of the table' });

  await parts.getByRole('button', { name: 'Teas' }).click();
  await expect(page).toHaveURL(/part=teas/);
  await expect(page.getByRole('heading', { name: 'Teas', level: 2 })).toBeVisible();
  await parts.getByRole('button', { name: 'The way in' }).click();
  await expect(page.getByRole('heading', { name: 'The way in', level: 2 })).toBeVisible();
  await parts.getByRole('button', { name: 'After' }).click();
  await expect(page.getByText('When the table has ended, mark who came here.')).toBeVisible();
  await noSideScroll(page);

  await page.goBack();
  await expect(page).toHaveURL(/part=way/);
  await page.goBack();
  await expect(page).toHaveURL(/part=teas/);
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Guests', level: 2 })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole('heading', { name: 'Teas', level: 2 })).toBeVisible();

  const seats = page.getByRole('spinbutton', { name: 'Seats' });
  await seats.fill('0');
  await expect(page.getByText('1 seat is already taken, so the table needs at least 1.')).toBeVisible();
  await expect(page.getByRole('form', { name: 'Door and seats' }).getByRole('button', { name: 'Save' })).toBeDisabled();
  await seats.fill('6');
  await page.getByRole('form', { name: 'Door and seats' }).getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('1 of 6 seats taken')).toBeVisible();
  expect(calls).toEqual(['change {"seats":6}']);
  await noSideScroll(page);
});
