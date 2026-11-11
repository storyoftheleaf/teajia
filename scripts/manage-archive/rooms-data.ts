// Sample people, orders, sessions and pages for the rooms other than Curate and Stock. All invented.

const day = (n: number) => new Date(Date.UTC(2026, 10, 11) - n * 86400000).toISOString();

const CUSTOMERS_SHAPED = [
  { id: 'c-ayu', type: 'customer', name: 'Ayu Pratama', company: '', contacts: [{ id: 'k1', type: 'whatsapp', value: '+62 811 0000 101', label: 'WhatsApp', isPrimary: true }], whatsapp: '+62 811 0000 101', city: 'Ubud', country: 'Indonesia', preferredCurrency: 'IDR', tags: ['retail', 'vip'], contact_tags: ['gong fu'], createdAt: day(200), updatedAt: day(3), orderCount: 6, totalSpentUSD: 412.5, lastOrderDate: day(3), eventCount: 2 },
  { id: 'c-marc', type: 'customer', name: 'Marc Dubois', company: 'Cafe Lune', contacts: [{ id: 'k2', type: 'email', value: 'marc@example.invalid', label: 'Email', isPrimary: true }], email: 'marc@example.invalid', city: 'Canggu', country: 'Indonesia', preferredCurrency: 'USD', tags: ['wholesale'], contact_tags: [], createdAt: day(150), updatedAt: day(9), orderCount: 3, totalSpentUSD: 980, lastOrderDate: day(9), eventCount: 0 },
  { id: 'c-sita', type: 'customer', name: 'Sita Wulandari', company: '', contacts: [{ id: 'k3', type: 'whatsapp', value: '+62 812 0000 303', label: 'WhatsApp', isPrimary: true }], whatsapp: '+62 812 0000 303', city: 'Denpasar', country: 'Indonesia', preferredCurrency: 'IDR', tags: ['friend'], contact_tags: ['new'], createdAt: day(30), updatedAt: day(1), orderCount: 1, totalSpentUSD: 38, lastOrderDate: day(20), eventCount: 1 },
  { id: 'vendor-huang', type: 'supplier', name: 'Huang Wei', company: 'Huang Tea Trading', contacts: [{ id: 'k4', type: 'whatsapp', value: '+86 138 0000 0004', label: 'WeChat', isPrimary: true }], city: 'Guangzhou', country: 'China', preferredCurrency: 'Yuan', tags: ['vendor'], contact_tags: [], createdAt: day(400), updatedAt: day(12), orderCount: 0, totalSpentUSD: 0 },
  { id: 'vendor-chen', type: 'supplier', name: 'Chen Family', company: '', contacts: [{ id: 'k5', type: 'whatsapp', value: '+886 900 000 005', label: 'LINE', isPrimary: true }], city: 'Chiayi', country: 'Taiwan', preferredCurrency: 'NT', tags: ['vendor'], contact_tags: [], createdAt: day(380), updatedAt: day(20), orderCount: 0, totalSpentUSD: 0 },
  { id: 'vendor-lin', type: 'supplier', name: 'Lin Mountain', company: '', contacts: [], city: 'Fuding', country: 'China', preferredCurrency: 'USD', tags: ['vendor'], contact_tags: [], createdAt: day(300), updatedAt: day(40), orderCount: 0, totalSpentUSD: 0 },
];

const pay = (total: number, paid: number) => ({ recipient_slug: 'teajia-bali', recipient_name: 'Teajia Bali', pay_url: paid >= total ? null : '/pay/teajia-bali', has_methods: true, total_usd: total, paid_usd: paid, outstanding_usd: Math.max(0, total - paid), claims_pending: 0, tea_line_count: 2 });
export const INVOICES = [
  { id: 'inv-1', invoice_number: 'T-1042', customer_name: 'Ayu Pratama', customer_id: 'c-ayu', customer_whatsapp: '+62 811 0000 101', display_currency: 'USD', shipping_cost_usd: 6, status: 'Pending', payment_status: 'unpaid', inventory_deducted: false, created_at: day(1), payment: pay(58, 0) },
  { id: 'inv-2', invoice_number: 'T-1041', customer_name: 'Marc Dubois', customer_id: 'c-marc', display_currency: 'USD', shipping_cost_usd: 18, status: 'Pending', payment_status: 'partial', inventory_deducted: false, created_at: day(4), payment: pay(420, 200) },
  { id: 'inv-3', invoice_number: 'T-1040', customer_name: 'Sita Wulandari', customer_id: 'c-sita', display_currency: 'IDR', shipping_cost_usd: 4, status: 'Filled', payment_status: 'paid', payment_method: 'Bank transfer', payment_date: day(19), fulfilled_at: day(18), inventory_deducted: true, tracking_number: 'JNE 00112233', created_at: day(20), payment: pay(38, 38) },
  { id: 'inv-4', invoice_number: 'T-1039', customer_name: 'Ayu Pratama', customer_id: 'c-ayu', display_currency: 'USD', status: 'Draft', payment_status: 'unpaid', inventory_deducted: false, created_at: day(6), payment: pay(0, 0) },
];

const inq = (id: string, ref: string, name: string, status: string, ago: number, items: unknown[], total: number, message: string | null) => ({ id, account_id: 'acct-bali', name, email: '', phone: '+62 813 0000 404', items, total_usd: total, currency: 'USD', message, source: 'shop', ref_number: ref, status, created_at: day(ago), updated_at: day(ago), converted_invoice_id: null });
export const INQUIRIES = {
  inquiries: [
    inq('inq-1', 'REQ-2231', 'Ketut Arya', 'new', 0, [{ name: 'Yiwu Gushu Spring', quantityGrams: 100, pricePerGram: 0.9, totalPrice: 90 }], 90, 'Is the 2021 Yiwu still available?'),
    inq('inq-2', 'REQ-2230', 'Dewi Larasati', 'seen', 2, [{ name: 'Moonlight White', quantityGrams: 50, pricePerGram: 0.15, totalPrice: 7.5 }], 7.5, null),
    inq('inq-3', 'REQ-2226', 'Komang Ayu', 'replied', 9, [{ name: 'Alishan High Mountain', quantityGrams: 150, pricePerGram: 0.48, totalPrice: 72 }], 72, 'Gift for my mother.'),
  ],
};

export const ATTENTION = {
  items: [
    { kind: 'request', id: 'inq-1', label: 'Request from Ketut Arya', meta: 'waiting 3 hours', waiting_since: day(0), href: '/admin/activity', reference: 'REQ-2231' },
    { kind: 'claim', id: 'inv-2', label: 'Payment reported on T-1041, Marc Dubois', meta: 'waiting 2 days', waiting_since: day(2), href: '/admin/activity?tab=orders', reference: 'T-1041' },
    { kind: 'unsent', id: 'inv-3', label: 'T-1040 is paid and not yet sent', meta: 'waiting 5 days', waiting_since: day(5), href: '/admin/activity?tab=orders', reference: 'T-1040' },
  ],
  counts: { requests: 1, unpriced: 0, claims: 1, unsent: 1, refunds: 0 },
};
export const REVENUE = {
  weekly_revenue: Array.from({ length: 12 }, (_, i) => ({ week: `W${i + 40}`, revenue: [120, 80, 210, 150, 90, 300, 260, 140, 180, 420, 310, 240][i], order_count: 2 + (i % 4) })),
  inventory_age_alerts: [{ id: 'test-product-3', product_name: 'Sheng Test Tea 03', stock_grams: 0, last_sold_at: null }, { id: 'test-product-8', product_name: 'Red Test Tea 08', stock_grams: 120, last_sold_at: day(140) }],
};
export const RFM = { top10: [], lapsed: [{ id: 'c-sita', name: 'Sita Wulandari' }], new_this_month: [{ id: 'c-ayu', name: 'Ayu Pratama' }] };

export const EVENTS = [
  { id: 'ev-1', slug: 'autumn-gongfu-night', title: 'Autumn Gong Fu Night', subtitle: 'Six aged teas, one table', description: 'An evening of aged teas poured gong fu style.', event_date: '2026-11-21T11:00:00Z', total_capacity: 8, claim_window_minutes: 120, timezone: 'Asia/Makassar', status: 'active', location_name: 'The Tea Room, Ubud', address_text: 'Jl. Contoh 12, Ubud', requires_approval: 1, confirmed_count: 5, waitlist_count: 1, requested_count: 2, interest_count: 3, public_visibility: 'public', lifecycle_status: 'published', format: 'public_tasting', created_at: day(30), updated_at: day(2) },
  { id: 'ev-2', slug: 'sunday-sheng-session', title: 'Sunday Sheng Session', description: '', event_date: '2026-12-06T08:00:00Z', total_capacity: 6, claim_window_minutes: 120, timezone: 'Asia/Makassar', status: 'draft', location_name: 'Studio', requires_approval: 0, confirmed_count: 0, format: 'private_tasting', lifecycle_status: 'draft', created_at: day(5), updated_at: day(5) },
  { id: 'ev-3', slug: 'oolong-evening', title: 'Oolong Evening', description: 'A finished session.', event_date: '2026-10-10T11:00:00Z', total_capacity: 10, claim_window_minutes: 120, timezone: 'Asia/Makassar', status: 'completed', location_name: 'The Tea Room, Ubud', requires_approval: 1, confirmed_count: 9, format: 'public_tasting', lifecycle_status: 'completed', created_at: day(60), updated_at: day(30) },
];
const att = (id: string, name: string, status: string, extra: Record<string, unknown> = {}) => ({ id, event_id: 'ev-1', full_name: name, phone_number: '+62 811 000 0' + id.slice(-2), email: null, contact_method: 'whatsapp', access_tier: 'standard', status, magic_token: 'tok-' + id, photo_consent: 1, notes: '', created_at: day(3), ...extra });
export const PENDING_ATTENDEES_EXTRA = { event_title: 'Autumn Gong Fu Night', event_date: '2026-11-21T11:00:00Z' };
export const ATTENDEES = [
  att('a01', 'Ayu Pratama', 'confirmed', { access_tier: 'golden' }),
  att('a02', 'Sita Wulandari', 'confirmed'),
  att('a03', 'Marc Dubois', 'confirmed', { guest_requests: JSON.stringify([{ nameHint: 'my partner', approved: true }]) }),
  att('a04', 'Ketut Arya', 'requested', { guest_requests: JSON.stringify([{ nameHint: 'a friend new to tea', approved: null }]), notes: 'First time at a gong fu session.' }),
  att('a05', 'Dewi Larasati', 'requested'),
  att('a06', 'Putu Adi', 'waitlist', { waitlist_position: 1 }),
];
export const VENUES = [{ id: 'v-1', name: 'The Tea Room, Ubud', address: 'Jl. Contoh 12, Ubud', areaHint: 'Central Ubud', photos: [], spaces: [{ id: 's-1', venueId: 'v-1', name: 'Main table', capacity: 8, photos: [], sortOrder: 0, createdAt: day(100), updatedAt: day(100) }], createdAt: day(100), updatedAt: day(10) }];

export const SESSIONS = {
  sessions: [
    { id: 'ts-1', title: 'Friday aged sheng flight', status: 'active', created_at: day(1), member_count: 4, tea_count: 3 },
    { id: 'ts-2', title: 'Alishan spring comparison', status: 'completed', created_at: day(14), completed_at: day(14), member_count: 6, tea_count: 4 },
  ],
};
export const TS_TEAS = [
  { id: 'st-1', tea_name: 'Yiwu Gushu Spring', tea_metadata: { name: 'Yiwu Gushu Spring', type: 'Sheng', year: '2021' }, position: 0 },
  { id: 'st-2', tea_name: 'Aged Palace Tea', tea_metadata: { name: 'Night Palace', type: 'Shou', year: '2009' }, position: 1 },
  { id: 'st-3', tea_name: 'Oil-Paper Tea Brick', tea_metadata: { name: 'Oil-Paper Tea Brick', type: 'Dark', year: '1980s' }, position: 2 },
];
export const TS_MEMBERS = [{ user_id: 'u1', name: 'Ayu', user_name: 'Ayu' }, { user_id: 'u2', name: 'Marc', user_name: 'Marc' }, { user_id: 'u3', name: 'Sita', user_name: 'Sita' }];
export const SESSION_ENVELOPE = { session: { id: 'ts-1', title: 'Friday aged sheng flight', status: 'active', created_by_user_id: 'test-admin-uid', account_id: 'acct-bali' }, teas: TS_TEAS, members: TS_MEMBERS, my_verdicts: [{ session_tea_id: 'st-1', verdict: 'love', notes: 'Bright and sweet.', tasting_data: { quality: 8, body: ['silky'], flavor: ['honey'] } }] };
export const HOST_LIVE = {
  session: { id: 'ts-1', status: 'active', title: 'Friday aged sheng flight' }, teas: TS_TEAS, members: TS_MEMBERS,
  verdicts: [
    { user_id: 'u1', session_tea_id: 'st-1', verdict: 'love', tasting_data: { quality: 9, wantToPurchase: true } },
    { user_id: 'u1', session_tea_id: 'st-2', verdict: 'like', tasting_data: { quality: 7 } },
    { user_id: 'u2', session_tea_id: 'st-1', verdict: 'like', tasting_data: { quality: 7 } },
    { user_id: 'u2', session_tea_id: 'st-3', verdict: 'neutral', tasting_data: { quality: 5 } },
    { user_id: 'u3', session_tea_id: 'st-2', verdict: 'love', tasting_data: { quality: 8, wantToPurchase: true } },
  ],
  progress: [{ user_id: 'u1', completed: 2, total: 3 }, { user_id: 'u2', completed: 2, total: 3 }, { user_id: 'u3', completed: 1, total: 3 }],
};

export const ARTICLES = [
  { id: 'ar-1', slug: 'why-aged-sheng', title: 'Why aged sheng tastes of the cellar', status: 'published', category: 'Field Notes', tags: [], author_name: 'Adrian', blocks: [], created_at: day(40), updated_at: day(10), published_at: day(10) },
  { id: 'ar-2', slug: 'alishan-spring-notes', title: 'Alishan, spring notes', status: 'draft', category: 'Field Notes', tags: [], author_name: 'Adrian', blocks: [], created_at: day(6), updated_at: day(2) },
  { id: 'ar-3', slug: 'the-oil-paper-brick', title: 'The oil-paper brick', status: 'draft', category: 'Craft', tags: [], author_name: 'Adrian', blocks: [], created_at: day(3), updated_at: day(3) },
];
export const COLLECTIONS = [
  { id: 'col-1', title: 'Autumn shelf', note: 'Six teas for cooler evenings.', hero_image_url: null, status: 'published', curator_display_name: 'Adrian', created_at: day(20), updated_at: day(4), item_count: 6, active_publication_count: 1, last_published_at: day(4), thumbnails: [] },
  { id: 'col-2', title: 'Gifts under $40', note: null, hero_image_url: null, status: 'draft', curator_display_name: 'Adrian', created_at: day(8), updated_at: day(8), item_count: 3, active_publication_count: 0, last_published_at: null, thumbnails: [] },
];
export const CONTRIBUTORS = [
  { id: 'chen', display_name: 'Chen Wei', role: 'Tea Master', is_published: 1, account_id: 'acct-bali', created_at: day(90), updated_at: day(5), beginnings: 'Third-generation grower in Chiayi.', links: [], articles: [], featured_in: [], products: [] },
  { id: 'lin', display_name: 'Lin Mei', role: 'Writer', is_published: 0, account_id: 'acct-bali', created_at: day(40), updated_at: day(40), beginnings: '', links: [], articles: [], featured_in: [], products: [] },
];
export const TASTING_NOTES = [
  { journalEntryId: 'j-1', noteKey: 'n1', productId: 'test-product-2', productName: 'Oolong Test Tea 02', authorUserId: 'u1', authorName: 'Ayu', text: 'Creamy, then orchid on the long finish.', writtenAt: day(2), status: 'open' },
  { journalEntryId: 'j-2', noteKey: 'n2', productId: 'test-product-4', productName: 'Shou Test Tea 04', authorUserId: 'u2', authorName: 'Marc', text: 'Earthy and calm, a good evening tea.', writtenAt: day(5), status: 'open' },
  { journalEntryId: 'j-3', noteKey: 'n3', productId: 'test-product-1', productName: 'Green Test Tea 01', authorUserId: 'u3', authorName: 'Sita', text: 'Grassy and bright.', writtenAt: day(30), status: 'promoted' },
];
export const ROUTES = [
  { id: 'r1', carrier: 'Bali Air Cargo', destination: 'Teajia Bali', rate_per_kg: 85, rate_currency: 'Yuan', packing_percent: 35, billing_step_kg: 1, minimum_kg: null, learned: null, mode: 'air' },
];
export const WHOLESALE = [{ id: 'wo-1', status: 'draft', partner_name: 'Cafe Lune', total_usd: 640, created_at: day(3), item_count: 5 }];

// The list endpoint sends raw rows: snake_case, with the joined figures.
export const CUSTOMERS = CUSTOMERS_SHAPED.map((c: any) => ({
  id: c.id, type: c.type, name: c.name, company: c.company, email: c.email, whatsapp: c.whatsapp, city: c.city, country: c.country,
  preferred_currency: c.preferredCurrency, tags: c.tags, contacts: c.contacts, contact_tags: c.contact_tags, created_at: c.createdAt, updated_at: c.updatedAt,
  order_count: c.orderCount, total_spent_usd: c.totalSpentUSD, last_order_date: c.lastOrderDate, event_count: c.eventCount,
}));
