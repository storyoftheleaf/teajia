import { test } from '../../tests/fixtures';
import { go, warm, SIZES } from './lib';
import { click, room } from './steps';
import { installAdmin } from './mock';
import * as D from './rooms-data';

// Opened orders (they need the order's lines, payments and attribution) and the member's tasting journal.
const line = (id: string, pid: string, name: string, q: number, price: number) => ({ id, product_id: pid, product_name: name, custom_name: null, given_name: null, quantity: q, quantity_unit: 'g', price_at_sale: price });
const ITEMS: Record<string, unknown[]> = {
  'inv-1': [line('l1', 'test-product-2', 'Oolong Test Tea 02', 100, 0.48), line('l2', 'test-product-4', 'Shou Test Tea 04', 50, 0.4)],
  'inv-2': [line('l3', 'test-product-3', 'Sheng Test Tea 03', 300, 1.2), line('l4', 'test-product-6', 'White Test Tea 06', 200, 0.3)],
  'inv-3': [line('l5', 'test-product-1', 'Green Test Tea 01', 100, 0.34)],
};
const handlers = [
  (u: URL, m: string) => (u.pathname === '/api/invoices' && m === 'GET' ? D.INVOICES : undefined),
  (u: URL) => { const m = u.pathname.match(/^\/api\/invoices\/([^/]+)\/items$/); return m ? (ITEMS[m[1]] ?? []) : undefined; },
  (u: URL) => (/^\/api\/invoices\/[^/]+\/payments$/.test(u.pathname) ? [] : undefined),
  (u: URL) => { const m = u.pathname.match(/^\/api\/invoices\/([^/]+)\/attribution$/); return m ? { invoice_id: m[1], seller_name: 'Teajia Bali', payment_recipient_name: 'Teajia Bali', payment_recipient_kind: 'account', fulfilled_by_name: null, fulfilled_at: null, settlement_visibility: 'full', items: [] } : undefined; },
  (u: URL) => { const m = u.pathname.match(/^\/api\/invoices\/([^/]+)$/); return m ? D.INVOICES.find((i) => i.id === m[1]) : undefined; },
  (u: URL) => (u.pathname === '/api/customers' ? D.CUSTOMERS : undefined),
];

for (const s of SIZES) {
  test(`extras ${s.n}`, async ({ page }) => {
    await installAdmin(page, handlers);
    await page.setViewportSize({ width: s.w, height: s.h });
    await warm(page, '/admin/activity?tab=orders');
    const S = room(page, s, 'sales');
    const ORDERS = '/admin/activity?tab=orders';
    const eye = (n: number) => () => click(page, page.locator('button:has(svg.lucide-eye)').filter({ visible: true }).nth(n), 2000);
    await S.at(ORDERS, 'order-opened', 'An unpaid order opened from the list.', eye(0));
    await S.at(ORDERS, 'order-part-paid', 'A part-paid order opened.', eye(1));
    await S.at(ORDERS, 'order-filled', 'A paid and sent order opened.', eye(2));
    await S.at(ORDERS, 'order-actions', 'The ... actions on an order card.', () => click(page, page.getByRole('button', { name: /More|Actions/i }), 1200));
    await S.at(ORDERS, 'new-invoice', 'New invoice (+ Invoice).', () => click(page, page.getByText(/^\+?\s*Invoice$/i), 2000));

    // The tasting journal is a member page behind a lazy chunk; load it a few times before shooting.
    const G = room(page, s, 'tasting');
    for (let i = 0; i < 3; i++) await go(page, '/account/journal', 5000);
    await G.at('/account/journal', 'journal', 'Tasting journal (account).', undefined, true);
  });
}
