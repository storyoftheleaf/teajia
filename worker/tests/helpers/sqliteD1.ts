import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync, type StatementSync } from 'node:sqlite';

class SqliteStatement {
  private values: unknown[] = [];

  constructor(private readonly statement: StatementSync) {}

  bind(...values: unknown[]) {
    this.values = values;
    return this;
  }

  first<T = Record<string, unknown>>() {
    return (this.statement.get(...this.values) as T | undefined) ?? null;
  }

  all<T = Record<string, unknown>>() {
    return { results: this.statement.all(...this.values) as T[], success: true };
  }

  run() {
    const result = this.statement.run(...this.values);
    return { success: true, meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } };
  }
}

export class SqliteD1 {
  readonly sqlite = new DatabaseSync(':memory:');

  constructor(loadSchema = true) {
    this.sqlite.exec('PRAGMA foreign_keys = ON');
    if (loadSchema) {
      this.sqlite.exec(readFileSync(join(process.cwd(), 'worker/schema.sql'), 'utf8'));
    }
  }

  prepare(sql: string) {
    return new SqliteStatement(this.sqlite.prepare(sql));
  }

  batch(statements: SqliteStatement[]) {
    this.sqlite.exec('BEGIN IMMEDIATE');
    try {
      const results = statements.map(statement => statement.run());
      this.sqlite.exec('COMMIT');
      return results;
    } catch (error) {
      this.sqlite.exec('ROLLBACK');
      throw error;
    }
  }

  exec(sql: string) {
    this.sqlite.exec(sql);
  }

  close() {
    this.sqlite.close();
  }
}

const encode = (value: object) => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value))));

export async function signedToken(secret: string, claims: Record<string, unknown>) {
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const now = Math.floor(Date.now() / 1000);
  const payload = encode({ iat: now, exp: now + 3600, session_version: 0, ...claims });
  const data = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return `${data}.${btoa(String.fromCharCode(...new Uint8Array(signature)))}`;
}

export function seedIdentity(db: SqliteD1, options: {
  userId?: string;
  accountId?: string;
  accountSlug?: string;
  role?: 'owner' | 'staff' | 'viewer';
  bundles?: string[];
  platformRole?: 'platform_owner' | 'platform_admin' | null;
  publicEnabled?: boolean;
} = {}) {
  const userId = options.userId ?? 'user-one';
  const accountId = options.accountId ?? 'acc-one';
  const accountSlug = options.accountSlug ?? accountId;
  db.sqlite.prepare(`INSERT OR IGNORE INTO accounts (id, slug, name, status, public_enabled)
    VALUES (?, ?, ?, 'active', ?)`).run(accountId, accountSlug, accountSlug, options.publicEnabled === false ? 0 : 1);
  db.sqlite.prepare(`INSERT OR IGNORE INTO users
    (id, email, name, password_hash, role, platform_role, session_version)
    VALUES (?, ?, ?, 'test', 'user', ?, 0)`).run(userId, `${userId}@test.dev`, userId, options.platformRole ?? null);
  db.sqlite.prepare(`INSERT OR REPLACE INTO account_members
    (id, account_id, user_id, role, permissions, status)
    VALUES (?, ?, ?, ?, ?, 'active')`).run(
      `member-${accountId}-${userId}`,
      accountId,
      userId,
      options.role ?? 'owner',
      JSON.stringify({ bundles: options.bundles ?? ['catalog', 'stock', 'publish'] }),
    );
  return { userId, accountId, email: `${userId}@test.dev` };
}
