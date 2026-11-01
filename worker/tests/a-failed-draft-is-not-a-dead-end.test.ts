import { afterEach, describe, expect, it, vi } from 'vitest';
import { mcpFetch } from '../src/mcp';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';

/**
 * The provider refuses, and the draft still gets finished by hand.
 *
 * Both halves of this file are the live failure of 2026-10-17. Commit
 * `4fb95152` sent `output_config.format` to a model that does not accept it,
 * so `intake_analyze` answered `analysis_provider_400` on every call, including
 * a two-line pasted invoice; and a draft that failed analysis had no items and
 * no vendor groups, so `intake_update_item` had nothing to edit,
 * `intake_set_group_vendor` had nothing to assign, and `intake_finalize`
 * previewed zero items. The record was saved and useless.
 *
 * Driven through the MCP server against a database seeded from the migration
 * ledger, because the first guard on this code read the source and could not
 * go red: every assertion it made about a tool matched TEXT, so the behaviour
 * could change under it while all its tests stayed green.
 */

const TOKEN = 'mcp_failed_draft_token_0123456789';
const ACCOUNT = 'account-a';
const OWNER = 'account-owner';

const databases: SqliteD1[] = [];
afterEach(() => { vi.restoreAllMocks(); while (databases.length) databases.pop()!.close(); });

const tokenHash = async (token: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))]
  .map(value => value.toString(16).padStart(2, '0')).join('');

async function database() {
  const db = new SqliteD1('migrations');
  databases.push(db);
  seedIdentity(db, { userId: OWNER, accountId: ACCOUNT, role: 'owner', bundles: ['catalog', 'stock', 'publish', 'sell'] });
  db.sqlite.prepare(`INSERT INTO mcp_tokens (id, account_id, user_id, user_email, label, token_hash, token_prefix, scopes, creator_tier)
    VALUES ('token-draft', ?, ?, 'owner@test.dev', 'draft', ?, ?, '["inventory:read","stock:write"]', 'account_owner')`)
    .run(ACCOUNT, OWNER, await tokenHash(TOKEN), TOKEN.slice(0, 8));
  db.sqlite.prepare(`INSERT INTO customers (id, account_id, name, tags) VALUES ('vendor-1', ?, 'Huang Wei', '["vendor"]')`).run(ACCOUNT);
  return db;
}

/* The real D1 returns promises and mcp.ts fires one write without awaiting it,
   so the sqlite stand-in is wrapped rather than handed over bare. */
function asyncD1(db: SqliteD1) {
  return {
    prepare(sql: string) {
      const inner = db.prepare(sql);
      const statement = {
        inner,
        bind: (...values: unknown[]) => { inner.bind(...values); return statement; },
        first: async () => inner.first(),
        all: async () => inner.all(),
        run: async () => inner.run(),
      };
      return statement;
    },
    batch: (statements: any[]) => Promise.resolve(db.batch(statements.map(statement => statement.inner))),
  };
}

async function tool(db: SqliteD1, name: string, args: Record<string, unknown>, env: Record<string, unknown> = {}) {
  const response = await mcpFetch(new Request('https://worker.test/mcp', {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  }), { DB: asyncD1(db), inventoryReceipts: { receiveImport: async () => { throw new Error('An in-transit invoice must not receive stock'); } }, ...env } as any);
  const body = await response.json() as any;
  if (body.error) throw new Error(`${name}: ${JSON.stringify(body.error)}`);
  return JSON.parse(body.result.content[0].text);
}

const batchRow = (db: SqliteD1) => db.sqlite.prepare('SELECT * FROM curate_import_batches').get() as any;

/* Deliberately NOT a record the deterministic parser can read: a line like
   `380 yuan / 500 g x1` is recovered with no provider at all, which is the
   layer below this one and is covered in curate-imports.test.ts. What is
   left when both layers are gone is what this file is about. */
const UNREADABLE = 'Tea list from the shop, photographed badly, nobody could read it';

/* What the provider actually answered on 2026-10-17, as a shape: the request
   was refused, not the record misread. The api key is in the echoed request so
   the detail must not carry it through to the draft. */
const REFUSED = JSON.stringify({
  type: 'error',
  error: {
    type: 'invalid_request_error',
    message: 'output_config.format: Structured outputs are not supported for this model. (sk-ant-api03-notarealkeyvalue0000000000000000)',
  },
});

describe('a draft whose analysis failed can still be finished by hand', () => {
  it('says why the provider refused, without the key, and leaves the record saved', async () => {
    const db = await database();
    const started = await tool(db, 'intake_start', { title: 'Invoice run', pasted_text: 'Tea list nobody could read' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(REFUSED, { status: 400 }));

    const analyzed = await tool(db, 'intake_analyze', { import_id: started.import_id }, { ANTHROPIC_API_KEY: 'sk-ant-api03-notarealkeyvalue0000000000000000' });

    expect(analyzed.error).toBeTruthy();
    const batch = batchRow(db);
    expect(batch.analysis_state).toBe('failed');
    /* The code still leads, because the browser matches on it; the detail
       follows, because a bare code says a request was refused without saying
       which part of it was wrong, and that cost four months. */
    expect(String(batch.analysis_error)).toContain('analysis_provider_400');
    expect(String(batch.analysis_error)).toContain('invalid_request_error');
    expect(String(batch.analysis_error)).toContain('Structured outputs are not supported');
    expect(String(batch.analysis_error)).not.toContain('sk-ant');
    const draft = await tool(db, 'intake_get_draft', { import_id: started.import_id });
    expect(draft.items).toEqual([]);
    expect(draft.sources).toHaveLength(1);
  });
});

describe('the manual way through a failed draft', () => {
  async function failedDraft(db: SqliteD1) {
    const started = await tool(db, 'intake_start', { title: 'Invoice run Oct 2026', pasted_text: UNREADABLE });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(REFUSED, { status: 400 }));
    await tool(db, 'intake_analyze', { import_id: started.import_id }, { ANTHROPIC_API_KEY: 'test-key' });
    vi.restoreAllMocks();
    return started.import_id as string;
  }

  const LINE = {
    name: 'Aged Liubao', chinese_name: '陈年六堡茶', type: 'Dark',
    quantity: { amount: 1, unit: 'jin' },
    disposition: 'in_transit',
    price: { amount: '380', currency: 'CNY' },
  };

  it('previews the lines in words and writes nothing until confirmed', async () => {
    const db = await database();
    const importId = await failedDraft(db);

    const preview = await tool(db, 'intake_add_items', { import_id: importId, vendor_name: 'Huang Wei', items: [LINE] });

    expect(preview.confirmation_token).toBeTruthy();
    expect(preview.preview.analysis_state).toBe('failed');
    expect(preview.preview.will_add).toEqual(['Aged Liubao - 1 jin (500 g) - on the way - 380 CNY for the line - for working']);
    expect(db.sqlite.prepare('SELECT COUNT(*) AS count FROM curate_import_items').get()).toEqual({ count: 0 });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS count FROM curate_import_vendor_groups').get()).toEqual({ count: 0 });
  });

  it('builds the items and their vendor group, then reaches a finalize preview', async () => {
    const db = await database();
    const importId = await failedDraft(db);
    const preview = await tool(db, 'intake_add_items', { import_id: importId, vendor_name: 'Huang Wei', items: [LINE] });

    const added = await tool(db, 'intake_add_items', { import_id: importId, confirm: preview.confirmation_token });

    expect(added.committed).toBe(true);
    const draft = await tool(db, 'intake_get_draft', { import_id: importId });
    expect(draft.items).toHaveLength(1);
    expect(draft.groups).toHaveLength(1);
    expect(draft.items[0]).toMatchObject({ name: 'Aged Liubao', vendor_group_id: draft.groups[0].id });
    expect(draft.items[0].parsed_data).toMatchObject({
      disposition: 'in_transit', totalQuantityGrams: 500, packCount: 1,
      currency: 'CNY', lineCost: 380, chineseName: '陈年六堡茶', inventoryPurpose: 'working',
    });
    /* A vendor group is what finalize turns into a receipt, and only analysis
       could make one before. Now the group exists, so it can be resolved. */
    const resolved = await tool(db, 'intake_set_group_vendor', { import_id: importId, group_id: draft.groups[0].id, vendor_customer_id: 'vendor-1' });
    expect(resolved.resolved_vendor_customer_id).toBe('vendor-1');

    const finalize = await tool(db, 'intake_finalize', { import_id: importId });

    expect(finalize.preview).toMatchObject({ action: 'intake_finalize', item_count: 1, by_disposition: { in_transit: 1 } });
    expect(finalize.confirmation_token).toBeTruthy();
  });

  it('finalizes the hand-built lot, leaving a receipt and no stock movement until it lands', async () => {
    const db = await database();
    const importId = await failedDraft(db);
    const preview = await tool(db, 'intake_add_items', { import_id: importId, vendor_customer_id: 'vendor-1', items: [LINE] });
    await tool(db, 'intake_add_items', { import_id: importId, confirm: preview.confirmation_token });
    const finalize = await tool(db, 'intake_finalize', { import_id: importId });

    const committed = await tool(db, 'intake_finalize', { import_id: importId, confirm: finalize.confirmation_token });

    expect(committed.committed).toBe(true);
    expect(committed.receipts).toHaveLength(1);
    expect(db.sqlite.prepare('SELECT COUNT(*) AS count FROM inventory_receipt_lines').get()).toEqual({ count: 1 });
    /* In transit is bought, not here: the receipt exists so the lot is on
       record, and the shelf does not move until it arrives. */
    expect(db.sqlite.prepare('SELECT COUNT(*) AS count FROM stock_ledger').get()).toEqual({ count: 0 });
    expect(db.sqlite.prepare('SELECT name, vendor_name FROM tea_compass_entries').get()).toMatchObject({ name: 'Aged Liubao' });
  });
});
