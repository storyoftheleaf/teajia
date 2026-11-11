import { test } from '../../tests/fixtures';
import { warm, go, SIZES } from './lib';
import { click, room } from './steps';
import { installAdmin } from './mock';
import * as D from './rooms-data';

const handlers = [
  (u: URL) => (u.pathname === '/api/attention' ? D.ATTENTION : undefined),
  (u: URL) => (u.pathname === '/api/analytics/revenue' ? D.REVENUE : undefined),
  (u: URL) => (u.pathname === '/api/customers/rfm' ? D.RFM : undefined),
  (u: URL, m: string) => (u.pathname === '/api/invoices' && m === 'GET' ? D.INVOICES : undefined),
  (u: URL) => { const m = u.pathname.match(/^\/api\/invoices\/([^/]+)$/); return m ? D.INVOICES.find((i) => i.id === m[1]) : undefined; },
  (u: URL) => (u.pathname === '/api/admin/inquiries' ? D.INQUIRIES : undefined),
  (u: URL) => (u.pathname === '/api/admin/pending-attendees' ? D.ATTENDEES.filter((a) => a.status === 'requested').map((a) => ({ ...a, ...D.PENDING_ATTENDEES_EXTRA })) : undefined),
  (u: URL) => (u.pathname === '/api/wholesale/orders' ? D.WHOLESALE : undefined),
  (u: URL) => (u.pathname === '/api/customers' ? D.CUSTOMERS : undefined),
  (u: URL) => { const m = u.pathname.match(/^\/api\/customers\/([^/]+)$/); return m ? D.CUSTOMERS.find((c) => c.id === m[1]) : undefined; },
  (u: URL) => (u.pathname === '/api/admin/events' ? D.EVENTS : undefined),
  (u: URL) => { const m = u.pathname.match(/^\/api\/admin\/events\/([^/]+)$/); return m ? D.EVENTS.find((e) => e.id === m[1]) : undefined; },
  (u: URL) => (/^\/api\/admin\/events\/[^/]+\/attendees$/.test(u.pathname) ? D.ATTENDEES : undefined),
  (u: URL) => (u.pathname === '/api/admin/venues' ? D.VENUES : undefined),
  (u: URL) => (u.pathname === '/api/sessions' ? D.SESSIONS : undefined),
  (u: URL) => (/^\/api\/sessions\/[^/]+\/host-live$/.test(u.pathname) ? D.HOST_LIVE : undefined),
  (u: URL) => (u.pathname === '/api/auth/join-code/issue' ? { code: '482913', expires_at: '2026-11-12T00:00:00Z' } : undefined),
  (u: URL, m: string) => (/^\/api\/sessions\/[^/]+$/.test(u.pathname) && m === 'GET' ? { ...D.SESSION_ENVELOPE, session: { ...D.SESSION_ENVELOPE.session, id: u.pathname.split('/').pop() } } : undefined),
  (u: URL) => (u.pathname === '/api/admin/articles' ? D.ARTICLES : undefined),
  (u: URL) => (u.pathname === '/api/collections' ? { collections: D.COLLECTIONS } : undefined),
  (u: URL) => {
    const m = u.pathname.match(/^\/api\/collections\/(col-\d)$/);
    if (!m) return undefined;
    const c: any = D.COLLECTIONS.find((x) => x.id === m[1]);
    const items = [1, 2, 4].map((n, i) => ({ id: `ci-${n}`, collection_id: c.id, product_id: `test-product-${n}`, position: i, item_note: i === 0 ? 'The one to start with.' : null, recommended_quantity: '50', recommended_price_usd: null, fixed_retail_price_usd: null, product_type: 'Oolong', product_name: `Oolong Test Tea 0${n}`, year: 2024, origin_country: 'Taiwan' }));
    return { collection: { ...c, account_id: 'acct-bali' }, items, publications: [] };
  },
  (u: URL) => (u.pathname === '/api/admin/contributors' ? { contributors: D.CONTRIBUTORS } : undefined),
  (u: URL) => (u.pathname === '/api/admin/customer-tasting-notes' ? D.TASTING_NOTES : undefined),
  (u: URL) => (/^\/api\/accounts\/[^/]+\/access$/.test(u.pathname) ? { members: [
    { user_id: 'test-admin-uid', email: 'admin@teajia.com', name: 'Test Admin', role: 'owner', bundles: ['catalog', 'stock', 'publish', 'gather', 'sell', 'members'], joined_at: '2026-01-02T00:00:00Z', status: 'active' },
    { user_id: 'u-kadek', email: 'kadek@example.invalid', name: 'Kadek Studio', role: 'member', bundles: ['stock', 'sell'], joined_at: '2026-05-02T00:00:00Z', status: 'active' },
    { user_id: 'u-lia', email: 'lia@example.invalid', name: 'Lia Host', role: 'member', bundles: ['gather', 'publish'], joined_at: '2026-08-11T00:00:00Z', status: 'active' },
  ] } : undefined),
  (u: URL) => (u.pathname === '/api/shipping-routes' ? D.ROUTES : undefined),
  (u: URL) => (u.pathname === '/api/accounts/acct-bali' ? { id: 'acct-bali', name: 'Teajia Bali', slug: 'teajia-bali', location_city: 'Ubud', location_country: 'Indonesia', timezone: 'Asia/Makassar', currency_default: 'IDR', whatsapp_number: '+62 811 0000 000', contact_email: 'shop@example.invalid', public_enabled: true, default_shipping_rate_per_kg: 85, default_shipping_rate_currency: 'Yuan' } : undefined),
];

for (const s of SIZES) {
  test(`rooms ${s.n}`, async ({ page }) => {
    await installAdmin(page, handlers);
    await page.setViewportSize({ width: s.w, height: s.h });
    await warm(page, '/admin/dashboard');

    const T = room(page, s, 'today');
    await T.at('/admin/dashboard', 'today', 'Today: what is waiting, sales by week, stock at cost.', undefined, true);

    const S = room(page, s, 'sales');
    await S.at('/admin/activity', 'requests', 'Sales opens on requests waiting.', undefined, true);
    await S.at('/admin/activity?tab=orders', 'orders', 'Sales, Orders list.', undefined, true);
    await S.at('/admin/activity?tab=orders', 'new-invoice', 'New invoice / quick invoice.', () => click(page, page.getByRole('button', { name: /\+ ?Invoice|New (invoice|order|sale)|Quick invoice/i }), 1500), true);
    await S.at('/admin/activity?tab=ledger', 'ledger', 'Sales ledger.', undefined, true);
    await S.at('/admin/activity?tab=wholesale', 'wholesale', 'Wholesale orders.', undefined, true);
    await S.at('/admin/activity?tab=log', 'log', 'Activity log.', undefined, true);
    await S.at('/admin/activity', 'request-opened', 'A request opened.', () => click(page, page.getByText('Ketut Arya'), 1500), true);

    const P = room(page, s, 'people');
    await P.at('/admin/people', 'customers', 'People, customers list.', undefined, true);
    await P.at('/admin/people?tab=suppliers', 'suppliers', 'People, suppliers.', undefined, true);
    await P.at('/admin/people?tab=tags', 'tags', 'People, contact tags.', undefined, true);
    await P.at('/admin/people/c-ayu', 'customer-profile', 'A customer profile.', undefined, true);
    await P.at('/admin/people/c-marc', 'customer-profile-wholesale', 'A wholesale customer profile.', undefined, true);
    await P.at('/admin/vendors/vendor-huang', 'supplier-profile', 'A supplier profile.', undefined, true);
    await P.at('/admin/people?tab=suppliers', 'supplier-opened', 'A supplier opened from the list.', () => click(page, page.getByText('Huang Wei'), 1500), true);
    await P.at('/admin/people', 'add-person', 'Add a person (the plus control).', () => click(page, page.getByRole('button', { name: /^(Add|New|Create)\b|Add (person|contact)/i }), 1200), true);

    const E = room(page, s, 'sessions');
    await E.at('/admin/events', 'list', 'Sessions (events) list.', undefined, true);
    await E.at('/admin/events/ev-1', 'event-opened', 'One event opened (first tab).', undefined, true);
    for (const tab of ['requests', 'attendees', 'tasting-notes', 'briefing', 'tea-menu', 'reminders', 'notifications', 'post-session', 'venue', 'interest']) {
      await E.at(`/admin/events/ev-1?tab=${tab}`, `event-tab-${tab}`, `Event, ${tab} tab (${tab === 'attendees' || tab === 'requests' ? 'guest management' : 'tab'}).`, undefined, true);
    }
    await E.at('/admin/events/ev-3', 'event-completed', 'A finished event.', undefined, true);
    await E.at('/admin/events', 'new-event', 'New event form.', () => click(page, page.getByRole('button', { name: /New|Create|Add/ }), 1500), true);
    await E.at('/admin/tasting-events', 'tastings', 'Tastings list (group tasting sessions).', undefined, true);
    await E.at('/admin/tasting-events/new', 'tasting-new', 'New tasting event form.', undefined, true);
    await E.at('/admin/tasting-events/ts-1', 'tasting-control-share', 'Tasting control room, Share tab (join code).', undefined, true);
    await E.at('/admin/tasting-events/ts-1/live', 'tasting-control-live', 'Tasting control room, Live matrix.', undefined, true);
    await E.at('/admin/venues', 'venues', 'Venues.', undefined, true);

    const G = room(page, s, 'tasting');
    await G.at('/join', 'guest-join-code', 'Guest screen: enter the six-digit join code.', undefined, true);
    await G.at('/join/482913', 'guest-join-code-link', 'Guest screen: opened from a join link.', undefined, true);
    await G.at('/session/ts-1', 'guest-session', 'A guest\'s view of a group tasting session.', undefined, true);

    const U = room(page, s, 'publish');
    await U.at('/admin/magazine', 'magazine', 'Publish opens on the magazine.', undefined, true);
    await U.at('/admin/collections', 'collections', 'Collections.', undefined, true);
    await U.at('/admin/collections/col-1', 'collection-edit', 'One collection open for editing.', undefined, true);
    await U.at('/admin/tasting-notes', 'guest-notes', 'Guest notes waiting to be published.', undefined, true);
    await U.at('/admin/wisdom', 'wisdom', 'Wisdom.', undefined, true);
    await U.at('/admin/contributors', 'tea-masters', 'Tea Masters.', undefined, true);

    const C = room(page, s, 'settings');
    await C.at('/admin/account-settings', 'settings', 'Settings, top.', undefined, true);
    await C.at('/admin/access', 'members', 'Members.', undefined, true);
    await C.at('/admin/audit', 'audit', 'Audit.', undefined, true);
    await C.at('/admin/currency', 'currency', 'Currency rates.', undefined, true);
    await C.at('/admin/mcp-tokens', 'mcp-tokens', 'Agent tokens.', undefined, true);
    await C.at('/account/fixes', 'site-fixes', 'Site fixes (incident ledger).', undefined, true);
  });
}
