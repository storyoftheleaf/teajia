import { expect, test } from './fixtures';

const credential = '6'.repeat(64);
const photoId = '9dc818e0-c31e-44c5-94ec-c8014694fc1d';
const image = 'public/read/porcelain-and-tea/teapot-on-gold-dish.jpg';
const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const token = [encode({ alg: 'HS256', typ: 'JWT' }), encode({
  sub: 'photo-guest', email: 'photo-guest@example.test', role: 'user', memberships: [],
  active_account_id: null, exp: Math.floor(Date.now() / 1000) + 3600,
}), 'signature'].join('.');

test('a Guest Book photo requires explicit confirmation and can be withdrawn from the same after-sit page', async ({ page }) => {
  const actions: string[] = [];
  const state: { grant: { id: string; status: 'pending' | 'included' } | null } = { grant: null };
  await page.addInitScript(jwt => localStorage.setItem('teajia_token', jwt), token);
  await page.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/api/after-sit/recap') {
      return route.fulfill({ json: {
        event: { id: 'formal-sit', title: 'Porcelain and tea', event_date: '2026-11-23' },
        host_note: null,
        teas: [{ id: 'exact-tea', name: 'Wuyi rock tea' }],
      } });
    }
    if (url.pathname === '/api/after-sit/setup') return route.fulfill({ json: { saved: true, can_add_photos: true } });
    if (url.pathname.endsWith('/personal-kept-setups/formal-sit/photos')) {
      return route.fulfill({ json: { photos: [{ id: photoId, tea_id: 'exact-tea', created_at: '2026-11-23' }] } });
    }
    if (url.pathname === '/api/after-sit/guest-book') {
      const { action, photoId: sentPhotoId, grantId, description, credential: sentCredential } = request.postDataJSON();
      expect(url.href).not.toContain(credential);
      expect(request.method()).toBe('POST');
      expect(sentCredential).toBe(credential);
      expect(request.headers().authorization).toBe(`Bearer ${token}`);
      if (action === 'read') return route.fulfill({ json: { entries: [], own: null } });
      if (action === 'photos-read') return route.fulfill({ json: {
        gallery: state.grant?.status === 'included' ? [{ id: state.grant.id, display_name: 'Tea Guest', alt_text: 'Photo of Wuyi rock tea' }] : [],
        own: [{ id: photoId, tea_name: 'Wuyi rock tea', created_at: '2026-11-23', grant_id: state.grant?.id ?? null,
          status: state.grant?.status ?? null, alt_text: 'Photo of Wuyi rock tea' }],
      } });
      if (action === 'private-photo-preview' || action === 'photo-bytes') {
        return route.fulfill({ path: image, contentType: 'image/jpeg' });
      }
      if (action === 'photo-offer') {
        expect(sentPhotoId).toBe(photoId);
        expect(description).toBe('');
        state.grant = { id: grantId, status: 'pending' };
        actions.push(action);
        return route.fulfill({ status: 201, json: { success: true } });
      }
      if (action === 'photo-withdraw') {
        expect(grantId).toBe(state.grant?.id);
        state.grant = null;
        actions.push(action);
        return route.fulfill({ json: { success: true } });
      }
    }
    return route.fulfill({ json: [] });
  });

  await page.goto(`/after-sit#${credential}`);
  await expect(page).toHaveURL(/\/after-sit$/);
  const gallery = page.getByRole('region', { name: 'Photos for session guests' });
  await gallery.getByLabel('Choose a private photo').selectOption(photoId);
  const submit = gallery.getByRole('button', { name: 'Send photo for review' });
  await expect(gallery.getByRole('button', { name: 'Open Your selected private photo' })).toBeVisible();
  await expect(submit).toBeDisabled();
  await gallery.getByRole('checkbox').check();
  await submit.click();
  await expect(gallery.getByText('Pending host review')).toBeVisible();
  await expect(gallery.getByText('No photos have been included yet.')).toBeVisible();

  if (!state.grant) throw new Error('Expected a contribution after sending.');
  state.grant.status = 'included';
  await page.reload();
  await expect(page.getByText('Open the personal link from your host.', { exact: false })).toBeVisible();
  await page.goto(`/after-sit#${credential}`);
  await expect(gallery.getByRole('button', { name: 'Open Photo by Tea Guest' })).toBeVisible();
  if (process.env.GUEST_BOOK_SCREENSHOT) {
    await gallery.evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await gallery.screenshot({ path: process.env.GUEST_BOOK_SCREENSHOT });
  }
  await gallery.getByRole('button', { name: 'Withdraw photo' }).click();
  await expect(gallery.getByText('Photo withdrawn.')).toBeVisible();
  await expect(gallery.getByRole('button', { name: 'Open Photo by Tea Guest' })).toHaveCount(0);
  expect(actions).toEqual(['photo-offer', 'photo-withdraw']);
});
