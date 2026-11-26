// Launch 5: what the journey in tests/launch-5.spec.ts needs, on top of the
// first table (first-table-fixture.mjs) and Ana the host (few-hosts-fixture.mjs).
//
// Fabricated data only, for the offline fixture shop. In the Bali sandbox shop:
//   - Tea credit for Ana. Mei's order "L5-GUEST" began from Ana's thank-you
//     (order_session_sources names Ana's finished table fh-event and Ana as
//     host): 100 g of the white at 0.5 USD a gram, Pending and unpaid. Once the
//     owner records its payment and fills it, Ana earns 10 percent of 50 USD.
//   - Ana's own open order "L5-ANA" in the same shop, 20 g of the white
//     (10 USD of tea), for her to ask to use the credit on.
//   - For the credit screens: two more of Mei's orders from Ana's thank-you,
//     "L5-GUEST-2" and "L5-GUEST-3" (50 USD each, so 5 USD of credit each once
//     paid and filled), one for each screen size, and Ana's second open order
//     "L5-ANA-2" (10 USD of tea) to use credit on from her credit page.
//   - The card for the table: a published public session ahead,
//     "A card for the table, test" (slug l5-card-test), with two teas of the
//     shop and one plain name on its menu.
// Nothing here opens anything: every Launch 5 route stays closed unless the
// sandbox starts with its switches on (see offline-fixtures.mjs).
import { firstTable } from './first-table-fixture.mjs';
import { fewHosts } from './few-hosts-fixture.mjs';

const BALI = 'acc_teajia_bali';

export const launch5 = {
  guestOrder: { invoiceId: 'l5-guest-order', number: 'L5-GUEST', inquiryId: 'l5-inquiry', lineId: 'l5-guest-line', totalUsd: 50 },
  hostOrder: { invoiceId: 'l5-ana-order', number: 'L5-ANA', customerId: 'l5-customer-ana', lineId: 'l5-ana-line', teaUsd: 10 },
  screenGuestOrders: ['l5-guest-order-2', 'l5-guest-order-3'],
  hostOrder2: { invoiceId: 'l5-ana-order-2', number: 'L5-ANA-2', lineId: 'l5-ana-line-2' },
  card: { eventId: 'l5-card-event', slug: 'l5-card-test', title: 'A card for the table, test' },
};

const l = launch5;
const ft = firstTable;
const fh = fewHosts;

export const launch5Statements = [
  `INSERT INTO inquiries (id, account_id, name, email, items, status, converted_invoice_id)
   VALUES ('${l.guestOrder.inquiryId}', '${BALI}', 'Mei Guest', '${ft.guestUser.email}', '[]', 'replied', '${l.guestOrder.invoiceId}')`,
  `INSERT INTO order_session_sources (inquiry_id, account_id, event_id, host_user_id)
   VALUES ('${l.guestOrder.inquiryId}', '${BALI}', '${fh.eventId}', '${fh.host.id}')`,
  `INSERT INTO invoices (id, account_id, invoice_number, customer_id, customer_name, status, payment_status, display_currency,
     shipping_cost_usd, inventory_deducted, created_at)
   VALUES ('${l.guestOrder.invoiceId}', '${BALI}', '${l.guestOrder.number}', 'ft-customer-mei', 'Mei Guest', 'Pending', 'unpaid',
     'USD', 0, 0, datetime('now', '-1 day'))`,
  `INSERT INTO invoice_line_items (id, invoice_id, account_id, product_id, quantity, quantity_unit, price_at_sale)
   VALUES ('${l.guestOrder.lineId}', '${l.guestOrder.invoiceId}', '${BALI}', '${ft.products.forSale}', 100, 'g', 0.5)`,
  // Ana as a customer of the shop, and her own open order.
  `INSERT INTO customers (id, account_id, name, email, user_id)
   VALUES ('${l.hostOrder.customerId}', '${BALI}', '${fh.host.name}', '${fh.host.email}', '${fh.host.id}')`,
  `INSERT INTO invoices (id, account_id, invoice_number, customer_id, customer_name, status, payment_status, display_currency,
     shipping_cost_usd, inventory_deducted, created_at)
   VALUES ('${l.hostOrder.invoiceId}', '${BALI}', '${l.hostOrder.number}', '${l.hostOrder.customerId}', '${fh.host.name}', 'Pending', 'unpaid',
     'USD', 0, 0, datetime('now'))`,
  `INSERT INTO invoice_line_items (id, invoice_id, account_id, product_id, quantity, quantity_unit, price_at_sale)
   VALUES ('${l.hostOrder.lineId}', '${l.hostOrder.invoiceId}', '${BALI}', '${ft.products.forSale}', 20, 'g', 0.5)`,
  // The credit screens' own orders (tests/launch-5.spec.ts, "credit screens").
  ...[2, 3].flatMap(n => [
    `INSERT INTO inquiries (id, account_id, name, email, items, status, converted_invoice_id)
     VALUES ('l5-inquiry-${n}', '${BALI}', 'Mei Guest', '${ft.guestUser.email}', '[]', 'replied', 'l5-guest-order-${n}')`,
    `INSERT INTO order_session_sources (inquiry_id, account_id, event_id, host_user_id)
     VALUES ('l5-inquiry-${n}', '${BALI}', '${fh.eventId}', '${fh.host.id}')`,
    `INSERT INTO invoices (id, account_id, invoice_number, customer_id, customer_name, status, payment_status, display_currency,
       shipping_cost_usd, inventory_deducted, created_at)
     VALUES ('l5-guest-order-${n}', '${BALI}', 'L5-GUEST-${n}', 'ft-customer-mei', 'Mei Guest', 'Pending', 'unpaid',
       'USD', 0, 0, datetime('now', '-1 day'))`,
    `INSERT INTO invoice_line_items (id, invoice_id, account_id, product_id, quantity, quantity_unit, price_at_sale)
     VALUES ('l5-guest-line-${n}', 'l5-guest-order-${n}', '${BALI}', '${ft.products.forSale}', 100, 'g', 0.5)`,
  ]),
  `INSERT INTO invoices (id, account_id, invoice_number, customer_id, customer_name, status, payment_status, display_currency,
     shipping_cost_usd, inventory_deducted, created_at)
   VALUES ('${l.hostOrder2.invoiceId}', '${BALI}', '${l.hostOrder2.number}', '${l.hostOrder.customerId}', '${fh.host.name}', 'Pending', 'unpaid',
     'USD', 0, 0, datetime('now', '-1 minute'))`,
  `INSERT INTO invoice_line_items (id, invoice_id, account_id, product_id, quantity, quantity_unit, price_at_sale)
   VALUES ('${l.hostOrder2.lineId}', '${l.hostOrder2.invoiceId}', '${BALI}', '${ft.products.forSale}', 20, 'g', 0.5)`,
  // The card for the table: a public session ahead, with its menu.
  `INSERT INTO events (id, account_id, slug, title, event_date, status, lifecycle_status, total_capacity, timezone, public_visibility)
   VALUES ('${l.card.eventId}', '${BALI}', '${l.card.slug}', '${l.card.title}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+10 days'),
     'active', 'published', 8, 'Asia/Makassar', 'public')`,
  `INSERT INTO event_tea_menu (id, account_id, event_id, product_id, custom_name, brew_order) VALUES
     ('l5-card-menu-1', '${BALI}', '${l.card.eventId}', '${ft.products.forSale}', NULL, 1),
     ('l5-card-menu-2', '${BALI}', '${l.card.eventId}', '${ft.products.notForSale}', NULL, 2),
     ('l5-card-menu-3', '${BALI}', '${l.card.eventId}', NULL, 'A roasted oolong from a friend', 3)`,
];
