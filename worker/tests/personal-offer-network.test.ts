import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';
import { createSeller, json, mei, offer, openStore, request } from './helpers/personalSellerPilot';

// Personal offers never appear in the wholesale network catalogue other shops
// list from (Adrian, 2026-11-25: "No, keep them out").
const databases: SqliteD1[] = [];
beforeEach(() => vi.stubGlobal('fetch', vi.fn(() => { throw new Error('No external services in this test'); })));
afterEach(() => { databases.splice(0).forEach(db => db.close()); vi.unstubAllGlobals(); });

const shop = { userId: 'other-owner', name: 'Other', accountId: 'other-shop' };

async function published() {
  const db = new SqliteD1('migrations');
  databases.push(db);
  seedIdentity(db, { userId: shop.userId, accountId: shop.accountId, bundles: ['catalog', 'sell'] });
  const seller = await createSeller(db, mei);
  await json(await openStore(db, seller.actor)).catch(() => undefined);
  const { product_id: productId } = await json<{ product_id: string }>(
    await request(db, seller.offerPath, { actor: seller.actor, method: 'POST', body: offer }), 201);
  const profile = db.sqlite.prepare('SELECT profile_id FROM product_listings WHERE legacy_product_id = ?').get(productId) as { profile_id: string };
  return { db, productId, profileId: profile.profile_id };
}

const catalogIds = async (db: SqliteD1) => {
  const response = await request(db, '/api/network/catalog', { actor: shop });
  const body = await json<unknown>(response) as { profiles?: { id: string }[] } | { id: string }[];
  const rows = Array.isArray(body) ? body : (body.profiles ?? (body as any).teas ?? (body as any).results ?? []);
  return rows.map((row: { id: string }) => row.id);
};

describe('personal offers stay out of the network catalogue', () => {
  it('publishes the offer without making it network-visible', async () => {
    const { db, profileId } = await published();
    expect(db.sqlite.prepare('SELECT network_visible FROM tea_profiles WHERE id = ?').get(profileId)).toEqual({ network_visible: 0 });
    expect(await catalogIds(db)).not.toContain(profileId);
  });

  it('keeps an offer out even where an older row was left network-visible', async () => {
    const { db, profileId } = await published();
    db.sqlite.prepare("UPDATE tea_profiles SET network_visible = 1, status = 'published' WHERE id = ?").run(profileId);
    expect(await catalogIds(db)).not.toContain(profileId);
    const carry = await request(db, '/api/listings/carry', { actor: shop, method: 'POST', body: { profile_id: profileId, initial_stock_grams: 100, initial_price_amount: 10, initial_price_currency: 'USD' } });
    expect(carry.status).toBe(400);
    expect(await carry.json()).toEqual({ error: 'This tea is not currently available in the network catalog.' });
  });
});
