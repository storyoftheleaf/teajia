import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';
import { createSeller, json, jun, mei, offer, openStore, request } from './helpers/personalSellerPilot';

// Only people Adrian approves may sell (2026-11-24). Unapproved: nothing of
// theirs is buyable or priced in public, and a tea they pour shows unpriced.
const databases: SqliteD1[] = [];
beforeEach(() => vi.stubGlobal('fetch', vi.fn(() => { throw new Error('No external services in this test'); })));
afterEach(() => { databases.splice(0).forEach(db => db.close()); vi.unstubAllGlobals(); });

const adrian = { userId: 'adrian', name: 'Adrian', accountId: 'platform-home' };

async function setup() {
  const db = new SqliteD1('migrations');
  databases.push(db);
  seedIdentity(db, { userId: 'adrian', accountId: 'platform-home', platformRole: 'platform_owner' });
  const seller = await createSeller(db, mei, false, false);
  await createSeller(db, jun, false, true);
  return { db, seller };
}

const approve = (db: SqliteD1, approved: boolean, actor = adrian) =>
  request(db, `/api/platform/users/${mei.userId}/seller-approval`, { actor, method: 'PUT', body: { approved } });

async function publicView(db: SqliteD1, slug: string, productId: string) {
  const store = await request(db, `/api/s/${slug}/products`);
  const product = await request(db, `/api/s/${slug}/products/${productId}`);
  const profile = await request(db, `/api/people/${mei.profile}`);
  const profileBody = profile.ok ? await profile.json() as { personal_store_slug?: string } : {};
  return {
    store: store.ok ? (await store.json() as { id: string }[]).map(row => row.id) : [],
    product: product.status,
    profileStore: profileBody.personal_store_slug ?? null,
  };
}

async function seedSit(db: SqliteD1, productId: string) {
  db.exec(`
    INSERT OR IGNORE INTO accounts (id, slug, name, status, public_enabled) VALUES ('host-shop', 'host-shop', 'Host Shop', 'active', 1);
    INSERT INTO contributor_accounts (contributor_id, account_id) VALUES ('${mei.profile}', 'host-shop');
    INSERT INTO events (id, account_id, slug, title, event_date, lifecycle_status, public_visibility, recap_status)
    VALUES ('sit', 'host-shop', 'courtyard', 'Tea in the courtyard', '2026-11-23', 'completed', 'public', 'published');
    INSERT INTO event_post_session (event_id, account_id, session_notes, tea_ledger)
    VALUES ('sit', 'host-shop', 'Notes', '${JSON.stringify({ served_teas: [{ id: 'st', name: 'Spring Mountain oolong', source: 'shop', product_id: productId }] })}');
    INSERT INTO event_contributors (id, event_id, account_id, contributor_id, role, is_public)
    VALUES ('credit', 'sit', 'host-shop', '${mei.profile}', 'lead_host', 1);
  `);
}

async function recapTea(db: SqliteD1) {
  const response = await request(db, '/api/public/sit-recaps/courtyard');
  const { recap } = await response.json() as { recap: { teas: Record<string, unknown>[] } };
  return recap.teas[0];
}

describe('only people Adrian approves may sell', () => {
  it('refuses an unapproved seller’s shop and offer with the calm sentence', async () => {
    const { db, seller } = await setup();
    const opening = await openStore(db, seller.actor);
    expect(opening.status).toBe(403);
    const body = await opening.json() as { error: string; code: string };
    expect(body.code).toBe('personal_seller_not_approved');
    expect(body.error).toMatch(/^Selling opens once Teajia has approved you/);
    const publish = await request(db, seller.offerPath, { actor: seller.actor, method: 'POST', body: offer });
    expect(publish.status).toBe(403);
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM products WHERE personal_offer_source_id IS NOT NULL AND account_id = ?')
      .get(seller.actor.accountId)).toEqual({ n: 0 });
  });

  it('lets only the platform owner approve or withdraw', async () => {
    const { db } = await setup();
    const junActor = { userId: jun.userId, name: jun.name, accountId: `${jun.userId}-home` };
    expect((await approve(db, true, junActor)).status).toBe(403);
    expect(db.sqlite.prepare('SELECT personal_seller_approved_at FROM accounts WHERE personal_inventory_user_id = ?').get(mei.userId))
      .toEqual({ personal_seller_approved_at: null });
    expect(await json(await approve(db, true))).toEqual({ ok: true, may_sell: true });
  });

  it('shows the offer everywhere once approved and takes it out of every public door on withdrawal', async () => {
    const { db, seller } = await setup();
    await json(await approve(db, true));
    await json(await openStore(db, seller.actor));
    const { product_id: productId } = await json<{ product_id: string }>(
      await request(db, seller.offerPath, { actor: seller.actor, method: 'POST', body: offer }), 201);
    await seedSit(db, productId);

    expect(await publicView(db, seller.slug, productId)).toEqual({ store: [productId], product: 200, profileStore: seller.slug });
    expect(await recapTea(db)).toMatchObject({ kind: 'tea', offer: { count: 'pack' } });

    await json(await approve(db, false));
    expect(await publicView(db, seller.slug, productId)).toEqual({ store: [], product: 404, profileStore: null });
    const tea = await recapTea(db);
    expect(tea).toMatchObject({ kind: 'tea', name: 'Spring Mountain oolong', href: null });
    expect(tea).not.toHaveProperty('offer');
    // Their stock and records stay as they were.
    expect(db.sqlite.prepare('SELECT stock_grams, personal_offer_withdrawn_at FROM products WHERE id = ?').get(productId))
      .toEqual({ stock_grams: 50, personal_offer_withdrawn_at: null });
    // And nothing of theirs can be ordered.
    const order = await request(db, '/api/inquiries', { method: 'POST', body: {
      source: 'website', store_slug: seller.slug, tracking_token: 'approval-gate-order-token-000000000001', ref_number: 'TJ-GATE',
      customer_name: 'Buyer', customer_contact: 'buyer@example.test', customer_location: 'Tokyo, Japan', currency: 'USD', total_estimate_usd: 25,
      items: [{ id: productId, name: offer.name, category: 'tea', storeSlug: seller.slug, quantityGrams: 50, packGrams: 50, packs: 1, pricePerGram: 0.5, totalPrice: 25 }],
    } });
    // The store door itself refuses it, before any product is priced.
    expect(order.status).toBe(404);
    expect(await order.json()).toEqual({ error: 'Store not found' });
  });
});

describe('approving a person before they open a Tea Chest', () => {
  const iris = { userId: 'iris', name: 'Iris', profile: 'iris-profile', destination: 'Synthetic Iris account 5150' };
  const approveIris = (db: SqliteD1, approved: boolean, actor = adrian) =>
    request(db, `/api/platform/users/${iris.userId}/seller-approval`, { actor, method: 'PUT', body: { approved } });

  async function fresh() {
    const db = new SqliteD1('migrations');
    databases.push(db);
    seedIdentity(db, { userId: 'adrian', accountId: 'platform-home', platformRole: 'platform_owner' });
    seedIdentity(db, { userId: iris.userId, accountId: `${iris.userId}-home`, publicEnabled: false });
    return db;
  }

  it('waits on the person and applies the moment their Tea Chest opens', async () => {
    const db = await fresh();
    expect(await json(await approveIris(db, true))).toEqual({ ok: true, may_sell: true });
    const seller = await createSeller(db, iris, false, false);
    expect(db.sqlite.prepare('SELECT personal_seller_approved_at IS NOT NULL AS approved FROM accounts WHERE id = ?').get(seller.actor.accountId))
      .toEqual({ approved: 1 });
    await json(await openStore(db, seller.actor));
    await json(await request(db, seller.offerPath, { actor: seller.actor, method: 'POST', body: offer }), 201);
  });

  it('withdrawn before the Tea Chest opens, it stays shut', async () => {
    const db = await fresh();
    await json(await approveIris(db, true));
    await json(await approveIris(db, false));
    const seller = await createSeller(db, iris, false, false);
    expect((await openStore(db, seller.actor)).status).toBe(403);
  });
});
