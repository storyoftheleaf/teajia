import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

// What a person keeps is not counted back to anyone (Adrian, 2026-11-26): an
// acknowledgement carries no total, and the journey sentence names no number.
// The public favourites keep their order without a position number; that is
// asserted in tea-master-security-routes.test.ts.

const SECRET = 'favourites-no-count';
const SHOP = 'acc-shop';
const databases: SqliteD1[] = [];
afterEach(() => { while (databases.length) databases.pop()!.close(); });

function setup() {
  const db = new SqliteD1('migrations');
  databases.push(db);
  seedIdentity(db, { userId: 'member', accountId: SHOP, role: 'viewer', bundles: [] });
  const env = { DB: db as any, JWT_SECRET: SECRET };
  return { db, env };
}

async function call(env: any, path: string, init: { method?: string; body?: unknown } = {}) {
  const token = await signedToken(SECRET, {
    sub: 'member', email: 'member@test.dev', name: 'member', active_account_id: SHOP, session_version: 0,
  });
  const headers = new Headers({ Authorization: `Bearer ${token}`, 'X-Teajia-Account': SHOP });
  let body: BodyInit | undefined;
  if (init.body !== undefined) { body = JSON.stringify(init.body); headers.set('Content-Type', 'application/json'); }
  return worker.fetch(new Request(`https://worker.test${path}`, { method: init.method ?? 'GET', headers, body }), env);
}

describe('favourites carry no count', () => {
  it('acknowledges a saved list without saying how many', async () => {
    const { env } = setup();
    const response = await call(env, '/api/user/favorites', { method: 'PUT', body: { favorites: ['a', 'b', 'c'] } });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it('says the member marked teas at the table without the number', async () => {
    const { db, env } = setup();
    db.sqlite.exec(`
      INSERT INTO customers (id, account_id, name, user_id) VALUES ('cust', '${SHOP}', 'Member', 'member');
      INSERT INTO events (id, account_id, slug, title, event_date) VALUES ('ev', '${SHOP}', 'ev', 'Spring table', '2026-11-01');
      INSERT INTO event_attendees (id, account_id, event_id, customer_id, full_name, magic_token, status, attended) VALUES ('att', '${SHOP}', 'ev', 'cust', 'Member', 'magic-att', 'confirmed', 1);
      INSERT INTO products (id, account_id, type, product_name, given_name, origin_region, cost_amount, cost_currency, shipping_rate_per_kg, markup_multiplier)
        VALUES ('p1', '${SHOP}', 'Oolong', 'One', 'One', 'Wuyi', NULL, NULL, NULL, NULL),
               ('p2', '${SHOP}', 'Oolong', 'Two', 'Two', 'Wuyi', NULL, NULL, NULL, NULL);
      INSERT INTO event_tea_menu (id, account_id, event_id, product_id) VALUES ('m1', '${SHOP}', 'ev', 'p1'), ('m2', '${SHOP}', 'ev', 'p2');
      INSERT INTO event_tasting_notes (id, account_id, event_id, attendee_id, tea_menu_id, is_favorite) VALUES ('n1', '${SHOP}', 'ev', 'att', 'm1', 1), ('n2', '${SHOP}', 'ev', 'att', 'm2', 1);
    `);
    const response = await call(env, '/api/me/journey');
    expect(response.status).toBe(200);
    const journey = await response.json() as any;
    expect(journey.portrait).toContain('you marked the teas that stood out');
    expect(journey.portrait).not.toMatch(/\b2 teas\b/);
  });
});
