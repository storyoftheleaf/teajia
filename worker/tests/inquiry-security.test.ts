import { describe, expect, it } from 'vitest';
import worker from '../src/index';

type InquiryRow = Record<string, unknown> & {
  id: string;
  account_id: string;
  tracking_token_hash: string;
  ref_number: string;
};

class InquiryDb {
  readonly accounts = new Map([
    ['bali', 'account-bali'],
    ['sydney', 'account-sydney'],
  ]);
  readonly inquiries: InquiryRow[] = [];

  prepare(sql: string) {
    const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase();
    let values: unknown[] = [];
    const statement = {
      bind: (...next: unknown[]) => { values = next; return statement; },
      first: async () => {
        if (normalized === 'select id from accounts where slug = ?') {
          const id = this.accounts.get(String(values[0]));
          return id ? { id } : null;
        }
        if (normalized.includes('from inquiries where tracking_token_hash = ?')) {
          return this.inquiries.find((row) => row.tracking_token_hash === values[0]) ?? null;
        }
        return null;
      },
      run: async () => {
        if (!normalized.startsWith('insert into inquiries')) {
          return { success: true, meta: { changes: 0 } };
        }
        const columns = sql.match(/inquiries\s*\(([^)]+)\)/i)?.[1]
          .split(',').map((column) => column.trim()) ?? [];
        const row = Object.fromEntries(columns.map((column, index) => [column, values[index]])) as InquiryRow;
        if (this.inquiries.some((existing) => existing.tracking_token_hash === row.tracking_token_hash)) {
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
    items: [{ id: 'tea-1', name: 'Rou Gui', storeSlug: 'bali', totalPrice: 25 }],
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
  it('requires a store for cart inquiries', async () => {
    const response = await post(new InquiryDb(), createPayload({ store_slug: undefined }));
    expect(response.status).toBe(400);
  });

  it('rejects unknown stores', async () => {
    const response = await post(new InquiryDb(), createPayload({
      store_slug: 'unknown',
      items: [{ id: 'tea-1', name: 'Rou Gui', storeSlug: 'unknown', totalPrice: 25 }],
    }));
    expect(response.status).toBe(404);
  });

  it('creates once, stores only a hash, and returns the caller tracking token', async () => {
    const db = new InquiryDb();
    const first = await post(db, createPayload());
    const firstBody = await first.json() as Record<string, unknown>;

    expect(first.status).toBe(201);
    expect(firstBody).toMatchObject({ tracking_token: TOKEN, ref_number: 'TJ-20260810-A1B2C3D4' });
    expect(db.inquiries).toHaveLength(1);
    expect(db.inquiries[0].tracking_token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(db.inquiries[0].tracking_token_hash).not.toBe(TOKEN);
    expect(JSON.stringify(db.inquiries[0])).not.toContain(TOKEN);
  });

  it('replays the same tracking token idempotently', async () => {
    const db = new InquiryDb();
    expect((await post(db, createPayload())).status).toBe(201);
    const repeated = await post(db, createPayload());

    expect(repeated.status).toBe(200);
    expect(await repeated.json()).toMatchObject({ tracking_token: TOKEN, ref_number: 'TJ-20260810-A1B2C3D4' });
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
      items: [{ id: 'tea-1', name: 'Rou Gui', storeSlug: 'sydney', totalPrice: 25 }],
    }));

    expect(db.inquiries).toHaveLength(2);
    expect(new Set(db.inquiries.map((row) => row.account_id))).toEqual(new Set(['account-bali', 'account-sydney']));
    expect((await get(db, 'TJ-20260810-A1B2C3D4')).status).toBe(404);
    expect((await get(db, SECOND_TOKEN)).status).toBe(200);
  });
});
