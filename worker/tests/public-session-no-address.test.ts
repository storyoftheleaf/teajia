import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';

// The public answer for a session names the place and never the way to it.
// The address, the map link and the photographed way in are for a confirmed
// guest only, on their own page. Launch 2, slice H0.
const databases: SqliteD1[] = [];
afterEach(() => databases.splice(0).forEach(db => db.close()));

describe('the public session answer', () => {
  it('carries the place name and area, never the address, map link or way in', async () => {
    const db = new SqliteD1('migrations'); databases.push(db);
    seedIdentity(db, { userId: 'host', accountId: 'shop' });
    db.sqlite.exec(`
      UPDATE accounts SET public_enabled = 1, status = 'active' WHERE id = 'shop';
      INSERT INTO events (id, account_id, slug, title, event_date, status, public_visibility, total_capacity,
        location_name, area_hint, address_text, map_link, venue_guide)
      VALUES ('sit', 'shop', 'courtyard', 'Tea in the courtyard', '2026-12-01T18:00', 'active', 'unlisted', 8,
        'The courtyard', 'Near the market', 'Jalan Rahasia 7', 'https://maps.example/secret',
        '${JSON.stringify({ steps: [{ text: 'Blue gate on the left', image: 'https://img.example/gate.jpg' }], parking: 'Behind the bakery' })}');
    `);
    const response = await worker.fetch(new Request('https://app.test/api/events/courtyard/public'),
      { DB: db } as never, { waitUntil: () => undefined } as never);
    expect(response.status).toBe(200);
    const text = await response.text();
    const body = JSON.parse(text) as Record<string, unknown>;
    expect(body).toMatchObject({ location_name: 'The courtyard', area_hint: 'Near the market' });
    for (const key of ['address_text', 'map_link', 'venue_guide']) expect(body).not.toHaveProperty(key);
    for (const secret of ['Jalan Rahasia', 'maps.example', 'Blue gate', 'gate.jpg', 'bakery']) expect(text).not.toContain(secret);
  });

  it("never shows another shop's venue photos, even if the venue id points there", async () => {
    const db = new SqliteD1('migrations'); databases.push(db);
    seedIdentity(db, { userId: 'host', accountId: 'shop' });
    seedIdentity(db, { userId: 'other', accountId: 'other-shop' });
    db.sqlite.exec(`
      UPDATE accounts SET public_enabled = 1, status = 'active' WHERE id = 'shop';
      INSERT INTO venues (id, account_id, name, address, photos)
      VALUES ('their-room', 'other-shop', 'Their room', 'Elsewhere 1', '["https://img.example/their-door.jpg"]');
      INSERT INTO events (id, account_id, slug, title, event_date, status, public_visibility, total_capacity, venue_id)
      VALUES ('sit', 'shop', 'courtyard', 'Tea in the courtyard', '2026-12-01T18:00', 'active', 'public', 8, 'their-room');
    `);
    const response = await worker.fetch(new Request('https://app.test/api/events/courtyard/public'),
      { DB: db } as never, { waitUntil: () => undefined } as never);
    expect(response.status).toBe(200);
    expect(await response.text()).not.toContain('their-door');
  });
});
