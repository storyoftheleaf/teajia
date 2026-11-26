import { expect, test, type Page } from './fixtures';

// Quiet acknowledgement (CLAUDE.md, third exception): only things one person
// gives another, in words, where the thing itself is shown. Each line appears
// only when its data is present, and no number sits beside any person.
test.use({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });

const product = {
  id: 'product-1', type: 'Green', form: 'Loose', given_name: 'Spring Sencha', product_name: 'Spring Sencha',
  tea_key: 'green:spring-sencha', origin_country: 'Japan', origin_region: 'Shizuoka', retail_price_per_gram_usd: 0.4,
  stock_grams: 250, description: 'Early spring green tea.', tasting_notes: [], image_url: '', status: 'Active',
  is_public: 1, shown_in_shop: 1, can_reorder: 1, tasting_source: 'owner',
};

const familyPhoto = (id: string, photographBy: string | null) => ({
  id, full_url: `https://media.teajia.co/${id}-full.jpg`, small_url: `https://media.teajia.co/${id}-small.jpg`,
  full_width: 1200, full_height: 1200, small_width: 480, small_height: 480, shape: 'square', frame: null,
  author: photographBy ? { name: photographBy, page_id: null } : null, photograph_by: photographBy,
});

const profile = (over: Record<string, unknown>) => ({
  id: 'mei', account_id: 'acct', display_name: 'Mei Lin', role: null, is_published: 1, location_line: 'Ubud, Bali',
  beginnings: 'I began with oolong.', inspirations: null, links: [], articles: [], featured_in: [], products: [],
  host_account: null, seasonal_line: null, pull_quotes: [], gallery_images: [], tea_selection: [], collection: null,
  hosting: null, created_at: '2026-01-01', updated_at: '2026-01-01', ...over,
});

const recap = (over: Record<string, unknown>) => ({
  slug: 'courtyard', title: 'Tea in the courtyard', event_date: '2026-11-20',
  people: [{ slug: 'host', name: 'Adrian Host', role: 'lead_host' }, { slug: 'cohost', name: 'Mei Lin', role: 'co_host' }],
  note: null, galleryPhoto: null, teas: [], table: [], guestBook: [], ...over,
});

/** Every API answer is ours: the named ones as given, anything else empty. */
async function api(page: Page, answers: Record<string, unknown>) {
  await page.route('**/*', route => {
    const hostname = new URL(route.request().url()).hostname;
    return ['localhost', '127.0.0.1', '[::1]'].includes(hostname) ? route.fallback() : route.abort('blockedbyclient');
  });
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path.startsWith('/api/media/')) return route.fallback();
    if (path in answers) return route.fulfill({ json: answers[path] });
    if (path === '/api/rates') return route.fulfill({ json: [{ currency: 'USD', rate_to_usd: 1 }] });
    return route.fulfill({ json: {} });
  });
}

async function noHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
}

test('photograph by <first name> only when the photographer allowed it', async ({ page }) => {
  await api(page, {
    '/api/products/public': [product],
    '/api/products/public/product-1': product,
    '/api/products/product-1/impressions': [],
    '/api/products/product-1/events': [],
    '/api/tea-reviews': [],
    '/api/user/favorites': { favorites: [] },
    '/api/family/teas/product-1/photographs': {
      product_id: 'product-1', lead: null, placed: [],
      family: [familyPhoto('named', 'Mei'), familyPhoto('unnamed', null)],
    },
  });
  await page.goto('/shop/product/product-1');
  const thumbs = page.getByTestId('tea-photograph');
  await expect(thumbs).toHaveCount(2);

  await thumbs.nth(0).click();
  await expect(page.getByTestId('photograph-credit')).toHaveText('Photograph by Mei');
  await expect(page.getByTestId('photograph-credit')).not.toContainText('Tan');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('photograph-credit')).toHaveCount(0);

  await thumbs.nth(1).click();
  await expect(page.locator('.photo-zoom__credit')).toHaveCount(0);
  await expect(page.getByText(/Photograph by/)).toHaveCount(0);
  await noHorizontalOverflow(page);
});

test('poured with: the people who poured beside the host, linked only when their page is published', async ({ page }) => {
  await api(page, {
    '/api/public/sit-recaps/courtyard': { recap: recap({ poured_with: [{ name: 'Mei Lin', slug: 'cohost' }, { name: 'Jun', slug: null }] }) },
    '/api/events/courtyard/recap': { event: { slug: 'courtyard', title: 'Tea in the courtyard' }, post_session: {} },
  });
  await page.goto('/event/courtyard/recap');
  const line = page.getByTestId('poured-with');
  await expect(line).toHaveText('Poured with Mei Lin, Jun');
  await expect(line.getByRole('link', { name: 'Mei Lin' })).toHaveAttribute('href', '/people/cohost');
  await expect(line.getByRole('link', { name: 'Jun' })).toHaveCount(0);
  // The head names the host; nobody is said twice.
  await expect(page.getByTestId('session-people')).toHaveText(/^Host\s*Adrian Host$/);
  await expect(page.locator('body')).not.toContainText(/master/i);
  await noHorizontalOverflow(page);
});

test('poured with is absent when nobody poured beside the host', async ({ page }) => {
  await api(page, {
    '/api/public/sit-recaps/courtyard': { recap: recap({ people: [{ slug: 'host', name: 'Adrian Host', role: 'lead_host' }], poured_with: [] }) },
    '/api/events/courtyard/recap': { event: { slug: 'courtyard', title: 'Tea in the courtyard' }, post_session: {} },
  });
  await page.goto('/event/courtyard/recap');
  await expect(page.getByTestId('session-people')).toHaveText(/^Host\s*Adrian Host$/);
  await expect(page.getByTestId('poured-with')).toHaveCount(0);
  await expect(page.getByText(/Poured with/)).toHaveCount(0);
});

test('the people list says "Pours at tables" only for someone who pours, and no number beside anyone', async ({ page }) => {
  const person = (id: string, name: string, group: string, pours: boolean) => ({
    id, display_name: name, role: null, card_image_url: `https://media.teajia.co/${id}.jpg`, avatar_url: null,
    own_line: `${name} drinks oolong.`, is_host: true, article_count: 0, page_tier: group === 'family' ? 'family' : null,
    list_group: group, pours,
  });
  await api(page, {
    '/api/people': { contributors: [
      person('ana', 'Ana Pour', 'season', true),
      person('ben', 'Ben Soon', 'season', false),
      person('cai', 'Cai Pour', 'family', true),
      person('dee', 'Dee Family', 'family', false),
    ] },
  });
  await page.goto('/people');
  const cards = page.getByTestId('people-card');
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0).getByTestId('person-pours')).toHaveText('Pours at tables');
  await expect(cards.nth(1).getByTestId('person-pours')).toHaveCount(0);
  const rows = page.getByTestId('family-row');
  await expect(rows.nth(0).getByTestId('person-pours')).toHaveText('Pours at tables');
  await expect(rows.nth(1).getByTestId('person-pours')).toHaveCount(0);
  await expect(page.getByTestId('person-pours')).toHaveCount(2);
  for (const item of [...await cards.all(), ...await rows.all()]) {
    expect(await item.innerText()).not.toMatch(/\d/);
  }
  await noHorizontalOverflow(page);
});

test('the word Adrian granted shows once beneath the name, and only where one exists', async ({ page }) => {
  await api(page, {
    '/api/people/mei': profile({ page_tier: 'master', role: 'Tea master' }),
    '/api/people/jun': profile({ id: 'jun', display_name: 'Jun Wei', page_tier: 'family', role: 'Teajia family' }),
  });
  await page.goto('/people/mei');
  const cover = page.getByTestId('profile-cover');
  await expect(page.getByTestId('profile-granted-word')).toHaveText('Tea master');
  expect((await cover.innerText()).match(/tea master/gi)?.length).toBe(1);
  expect(await cover.innerText()).not.toMatch(/\d/);
  await noHorizontalOverflow(page);

  await page.goto('/people/jun');
  await expect(page.getByTestId('profile-cover')).toContainText('Jun');
  await expect(page.getByTestId('profile-granted-word')).toHaveCount(0);
  expect(await page.getByTestId('profile-cover').innerText()).not.toMatch(/\d/);
});
