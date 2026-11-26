import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SqliteD1 } from './helpers/sqliteD1';
import { request } from './helpers/personalSellerPilot';

// The Visit list reads GET /api/network/stores. Each house carries its
// photograph and its next coming session, and only a session the house lists
// publicly: an unlisted or private session never appears, and no address, map
// link or venue guide is ever on this answer.
const databases: SqliteD1[] = [];
beforeEach(() => vi.stubGlobal('fetch', vi.fn(() => { throw new Error('No external services in this test'); })));
afterEach(() => { databases.splice(0).forEach(db => db.close()); vi.unstubAllGlobals(); });

const ahead = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 16);

function seed() {
  const db = new SqliteD1('migrations');
  databases.push(db);
  db.exec(`
    INSERT INTO accounts (id, slug, name, status, public_enabled, cover_image_url, location_city, location_country)
    VALUES ('house-a', 'house-a', 'Bamboo House', 'active', 1, 'https://img.test/bamboo.jpg', 'Ubud', 'Indonesia'),
           ('house-b', 'house-b', 'Cedar Room', 'active', 1, NULL, 'Taipei', 'Taiwan'),
           ('house-hidden', 'house-hidden', 'Private Table', 'active', 0, 'https://img.test/private.jpg', 'Ubud', 'Indonesia');
    INSERT INTO products (id, account_id, type, product_name, given_name, status, is_public) VALUES
      ('p-a', 'house-a', 'Oolong', 'Oolong', 'Oolong', 'Active', 1),
      ('p-b', 'house-b', 'Oolong', 'Oolong', 'Oolong', 'Active', 1),
      ('p-h', 'house-hidden', 'Oolong', 'Oolong', 'Oolong', 'Active', 1);
  `);
  const event = db.sqlite.prepare(`INSERT INTO events
    (id, account_id, slug, title, event_date, status, lifecycle_status, public_visibility,
     location_name, address_text, map_link, venue_guide)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'The courtyard', '12 Secret Lane', 'https://maps.test/secret', 'Gate code 4471')`);
  // House A: an unlisted and a private session come first in time, the public one later.
  event.run('a-unlisted', 'house-a', 'a-unlisted', 'Unlisted evening', ahead(1), 'active', 'published', 'unlisted');
  event.run('a-private', 'house-a', 'a-private', 'Private evening', ahead(2), 'active', 'published', 'private');
  event.run('a-past', 'house-a', 'a-past', 'Last week', ahead(-7), 'active', 'published', 'public');
  event.run('a-public', 'house-a', 'a-public', 'Morning oolongs', ahead(5), 'active', 'published', 'public');
  event.run('a-later', 'house-a', 'a-later', 'Later still', ahead(20), 'active', 'published', 'public');
  // House B: only private, unlisted, cancelled, drafted or closed sessions.
  event.run('b-private', 'house-b', 'b-private', 'Private only', ahead(3), 'active', 'published', 'private');
  event.run('b-unlisted', 'house-b', 'b-unlisted', 'Unlisted only', ahead(3), 'active', 'published', 'unlisted');
  event.run('b-cancelled', 'house-b', 'b-cancelled', 'Cancelled', ahead(4), 'active', 'cancelled', 'public');
  event.run('b-draft', 'house-b', 'b-draft', 'Draft', ahead(4), 'active', 'draft', 'public');
  event.run('b-closed', 'house-b', 'b-closed', 'Closed row', ahead(4), 'closed', 'published', 'public');
  // A house that is not public never appears at all.
  event.run('h-public', 'house-hidden', 'h-public', 'Hidden house session', ahead(2), 'active', 'published', 'public');
  return db;
}

// The photograph and the next session open with the tea houses (A4 review, finding 11).
async function stores(db: SqliteD1, open = 'true') {
  const response = await request(db, '/api/network/stores', { vars: { TEA_HOUSES_OPEN: open } });
  expect(response.status).toBe(200);
  const text = await response.text();
  return { text, rows: JSON.parse(text) as Array<Record<string, unknown>> };
}

describe('the Visit list reads one directory answer', () => {
  it('keeps the eligibility rules and adds the photograph', async () => {
    const { rows } = await stores(seed());
    expect(rows.map(row => row.slug)).toEqual(['house-a', 'house-b']);
    expect(rows[0].cover_image_url).toBe('https://img.test/bamboo.jpg');
    expect(rows[1].cover_image_url).toBeNull();
  });

  it('gives the next public session only: slug, title and date', async () => {
    const { rows } = await stores(seed());
    const next = rows[0].next_session as Record<string, unknown>;
    expect(Object.keys(next).sort()).toEqual(['event_date', 'slug', 'title']);
    expect(next.slug).toBe('a-public');
    expect(next.title).toBe('Morning oolongs');
  });

  it('never shows a private, unlisted, cancelled, draft or closed session', async () => {
    const { rows, text } = await stores(seed());
    expect(rows[1].next_session).toBeNull();
    for (const word of ['Unlisted', 'Private evening', 'Private only', 'Cancelled', 'Draft', 'Closed row', 'Hidden house']) {
      expect(text).not.toContain(word);
    }
  });

  it('closed, the list is as it was before Visit: no photograph and no next session', async () => {
    const { rows } = await stores(seed(), 'false');
    expect(rows.map(row => row.slug)).toEqual(['house-a', 'house-b']);
    for (const row of rows) {
      expect(row).not.toHaveProperty('cover_image_url');
      expect(row).not.toHaveProperty('next_session');
    }
  });

  it('carries no address, map link or venue guide', async () => {
    const { rows, text } = await stores(seed());
    for (const word of ['12 Secret Lane', 'maps.test', 'Gate code', 'The courtyard']) expect(text).not.toContain(word);
    for (const row of rows) {
      for (const key of ['address_text', 'map_link', 'venue_guide', 'location_name', 'whatsapp_number', 'contact_email']) {
        expect(row).not.toHaveProperty(key);
      }
    }
  });
});
