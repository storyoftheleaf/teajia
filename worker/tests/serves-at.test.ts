import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';

// Tea spaces, step 4: "Serves at tables" opens a short list on the person's
// page. Their own spaces first, then other spaces they served in. Names only,
// no counts, and a private space by its area alone.

let db: SqliteD1;

beforeEach(() => {
  db = new SqliteD1('migrations');
  seedIdentity(db, { userId: 'mei', accountId: 'mei-home' });
  seedIdentity(db, { userId: 'owner', accountId: 'shop' });
  seedIdentity(db, { userId: 'house-owner', accountId: 'house' });
  db.exec(`
    UPDATE accounts SET personal_inventory_user_id = 'mei' WHERE id = 'mei-home';
    UPDATE accounts SET name = 'The Leaf House', slug = 'the-leaf-house' WHERE id = 'house';
    INSERT INTO tea_house_pages (house_account_id, account_id, is_shown) VALUES ('house', 'shop', 1);
    INSERT INTO contributors (id, account_id, user_id, display_name, is_published, links) VALUES
      ('mei-lin', 'shop', 'mei', 'Mei Lin', 1, '[]'),
      ('ren', 'house', 'house-owner', 'Ren', 1, '[]'),
      ('draft-page', 'shop', NULL, 'Not Yet', 0, '[]');
    INSERT INTO saved_locations (id, name, address, map_link, account_id, is_host_table, area_hint) VALUES
      ('garden', 'The garden room', '12 Jalan Secret', 'https://maps.example/secret', 'mei-home', 1, 'Ubud, near the market'),
      ('kept', 'A kept place', '9 Jalan Kept', NULL, 'mei-home', 0, 'Sanur'),
      ('studio', 'Studio', '3 Jalan Studio', NULL, 'shop', 1, 'Canggu, by the rice fields');
    INSERT INTO events (id, account_id, slug, title, event_date, lifecycle_status, location_id) VALUES
      ('at-shop', 'shop', 'at-shop', 'Oolong evening', '2026-01-10', 'completed', 'studio'),
      ('at-shop-again', 'shop', 'at-shop-again', 'Oolong evening two', '2026-02-10', 'completed', 'studio'),
      ('at-house', 'house', 'at-house', 'Pu-erh', '2026-01-12', 'completed', NULL),
      ('to-come', 'shop', 'to-come', 'Soon', '2099-01-10', 'published', NULL),
      ('as-guest', 'shop', 'as-guest', 'Green', '2026-01-14', 'completed', NULL);
    UPDATE events SET area_hint = 'Seminyak' WHERE id IN ('to-come', 'as-guest');
    INSERT OR IGNORE INTO contributor_accounts (contributor_id, account_id) VALUES ('mei-lin', 'shop'), ('ren', 'house');
    INSERT INTO event_contributors (id, account_id, event_id, contributor_id, role, is_public) VALUES
      ('ec1', 'shop', 'at-shop', 'mei-lin', 'lead_host', 1),
      ('ec2', 'shop', 'at-shop-again', 'mei-lin', 'co_host', 1),
      ('ec3', 'house', 'at-house', 'ren', 'guest_host', 1),
      ('ec4', 'shop', 'to-come', 'mei-lin', 'lead_host', 1),
      ('ec5', 'shop', 'as-guest', 'mei-lin', 'photographer', 1);
  `);
});
afterEach(() => db.close());

const read = (slug: string) => worker.fetch(
  new Request(`https://worker.test/api/public/people/${slug}/spaces`),
  { DB: db } as never, { waitUntil() {} } as never,
);

describe('where a person serves', () => {
  it('lists their own spaces by area, then where they served, once each, with no counts', async () => {
    const response = await read('mei-lin');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      own: [{ label: 'Ubud, near the market' }],
      served: [{ label: 'Canggu, by the rice fields' }],
    });
  });

  it('a shown tea house is named, with its page', async () => {
    expect(await (await read('ren')).json()).toEqual({
      own: [],
      served: [{ label: 'The Leaf House', house_slug: 'the-leaf-house' }],
    });
  });

  it('never gives away a private place’s name, address or map link', async () => {
    const text = await (await read('mei-lin')).text();
    for (const secret of ['The garden room', 'Jalan', 'maps.example', 'Studio', 'garden', 'Sanur']) {
      expect(text).not.toContain(secret);
    }
  });

  it('is not there while the Tea Table is closed', async () => {
    const closed = await worker.fetch(new Request('https://worker.test/api/public/people/mei-lin/spaces'),
      { DB: db, TEA_TABLE_OPEN: 'false' } as never, { waitUntil() {} } as never);
    expect(closed.status).toBe(404);
  });

  it('an unpublished page answers as not found', async () => {
    expect((await read('draft-page')).status).toBe(404);
    expect((await read('nobody')).status).toBe(404);
  });
});
