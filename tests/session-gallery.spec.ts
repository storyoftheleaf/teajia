import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

// Launch 3, J7: photographs from the table on the after-sit page, at phone width.
// The gallery is Launch 3's (A3) and shows only while its switch is on, so the
// walk serves the switch open and does not depend on how the site was started.
// The last test leaves the switch as the site has it (off) and proves the page
// shows no gallery and asks for none.
test.use({ viewport: { width: 390, height: 844 } });

const credential = '7'.repeat(64);
const image = 'public/read/porcelain-and-tea/teapot-on-gold-dish.jpg';
const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const token = [encode({ alg: 'HS256', typ: 'JWT' }), encode({
  sub: 'gallery-guest', email: 'gallery-guest@example.test', role: 'user', memberships: [],
  active_account_id: null, exp: Math.floor(Date.now() / 1000) + 3600,
}), 'signature'].join('.');

type Photo = { id: string; alt_text: string; taker_first_name: string | null; own: boolean };
type State = { photos: Photo[]; withdrawn: string[]; offers: Array<Record<string, unknown>>; uploads: number };

const ids = {
  own: '0f0e6c2b-3a1d-4f5e-8a9b-1c2d3e4f5a6b',
  mei: '17478d56-6370-44c1-ac4b-9bcd7068b14a',
  sam: '48c2a3d5-7415-4305-aff2-ded94b97b011',
  ana: '5948d330-2336-4726-8540-0b49c913adb1',
};

async function openLaunch3(page: Page) {
  await page.route(/\/src\/lib\/anyoneHosts\.ts(?:\?|$)/, route => route.fulfill({
    contentType: 'application/javascript',
    body: 'export const ANYONE_HOSTS_OPEN = true; export const anyoneHostsOpen = () => true;',
  }));
}

async function openAfterSit(page: Page, state: State, { launch3 = true } = {}) {
  if (launch3) await openLaunch3(page);
  await page.addInitScript(jwt => localStorage.setItem('teajia_token', jwt), token);
  await page.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/api/after-sit/recap') {
      return route.fulfill({ json: {
        event: { id: 'gallery-sit', title: 'Rain on the courtyard', event_date: '2026-11-24' },
        host_note: null, teas: [{ id: 'tea', name: 'Wuyi rock tea' }],
      } });
    }
    if (url.pathname === '/api/after-sit/setup') return route.fulfill({ json: { saved: true, can_add_photos: true } });
    if (url.pathname.endsWith('/personal-kept-setups/gallery-sit/photos')) {
      if (request.method() === 'POST') {
        state.uploads += 1;
        return route.fulfill({ json: { id: 'uploaded', tea_id: null, created_at: '2026-11-24' } });
      }
      return route.fulfill({ json: { photos: [] } });
    }
    if (url.pathname === '/api/after-sit/gallery') {
      const { action, credential: sent, grantId } = request.postDataJSON();
      expect(sent).toBe(credential);
      expect(url.href).not.toContain(credential);
      expect(request.headers().authorization).toBe(`Bearer ${token}`);
      if (action === 'read') return route.fulfill({ json: { photos: state.photos, can_add: true, waiting: false } });
      if (action === 'bytes' && state.photos.some(photo => photo.id === grantId)) {
        return route.fulfill({ path: image, contentType: 'image/jpeg' });
      }
      return route.fulfill({ status: 404, json: { error: 'Not found' } });
    }
    if (url.pathname === '/api/after-sit/guest-book') {
      const { action, ...body } = request.postDataJSON();
      if (action === 'photo-withdraw') {
        state.withdrawn.push(body.grantId);
        state.photos = state.photos.filter(photo => photo.id !== body.grantId);
        return route.fulfill({ json: { success: true } });
      }
      if (action === 'photo-offer') {
        state.offers.push(body);
        return route.fulfill({ status: 201, json: { success: true } });
      }
      if (action === 'read') return route.fulfill({ json: { entries: [], own: null } });
      if (action === 'photos-read') return route.fulfill({ json: { gallery: [], own: [] } });
    }
    return route.fulfill({ json: [] });
  });
  await page.goto(`/after-sit#${credential}`);
  await expect(page).toHaveURL(/\/after-sit$/);
}

const freshState = (): State => ({
  withdrawn: [], offers: [], uploads: 0,
  photos: [
    { id: ids.own, alt_text: 'Photo of the tea setup', taker_first_name: null, own: true },
    { id: ids.mei, alt_text: 'Photo of Wuyi rock tea', taker_first_name: 'Mei', own: false },
    { id: ids.sam, alt_text: 'Photo of the tea setup', taker_first_name: null, own: false },
    { id: ids.ana, alt_text: 'Photo of the kettle', taker_first_name: 'Ana', own: false },
  ],
});

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test("the table's photographs show together; a withdrawn one leaves at once; the large view names the taker only when allowed", async ({ page }) => {
  const state = freshState();
  await openAfterSit(page, state);
  const gallery = page.getByRole('region', { name: 'Photographs from the table' });
  const tiles = gallery.getByRole('list', { name: 'Photographs' }).getByRole('button', { name: /^Open photograph/ });
  await expect(tiles).toHaveCount(4);
  await expect(gallery.getByRole('img')).toHaveCount(4);
  await expect(gallery).not.toContainText(/like|comment|views/i);
  await noHorizontalOverflow(page);

  // The guest withdraws their own photograph from its large view.
  await tiles.nth(0).click();
  await expect(page).toHaveURL(new RegExp(`photo=${ids.own}`));
  const dialog = page.getByRole('dialog', { name: 'Photograph from the table' });
  await expect(dialog).toBeVisible();
  await expect(dialog).not.toContainText('photograph by');
  await dialog.getByRole('button', { name: 'Withdraw my photograph' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(tiles).toHaveCount(3);
  expect(state.withdrawn).toEqual([ids.own]);
  await expect(gallery.getByRole('img', { name: 'Photo of Wuyi rock tea' })).toBeVisible();
  await expect(gallery.getByRole('img', { name: 'Photo of the kettle' })).toBeVisible();
  await expect(gallery.getByRole('img')).toHaveCount(3);

  // Mei allowed her name; Sam did not.
  await tiles.nth(0).click();
  await expect(page).toHaveURL(new RegExp(`photo=${ids.mei}`));
  await expect(dialog.getByRole('img', { name: 'Photo of Wuyi rock tea' })).toBeVisible();
  await expect(dialog).toContainText('photograph by Mei');
  await expect(dialog.getByRole('button', { name: 'Withdraw my photograph' })).toHaveCount(0);
  await noHorizontalOverflow(page);
  // The open photograph is a step: browser back closes it.
  await page.goBack();
  await expect(dialog).toHaveCount(0);
  await expect(page).not.toHaveURL(/photo=/);

  await tiles.nth(1).click();
  await expect(page).toHaveURL(new RegExp(`photo=${ids.sam}`));
  await expect(dialog.getByRole('img')).toBeVisible();
  await expect(dialog).not.toContainText('photograph by');
  await dialog.getByRole('button', { name: /close/i }).first().click();
  await expect(dialog).toHaveCount(0);
  await noHorizontalOverflow(page);
});

test('adding a photograph is one tap to the device picker, then the shared editor, then offered to the host', async ({ page }) => {
  const state = freshState();
  await openAfterSit(page, state);
  const gallery = page.getByRole('region', { name: 'Photographs from the table' });
  const showName = gallery.getByRole('checkbox', { name: 'Show my first name with it' });
  await expect(showName).not.toBeChecked();
  await showName.check();
  const chooser = page.waitForEvent('filechooser');
  await gallery.getByRole('button', { name: 'Add a photograph' }).click();
  await (await chooser).setFiles(image);
  const editor = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Use photo' }) });
  await editor.getByRole('button', { name: 'Use photo' }).click();
  await expect.poll(() => state.offers.length).toBe(1);
  expect(state.uploads).toBe(1);
  expect(state.offers[0]).toMatchObject({ photoId: expect.any(String), grantId: expect.any(String), showName: true });
  await noHorizontalOverflow(page);
});

test('with Launch 3 closed, the after-sit page shows no gallery and asks for none', async ({ page }) => {
  test.skip(process.env.VITE_ANYONE_HOSTS_OPEN === 'true', 'Launch 3 is open on this site');
  const asked: string[] = [];
  page.on('request', request => { if (/\/api\/after-sit\/gallery/.test(request.url())) asked.push(request.url()); });
  await openAfterSit(page, freshState(), { launch3: false });
  await expect(page.getByText('Rain on the courtyard').first()).toBeVisible();
  await expect(page.getByRole('region', { name: 'Photographs from the table' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add a photograph' })).toHaveCount(0);
  expect(asked).toEqual([]);
});
