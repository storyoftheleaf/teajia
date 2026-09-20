import { expect, test, type Page } from './fixtures';

const contributorFixture = {
  id: 'publishing-fixture',
  display_name: 'Publishing Fixture',
  role: 'Writer',
  beginnings: 'Synthetic origin text used only to verify the contributor publishing path.',
  now_text: 'Synthetic current-practice text.',
  inspirations: 'Synthetic inspirations text.',
  closing: 'Synthetic closing text.',
  // Typed since migration 0021: a platform and a value, never a label and a url.
  links: [{ platform: 'website', value: 'https://example.com/fixture', qr_image_url: null }],
};
const articleFixture = {
  title: 'Synthetic Publishing Path',
  author_id: 'publishing-fixture',
  pull_quote: 'A synthetic pull quote proves placement without borrowing a real contributor voice.',
  pull_quote_subject: 'publishing-fixture',
};
const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: 'owner', email: 'owner@example.test', role: 'owner', active_account_id: 'acct-bali', memberships: [{ account_id: 'acct-bali', account_name: 'Teajia Bali', role: 'owner', bundles: ['publish'] }], exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;

async function install(page: Page) {
  const requestBodies: any[] = [];
  let contributor: any = null;
  let article: any = null;
  await page.addInitScript(jwt => {
    localStorage.setItem('teajia_token', jwt);
    localStorage.setItem('teajia-storage', JSON.stringify({ version: 2, state: { activeAccountId: 'acct-bali', activeUserId: 'owner', memberships: [{ account_id: 'acct-bali', account_name: 'Teajia Bali', role: 'owner', bundles: ['publish'] }] } }));
  }, token);
  await page.route('**/api/**', async route => {
    const request = route.request(); const path = new URL(request.url()).pathname; const method = request.method();
    const body = request.postData() ? JSON.parse(request.postData()!) : null;
    if (body && (method === 'POST' || method === 'PUT')) requestBodies.push(body);

    if (path === '/api/customers') return route.fulfill({ json: [{ id: 'fixture-contact', name: 'Fixture Contact' }] });
    if (path === '/api/admin/contributors' && method === 'GET') return route.fulfill({ json: { contributors: contributor ? [contributor] : [] } });
    if (path === '/api/admin/contributor-options') return route.fulfill({ json: { contributors: contributor ? [{ id: contributor.id, display_name: contributor.display_name }] : [] } });
    if (path === '/api/admin/contributors' && method === 'POST') {
      contributor = { ...body, id: body.id, account_id: 'acct-bali', is_published: 0, contact_customer_id: null, created_at: '2026-07-12', updated_at: '2026-07-12' };
      return route.fulfill({ status: 201, json: { contributor } });
    }
    if (path === '/api/admin/contributors/publishing-fixture' && method === 'PUT') { contributor = { ...contributor, ...body }; return route.fulfill({ json: { contributor } }); }
    if (path === '/api/admin/contributors/publishing-fixture/contact') { contributor.contact_customer_id = body.customer_id; return route.fulfill({ json: { success: true } }); }
    if (path === '/api/admin/contributors/publishing-fixture/publish') { contributor.is_published = 1; return route.fulfill({ json: { contributor } }); }

    if (path === '/api/admin/articles' && method === 'GET') return route.fulfill({ json: article ? [article] : [] });
    if (path === '/api/admin/articles' && method === 'POST') {
      article = { ...body, id: 'synthetic-article', account_id: 'acct-bali', slug: 'synthetic-publishing-path', status: 'draft', created_at: '2026-07-12', updated_at: '2026-07-12' };
      return route.fulfill({ status: 201, json: article });
    }
    if (path === '/api/admin/articles/synthetic-article' && method === 'PUT') { article = { ...article, ...body }; return route.fulfill({ json: article }); }
    if (path === '/api/admin/articles/synthetic-article/publish') { article.status = 'published'; article.published_at = '2026-07-12'; return route.fulfill({ json: article }); }
    if (path === '/api/articles/synthetic-publishing-path') return route.fulfill({ json: { ...article, author_name: contributorFixture.display_name, blocks: [{ type: 'intro', text: 'Synthetic article body.' }] } });
    if (path === '/api/people/publishing-fixture') return route.fulfill({ json: {
      ...contributor, links: contributorFixture.links, articles: [{ slug: 'synthetic-publishing-path', title: articleFixture.title, published_at: '2026-07-12' }],
      pull_quotes: [{ pull_quote: articleFixture.pull_quote, author_id: contributorFixture.id, published_at: '2026-07-12', article_slug: 'synthetic-publishing-path', article_title: articleFixture.title }],
      featured_in: [], products: [], host_account: null, seasonal_line: null,
    } });
    return route.fulfill({ json: {} });
  });
  return { requestBodies };
}

test('synthetic contributor and article publish through the complete workflow', async ({ page }) => {
  const network = await install(page);
  await page.goto('/admin/contributors');
  await page.getByRole('button', { name: 'Create contributor' }).last().click();
  await page.getByLabel('Slug').fill(contributorFixture.id);
  await page.getByLabel('Display name').fill(contributorFixture.display_name);
  await page.getByLabel('Name in own script').fill('测试作者');
  await page.getByLabel('Role').fill(contributorFixture.role);
  await page.getByLabel('Pronouns').fill('they/them');
  await page.getByLabel('Location').fill('Synthetic location');
  await page.getByLabel('Active since').fill('2026');
  await page.getByLabel('Linked user ID').fill('fixture-user');
  await page.getByLabel('Beginnings').fill(contributorFixture.beginnings);
  await page.getByLabel('Current practice', { exact: true }).fill(contributorFixture.now_text);
  await page.getByLabel('Current stamp').fill('Synthetic season 2026');
  await page.getByLabel('Current practice updated').fill('2026-07-12T12:00');
  await page.getByLabel('Inspirations').fill(contributorFixture.inspirations);
  await page.getByLabel('Closing').fill(contributorFixture.closing);
  await page.getByLabel('Avatar URL').fill('https://example.com/fixture-avatar.jpg');
  await page.getByLabel('Portrait URL').fill('https://example.com/fixture-portrait.jpg');
  await page.getByLabel('Portrait caption').fill('Synthetic portrait caption.');
  await page.getByLabel('Voice clip URL').fill('https://example.com/fixture-voice.mp3');
  await page.getByLabel('Voice clip caption').fill('Synthetic voice caption.');
  await page.getByLabel('Product ID').fill('fixture-product');
  await page.getByLabel('Pouring note').fill('Synthetic pouring note.');
  await page.getByRole('button', { name: 'Add link' }).click();
  await page.getByLabel('Link 1 platform').selectOption(contributorFixture.links[0].platform);
  await page.getByLabel('Link 1 value').fill(contributorFixture.links[0].value);
  // Host status is not set while creating a contributor any more: it moved to
  // a flag on a per-account association, and that section only appears once the
  // contributor exists. Nothing later in this journey depends on the flag, so
  // the step simply goes.
  await page.getByLabel('Private contact').focus();
  await page.getByLabel('Private contact').selectOption('fixture-contact');
  await page.getByLabel('Where to find them').fill('Synthetic account association.');
  await page.getByRole('button', { name: 'Publish contributor' }).click();
  await expect(page.getByText(contributorFixture.display_name)).toBeVisible();

  await page.goto('/admin/magazine');
  await page.reload();
  const contributorsResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/admin/contributor-options' && response.request().method() === 'GET');
  await page.getByRole('button', { name: 'New Article' }).first().click();
  await expect((await contributorsResponse).json()).resolves.toMatchObject({ contributors: [{ id: contributorFixture.id }] });
  await page.getByPlaceholder('Article title').fill(articleFixture.title);
  const mobileMetadata = page.getByText('Article Metadata', { exact: true });
  if (await mobileMetadata.isVisible()) await mobileMetadata.click();
  await page.locator('select[aria-label="Author"]:visible').selectOption(articleFixture.author_id);
  await page.locator('select[aria-label="Pull quote subject"]:visible').selectOption(articleFixture.pull_quote_subject);
  await page.getByLabel('Pull quote', { exact: true }).filter({ visible: true }).fill(articleFixture.pull_quote);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Publish', exact: true }).click();

  await page.goto('/article/synthetic-publishing-path');
  await expect(page.getByRole('link', { name: contributorFixture.display_name }).first()).toHaveAttribute('href', '/people/publishing-fixture');
  await expect(page.getByText('Synthetic article body.')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);

  await page.goto('/people/publishing-fixture');
  // The cover carries the first line of the origin as well, so the passage is on the page twice.
  await expect(page.getByText(contributorFixture.beginnings).first()).toBeVisible();
  await expect(page.getByText(articleFixture.pull_quote)).toBeVisible();
  await expect(page.getByRole('link', { name: /Synthetic Publishing Path/ }).first()).toHaveAttribute('href', '/article/synthetic-publishing-path');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);

  expect(JSON.stringify(network.requestBodies)).not.toMatch(/Barry/i);
  expect(JSON.stringify(network.requestBodies)).not.toMatch(/Rasmussen/i);
  expect(JSON.stringify(network.requestBodies)).not.toMatch(/is_real/i);
  expect(network.requestBodies.every(body => !body.is_real_editorial_content)).toBe(true);
});
