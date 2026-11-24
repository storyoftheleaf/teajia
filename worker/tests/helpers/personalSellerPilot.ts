import worker from '../../src/index';
import { SqliteD1, seedIdentity, signedToken } from './sqliteD1';

const SECRET = 'synthetic-personal-seller-pilot-secret';
export const mei = { userId: 'mei', name: 'Mei Lin', profile: 'mei-lin-profile', destination: 'Synthetic Mei account 4711' };
export const jun = { userId: 'jun', name: 'Jun Wei', profile: 'jun-wei-profile', destination: 'Synthetic Jun account 9822' };
export const offer = {
  name: 'Spring Mountain oolong', type: 'Oolong', year: 2025, origin: 'Taiwan',
  grams: 50, price_amount: 25, price_currency: 'USD',
};
export const privateLabel = 'Private spring holding';
const privateNote = 'Synthetic supplier-only provenance';
const privatePhoto = '/favicon.svg?record=supplier-only';

type Actor = { userId: string; name: string; accountId: string };
type Seller = typeof mei;

export function pilotEnv(db: SqliteD1, appUrl = 'https://pilot.test') {
  return {
    DB: db, JWT_SECRET: SECRET, APP_URL: appUrl,
    INQUIRY_LIMITER: { limit: async () => ({ success: true }) },
  } as never;
}

export async function request(
  db: SqliteD1, path: string, options: { actor?: Actor; method?: string; body?: unknown } = {},
) {
  const { actor, body, method = 'GET' } = options;
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (actor) {
    const token = await signedToken(SECRET, {
      sub: actor.userId, name: actor.name, email: `${actor.userId}@test.dev`, active_account_id: actor.accountId, role: 'user',
    });
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('X-Teajia-Account', actor.accountId);
  }
  return worker.fetch(new Request(`https://worker.test${path}`, {
    headers, method, body: body === undefined ? undefined : JSON.stringify(body),
  }), pilotEnv(db));
}

export async function json<T>(response: Response, status = 200): Promise<T> {
  const text = await response.text();
  if (response.status !== status) throw new Error(`Expected HTTP ${status}, received ${response.status}: ${text}`);
  return JSON.parse(text) as T;
}

export async function createSeller(db: SqliteD1, seller: Seller, open = true, approved = true) {
  const home = { ...seller, accountId: `${seller.userId}-home` };
  seedIdentity(db, { userId: seller.userId, accountId: home.accountId, publicEnabled: false });
  const { account } = await json<{ account: { id: string; slug: string; public_enabled: number } }>(
    await request(db, '/api/me/tea-chest/account', { actor: home, method: 'POST' }),
  );
  if (account.public_enabled !== 0) throw new Error('The synthetic seller’s Stock must start private');
  // Only people Adrian approves may sell (0120); the pilot sellers are approved.
  if (approved) db.sqlite.prepare('UPDATE accounts SET personal_seller_approved_at = ?, personal_seller_approved_by = ? WHERE id = ?')
    .run('2026-11-24T00:00:00Z', seller.userId, account.id);
  const actor = { ...seller, accountId: account.id };
  const slug = account.slug;
  db.sqlite.prepare(`INSERT INTO contributors (id,account_id,user_id,display_name,is_published,page_tier)
    VALUES (?,?,?,?,1,'master')`).run(seller.profile, home.accountId, seller.userId, seller.name);
  db.sqlite.prepare(`INSERT INTO payment_methods
    (id,contributor_id,method_type,label,recipient_name,account_identifier,is_published)
    VALUES (?,?,'bank_transfer','Bank transfer',?,?,1)`)
    .run(`bank-${seller.userId}`, seller.profile, seller.name, seller.destination);
  const { id: holdingId } = await json<{ id: string }>(await request(db, '/api/products', {
    actor, method: 'POST', body: {
      product_name: privateLabel, type: 'Oolong', stock_grams: 150,
      cost_amount: 9, cost_currency: 'USD', description: privateNote, image_url: privatePhoto,
      status: 'Active', is_public: 0, shown_in_shop: 0, owner_user_id: seller.userId,
    },
  }), 201);
  await json(await request(db, `/api/s/${slug}/products`), 404);
  if (open) await json(await openStore(db, actor));
  return { actor, slug, holdingId, offerPath: `/api/products/${holdingId}/personal-offer` };
}

export const openStore = (db: SqliteD1, actor: Actor) =>
  request(db, `/api/accounts/${actor.accountId}`, { actor, method: 'PUT', body: { public_enabled: true } });
