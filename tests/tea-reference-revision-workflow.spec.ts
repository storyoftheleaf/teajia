import { readFile } from 'node:fs/promises';
import { expect, test, type Locator, type Page, type Request, type TestInfo } from '@playwright/test';

function fakeJwt(payload: object): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.test`;
}

const OWNER_TOKEN = fakeJwt({
  sub: 'tea-reference-owner',
  email: 'owner@teajia.test',
  name: 'Reference Owner',
  role: 'owner',
  platform_role: 'platform_owner',
  exp: Math.floor(Date.now() / 1000) + 86400 * 30,
  active_account_id: 'acct-teajia',
  memberships: [{ account_id: 'acct-teajia', account_name: 'Teajia', role: 'owner', slug: 'teajia' }],
});

const PUBLIC_PRODUCTS = [
  {
    id: 'lincang-sheng', type: 'Sheng', given_name: 'Lincang Spring', product_name: 'Lincang reference tea',
    origin_country: 'China', origin_region: 'Lincang, Yunnan', retail_price_per_gram_usd: 0.62,
    stock_grams: 180, status: 'Active', is_personal: false, can_reorder: true, year: 2018,
    description: '', tasting_notes: [], image_url: '',
  },
  {
    id: 'yiwu-sheng', type: 'Sheng', given_name: 'Greater Yiwu Spring', product_name: 'Greater Yiwu reference tea',
    origin_country: 'China', origin_region: 'Greater Yiwu, Yunnan', retail_price_per_gram_usd: 0.74,
    stock_grams: 120, status: 'Active', is_personal: false, can_reorder: true, year: 2021,
    description: '', tasting_notes: [], image_url: '',
  },
  {
    id: 'menghai-shou', type: 'Shou', given_name: 'Menghai County Shou', product_name: 'Menghai County reference tea',
    origin_country: 'China', origin_region: 'Menghai County, Yunnan', retail_price_per_gram_usd: 0.48,
    stock_grams: 210, status: 'Active', is_personal: false, can_reorder: true, year: 2016,
    description: '', tasting_notes: [], image_url: '',
  },
];

const ISSUES = [{
  id: 'issue-private-id',
  account_id: 'acct-teajia',
  page_id: 'lincang',
  page_slug: 'lincang',
  route: '/wisdom/region/lincang',
  section_key: 'common-character',
  section_label: 'A broad regional tendency',
  category: 'unclear_writing',
  note: 'Make the distinction between a regional tendency and an individual tea even clearer.',
  public_text_snapshot: 'Young single-origin Lincang sheng is often described as green, firm, and bitter.',
  source_ids: ['teadb-lincang'],
  status: 'open',
  created_by_user_id: 'tea-reference-owner',
  created_at: '2026-08-10T09:00:00.000Z',
  resolved_by_user_id: null,
  resolved_at: null,
}];

const FLAG_NOTE = 'The northern boundary needs another source check.';
const LINCANG_SCOPE_TEXT = 'Lincang lies north of Pu’er Prefecture and against Myanmar to the west. Its tea geography includes Mengku, Yongde, Fengqing, Bangdong, Bingdao, and Xigui, with repeated place names such as Daxueshan making precise labels especially important.';

interface Health {
  blockedMutations: string[];
  consoleErrors: string[];
  pageErrors: string[];
  requestFailures: string[];
  intentionallyAborted: Set<Request>;
}

interface FixtureState {
  createBodies: Record<string, unknown>[];
  exportRequests: number;
  openIssues: typeof ISSUES;
  resolveBodies: Record<string, unknown>[];
}

function watchHealth(page: Page): Health {
  const health: Health = {
    blockedMutations: [], consoleErrors: [], pageErrors: [], requestFailures: [], intentionallyAborted: new Set(),
  };
  page.on('pageerror', error => health.pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') health.consoleErrors.push(message.text()); });
  page.on('requestfailed', request => {
    if (!health.intentionallyAborted.has(request)) {
      health.requestFailures.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText ?? 'failed'}`);
    }
  });
  return health;
}

async function installBoundary(page: Page, health: Health): Promise<FixtureState> {
  const fixture: FixtureState = {
    createBodies: [],
    exportRequests: 0,
    openIssues: structuredClone(ISSUES),
    resolveBodies: [],
  };
  await page.addInitScript(token => localStorage.setItem('teajia_token', token), OWNER_TOKEN);
  await page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'POST' && path === '/api/admin/tea-reference/issues') {
      const body = request.postDataJSON() as Record<string, unknown>;
      fixture.createBodies.push(body);
      const duplicate = fixture.openIssues.some(issue => (
        issue.page_id === body.page_id
        && issue.section_key === body.section_key
        && issue.category === body.category
        && issue.note.trim().toLowerCase() === String(body.note).trim().toLowerCase()
      ));
      const issue = duplicate
        ? fixture.openIssues.find(item => item.note === FLAG_NOTE)!
        : {
            ...ISSUES[0],
            id: 'issue-created-locally',
            section_key: String(body.section_key),
            section_label: 'Northern Pu’er country',
            category: body.category as typeof ISSUES[number]['category'],
            note: String(body.note),
            public_text_snapshot: LINCANG_SCOPE_TEXT,
            created_at: '2026-08-11T09:00:00.000Z',
          };
      if (!duplicate) fixture.openIssues.push(issue);
      await route.fulfill({ status: duplicate ? 200 : 201, json: { issue, duplicate } });
      return;
    }
    if (request.method() === 'POST' && path === '/api/admin/tea-reference/issues/resolve') {
      const body = request.postDataJSON() as { ids?: string[] };
      fixture.resolveBodies.push(body);
      const ids = body.ids ?? [];
      fixture.openIssues = fixture.openIssues.filter(issue => !ids.includes(issue.id));
      await route.fulfill({ json: { resolved_ids: ids, resolved_count: ids.length } });
      return;
    }
    if (request.method() === 'PUT' && path === '/api/user/favorites') {
      await route.fulfill({ json: { favorites: [] } });
      return;
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      health.blockedMutations.push(`${request.method()} ${path}`);
      health.intentionallyAborted.add(request);
      await route.abort('blockedbyclient');
      return;
    }
    if (path === '/api/products/public') {
      await route.fulfill({ json: PUBLIC_PRODUCTS });
      return;
    }
    if (path === '/api/admin/tea-reference/issues') {
      await route.fulfill({ json: { issues: fixture.openIssues } });
      return;
    }
    if (path === '/api/admin/tea-reference/issues/export') {
      fixture.exportRequests += 1;
      await route.fulfill({
        contentType: 'text/markdown; charset=utf-8',
        body: `# Tea Reference regeneration brief\n\n## Lincang\n\n- Owner note: ${FLAG_NOTE}\n- Source pointer: teadb-lincang\n`,
      });
      return;
    }
    if (path === '/api/auth/me') {
      await route.fulfill({ json: { id: 'tea-reference-owner', email: 'owner@teajia.test', name: 'Reference Owner', role: 'owner' } });
      return;
    }
    if (path === '/api/accounts/acct-teajia') {
      await route.fulfill({ json: { id: 'acct-teajia', name: 'Teajia', slug: 'teajia' } });
      return;
    }
    await route.fulfill({ json: [] });
  });
  return fixture;
}

async function assertNoOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

async function attach(page: Page, testInfo: TestInfo, name: string) {
  await testInfo.attach(`${testInfo.project.name} ${name}`, {
    body: await page.screenshot({ fullPage: false }),
    contentType: 'image/png',
  });
}

async function assertAboveMobileNavigation(page: Page, testInfo: TestInfo, target: Locator) {
  if (testInfo.project.name !== 'Mobile Chrome') return;
  const navigation = page.getByTestId('bottom-tab-bar');
  await expect(navigation).toBeVisible();
  const scrollContainer = target.locator('xpath=ancestor::*[contains(concat(" ", normalize-space(@class), " "), " overflow-y-auto ")][1]');
  if (await scrollContainer.count()) {
    await scrollContainer.evaluate(element => { element.scrollTop = element.scrollHeight; });
    await expect.poll(() => scrollContainer.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  } else {
    await target.scrollIntoViewIfNeeded();
  }
  const [navigationBox, targetBox] = await Promise.all([navigation.boundingBox(), target.boundingBox()]);
  expect(navigationBox, 'mobile navigation should have measurable bounds').not.toBeNull();
  expect(targetBox, 'workflow control should have measurable bounds').not.toBeNull();
  expect(targetBox!.y + targetBox!.height).toBeLessThanOrEqual(navigationBox!.y + 1);
}

test('keeps revision lightweight from an English public page to the grouped owner queue', async ({ page }, testInfo) => {
  const health = watchHealth(page);
  const fixture = await installBoundary(page, health);

  await page.goto('/wisdom/region/lincang', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1, name: 'Lincang' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: /Northern Pu’er country/ })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: /A broad regional tendency/ })).toBeVisible();
  await expect(page.getByText(/^Source:/)).toHaveCount(0);
  await expect(page.getByText(/TeaDB/i)).toHaveCount(0);
  await expect(page.getByText(/held|conflict|private evidence/i)).toHaveCount(0);

  await page.getByRole('button', { name: 'Flag Lincang for revision' }).click();
  const dialog = page.getByRole('dialog', { name: 'Flag for revision' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Issue category')).toBeVisible();
  await expect(dialog.getByLabel('Affected section')).toHaveValue('scope');
  await expect(dialog.getByText('Lincang lies north of Pu’er Prefecture', { exact: false })).toBeVisible();
  await dialog.getByLabel('Your note').fill(FLAG_NOTE);
  const submit = dialog.getByRole('button', { name: 'Flag for revision' });
  await assertAboveMobileNavigation(page, testInfo, submit);
  await submit.click();
  await expect(dialog.getByRole('status')).toHaveText('Revision flag added to Reference issues.');
  await assertNoOverflow(page);
  await attach(page, testInfo, 'public flag form');
  await dialog.getByRole('button', { name: 'Cancel' }).click();

  await page.getByRole('button', { name: 'Flag Lincang for revision' }).click();
  const duplicateDialog = page.getByRole('dialog', { name: 'Flag for revision' });
  await duplicateDialog.getByLabel('Your note').fill(FLAG_NOTE);
  await duplicateDialog.getByRole('button', { name: 'Flag for revision' }).click();
  await expect(duplicateDialog.getByRole('status')).toHaveText('This exact revision flag is already open.');
  await duplicateDialog.getByRole('button', { name: 'Cancel' }).click();

  expect(fixture.createBodies).toEqual([
    { page_id: 'lincang', section_key: 'scope', category: 'incorrect_information', note: FLAG_NOTE },
    { page_id: 'lincang', section_key: 'scope', category: 'incorrect_information', note: FLAG_NOTE },
  ]);

  await page.goto('/admin/wisdom', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Reference issues' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Reference issues' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: /Lincang · 2 issues/ })).toBeVisible();
  await expect(page.getByText(ISSUES[0].note)).toBeVisible();
  await expect(page.getByText(FLAG_NOTE)).toBeVisible();
  await expect(page.getByText(ISSUES[0].public_text_snapshot)).toBeVisible();
  await expect(page.getByText('1 cited source')).toHaveCount(2);
  await expect(page.getByText('issue-private-id')).toHaveCount(0);
  await expect(page.getByText('teadb-lincang')).toHaveCount(0);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export regeneration brief' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('tea-reference-regeneration-brief.md');
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const markdown = await readFile(downloadPath!, 'utf8');
  expect(markdown).toContain('# Tea Reference regeneration brief');
  expect(markdown).toContain(FLAG_NOTE);
  expect(fixture.exportRequests).toBe(1);

  const originalIssue = page.locator('article').filter({ hasText: ISSUES[0].note });
  await originalIssue.getByRole('checkbox').check();
  const resolve = page.getByRole('button', { name: 'Resolve 1 selected' });
  await expect(resolve).toBeEnabled();
  await assertAboveMobileNavigation(page, testInfo, resolve);
  await assertNoOverflow(page);
  await attach(page, testInfo, 'grouped issue queue');
  await resolve.click();
  await expect(page.getByText(ISSUES[0].note)).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 2, name: /Lincang · 1 issue/ })).toBeVisible();
  await expect(page.getByText(FLAG_NOTE)).toBeVisible();
  expect(fixture.resolveBodies).toEqual([{ ids: ['issue-private-id'] }]);

  expect(health.blockedMutations).toEqual([]);
  expect(health.consoleErrors).toEqual([]);
  expect(health.pageErrors).toEqual([]);
  expect(health.requestFailures).toEqual([]);
});
