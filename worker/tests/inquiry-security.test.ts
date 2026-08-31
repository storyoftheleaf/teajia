import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import worker from '../src/index';

// Two files, not one. The tracking column shipped as 130 and was already
// applied to production before the fingerprint work followed it, so the
// fingerprint column and the widened index had to land as 131 rather than as
// an edit to 130 that D1 would never re-run. These assertions cover the pair,
// which together are the schema the code actually expects.
const migrationSql = [
  '../migrations.archived/130_secure_inquiry_tracking.sql',
  '../migrations.archived/131_inquiry_request_fingerprint.sql',
].map((file) => readFileSync(new URL(file, import.meta.url), 'utf8')).join('\n');

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

/**
 * A tea the shop does not list yet still leaves a record.
 *
 * Every line used to have to name a product in the catalogue, so a sample of
 * something poured at a session but never listed could not be saved at all: the
 * request stayed a WhatsApp message, and the reference printed on the
 * confirmation stood for nothing. That product-id requirement was also doing
 * duty as the anti-junk gate on an unauthenticated write, so the tests below
 * cover both halves — the case that must now be accepted, and the fences that
 * replace what the requirement was quietly providing.
 */
describe('a request for a tea the shop does not list', () => {
  const customLine = (overrides: Record<string, unknown> = {}) => ({
    custom: true, name: 'Something poured at the session', category: 'tea', storeSlug: 'bali',
    quantityGrams: 5, pricePerGram: 0, totalPrice: 0, ...overrides,
  });

  it('is saved, so the tea house hears about it', async () => {
    const db = new InquiryDb();
    const response = await post(db, createPayload({ items: [customLine()], total_estimate_usd: 0 }));

    expect(response.status).toBe(201);
    expect(db.inquiries).toHaveLength(1);
    // Saved under the store it was asked of, with the line's own name intact —
    // converting turns that into a named line at no price, the same shape it
    // already produces for a tea that has since been retired.
    expect(db.inquiries[0].account_id).toBe('account-bali');
    expect(String(db.inquiries[0].items)).toContain('Something poured at the session');
  });

  it('is saved alongside lines that do name a product', async () => {
    const db = new InquiryDb();
    const catalogue = (createPayload().items as Array<Record<string, unknown>>)[0];
    const response = await post(db, createPayload({ items: [catalogue, customLine()] }));

    expect(response.status).toBe(201);
    expect(db.inquiries).toHaveLength(1);
  });

  it('still refuses a line naming a product the store does not sell', async () => {
    const db = new InquiryDb();
    const response = await post(db, createPayload({
      items: [{ ...(createPayload().items as Array<Record<string, unknown>>)[0], id: 'missing-tea' }],
    }));

    // The loosening is for lines that say they are custom, never for a
    // mistyped product id quietly becoming one.
    expect(response.status).toBe(404);
    expect(db.inquiries).toHaveLength(0);
  });

  it('refuses a line that claims to be custom and names a product anyway', async () => {
    const db = new InquiryDb();
    const response = await post(db, createPayload({ items: [customLine({ id: 'tea-1' })] }));

    expect(response.status).toBe(400);
    expect(db.inquiries).toHaveLength(0);
  });

  it('caps how many lines one request may carry', async () => {
    const db = new InquiryDb();
    const response = await post(db, createPayload({
      items: Array.from({ length: 51 }, (_, index) => customLine({ name: `Tea ${index}` })),
    }));

    expect(response.status).toBe(400);
    expect(db.inquiries).toHaveLength(0);
  });

  it('caps how long a line may name itself', async () => {
    const db = new InquiryDb();
    const response = await post(db, createPayload({ items: [customLine({ name: 'x'.repeat(121) })] }));

    expect(response.status).toBe(400);
    expect(db.inquiries).toHaveLength(0);
  });

  it('caps the free-text note, which had no limit before custom lines existed', async () => {
    const db = new InquiryDb();
    const response = await post(db, createPayload({
      items: [customLine()],
      notes: 'y'.repeat(5000),
    }));

    expect(response.status).toBe(201);
    expect(String(db.inquiries[0].message)).toHaveLength(2000);
  });
});
