/**
 * Launch 4, slice K4, "Add your table", at phone size, with mocked routes
 * (todo/plans/guests-and-tea-masters-launch-4-run.md, hard question 4).
 *
 * On their own page, a host names one saved place as their table and writes
 * the area people see, then undoes it. Opening the chooser is a step in the
 * address, so back closes it. The page asks the host for the area only.
 *
 * Both switches are on (2026-11-27); skipped only on a site started with
 * either one set to false.
 */
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

test.skip(
  process.env.VITE_FEW_HOSTS_OPEN === 'false' || process.env.VITE_YOUR_TABLE_PLACE_OPEN === 'false',
  'Skipped on a site started with VITE_FEW_HOSTS_OPEN=false or VITE_YOUR_TABLE_PLACE_OPEN=false',
);
test.use({ viewport: { width: 390, height: 844 } });

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const token = [encode({ alg: 'HS256', typ: 'JWT' }), encode({
  sub: 'ana', email: 'ana@example.test', name: 'Ana Host', role: 'user', memberships: [],
  active_account_id: null, exp: Math.floor(Date.now() / 1000) + 3600,
}), 'signature'].join('.');

type Place = { id: string; name: string; area_hint: string | null; is_table: boolean; shown?: boolean };

async function noSideScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

async function openHostPage(page: Page, places: Place[]) {
  const state = { places, puts: [] as unknown[], adds: [] as unknown[], shows: [] as unknown[], deletes: 0 };
  await page.addInitScript(jwt => localStorage.setItem('teajia_token', jwt), token);
  await page.route('**/api/**', async route => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    const method = request.method();
    if (pathname === '/api/me/hosting') return route.fulfill({ json: { approved: true, account_id: 'ana-personal', doors: ['request', 'link'] } });
    if (pathname === '/api/me/your-table' && method === 'GET') return route.fulfill({ json: { places: state.places } });
    if (pathname === '/api/me/your-table' && method === 'PUT') {
      const body = request.postDataJSON() as { place_id: string; area_hint: string };
      state.puts.push(body);
      // Several tea spaces are allowed: the others stay as they are.
      state.places = state.places.map(place => place.id === body.place_id
        ? { ...place, is_table: true, area_hint: body.area_hint }
        : place);
      return route.fulfill({ json: { places: state.places } });
    }
    const shown = pathname.match(/^\/api\/me\/your-table\/([^/]+)\/shown$/);
    if (shown && method === 'PUT') {
      const body = request.postDataJSON() as { shown: boolean };
      state.shows.push({ id: decodeURIComponent(shown[1]), ...body });
      state.places = state.places.map(place => place.id === decodeURIComponent(shown[1]) ? { ...place, shown: body.shown } : place);
      return route.fulfill({ json: { places: state.places } });
    }
    if (pathname === '/api/me/your-table' && method === 'POST') {
      const body = request.postDataJSON() as { name: string; area_hint: string };
      state.adds.push(body);
      state.places = [...state.places, { id: `p-new-${state.adds.length}`, name: body.name, area_hint: body.area_hint, is_table: true }];
      return route.fulfill({ json: { places: state.places } });
    }
    if (pathname === '/api/me/your-table' && method === 'DELETE') {
      state.deletes += 1;
      const placeId = new URL(request.url()).searchParams.get('place_id');
      state.places = state.places.map(place => (!placeId || place.id === placeId) ? { ...place, is_table: false } : place);
      return route.fulfill({ json: { places: state.places } });
    }
    return route.fulfill({ json: {} });
  });
  await page.goto('/account/host');
  await expect(page.getByRole('heading', { name: 'Your tea space', level: 2 })).toBeVisible();
  return state;
}

test('a host chooses a saved place as their table, writes its area, and undoes it', async ({ page }) => {
  const state = await openHostPage(page, [
    { id: 'p-home', name: 'Home', area_hint: null, is_table: false },
    { id: 'p-studio', name: 'Studio', area_hint: null, is_table: false },
  ]);
  const section = page.getByTestId('your-table');
  await expect(section.getByText('It stays private: people see only the area you write.')).toBeVisible();

  await section.getByRole('button', { name: 'Add your tea space' }).click();
  await expect(page).toHaveURL(/[?&]your-table=choose/);
  // Back closes the chooser: it is a step in the address.
  await page.goBack();
  await expect(section.getByTestId('your-table-choose')).toHaveCount(0);
  await page.goForward();
  const chooser = section.getByTestId('your-table-choose');
  await expect(chooser).toBeVisible();

  await chooser.getByLabel('Studio').check();
  const save = chooser.getByRole('button', { name: 'Make this my tea space' });
  await expect(save).toBeDisabled();
  await chooser.getByLabel('The area people see').fill('Ubud, near the market');
  await noSideScroll(page);
  await save.click();

  expect(state.puts).toEqual([{ place_id: 'p-studio', area_hint: 'Ubud, near the market' }]);
  const chosen = section.getByTestId('your-table-chosen');
  await expect(chosen.getByText('Studio is your tea space.')).toBeVisible();
  await expect(chosen.getByText(/see only “Ubud, near the market”/)).toBeVisible();
  await expect(page).not.toHaveURL(/your-table=/);
  await noSideScroll(page);

  await chosen.getByRole('button', { name: 'Undo' }).click();
  expect(state.deletes).toBe(1);
  await expect(section.getByRole('button', { name: 'Add your tea space' })).toBeVisible();
  await expect(section.getByTestId('your-table-chosen')).toHaveCount(0);
});

test('a host with no saved place adds a tea space by its name and area', async ({ page }) => {
  const state = await openHostPage(page, []);
  const section = page.getByTestId('your-table');
  await expect(section.getByText('Add your tea space by its name and the area it is in.', { exact: false })).toBeVisible();
  await expect(section.getByRole('button', { name: 'Add your tea space' })).toHaveCount(0);

  await section.getByTestId('tea-space-add').click();
  await expect(page).toHaveURL(/[?&]your-table=add/);
  const form = section.getByTestId('tea-space-add-form');
  const save = form.getByRole('button', { name: 'Add this tea space' });
  await expect(save).toBeDisabled();
  await form.getByLabel('Its name').fill('The garden room');
  await form.getByLabel('The area people see').fill('Ubud, near the market');
  await noSideScroll(page);
  await save.click();

  expect(state.adds).toEqual([{ name: 'The garden room', area_hint: 'Ubud, near the market' }]);
  await expect(section.getByTestId('your-table-chosen').getByText('The garden room is your tea space.')).toBeVisible();
  await expect(page).not.toHaveURL(/your-table=/);

  // Off the tea spaces page until the host turns it on.
  const shownBox = section.getByTestId('tea-space').getByTestId('tea-space-shown');
  await expect(shownBox).not.toBeChecked();
  await shownBox.click();
  await expect(shownBox).toBeChecked();
  expect(state.shows).toEqual([{ id: 'p-new-1', shown: true }]);

  // A second space sits beside the first.
  await section.getByTestId('tea-space-add').click();
  await form.getByLabel('Its name').fill('The tea room');
  await form.getByLabel('The area people see').fill('Ubud, near the market');
  await form.getByRole('button', { name: 'Add this tea space' }).click();
  await expect(section.getByTestId('tea-space')).toHaveCount(2);

  // Undo takes off only that one.
  await section.getByTestId('tea-space').filter({ hasText: 'The tea room' }).getByRole('button', { name: 'Undo' }).click();
  await expect(section.getByTestId('tea-space')).toHaveCount(1);
  await expect(section.getByText('The garden room is your tea space.')).toBeVisible();
});
