import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { publicSitRoutes } from '../src/publicSitConnections';
import { seedIdentity, SqliteD1 } from './helpers/sqliteD1';

type Env = { DB: D1Database };
let db: SqliteD1;
const routes = publicSitRoutes<Env>({
  requireUser: async request => {
    const userId = request.headers.get('Test-User');
    return userId ? { userId } : { error: new Response(null, { status: 401 }) };
  },
  requireEditor: async request => {
    const accountId = request.headers.get('Test-Editor');
    return accountId ? { accountId } : { error: new Response(null, { status: 403 }) };
  },
});
const profilePath = '/api/public/sit-links/people/:slug';
const ownPath = '/api/me/people/:slug/sit-placements';
const editOwnPath = `${ownPath}/:eventSlug`;
const creditsPath = '/api/admin/events/:eventId/recap-credits';
const deleteCreditPath = `${creditsPath}/:creditId`;

function call(method: string, path: string, params: Record<string, string>, headers: Record<string, string> = {}, body?: object, query = '') {
  const handler = routes.find(([verb, pattern]) => verb === method && pattern === path)?.[2];
  if (!handler) throw new Error(`Missing route ${method} ${path}`);
  return handler(new Request(`https://teajia.test${path}${query}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  }), { DB: db as unknown as D1Database }, params);
}

const listProfile = (slug: string) => call('GET', profilePath, { slug });
const show = (slug: string, userId: string, role: string) =>
  call('PUT', editOwnPath, { slug, eventSlug: 'white-tea' }, { 'Test-User': userId }, { role });

beforeEach(() => {
  db = new SqliteD1('migrations', '0111');
  seedIdentity(db, { userId: 'lin-user', accountId: 'shop-a' });
  seedIdentity(db, { userId: 'mei-user', accountId: 'shop-a' });
  seedIdentity(db, { userId: 'other-user', accountId: 'shop-b' });
  db.exec(`
    INSERT INTO contributors (id, account_id, user_id, display_name, is_published)
    VALUES ('lin', 'shop-a', 'lin-user', 'Lin', 1),
           ('mei', 'shop-a', 'mei-user', 'Mei', 1),
           ('other', 'shop-b', 'other-user', 'Other', 1);
    INSERT INTO contributor_accounts (contributor_id, account_id)
    VALUES ('lin', 'shop-a'), ('mei', 'shop-a'), ('other', 'shop-b');
    INSERT INTO events (id, account_id, slug, title, event_date, lifecycle_status, public_visibility, recap_status)
    VALUES ('event-a', 'shop-a', 'white-tea', 'White Tea Evening', '2026-11-15', 'completed', 'public', 'published');
    INSERT INTO event_post_session (event_id, account_id, session_notes)
    VALUES ('event-a', 'shop-a', 'Public notes');
    INSERT INTO event_contributors (id, event_id, account_id, contributor_id, role, is_public)
    VALUES ('lead', 'event-a', 'shop-a', 'lin', 'lead_host', 1),
           ('guest', 'event-a', 'shop-a', 'mei', 'guest_host', 1),
           ('private-photo', 'event-a', 'shop-a', 'mei', 'photographer', 0);
    INSERT INTO articles (id, slug, title, account_id, source_event_id, status)
    VALUES ('story-a', 'on-white-tea', 'On White Tea', 'shop-a', 'event-a', 'published'),
           ('story-b', 'copied-source', 'Unrelated', 'shop-b', 'event-a', 'published');
  `);
});

afterEach(() => db.close());

describe('public sit connections', () => {
  it('require independent opt-in from each exact contributor and retain the other placement when one is removed', async () => {
    expect(await listProfile('lin').then(response => response.json())).toEqual({ recaps: [] });
    expect((await show('lin', 'other-user', 'lead_host')).status).toBe(404);
    expect((await show('mei', 'mei-user', 'photographer')).status).toBe(404);
    expect((await show('lin', 'lin-user', 'guest_host')).status).toBe(404);
    expect((await show('lin', 'lin-user', 'lead_host')).status).toBe(200);
    expect((await show('mei', 'mei-user', 'guest_host')).status).toBe(200);
    const lin = await listProfile('lin').then(response => response.json());
    const mei = await listProfile('mei').then(response => response.json());
    expect(lin.recaps).toEqual([{ slug: 'white-tea', title: 'White Tea Evening', event_date: '2026-11-15', role: 'lead_host' }]);
    expect(mei.recaps).toEqual([{ ...lin.recaps[0], role: 'guest_host' }]);
    const params = { slug: 'lin', eventSlug: 'white-tea' };
    await call('DELETE', editOwnPath, params, { 'Test-User': 'other-user' });
    expect(await listProfile('lin').then(response => response.json())).toEqual(lin);
    await call('DELETE', editOwnPath, params, { 'Test-User': 'lin-user' });
    expect(await listProfile('lin').then(response => response.json())).toEqual({ recaps: [] });
    expect(await listProfile('mei').then(response => response.json())).toEqual(mei);
  });

  it('uses the same recap content for a profile, excluding unrevealed teas', async () => {
    db.exec("UPDATE events SET network_discovery = 0 WHERE id = 'event-a'");

    const cards = () => call('GET', profilePath, { slug: 'lin' }, {}, undefined, '?view=cards')
      .then(response => response.json());
    expect(await cards()).toEqual({ recaps: [] });
    await show('lin', 'lin-user', 'lead_host');
    db.exec(`
      UPDATE events SET network_discovery = 1 WHERE id = 'event-a';
      UPDATE event_post_session SET gallery_images = '["/tea.jpg"]' WHERE event_id = 'event-a';
      INSERT INTO event_tea_menu (id, event_id, account_id, custom_name, reveal_date)
      VALUES ('served', 'event-a', 'shop-a', 'White Peony', NULL),
             ('held', 'event-a', 'shop-a', 'Surprise tea', '2999-01-01');
    `);
    const content = {
      slug: 'white-tea', title: 'White Tea Evening', writing: 'Public notes',
      galleryPhoto: '/tea.jpg', teas: [{ id: 'served', name: 'White Peony', type: null }],
    };
    expect(await cards()).toMatchObject({ recaps: [{ ...content, role: 'lead_host' }] });
    db.exec("UPDATE events SET recap_status = 'draft' WHERE id = 'event-a'");
    expect(await cards()).toEqual({ recaps: [] });
  });

  it('withdraw public links if the recap, shop, credit, or profile is taken down', async () => {
    await show('lin', 'lin-user', 'lead_host');
    await show('mei', 'mei-user', 'guest_host');
    db.exec("UPDATE contributors SET is_published = 0, unpublished_at = '2026-11-23' WHERE id = 'lin'");
    expect(await listProfile('lin').then(response => response.json())).toEqual({ recaps: [] });
    expect(await listProfile('mei').then(response => response.json())).toMatchObject({ recaps: [{ slug: 'white-tea' }] });
    db.exec("UPDATE events SET recap_status = 'draft' WHERE id = 'event-a'");
    expect(await listProfile('mei').then(response => response.json())).toEqual({ recaps: [] });
    db.exec("UPDATE events SET recap_status = 'published' WHERE id = 'event-a'");
    db.exec("UPDATE accounts SET public_enabled = 0 WHERE id = 'shop-a'");
  });

  it('shows the editor only the shop’s published profiles and requires an affirmative exact credit', async () => {
    const params = { eventId: 'event-a' };
    expect((await call('GET', creditsPath, params)).status).toBe(403);
    expect((await call('GET', creditsPath, params, { 'Test-Editor': 'shop-b' })).status).toBe(404);
    const editor = { 'Test-Editor': 'shop-a' };
    const list = await call('GET', creditsPath, params, editor).then(response => response.json());
    expect(list.people).toEqual([{ id: 'lin', display_name: 'Lin' }, { id: 'mei', display_name: 'Mei' }]);
    expect(list.credits.map((credit: { id: string }) => credit.id)).toEqual(['lead', 'guest']);
    const offer = { contributor: 'mei', role: 'photographer', confirmed: true };
    expect((await call('POST', creditsPath, params, editor, { ...offer, confirmed: false })).status).toBe(400);
    expect((await call('POST', creditsPath, params, editor, { ...offer, contributor: 'other' })).status).toBe(404);
    expect((await call('POST', creditsPath, params, editor, offer)).status).toBe(200);
    expect((await show('mei', 'mei-user', 'photographer')).status).toBe(200);
    await call('DELETE', deleteCreditPath, { ...params, creditId: 'private-photo' }, editor);
    expect(await listProfile('mei').then(response => response.json())).toEqual({ recaps: [] });
    expect((await show('mei', 'mei-user', 'photographer')).status).toBe(404);
    await call('POST', creditsPath, params, editor, offer);
    expect(await listProfile('mei').then(response => response.json())).toEqual({ recaps: [] });
  });
});
