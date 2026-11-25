import { expect, test } from './fixtures';

const api = process.env.TEAJIA_BESPOKE_FIXTURE_API;
const site = process.env.PLAYWRIGHT_BASE_URL;
test.skip(!api || !site, 'Uses the isolated offline Worker and Vite fixture.');

test('the story editor refuses stale B after another editor autosaves C, then publishes reviewed C after reload', async ({ browser, request }) => {
  test.setTimeout(75_000);
  for (const origin of [api!, site!]) expect(new URL(origin).hostname).toBe('127.0.0.1');
  const login = await request.post(api + '/api/auth/login', { data: { identifier: 'sandbox', password: 'sandbox' } });
  expect(login.status()).toBe(200);
  const { token } = await login.json();
  const headers = { Authorization: 'Bearer ' + token };
  const story = '/api/story-content/porcelain-and-tea';
  const publicAddress = '/read/porcelain-and-tea';
  const run = crypto.randomUUID().slice(0, 4);
  const title = (edition: string) => 'Synthetic ' + run + ' edition ' + edition;
  const fixtureA = await request.put(api + story + '/draft', { headers, data: { content: { text: { 'title-1': title('A') } } } });
  expect(fixtureA.status()).toBe(200);
  expect((await request.post(api + story + '/publish', { headers, data: { review_digest: (await fixtureA.json()).review_digest } })).status()).toBe(200);
  const publicA = await (await request.get(api + story)).text();
  const versions = await (await request.get(api + story + '/versions', { headers })).text();

  const [first, second, guest] = await Promise.all(Array.from({ length: 3 }, () =>
    browser.newContext({ viewport: { width: 1280, height: 850 } })));
  try {
    for (const ctx of [first, second, guest]) {
      const allowed = new Set([new URL(site!).origin, new URL(api!).origin]);
      await ctx.route('**/*', route => allowed.has(new URL(route.request().url()).origin) ? route.continue() : route.abort());
    }
    for (const ctx of [first, second]) {
      await ctx.addInitScript(jwt => localStorage.setItem('teajia_token', jwt), token);
    }
    const [editorB, editorC, reader] = await Promise.all([first.newPage(), second.newPage(), guest.newPage()]);
    const editPage = site + '/tests/bespoke-story-review.harness.html';
    await Promise.all([editorB.goto(editPage), editorC.goto(editPage), reader.goto(site + publicAddress)]);
    await expect(reader.getByText(title('A'), { exact: true }).filter({ visible: true }).first()).toBeVisible();

    async function stage(page: typeof editorB, edition: string) {
      await page.getByTitle('Owner editing').click();
      const draft = page.locator('h1[contenteditable="true"]');
      await expect(draft).toHaveText(title('A'));
      const stored = page.waitForResponse(res => res.request().method() === 'PUT' && new URL(res.url()).pathname === story + '/draft');
      await draft.fill(title(edition));
      await draft.press('Enter');
      expect((await stored).status()).toBe(200);
      await expect(page.getByRole('button', { name: 'publish', exact: true })).toBeEnabled();
    }

    await stage(editorB, 'B');
    await stage(editorC, 'C');
    await expect(editorB.locator('h1')).toHaveText(title('B'));
    let extraSaves = 0;
    editorB.on('request', req => {
      if (req.method() === 'PUT' && new URL(req.url()).pathname === story + '/draft') extraSaves++;
    });
    const firstPublish = editorB.waitForResponse(res => res.request().method() === 'POST' && new URL(res.url()).pathname === story + '/publish');
    await editorB.getByRole('button', { name: 'publish', exact: true }).click();
    expect((await firstPublish).status()).toBe(409);
    await expect(editorB.getByText('The draft changed. Reload to review it before publishing.')).toBeVisible();
    expect(extraSaves).toBe(0);
    expect(await (await request.get(api + story)).text()).toBe(publicA);
    expect(await (await request.get(api + story + '/versions', { headers })).text()).toBe(versions);
    await reader.reload();
    await expect(reader.getByText(title('A'), { exact: true }).filter({ visible: true }).first()).toBeVisible();

    await editorB.reload();
    await editorB.getByTitle('Owner editing').click();
    await expect(editorB.locator('h1')).toHaveText(title('C'));
    await expect(editorB.getByRole('button', { name: 'publish', exact: true })).toBeEnabled();
    const reviewedPublish = editorB.waitForResponse(res => res.request().method() === 'POST' && new URL(res.url()).pathname === story + '/publish');
    await editorB.getByRole('button', { name: 'publish', exact: true }).click();
    expect((await reviewedPublish).status()).toBe(200);
    expect(extraSaves).toBe(0);
    await reader.reload();
    await expect(reader.getByText(title('C'), { exact: true }).filter({ visible: true }).first()).toBeVisible();
    expect(new URL(reader.url()).pathname).toBe(publicAddress);
  } finally {
    await Promise.all([first.close(), second.close(), guest.close()]);
  }
});
