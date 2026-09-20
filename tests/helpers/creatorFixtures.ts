import type { Page, Route } from '@playwright/test';

/**
 * The three creator fixtures, as the worker returns them from GET /api/people
 * and GET /api/people/:slug, mirrored from worker/sandbox/seed-creator-fixtures.mjs
 * so a spec run against the mock server sees the same shapes the sandbox does.
 *
 * Every image is a 1x1 data URI: the specs are about layout and gating, never
 * about a photograph, and nothing here should reach Unsplash from CI.
 */

export const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

/** Kenji's fixed share token from the seed. */
export const KENJI_SHARE_TOKEN = 'f1e2d3c4b5a6978877665544332211aa';

/** The bank detail the public must never see. */
export const KENJI_BANK_DETAIL = 'Tanaka Tea House, account ending 0092';

const base = {
  chinese_name: null, pronouns: null, active_since: null, beginnings: null, now_text: null, now_stamp: null,
  now_updated_at: null, inspirations: null, closing: null, avatar_url: null, portrait_caption: null,
  voice_clip_url: null, voice_clip_caption: null, pouring_today_product_id: null, pouring_today_note: null,
  where_to_find_text: null, languages: [], is_published: 1, gallery_images: [], articles: [], pull_quotes: [],
  featured_in: [], products: [], tea_selection: [], collection: null, accounts: [], host_account: null,
  hosting: null, has_payment_methods: false, payment_accounts: [], seasonal_line: null,
};

export const weiChen = {
  ...base,
  id: 'wei-chen',
  contributor_slug: 'wei-chen',
  display_name: 'Wei Chen',
  business_name: null,
  role: 'Tea Master',
  location_line: null,
  portrait_url: PIXEL,
  now_text: 'I started sourcing oolong from Wuyi Shan in 2019. I am still learning the mountain every season.',
  links: [],
};

export const amaraOsei = {
  ...base,
  id: 'amara-osei',
  contributor_slug: 'amara-osei',
  display_name: 'Amara Osei',
  business_name: 'Osei Tea Imports',
  role: 'Tea Master',
  pronouns: 'she/her',
  location_line: 'Portland, Oregon',
  portrait_url: PIXEL,
  beginnings: 'I grew up on gunpowder green at my grandmother\'s table in Accra.\n\nI moved to Portland in 2014.',
  now_text: 'I am sourcing directly from smallholder gardens this year.',
  inspirations: 'My first teacher was my grandmother.',
  links: [{ platform: 'instagram', value: '@amarateas', qr_image_url: null }],
  articles: [{ slug: 'four-houses-one-kettle-fixture', title: 'Four Houses, One Kettle', subtitle: 'A room full of new drinkers', published_at: '2026-09-10T00:00:00Z', cover_image_url: PIXEL, reading_time_mins: 4, pull_quote: 'The second steep is the honest one. The first is what the leaf wants you to think.', quote_anchor: 'quote-kenji-tanaka' }],
  tea_selection: [
    { tea_profile_id: 'prof-a1', why: 'A favorite for slow afternoons.', slug: 'gushu-2012', name: 'Gushu 2012', image_url: null, product_name: 'Gushu 2012', public_path: '/shop/product/gushu-2012?store=teajia-bali', type: 'Sheng', year: '2012', chinese_name: '古树', origin: 'Yiwu, Yunnan' },
    { tea_profile_id: 'prof-a2', why: 'Old-tree Yiwu.', slug: 'yiwu-2016', name: 'Yiwu 2016', image_url: null, product_name: 'Yiwu 2016', public_path: '/shop/product/yiwu-2016?store=teajia-bali', type: 'Sheng', year: '2016', chinese_name: null, origin: 'Yiwu, Yunnan' },
    { tea_profile_id: 'prof-a3', why: 'Soft and floral.', slug: 'dancong', name: 'Dancong', image_url: null, product_name: 'Dancong', public_path: '/shop/product/dancong?store=teajia-bali', type: 'Oolong', year: '2023', chinese_name: '单丛', origin: 'Chaozhou, Guangdong' },
  ],
};

export const kenjiTanaka = {
  ...base,
  id: 'kenji-tanaka',
  contributor_slug: 'kenji-tanaka',
  display_name: 'Kenji Tanaka',
  business_name: 'Tanaka Tea House',
  role: 'Tea Master · Host',
  pronouns: 'he/him',
  location_line: 'Kyoto, Japan',
  active_since: '2015',
  portrait_url: PIXEL,
  beginnings: 'I trained for six years under a sencha producer in Uji before I opened my own room in Kyoto.\n\nThe first tea I ever served a stranger was a badly bruised gyokuro.',
  now_text: 'I pour on Saturday evenings at Tanaka Tea House, four guests at most. This year is about teaching, not just pouring.\n\nI still source most of my sencha from the same two families I started with in 2015.',
  now_stamp: 'Autumn 2026',
  inspirations: 'A visiting Taiwanese tea master showed me that a tea room does not need to be quiet to be serious.',
  closing: 'If you only remember one thing from an afternoon here, let it be how the third steep tasted, not the first.',
  links: [
    { platform: 'wechat', value: 'tanaka_tea_kyoto', qr_image_url: PIXEL },
    { platform: 'instagram', value: '@tanakateahouse', qr_image_url: null },
    { platform: 'website', value: 'https://example.com', qr_image_url: null },
  ],
  gallery_images: [
    { id: 'gal-kenji-1', image_url: PIXEL, caption: 'Pouring tea into a cup, hands close', position: 0 },
    { id: 'gal-kenji-2', image_url: PIXEL, caption: 'Seated at the tea table mid-session', position: 1 },
    { id: 'gal-kenji-3', image_url: PIXEL, caption: 'Weighing and preparing leaves', position: 2 },
    { id: 'gal-kenji-4', image_url: PIXEL, caption: 'A teaching gesture over the tray', position: 3 },
    { id: 'gal-kenji-5', image_url: PIXEL, caption: 'Steam rising from the gaiwan', position: 4 },
  ],
  articles: [
    { slug: 'kenji-tanaka-words-fixture', title: 'What Three Steeps Taught Me', subtitle: 'Notes from the tea room', published_at: '2026-09-17T00:00:00Z', cover_image_url: PIXEL, reading_time_mins: 6, pull_quote: 'Tea is not a performance. It is just attention, poured out and shared.', quote_anchor: 'quote-kenji-tanaka' },
  ],
  pull_quotes: [
    { pull_quote: 'Tea is not a performance. It is just attention, poured out and shared.', author_id: 'kenji-tanaka', published_at: '2026-09-17T00:00:00Z', article_slug: 'kenji-tanaka-words-fixture', article_title: 'What Three Steeps Taught Me', article_subtitle: 'Notes from the tea room', cover_image_url: PIXEL, reading_time_mins: 6, quote_anchor: 'quote-kenji-tanaka' },
    { pull_quote: 'The second steep is the honest one. The first is what the leaf wants you to think.', author_id: 'amara-osei', published_at: '2026-09-10T00:00:00Z', article_slug: 'four-houses-one-kettle-fixture', article_title: 'Four Houses, One Kettle', article_subtitle: 'A room full of new drinkers', cover_image_url: PIXEL, reading_time_mins: 4, quote_anchor: 'quote-kenji-tanaka' },
  ],
  featured_in: [
    { slug: 'four-houses-one-kettle-fixture', title: 'Four Houses, One Kettle', subtitle: 'A room full of new drinkers', author_id: 'amara-osei', published_at: '2026-09-10T00:00:00Z', cover_image_url: PIXEL, reading_time_mins: 4, pull_quote: 'The second steep is the honest one. The first is what the leaf wants you to think.', quote_anchor: 'quote-kenji-tanaka' },
  ],
  tea_selection: [
    { tea_profile_id: 'prof-k1', why: 'A red tea I pour for guests who think they only like green.', slug: 'call-of-grace', name: 'Call of Grace', image_url: null, product_name: 'Call of Grace', public_path: '/shop/product/call-of-grace?store=teajia-bali', type: 'Oolong', year: '1988', chinese_name: '铁观音', origin: 'Anxi, Fujian' },
    { tea_profile_id: 'prof-k2', why: 'Aged through the tropics before it ever reached me.', slug: 'rising-peak', name: 'Rising Peak', image_url: null, product_name: 'Rising Peak', public_path: '/shop/product/rising-peak?store=teajia-bali', type: 'Oolong', year: '1996', chinese_name: '陈年冻顶乌龙', origin: 'Lugu, Taiwan' },
    { tea_profile_id: 'prof-k3', why: 'Earthy without going flat.', slug: 'taiwan-tgy', name: 'Taiwan Tie Guan Yin', image_url: null, product_name: 'Taiwan Tie Guan Yin', public_path: '/shop/product/taiwan-tgy?store=teajia-bali', type: 'Oolong', year: '1972', chinese_name: '台湾铁观音', origin: 'Muzha, Taipei' },
    { tea_profile_id: 'prof-k4', why: 'Bought a full basket on a hunch.', slug: 'shou-2008', name: 'Shou 2008', image_url: null, product_name: 'Shou 2008', public_path: '/shop/product/shou-2008?store=teajia-bali', type: 'Shou', year: '2008', chinese_name: null, origin: 'Menghai, Yunnan' },
    { tea_profile_id: 'prof-k5', why: 'An easy, forgiving brew.', slug: 'liu-bao', name: 'Liu Bao', image_url: null, product_name: 'Liu Bao', public_path: '/shop/product/liu-bao?store=teajia-bali', type: 'Dark', year: '2011', chinese_name: '六堡', origin: 'Wuzhou, Guangxi' },
    { tea_profile_id: 'prof-k6', why: 'The oldest tea on my own shelf.', slug: 'aged-white', name: 'Aged White', image_url: null, product_name: 'Aged White', public_path: '/shop/product/aged-white?store=teajia-bali', type: 'White', year: '2009', chinese_name: null, origin: 'Fuding, Fujian' },
  ],
  collection: { slug: 'saturday-at-the-house-fixture', title: 'Saturday at the house', note: 'The six teas Kenji pours on Saturday evenings, in the order he pours them.', hero_image_url: PIXEL, item_count: 6 },
  accounts: [
    { account_id: 'acc_teajia_bali', slug: 'teajia-bali', name: 'Teajia Bali', account_kind: 'platform', public_role: 'Tea Master', is_host: 0, display_order: 0 },
    { account_id: 'acc-sbx-tanaka-tea-house', slug: 'tanaka-tea-house', name: 'Tanaka Tea House', account_kind: 'master', public_role: 'Tea Master', is_host: 1, display_order: 1, location_city: 'Kyoto', location_country: 'Japan' },
  ],
  host_account: { id: 'acc-sbx-tanaka-tea-house', slug: 'tanaka-tea-house', name: 'Tanaka Tea House', tagline: 'Small sessions, four guests at most.', public_shop_path: null, location_city: 'Kyoto', location_country: 'Japan' },
  hosting: { slug: 'sbx-kyoto-tasting-fixture', title: 'Gongfu evening', subtitle: 'Four places at the table', event_date: '2026-10-10T19:00:00', location_name: 'Tanaka Tea House', flyer_image_url: PIXEL, account_slug: 'teajia-bali', account_name: 'Teajia Bali' },
  has_payment_methods: true,
  payment_accounts: [],
};

export const directory = {
  contributors: [
    { id: 'amara-osei', display_name: 'Amara Osei', chinese_name: null, role: 'Tea Master', business_name: 'Osei Tea Imports', location_line: 'Portland, Oregon', avatar_url: null, card_image_url: null, own_line: 'I am sourcing directly from smallholder gardens this year.', is_host: false, article_count: 1 },
    { id: 'kenji-tanaka', display_name: 'Kenji Tanaka', chinese_name: null, role: 'Tea Master · Host', business_name: 'Tanaka Tea House', location_line: 'Kyoto, Japan', avatar_url: null, card_image_url: PIXEL, own_line: 'I pour on Saturday evenings at Tanaka Tea House, four guests at most.', is_host: true, article_count: 1 },
    { id: 'wei-chen', display_name: 'Wei Chen', chinese_name: null, role: 'Tea Master', business_name: null, location_line: null, avatar_url: null, card_image_url: PIXEL, own_line: 'I started sourcing oolong from Wuyi Shan in 2019.', is_host: false, article_count: 0 },
  ],
};

export const kenjiMethods = {
  contributor: { id: 'kenji-tanaka', display_name: 'Kenji Tanaka', portrait_url: PIXEL },
  store: null,
  resolution: 'default',
  has_any_method: true,
  available_accounts: [],
  payment_methods: [
    { id: 'pm-kenji-bank', method_type: 'bank_transfer', label: 'Bank transfer (Kyoto)', recipient_name: 'Kenji Tanaka', account_identifier: KENJI_BANK_DETAIL, instructions: 'Include your name as the transfer reference.', external_url: null, qr_image_url: null, position: 0, is_published: true },
    { id: 'pm-kenji-link', method_type: 'payment_link', label: 'Pay online', recipient_name: 'Kenji Tanaka', account_identifier: null, instructions: null, external_url: 'https://example.com/pay/tanaka-tea-house', qr_image_url: null, position: 1, is_published: true },
  ],
  context: { amount: null, currency: null, reference: null, errors: [], display_only: true, local: null },
};

export const gateBody = {
  error: 'Payment details are shared privately',
  code: 'pay_private',
  access: 'gate',
  contributor: { id: 'kenji-tanaka', display_name: 'Kenji Tanaka', business_name: 'Tanaka Tea House', portrait_url: PIXEL },
};

export type Viewer = 'stranger' | 'signed-in' | 'approved' | 'pending' | 'owner';

/**
 * Mock the people API the way the worker answers it. `viewer` decides what
 * /pay-access and /payment-methods say; a request carrying Kenji's share token
 * opens the sheet whatever the viewer. Every call is recorded on `calls`.
 */
export async function mockCreatorApi(page: Page, options: { viewer?: Viewer } = {}): Promise<{ calls: string[] }> {
  const viewer = options.viewer ?? 'stranger';
  const calls: string[] = [];
  const profiles: Record<string, unknown> = { 'wei-chen': weiChen, 'amara-osei': amaraOsei, 'kenji-tanaka': kenjiTanaka };
  const openFor = (url: URL) => {
    const token = url.searchParams.get('t');
    if (token === KENJI_SHARE_TOKEN) return 'link';
    if (viewer === 'owner') return 'owner';
    if (viewer === 'approved') return 'approved';
    return null;
  };
  await page.route('**/api/**', async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    calls.push(`${request.method()} ${path}${url.search}`);
    if (path === '/api/people') return route.fulfill({ json: directory });
    const profileMatch = path.match(/^\/api\/people\/([^/]+)$/);
    if (profileMatch) {
      const slug = decodeURIComponent(profileMatch[1]);
      const profile = profiles[slug];
      return profile ? route.fulfill({ json: profile }) : route.fulfill({ status: 404, json: { error: 'Contributor not found' } });
    }
    if (path === '/api/public/people/kenji-tanaka/pay-access') {
      const via = openFor(url);
      return route.fulfill({ json: {
        access: via ? 'open' : 'gate',
        via,
        contributor: gateBody.contributor,
        viewer: { signed_in: viewer !== 'stranger', is_owner: viewer === 'owner', request_status: viewer === 'approved' ? 'approved' : viewer === 'pending' ? 'pending' : null },
        invoice: null,
      } });
    }
    if (path === '/api/public/people/kenji-tanaka/pay-access/request') {
      return route.fulfill({ status: 201, json: { status: 'pending', grant_id: 'pag-test' } });
    }
    if (path === '/api/public/people/kenji-tanaka/payment-methods') {
      return openFor(url) ? route.fulfill({ json: kenjiMethods }) : route.fulfill({ status: 403, json: gateBody });
    }
    if (path === '/api/auth/me') {
      if (viewer === 'stranger') return route.fulfill({ status: 401, json: { error: 'Unauthorized' } });
      return route.fulfill({ json: { id: 'sbx-user-amara-osei', email: 'amara.osei.fixture@sandbox.local', name: 'Amara Osei', role: 'user' } });
    }
    return route.fulfill({ json: {} });
  });
  return { calls };
}

/** A session in storage, the way the app keeps one. The mock server accepts anything. */
export async function signInAs(page: Page, sub = 'sbx-user-amara-osei') {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub, email: `${sub}@sandbox.local`, name: sub, exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
  await page.addInitScript((jwt: string) => localStorage.setItem('teajia_token', jwt), token);
}

/** Console and page errors worth failing on. Network noise from a mock server is not. */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  return errors;
}

export function meaningfulErrors(errors: string[]): string[] {
  return errors.filter(text =>
    !text.includes('net::ERR') && !text.includes('Failed to load resource') && !text.includes('favicon')
    && !text.includes('401') && !text.includes('403'));
}

export async function noHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2);
}

export async function setTheme(page: Page, theme: 'light' | 'dark') {
  await page.addInitScript((value: string) => localStorage.setItem('teajia_theme', value), theme);
}
