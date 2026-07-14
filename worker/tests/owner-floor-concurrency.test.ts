import { describe, expect, it } from 'vitest';
import worker from '../src/index';

const ACCOUNT_ID = 'acc_owner_floor';
const JWT_SECRET = 'owner-floor-secret';

function encodeBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  return btoa(String.fromCharCode(...bytes));
}

async function platformOwnerToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = encodeBase64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = encodeBase64(JSON.stringify({
    sub: 'platform-owner',
    email: 'owner@teajia.test',
    name: 'Platform Owner',
    platform_role: 'platform_owner',
    active_account_id: ACCOUNT_ID,
    session_version: 0,
    iat: now,
    exp: now + 3600,
  }));
  const input = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(input));
  return `${input}.${btoa(String.fromCharCode(...new Uint8Array(signature)))}`;
}

type Member = { role: string; status: string };

class OwnerFloorStatement {
  values: unknown[] = [];

  constructor(
    readonly sql: string,
    private readonly db: OwnerFloorDb,
  ) {}

  bind(...values: unknown[]) {
    this.values = values;
    return this;
  }

  async first() {
    const sql = this.sql.replace(/\s+/g, ' ').trim().toLowerCase();
    if (sql.includes('select platform_role, session_version from users')) {
      return { platform_role: 'platform_owner', session_version: 0 };
    }
    if (sql.includes('select status from accounts')) return { status: 'active' };
    if (sql.includes('select role, status from account_members')) {
      const member = this.db.members.get(String(this.values[1]));
      return member ? { ...member } : null;
    }
    if (sql.includes('select count(*) as count from account_members')) {
      // Model the stale preflight snapshot that permits both concurrent requests.
      return { count: 2 };
    }
    return null;
  }

  async all() {
    return { results: [] };
  }

  run() {
    return this.db.execute(this);
  }
}

class OwnerFloorDb {
  readonly members = new Map<string, Member>([
    ['owner-a', { role: 'owner', status: 'active' }],
    ['owner-b', { role: 'owner', status: 'active' }],
  ]);

  private transactionTail: Promise<unknown> = Promise.resolve();

  prepare(sql: string) {
    return new OwnerFloorStatement(sql, this);
  }

  async batch(statements: OwnerFloorStatement[]) {
    const transaction = this.transactionTail.then(async () => {
      const results = [];
      for (const statement of statements) results.push(await this.execute(statement));
      return results;
    });
    this.transactionTail = transaction.then(() => undefined, () => undefined);
    return transaction;
  }

  async execute(statement: OwnerFloorStatement) {
    const sql = statement.sql.replace(/\s+/g, ' ').trim().toLowerCase();
    if (sql.startsWith('update account_members set')) {
      const userId = String(statement.values.at(-1));
      const member = this.members.get(userId);
      const guarded = sql.includes('exists (');
      const anotherOwnerExists = [...this.members.entries()].some(([id, row]) => (
        id !== userId && row.role === 'owner' && row.status === 'active'
      ));
      if (!member || (guarded && member.role === 'owner' && member.status === 'active' && !anotherOwnerExists)) {
        return { success: true, meta: { changes: 0 } };
      }
      member.role = String(statement.values[0]);
      return { success: true, meta: { changes: 1 } };
    }
    if (sql.startsWith('delete from account_members')) {
      const userId = String(statement.values[1]);
      const member = this.members.get(userId);
      const guarded = sql.includes('exists (');
      const anotherOwnerExists = [...this.members.entries()].some(([id, row]) => (
        id !== userId && row.role === 'owner' && row.status === 'active'
      ));
      if (!member || (guarded && member.role === 'owner' && member.status === 'active' && !anotherOwnerExists)) {
        return { success: true, meta: { changes: 0 } };
      }
      this.members.delete(userId);
      return { success: true, meta: { changes: 1 } };
    }
    return { success: true, meta: { changes: 1 } };
  }
}

async function request(db: OwnerFloorDb, path: string, init: RequestInit) {
  const token = await platformOwnerToken();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('X-Teajia-Account', ACCOUNT_ID);
  if (init.body) headers.set('Content-Type', 'application/json');
  return worker.fetch(new Request(`https://worker.test${path}`, { ...init, headers }), {
    DB: db,
    JWT_SECRET,
  } as any);
}

function activeOwnerCount(db: OwnerFloorDb): number {
  return [...db.members.values()].filter(member => member.role === 'owner' && member.status === 'active').length;
}

describe('active owner floor concurrency', () => {
  it('atomically rejects the second concurrent owner demotion', async () => {
    const db = new OwnerFloorDb();
    const responses = await Promise.all(['owner-a', 'owner-b'].map(userId => request(
      db,
      `/api/accounts/${ACCOUNT_ID}/members/${userId}`,
      { method: 'PUT', body: JSON.stringify({ role: 'staff' }) },
    )));

    expect(responses.map(response => response.status).sort()).toEqual([200, 409]);
    expect(activeOwnerCount(db)).toBe(1);
    expect(await responses.find(response => response.status === 409)!.json()).toMatchObject({ code: 'owner_floor_violation' });
  });

  it('atomically rejects the second concurrent owner deletion', async () => {
    const db = new OwnerFloorDb();
    const responses = await Promise.all(['owner-a', 'owner-b'].map(userId => request(
      db,
      `/api/accounts/${ACCOUNT_ID}/members/${userId}`,
      { method: 'DELETE' },
    )));

    expect(responses.map(response => response.status).sort()).toEqual([200, 409]);
    expect(activeOwnerCount(db)).toBe(1);
    expect(await responses.find(response => response.status === 409)!.json()).toMatchObject({ code: 'owner_floor_violation' });
  });
});
