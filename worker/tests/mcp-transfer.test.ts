import { beforeEach, describe, expect, it } from 'vitest';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';
import { transferToolModule } from '../src/mcpTools/transfer';
import type { ToolAuth, ToolEnv } from '../src/mcpTools/registry';

/*
 * Stock crossing a shop boundary is the one movement that can go wrong in both
 * directions at once: half of it destroys tea, the other half invents it, and
 * either half leaves two shelves that each look right on their own. These cover
 * the ways that happens — a quantity nobody gave read as zero, a removal
 * without its addition, a token spent twice, and a write landing in a shop the
 * caller has no authority in.
 *
 * The handlers are driven directly rather than through mcpFetch because this
 * module is not in mcp.ts's TOOL_MODULES yet (see the note at the top of
 * transfer.ts); when it is registered these still hold, since the registry
 * hands a module the same (env, auth, args) the switch does.
 */

const transferStock = transferToolModule.handlers.transfer_stock;
const listAccounts = transferToolModule.handlers.list_transferable_accounts;

let db: SqliteD1;
let env: ToolEnv;

const auth = (overrides: Partial<ToolAuth> = {}): ToolAuth => ({
  accountId: 'acc-home',
  userId: 'user-one',
  userEmail: 'user-one@test.dev',
  tokenId: 'tok-home',
  creatorTier: 'account_owner',
  ...overrides,
});

function seedProduct(row: {
  id: string; account: string; name: string; grams?: number | null; units?: number | null;
  type?: string; cost?: number | null; currency?: string | null; teaKey?: string | null; status?: string;
}) {
  db.sqlite.prepare(
    `INSERT INTO products (id, account_id, type, product_name, given_name, stock_grams, quantity_units,
                           cost_amount, cost_currency, tea_key, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    row.id, row.account, row.type ?? 'Tea', row.name, row.name,
    row.grams ?? null, row.units ?? null,
    row.cost ?? 60, row.currency ?? 'CNY', row.teaKey ?? null, row.status ?? 'Active',
  );
}

function seedListing(productId: string, account: string, profileId: string, grams: number) {
  db.sqlite.prepare(
    `INSERT OR IGNORE INTO tea_profiles (id, slug, originated_by_account_id, curated_by_account_id, name)
     VALUES (?, ?, ?, ?, ?)`
  ).run(profileId, `profile-${profileId}`, account, account, profileId);
  db.sqlite.prepare(
    `INSERT INTO product_listings (id, account_id, profile_id, stock_grams, legacy_product_id)
     VALUES (?, ?, ?, ?, ?)`
  ).run(`list_${productId}`, account, profileId, grams, productId);
}

const stockOf = (productId: string) => db.sqlite
  .prepare('SELECT stock_grams, quantity_units, status FROM products WHERE id = ?')
  .get(productId) as { stock_grams: number | null; quantity_units: number | null; status: string };

const ledgerRows = () => db.sqlite
  .prepare('SELECT product_id, delta, balance_after, account_id, reason, movement_type, movement_unit, note FROM stock_ledger ORDER BY delta')
  .all() as Record<string, any>[];

beforeEach(() => {
  db = new SqliteD1();
  env = { DB: db } as unknown as ToolEnv;
  seedIdentity(db, { userId: 'user-one', accountId: 'acc-home', accountSlug: 'home', role: 'owner' });
  seedIdentity(db, { userId: 'user-one', accountId: 'acc-away', accountSlug: 'away', role: 'owner' });
  seedProduct({ id: 'p-home', account: 'acc-home', name: 'Yiwu', grams: 500, teaKey: 'yiwu-2019' });
  seedProduct({ id: 'p-away', account: 'acc-away', name: 'Yiwu', grams: 100, teaKey: 'yiwu-2019' });
});

async function previewTransfer(args: Record<string, unknown>, as: ToolAuth = auth()) {
  return await transferStock(env, as, args) as any;
}

describe('transfer_stock', () => {
  it('moves the stock and writes both halves of the movement', async () => {
    const preview = await previewTransfer({ id: 'p-home', to_account: 'away', grams: 120 });
    expect(preview.preview.from.balance_after).toBe(380);
    expect(preview.preview.to.balance_after).toBe(220);
    expect(preview.confirmation_token).toBeTruthy();

    const committed = await previewTransfer({ id: 'p-home', to_account: 'away', grams: 120, confirm: preview.confirmation_token });
    expect(committed.committed).toBe(true);
    expect(stockOf('p-home').stock_grams).toBe(380);
    expect(stockOf('p-away').stock_grams).toBe(220);

    const rows = ledgerRows();
    expect(rows).toHaveLength(2);
    expect(rows.map(r => r.delta)).toEqual([-120, 120]);
    expect(rows.map(r => r.account_id)).toEqual(['acc-home', 'acc-away']);
    expect(rows.map(r => r.balance_after)).toEqual([380, 220]);
    // One event, legible as one event from either shelf.
    expect(rows[0].note).toContain(committed.transfer_id);
    expect(rows[1].note).toContain(committed.transfer_id);
    expect(new Set(rows.map(r => r.reason))).toEqual(new Set(['TRANSFER']));
    expect(new Set(rows.map(r => r.movement_type))).toEqual(new Set(['transfer']));
  });

  it('mirrors both shops\' listings so neither shelf keeps the old number', async () => {
    seedListing('p-home', 'acc-home', 'prof-yiwu', 500);
    seedListing('p-away', 'acc-away', 'prof-yiwu', 100);
    const preview = await previewTransfer({ id: 'p-home', to_account: 'away', grams: 200 });
    await previewTransfer({ id: 'p-home', to_account: 'away', grams: 200, confirm: preview.confirmation_token });

    const listings = db.sqlite.prepare('SELECT id, stock_grams FROM product_listings ORDER BY id').all() as any[];
    expect(listings).toEqual([
      { id: 'list_p-away', stock_grams: 300 },
      { id: 'list_p-home', stock_grams: 300 },
    ]);
  });

  it('finds the receiving shop\'s row through the shared tea profile when none is named', async () => {
    seedListing('p-home', 'acc-home', 'prof-yiwu', 500);
    seedListing('p-away', 'acc-away', 'prof-yiwu', 100);
    const preview = await previewTransfer({ id: 'p-home', to_account: 'away', grams: 50 });
    expect(preview.preview.to.matched_by).toBe('shared_tea_profile');
    expect(preview.preview.to.product.id).toBe('p-away');
  });

  it('falls back to the shared tea key when the shops have no common profile', async () => {
    const preview = await previewTransfer({ id: 'p-home', to_account: 'away', grams: 50 });
    expect(preview.preview.to.matched_by).toBe('shared_tea_key');
  });

  it('refuses a quantity nobody gave rather than reading it as zero', async () => {
    await expect(previewTransfer({ id: 'p-home', to_account: 'away' })).rejects.toThrow(/required/);
    await expect(previewTransfer({ id: 'p-home', to_account: 'away', grams: '' })).rejects.toThrow(/required/);
    await expect(previewTransfer({ id: 'p-home', to_account: 'away', grams: null })).rejects.toThrow(/required/);
    await expect(previewTransfer({ id: 'p-home', to_account: 'away', grams: 0 })).rejects.toThrow(/greater than zero/);
    // Nothing was staged, so nothing can be confirmed by mistake later.
    const tickets = db.sqlite.prepare('SELECT COUNT(*) AS n FROM mcp_confirmation_tickets').get() as { n: number };
    expect(tickets.n).toBe(0);
  });

  it('refuses fractional grams instead of letting SQLite truncate them', async () => {
    await expect(previewTransfer({ id: 'p-home', to_account: 'away', grams: 12.5 })).rejects.toThrow(/whole number/);
  });

  it('will not move more than is on the shelf', async () => {
    const refused = await previewTransfer({ id: 'p-home', to_account: 'away', grams: 900 });
    expect(refused.error).toBe('insufficient_stock');
    expect(refused.available).toBe(500);
  });

  it('leaves both shelves untouched when the stock goes between preview and confirm', async () => {
    const preview = await previewTransfer({ id: 'p-home', to_account: 'away', grams: 400 });
    db.sqlite.prepare('UPDATE products SET stock_grams = 50 WHERE id = ?').run('p-home');

    const result = await previewTransfer({ id: 'p-home', to_account: 'away', grams: 400, confirm: preview.confirmation_token });
    expect(result.error).toBe('insufficient_stock');
    // The half that would have invented tea did not run either.
    expect(stockOf('p-home').stock_grams).toBe(50);
    expect(stockOf('p-away').stock_grams).toBe(100);
    expect(ledgerRows()).toHaveLength(0);
  });

  it('spends a confirmation token exactly once', async () => {
    const preview = await previewTransfer({ id: 'p-home', to_account: 'away', grams: 100 });
    const first = await previewTransfer({ id: 'p-home', to_account: 'away', grams: 100, confirm: preview.confirmation_token });
    expect(first.committed).toBe(true);
    const second = await previewTransfer({ id: 'p-home', to_account: 'away', grams: 100, confirm: preview.confirmation_token });
    expect(second.error).toBe('invalid_or_expired_confirmation_token');
    expect(stockOf('p-away').stock_grams).toBe(200);
  });

  it('will not spend another tool\'s confirmation ticket on its way to rejecting it', async () => {
    // The tickets table is shared with mcp.ts's own tools. Consuming is
    // destructive, so a foreign ticket must be left standing.
    const token = 'not-a-transfer-token';
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))]
      .map(b => b.toString(16).padStart(2, '0')).join('');
    db.sqlite.prepare(
      `INSERT INTO mcp_confirmation_tickets (token_hash, account_id, kind, payload_json, expires_at, token_id)
       VALUES (?, 'acc-home', 'add_stock', '{"kind":"add_stock"}', ?, 'tok-home')`
    ).run(hash, Date.now() + 60_000);

    const result = await previewTransfer({ id: 'p-home', to_account: 'away', grams: 10, confirm: token });
    expect(result.error).toBe('invalid_or_expired_confirmation_token');
    const row = db.sqlite.prepare('SELECT consumed_at FROM mcp_confirmation_tickets WHERE token_hash = ?').get(hash) as any;
    expect(row.consumed_at).toBeNull();
  });

  it('will not confirm a ticket issued to a different token', async () => {
    const preview = await previewTransfer({ id: 'p-home', to_account: 'away', grams: 100 });
    const result = await previewTransfer(
      { id: 'p-home', to_account: 'away', grams: 100, confirm: preview.confirmation_token },
      auth({ tokenId: 'tok-somebody-else' }),
    );
    expect(result.error).toBe('invalid_or_expired_confirmation_token');
    expect(stockOf('p-away').stock_grams).toBe(100);
  });

  it('refuses a shop the caller has no membership in', async () => {
    db.sqlite.prepare(`INSERT INTO accounts (id, slug, name, status) VALUES ('acc-other','other','Other','active')`).run();
    seedProduct({ id: 'p-other', account: 'acc-other', name: 'Yiwu', grams: 0, teaKey: 'yiwu-2019' });
    const result = await previewTransfer({ id: 'p-home', to_account: 'other', grams: 10 });
    expect(result.error).toBe('destination_account_not_reachable');
    expect(stockOf('p-other').stock_grams).toBe(0);
  });

  it('refuses a shop where the caller\'s role does not carry stock write access', async () => {
    seedIdentity(db, { userId: 'user-one', accountId: 'acc-view', accountSlug: 'view', role: 'viewer' });
    seedProduct({ id: 'p-view', account: 'acc-view', name: 'Yiwu', grams: 0, teaKey: 'yiwu-2019' });
    const result = await previewTransfer({ id: 'p-home', to_account: 'view', grams: 10 });
    expect(result.error).toBe('destination_account_forbidden');
    expect(stockOf('p-view').stock_grams).toBe(0);
  });

  it('lets a staff member with the stock bundle receive, and one without it not', async () => {
    seedIdentity(db, { userId: 'user-one', accountId: 'acc-staff', accountSlug: 'staff', role: 'staff', bundles: ['stock'] });
    seedIdentity(db, { userId: 'user-one', accountId: 'acc-sell', accountSlug: 'sell', role: 'staff', bundles: ['sell'] });
    seedProduct({ id: 'p-staff', account: 'acc-staff', name: 'Yiwu', grams: 0, teaKey: 'yiwu-2019' });
    seedProduct({ id: 'p-sell', account: 'acc-sell', name: 'Yiwu', grams: 0, teaKey: 'yiwu-2019' });

    const allowed = await previewTransfer({ id: 'p-home', to_account: 'staff', grams: 10 });
    expect(allowed.confirmation_token).toBeTruthy();
    const refused = await previewTransfer({ id: 'p-home', to_account: 'sell', grams: 10 });
    expect(refused.error).toBe('destination_account_forbidden');
  });

  it('will not invent a product in the receiving shop', async () => {
    db.sqlite.prepare('DELETE FROM products WHERE id = ?').run('p-away');
    const result = await previewTransfer({ id: 'p-home', to_account: 'away', grams: 10 });
    expect(result.error).toBe('destination_product_not_found');
    const count = db.sqlite.prepare('SELECT COUNT(*) AS n FROM products WHERE account_id = ?').get('acc-away') as { n: number };
    expect(count.n).toBe(0);
  });

  it('refuses to guess between two holdings of the same tea', async () => {
    seedProduct({ id: 'p-away-2', account: 'acc-away', name: 'Yiwu (back shelf)', grams: 40, teaKey: 'yiwu-2019' });
    const result = await previewTransfer({ id: 'p-home', to_account: 'away', grams: 10 });
    expect(result.error).toBe('destination_product_ambiguous');
    expect(result.candidates).toHaveLength(2);
  });

  it('moves teaware in units and never touches the grams column', async () => {
    seedProduct({ id: 'ware-home', account: 'acc-home', name: 'Shipiao', type: 'Teaware', grams: null, units: 4 });
    seedProduct({ id: 'ware-away', account: 'acc-away', name: 'Shipiao', type: 'Teaware', grams: null, units: 1 });
    const preview = await previewTransfer({ id: 'ware-home', to_account: 'away', units: 2, to_product_id: 'ware-away' });
    expect(preview.preview.unit).toBe('unit');
    const committed = await previewTransfer({ id: 'ware-home', to_account: 'away', units: 2, to_product_id: 'ware-away', confirm: preview.confirmation_token });
    expect(committed.committed).toBe(true);
    expect(stockOf('ware-home')).toMatchObject({ quantity_units: 2, stock_grams: null });
    expect(stockOf('ware-away')).toMatchObject({ quantity_units: 3, stock_grams: null });
    expect(ledgerRows().map(r => r.movement_unit)).toEqual(['unit', 'unit']);
  });

  it('refuses grams on teaware rather than reading them as a count', async () => {
    seedProduct({ id: 'ware-home', account: 'acc-home', name: 'Shipiao', type: 'Teaware', grams: null, units: 4 });
    seedProduct({ id: 'ware-away', account: 'acc-away', name: 'Shipiao', type: 'Teaware', grams: null, units: 1 });
    await expect(previewTransfer({ id: 'ware-home', to_account: 'away', grams: 2, to_product_id: 'ware-away' }))
      .rejects.toThrow(/counted in units/);
  });

  it('refuses to pour grams into a column that counts pieces', async () => {
    seedProduct({ id: 'ware-away', account: 'acc-away', name: 'Shipiao', type: 'Teaware', grams: null, units: 1 });
    const result = await previewTransfer({ id: 'p-home', to_account: 'away', grams: 10, to_product_id: 'ware-away' });
    expect(result.error).toBe('transfer_unit_mismatch');
  });

  it('marks the emptied shelf Sold Out and says so before it does', async () => {
    const preview = await previewTransfer({ id: 'p-home', to_account: 'away', grams: 500 });
    expect(preview.preview.warnings.join(' ')).toMatch(/Sold Out/);
    const committed = await previewTransfer({ id: 'p-home', to_account: 'away', grams: 500, confirm: preview.confirmation_token });
    expect(committed.from.sold_out).toBe(true);
    expect(stockOf('p-home').status).toBe('Sold Out');
  });

  it('warns when the receiving row has no cost, rather than carrying the sending shop\'s across', async () => {
    db.sqlite.prepare('UPDATE products SET cost_amount = NULL, cost_currency = NULL WHERE id = ?').run('p-away');
    const preview = await previewTransfer({ id: 'p-home', to_account: 'away', grams: 10 });
    expect(preview.preview.warnings.join(' ')).toMatch(/no cost recorded/);
    await previewTransfer({ id: 'p-home', to_account: 'away', grams: 10, confirm: preview.confirmation_token });
    const dest = db.sqlite.prepare('SELECT cost_amount, cost_currency FROM products WHERE id = ?').get('p-away') as any;
    expect(dest.cost_amount).toBeNull();
    expect(dest.cost_currency).toBeNull();
  });

  it('writes an activity row in both shops', async () => {
    const preview = await previewTransfer({ id: 'p-home', to_account: 'away', grams: 10 });
    await previewTransfer({ id: 'p-home', to_account: 'away', grams: 10, confirm: preview.confirmation_token });
    const rows = db.sqlite.prepare('SELECT account_id, action FROM activity_logs ORDER BY account_id').all() as any[];
    expect(rows).toEqual([
      { account_id: 'acc-away', action: 'STOCK_TRANSFERRED_IN_MCP' },
      { account_id: 'acc-home', action: 'STOCK_TRANSFERRED_OUT_MCP' },
    ]);
  });

  it('refuses a product that belongs to another shop', async () => {
    const result = await previewTransfer({ id: 'p-away', to_account: 'away', grams: 10 });
    expect(result.error).toBe('not_found');
  });
});

describe('list_transferable_accounts', () => {
  it('lists the reachable shops and says why one cannot receive', async () => {
    seedIdentity(db, { userId: 'user-one', accountId: 'acc-view', accountSlug: 'view', role: 'viewer' });
    const result = await listAccounts(env, auth(), {}) as any;
    expect(result.from_account.slug).toBe('home');
    const byId = Object.fromEntries(result.accounts.map((a: any) => [a.id, a]));
    expect(byId['acc-home']).toBeUndefined();
    expect(byId['acc-away'].can_receive_stock).toBe(true);
    expect(byId['acc-view'].can_receive_stock).toBe(false);
    expect(byId['acc-view'].blocked_reason).toMatch(/viewer/);
  });

  it('does not list a shop the caller is not a member of', async () => {
    db.sqlite.prepare(`INSERT INTO accounts (id, slug, name, status) VALUES ('acc-other','other','Other','active')`).run();
    const result = await listAccounts(env, auth(), {}) as any;
    expect(result.accounts.some((a: any) => a.id === 'acc-other')).toBe(false);
  });
});

describe('the tool module contract', () => {
  it('declares a handler for every tool and asks for no scope it does not need', () => {
    const names = transferToolModule.defs.map(def => def.name).sort();
    expect(names).toEqual(['list_transferable_accounts', 'transfer_stock']);
    for (const def of transferToolModule.defs) {
      expect(transferToolModule.handlers[def.name]).toBeTypeOf('function');
    }
    expect(transferToolModule.defs.find(d => d.name === 'transfer_stock')?.scope).toBe('stock:write');
    expect(transferToolModule.defs.find(d => d.name === 'list_transferable_accounts')?.scope).toBe('inventory:read');
  });
});
