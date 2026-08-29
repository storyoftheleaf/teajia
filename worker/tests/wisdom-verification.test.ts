import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';

const SECRET = 'wisdom-verification-secret';
const migration = readFileSync(new URL('../migrations.archived/123_wisdom_verifications.sql', import.meta.url), 'utf8');
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

async function token(platformRole: string | null = 'platform_owner') {
  const encode = (value: unknown) => btoa(JSON.stringify(value));
  const now = Math.floor(Date.now() / 1000);
  const data = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    sub: 'user-1', email: 'owner@test', name: 'Owner', platform_role: platformRole,
    active_account_id: 'account-a', session_version: 0, iat: now, exp: now + 3600,
  })}`;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return `${data}.${btoa(String.fromCharCode(...new Uint8Array(signature)))}`;
}

type Receipt = {
  id: string;
  account_id: string;
  entry_kind: string;
  entry_id: string;
  content_hash: string;
  verified_by_user_id: string;
  verified_at: string;
};

const normalized = (sql: string) => sql.replace(/\s+/g, ' ').trim().toLowerCase();

class VerificationDb {
  platformRole: string | null = 'platform_owner';
  receipts = new Map<string, Receipt>();
  prepare(sql: string) { return new VerificationStatement(this, sql); }
}

class VerificationStatement {
  private values: unknown[] = [];
  constructor(private db: VerificationDb, private raw: string) {}
  bind(...values: unknown[]) { this.values = values; return this; }
  async first() {
    const sql = normalized(this.raw);
    if (sql.includes('from users where id = ?')) return { platform_role: this.db.platformRole, session_version: 0 };
    if (sql.includes('select status from accounts where id = ?')) return { status: 'active' };
    if (sql.includes('from wisdom_entry_verifications')) {
      const [accountId, entryKind, entryId] = this.values;
      return this.db.receipts.get(`${accountId}:${entryKind}:${entryId}`) ?? null;
    }
    return null;
  }
  async run() {
    const sql = normalized(this.raw);
    if (sql.startsWith('insert into wisdom_entry_verifications')) {
      const [id, account_id, entry_kind, entry_id, content_hash, verified_by_user_id, verified_at] = this.values as string[];
      const key = `${account_id}:${entry_kind}:${entry_id}`;
      const existing = this.db.receipts.get(key);
      this.db.receipts.set(key, { id: existing?.id ?? id, account_id, entry_kind, entry_id, content_hash, verified_by_user_id, verified_at });
      return { success: true, meta: { changes: 1 } };
    }
    if (sql.startsWith('delete from wisdom_entry_verifications')) {
      const [accountId, entryKind, entryId] = this.values;
      const changed = this.db.receipts.delete(`${accountId}:${entryKind}:${entryId}`);
      return { success: true, meta: { changes: changed ? 1 : 0 } };
    }
    return { success: true, meta: { changes: 0 } };
  }
}

async function call(db: VerificationDb, path: string, method = 'GET', body?: unknown, account = 'account-a', bearer?: string) {
  const authorization = bearer === '' ? undefined : `Bearer ${bearer ?? await token()}`;
  return worker.fetch(new Request(`https://test${path}`, {
    method,
    headers: {
      ...(authorization ? { Authorization: authorization } : {}),
      'X-Teajia-Account': account,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), { DB: db, JWT_SECRET: SECRET } as any);
}

const path = '/api/wisdom/verifications/cultivar/rou-gui';
const hashA = 'a'.repeat(64);
const hashB = 'b'.repeat(64);

describe('Wisdom verification routes', () => {
  it('requires normal authentication and the current DB platform-owner role', async () => {
    expect((await call(new VerificationDb(), path, 'GET', undefined, 'account-a', '')).status).toBe(401);

    const demoted = new VerificationDb();
    demoted.platformRole = 'platform_admin';
    const response = await call(demoted, path, 'GET', undefined, 'account-a', await token('platform_owner'));
    expect(response.status).toBe(403);
  });

  it.each([
    ['/api/wisdom/verifications/tea/rou-gui', 'GET', undefined],
    ['/api/wisdom/verifications/cultivar/Bad_Id', 'GET', undefined],
    [path, 'PUT', { content_hash: 'A'.repeat(64) }],
    [path, 'PUT', { content_hash: 'a'.repeat(63) }],
  ])('returns 400 for invalid kind, id, or hash', async (requestPath, method, body) => {
    expect((await call(new VerificationDb(), requestPath, method, body)).status).toBe(400);
  });

  it('upserts one private receipt and returns only the public-safe receipt shape', async () => {
    const db = new VerificationDb();
    const created = await call(db, path, 'PUT', { content_hash: hashA });
    expect(created.status).toBe(200);
    expect(Object.keys(await created.json())).toEqual(['entry_kind', 'entry_id', 'content_hash', 'verified_at']);

    const updated = await call(db, path, 'PUT', { content_hash: hashB });
    expect(updated.status).toBe(200);
    expect(db.receipts).toHaveLength(1);
    expect(await updated.json()).toMatchObject({ entry_kind: 'cultivar', entry_id: 'rou-gui', content_hash: hashB });
    expect(JSON.stringify(await (await call(db, path)).json())).not.toMatch(/email|private|evidence|trust|verified_by/i);
  });

  it('isolates reads and deletes by account', async () => {
    const db = new VerificationDb();
    await call(db, path, 'PUT', { content_hash: hashA }, 'account-a');
    expect(await (await call(db, path, 'GET', undefined, 'account-b')).json()).toBeNull();
    expect((await (await call(db, path, 'GET', undefined, 'account-a')).json() as Receipt).content_hash).toBe(hashA);

    expect(await (await call(db, path, 'DELETE', undefined, 'account-b')).json()).toBeNull();
    expect(db.receipts).toHaveLength(1);
    expect((await call(db, path, 'DELETE', undefined, 'account-a')).status).toBe(200);
    expect(db.receipts).toHaveLength(0);
    expect(await (await call(db, path)).json()).toBeNull();
  });
});

describe('Wisdom verification migration 123', () => {
  it('enforces account uniqueness, entry kinds, lowercase SHA-256 hashes, and the lookup index', () => {
    const directory = mkdtempSync(join(tmpdir(), 'teajia-wisdom-verification-'));
    temporaryDirectories.push(directory);
    const database = join(directory, 'migration.sqlite');
    execFileSync('sqlite3', [database], { input: migration });
    const insert = (id: string, account: string, kind: string, hash: string) => execFileSync('sqlite3', [database], { input: `
      INSERT INTO wisdom_entry_verifications
        (id, account_id, entry_kind, entry_id, content_hash, verified_by_user_id)
      VALUES ('${id}', '${account}', '${kind}', 'rou-gui', '${hash}', 'user-1');
    ` });

    insert('one', 'account-a', 'cultivar', hashA);
    insert('two', 'account-b', 'cultivar', hashA);
    expect(() => insert('duplicate', 'account-a', 'cultivar', hashB)).toThrow();
    expect(() => insert('kind', 'account-a', 'tea', hashA)).toThrow();
    expect(() => insert('uppercase', 'account-a', 'region', 'A'.repeat(64))).toThrow();
    expect(() => insert('short', 'account-a', 'style', 'a'.repeat(63))).toThrow();
    const indexes = JSON.parse(execFileSync('sqlite3', ['-json', database, `PRAGMA index_list('wisdom_entry_verifications')`], { encoding: 'utf8' }) || '[]') as Array<{ name: string }>;
    expect(indexes.map(index => index.name)).toContain('idx_wisdom_verifications_account_entry');
  });
});
