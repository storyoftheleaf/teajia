import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';
import { createSeller, json, jun, mei, offer, openStore, request } from './helpers/personalSellerPilot';

const databases: SqliteD1[] = [];
const externalFetch = vi.fn(() => { throw new Error('Synthetic pilot cannot contact external services'); });
beforeEach(() => vi.stubGlobal('fetch', externalFetch));
afterEach(() => {
  databases.splice(0).forEach(db => db.close());
  vi.unstubAllGlobals();
  expect(externalFetch).not.toHaveBeenCalled();
  externalFetch.mockClear();
});

function database() {
  // Replay migrations so the proof exercises the actual tenant and ledger schema.
  const db = new SqliteD1('migrations');
  databases.push(db);
  return db;
}

type SellerFixture = Awaited<ReturnType<typeof createSeller>>;
type PublicProduct = { id: string; product_name: string; stock_grams: number };
type Tracking = {
  order: { status: string; payment_status: string };
  payment: { total_usd: number; outstanding_usd: number; paid_usd: number; pay_url: string | null; payment_deadline?: string };
};

async function publish(db: SqliteD1, seller: SellerFixture, asking = offer) {
  const response = await request(db, seller.offerPath, { actor: seller.actor, method: 'POST', body: asking });
  const text = await response.text();
  expect(response.ok, text).toBe(true);
  return (JSON.parse(text) as { product_id: string }).product_id;
}

function stock(db: SqliteD1, productId: string) {
  return db.sqlite.prepare('SELECT stock_grams FROM products WHERE id=?').get(productId)?.stock_grams;
}

function checkout(sellerSlug: string, tea: PublicProduct, suffix: string) {
  return {
    source: 'website', store_slug: sellerSlug, tracking_token: `synthetic-personal-seller-order-${suffix}`,
    ref_number: `TJ-PERSONAL-${suffix}`, customer_name: 'Example Buyer', customer_contact: 'buyer@example.test',
    customer_location: 'Tokyo, Japan', currency: 'USD', total_estimate_usd: 25,
    items: [{ id: tea.id, name: tea.product_name, category: 'tea', storeSlug: sellerSlug,
      quantityGrams: 50, packGrams: 50, packs: 1, pricePerGram: 0.5, totalPrice: 25 }],
  };
}

const submit = (db: SqliteD1, body: ReturnType<typeof checkout>) =>
  request(db, '/api/inquiries', { method: 'POST', body });

describe('personal seller Stock, checkout and Sales', () => {
  it('buys a named seller’s published 50 g offer and records a single 100% payment to that seller', async () => {
    const db = database();
    const seller = await createSeller(db, mei);
    const other = await createSeller(db, jun);
    const productId = await publish(db, seller);
    const otherProductId = await publish(db, other);
    const storePath = `/api/s/${seller.slug}/products`;
    const payPath = `/api/public/people/${mei.profile}/payment-methods`;
    const profilePath = `/api/people/${mei.profile}`;
    const person = await json<{ personal_store_slug: string }>(await request(db, profilePath));
    expect(person).toMatchObject({ display_name: mei.name, personal_store_slug: seller.slug });
    const otherPerson = await json(await request(db, `/api/people/${jun.profile}`));
    expect(otherPerson).toMatchObject({ display_name: jun.name, personal_store_slug: other.slug });
    const products = await json<PublicProduct[]>(await request(db, `/api/s/${person.personal_store_slug}/products`));
    expect(products).toHaveLength(1);
    const [tea] = products;
    expect(tea).toMatchObject({
      id: productId, product_name: offer.name, stock_grams: 50,
      piece_weight_g: 50, sold_in_whole_units: 1, exact_pack_price_usd: 25,
    });
    const detailPath = `${storePath}/${tea.id}`;
    expect(await json(await request(db, detailPath))).toMatchObject({ id: tea.id, stock_grams: 50 });
    expect(JSON.stringify([person, tea])).not.toMatch(/supplier-only|Private spring holding|cost_amount|account_identifier/);
    expect((await request(db, `${storePath}/${seller.holdingId}`)).status).toBe(404);
    expect((await request(db, `${storePath}/${otherProductId}`)).status).toBe(404);
    expect((await request(db, `/api/s/${other.slug}/products/${tea.id}`)).status).toBe(404);
    expect((await request(db, '/api/products')).status).toBe(401);
    expect((await request(db, '/api/invoices')).status).toBe(401);
    expect(await json(await request(db, '/api/products', { actor: seller.actor }))).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: seller.holdingId, stock_grams: 100 })]),
    );
    expect((await request(db, '/api/products', { actor: { ...other.actor, accountId: seller.actor.accountId } })).status).toBe(403);
    const viewer = { userId: 'seller-viewer', name: 'Store viewer', accountId: seller.actor.accountId };
    seedIdentity(db, { userId: viewer.userId, accountId: viewer.accountId, role: 'viewer', bundles: [] });
    expect((await request(db, '/api/products', { actor: viewer })).status).toBe(403);
    expect((await request(db, '/api/invoices', { actor: viewer })).status).toBe(403);
    expect((await request(db, seller.offerPath, { actor: viewer, method: 'DELETE' })).status).toBe(403);
    seedIdentity(db, { userId: 'platform-operator', accountId: 'operator-home', platformRole: 'platform_admin' });
    const operator = { userId: 'platform-operator', name: 'Platform operator', accountId: seller.actor.accountId };
    expect((await request(db, '/api/products', { actor: operator })).status).toBe(403);
    expect((await request(db, '/api/invoices', { actor: operator })).status).toBe(403);
    expect(await json(await request(db, '/api/platform/all-stock', {
      actor: { ...operator, accountId: 'operator-home' },
    }))).toEqual({ stock: [] });
    expect(await json(await request(db, payPath), 403)).toMatchObject({ code: 'pay_private' });
    expect(await json(await request(db, payPath, { actor: other.actor }), 403)).toMatchObject({ code: 'pay_private' });
    expect((await submit(db, checkout(other.slug, tea, 'wrong-store'))).status).toBe(400);

    const body = checkout(person.personal_store_slug, tea, 'standard-cart');
    const { invoice_id: invoiceId } = await json<{ invoice_id: string }>(await submit(db, body), 201);
    expect(await json(await submit(db, body))).toMatchObject({ invoice_id: invoiceId, idempotent: true });
    const trackingPath = `/api/inquiries/${body.tracking_token}`;
    const invoicePath = `/api/invoices/${invoiceId}`;
    const sales = await json(await request(db, '/api/invoices', { actor: seller.actor }));
    expect(sales).toEqual([expect.objectContaining({
      id: invoiceId, status: 'Draft', sold_by_user_id: mei.userId, payment_recipient_user_id: mei.userId,
    })]);
    expect(await json(await request(db, '/api/invoices', { actor: other.actor }))).toEqual([]);
    expect((await request(db, invoicePath, { actor: other.actor, method: 'PUT', body: { status: 'Pending' } })).status).toBe(404);
    expect(await json<Tracking>(await request(db, trackingPath))).toMatchObject({
      order: { status: 'Draft' }, payment: { total_usd: 25, pay_url: null },
    });

    await json(await request(db, invoicePath, { actor: seller.actor, method: 'PUT', body: { status: 'Pending' } }));
    const hold = db.sqlite.prepare('SELECT product_id,held_grams FROM stock_holds WHERE invoice_id=?').all(invoiceId);
    expect(hold).toEqual([{ product_id: productId, held_grams: 50 }]);
    expect(stock(db, productId)).toBe(50);
    expect((await request(db, seller.offerPath, { actor: seller.actor, method: 'DELETE' })).status).toBe(409);

    const pending = await json<Tracking>(await request(db, trackingPath));
    expect(pending).toMatchObject({
      order: { status: 'Pending', payment_status: 'unpaid' },
      payment: { total_usd: 25, outstanding_usd: 25, payment_deadline: expect.any(String) },
    });
    const payUrl = new URL(pending.payment.pay_url!);
    expect(payUrl.pathname).toBe(`/people/${mei.profile}/pay`);
    expect(payUrl.searchParams.get('amount')).toBe('25.00');
    const methodsResponse = await request(db, `${payPath}${payUrl.search}`);
    expect(await json(methodsResponse)).toMatchObject({
      payment_methods: [{ recipient_name: mei.name, account_identifier: mei.destination }],
    });
    expect((await request(db, `/api/public/people/${jun.profile}/payment-methods${payUrl.search}`)).status).toBe(403);
    const payment = { amount_usd: 25, method_label: 'Bank transfer', request_id: 'synthetic-confirm-pilot-payment' };
    expect((await request(db, `${invoicePath}/payments`, { actor: other.actor, method: 'POST', body: payment })).status).toBe(404);
    const recordPayment = () => request(db, `${invoicePath}/payments`, { actor: seller.actor, method: 'POST', body: payment });
    const first = await json<{ payment_id: string }>(await recordPayment(), 201);
    expect(first).toMatchObject({ payment_status: 'paid', stock: { state: 'deducted' } });
    expect(await json(await recordPayment())).toMatchObject({
      payment_id: first.payment_id, idempotent: true, stock: { state: 'already_deducted' },
    });
    expect(await json(await submit(db, body))).toMatchObject({ invoice_id: invoiceId, idempotent: true });

    expect(stock(db, productId)).toBe(0);
    expect(stock(db, seller.holdingId)).toBe(100);
    expect(stock(db, otherProductId)).toBe(50);
    expect(db.sqlite.prepare(`SELECT delta,balance_after,reason FROM stock_ledger
      WHERE source_invoice_id=?`).all(invoiceId)).toEqual([{ delta: -50, balance_after: 0, reason: 'PAYMENT_CONFIRMED' }]);
    expect(db.sqlite.prepare('SELECT amount_usd,status FROM invoice_payments WHERE invoice_id=?').all(invoiceId))
      .toEqual([{ amount_usd: 25, status: 'confirmed' }]);
    expect(db.sqlite.prepare(`SELECT stock_owner_user_id,seller_user_id,gross_amount,owner_amount,seller_amount
      FROM sales_settlements WHERE invoice_id=?`).all(invoiceId))
      .toEqual([{ stock_owner_user_id: mei.userId, seller_user_id: mei.userId, gross_amount: 25, owner_amount: 25, seller_amount: 0 }]);
    expect(await json<Tracking>(await request(db, trackingPath))).toMatchObject({
      order: { payment_status: 'paid' }, payment: { paid_usd: 25, outstanding_usd: 0, pay_url: null },
    });
    expect(await json(await request(db, storePath))).toEqual([]);
    expect(await json(await request(db, profilePath))).not.toHaveProperty('personal_store_slug');
    expect(await json(await request(db, seller.offerPath, { actor: seller.actor, method: 'DELETE' }))).toMatchObject({ restored_grams: 0 });
    expect((await request(db, detailPath)).status).toBe(404);
    expect(stock(db, seller.holdingId)).toBe(100);

    const cancel = () => request(db, '/api/rpc/cancel-invoice', {
      actor: seller.actor, method: 'POST', body: { invoice_id: invoiceId },
    });
    expect(await json(await cancel())).toMatchObject({ success: true, refund_required: true });
    expect(await json(await cancel())).toMatchObject({ success: true, idempotent: true, refund_required: true });
    expect(stock(db, seller.holdingId)).toBe(150);
    expect(stock(db, productId)).toBe(0);
    expect((await request(db, detailPath)).status).toBe(404);
    expect(db.sqlite.prepare(`SELECT product_id,delta,balance_after FROM stock_ledger
      WHERE source_invoice_id=? AND reason='CANCELLATION_RETURN'`).all(invoiceId))
      .toEqual([{ product_id: seller.holdingId, delta: 50, balance_after: 150 }]);
  });

  it('restores an unsold fractional-price offer to its private source and rejects stale checkout', async () => {
    const db = database();
    const seller = await createSeller(db, mei);
    const offerId = await publish(db, seller, { ...offer, price_amount: 25.37 });
    const path = `/api/s/${seller.slug}/products/${offerId}`;
    const tea = await json<PublicProduct>(await request(db, path));
    expect(tea).toMatchObject({ id: offerId, stock_grams: 50, exact_pack_price_usd: 25.37 });
    expect(stock(db, seller.holdingId)).toBe(100);
    const inquiry = checkout(seller.slug, tea, 'fractional-price');
    const { invoice_id: invoiceId } = await json<{ invoice_id: string }>(await submit(db, inquiry), 201);
    const line = db.sqlite.prepare('SELECT quantity,price_at_sale FROM invoice_line_items WHERE invoice_id=?').get(invoiceId)!;
    expect(Number(line.quantity) * Number(line.price_at_sale)).toBeCloseTo(25.37);
    expect(await json(await request(db, seller.offerPath, { actor: seller.actor, method: 'DELETE' }))).toMatchObject({ restored_grams: 50 });
    expect(stock(db, seller.holdingId)).toBe(150);
    expect((await request(db, path)).status).toBe(404);
    expect((await submit(db, checkout(seller.slug, tea, 'withdrawn'))).status).toBe(400);
    expect((await request(db, `/api/invoices/${invoiceId}`, {
      actor: seller.actor, method: 'PUT', body: { status: 'Pending' },
    })).status).toBe(409);
    expect(await json<Tracking>(await request(db, `/api/inquiries/${inquiry.tracking_token}`))).toMatchObject({
      order: { status: 'Draft' }, payment: { pay_url: null },
    });

    expect(await json(await request(db, seller.offerPath, { actor: seller.actor, method: 'DELETE' })))
      .toMatchObject({ restored_grams: 0 });
    expect(stock(db, seller.holdingId)).toBe(150);
    const replacementId = await publish(db, seller);
    expect(replacementId).not.toBe(offerId);
    expect(stock(db, seller.holdingId)).toBe(100);
    expect((await request(db, path)).status).toBe(404);
    expect(await json(await request(db, seller.offerPath, { actor: seller.actor, method: 'DELETE' })))
      .toMatchObject({ restored_grams: 50 });
    expect(stock(db, seller.holdingId)).toBe(150);
  });

  it('requires the seller’s own payable profile even if another seller hosts the storefront', async () => {
    const db = database();
    const seller = await createSeller(db, mei, false);
    await createSeller(db, jun);
    db.sqlite.prepare('INSERT INTO contributor_accounts (contributor_id,account_id,is_host) VALUES (?,?,1)')
      .run(jun.profile, seller.actor.accountId);
    const setMeiBankPublished = (flag: number) =>
      db.sqlite.prepare('UPDATE payment_methods SET is_published=? WHERE contributor_id=?').run(flag, mei.profile);
    setMeiBankPublished(0);
    expect(await json(await openStore(db, seller.actor), 409)).toMatchObject({
      code: 'store_has_no_payment_method',
    });
    setMeiBankPublished(1);
    const setMeiPageTier = (tier: string) =>
      db.sqlite.prepare('UPDATE contributors SET page_tier=? WHERE id=?').run(tier, mei.profile);
    setMeiPageTier('family');
    expect(await json(await openStore(db, seller.actor), 409)).toMatchObject({
      code: 'store_recipient_profile_unpublished',
    });
    setMeiPageTier('master');
    await json(await openStore(db, seller.actor));
    const productId = await publish(db, seller);
    const tea = await json<PublicProduct>(await request(db, `/api/s/${seller.slug}/products/${productId}`));
    setMeiBankPublished(0);
    expect(await json(await request(db, `/api/s/${seller.slug}`))).toMatchObject({ can_be_paid: false });
    expect(await json(await submit(db, checkout(seller.slug, tea, 'wrong-recipient')), 409))
      .toMatchObject({ code: 'store_has_no_payment_method' });
    expect(await json(await request(db, '/api/invoices', { actor: seller.actor }))).toEqual([]);
  });
});
