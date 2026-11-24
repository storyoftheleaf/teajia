import { expect, test, type Page } from './fixtures';

test.use({ serviceWorkers: 'block' });

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 30 * 86_400;
const membership = { account_id: 'acct-bali', account_name: 'Teajia Bali', role: 'owner', slug: 'teajia-bali' };
const curator = {
  sub: 'curator-1', email: 'curator@test.dev', role: 'owner', platform_role: 'platform_owner',
  active_account_id: 'acct-bali', memberships: [membership], exp,
};
const guest = {
  sub: 'guest-1', email: 'guest@test.dev', role: 'user', platform_role: null,
  active_account_id: null, memberships: [], exp,
};
const tokenFor = (claims: typeof curator | typeof guest) =>
  `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}.sig`;
const curatorToken = tokenFor(curator);
const guestToken = tokenFor(guest);

const product = {
  id: 'product-1', type: 'Green', form: 'Loose', given_name: 'Spring Sencha', product_name: 'Spring Sencha',
  tea_key: 'green:spring-sencha', origin_country: 'Japan', origin_region: 'Shizuoka', retail_price_per_gram_usd: 0.4,
  stock_grams: 250, description: 'Early spring green tea.', tasting_notes: [], image_url: '', status: 'Active',
  is_public: 1, shown_in_shop: 1, can_reorder: 1, tasting_source: 'owner',
};
const productPath = '/shop/product/product-1';
const listingFeed = '/api/products/product-1/impressions';
const homeFeed = '/api/s/teajia-bali/tasting-excerpts';
const queuePath = '/api/admin/tasting-note-candidates';
const reviewedPath = '/admin/tasting-notes';
const placementsPath = '/api/admin/tasting-impressions/impression-1/placements';
const createdAt = '2026-07-12T00:00:00.000Z';

interface JournalPayload {
  id: string;
  product_id: string;
  product_name: string;
  product_type: string;
  created_at: string;
  note: string;
  tastings: string;
}

interface Offer {
  id: string;
  journalEntryId: string;
  noteKey: 'personal';
  productId: string;
  productName: string;
  status: 'starred' | 'promoted';
  sourceText: string;
  attributionName: string;
  impressionId: string | null;
  showOnListing: boolean;
  showOnMainPage: boolean;
}

async function setup(page: Page, { failStar = false }: { failStar?: boolean } = {}) {
  let journal: JournalPayload | undefined = failStar ? {
    id: 'entry-1', product_id: product.id, product_name: product.product_name,
    product_type: product.type, created_at: createdAt,
    note: JSON.stringify({ tasting: {}, updatedAt: createdAt }),
    tastings: JSON.stringify([{ id: 'tasting-1', createdAt, tasting: {} }]),
  } : undefined;
  let offer: Offer | undefined;
  const placements: Array<Record<string, boolean>> = [];
  let showDescriptors = true;

  await page.addInitScript(({ curatorJwt, guestJwt, seedJournal }) => {
    localStorage.clear();
    if (new URLSearchParams(location.search).has('reader')) return;
    const editor = location.pathname.startsWith('/admin') || seedJournal;
    localStorage.setItem('teajia_token', editor ? curatorJwt : guestJwt);
  }, { curatorJwt: curatorToken, guestJwt: guestToken, seedJournal: failStar });

  // The fake catalog and identities stay on the browser test host.
  await page.route('**/*', route => {
    const hostname = new URL(route.request().url()).hostname;
    return ['localhost', '127.0.0.1', '[::1]'].includes(hostname)
      ? route.fallback() : route.abort('blockedbyclient');
  });

  await page.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const authorization = request.headers().authorization;
    const isCurator = authorization === `Bearer ${curatorToken}`;
    const isGuest = authorization === `Bearer ${guestToken}`;
    const json = (body: unknown, status = 200) => route.fulfill({ json: body, status });
    const refused = () => json({ error: 'Unauthorized' }, 401);

    if (path === '/api/auth/me' || path === '/api/auth/refresh') {
      const identity = isCurator ? curator : guest;
      return json({
        ...identity, id: identity.sub, name: isCurator ? 'Curator' : 'Guest',
        token: isCurator ? curatorToken : guestToken,
      });
    }
    const catalogueTea = { ...product, tasting: showDescriptors ? { flavor: ['honey'] } : {} };
    if (path === '/api/products/public' || path === '/api/s/teajia-bali/products') return json([catalogueTea]);
    if (path === '/api/products/public/product-1' || path === '/api/s/teajia-bali/products/product-1') return json(catalogueTea);
    if (path === '/api/accounts/acct-bali' || path === '/api/s/teajia-bali') {
      return json({ id: 'acct-bali', name: 'Teajia Bali', slug: 'teajia-bali', public_enabled: 1 });
    }
    if (path === '/api/family/teas/product-1/mine' && isGuest) {
      return json({ product_id: product.id, photographs: [], cover_photograph_id: null, remaining: 6 });
    }
    if (path === '/api/rates') return json([{ currency: 'USD', rate_to_usd: 1 }]);
    if (path === '/api/tasting-journal' && method === 'GET') {
      return json(journal && (isGuest || (failStar && isCurator)) ? [journal] : []);
    }
    if (path === '/api/tasting-journal/sync') {
      if (isGuest) {
        const payload = request.postDataJSON() as { entries: JournalPayload[] };
        journal = payload.entries[0];
      }
      return json({ synced: 1 });
    }
    if (path === '/api/tasting-journal/entry-1/candidates/tasting-1' && method === 'PUT') {
      return json({ error: 'Private review unavailable' }, 500);
    }
    if (path === `/api/tasting-journal/${journal?.id}/offers/personal`) {
      if (!isGuest || !journal) return refused();
      if (method === 'GET') return json(offer ?? null);
      if (method === 'PUT') {
        const { excerpt, byline } = request.postDataJSON();
        if (!byline || !JSON.parse(journal.note).personalNote.includes(excerpt)) {
          return json({ error: 'Offer must quote the saved note and include a byline' }, 422);
        }
        offer = {
          id: 'candidate-1', journalEntryId: journal.id, noteKey: 'personal', productId: product.id,
          productName: product.given_name, status: 'starred', sourceText: excerpt, attributionName: byline,
          impressionId: null, showOnListing: false, showOnMainPage: false,
        };
        return json(offer);
      }
      if (method === 'DELETE') {
        offer = undefined;
        return json({ success: true });
      }
    }
    if (path === queuePath) {
      if (!isCurator) return refused();
      return json(offer?.status === url.searchParams.get('status') ? [offer] : []);
    }
    if (path === `${queuePath}/candidate-1/promote` && method === 'POST') {
      if (!isCurator || !offer || offer.status !== 'starred') return refused();
      expect(request.postDataJSON()).toEqual({});
      offer = { ...offer, status: 'promoted', impressionId: 'impression-1' };
      return json({ id: offer.impressionId, productId: product.id }, 201);
    }
    if (path === placementsPath && method === 'PUT') {
      if (!isCurator || !offer || offer.status !== 'promoted') return refused();
      const patch = request.postDataJSON();
      placements.push(patch);
      offer = {
        ...offer,
        showOnListing: patch.show_on_listing ?? offer.showOnListing,
        showOnMainPage: patch.show_on_main_page ?? offer.showOnMainPage,
      };
      return json({ showOnListing: offer.showOnListing, showOnMainPage: offer.showOnMainPage });
    }
    if (path === listingFeed || path === homeFeed) {
      const visible = offer?.status === 'promoted' && (path === listingFeed ? offer.showOnListing : offer.showOnMainPage);
      return json(visible ? [{
        id: offer.impressionId, productId: product.id, text: offer.sourceText, attributionName: offer.attributionName,
        attributionDetail: null, publishedAt: createdAt,
      }] : []);
    }
    if (path === '/api/tea-reviews' || path === '/api/products/product-1/events') return json([]);
    if (path === '/api/user/favorites') return json({ favorites: [] });
    return json({});
  });
  return { journal: () => journal, placements, offer: () => offer, clearDescriptors: () => { showDescriptors = false; } };
}

test('a guest excerpt requires approval and an independent public placement', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const state = await setup(page);
  const secret = 'Only in my journal.';
  const excerpt = 'The finish felt steady';
  const byline = 'A. Guest';
  const sentence = `${excerpt}. ${secret}`;

  const showPublic = async (surface: 'listing' | 'homepage', visible: boolean) => {
    const feed = surface === 'listing' ? listingFeed : homeFeed;
    await Promise.all([
      page.waitForResponse(response => new URL(response.url()).pathname === feed),
      page.goto(`${surface === 'listing' ? productPath : '/'}?reader=1`),
    ]);
    const quote = page.locator('blockquote').filter({ hasText: excerpt });
    if (visible) {
      await expect(quote).toHaveCount(1);
      await expect(quote).toBeVisible();
      const attribution = surface === 'listing' ? quote.locator('..').locator('figcaption') : quote.locator('footer');
      await expect(attribution).toContainText(byline);
      await quote.scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
    } else {
      await expect(quote).toHaveCount(0);
    }
    await expect(page.getByText(secret)).toHaveCount(0);
  };

  await page.goto(productPath);
  const feelingNote = page.getByRole('textbox', { name: 'Your experience with this tea' });
  await expect(feelingNote).toHaveCount(0);
  await page.getByRole('group', { name: 'Your tea actions' }).getByRole('button', { name: 'Add your tasting', exact: true }).click();
  const overlay = page.locator('[data-tasting-session-overlay]');
  await expect(overlay.getByRole('button', { name: 'All tastings', exact: true })).toHaveCount(0);
  const photos = overlay.getByRole('group', { name: 'Your photographs' });
  await expect(photos.getByRole('button', { name: 'Add photographs', exact: true })).toBeVisible();
  await expect(overlay.locator('.tasting-session-header').getByRole('button', { name: 'Add photographs' })).toHaveCount(0);
  await expect(overlay.getByRole('link', { name: 'How we use photographs' })).toHaveCount(0);
  const picker = page.waitForEvent('filechooser');
  await photos.getByRole('button', { name: 'Add photographs' }).click();
  expect((await picker).isMultiple()).toBe(true);
  await page.getByRole('button', { name: 'Dislike', exact: true }).click();
  await expect(feelingNote).toHaveAttribute('placeholder', /what didn’t you like.*source better teas/i);
  await expect(page.getByText('Saved to your private tasting journal.')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('private-tasting-prompt.png'), scale: 'css' });
  await feelingNote.fill(sentence);
  await page.getByRole('button', { name: 'Neutral', exact: true }).click();
  await expect(feelingNote).toHaveValue(sentence);
  await page.locator('nav:visible').getByRole('button', { name: 'Effect', exact: true }).click();
  await page.getByRole('button', { name: 'Calm', exact: true }).click();
  await page.getByRole('button', { name: 'Open your impression', exact: true }).click();
  await page.getByRole('button', { name: 'Save notes', exact: true }).click();
  await page.getByRole('button', { name: 'Not now', exact: true }).click();
  expect(state.offer()).toBeUndefined();
  const saved = state.journal();
  expect(saved?.product_id).toBe(product.id);
  expect(JSON.parse(saved!.note)).toMatchObject({ personalNote: sentence, tasting: { feeling: ['calming'] } });

  await page.getByRole('textbox', { name: 'Excerpt', exact: true }).fill(excerpt);
  await page.getByRole('textbox', { name: 'Public byline' }).fill(byline);
  await page.getByRole('button', { name: 'Send for approval' }).click();
  await expect(page.getByText('Awaiting review')).toBeVisible();

  await page.goto(reviewedPath);
  await expect(page.getByRole('heading', { name: 'Guest notes' })).toBeVisible();
  await expect(page.getByText(secret)).toHaveCount(0);
  await expect(page.locator('figcaption').filter({ hasText: byline })).toBeVisible();
  await page.getByRole('button', { name: 'Approve excerpt' }).click();
  await expect(page.getByRole('button', { name: 'Show on listing' })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: 'Show on homepage' })).toHaveAttribute('aria-pressed', 'false');
  expect(state.placements).toEqual([]);
  await showPublic('listing', false);
  await showPublic('homepage', false);

  await page.goto(reviewedPath);
  await page.getByRole('button', { name: 'Approved' }).click();
  await page.getByRole('button', { name: 'Show on listing' }).click();
  await expect(page.getByRole('button', { name: 'Show on listing' })).toHaveAttribute('aria-pressed', 'true');
  expect(state.placements).toEqual([{ show_on_listing: true }]);
  await showPublic('listing', true);
  const journalSection = page.getByRole('region', { name: 'From the tasting journal' });
  const provenance = page.getByRole('region', { name: 'Provenance' });
  const descriptorBox = page.getByRole('region', { name: 'Taste', exact: true }).locator('.alcove-record');
  await expect(descriptorBox.getByText('Honey', { exact: true })).toBeVisible();
  await expect(descriptorBox.getByRole('region', { name: 'From the tasting journal' })).toHaveCount(0);
  const box = await descriptorBox.boundingBox();
  const journal = await journalSection.boundingBox();
  expect(journal!.y).toBeGreaterThan(box!.y + box!.height);
  // The journal sits after the story, under "What people often notice"
  // (Adrian, 2026-11-24), so it follows the facts box.
  const expectJournalAfterFacts = async () => {
    await expect(provenance).toBeVisible();
    const factsElement = await provenance.elementHandle();
    expect(await journalSection.evaluate((journal, section) =>
      Boolean(journal.compareDocumentPosition(section!) & Node.DOCUMENT_POSITION_PRECEDING), factsElement)).toBe(true);
  };
  await expectJournalAfterFacts();

  state.clearDescriptors();
  await showPublic('listing', true);
  await expect(page.getByText('Honey', { exact: true })).toHaveCount(0);
  await expectJournalAfterFacts();
  await showPublic('homepage', false);

  await page.goto(reviewedPath);
  await page.getByRole('button', { name: 'Approved' }).click();
  await page.getByRole('button', { name: 'Show on homepage' }).click();
  await expect(page.getByRole('button', { name: 'Show on homepage' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Show on listing' }).click();
  await expect(page.getByRole('button', { name: 'Show on listing' })).toHaveAttribute('aria-pressed', 'false');
  expect(state.placements).toEqual([{ show_on_listing: true }, { show_on_main_page: true }, { show_on_listing: false }]);
  await showPublic('listing', false);
  await showPublic('homepage', true);
  await page.goto(productPath);
  await page.getByRole('group', { name: 'Your tea actions' }).getByRole('button', { name: 'Add your tasting', exact: true }).click();
  await page.getByRole('button', { name: 'Withdraw offer' }).click();
  await expect(page.getByRole('button', { name: 'Send for approval' })).toBeVisible();
  await showPublic('homepage', false);
  await showPublic('listing', false);
  expect(JSON.parse(state.journal()!.note).personalNote).toBe(sentence);

});

test('a failed private star rolls the pressed state back beside its section', async ({ page }) => {
  await setup(page, { failStar: true });
  await page.goto('/account/journal');
  await page.locator('button.w-full.text-left').filter({ hasText: 'Spring Sencha' }).click();
  await page.getByRole('textbox', { name: 'Note for this tasting' }).fill('Long mineral finish');
  await page.getByRole('button', { name: 'Star this note for private review' }).click();
  await expect(page.getByRole('button', { name: 'Star this note for private review' })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('alert')).toContainText('Private review unavailable');
});
