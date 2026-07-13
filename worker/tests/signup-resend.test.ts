import { describe, expect, it } from 'vitest';
import worker from '../src/index';

const SECRET = 'signup-resend-secret';
const EMAIL = 'pending@example.com';

async function hmac(value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return [...new Uint8Array(signature)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

type Challenge = {
  id: string;
  user_id: string;
  email_normalized: string;
  code_hash: string;
  client_nonce_hash: string;
  expires_at: string;
  created_at: string;
  failed_attempts: number;
  consumed_at: string | null;
};

class ResendStatement {
  values: unknown[] = [];

  constructor(readonly sql: string, private readonly db: ResendDb) {}

  bind(...values: unknown[]) {
    this.values = values;
    return this;
  }

  async first() {
    const sql = this.sql.replace(/\s+/g, ' ').trim().toLowerCase();
    if (sql.includes('from identity_email_verifications v join users u')) {
      const email = String(this.values[0]);
      const challenge = [...this.db.challenges].reverse().find(row => (
        row.email_normalized === email
        && (!sql.includes('v.consumed_at is null') || row.consumed_at === null)
      ));
      if (!challenge) return null;
      if (sql.includes("v.expires_at > datetime('now')") && new Date(challenge.expires_at).getTime() <= Date.now()) return null;
      if (sql.includes("v.created_at > datetime('now', '-24 hours')") && new Date(challenge.created_at).getTime() <= Date.now() - 24 * 60 * 60_000) return null;
      return { ...challenge, ...this.db.user };
    }
    return null;
  }

  async all() {
    return { results: [] };
  }

  run() {
    const sql = this.sql.replace(/\s+/g, ' ').trim().toLowerCase();
    if (sql.startsWith('update identity_email_verifications set client_nonce_hash')) {
      const [replacement, id, expected] = this.values.map(String);
      const challenge = this.db.challenges.find(row => row.id === id);
      if (!challenge || challenge.client_nonce_hash !== expected || this.db.user.email_verified_at) {
        return Promise.resolve({ success: true, meta: { changes: 0 } });
      }
      challenge.client_nonce_hash = replacement;
      return Promise.resolve({ success: true, meta: { changes: 1 } });
    }
    if (sql.startsWith('insert into identity_email_verifications')) {
      const [id, userId, email, codeHash, nonceHash, priorId, spentNonce] = this.values.map(String);
      const prior = this.db.challenges.find(row => row.id === priorId && row.client_nonce_hash === spentNonce);
      if (!prior || this.db.user.email_verified_at) return Promise.resolve({ success: true, meta: { changes: 0 } });
      this.db.challenges.push({
        id,
        user_id: userId,
        email_normalized: email,
        code_hash: codeHash,
        client_nonce_hash: nonceHash,
        expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
        created_at: new Date().toISOString(),
        failed_attempts: 0,
        consumed_at: null,
      });
      return Promise.resolve({ success: true, meta: { changes: 1 } });
    }
    if (sql.startsWith('update identity_email_verifications set failed_attempts')) {
      const challenge = this.db.challenges.find(row => row.id === String(this.values[0]));
      if (challenge) {
        challenge.failed_attempts += 1;
        if (challenge.failed_attempts >= 3) challenge.consumed_at = new Date().toISOString();
      }
      return Promise.resolve({ success: true, meta: { changes: challenge ? 1 : 0 } });
    }
    if (sql.startsWith('update identity_email_verifications set consumed_at')) {
      const challenge = this.db.challenges.find(row => row.id === String(this.values[1]));
      if (!challenge || challenge.consumed_at) return Promise.resolve({ success: true, meta: { changes: 0 } });
      challenge.consumed_at = String(this.values[0]);
      return Promise.resolve({ success: true, meta: { changes: 1 } });
    }
    if (sql.startsWith('update users set email_verified_at')) {
      if (String(this.values[1]) !== this.db.user.user_id || String(this.values[2]) !== EMAIL) {
        return Promise.resolve({ success: true, meta: { changes: 0 } });
      }
      this.db.user.email_verified_at = String(this.values[0]);
      return Promise.resolve({ success: true, meta: { changes: 1 } });
    }
    return Promise.resolve({ success: true, meta: { changes: 1 } });
  }
}

class ResendDb {
  user = {
    user_id: 'pending-user',
    email: EMAIL,
    name: 'Pending',
    username: null,
    role: 'user',
    platform_role: null,
    session_version: 0,
    email_verified_at: null as string | null,
  };

  constructor(readonly challenges: Challenge[]) {}

  prepare(sql: string) {
    return new ResendStatement(sql, this);
  }

  async batch(statements: ResendStatement[]) {
    const results = [];
    for (const statement of statements) results.push(await statement.run());
    return results;
  }
}

async function seededDb(): Promise<ResendDb> {
  return new ResendDb([{
    id: 'failed-challenge',
    user_id: 'pending-user',
    email_normalized: EMAIL,
    code_hash: await hmac('111111'),
    client_nonce_hash: await hmac('prior-signup-token'),
    expires_at: new Date(Date.now() - 60_000).toISOString(),
    created_at: new Date(Date.now() - 60 * 60_000).toISOString(),
    failed_attempts: 3,
    consumed_at: new Date().toISOString(),
  }]);
}

async function call(db: ResendDb, path: string, body: Record<string, unknown>, extraEnv: Record<string, unknown> = {}) {
  const response = await worker.fetch(new Request(`https://worker.test${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.8' },
    body: JSON.stringify(body),
  }), { DB: db, JWT_SECRET: SECRET, DEV_RETURN_VERIFY_CODES: 'true', ...extraEnv } as any);
  return { response, body: await response.json() as any };
}

describe('signup verification resend', () => {
  it('rejects recovery proof outside the bounded restart window', async () => {
    const db = await seededDb();
    db.challenges[0].created_at = new Date(Date.now() - 25 * 60 * 60_000).toISOString();

    const stale = await call(db, '/api/auth/signup/resend', { email: EMAIL, signup_token: 'prior-signup-token' });

    expect(stale.response.status).toBe(401);
    expect(stale.body).toMatchObject({ code: 'verification_invalid' });
  });

  it('does not consume the prior proof when code delivery fails', async () => {
    const db = await seededDb();
    const priorNonceHash = db.challenges[0].client_nonce_hash;

    const failed = await call(
      db,
      '/api/auth/signup/resend',
      { email: EMAIL, signup_token: 'prior-signup-token' },
      { DEV_RETURN_VERIFY_CODES: undefined },
    );

    expect(failed.response.status).toBe(503);
    expect(failed.body).toMatchObject({ code: 'verification_delivery_failed' });
    expect(db.challenges).toHaveLength(1);
    expect(db.challenges[0].client_nonce_hash).toBe(priorNonceHash);

    const retry = await call(db, '/api/auth/signup/resend', { email: EMAIL, signup_token: 'prior-signup-token' });
    expect(retry.response.status).toBe(202);
  });

  it('restarts an expired challenge while retaining proof-of-possession', async () => {
    const db = await seededDb();
    db.challenges[0].failed_attempts = 0;
    db.challenges[0].consumed_at = null;

    const resent = await call(db, '/api/auth/signup/resend', { email: EMAIL, signup_token: 'prior-signup-token' });

    expect(resent.response.status).toBe(202);
    expect(resent.body).toMatchObject({ verification_required: true, signup_token: expect.any(String) });
    expect(resent.body).not.toHaveProperty('token');
  });

  it('recovers a three-failure challenge by rotating both proof and code before authentication', async () => {
    const db = await seededDb();
    const resent = await call(db, '/api/auth/signup/resend', { email: EMAIL, signup_token: 'prior-signup-token' });

    expect(resent.response.status).toBe(202);
    expect(resent.body).toMatchObject({
      verification_required: true,
      code: 'email_verification_required',
      signup_token: expect.any(String),
      verification_code: expect.any(String),
    });
    expect(resent.body).not.toHaveProperty('token');
    expect(resent.body.signup_token).not.toBe('prior-signup-token');

    const stale = await call(db, '/api/auth/signup/verify', {
      email: EMAIL,
      code: '111111',
      signup_token: 'prior-signup-token',
    });
    expect(stale.response.status).toBe(401);

    const verified = await call(db, '/api/auth/signup/verify', {
      email: EMAIL,
      code: resent.body.verification_code,
      signup_token: resent.body.signup_token,
    });
    expect(verified.response.status).toBe(200);
    expect(verified.body).toHaveProperty('token');

    const takeover = await call(db, '/api/auth/signup/resend', {
      email: EMAIL,
      signup_token: resent.body.signup_token,
    });
    expect(takeover.response.status).toBe(401);
    expect(takeover.body).toMatchObject({ code: 'verification_invalid' });
  });

  it('uses the same rejection for unknown identities and invalid proof, and enforces the durable limiter', async () => {
    const wrongProofDb = await seededDb();
    const wrongProof = await call(wrongProofDb, '/api/auth/signup/resend', { email: EMAIL, signup_token: 'wrong' });
    const unknown = await call(new ResendDb([]), '/api/auth/signup/resend', { email: 'unknown@example.com', signup_token: 'wrong' });
    expect({ status: wrongProof.response.status, body: wrongProof.body }).toEqual({ status: unknown.response.status, body: unknown.body });

    const limited = await call(await seededDb(), '/api/auth/signup/resend', { email: EMAIL, signup_token: 'prior-signup-token' }, {
      VERIFY_LIMITER: { limit: async () => ({ success: false }) },
    });
    expect(limited.response.status).toBe(429);
    expect(limited.body).toMatchObject({ code: 'rate_limited' });
  });
});
