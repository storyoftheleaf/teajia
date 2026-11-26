import { expect, test } from './fixtures';

test.skip(process.env.VITE_FEW_HOSTS_OPEN !== 'true' || process.env.VITE_ANYONE_HOSTS_OPEN !== 'true',
  'Needs both hosting flags on in the test site');
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const token = [encode({ alg: 'HS256', typ: 'JWT' }), encode({
  sub: 'ana', email: 'ana@example.test', name: 'Ana Host', role: 'user', memberships: [],
  active_account_id: null, exp: Math.floor(Date.now() / 1000) + 3600,
}), 'signature'].join('.');
const root = '/api/me/tables/ana-table/guest-book';
const photoFiles: Record<string, string> = {
  anonymous: 'setting-cups.jpg',
  named: 'teapot-on-gold-dish.jpg',
};

test('a private host hides and restores guest book notes and photographs', async ({ page }, testInfo) => {
  const note = {
    id: 'note', display_name: 'Mei Guest', note: 'The tea grew sweeter as it cooled.', revision: 2, status: 'included',
  };
  const photos = [
    { id: 'anonymous', display_name: null, alt_text: 'Setting out the cups', status: 'included' },
    { id: 'named', display_name: 'Lin', alt_text: 'Teapot on a gold dish', status: 'included' },
  ];
  const writes: object[] = [];
  const adminCalls: string[] = [];
  await page.addInitScript(jwt => localStorage.setItem('teajia_token', jwt), token);
  await page.route('**/api/**', route => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    if (pathname.startsWith('/api/admin/')) adminCalls.push(pathname);
    if (pathname === '/api/me/tables/ana-table') return route.fulfill({ json: {
      table: {
        id: 'ana-table', slug: 'ana-table', title: 'Tea at Ana’s', event_date: '2026-11-20T10:00:00.000Z',
        timezone: 'Asia/Makassar', door: 'request', seats: 4, seats_taken: 2, lifecycle_status: 'completed',
        requires_approval: 1, public_visibility: 'unlisted', link: 'https://teajia.test/event/ana-table',
      },
      guests: [
        { id: 'mei-seat', full_name: 'Mei Guest', status: 'confirmed', attended: 1 },
        { id: 'lin-seat', full_name: 'Lin Guest', status: 'confirmed', attended: 1 },
      ],
      teas: [], doors: ['request'],
    } });
    if (pathname === '/api/me/tables/ana-table/notes') return route.fulfill({ json: { notes: [] } });
    if (pathname === root) return route.fulfill({ json: { entries: [note] } });
    if (pathname === root + '/photos') return route.fulfill({ json: { photos } });
    if (pathname === root + '/note/review' && request.method() === 'POST') {
      const body = request.postDataJSON();
      writes.push({ item: 'note', ...body });
      note.status = body.action === 'pass' ? 'passed' : 'included';
      return route.fulfill({ json: { success: true } });
    }
    const photo = photos.find(item => pathname === root + '/photos/' + item.id);
    if (photo && request.method() === 'GET') {
      return route.fulfill({ path: `public/read/porcelain-and-tea/${photoFiles[photo.id]}`, contentType: 'image/jpeg' });
    }
    if (photo && request.method() === 'PUT') {
      const body = request.postDataJSON();
      writes.push({ item: photo.id, ...body });
      photo.status = body.action === 'pass' ? 'passed' : 'included';
      return route.fulfill({ json: { success: true } });
    }
    return route.fulfill({ json: {} });
  });

  await page.goto('/account/host/ana-table?part=after');
  const review = page.getByRole('region', { name: 'Guest Book contributions' });
  await expect(review.getByText(note.note)).toBeVisible();
  await expect(review.getByRole('button', { name: 'Open Photo by Lin' })).toBeVisible();
  const anonymousPhoto = review.getByRole('button', { name: 'Open Photo from the table' });
  await anonymousPhoto.click();
  await expect(page).toHaveURL(/guest-book-photo=anonymous/);
  const preview = page.getByRole('dialog', { name: 'Photo from the table' });
  await expect(preview.getByRole('img', { name: photos[0].alt_text })).toBeVisible();
  await expect(preview.getByText(note.display_name)).toHaveCount(0);
  await page.goBack();
  await expect(preview).toHaveCount(0);
  await page.goForward();
  await expect(preview).toBeVisible();
  await page.goBack();

  await review.getByRole('button', { name: 'Hide note from Mei Guest' }).click();
  await expect(review.getByText('Note · Hidden')).toBeVisible();
  await review.getByRole('button', { name: `Hide photo: ${photos[0].alt_text}` }).click();
  await expect(review.getByText('Photo · Hidden')).toBeVisible();
  await review.getByRole('button', { name: 'Bring back note from Mei Guest' }).click();
  await expect(review.getByText('Note · Included')).toBeVisible();
  await review.getByRole('button', { name: `Bring back photo: ${photos[0].alt_text}` }).click();
  await expect(review.getByText('Photo · Included')).toHaveCount(2);
  expect(writes).toEqual([
    { item: 'note', action: 'pass', revision: 2 },
    { item: 'anonymous', action: 'pass', status: 'included' },
    { item: 'note', action: 'include', revision: 2 },
    { item: 'anonymous', action: 'include', status: 'passed' },
  ]);
  expect(adminCalls).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await review.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('host-guest-book-review.png'), scale: 'css' });
});
