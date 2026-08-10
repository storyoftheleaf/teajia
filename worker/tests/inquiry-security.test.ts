import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import worker from '../src/index';

const migrationSql = readFileSync(new URL('../migrations/127_secure_inquiry_tracking.sql', import.meta.url), 'utf8');
const JWT_SECRET = 'inquiry-security-secret';

type InquiryRow = Record<string, unknown> & {
  id: string;
  account_id: string;
  tracking_token_hash: string;
  ref_number: string;
  request_fingerprint: string;
};

class InquiryDb {
  readonly accounts = new Map<string, { id: string; status: string; public_enabled: number }>([
    ['bali', { id: 'account-bali', status: 'active', public_enabled: 1 }],
    ['sydney', { id: 'account-sydney', status: 'active', public_enabled: 1 }],
    ['private', { id: 'account-private', status: 'active', public_enabled: 0 }],
    ['inactive', { id: 'account-inactive', status: 'inactive', public_enabled: 1 }],
  ]);
  readonly products = new Map([
    ['tea-1', 'account-bali'],
    ['tea-2', 'account-bali'],
    ['sydney-tea', 'account-sydney'],
  ]);
  readonly inquiries: InquiryRow[] = [];
  tokenLookupMisses = 0;

  prepare(sql: string) {
    const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase();
    let values: unknown[] = [];
    const statement = {
      bind: (...next: unknown[]) => { values = next; return statement; },
      first: async () => {
        if (normalized.includes('select platform_role, session_version from users where id = ?')) {
          return { platform_role: null, session_version: 0 };
        }
        if (normalized.includes('from account_members am') && normalized.includes('join accounts a')) {
          const [userId, accountId] = values.map(String);
          if (accountId !== 'account-bali' || !['seller', 'member'].includes(userId)) return null;
          return {
            role: 'staff',
            permissions: JSON.stringify({ bundles: userId === 'seller' ? ['sell'] : [] }),
            kind: 'location',
          };
        }
        if (normalized.includes('select status from accounts where id = ?')) {
          const account = [...this.accounts.values()].find(candidate => candidate.id === values[0]);
          return account ? { status: account.status } : null;
        }
        if (normalized.includes('select id from accounts where slug = ?')) {
          const account = this.accounts.get(String(values[0]));
          if (!account) return null;
          if (normalized.includes("status = 'active'") && account.status !== 'active') return null;
          if (normalized.includes('public_enabled = 1') && account.public_enabled !== 1) return null;
          return { id: account.id };
        }
        if (normalized.includes('from inquiries where tracking_token_hash = ?')) {
          if (this.tokenLookupMisses > 0) {
            this.tokenLookupMisses -= 1;
            return null;
          }
          return this.inquiries.find((row) => row.tracking_token_hash === values[0]) ?? null;
        }
        return null;
      },
      all: async () => {
        if (normalized.includes('from inquiries where account_id = ?')) {
          const accountId = String(values[0]);
          const status = normalized.includes('and status = ?') ? String(values[1]) : null;
          return {
            results: this.inquiries.filter(row => row.account_id === accountId && (!status || row.status === status)),
          };
        }
        if (normalized.includes('from products') && normalized.includes('account_id = ?')) {
          const [accountId, ...ids] = values.map(String);
          return {
            results: [...new Set(ids)]
              .filter((id) => this.products.get(id) === accountId)
              .map((id) => ({ id })),
          };
        }
        return { results: [] };
      },
      run: async () => {
        if (normalized.startsWith('update inquiries set status = ?')) {
          const [status, id, accountId] = values.map(String);
          const row = this.inquiries.find(candidate => candidate.id === id && candidate.account_id === accountId);
          if (!row) return { success: true, meta: { changes: 0 } };
          row.status = status;
          return { success: true, meta: { changes: 1 } };
        }
        if (!normalized.startsWith('insert into inquiries')) {
          return { success: true, meta: { changes: 0 } };
        }
        const columns = sql.match(/inquiries\s*\(([^)]+)\)/i)?.[1]
          .split(',').map((column) => column.trim()) ?? [];
        const row = Object.fromEntries(columns.map((column, index) => [column, values[index]])) as InquiryRow;
        if (row.total_usd === null) throw new Error('NOT NULL constraint failed: inquiries.total_usd');
        if (row.tracking_token_hash && this.inquiries.some((existing) => existing.tracking_token_hash === row.tracking_token_hash)) {
          throw new Error('UNIQUE constraint failed: inquiries.tracking_token_hash');
        }
        this.inquiries.push({
          status: 'new',
          created_at: '2026-08-10 09:15:00',
          ...row,
        });
        return { success: true, meta: { changes: 1 } };
      },
    };
    return statement;
  }
}

const TOKEN = 'u1k4J9VQxw0_3qM-DlE7trC2jYfpaN8AsZboX6GmKPs';
const SECOND_TOKEN = 'Z7mYx1bWQk9_nB2p-RfC6JvA8sTgE4uH0dLoP3iNcXw';

function createPayload(overrides: Record<string, unknown> = {}) {
  return {
    tracking_token: TOKEN,
    ref_number: 'TJ-20260810-A1B2C3D4',
    store_slug: 'bali',
    customer_name: 'Private Person',
    customer_contact: 'private@example.com',
    customer_location: 'Denpasar, Indonesia',
    items: [{
      id: 'tea-1', name: 'Rou Gui', category: 'tea', storeSlug: 'bali',
      quantityGrams: 25, pricePerGram: 1, totalPrice: 25,
    }],
    total_estimate_usd: 25,
    currency: 'usd',
    source: 'whatsapp',
    ...overrides,
  };
}

async function post(db: InquiryDb, payload: Record<string, unknown>) {
  return worker.fetch(new Request('https://api.test/api/inquiries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }), { DB: db } as never, {} as never);
}

async function get(db: InquiryDb, tokenOrRef: string) {
  return worker.fetch(
    new Request(`https://api.test/api/inquiries/${encodeURIComponent(tokenOrRef)}`),
    { DB: db } as never,
    {} as never,
  );
}

function encodeJwtSegment(value: Record<string, unknown>): string {
  return btoa(JSON.stringify(value));
}

async function operatorToken(userId: 'seller' | 'member'): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = encodeJwtSegment({ alg: 'HS256', typ: 'JWT' });
  const payload = encodeJwtSegment({
    sub: userId,
    email: `${userId}@example.com`,
    name: userId,
    active_account_id: 'account-bali',
    session_version: 0,
    iat: now,
    exp: now + 3600,
  });
  const unsigned = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(unsigned));
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return `${unsigned}.${encodedSignature}`;
}

async function adminRequest(
  db: InquiryDb,
  path = '/api/admin/inquiries',
  init: RequestInit = {},
  userId?: 'seller' | 'member',
) {
  const headers = new Headers(init.headers);
  if (userId) headers.set('Authorization', `Bearer ${await operatorToken(userId)}`);
  headers.set('X-Teajia-Account', 'account-bali');
  if (init.body) headers.set('Content-Type', 'application/json');
  return worker.fetch(new Request(`https://api.test${path}`, { ...init, headers }), {
    DB: db,
    JWT_SECRET,
  } as never, {} as never);
}

describe('private inquiry tracking', () => {
  it('indexes account references in newest-first order', () => {
    expect(migrationSql).toMatch(/ON inquiries\s*\(account_id, ref_number, created_at DESC\)/i);
  });

  it('adds a request fingerprint to the inquiry schema', () => {
    expect(migrationSql).toMatch(/ADD COLUMN request_fingerprint TEXT/i);
  });

  it('requires a store for cart inquiries', async () => {
    const response = await post(new InquiryDb(), createPayload({ store_slug: undefined }));
    expect(response.status).toBe(400);
  });

  it.each(['unknown', 'inactive', 'private'])('hides unavailable store %s behind a 404', async (storeSlug) => {
    const db = new InquiryDb();
    const response = await post(db, createPayload({
      store_slug: storeSlug,
      items: [{
        id: 'tea-1', name: 'Rou Gui', category: 'tea', storeSlug,
        quantityGrams: 25, pricePerGram: 1, totalPrice: 25,
      }],
    }));
    expect(response.status).toBe(404);
    expect(db.inquiries).toHaveLength(0);
  });

  it.each([
    { field: 'id', value: '' },
    { field: 'name', value: '' },
    { field: 'category', value: 'service' },
    { field: 'quantityGrams', value: 0 },
    { field: 'quantityGrams', value: null },
    { field: 'pricePerGram', value: -1 },
    { field: 'pricePerGram', value: null },
    { field: 'totalPrice', value: -1 },
    { field: 'totalPrice', value: null },
  ])('rejects malformed line field $field=$value', async ({ field, value }) => {
    const item = { ...(createPayload().items as Array<Record<string, unknown>>)[0], [field]: value };
    const response = await post(new InquiryDb(), createPayload({ items: [item] }));
    expect(response.status).toBe(400);
  });

  it.each(['missing-tea', 'sydney-tea'])('rejects unavailable product %s without writing', async (productId) => {
    const db = new InquiryDb();
    const item = { ...(createPayload().items as Array<Record<string, unknown>>)[0], id: productId };

    const response = await post(db, createPayload({ items: [item] }));

    expect(response.status).toBe(404);
    expect(db.inquiries).toHaveLength(0);
  });

  it('keeps consult inquiries exempt from cart validation and stores a schema-safe zero total', async () => {
    const db = new InquiryDb();
    const response = await post(db, {
      source: 'consult',
      name: 'Consulting Customer',
      email: 'consult@example.com',
      vision: 'Build a thoughtful tea program.',
    });

    expect(response.status).toBe(201);
    expect(db.inquiries).toHaveLength(1);
    expect(db.inquiries[0]).toMatchObject({ items: '[]', total_usd: 0, source: 'consult' });
  });

  it.each([undefined, '', 'US dollars'])('rejects missing or invalid currency %s', async (currency) => {
    const response = await post(new InquiryDb(), createPayload({ currency }));
    expect(response.status).toBe(400);
  });

  it('creates once, stores only a hash, and returns the caller tracking token', async () => {
    const db = new InquiryDb();
    const first = await post(db, createPayload());
    const firstBody = await first.json() as Record<string, unknown>;

    expect(first.status).toBe(201);
    expect(firstBody).toMatchObject({ tracking_token: TOKEN, ref_number: 'TJ-20260810-A1B2C3D4' });
    expect(firstBody).not.toHaveProperty('idempotent');
    expect(db.inquiries).toHaveLength(1);
    expect(db.inquiries[0].tracking_token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(db.inquiries[0].tracking_token_hash).not.toBe(TOKEN);
    expect(db.inquiries[0].request_fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(db.inquiries[0])).not.toContain(TOKEN);
  });

  it('replays the same tracking token idempotently', async () => {
    const db = new InquiryDb();
    expect((await post(db, createPayload())).status).toBe(201);
    const repeated = await post(db, createPayload());

    expect(repeated.status).toBe(200);
    expect(await repeated.json()).toMatchObject({
      tracking_token: TOKEN,
      ref_number: 'TJ-20260810-A1B2C3D4',
      idempotent: true,
    });
    expect(db.inquiries).toHaveLength(1);
  });

  it('treats delivery source changes as the same inquiry', async () => {
    const db = new InquiryDb();
    expect((await post(db, createPayload({ source: 'whatsapp' }))).status).toBe(201);

    const repeated = await post(db, createPayload({ source: 'email' }));

    expect(repeated.status).toBe(200);
    expect(await repeated.json()).toMatchObject({ idempotent: true });
    expect(db.inquiries).toHaveLength(1);
  });

  it('rejects a changed payload for the same account and tracking token', async () => {
    const db = new InquiryDb();
    expect((await post(db, createPayload())).status).toBe(201);

    const conflict = await post(db, createPayload({ notes: 'Changed after persistence' }));

    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toEqual({ error: 'Tracking token conflict' });
    expect(db.inquiries).toHaveLength(1);
  });

  it('rejects reuse of a tracking token by another store without revealing the first row', async () => {
    const db = new InquiryDb();
    await post(db, createPayload());

    const conflict = await post(db, createPayload({
      store_slug: 'sydney',
      items: [{ id: 'sydney-tea', name: 'Rou Gui', category: 'tea', storeSlug: 'sydney', quantityGrams: 25, pricePerGram: 1, totalPrice: 25 }],
    }));
    const body = await conflict.json() as Record<string, unknown>;

    expect(conflict.status).toBe(409);
    expect(body).not.toHaveProperty('id');
    expect(body).not.toHaveProperty('ref_number');
    expect(body).not.toHaveProperty('account_id');
    expect(db.inquiries).toHaveLength(1);
  });

  it('reloads an account-bound row after a unique insert race', async () => {
    const db = new InquiryDb();
    expect((await post(db, createPayload())).status).toBe(201);
    db.tokenLookupMisses = 1;

    const raced = await post(db, createPayload());

    expect(raced.status).toBe(200);
    expect(await raced.json()).toMatchObject({
      tracking_token: TOKEN,
      ref_number: 'TJ-20260810-A1B2C3D4',
      idempotent: true,
    });
    expect(db.inquiries).toHaveLength(1);
  });

  it('rejects a cross-store token collision discovered after a unique insert race', async () => {
    const db = new InquiryDb();
    expect((await post(db, createPayload())).status).toBe(201);
    db.tokenLookupMisses = 1;

    const conflict = await post(db, createPayload({
      store_slug: 'sydney',
      items: [{ id: 'sydney-tea', name: 'Rou Gui', category: 'tea', storeSlug: 'sydney', quantityGrams: 25, pricePerGram: 1, totalPrice: 25 }],
    }));
    const body = await conflict.json() as Record<string, unknown>;

    expect(conflict.status).toBe(409);
    expect(body).toEqual({ error: 'Tracking token conflict' });
    expect(db.inquiries).toHaveLength(1);
  });

  it('rejects a changed same-store payload discovered after a unique insert race', async () => {
    const db = new InquiryDb();
    expect((await post(db, createPayload())).status).toBe(201);
    db.tokenLookupMisses = 1;

    const conflict = await post(db, createPayload({ notes: 'Changed after persistence' }));

    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toEqual({ error: 'Tracking token conflict' });
    expect(db.inquiries).toHaveLength(1);
  });

  it('looks up by private token, redacts personal details, and rejects the human reference', async () => {
    const db = new InquiryDb();
    await post(db, createPayload());

    const byRef = await get(db, 'TJ-20260810-A1B2C3D4');
    expect(byRef.status).toBe(404);

    const byToken = await get(db, TOKEN);
    const body = await byToken.json() as Record<string, unknown>;
    expect(byToken.status).toBe(200);
    expect(body).toMatchObject({ ref_number: 'TJ-20260810-A1B2C3D4', currency: 'USD' });
    expect(body).not.toHaveProperty('customer_name');
    expect(body).not.toHaveProperty('customer_contact');
    expect(body).not.toHaveProperty('customer_location');
    expect(JSON.stringify(body)).not.toContain('Private Person');
    expect(JSON.stringify(body)).not.toContain('private@example.com');
    expect(JSON.stringify(body)).not.toContain('Denpasar');
  });

  it('allows the same human reference in separate accounts without cross-account lookup', async () => {
    const db = new InquiryDb();
    await post(db, createPayload());
    await post(db, createPayload({
      tracking_token: SECOND_TOKEN,
      store_slug: 'sydney',
      items: [{ id: 'sydney-tea', name: 'Rou Gui', category: 'tea', storeSlug: 'sydney', quantityGrams: 25, pricePerGram: 1, totalPrice: 25 }],
    }));

    expect(db.inquiries).toHaveLength(2);
    expect(new Set(db.inquiries.map((row) => row.account_id))).toEqual(new Set(['account-bali', 'account-sydney']));
    expect((await get(db, 'TJ-20260810-A1B2C3D4')).status).toBe(404);
    expect((await get(db, SECOND_TOKEN)).status).toBe(200);
  });
});

describe('authenticated inquiry operations', () => {
  function seededDb() {
    const db = new InquiryDb();
    db.inquiries.push(
      {
        id: 'bali-inquiry', account_id: 'account-bali', tracking_token_hash: 'bali-hash',
        ref_number: 'TJ-BALI', request_fingerprint: 'bali-fingerprint', status: 'new',
        items: '[]', created_at: '2026-08-10 09:15:00',
      },
      {
        id: 'sydney-inquiry', account_id: 'account-sydney', tracking_token_hash: 'sydney-hash',
        ref_number: 'TJ-SYDNEY', request_fingerprint: 'sydney-fingerprint', status: 'new',
        items: '[]', created_at: '2026-08-10 09:16:00',
      },
    );
    return db;
  }

  it.each([
    ['GET', '/api/admin/inquiries', undefined],
    ['PATCH', '/api/admin/inquiries/bali-inquiry/status', JSON.stringify({ status: 'seen' })],
  ])('rejects unauthenticated %s operations', async (method, path, body) => {
    const response = await adminRequest(seededDb(), path, { method, body });
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: 'auth_no_token' });
  });

  it.each([
    ['GET', '/api/admin/inquiries', undefined],
    ['PATCH', '/api/admin/inquiries/bali-inquiry/status', JSON.stringify({ status: 'seen' })],
  ])('rejects %s operations when the member lacks sell', async (method, path, body) => {
    const response = await adminRequest(seededDb(), path, { method, body }, 'member');
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      code: 'insufficient_bundle',
      details: { required_bundle: 'sell' },
    });
  });

  it('lets a sell member list and update inquiries in their account', async () => {
    const db = seededDb();
    const list = await adminRequest(db, '/api/admin/inquiries', {}, 'seller');
    expect(list.status).toBe(200);
    expect(await list.json()).toEqual({
      inquiries: [expect.objectContaining({ id: 'bali-inquiry', account_id: 'account-bali', status: 'new' })],
    });

    const update = await adminRequest(db, '/api/admin/inquiries/bali-inquiry/status', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'replied' }),
    }, 'seller');
    expect(update.status).toBe(200);
    expect(db.inquiries.find(row => row.id === 'bali-inquiry')?.status).toBe('replied');
  });

  it('hides cross-account inquiries and denies cross-account status updates', async () => {
    const db = seededDb();
    const list = await adminRequest(db, '/api/admin/inquiries', {}, 'seller');
    expect(JSON.stringify(await list.json())).not.toContain('sydney-inquiry');

    const update = await adminRequest(db, '/api/admin/inquiries/sydney-inquiry/status', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'closed' }),
    }, 'seller');
    expect(update.status).toBe(404);
    expect(db.inquiries.find(row => row.id === 'sydney-inquiry')?.status).toBe('new');
  });

  it('continues to reject unsupported inquiry statuses', async () => {
    const response = await adminRequest(seededDb(), '/api/admin/inquiries/bali-inquiry/status', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'converted' }),
    }, 'seller');
    expect(response.status).toBe(400);
  });
});
