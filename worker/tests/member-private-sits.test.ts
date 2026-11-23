import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { seedIdentity, signedToken, SqliteD1 } from './helpers/sqliteD1';

const secret = 'member-private-sits-test-secret';
const base = '/api/me/private-sits';
let db: SqliteD1;

beforeEach(() => {
  db = new SqliteD1('migrations');
  seedIdentity(db, { userId: 'operator', accountId: 'shop', bundles: ['gather', 'sell'] });
  for (const user of ['host', 'guest', 'other']) {
    db.sqlite.prepare('INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)').run(user, `${user}@test.dev`, user, 'test');
  }
});
afterEach(() => db.close());

async function request(path: string, user: string | null, method = 'GET', body?: object, account = 'shop') {
  const headers = new Headers({ 'Content-Type': 'application/json', 'X-Teajia-Account': account });
  if (user) headers.set('Authorization', `Bearer ${await signedToken(secret, { sub: user, email: `${user}@test.dev` })}`);
  return worker.fetch(new Request(`https://worker.test${path}`, {
    method, headers, ...(body && { body: JSON.stringify(body) }),
  }), { DB: db, JWT_SECRET: secret } as any);
}

async function create(user = 'host', input = {}) {
  const response = await request(base, user, 'POST', input);
  expect(response.status).toBe(201);
  expect(response.headers.get('Cache-Control')).toContain('no-store');
  return response.json() as Promise<{ id: string }>;
}

async function invite(id: string) {
  const response = await request(`${base}/${id}/invite`, 'host', 'PUT');
  expect(response.status).toBe(201);
  return (await response.json() as { token: string }).token;
}

describe('member ownership boundary', () => {
  it('denies a signed-in person without membership the existing co-tasting and operations doors', async () => {
    const schema = db.sqlite.prepare(`PRAGMA table_info('tasting_sessions')`).all();
    expect(schema.find(col => col.name === 'account_id')).toMatchObject({ notnull: 1 });
    expect((await request('/api/sessions', 'host', 'POST', { title: 'Casual tea' })).status).toBe(403);
    expect((await request('/api/admin/events', 'host', 'POST', { slug: 'private', title: 'Private', event_date: '2099-10-05', total_capacity: 2 })).status).toBe(403);
    expect((await request('/api/admin/events/example/attendees', 'host')).status).toBe(403);
    expect((await request('/api/sales/grants', 'host')).status).toBe(403);
  });

  it('saves a personal sit once using the same request, with its date and exact tea, without touching operations', async () => {
    const input = { requestId: crypto.randomUUID(), date: '2026-11-23', tea: { id: 'canonical-tea-id', name: 'Rock tea' } };
    expect((await request(base, null, 'POST', input)).status).toBe(401);
    const { id } = await create('host', input);
    expect(await create('host', input)).toMatchObject({ id });
    const saved = await request(`${base}/${id}`, 'host');
    expect(await saved.json()).toMatchObject({
      id, date: input.date, title: null, description: null, role: 'host',
      tea: { id: 'canonical-tea-id', name: 'Rock tea' }, note: null,
    });
    expect((await request('/api/sessions', 'host', 'POST', { title: 'Still casual' })).status).toBe(403);
    expect((await request('/api/admin/events/example/attendees', 'host')).status).toBe(403);
    expect((await request('/api/sales/grants', 'host')).status).toBe(403);
    expect(db.sqlite.prepare('SELECT id FROM tasting_sessions').all()).toEqual([]);
    expect(db.sqlite.prepare('SELECT id FROM events').all()).toEqual([]);
    expect(db.sqlite.prepare('SELECT id FROM account_members WHERE user_id = ?').all('host')).toEqual([]);
  });

  it('lets the host name an outside tea later without replacing an existing tea identity', async () => {
    const { id } = await create();
    const token = await invite(id);
    await request(`${base}/accept`, 'guest', 'POST', { token });
    expect((await request(`${base}/${id}`, 'guest', 'PUT', { title: 'Guest edit' })).status).toBe(404);
    const updated = await request(`${base}/${id}`, 'host', 'PUT', {
      title: 'A quiet table', description: 'After sunset', teaName: 'Wuyi tea',
    });
    expect(await updated.json()).toEqual({
      title: 'A quiet table', description: 'After sunset', tea: { id: null, name: 'Wuyi tea' },
    });
    const canonical = await create('host', { tea: { id: 'known-tea', name: 'Exact tea' } });
    await request(`${base}/${canonical.id}`, 'host', 'PUT', { title: 'With a friend', teaName: 'Different tea' });
    const preserved = await request(`${base}/${canonical.id}`, 'host');
    expect(await preserved.json()).toMatchObject({ tea: { id: 'known-tea', name: 'Exact tea' } });
  });

  it('requires a signed-in person to claim the current invite and never treats a token or ID as read access', async () => {
    const { id } = await create();
    const expired = await invite(id);
    const token = await invite(id);
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(token).not.toBe(expired);
    expect((await request(`${base}/${id}?token=${token}`, 'guest')).status).toBe(404);
    expect((await request(`${base}/${id}`, 'operator')).status).toBe(404);
    expect((await request(`${base}/${id}/invite`, 'guest', 'DELETE')).status).toBe(404);
    expect((await request(`${base}/accept`, null, 'POST', { token })).status).toBe(401);
    expect((await request(`${base}/accept`, 'guest', 'POST', { token: expired })).status).toBe(404);
    expect((await request(`${base}/accept`, 'host', 'POST', { token })).status).toBe(404);
    for (let attempt = 0; attempt < 2; attempt++) {
      const accept = await request(`${base}/accept`, 'guest', 'POST', { token });
      expect(accept.status).toBe(200);
      expect(await accept.json()).toEqual({ id });
    }
    expect((await request(`${base}/accept`, 'other', 'POST', { token })).status).toBe(404);
    expect((await request(`${base}/${id}`, 'other')).status).toBe(404);
    const guest = await request(`${base}/${id}`, 'guest');
    expect(await guest.json()).toMatchObject({ id, role: 'guest' });
    expect((await request(`${base}/${id}/invite`, 'guest', 'PUT')).status).toBe(404);
  });

  it('keeps the existing private Journal tasting with its owner when the selected shop changes', async () => {
    const { id } = await create();
    const invited = await invite(id);
    await request(`${base}/accept`, 'guest', 'POST', { token: invited });
    const productId = `member-sit:${id}`;
    const entry = {
      id: crypto.randomUUID(),
      product_id: productId,
      product_name: 'Rock tea',
      note: { personalNote: 'Dried apricot' },
      tastings: [{ id: productId, sourceType: 'memberTea', tasting: {} }],
    };
    const saved = await request('/api/tasting-journal/sync', 'host', 'POST', [entry]);
    expect(saved.status).toBe(200);
    expect(db.sqlite.prepare('SELECT account_id FROM customer_tasting_journal WHERE product_id = ?').get(productId)).toEqual({ account_id: null });
    const ownerJournal = await request('/api/tasting-journal', 'host', 'GET', undefined, 'different-shop');
    expect(await ownerJournal.json()).toEqual([expect.objectContaining({ product_id: productId })]);
    const otherJournal = await request('/api/tasting-journal', 'guest');
    expect(await otherJournal.json()).toEqual([]);
  });

  it('keeps each accepted person’s notes and Journey separate', async () => {
    const { id } = await create();
    const privateSit = await create();
    const token = await invite(id);
    await request(`${base}/accept`, 'guest', 'POST', { token });
    const revoked = await invite(id);
    expect((await request(`${base}/${id}/invite`, 'host', 'DELETE')).status).toBe(200);
    expect((await request(`${base}/accept`, 'other', 'POST', { token: revoked })).status).toBe(404);
    expect((await request(`${base}/${id}/note`, 'other', 'PUT', { note: 'intrusion' })).status).toBe(404);
    expect((await request(`${base}/${id}/note`, 'host', 'PUT', { note: 'Host memory' })).status).toBe(200);
    expect((await request(`${base}/${id}/note`, 'guest', 'PUT', { note: 'Guest memory', userId: 'host' })).status).toBe(200);
    const host = await (await request(base, 'host')).json() as { sits: object[] };
    const guest = await (await request(base, 'guest')).json() as { sits: object[] };
    expect(host.sits).toHaveLength(2);
    expect(host.sits).toContainEqual(expect.objectContaining({ id: privateSit.id, note: null, role: 'host' }));
    expect(host.sits).toContainEqual(expect.objectContaining({ id, note: 'Host memory', role: 'host' }));
    expect(guest.sits).toEqual([expect.objectContaining({ id, note: 'Guest memory', role: 'guest' })]);
    expect(await (await request(base, 'other')).json()).toEqual({ sits: [] });
  });
});
