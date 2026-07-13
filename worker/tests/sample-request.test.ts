import { describe, expect, it } from 'vitest';
import worker from '../src/index';

const JWT_SECRET = 'sample-request-secret';
const ACCOUNT_ID = 'account-tea-house';
const USER_ID = 'member-requester';

function b64(value: string): string {
  return btoa(value);
}

async function signJwt(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64(JSON.stringify({
    sub: USER_ID,
    email: 'requester@example.com',
    active_account_id: ACCOUNT_ID,
    session_version: 0,
    iat: now,
    exp: now + 3600,
  }));
  const input = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(input));
  return `${input}.${b64(String.fromCharCode(...new Uint8Array(signature)))}`;
}

class SampleRequestDb {
  sampleSets: Array<Record<string, unknown>> = [];
  samples: Array<Record<string, unknown>> = [];

  prepare(sql: string) {
    const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase();
    let values: unknown[] = [];
    const statement = {
      bind: (...next: unknown[]) => { values = next; return statement; },
      first: async () => {
        if (normalized.includes('select session_version from users')) return { session_version: 0 };
        if (normalized.includes('select 1 from accounts')) return { 1: 1 };
        if (normalized.includes('select given_name, product_name, type from products')) {
          return values[0] === 'product-1' && values[1] === ACCOUNT_ID
            ? { given_name: 'Rou Gui', product_name: 'Rou Gui', type: 'Oolong' }
            : null;
        }
        if (normalized.includes('from tea_sample_sets') && normalized.includes("purpose = 'customer-request'")) {
          return this.sampleSets.find((set) => set.account_id === values[0] && set.user_id === values[1]) ?? null;
        }
        return null;
      },
      all: async () => ({ results: [] }),
      run: async () => {
        if (normalized.startsWith('insert or ignore into tea_sample_sets')) {
          const [id, accountId, name, purpose, notes, userId] = values;
          if (!this.sampleSets.some((set) => set.id === id)) {
            this.sampleSets.push({ id, account_id: accountId, name, purpose, notes, user_id: userId });
          }
        }
        if (normalized.startsWith('insert into tea_samples')) {
          const [id, accountId, name, productId, setId, grams, notes, userId, createdBy] = values;
          this.samples.push({
            id, account_id: accountId, name, product_id: productId, set_id: setId,
            status: 'requested', grams, notes, user_id: userId, created_by: createdBy,
          });
        }
        return { success: true, meta: { changes: 1 } };
      },
    };
    return statement;
  }

  async batch(statements: Array<{ run: () => Promise<unknown> }>) {
    return Promise.all(statements.map((statement) => statement.run()));
  }
}

async function requestSample(db: SampleRequestDb): Promise<Response> {
  const token = await signJwt();
  return worker.fetch(new Request('https://api.test/api/samples/request', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ product_id: 'product-1', quantity_grams: 8 }),
  }), { DB: db, JWT_SECRET } as never, {} as never);
}

describe('customer sample requests', () => {
  it('creates an owned account-scoped request set and links the sample to it', async () => {
    const db = new SampleRequestDb();
    const response = await requestSample(db);

    expect(response.status).toBe(201);
    expect(db.sampleSets).toHaveLength(1);
    expect(db.sampleSets[0]).toMatchObject({
      account_id: ACCOUNT_ID,
      user_id: USER_ID,
      purpose: 'customer-request',
    });
    expect(db.samples[0]).toMatchObject({
      account_id: ACCOUNT_ID,
      user_id: USER_ID,
      set_id: db.sampleSets[0].id,
    });
  });

  it('reuses the requester set instead of creating disconnected batches', async () => {
    const db = new SampleRequestDb();
    expect((await requestSample(db)).status).toBe(201);
    expect((await requestSample(db)).status).toBe(201);

    expect(db.sampleSets).toHaveLength(1);
    expect(db.samples).toHaveLength(2);
    expect(db.samples[0].set_id).toBe(db.samples[1].set_id);
  });
});
