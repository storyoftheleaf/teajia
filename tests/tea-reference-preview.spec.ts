import { expect, test, type Page, type TestInfo } from '@playwright/test';

const ACTIVE_PRODUCT_ID = 'preview-sheng-active';
const SOLD_OUT_PRODUCT_ID = 'preview-sheng-sold-out';
const PRIVATE_MARKERS = /\b(?:held|conflict|private|evidence)\b/i;

const PUBLIC_PRODUCTS = [
  {
    id: ACTIVE_PRODUCT_ID,
    type: 'Sheng',
    given_name: 'Lincang Spring Sheng',
    product_name: 'Greater Yiwu old-tree cake',
    origin_country: 'Lincang, Yunnan, China',
    origin_region: 'Greater Yiwu',
    retail_price_per_gram_usd: 0.6,
    stock_grams: 200,
    description: '',
    tasting_notes: [],
    image_url: '',
    status: 'Active',
    is_personal: false,
    can_reorder: true,
  },
  {
    id: SOLD_OUT_PRODUCT_ID,
    type: 'Sheng',
    given_name: 'Greater Yiwu Archive Sheng',
    product_name: 'Lincang aged cake',
    origin_country: 'Yunnan, China',
    origin_region: 'Lincang',
    retail_price_per_gram_usd: 0.9,
    stock_grams: 0,
    description: '',
    tasting_notes: [],
    image_url: '',
    status: 'Sold Out',
    is_personal: false,
    can_reorder: false,
  },
] as const;

async function expectTeajiaChrome(page: Page) {
  await expect(page.locator('main#main-content')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  await expect(page.locator('nav[aria-label="The wisdom base"]:visible')).toBeVisible();
}

async function expectWisdomNavigation(page: Page, current: 'Types' | 'Origins', alternate: 'Types' | 'Origins') {
  const navigation = page.locator('nav[aria-label="The wisdom base"]:visible');
  const compactButton = navigation.getByRole('button');
  if (await compactButton.isVisible().catch(() => false)) {
    await expect(compactButton).toContainText(current);
    await compactButton.click();
  } else {
    await expect(navigation.getByRole('link', { name: current, exact: true })).toHaveAttribute('aria-current', 'page');
  }
  await expect(navigation.getByRole('link', { name: alternate, exact: true })).toHaveAttribute(
    'href',
    alternate === 'Types' ? '/wisdom/types' : '/wisdom/regions',
  );
  if (await compactButton.isVisible().catch(() => false)) await compactButton.click();
}

async function expectAccessiblePage(page: Page) {
  await expect(page.locator('main h1')).toHaveCount(1);
  const unnamedSections = await page.locator('main section').evaluateAll(sections => sections.filter(section => {
    const labelledBy = section.getAttribute('aria-labelledby');
    return !section.querySelector('h1, h2, h3, h4, h5, h6')
      && !(labelledBy && document.getElementById(labelledBy));
  }).length);
  expect(unnamedSections).toBe(0);
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

async function saveScreen(page: Page, testInfo: TestInfo, name: 'types' | 'origin') {
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: false });
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/products/public', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(PUBLIC_PRODUCTS),
  }));
});

test('renders the public-shaped Tea Reference inside Teajia without writes or private review data', async ({ page }, testInfo) => {
  const APIWrites: string[] = [];
  page.on('request', request => {
    if (/\/api\//.test(request.url()) && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      APIWrites.push(`${request.method()} ${request.url()}`);
    }
  });

  await page.goto('/wisdom/types');
  await expect(page.getByRole('heading', { level: 1, name: 'Tea Types' })).toBeVisible();
  await expectTeajiaChrome(page);
  await expectWisdomNavigation(page, 'Types', 'Origins');
  await expect(page.getByRole('link', { name: 'Pu’er', exact: true })).toHaveAttribute('href', '/wisdom/family/puer');
  await expect(page.getByRole('link', { name: /^Sheng/ })).toHaveAttribute('href', '/wisdom/type/sheng');
  await expectAccessiblePage(page);
  await expectNoHorizontalOverflow(page);
  await saveScreen(page, testInfo, 'types');

  await page.goto('/wisdom/type/sheng');
  await expect(page.getByRole('heading', { level: 1, name: 'Sheng' })).toBeVisible();
  await expectTeajiaChrome(page);
  await expect(page.getByText('Available teas', { exact: true })).toBeVisible();
  await expect(page.getByText('Previously offered', { exact: true })).toBeVisible();
  await expect(page.locator(`a[href="/shop/product/${ACTIVE_PRODUCT_ID}"]`)).toBeVisible();
  await expect(page.locator(`a[href="/shop/product/${SOLD_OUT_PRODUCT_ID}"]`)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Pu’er', exact: true })).toHaveAttribute('href', '/wisdom/family/puer');
  await expect(page.locator('blockquote').first()).toBeVisible();
  await expect(page.locator('a[href="https://marshaln.com/2013/09/really-young-puerh-is-not-really-puerh/"]').first()).toBeVisible();
  await expect(page.getByText('MarshalN', { exact: false }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Report an inaccuracy' })).toHaveAttribute('href', /^mailto:hello@teajia\.com/);
  expect(await page.locator('main').innerText()).not.toMatch(PRIVATE_MARKERS);
  await expectAccessiblePage(page);
  await expectNoHorizontalOverflow(page);

  await page.goto('/wisdom/regions');
  await expect(page.getByRole('heading', { level: 1, name: 'Growing Regions' })).toBeVisible();
  await expectTeajiaChrome(page);
  await expectWisdomNavigation(page, 'Origins', 'Types');
  const originLink = page.locator('a[href^="/wisdom/region/"]', { hasText: 'Lincang' }).first();
  await expect(originLink).toBeVisible();
  const originHref = await originLink.getAttribute('href');
  expect(originHref).toMatch(/^\/wisdom\/region\/[^/]+$/);
  await expectAccessiblePage(page);
  await expectNoHorizontalOverflow(page);

  await page.goto(originHref!);
  await expect(page.getByRole('heading', { level: 1, name: 'Lincang' })).toBeVisible();
  await expectTeajiaChrome(page);
  await expect(page.getByText('Level', { exact: true })).toBeVisible();
  await expect(page.getByText('Major region', { exact: true })).toBeVisible();
  await expect(page.getByText('Available teas', { exact: true })).toBeVisible();
  await expect(page.getByText('Previously offered', { exact: true })).toBeVisible();
  await expect(page.locator(`a[href="/shop/product/${ACTIVE_PRODUCT_ID}"]`)).toBeVisible();
  await expect(page.locator(`a[href="/shop/product/${SOLD_OUT_PRODUCT_ID}"]`)).toBeVisible();
  await expect(page.locator('blockquote').first()).toBeVisible();
  await expect(page.locator('a[href="https://teadb.org/lincang/"]').first()).toBeVisible();
  await expect(page.getByText(/James · 2015-02-07/).first()).toBeVisible();
  expect(await page.locator('main').innerText()).not.toMatch(PRIVATE_MARKERS);
  await expectAccessiblePage(page);
  await expectNoHorizontalOverflow(page);

  const report = page.getByRole('link', { name: 'Report an inaccuracy' });
  await report.scrollIntoViewIfNeeded();
  const reportBox = await report.boundingBox();
  const bottomNavBox = await page.getByRole('navigation', { name: 'Main navigation' }).boundingBox();
  expect(reportBox).not.toBeNull();
  expect(bottomNavBox).not.toBeNull();
  expect(reportBox!.y + reportBox!.height).toBeLessThanOrEqual(bottomNavBox!.y);
  await saveScreen(page, testInfo, 'origin');

  expect(APIWrites).toEqual([]);
});
