import { expect, test, type Page } from './fixtures';

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const adminToken = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
  sub: 'host-1', email: 'host@test.invalid', role: 'owner', platform_role: 'platform_owner',
  active_account_id: 'shop-1',
  memberships: [{ account_id: 'shop-1', account_name: 'Fixture shop', role: 'owner', bundles: ['gather', 'publish'] }],
  exp: Math.floor(Date.now() / 1000) + 3600,
})}.fixture`;

const adminEvent = {
  id: 'event-1', slug: 'first-table-test', title: 'First table, a test sit',
  event_date: '2026-12-01T10:00:00.000Z', event_end_date: '2026-12-01T12:00:00.000Z',
  status: 'active', lifecycle_status: 'published', total_capacity: 8,
  claim_window_minutes: 30, timezone: 'Asia/Makassar', reading_article_id: null as string | null,
  created_at: '2026-11-01T00:00:00.000Z', updated_at: '2026-11-01T00:00:00.000Z',
};

async function installAdminApi(page: Page) {
  const writes: Record<string, unknown>[] = [];
  await page.addInitScript(token => {
    localStorage.setItem('teajia_token', token);
    localStorage.setItem('teajia-storage', JSON.stringify({ version: 2, state: {
      activeAccountId: 'shop-1', activeUserId: 'host-1',
      memberships: [{ account_id: 'shop-1', account_name: 'Fixture shop', role: 'owner', bundles: ['gather', 'publish'] }],
    } }));
  }, adminToken);
  await page.route('**/api/**', route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/admin/events/event-1' && request.method() === 'PUT') {
      const body = request.postDataJSON() as Record<string, unknown>;
      writes.push(body);
      adminEvent.reading_article_id = body.reading_article_id as string | null;
      return route.fulfill({ json: { ...adminEvent } });
    }
    if (path === '/api/admin/events/event-1') return route.fulfill({ json: { ...adminEvent } });
    if (path === '/api/admin/articles') return route.fulfill({ json: [
      { id: 'published-1', slug: 'before-a-white-tea', title: 'Before a white tea', status: 'published' },
      { id: 'draft-1', slug: 'private-notes', title: 'Private notes', status: 'draft' },
      { id: 'published-2', slug: 'water-and-waiting', title: 'Water and waiting', status: 'published' },
    ] });
    if (path === '/api/admin/events') return route.fulfill({ json: [{ ...adminEvent }] });
    if (path.endsWith('/interest')) return route.fulfill({ json: { signups: [] } });
    if (/\/(attendees|tasting-notes|venues|products|rates|customers)$/.test(path)) return route.fulfill({ json: [] });
    if (path === '/api/compass/incoming') return route.fulfill({ json: { shares: [] } });
    return route.fulfill({ json: [] });
  });
  return writes;
}

test('the session editor offers published readings, saves one, reloads it, and clears it', async ({ page }, testInfo) => {
  adminEvent.reading_article_id = null;
  const writes = await installAdminApi(page);
  await page.goto('/admin/events/event-1');
  await page.getByRole('button', { name: 'Edit', exact: true }).click();

  const reading = page.getByLabel('A reading for guests');
  await expect(reading.locator('option')).toHaveText(['None', 'Before a white tea', 'Water and waiting']);
  await page.screenshot({ path: testInfo.outputPath('event-reading-editor.png'), animations: 'disabled', scale: 'css' });
  await reading.selectOption('published-1');
  await page.getByRole('button', { name: 'Update Event' }).click();
  await expect.poll(() => writes.at(-1)?.reading_article_id).toBe('published-1');

  await page.reload();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.getByLabel('A reading for guests')).toHaveValue('published-1');
  await page.getByLabel('A reading for guests').selectOption('');
  await page.getByRole('button', { name: 'Update Event' }).click();
  await expect.poll(() => writes.at(-1)?.reading_article_id).toBeNull();
});

async function installPublicEvent(page: Page, reading: { slug: string; title: string } | null) {
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/events/first-table-test/public') return route.fulfill({ json: {
      id: 'event-1', slug: 'first-table-test', title: 'First table, a test sit',
      event_date: '2026-12-01T10:00:00.000Z', status: 'active', total_capacity: 8,
      seats_remaining: 6, reading,
    } });
    if (path === '/api/events/first-table-test/availability') return route.fulfill({ json: {
      totalCapacity: 8, confirmedCount: 2, seatsRemaining: 6, isFull: false,
    } });
    if (path === '/api/events/first-table-test/tea-menu') return route.fulfill({ json: [] });
    return route.fulfill({ json: {} });
  });
}

test('the public session links its reading when one is set', async ({ page }, testInfo) => {
  await installPublicEvent(page, { slug: 'before-a-white-tea', title: 'Before a white tea' });
  await page.goto('/event/first-table-test');
  const reading = page.getByRole('link', { name: 'To read before you come Before a white tea' });
  await expect(reading).toHaveAttribute('href', '/article/before-a-white-tea');
  await page.screenshot({ path: testInfo.outputPath('event-reading-public.png'), animations: 'disabled', scale: 'css' });
});

test('the public session has no reading line when none is set', async ({ page }) => {
  await installPublicEvent(page, null);
  await page.goto('/event/first-table-test');
  await expect(page.getByText('To read before you come')).toHaveCount(0);
});
