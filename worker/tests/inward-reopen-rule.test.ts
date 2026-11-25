import { afterEach, expect, it } from 'vitest';
import {
  INWARD_BALI_LOT, REOPEN_ORDERING_NEEDS_PRICE_AND_SIZES, inwardOrdersPaused, inwardOrdersPausedSql,
} from '../../shared/catalog/inwardOrders';
import { SqliteD1 } from './helpers/sqliteD1';

const { accountId, id } = INWARD_BALI_LOT;
const counted = { id, stock_grams: 120, stock_known_at: '2026-11-24', stock_verified_at: '2026-11-25' };
const priced = { ...counted, fixed_retail_price_usd: 2, sold_in_whole_units: 0 };
const noPrice = { ...counted, fixed_retail_price_usd: null, sold_in_whole_units: 0 };
const wholeNoSize = { ...priced, sold_in_whole_units: 1, piece_weight_g: null };
const wholeSized = { ...priced, sold_in_whole_units: 1, piece_weight_g: 357 };

it('is switched on, so a recount alone does not reopen ordering', () => {
  expect(REOPEN_ORDERING_NEEDS_PRICE_AND_SIZES).toBe(true);
});

it('with the rule on, the count, the price and the sell sizes are all needed', () => {
  expect(inwardOrdersPaused(accountId, noPrice, true)).toBe(true);
  expect(inwardOrdersPaused(accountId, wholeNoSize, true)).toBe(true);
  expect(inwardOrdersPaused(accountId, priced, true)).toBe(false);
  expect(inwardOrdersPaused(accountId, wholeSized, true)).toBe(false);
  expect(inwardOrdersPaused(accountId, { ...priced, stock_verified_at: null }, true)).toBe(true);
});

it('with the rule off, a verified count alone reopens it', () => {
  expect(inwardOrdersPaused(accountId, noPrice, false)).toBe(false);
  expect(inwardOrdersPaused(accountId, wholeNoSize, false)).toBe(false);
  expect(inwardOrdersPaused(accountId, { ...noPrice, stock_verified_at: null }, false)).toBe(true);
});

it('the default argument follows the exported rule', () => {
  expect(inwardOrdersPaused(accountId, noPrice)).toBe(REOPEN_ORDERING_NEEDS_PRICE_AND_SIZES);
});

it('leaves every other lot and a row without price columns alone', () => {
  expect(inwardOrdersPaused('someone-else', { ...noPrice }, true)).toBe(false);
  expect(inwardOrdersPaused(accountId, counted, true)).toBe(false);
});

const opened: SqliteD1[] = [];
afterEach(() => opened.splice(0).forEach(db => db.close()));

function pausedInSql(sqlText: string, row: Record<string, unknown>) {
  const db = new SqliteD1('migrations');
  opened.push(db);
  db.sqlite.prepare(`INSERT INTO products (id, account_id, slug, type, product_name, given_name, stock_grams,
      stock_known_at, stock_verified_at, fixed_retail_price_usd, sold_in_whole_units, piece_weight_g, status)
    VALUES (?, ?, 'inward', 'Liu Bao', 'Inward', 'Inward', ?, ?, ?, ?, ?, ?, 'Active')`).run(
    id, accountId, row.stock_grams as number, row.stock_known_at as string, row.stock_verified_at as string,
    (row.fixed_retail_price_usd ?? null) as number | null, (row.sold_in_whole_units ?? 0) as number, (row.piece_weight_g ?? null) as number | null,
  );
  const found = db.sqlite.prepare(`SELECT ${sqlText} AS paused FROM products p WHERE p.id = ?`).get(id) as { paused: number };
  return found.paused === 1;
}

it('the SQL form agrees with the function for both settings', () => {
  for (const rule of [true, false]) {
    for (const row of [counted, priced, noPrice, wholeNoSize, wholeSized]) {
      expect(pausedInSql(inwardOrdersPausedSql(rule), row), JSON.stringify([rule, row])).toBe(
        'fixed_retail_price_usd' in row ? inwardOrdersPaused(accountId, row, rule) : inwardOrdersPaused(accountId, { ...row, fixed_retail_price_usd: null }, rule),
      );
    }
  }
});
