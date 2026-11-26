import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { combineToolModules } from '../src/mcpTools/registry';
import { eventsToolModule } from '../src/mcpTools/events';
import { firstTableToolModule } from '../src/mcpTools/firstTable';
import { seedIdentity, SqliteD1 } from './helpers/sqliteD1';

/* The agent tools for the first table: set a session's reading, read what its
   thank-you holds, list the readings. A write previews first and commits only
   on confirm; every query is scoped to the caller's account. */

let db: SqliteD1;
const AUTH = { accountId: 'shop-a', userId: 'host', userEmail: 'host@test.dev', tokenId: 'token-one', creatorTier: 'owner' };
const H = firstTableToolModule.handlers;
const env = () => ({ DB: db as unknown as D1Database });
const call = (name: keyof typeof H, args: unknown, auth = AUTH) => H[name](env(), auth as never, args) as Promise<any>;
const reading = (id = 'event-a') =>
  (db.sqlite.prepare('SELECT reading_article_id AS r FROM events WHERE id = ?').get(id) as { r: string | null }).r;

beforeEach(() => {
  db = new SqliteD1('migrations', '0128');
  seedIdentity(db, { userId: 'host', accountId: 'shop-a' });
  seedIdentity(db, { userId: 'rival', accountId: 'shop-b' });
  db.exec(`
    INSERT INTO events (id, account_id, slug, title, event_date, lifecycle_status, playlist_url) VALUES
      ('event-a', 'shop-a', 'one', 'First table', '2026-11-22', 'completed', 'https://music.test/list'),
      ('event-b', 'shop-b', 'two', 'Rival table', '2026-11-23', 'completed', null);
    INSERT INTO articles (id, account_id, title, slug, status) VALUES
      ('art-pub', 'shop-a', 'On patience', 'on-patience', 'published'),
      ('art-pub2', 'shop-a', 'On water', 'on-water', 'published'),
      ('art-draft', 'shop-a', 'Unfinished', 'unfinished', 'draft'),
      ('art-rival', 'shop-b', 'Rival piece', 'rival-piece', 'published');
    INSERT INTO products (id, account_id, type, product_name, slug, is_public, shown_in_shop, status) VALUES
      ('product-public', 'shop-a', 'White', 'Public white', 'public-white', 1, 1, 'Active'),
      ('product-private', 'shop-a', 'Red', 'Private red', 'private-red', 0, 1, 'Active');
    INSERT INTO event_tea_menu (id, account_id, event_id, product_id, custom_name, brew_order) VALUES
      ('tea-public', 'shop-a', 'event-a', 'product-public', 'Session white', 1),
      ('tea-private', 'shop-a', 'event-a', 'product-private', null, 2),
      ('tea-plain', 'shop-a', 'event-a', null, 'Plain name', 3);
    INSERT INTO event_attendee_recaps (event_id, account_id, session_notes) VALUES ('event-a', 'shop-a', 'Thank you for sitting.');
  `);
});

afterEach(() => db.close());

describe('set_session_reading', () => {
  it('does not write on preview, and shows the session and article titles', async () => {
    const out = await call('set_session_reading', { event_id: 'event-a', article_id: 'art-pub' });
    expect(out.preview.session.title).toBe('First table');
    expect(out.preview.reading).toEqual({ id: 'art-pub', title: 'On patience' });
    expect(out.confirmation_token).toBeTruthy();
    expect(reading()).toBeNull();
  });

  it('writes on confirm, once', async () => {
    const { confirmation_token } = await call('set_session_reading', { event_id: 'event-a', article_id: 'art-pub' });
    const done = await call('set_session_reading', { event_id: 'event-a', confirm: confirmation_token });
    expect(done).toMatchObject({ committed: true, article_id: 'art-pub' });
    expect(reading()).toBe('art-pub');
    const again = await call('set_session_reading', { event_id: 'event-a', confirm: confirmation_token });
    expect(again).toEqual({ error: 'invalid_or_expired_confirmation_token' });
  });

  it('previews "no reading" and clears a reading on confirm', async () => {
    db.exec("UPDATE events SET reading_article_id = 'art-pub' WHERE id = 'event-a'");
    const out = await call('set_session_reading', { event_id: 'event-a', article_id: null });
    expect(out.preview.reading).toBe('no reading');
    expect(reading()).toBe('art-pub');
    await call('set_session_reading', { event_id: 'event-a', confirm: out.confirmation_token });
    expect(reading()).toBeNull();
  });

  it('refuses a draft article and another shop\'s article, writing nothing', async () => {
    for (const article_id of ['art-draft', 'art-rival', 'nope']) {
      const out = await call('set_session_reading', { event_id: 'event-a', article_id });
      expect(out.error).toBe('article_not_readable');
      expect(out.confirmation_token).toBeUndefined();
    }
    expect(reading()).toBeNull();
  });

  it('refuses at confirm an article unpublished since the preview', async () => {
    const { confirmation_token } = await call('set_session_reading', { event_id: 'event-a', article_id: 'art-pub' });
    db.exec("UPDATE articles SET status = 'draft' WHERE id = 'art-pub'");
    const out = await call('set_session_reading', { event_id: 'event-a', confirm: confirmation_token });
    expect(out.error).toBe('article_not_readable');
    expect(reading()).toBeNull();
  });

  it('treats a session of another account as not found, at preview and confirm', async () => {
    expect(await call('set_session_reading', { event_id: 'event-b', article_id: 'art-pub' })).toEqual({ error: 'event_not_found' });
    const rival = { ...AUTH, accountId: 'shop-b', userId: 'rival' };
    const { confirmation_token } = await call('set_session_reading', { event_id: 'event-a', article_id: 'art-pub' });
    expect(await call('set_session_reading', { event_id: 'event-a', confirm: confirmation_token }, rival)).toEqual({ error: 'event_not_found' });
    expect(reading()).toBeNull();
    expect(reading('event-b')).toBeNull();
  });

  it('will not let another token spend the preview', async () => {
    const { confirmation_token } = await call('set_session_reading', { event_id: 'event-a', article_id: 'art-pub' });
    const out = await call('set_session_reading', { event_id: 'event-a', confirm: confirmation_token }, { ...AUTH, tokenId: 'token-two' });
    expect(out).toEqual({ error: 'invalid_or_expired_confirmation_token' });
    expect(reading()).toBeNull();
  });
});

describe('get_session_thanks', () => {
  it('returns the thank-you content with tea paths, playlist and reading', async () => {
    db.exec("UPDATE events SET reading_article_id = 'art-pub' WHERE id = 'event-a'");
    const out = await call('get_session_thanks', { event_id: 'event-a' });
    expect(out).toEqual({
      event: { id: 'event-a', title: 'First table', event_date: '2026-11-22' },
      host_note: 'Thank you for sitting.',
      teas: expect.any(Array),
      playlist_url: 'https://music.test/list',
      reading: { slug: 'on-patience', title: 'On patience' },
    });
    const byId = Object.fromEntries(out.teas.map((t: any) => [t.id, t]));
    expect(byId['tea-public']).toEqual({ id: 'tea-public', name: 'Session white', path: '/shop/product/public-white?store=shop-a' });
    expect(byId['tea-private'].path).toBeNull();
    expect(byId['tea-plain'].path).toBeNull();
  });

  it('shows no reading once the article is unpublished', async () => {
    db.exec("UPDATE events SET reading_article_id = 'art-pub' WHERE id = 'event-a'");
    db.exec("UPDATE articles SET status = 'draft' WHERE id = 'art-pub'");
    expect((await call('get_session_thanks', { event_id: 'event-a' })).reading).toBeNull();
  });

  it('contains no link secret, thanks_ref, seat or attendee data', async () => {
    db.exec(`
      UPDATE events SET thanks_ref = 'ref-secret-123' WHERE id = 'event-a';
      INSERT INTO event_attendees (id, account_id, event_id, full_name, magic_token, status, attended)
        VALUES ('seat-a', 'shop-a', 'event-a', 'Guest A', 'magic-secret-456', 'confirmed', 1);
      INSERT INTO after_sit_access (attendee_id, event_id, account_id, credential_hash, expires_at)
        VALUES ('seat-a', 'event-a', 'shop-a', 'hash-secret-789', unixepoch() + 1000);
    `);
    const out = await call('get_session_thanks', { event_id: 'event-a' });
    const raw = JSON.stringify(out);
    for (const secret of ['ref-secret-123', 'magic-secret-456', 'hash-secret-789', 'Guest A', 'seat-a']) {
      expect(raw).not.toContain(secret);
    }
    for (const key of ['thanks_ref', 'credential', 'attendee', 'kept', 'magic_token']) expect(raw).not.toContain(key);
    expect(Object.keys(out).sort()).toEqual(['event', 'host_note', 'playlist_url', 'reading', 'teas']);
  });

  it('treats a session of another account as not found', async () => {
    expect(await call('get_session_thanks', { event_id: 'event-b' })).toEqual({ error: 'event_not_found' });
  });
});

describe('list_readings', () => {
  it('lists only this shop\'s published articles', async () => {
    const out = await call('list_readings', {});
    expect(out.readings.map((r: any) => r.id).sort()).toEqual(['art-pub', 'art-pub2']);
    expect(out.readings[0]).toEqual({ id: expect.any(String), slug: expect.any(String), title: expect.any(String) });
  });
});

describe('the module', () => {
  it('registers beside the events tools without a name clash, with the right scopes', () => {
    const { defs } = combineToolModules([eventsToolModule, firstTableToolModule]);
    const scope = (name: string) => defs.find(d => d.name === name)?.scope;
    expect(scope('set_session_reading')).toBe('catalog:write');
    expect(scope('get_session_thanks')).toBe('inventory:read');
    expect(scope('list_readings')).toBe('inventory:read');
  });
});
