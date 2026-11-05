import { afterEach, describe, expect, it } from 'vitest';
import { mcpFetch } from '../src/mcp';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';

const databases: SqliteD1[] = [];
afterEach(() => { while (databases.length) databases.pop()!.close(); });

async function sha256(value: string) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))]
    .map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function fixture(source: 'schema' | 'migrations') {
  const db = new SqliteD1(source);
  databases.push(db);
  seedIdentity(db);
  seedIdentity(db, { accountId: 'acc-other', userId: 'user-other' });
  for (const [id, accountId] of [['owned', 'acc-one'], ['foreign', 'acc-other']]) {
    db.sqlite.prepare('INSERT INTO customers (id, account_id, name, notes) VALUES (?, ?, ?, ?)')
      .run(id, accountId, `${id} synthetic customer`, `${id} original note`);
  }
  for (const [id, accountId, userId] of [
    ['issuer', 'acc-one', 'user-one'], ['sibling', 'acc-one', 'user-one'], ['foreign', 'acc-other', 'user-other'],
  ]) {
    db.sqlite.prepare(`INSERT INTO mcp_tokens
      (id, account_id, user_id, user_email, label, token_hash, token_prefix, scopes, creator_tier, expires_at)
      VALUES (?, ?, ?, ?, 'synthetic test', ?, 'tjmcp_', ?, 'account_owner', ?)`)
      .run(id, accountId, userId, `${userId}@test.dev`, await sha256(`tjmcp_${id}`),
        JSON.stringify(['customers:write', 'catalog:write']), Math.floor(Date.now() / 1000) + 3600);
  }

  // Only adapt D1's promise interface; every query and batch runs in real SQLite.
  const env = { DB: {
    prepare(sql: string) {
      const inner = db.prepare(sql);
      const statement = {
        inner,
        bind(...values: unknown[]) { inner.bind(...values); return statement; },
        first: async () => inner.first(),
        all: async () => inner.all(),
        run: async () => inner.run(),
      };
      return statement;
    },
    batch: async (statements: { inner: ReturnType<SqliteD1['prepare']> }[]) =>
      db.batch(statements.map(statement => statement.inner)),
  } };
  async function call(args: Record<string, unknown>, bearer = 'issuer', name = 'update_customer') {
    const response = await mcpFetch(new Request('https://worker.test/mcp', {
      method: 'POST',
      headers: { authorization: `Bearer tjmcp_${bearer}`, 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call',
        params: { name, arguments: args } }),
    }), env as any);
    expect(response.status).toBe(200);
    const rpc = await response.json() as any;
    expect(rpc.error).toBeUndefined();
    return rpc.result.structuredContent;
  }
  const customers = () => db.sqlite.prepare('SELECT * FROM customers ORDER BY id').all();
  const tickets = () => db.sqlite.prepare('SELECT * FROM mcp_confirmation_tickets ORDER BY token_hash').all();
  const updates = () => db.sqlite.prepare("SELECT count(*) AS n FROM activity_logs WHERE action='CUSTOMER_UPDATED_MCP'").get();
  const args = { customer_id: 'owned', notes: 'previewed note' };
  return { db, call, customers, tickets, updates, args };
}

const invalid = { error: 'invalid_or_expired_confirmation_token' };
for (const source of ['schema', 'migrations'] as const) describe(`${source}: built-in confirmation token binding`, () => {
  it.each(['sibling', 'foreign'])('refuses the %s bearer without consuming the ticket, then lets its issuer confirm once', async bearer => {
    const { call, customers, tickets, updates, args } = await fixture(source);
    const beforeCustomers = customers();
    const preview = await call(args);
    expect(preview.preview.changes.notes).toEqual({ old: 'owned original note', new: 'previewed note' });
    expect(preview.expires_in_seconds).toBe(300);
    expect(customers()).toEqual(beforeCustomers);
    const beforeTickets = tickets();
    // A foreign customer makes the wrong-account request reach the claim helper.
    expect(await call({ customer_id: bearer === 'foreign' ? 'foreign' : 'owned', notes: 'unpreviewed note',
      confirm: preview.confirmation_token }, bearer)).toEqual(invalid);
    expect(tickets()).toEqual(beforeTickets);
    expect(customers()).toEqual(beforeCustomers);
    expect(updates()).toEqual({ n: 0 });

    expect(await call({ ...args, notes: 'unpreviewed note', confirm: preview.confirmation_token }))
      .toMatchObject({ committed: true, customer_id: 'owned' });
    expect(customers()).toEqual(beforeCustomers.map(row => row.id === 'owned'
      ? { ...row, notes: 'previewed note', updated_at: expect.any(String) } : row));
    expect(tickets()[0].consumed_at).toEqual(expect.any(Number));
    const afterCustomers = customers();
    const afterTickets = tickets();
    expect(await call({ ...args, confirm: preview.confirmation_token })).toEqual(invalid);
    expect(customers()).toEqual(afterCustomers);
    expect(tickets()).toEqual(afterTickets);
    expect(updates()).toEqual({ n: 1 });
  });

  it('allows exactly one winner for concurrent valid confirmations', async () => {
    const { call, customers, tickets, updates, args } = await fixture(source);
    const preview = await call(args);
    const results = await Promise.all(Array.from({ length: 8 }, () => call({ ...args, confirm: preview.confirmation_token })));
    expect(results.filter(result => result.committed === true)).toHaveLength(1);
    expect(results.filter(result => result.error === invalid.error)).toHaveLength(7);
    expect(customers().find(row => row.id === 'owned')?.notes).toBe('previewed note');
    expect(tickets()[0].consumed_at).toEqual(expect.any(Number));
    expect(updates()).toEqual({ n: 1 });
  });

  it('leaves an expired ticket and customer unchanged when the issuer confirms', async () => {
    const { db, call, customers, tickets, updates, args } = await fixture(source);
    const preview = await call(args);
    db.sqlite.prepare('UPDATE mcp_confirmation_tickets SET expires_at = ?').run(Date.now() - 1);
    const beforeTickets = tickets();
    const beforeCustomers = customers();
    expect(await call({ ...args, confirm: preview.confirmation_token })).toEqual(invalid);
    expect(tickets()).toEqual(beforeTickets);
    expect(customers()).toEqual(beforeCustomers);
    expect(updates()).toEqual({ n: 0 });
  });

  it('retains NULL token_id legacy compatibility and single-use behavior', async () => {
    const { db, call, tickets, updates, args } = await fixture(source);
    const preview = await call(args);
    db.sqlite.exec('UPDATE mcp_confirmation_tickets SET token_id = NULL');
    expect(await call({ ...args, confirm: preview.confirmation_token }, 'sibling')).toMatchObject({ committed: true });
    expect(tickets()[0]).toMatchObject({ token_id: null, consumed_at: expect.any(Number) });
    expect(await call({ ...args, confirm: preview.confirmation_token })).toEqual(invalid);
    expect(updates()).toEqual({ n: 1 });
  });
});

for (const source of ['schema', 'migrations'] as const) describe(`${source}: registered module confirmation token binding`, () => {
  it.each(['sibling', 'foreign'])('refuses the %s bearer without spending the collection preview', async bearer => {
    const { db, call, tickets } = await fixture(source);
    const args = { title: 'Previewed collection', note: 'Previewed note' };
    const preview = await call(args, 'issuer', 'create_collection');
    const beforeTickets = tickets();
    const domain = () => ({
      collections: db.sqlite.prepare('SELECT * FROM collections ORDER BY id').all(),
      items: db.sqlite.prepare('SELECT * FROM collection_items ORDER BY id').all(),
      audits: db.sqlite.prepare("SELECT * FROM activity_logs WHERE action='COLLECTION_CREATE_MCP' ORDER BY id").all(),
    });
    const before = domain();
    expect(await call({ ...args, confirm: preview.confirmation_token }, bearer, 'create_collection')).toEqual(invalid);
    expect(tickets()).toEqual(beforeTickets);
    expect(domain()).toEqual(before);
    expect(await call({ ...args, title: 'Unpreviewed title', confirm: preview.confirmation_token }, 'issuer', 'create_collection'))
      .toMatchObject({ committed: true, title: 'Previewed collection', status: 'draft' });
    const after = domain();
    expect(after.collections).toHaveLength(1);
    expect(after.collections[0]).toMatchObject({ account_id: 'acc-one', title: args.title, note: args.note });
    expect(after.audits).toHaveLength(1);
    const afterTickets = tickets();
    expect(await call({ ...args, confirm: preview.confirmation_token }, 'issuer', 'create_collection')).toEqual(invalid);
    expect(tickets()).toEqual(afterTickets);
    expect(domain()).toEqual(after);
  });

  it('keeps legacy NULL issuing-token compatibility in the module helper', async () => {
    const { db, call, tickets } = await fixture(source);
    const args = { title: 'Legacy preview' };
    const preview = await call(args, 'issuer', 'create_collection');
    db.sqlite.exec('UPDATE mcp_confirmation_tickets SET token_id = NULL');
    expect(await call({ ...args, confirm: preview.confirmation_token }, 'sibling', 'create_collection'))
      .toMatchObject({ committed: true });
    expect(tickets()[0]).toMatchObject({ token_id: null, consumed_at: expect.any(Number) });
    expect(await call({ ...args, confirm: preview.confirmation_token }, 'issuer', 'create_collection')).toEqual(invalid);
  });
});
