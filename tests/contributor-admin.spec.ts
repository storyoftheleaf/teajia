import { expect, test, type Page } from '@playwright/test';

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
  sub: 'owner-1', email: 'owner@example.test', role: 'owner', active_account_id: 'acct-bali',
  memberships: [{ account_id: 'acct-bali', account_name: 'Teajia Bali', role: 'owner', bundles: ['publish'] }],
  exp: Math.floor(Date.now() / 1000) + 86_400,
})}.signature`;

const fixture = {
  id: 'publishing-fixture', account_id: 'acct-bali', display_name: 'Publishing Fixture', role: 'Writer',
  beginnings: 'Synthetic origin text used only to verify the publishing path.',
  now_text: 'Testing the current-practice field.', inspirations: 'Testing inspirations.',
  closing: 'Synthetic fixture closing.', links: [{ label: 'Fixture', url: 'https://example.com/' }],
  face_of_account_id: null, is_published: 1, created_at: '2026-07-12T00:00:00Z', updated_at: '2026-07-12T00:00:00Z',
};

async function install(page: Page, initialRows: any[] = [fixture]) {
  const requests: string[] = [];
  let rows = initialRows;
  let listFailures = 0;
  await page.addInitScript(jwt => {
    localStorage.setItem('teajia_token', jwt);
    localStorage.setItem('teajia-storage', JSON.stringify({ version: 2, state: { activeAccountId: 'acct-bali', activeUserId: 'owner-1', memberships: [{ account_id: 'acct-bali', account_name: 'Teajia Bali', role: 'owner', bundles: ['publish'] }] } }));
  }, token);
  await page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const body = request.postData() || '';
    requests.push(body);
    if (path === '/api/admin/articles') return route.fulfill({ json: { articles: [] } });
    if (path === '/api/customers') return route.fulfill({ json: [{ id: 'contact-1', name: 'Fixture Contact', account_id: 'acct-bali' }] });
    if (path === '/api/admin/contributors' && request.method() === 'GET') {
      if (listFailures > 0) { listFailures -= 1; return route.fulfill({ status: 500, json: { error: 'fixture failure' } }); }
      return route.fulfill({ json: { contributors: rows } });
    }
    if (path === '/api/admin/contributors' && request.method() === 'POST') {
      const data = JSON.parse(body); rows = [...rows, { ...fixture, ...data, account_id: 'acct-bali', is_published: 0 }];
      return route.fulfill({ status: 201, json: { contributor: rows.at(-1) } });
    }
    const match = path.match(/^\/api\/admin\/contributors\/([^/]+)$/);
    if (match && request.method() === 'GET') return route.fulfill({ json: { contributor: rows.find(row => row.id === match[1]) } });
    if (match && request.method() === 'PUT') {
      const data = JSON.parse(body); rows = rows.map(row => row.id === match[1] ? { ...row, ...data } : row);
      return route.fulfill({ json: { contributor: rows.find(row => row.id === match[1]) } });
    }
    if (/\/contact$/.test(path)) return route.fulfill({ json: { success: true } });
    if (/\/publish$/.test(path)) {
      rows = rows.map(row => path.includes(row.id) ? { ...row, is_published: 1 } : row);
      return route.fulfill({ json: { contributor: rows.find(row => path.includes(row.id)) } });
    }
    if (/\/unpublish$/.test(path)) {
      rows = rows.map(row => path.includes(row.id) ? { ...row, is_published: 0 } : row);
      return route.fulfill({ json: { contributor: rows.find(row => path.includes(row.id)) } });
    }
    return route.fulfill({ json: {} });
  });
  return { requests, failNextList: () => { listFailures += 1; } };
}

for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  test(`contributor administration works at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const network = await install(page);
    await page.goto('/admin/contributors');
    await expect(page).toHaveURL(/\/admin\/contributors$/);
    await expect(page.getByText('Publishing Fixture')).toBeVisible();

    await page.getByRole('button', { name: 'Edit Publishing Fixture' }).click();
    await expect(page.getByRole('dialog', { name: 'Edit contributor' })).toBeVisible();
    await expect(page.getByLabel('Beginnings')).toHaveValue(fixture.beginnings);
    await page.getByLabel('Closing').fill('Updated synthetic closing.');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('dialog', { name: 'Edit contributor' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Edit Publishing Fixture' }).click();
    await page.getByRole('button', { name: 'Unpublish' }).click();
    await expect(page.getByRole('dialog', { name: 'Edit contributor' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Edit Publishing Fixture' }).getByText('Draft')).toBeVisible();

    await page.getByRole('button', { name: 'Create contributor' }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
    await page.getByLabel('Slug').fill('new-fixture');
    await page.getByLabel('Display name').fill('New Fixture');
    await page.getByRole('button', { name: 'Publish contributor' }).click();
    await expect(page.getByText('Beginnings is required before publication.')).toBeVisible();
    await page.getByLabel('Beginnings').fill('Synthetic beginnings for the publishing test.');
    await page.getByRole('button', { name: 'Publish contributor' }).click();
    await expect(page.getByRole('dialog', { name: 'Create contributor' })).toHaveCount(0);
    await expect(page.getByText('New Fixture')).toBeVisible();

    expect(network.requests.every(body => !body.includes('Barry'))).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
  });
}

test('list error can retry into the empty state', async ({ page }) => {
  const network = await install(page);
  network.failNextList();
  await page.goto('/admin/contributors');
  await expect(page.getByText('Could not load contributors.')).toBeVisible();
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByText('Publishing Fixture')).toBeVisible();
});

test('empty state offers contributor creation', async ({ page }) => {
  await install(page, []);
  await page.goto('/admin/contributors');
  await expect(page.getByText('No contributors yet.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create contributor' }).last()).toBeVisible();
});
