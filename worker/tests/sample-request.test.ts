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

class AdminSampleDb {
  sampleSets = new Map<string, Record<string, unknown>>([
    ['set-a', { id: 'set-a', account_id: ACCOUNT_ID, name: 'Existing', purpose: 'sourcing', shared_with: '[]', panel_account_ids: '[]', created_at: '2026-01-01', updated_at: '2026-01-01' }],
    ['set-other', { id: 'set-other', account_id: 'another-account', name: 'Other', purpose: 'sourcing', shared_with: '[]', panel_account_ids: '[]', created_at: '2026-01-01', updated_at: '2026-01-01' }],
  ]);
  samples = new Map<string, Record<string, unknown>>();

  prepare(sql: string) {
    const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase();
    let values: unknown[] = [];
    const statement = {
      bind: (...next: unknown[]) => { values = next; return statement; },
      first: async () => {
        if (normalized.includes('select session_version from users')) return { session_version: 0 };
        if (normalized.includes('select platform_role, session_version from users')) return { platform_role: null, session_version: 0 };
        if (normalized.includes('from account_members am') && normalized.includes('join accounts')) {
          return { role: 'owner', permissions: null, kind: 'location' };
        }
        if (normalized === 'select status from accounts where id = ?') return { status: 'active' };
        if (normalized.includes('select id from tea_sample_sets where id = ? and account_id = ?')) {
          const row = this.sampleSets.get(String(values[0]));
          return row?.account_id === values[1] ? { id: row.id } : null;
        }
        if (normalized.includes('select id, account_id from tea_samples where id = ?')) {
          const row = this.samples.get(String(values[0]));
          return row ? { id: row.id, account_id: row.account_id } : null;
        }
        if (normalized.includes('select * from tea_samples where id = ? and account_id = ?')) {
          const row = this.samples.get(String(values[0]));
          return row?.account_id === values[1] ? row : null;
        }
        if (normalized.includes('select * from tea_sample_sets where id = ? and account_id = ?')) {
          const row = this.sampleSets.get(String(values[0]));
          return row?.account_id === values[1] ? row : null;
        }
        return null;
      },
      all: async () => ({ results: [] }),
      run: async () => {
        if (normalized.startsWith('insert into tea_samples')) {
          const columns = sql.match(/tea_samples\s*\(([^)]+)\)/i)?.[1].split(',').map((column) => column.trim()) ?? [];
          const row = Object.fromEntries(columns.map((column, index) => [column, values[index]]));
          row.created_at = '2026-01-01'; row.updated_at = '2026-01-01'; row.photos ??= '[]';
          this.samples.set(String(row.id), row);
        } else if (normalized.startsWith('insert into tea_sample_sets')) {
          const columns = sql.match(/tea_sample_sets\s*\(([^)]+)\)/i)?.[1].split(',').map((column) => column.trim()) ?? [];
          const row = Object.fromEntries(columns.map((column, index) => [column, values[index]]));
          row.created_at = '2026-01-01'; row.updated_at = '2026-01-01'; row.shared_with ??= '[]'; row.panel_account_ids ??= '[]';
          this.sampleSets.set(String(row.id), row);
        } else if (normalized.startsWith('update tea_sample_sets set')) {
          const row = this.sampleSets.get(String(values.at(-2)));
          if (row && row.account_id === values.at(-1)) {
            const columns = sql.match(/set\s+(.+),\s*updated_at/i)?.[1].split(',').map((assignment) => assignment.split('=')[0].trim()) ?? [];
            columns.forEach((column, index) => { row[column] = values[index]; });
          }
        } else if (normalized.startsWith('update tea_samples set')) {
          const row = this.samples.get(String(values.at(-2)));
          if (row && row.account_id === values.at(-1)) {
            const columns = sql.match(/set\s+(.+),\s*updated_at/i)?.[1].split(',').map((assignment) => assignment.split('=')[0].trim()) ?? [];
            columns.forEach((column, index) => { row[column] = values[index]; });
          }
        }
        return { success: true, meta: { changes: 1 } };
      },
    };
    return statement;
  }
}

async function adminRequest(db: AdminSampleDb, path: string, method: string, body: Record<string, unknown>): Promise<Response> {
  const token = await signJwt();
  return worker.fetch(new Request(`https://api.test${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'X-Teajia-Account': ACCOUNT_ID, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
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

describe('admin sample persistence contracts', () => {
  it('persists tea_key and accepts only an active-account set relationship', async () => {
    const db = new AdminSampleDb();
    const response = await adminRequest(db, '/api/admin/samples', 'POST', {
      id: 'sample-admin', name: 'Da Hong Pao', set_id: 'set-a', tea_key: 'oolong:wuyi:dhp',
    });

    expect(response.status).toBe(201);
    expect(db.samples.get('sample-admin')).toMatchObject({
      account_id: ACCOUNT_ID, set_id: 'set-a', tea_key: 'oolong:wuyi:dhp',
    });
  });

  it.each(['missing-set', 'set-other'])('rejects create with unavailable set %s', async (setId) => {
    const db = new AdminSampleDb();
    const response = await adminRequest(db, '/api/admin/samples', 'POST', {
      id: 'sample-invalid', name: 'Invalid', set_id: setId,
    });
    expect(response.status).toBe(400);
    expect(db.samples.has('sample-invalid')).toBe(false);
  });

  it('rejects moving a sample into a cross-tenant set', async () => {
    const db = new AdminSampleDb();
    db.samples.set('sample-admin', {
      id: 'sample-admin', account_id: ACCOUNT_ID, name: 'Sample', set_id: 'set-a', status: 'untasted', grams: 8,
      photos: '[]', created_at: '2026-01-01', updated_at: '2026-01-01', created_by: 'admin',
    });
    const response = await adminRequest(db, '/api/admin/samples/sample-admin', 'PUT', { set_id: 'set-other' });
    expect(response.status).toBe(400);
    expect(db.samples.get('sample-admin')?.set_id).toBe('set-a');
  });

  it('round-trips panel_account_ids on sample-set create and update', async () => {
    const db = new AdminSampleDb();
    const created = await adminRequest(db, '/api/admin/sample-sets', 'POST', {
      id: 'panel-set', name: 'Panel', purpose: 'panel', panel_account_ids: ['panel-a', 'panel-b'],
    });
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({ panel_account_ids: ['panel-a', 'panel-b'] });
    expect(db.sampleSets.get('panel-set')?.panel_account_ids).toBe('["panel-a","panel-b"]');

    const updated = await adminRequest(db, '/api/admin/sample-sets/panel-set', 'PUT', {
      panel_account_ids: ['panel-c'],
    });
    expect(updated.status).toBe(200);
    expect(await updated.json()).toMatchObject({ panel_account_ids: ['panel-c'] });
    expect(db.sampleSets.get('panel-set')?.panel_account_ids).toBe('["panel-c"]');
  });
});
