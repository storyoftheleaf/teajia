import { describe, expect, it } from 'vitest';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';
import { costCurrencyTools, __testables } from '../src/mcpTools/costCurrency';

/*
 * The backlog these tools exist for is not a bug in the code; it is what the
 * schema recorded before the code had a rule. `cost_currency` carries
 * DEFAULT 'USD', so on every row written before the guard, "Adrian chose
 * dollars" and "nobody was ever asked" are the same three letters, and the
 * difference is worth about seven times the money.
 *
 * So what these cover is the two ways a correction tool can make that worse:
 * by guessing on Adrian's behalf, and by repricing more teas than the preview
 * showed him.
 */

const ACCOUNT = 'acc-cc';
const OTHER = 'acc-other';

type AnyResult = Record<string, any>;

function makeDb() {
  const sqlite = new SqliteD1();
  seedIdentity(sqlite, { userId: 'u1', accountId: ACCOUNT, role: 'owner' });
  seedIdentity(sqlite, { userId: 'u2', accountId: OTHER, role: 'owner' });
  return sqlite;
}

function seedTea(db: SqliteD1, o: {
  id: string; account?: string; vendor?: string | null; cost?: number | null;
  currency?: string | null; source?: string | null;
}) {
  db.sqlite.prepare(
    `INSERT INTO products (id, account_id, type, product_name, given_name, vendor,
                           cost_amount, cost_currency, cost_currency_source)
     VALUES (?, ?, 'Tea', ?, ?, ?, ?, ?, ?)`
  ).run(o.id, o.account ?? ACCOUNT, o.id, o.id, o.vendor ?? null,
        o.cost === undefined ? 100 : o.cost, o.currency === undefined ? 'USD' : o.currency,
        o.source ?? null);
}

function seedListing(db: SqliteD1, productId: string, account = ACCOUNT) {
  db.sqlite.prepare(
    `INSERT INTO tea_profiles (id, slug, originated_by_account_id, curated_by_account_id, name)
     VALUES (?, ?, ?, ?, ?)`
  ).run(`prof_${productId}`, `${account}-${productId}`, account, account, productId);
  db.sqlite.prepare(
    `INSERT INTO product_listings (id, account_id, profile_id, cost_amount, cost_currency, legacy_product_id)
     VALUES (?, ?, ?, 100, 'USD', ?)`
  ).run(`list_${productId}`, account, `prof_${productId}`, productId);
}

function seedReceipt(db: SqliteD1, productId: string, currency: string, account = ACCOUNT) {
  db.sqlite.prepare(
    `INSERT INTO inventory_receipts
       (id, account_id, source_kind, created_by_user_id, idempotency_key, request_fingerprint)
     VALUES (?, ?, 'test', 'u1', ?, 'fp')`
  ).run(`rcpt_${productId}_${currency}`, account, `idem_${productId}_${currency}`);
  db.sqlite.prepare(
    `INSERT INTO inventory_receipt_lines
       (id, receipt_id, account_id, product_id, expected_quantity, received_quantity,
        unit, intended_purpose, source_kind, original_cost_currency)
     VALUES (?, ?, ?, ?, 1, 0, 'g', 'working', 'test', ?)`
  ).run(`line_${productId}_${currency}`, `rcpt_${productId}_${currency}`, account, productId, currency);
}

const auth = (over: Record<string, string> = {}) => ({
  accountId: ACCOUNT, userId: 'u1', userEmail: 'u1@test.dev',
  tokenId: 'tok-1', creatorTier: 'account_owner', ...over,
}) as any;

const call = (db: SqliteD1, name: string, args: any, who = auth()): Promise<AnyResult> =>
  costCurrencyTools.handlers[name]({ DB: db } as any, who, args) as Promise<AnyResult>;

const stored = (db: SqliteD1, id: string) =>
  db.sqlite.prepare('SELECT cost_currency, cost_currency_source FROM products WHERE id = ?').get(id) as any;

describe('reading the backlog', () => {
  it('counts only teas that have a cost, because a tea with none has no currency to state', async () => {
    const db = makeDb();
    seedTea(db, { id: 'has-cost', vendor: 'Yunnan Co', cost: 380 });
    seedTea(db, { id: 'no-cost', vendor: 'Yunnan Co', cost: 0 });
    seedTea(db, { id: 'null-cost', vendor: 'Yunnan Co', cost: null });
    const out = await call(db, 'list_unstated_costs', {});
    expect(out.unstated_teas).toBe(1);
  });

  it('leaves out rows where somebody actually stated the currency', async () => {
    const db = makeDb();
    seedTea(db, { id: 'answered', vendor: 'V', source: 'stated' });
    seedTea(db, { id: 'unanswered', vendor: 'V' });
    const out = await call(db, 'list_unstated_costs', { include_teas: true });
    expect(out.unstated_teas).toBe(1);
    expect(out.teas.map((t: any) => t.product_id)).toEqual(['unanswered']);
  });

  it('groups by vendor, because that is the unit the answer arrives in', async () => {
    const db = makeDb();
    seedTea(db, { id: 'a', vendor: 'Yunnan Co' });
    seedTea(db, { id: 'b', vendor: 'Yunnan Co' });
    seedTea(db, { id: 'c', vendor: 'Taipei Co' });
    const out = await call(db, 'list_unstated_costs', {});
    expect(out.by_vendor[0]).toMatchObject({ vendor: 'Yunnan Co', teas: 2 });
    expect(out.by_vendor[1]).toMatchObject({ vendor: 'Taipei Co', teas: 1 });
  });

  it('reports what a receipt recorded, and that it disagrees with the stored currency', async () => {
    const db = makeDb();
    seedTea(db, { id: 'y562', vendor: 'Yunnan Co', currency: 'USD' });
    seedReceipt(db, 'y562', 'Yuan');
    const out = await call(db, 'list_unstated_costs', { include_teas: true });
    expect(out.by_vendor[0].receipt_says).toEqual(['Yuan']);
    expect(out.by_vendor[0].receipt_disagrees_with_stored).toBe(1);
    expect(out.teas[0].receipt_currency).toBe('Yuan');
  });

  it('calls two receipts in two currencies a conflict rather than picking one', async () => {
    const db = makeDb();
    seedTea(db, { id: 'split', vendor: 'V' });
    seedReceipt(db, 'split', 'Yuan');
    seedReceipt(db, 'split', 'NT');
    const out = await call(db, 'list_unstated_costs', { include_teas: true });
    expect(out.teas[0].receipt_currency).toBeNull();
    expect(out.teas[0].receipt_currencies_conflict).toBe(true);
    expect(out.by_vendor[0].conflicting_receipts).toBe(1);
  });

  it('never reaches another shop', async () => {
    const db = makeDb();
    seedTea(db, { id: 'mine', vendor: 'V' });
    seedTea(db, { id: 'theirs', vendor: 'V', account: OTHER });
    const out = await call(db, 'list_unstated_costs', { include_teas: true });
    expect(out.teas.map((t: any) => t.product_id)).toEqual(['mine']);
  });
});

describe('the currency has to be one the shop keeps current', () => {
  it('refuses a currency outside the daily refresh', () => {
    // A currency the refresh does not cover prices off a figure that never
    // changes again while looking exactly like a live rate. That is how
    // twenty-seven Hong Kong lots sat on a seeded number for months.
    expect(() => __testables.readCurrency('GBP')).toThrow(/does not keep|not a currency this shop keeps/i);
  });

  it("refuses the shop's own not-recorded sentinel", () => {
    expect(() => __testables.readCurrency('UNK')).toThrow(/sentinel/i);
    expect(() => __testables.readCurrency('unk')).toThrow(/sentinel/i);
  });

  it('accepts a typed name in any case and stores the shop spelling', () => {
    // The table keys CNY as 'Yuan'. Storing 'yuan' would miss the rate lookup.
    expect(__testables.readCurrency('yuan')).toBe('Yuan');
    expect(__testables.readCurrency(' NT ')).toBe('NT');
  });

  it('refuses nothing at all rather than defaulting', () => {
    expect(() => __testables.readCurrency('')).toThrow(/required/);
    expect(() => __testables.readCurrency(undefined)).toThrow(/required/);
  });
});

describe('correcting a vendor', () => {
  it('previews the count and the money before it changes anything', async () => {
    const db = makeDb();
    seedTea(db, { id: 'a', vendor: 'Yunnan Co' });
    seedTea(db, { id: 'b', vendor: 'Yunnan Co' });
    const preview = await call(db, 'set_cost_currency', { currency: 'Yuan', vendor: 'Yunnan Co' });
    expect(preview.preview.teas).toBe(2);
    expect(preview.preview.currency_actually_changes_on).toBe(2);
    expect(preview.confirmation_token).toBeTruthy();
    // Nothing moved yet.
    expect(stored(db, 'a').cost_currency).toBe('USD');
  });

  it('commits on the second call and marks the rows answered', async () => {
    const db = makeDb();
    seedTea(db, { id: 'a', vendor: 'Yunnan Co' });
    seedListing(db, 'a');
    const preview = await call(db, 'set_cost_currency', { currency: 'Yuan', vendor: 'Yunnan Co' });
    const done = await call(db, 'set_cost_currency', {
      currency: 'Yuan', vendor: 'Yunnan Co', confirm: preview.confirmation_token,
    });
    expect(done.ok).toBe(true);
    expect(done.teas_updated).toBe(1);
    expect(stored(db, 'a')).toEqual({ cost_currency: 'Yuan', cost_currency_source: 'stated' });
  });

  it('moves the listing mirror too, or partner browse keeps quoting the old currency', async () => {
    const db = makeDb();
    seedTea(db, { id: 'a', vendor: 'V' });
    seedListing(db, 'a');
    const preview = await call(db, 'set_cost_currency', { currency: 'Yuan', vendor: 'V' });
    await call(db, 'set_cost_currency', { currency: 'Yuan', vendor: 'V', confirm: preview.confirmation_token });
    const listing = db.sqlite.prepare(
      'SELECT cost_currency, cost_currency_source FROM product_listings WHERE legacy_product_id = ?'
    ).get('a') as any;
    expect(listing).toEqual({ cost_currency: 'Yuan', cost_currency_source: 'stated' });
  });

  it('leaves a currency somebody deliberately stated alone', async () => {
    const db = makeDb();
    seedTea(db, { id: 'unanswered', vendor: 'V' });
    seedTea(db, { id: 'answered', vendor: 'V', currency: 'NT', source: 'stated' });
    const preview = await call(db, 'set_cost_currency', { currency: 'Yuan', vendor: 'V' });
    expect(preview.preview.teas).toBe(1);
    await call(db, 'set_cost_currency', { currency: 'Yuan', vendor: 'V', confirm: preview.confirmation_token });
    expect(stored(db, 'answered').cost_currency).toBe('NT');
    expect(stored(db, 'unanswered').cost_currency).toBe('Yuan');
  });

  it('will reach the stated rows when told to out loud', async () => {
    const db = makeDb();
    seedTea(db, { id: 'answered', vendor: 'V', currency: 'NT', source: 'stated' });
    const args = { currency: 'Yuan', vendor: 'V', include_already_stated: true };
    const preview = await call(db, 'set_cost_currency', args);
    expect(preview.preview.teas).toBe(1);
    await call(db, 'set_cost_currency', { ...args, confirm: preview.confirmation_token });
    expect(stored(db, 'answered').cost_currency).toBe('Yuan');
  });

  it('says so when a receipt contradicts the answer, without refusing it', async () => {
    const db = makeDb();
    seedTea(db, { id: 'a', vendor: 'V' });
    seedReceipt(db, 'a', 'NT');
    const preview = await call(db, 'set_cost_currency', { currency: 'Yuan', vendor: 'V' });
    expect(preview.preview.contradicts_receipt).toHaveLength(1);
    expect(preview.preview.contradicts_receipt[0].receipt_says).toBe('NT');
  });

  it('does not touch another shop even when the vendor name matches', async () => {
    const db = makeDb();
    seedTea(db, { id: 'mine', vendor: 'V' });
    seedTea(db, { id: 'theirs', vendor: 'V', account: OTHER });
    const preview = await call(db, 'set_cost_currency', { currency: 'Yuan', vendor: 'V' });
    await call(db, 'set_cost_currency', { currency: 'Yuan', vendor: 'V', confirm: preview.confirmation_token });
    expect(stored(db, 'theirs').cost_currency).toBe('USD');
  });
});

describe('correcting named teas', () => {
  it('refuses a selection that is two selections', async () => {
    const db = makeDb();
    await expect(call(db, 'set_cost_currency', { currency: 'Yuan', vendor: 'V', product_ids: ['a'] }))
      .rejects.toThrow(/either vendor or product_ids/);
  });

  it('names an id it could not find rather than quietly doing less', async () => {
    const db = makeDb();
    seedTea(db, { id: 'a' });
    await expect(call(db, 'set_cost_currency', { currency: 'Yuan', product_ids: ['a', 'ghost'] }))
      .rejects.toThrow(/ghost/);
  });

  it('will not take an id from another shop', async () => {
    const db = makeDb();
    seedTea(db, { id: 'theirs', account: OTHER });
    await expect(call(db, 'set_cost_currency', { currency: 'Yuan', product_ids: ['theirs'] }))
      .rejects.toThrow(/theirs/);
  });
});

describe('the confirmation', () => {
  it('commits the teas the PREVIEW showed, not whatever matches now', async () => {
    // Five minutes is long enough for another door to add a tea to the vendor,
    // and confirming a count Adrian never saw is how a bulk action becomes a
    // surprise. The ticket carries the ids.
    const db = makeDb();
    seedTea(db, { id: 'a', vendor: 'V' });
    const preview = await call(db, 'set_cost_currency', { currency: 'Yuan', vendor: 'V' });
    seedTea(db, { id: 'late-arrival', vendor: 'V' });
    const done = await call(db, 'set_cost_currency', {
      currency: 'Yuan', vendor: 'V', confirm: preview.confirmation_token,
    });
    expect(done.teas_updated).toBe(1);
    expect(stored(db, 'late-arrival').cost_currency).toBe('USD');
  });

  it('cannot be spent twice', async () => {
    const db = makeDb();
    seedTea(db, { id: 'a', vendor: 'V' });
    const preview = await call(db, 'set_cost_currency', { currency: 'Yuan', vendor: 'V' });
    const args = { currency: 'Yuan', vendor: 'V', confirm: preview.confirmation_token };
    expect((await call(db, 'set_cost_currency', args)).ok).toBe(true);
    expect((await call(db, 'set_cost_currency', args)).error).toBe('invalid_or_expired_confirmation_token');
  });

  it('refuses a token confirmed against a different currency than it previewed', async () => {
    // Otherwise the preview says Yuan, the confirm says NT, and the shelf moves
    // by a number nobody was shown.
    const db = makeDb();
    seedTea(db, { id: 'a', vendor: 'V' });
    const preview = await call(db, 'set_cost_currency', { currency: 'Yuan', vendor: 'V' });
    const out = await call(db, 'set_cost_currency', {
      currency: 'NT', vendor: 'V', confirm: preview.confirmation_token,
    });
    expect(out.error).toBe('invalid_or_expired_confirmation_token');
    expect(stored(db, 'a').cost_currency).toBe('USD');
  });
});
