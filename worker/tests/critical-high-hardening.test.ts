import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import worker from '../src/index';

const source = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');
const schema = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
const wrangler = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');

describe('critical and high hardening contracts', () => {
  it('protects platform-owner recovery with a fresh target-tier check', () => {
    expect(source).toContain("target_tier_denied");
    expect(source).toMatch(/SELECT id, email, name, platform_role FROM users WHERE id = \?/);
    expect(source).toMatch(/resolveDbPlatformRole\(env, claims\.sub\)/);
  });

  it('requires verified email before issuing a signup session or activating an invitation', () => {
    expect(schema).toContain('email_verified_at TEXT');
    expect(schema).toContain('identity_email_verifications');
    expect(source).toContain("code: 'email_verification_required'");
    expect(source).toContain('handleVerifySignupEmail');
    expect(source).toContain('signupTokenValid');
    expect(source).toContain('email_verified_at: new Date().toISOString()');
    expect(source).toMatch(/gUser\.verified_email !== true/);
  });

  it('issues a signup session only when the email code and browser nonce both match', async () => {
    const state: Record<string, any> = { user: null, verification: null };
    const db = {
      prepare(sql: string) {
        let values: unknown[] = [];
        const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase();
        const statement = {
          bind(...next: unknown[]) { values = next; return statement; },
          async first() {
            if (normalized.includes('from identity_email_verifications v join users')) {
              return state.verification && state.user ? { ...state.verification, ...state.user, user_id: state.user.id } : null;
            }
            if (normalized.includes('from users where lower(email)')) return state.user;
            return null;
          },
          async all() { return { results: [] }; },
          async run() {
            if (normalized.startsWith('insert into users')) {
              state.user = { id: values[0], email: values[1], username: values[2], name: values[3], role: 'user', platform_role: null, session_version: 0 };
            } else if (normalized.startsWith('insert into identity_email_verifications')) {
              state.verification = { id: values[0], code_hash: values[3], client_nonce_hash: values[4], failed_attempts: 0 };
            } else if (normalized.startsWith('update identity_email_verifications set consumed_at')) {
              state.verification.consumed_at = values[0];
            } else if (normalized.startsWith('update users set email_verified_at')) {
              state.user.email_verified_at = values[0];
            }
            return { success: true, meta: { changes: 1 } };
          },
        };
        return statement;
      },
      async batch(statements: Array<{ run: () => Promise<unknown> }>) { return Promise.all(statements.map(statement => statement.run())); },
    };
    const env = { DB: db, JWT_SECRET: 'signup-secret', DEV_RETURN_VERIFY_CODES: 'true' } as any;
    const signup = await worker.fetch(new Request('https://worker.test/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': 'signup-nonce-test' },
      body: JSON.stringify({ email: 'new@example.com', password: 'correct horse', name: 'New' }),
    }), env);
    const pending = await signup.json() as any;
    expect(signup.status).toBe(202);
    expect(pending).not.toHaveProperty('token');

    const confirm = async (signupToken: string) => worker.fetch(new Request('https://worker.test/api/auth/signup/verify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'new@example.com', code: pending.verification_code, signup_token: signupToken }),
    }), env);
    expect((await confirm('stolen-email-code-without-browser-nonce')).status).toBe(401);
    const verified = await confirm(pending.signup_token);
    expect(verified.status).toBe(200);
    expect(await verified.json()).toMatchObject({ token: expect.any(String), email_verified_at: expect.any(String) });
  });

  it('preserves owner and membership invariants and revokes affected MCP tokens', () => {
    expect(source).not.toContain('INSERT OR REPLACE INTO account_members');
    expect(source).toContain("owner_assignment_denied");
    expect(source).toContain("membership_exists");
    expect(source).toContain("owner_floor_violation");
    expect(source).toMatch(/UPDATE mcp_tokens SET revoked_at = datetime\('now'\)/);
  });

  it('scopes note conflict updates to the active tenant and author', () => {
    expect(source).toContain('tenant_collision');
    expect(source).toContain('WHERE notes.account_id = excluded.account_id AND notes.author_id = excluded.author_id');
    expect(source).toContain('WHERE note_sessions.account_id = excluded.account_id');
  });

  it('partitions product creation by capabilities and validates intake batches', () => {
    expect(source).toContain('validateProductCreateCapabilities');
    expect(source).toContain("required_bundle: 'stock'");
    expect(source).toContain("required_bundle: 'sell'");
    expect(source).toContain("required_bundle: 'publish'");
    expect(source).toContain("batch_account_mismatch");
  });

  it('durably limits provider work and serializes migration jobs', () => {
    expect(schema).toContain('provider_jobs');
    expect(source).toContain(':enhance-product-image');
    expect(source).toContain(':migrate-tasting');
    expect(source).toContain('provider_job_in_progress');
  });

  it('drains recording expiry in pages and keeps failed rows retryable', () => {
    expect(wrangler).toContain('crons = ["0 * * * *"]');
    expect(source).toMatch(/for \(let page = 0; page < 10; page \+= 1\)/);
    expect(source).toContain('Private recording expiry cleanup summary');
  });

  it('deletes a 250-row recording backlog and retains an R2 failure', async () => {
    const recordings = Array.from({ length: 250 }, (_, index) => ({ id: `r${String(index).padStart(3, '0')}`, object_key: `private/${index}`, expires_at: '2026-01-01T00:00:00.000Z' }));
    const failedKey = 'private/7';
    const db = {
      prepare(sql: string) {
        let values: unknown[] = [];
        return {
          bind(...next: unknown[]) { values = next; return this; },
          async all() {
            if (sql.includes('FROM private_recordings')) {
              const cursorId = values[2] as string | undefined;
              return { results: recordings.filter(row => !cursorId || row.id > cursorId).slice(0, 100) };
            }
            return { results: [] };
          },
          async run() {
            if (sql.includes('DELETE FROM private_recordings')) {
              const index = recordings.findIndex(row => row.id === values[0]);
              if (index >= 0) recordings.splice(index, 1);
            }
            return { success: true, meta: { changes: 1 } };
          },
        };
      },
      async batch(statements: Array<{ run: () => Promise<unknown> }>) { return Promise.all(statements.map(statement => statement.run())); },
    };
    const bucket = {
      async delete(key: string) { if (key === failedKey) throw new Error('injected'); },
    };
    const originalInfo = console.info;
    console.info = () => undefined;
    try {
      await worker.scheduled({} as ScheduledEvent, { DB: db, MEDIA_BUCKET: bucket } as any, {} as ExecutionContext);
    } finally {
      console.info = originalInfo;
    }
    expect(recordings).toEqual([{ id: 'r007', object_key: failedKey, expires_at: '2026-01-01T00:00:00.000Z' }]);
  });
});
