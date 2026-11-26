import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHostedTable, type HostedTableInput } from '../src/hostTable';
import worker from '../src/index';
import { fewHosts, fewHostsStatements } from '../sandbox/few-hosts-fixture.mjs';
import { seedIdentity, SqliteD1 } from './helpers/sqliteD1';

const input: HostedTableInput = {
  accountId: 'personal-ana',
  hostUserId: 'ana',
  hostName: 'Name from the route',
  date: '2026-11-28',
  time: '10:30',
  timezone: 'Asia/Makassar',
  appOrigin: 'https://teajia.test',
};
let db: SqliteD1;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-26T16:30:00Z'));
  db = new SqliteD1('migrations', '0136');
  seedIdentity(db, { userId: 'ana', accountId: 'personal-ana' });
  seedIdentity(db, { userId: 'other', accountId: 'another-shop' });
  db.exec(`
    UPDATE users SET name = 'Ana Host' WHERE id = 'ana';
    UPDATE accounts SET personal_inventory_user_id = 'ana', owner_user_id = 'ana', public_enabled = 0
      WHERE id = 'personal-ana';
  `);
});

afterEach(() => {
  db.close();
  vi.useRealTimers();
});

const make = (overrides: Partial<HostedTableInput> = {}) =>
  createHostedTable(db as unknown as D1Database, { ...input, ...overrides });
const rows = () => db.sqlite.prepare('SELECT * FROM events').all();

describe('createHostedTable', () => {
  it('creates one published, unlisted table in the host’s personal account with the request door by default', async () => {
    const result = await make();
    expect(rows()).toEqual([expect.objectContaining({
      account_id: 'personal-ana',
      host_user_id: 'ana',
      title: "Saturday at Ana's table",
      event_date: '2026-11-28T02:30:00.000Z',
      timezone: 'Asia/Makassar',
      total_capacity: 6,
      door: 'request',
      requires_approval: 1,
      public_visibility: 'unlisted',
      network_discovery: 0,
      status: 'active',
      lifecycle_status: 'published',
    })]);
    const [{ id, slug }] = rows();
    expect(slug).toMatch(/^saturday-at-ana-s-table-[a-f0-9]{24}$/);
    expect(result).toEqual({ id, slug, link: `https://teajia.test/event/${slug}` });
  });

  it('uses different slugs in the same second and keeps the link door unlisted regardless of caller fields', async () => {
    const overrides = {
      name: 'Oolong at dusk',
      door: 'link',
      seats: 40,
      public_visibility: 'public',
      network_discovery: 1,
      requires_approval: 1,
      account_id: 'another-shop',
    } as const;
    await Promise.all([make(overrides), make(overrides)]);
    const events = rows();
    expect(new Set(events.map(event => event.slug)).size).toBe(2);
    expect(events).toEqual(Array.from({ length: 2 }, () => expect.objectContaining({
      slug: expect.stringMatching(/^oolong-at-dusk-[a-f0-9]{24}$/),
      title: 'Oolong at dusk',
      total_capacity: 40,
      door: 'link',
      requires_approval: 0,
      public_visibility: 'unlisted',
      network_discovery: 0,
      account_id: 'personal-ana',
      host_user_id: 'ana',
    })));
  });

  it('uses the table’s local day when refusing a past day', async () => {
    expect(await make({ date: '2026-11-26' })).toEqual({
      refused: { code: 'hosted_table_past_day', error: 'Choose today or a later day for the table.' },
    });
    expect(rows()).toHaveLength(0);
    await make({ date: '2026-11-27', time: '00:45', seats: 1 });
    expect(rows()).toEqual([expect.objectContaining({
      event_date: '2026-11-26T16:45:00.000Z',
      total_capacity: 1,
    })]);
  });

  it.each([0, 41, 2.5])('refuses %s seats', async (seats) => {
    expect(await make({ seats })).toEqual({
      refused: { code: 'hosted_table_seats', error: 'Seats are a whole number from 1 to 40.' },
    });
    expect(rows()).toHaveLength(0);
  });

  it('refuses a missing time', async () => {
    expect(await make({ time: '' })).toEqual({
      refused: { code: 'hosted_table_time', error: 'Give the time as hours and minutes.' },
    });
    expect(rows()).toHaveLength(0);
  });

  it('refuses a time skipped by daylight saving and chooses the earlier instant when the clock repeats', async () => {
    expect(await make({ date: '2027-03-14', time: '02:30', timezone: 'America/New_York' })).toEqual({
      refused: { code: 'hosted_table_time', error: 'Choose a time that exists on that day in your time zone.' },
    });
    expect(rows()).toHaveLength(0);
    await make({ date: '2027-11-07', time: '01:30', timezone: 'America/New_York' });
    expect(rows()).toEqual([expect.objectContaining({ event_date: '2027-11-07T05:30:00.000Z' })]);
  });

  it('uses a table as the title when the host has no name', async () => {
    db.exec("UPDATE users SET name = '' WHERE id = 'ana'");
    await make();
    expect(rows()).toEqual([expect.objectContaining({ title: 'a table' })]);
  });

  it('lets the sandbox fixture host sign in, make a table and read its share link from her account', async () => {
    seedIdentity(db, { userId: 'sandbox-operator', accountId: 'sandbox-home' });
    for (const statement of fewHostsStatements) db.exec(statement);
    const call = (path: string, body?: object, token?: string) => worker.fetch(new Request(`https://worker.test${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    }), { DB: db, JWT_SECRET: 'synthetic-host-table-fixture', APP_URL: input.appOrigin, FEW_HOSTS_OPEN: 'true' } as never);

    const signIn = await call('/api/auth/login', { identifier: fewHosts.host.username, password: fewHosts.host.password });
    expect(signIn.status).toBe(200);
    const { token } = await signIn.json() as { token: string };
    const access = await call('/api/me/hosting', undefined, token);
    expect(await access.json()).toEqual({ approved: true, account_id: fewHosts.accountId, doors: ['request', 'link'] });

    const body = { date: input.date, time: input.time, timezone: input.timezone };
    const response = await call('/api/me/tables', body, token);
    expect(response.status).toBe(201);
    const { id, slug, link } = await response.json() as { id: string; slug: string; link: string };
    expect(link).toBe(`${input.appOrigin}/event/${slug}`);
    expect(rows()).toContainEqual(expect.objectContaining({
      id, account_id: fewHosts.accountId, host_user_id: fewHosts.host.id, door: 'request',
      requires_approval: 1, public_visibility: 'unlisted', network_discovery: 0,
    }));
    const detail = await call(`/api/me/tables/${id}`, undefined, token);
    expect(detail.status).toBe(200);
    expect(await detail.json()).toMatchObject({ table: { id, link, seats: 6 } });

    const past = await call('/api/me/tables', { ...body, date: '2026-11-26' }, token);
    expect(past.status).toBe(400);
    expect(await past.json()).toMatchObject({ code: 'hosted_table_past_day' });
    expect((await call('/api/me/tables', { ...body, seats: 41 }, token)).status).toBe(400);
    // The fixture's two tables, and the one made here.
    expect(rows()).toHaveLength(3);
  });
});
