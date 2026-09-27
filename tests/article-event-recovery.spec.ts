import { expect, test, type Page } from './fixtures';

function deferred() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}

const article = { id: 'harness-article', title: 'The Rock Remembers', status: 'draft' };

test('a delayed article autosave cannot undo publish or lose the latest edit', async ({ page }) => {
  const firstUpdate = deferred();
  const order: string[] = [];
  const payloads: any[] = [];
  let persisted = { ...article };
  await page.route('**/api/admin/articles/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === 'PUT') {
      const payload = route.request().postDataJSON();
      payloads.push(payload);
      order.push(`update:${payload.title}`);
      if (payloads.length === 1) await firstUpdate.promise;
      persisted = { ...persisted, ...payload };
      return route.fulfill({ json: persisted });
    }
    if (path.endsWith('/publish')) {
      order.push('publish');
      persisted.status = 'published';
      return route.fulfill({ json: persisted });
    }
    return route.fulfill({ json: {} });
  });
  await page.route('**/api/admin/contributor-options', route => route.fulfill({ json: { contributors: [] } }));

  await page.goto('/design/article-editor');
  await page.getByPlaceholder('Article title').fill('Earlier body');
  await expect.poll(() => payloads.length, { timeout: 6000 }).toBe(1);
  await page.getByPlaceholder('Article title').fill('Latest body');
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  expect(order).toEqual(['update:Earlier body']);

  firstUpdate.release();
  await expect.poll(() => persisted.status).toBe('published');
  expect(order).toEqual(['update:Earlier body', 'update:Latest body', 'publish']);
  expect(persisted.title).toBe('Latest body');
  expect(payloads.every(payload => !Object.hasOwn(payload, 'status'))).toBe(true);
});

test('a pending create and a later autosave create one article', async ({ page }) => {
  const createResponse = deferred();
  const calls: string[] = [];
  let createCount = 0;
  let latestTitle = '';
  await page.route('**/api/admin/articles', async route => {
    if (route.request().method() !== 'POST') return route.fulfill({ json: [] });
    createCount += 1;
    const payload = route.request().postDataJSON();
    calls.push(`create:${payload.title}`);
    await createResponse.promise;
    latestTitle = payload.title;
    return route.fulfill({ status: 201, json: { ...payload, id: 'one-article' } });
  });
  await page.route('**/api/admin/articles/one-article', route => {
    const payload = route.request().postDataJSON();
    calls.push(`update:${payload.title}`);
    latestTitle = payload.title;
    return route.fulfill({ json: { ...payload, id: 'one-article' } });
  });
  await page.route('**/api/admin/contributor-options', route => route.fulfill({ json: { contributors: [] } }));

  await page.goto('/design/article-editor?new=1');
  await page.getByPlaceholder('Article title').fill('Initial article');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(() => createCount).toBe(1);
  await page.getByPlaceholder('Article title').fill('Latest article');
  // The debounced save fires while create is unresolved and must queue behind it.
  await page.waitForTimeout(1700);
  expect(createCount).toBe(1);
  createResponse.release();
  await expect.poll(() => latestTitle).toBe('Latest article');
  expect(calls).toEqual(['create:Initial article', 'update:Latest article']);
});

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
  sub: 'editor-1', email: 'editor@test.dev', role: 'owner', platform_role: 'platform_owner',
  active_account_id: 'acct-bali', memberships: [{ account_id: 'acct-bali', account_name: 'Teajia Bali', role: 'owner' }],
  exp: Math.floor(Date.now() / 1000) + 86_400,
})}.sig`;

async function installEventApi(page: Page) {
  let recovered = false;
  let eventGets = 0;
  await page.addInitScript(jwt => {
    localStorage.setItem('teajia_token', jwt);
    localStorage.setItem('teajia-storage', JSON.stringify({ version: 2, state: {
      activeAccountId: 'acct-bali', activeUserId: 'editor-1',
      memberships: [{ account_id: 'acct-bali', account_name: 'Teajia Bali', role: 'owner' }],
    } }));
  }, token);
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/admin/events/event-1') {
      eventGets += 1;
      return recovered
        ? route.fulfill({ json: { id: 'event-1', slug: 'recovered-event', title: 'Recovered Event', event_date: '2026-10-01T10:00:00Z', status: 'active', total_capacity: 12 } })
        : route.fulfill({ status: 500, json: { error: 'Synthetic request failure' } });
    }
    if (path.endsWith('/interest')) return route.fulfill({ json: { signups: [] } });
    if (path.endsWith('/attendees') || path.endsWith('/tasting-notes') || path === '/api/admin/venues' || path === '/api/admin/events') return route.fulfill({ json: [] });
    return route.fulfill({ json: {} });
  });
  return { recover: () => { recovered = true; }, gets: () => eventGets };
}

test('failed event detail offers retry and recovers on the same screen', async ({ page }, testInfo) => {
  const server = await installEventApi(page);
  await page.goto('/admin/events/event-1');
  await expect(page.getByRole('alert').getByText('Event could not be loaded')).toBeVisible({ timeout: 12000 });
  await expect(page.getByRole('button', { name: 'Try again' })).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath('event-failed.png'), animations: 'disabled' });

  server.recover();
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { name: 'Recovered Event' })).toBeVisible();
  expect(server.gets()).toBeGreaterThan(1);
  await page.screenshot({ path: testInfo.outputPath('event-recovered.png'), animations: 'disabled' });
});
