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
import { normalizeTeaType } from '../src/wisdom/vocabulary';

const PRIVATE_MARKERS = /\b(?:held|holding|holdings|drafted|authorship|conflict|private|evidence)\b/i;
const MASKED_REFERENCE_COPY = /\bthe cited source (?:discusses|records|describes)\b/i;
const SAFE_API_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const PLACE_LEVELS = new Set(['major_region', 'tea_area', 'mountain', 'village', 'locality']);

type PublicSource = PublicReferencePreview['sources'][number];

interface FixtureContract {
  styleFact: PublicReferenceStatement;
  styleSource: PublicSource;
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
    return normalizeTeaType(entry.label) === 'Sheng';
  });
  if (!citedStyle) {
    fixtureError('a cited Sheng-compatible tea_style entry with matching public source metadata is required; a Shou-only fixture cannot exercise /wisdom/type/sheng.');
  }

  const citedPlace = citedEntry(
    entries,
    preview.sources,
    entry => PLACE_LEVELS.has(entry.entityKind),
  );
  if (!citedPlace) {
    fixtureError('a cited major region, tea area, mountain, village, or locality with matching public source metadata is required.');
  }

  return {
    styleFact: citedStyle.fact,
    styleSource: citedStyle.source,
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
      id: 'preview-sheng-active',
      type: 'Sheng',
      given_name: `${contract.place.label} Spring Sheng`,
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
      year: 2008,
    },
    {
      id: 'preview-sheng-sold-out',
      type: 'Sheng',
      given_name: `${contract.place.label} Archive Sheng`,
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
      year: 2006,
    },
    {
      id: 'preview-sheng-unavailable',
      type: 'Sheng',
      given_name: 'Unavailable rehearsal tea',
      product_name: 'Unavailable rehearsal tea',
      origin_country: `${contract.place.label}, China`,
      origin_region: contract.place.label,
      retail_price_per_gram_usd: 0,
      fixed_retail_price_usd: null,
      stock_grams: 0,
      description: '',
      tasting_notes: [],
      image_url: '',
      status: 'Active',
      is_personal: false,
      can_reorder: false,
      year: 2010,
    },
    {
      id: 'preview-sheng-second-lot',
      type: 'Sheng',
      given_name: `${contract.place.label} Spring Sheng`,
      product_name: `${contract.place.label} reference tea`,
      origin_country: `${contract.place.label}, China`,
      origin_region: contract.place.label,
      retail_price_per_gram_usd: 0.7,
      stock_grams: 160,
      description: '',
      tasting_notes: [],
      image_url: '',
      status: 'Active',
      is_personal: false,
      can_reorder: true,
      year: 2012,
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

async function attachScreen(page: Page, testInfo: TestInfo, name: 'types' | 'origin' | 'review') {
  const body = await page.screenshot({ fullPage: false });
  await testInfo.attach(`${testInfo.project.name} ${name}`, { body, contentType: 'image/png' });
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
  const unavailableProductId = products[2].id;
  const secondLotProductId = products[3].id;
  const health = capturePageHealth(page);
  await installApiBoundary(page, health, products);

  await page.goto('/wisdom/types');
  await expect(page.getByRole('heading', { level: 1, name: 'Tea Types' })).toBeVisible();
  await expectTeajiaChrome(page);
  await expectWisdomNavigation(page, 'Types', 'Origins');
  await expect(page.getByRole('link', { name: 'Pu’er', exact: true })).toHaveAttribute('href', '/wisdom/family/puer');
  await expect(page.getByRole('link', { name: /^Sheng/ })).toHaveAttribute('href', '/wisdom/type/sheng');
  await expectAccessiblePage(page);
  await expectNoHorizontalOverflow(page);
  await attachScreen(page, testInfo, 'types');

  await page.goto('/wisdom/type/sheng');
  await expect(page.getByRole('heading', { level: 1, name: 'Sheng' })).toBeVisible();
  await expectTeajiaChrome(page);
  await expect(page.getByText('Available teas', { exact: true })).toBeVisible();
  await expect(page.getByText('Previously offered', { exact: true })).toBeVisible();
  await expect(page.locator(`a[href="/shop/product/${activeProductId}"]`)).toBeVisible();
  await expect(page.locator(`a[href="/shop/product/${soldOutProductId}"]`)).toBeVisible();
  await expect(page.locator(`a[href="/shop/product/${secondLotProductId}"]`)).toBeVisible();
  await expect(page.locator(`a[href="/shop/product/${unavailableProductId}"]`)).toHaveCount(0);
  await expect(page.getByText('2008', { exact: true })).toBeVisible();
  await expect(page.getByText('2012', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Pu’er', exact: true })).toHaveAttribute('href', '/wisdom/family/puer');
  await expect(page.getByRole('link', { name: 'report them' })).toHaveAttribute('href', /^mailto:hello@teajia\.com/);
  expect(await page.locator('main').innerText()).not.toMatch(PRIVATE_MARKERS);
  expect(await page.locator('main').innerText()).not.toMatch(MASKED_REFERENCE_COPY);
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
  await expect(page.locator(`a[href="/shop/product/${secondLotProductId}"]`)).toBeVisible();
  await expect(page.locator(`a[href="/shop/product/${unavailableProductId}"]`)).toHaveCount(0);
  expect(await page.locator('main').innerText()).not.toMatch(PRIVATE_MARKERS);
  expect(await page.locator('main').innerText()).not.toMatch(MASKED_REFERENCE_COPY);
  await expectAccessiblePage(page);
  await expectNoHorizontalOverflow(page);

  const report = page.getByRole('link', { name: 'report them' });
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

test('presents Jinzhai as a sourced place without a misleading county altitude or empty plant claim', async ({ page }) => {
  const health = capturePageHealth(page);
  await installApiBoundary(page, health, [] as unknown as ReturnType<typeof publicProducts>);

  await page.goto('/wisdom/region/jinzhai-county-lu-an');
  await expect(page.getByRole('heading', { level: 1, name: "Jinzhai County, Lu'an" })).toBeVisible();
  await expect(page.getByText('China', { exact: true })).toBeVisible();
  await expect(page.getByText('Anhui', { exact: true })).toBeVisible();
  await expect(page.getByText('Altitude', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'View map' })).toHaveAttribute('href', /^https:\/\/maps\.apple\.com\/\?q=/);
  await expect(page.getByRole('heading', { name: /Plants (?:from|recorded)/i })).toHaveCount(0);
  await expect(page.getByText(
    'If you notice any inaccuracies, please report them. It helps us improve the reference for everyone.',
    { exact: true },
  )).toBeVisible();

  expect(await page.locator('main').innerText()).not.toMatch(PRIVATE_MARKERS);
  await expectAccessiblePage(page);
  await expectNoHorizontalOverflow(page);
  expectHealthyPage(health);
});

test('opens the private incoming review inside Wisdom without saving a decision', async ({ page, request }, testInfo) => {
  const contract = await loadFixtureContract(request);
  const privateResponse = await request.get('/__tea-reference-review');
  expect(privateResponse.ok()).toBe(true);
  const privatePacket = await privateResponse.json() as {
    summary: { entities: number; facts: number };
  };
  expect(privatePacket.summary.entities).toBeGreaterThan(0);
  expect(privatePacket.summary.facts).toBeGreaterThan(0);

  const health = capturePageHealth(page);
  await installApiBoundary(page, health, publicProducts(contract));
  await page.goto('/admin/wisdom');
  await page.getByRole('button', { name: 'Review incoming' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Tea Reference review' })).toBeVisible();
  await expect(page.getByText(/Session only\./i)).toBeVisible();
  await expect(page.getByRole('button', {
    name: `Held entities · ${privatePacket.summary.entities}`,
  })).toBeVisible();
  await expect(page.getByRole('button', {
    name: `Held facts · ${privatePacket.summary.facts}`,
  })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Exact source evidence' }).first()).toBeVisible();

  const ready = page.getByRole('button', { name: 'Ready' }).first();
  await ready.click();
  await expect(ready).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Ready', { exact: true }).first()).toBeVisible();

  await expectNoHorizontalOverflow(page);
  await attachScreen(page, testInfo, 'review');
  expectHealthyPage(health);
});
