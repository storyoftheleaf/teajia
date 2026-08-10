import {
  expect,
  test,
  type APIRequestContext,
  type Page,
  type Request,
  type TestInfo,
} from '@playwright/test';
import type {
  PublicReferenceEntry,
  PublicReferenceStatement,
  PublicReferencePreview,
  WebsiteReceivingPublicTransport,
} from '../src/wisdom/receiving/previewImporter';

const PRIVATE_MARKERS = /\b(?:held|conflict|private|evidence)\b/i;
const SAFE_API_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const PLACE_LEVELS = new Set(['major_region', 'tea_area', 'mountain', 'village', 'locality']);

type PublicSource = PublicReferencePreview['sources'][number];

interface FixtureContract {
  family: PublicReferenceEntry;
  style: PublicReferenceEntry;
  styleFact: PublicReferenceStatement;
  styleSource: PublicSource;
  typeName: 'Sheng' | 'Shou';
  typeId: 'sheng' | 'shou';
  place: PublicReferenceEntry;
  placeFact: PublicReferenceStatement;
  placeSource: PublicSource;
}

interface PageHealth {
  blockedMutations: string[];
  consoleErrors: string[];
  pageErrors: string[];
  requestFailures: string[];
  intentionallyAborted: Set<Request>;
}

function fixtureError(message: string): never {
  throw new Error(`Tea Reference browser fixture contract: ${message}`);
}

function normalizedWords(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function canonicalUrl(value: string): string | null {
  try {
    const url = new URL(value);
    url.hash = '';
    url.searchParams.sort();
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
    return url.href;
  } catch {
    return null;
  }
}

function sourceForFact(fact: PublicReferenceStatement, sources: readonly PublicSource[]): PublicSource | undefined {
  const citationUrl = canonicalUrl(fact.citation.url);
  return citationUrl ? sources.find(source => canonicalUrl(source.url) === citationUrl) : undefined;
}

function citedEntry(
  entries: readonly PublicReferenceEntry[],
  sources: readonly PublicSource[],
  predicate: (entry: PublicReferenceEntry) => boolean,
): { entry: PublicReferenceEntry; fact: PublicReferenceStatement; source: PublicSource } | undefined {
  for (const entry of entries.filter(predicate)) {
    for (const fact of entry.statements) {
      if (!fact.citation?.url) continue;
      const source = sourceForFact(fact, sources);
      if (source) return { entry, fact, source };
    }
  }
  return undefined;
}

function deriveFixtureContract(transport: unknown): FixtureContract {
  if (!transport || typeof transport !== 'object') fixtureError('the public transport must be an object.');
  const candidate = transport as Partial<WebsiteReceivingPublicTransport>;
  if (candidate.manifest?.schemaVersion !== 1 || candidate.manifest.mode !== 'preview-only') {
    fixtureError('the transport manifest must declare schemaVersion 1 and preview-only mode.');
  }
  const preview = candidate.publicPreview;
  if (!preview || !Array.isArray(preview.sections) || !Array.isArray(preview.sources)) {
    fixtureError('publicPreview must contain sections and sources arrays.');
  }
  const entries = preview.sections.flatMap(section => Array.isArray(section.entries) ? section.entries : []);
  const family = entries.find(entry => entry.entityKind === 'tea_family'
    && normalizedWords(entry.label).split(' ').some(word => word === 'puer' || word === 'puerh'));
  if (!family) fixtureError('a Pu’er tea_family entry is required for the browser rehearsal.');

  const citedStyle = citedEntry(entries, preview.sources, entry => {
    if (entry.entityKind !== 'tea_style') return false;
    const words = normalizedWords(entry.label).split(' ');
    return words.includes('sheng') || words.includes('shou');
  });
  if (!citedStyle) {
    fixtureError('a cited Sheng or Shou tea_style entry with matching public source metadata is required.');
  }
  const typeName = normalizedWords(citedStyle.entry.label).split(' ').includes('sheng') ? 'Sheng' : 'Shou';
  const typeId = typeName.toLowerCase() as 'sheng' | 'shou';

  const citedPlace = citedEntry(
    entries,
    preview.sources,
    entry => PLACE_LEVELS.has(entry.entityKind),
  );
  if (!citedPlace) {
    fixtureError('a cited major region, tea area, mountain, village, or locality with matching public source metadata is required.');
  }

  return {
    family,
    style: citedStyle.entry,
    styleFact: citedStyle.fact,
    styleSource: citedStyle.source,
    typeName,
    typeId,
    place: citedPlace.entry,
    placeFact: citedPlace.fact,
    placeSource: citedPlace.source,
  };
}

async function loadFixtureContract(request: APIRequestContext): Promise<FixtureContract> {
  const response = await request.get('/__tea-reference-preview');
  if (!response.ok()) fixtureError(`GET /__tea-reference-preview returned ${response.status()}.`);
  return deriveFixtureContract(await response.json());
}

function publicProducts(contract: FixtureContract) {
  return [
    {
      id: `preview-${contract.typeId}-active`,
      type: contract.typeName,
      given_name: `${contract.place.label} Spring ${contract.typeName}`,
      product_name: `${contract.place.label} reference tea`,
      origin_country: `${contract.place.label}, China`,
      origin_region: contract.place.label,
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
      id: `preview-${contract.typeId}-sold-out`,
      type: contract.typeName,
      given_name: `${contract.place.label} Archive ${contract.typeName}`,
      product_name: `${contract.place.label} historical tea`,
      origin_country: `${contract.place.label}, China`,
      origin_region: contract.place.label,
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
}

function capturePageHealth(page: Page): PageHealth {
  const health: PageHealth = {
    blockedMutations: [],
    consoleErrors: [],
    pageErrors: [],
    requestFailures: [],
    intentionallyAborted: new Set<Request>(),
  };
  page.on('pageerror', error => health.pageErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') health.consoleErrors.push(message.text());
  });
  page.on('requestfailed', request => {
    if (health.intentionallyAborted.has(request)) return;
    health.requestFailures.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText ?? 'unknown failure'}`);
  });
  return health;
}

async function installApiBoundary(page: Page, health: PageHealth, products: ReturnType<typeof publicProducts>) {
  await page.route('**/api/**', async route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (request.method() === 'GET' && pathname === '/api/products/public') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(products),
      });
      return;
    }
    if (!SAFE_API_METHODS.has(request.method())) {
      health.blockedMutations.push(`${request.method()} ${pathname}`);
      health.intentionallyAborted.add(request);
      await route.abort('blockedbyclient');
      return;
    }
    await route.continue();
  });
}

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

async function attachScreen(page: Page, testInfo: TestInfo, name: 'types' | 'origin') {
  const body = await page.screenshot({ fullPage: false });
  await testInfo.attach(`${testInfo.project.name} ${name}`, { body, contentType: 'image/png' });
}

async function expectFactSource(
  page: Page,
  fact: PublicReferenceStatement,
  source: PublicSource,
) {
  await expect(page.locator(`a[href="${source.url}"]`).first()).toBeVisible();
  await expect(page.getByText(`${source.publisher} · ${source.title}`, { exact: true }).first()).toBeVisible();
  if (fact.excerpt) await expect(page.getByText(fact.excerpt, { exact: false }).first()).toBeVisible();
  if (source.author || source.publishedDate) {
    await expect(page.getByText([source.author, source.publishedDate].filter(Boolean).join(' · '), { exact: true }).first()).toBeVisible();
  }
}

function expectHealthyPage(health: PageHealth) {
  expect(health.blockedMutations, 'the read-only preview attempted an API mutation').toEqual([]);
  expect(health.pageErrors, 'the preview raised uncaught page errors').toEqual([]);
  expect(health.consoleErrors, 'the preview emitted console errors').toEqual([]);
  expect(health.requestFailures, 'the preview had unexpected request failures').toEqual([]);
}

test('renders the public-shaped Tea Reference inside Teajia without writes or private review data', async ({ page, request }, testInfo) => {
  const contract = await loadFixtureContract(request);
  const products = publicProducts(contract);
  const activeProductId = products[0].id;
  const soldOutProductId = products[1].id;
  const health = capturePageHealth(page);
  await installApiBoundary(page, health, products);

  await page.goto('/wisdom/types');
  await expect(page.getByRole('heading', { level: 1, name: 'Tea Types' })).toBeVisible();
  await expectTeajiaChrome(page);
  await expectWisdomNavigation(page, 'Types', 'Origins');
  await expect(page.getByRole('link', { name: 'Pu’er', exact: true })).toHaveAttribute('href', '/wisdom/family/puer');
  await expect(page.getByRole('link', { name: new RegExp(`^${contract.typeName}`) })).toHaveAttribute(
    'href',
    `/wisdom/type/${contract.typeId}`,
  );
  await expectAccessiblePage(page);
  await expectNoHorizontalOverflow(page);
  await attachScreen(page, testInfo, 'types');

  await page.goto(`/wisdom/type/${contract.typeId}`);
  await expect(page.getByRole('heading', { level: 1, name: contract.typeName })).toBeVisible();
  await expectTeajiaChrome(page);
  await expect(page.getByText('Available teas', { exact: true })).toBeVisible();
  await expect(page.getByText('Previously offered', { exact: true })).toBeVisible();
  await expect(page.locator(`a[href="/shop/product/${activeProductId}"]`)).toBeVisible();
  await expect(page.locator(`a[href="/shop/product/${soldOutProductId}"]`)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Pu’er', exact: true })).toHaveAttribute('href', '/wisdom/family/puer');
  await expectFactSource(page, contract.styleFact, contract.styleSource);
  await expect(page.getByRole('link', { name: 'Report an inaccuracy' })).toHaveAttribute('href', /^mailto:hello@teajia\.com/);
  expect(await page.locator('main').innerText()).not.toMatch(PRIVATE_MARKERS);
  await expectAccessiblePage(page);
  await expectNoHorizontalOverflow(page);

  await page.goto('/wisdom/regions');
  await expect(page.getByRole('heading', { level: 1, name: 'Growing Regions' })).toBeVisible();
  await expectTeajiaChrome(page);
  await expectWisdomNavigation(page, 'Origins', 'Types');
  const originHref = `/wisdom/region/${contract.place.id}`;
  await expect(page.locator(`a[href="${originHref}"]`, { hasText: contract.place.label }).first()).toBeVisible();
  await expectAccessiblePage(page);
  await expectNoHorizontalOverflow(page);

  await page.goto(originHref);
  await expect(page.getByRole('heading', { level: 1, name: contract.place.label })).toBeVisible();
  await expectTeajiaChrome(page);
  await expect(page.getByText('Level', { exact: true })).toBeVisible();
  await expect(page.getByText(contract.place.kindLabel, { exact: true })).toBeVisible();
  await expect(page.getByText('Available teas', { exact: true })).toBeVisible();
  await expect(page.getByText('Previously offered', { exact: true })).toBeVisible();
  await expect(page.locator(`a[href="/shop/product/${activeProductId}"]`)).toBeVisible();
  await expect(page.locator(`a[href="/shop/product/${soldOutProductId}"]`)).toBeVisible();
  await expectFactSource(page, contract.placeFact, contract.placeSource);
  expect(await page.locator('main').innerText()).not.toMatch(PRIVATE_MARKERS);
  await expectAccessiblePage(page);
  await expectNoHorizontalOverflow(page);

  const report = page.getByRole('link', { name: 'Report an inaccuracy' });
  await report.scrollIntoViewIfNeeded();
  if (testInfo.project.name === 'Mobile Chrome') {
    const reportBox = await report.boundingBox();
    const bottomNavBox = await page.getByRole('navigation', { name: 'Main navigation' }).boundingBox();
    expect(reportBox).not.toBeNull();
    expect(bottomNavBox).not.toBeNull();
    expect(reportBox!.y + reportBox!.height).toBeLessThanOrEqual(bottomNavBox!.y);
  }
  await attachScreen(page, testInfo, 'origin');

  expectHealthyPage(health);
});
