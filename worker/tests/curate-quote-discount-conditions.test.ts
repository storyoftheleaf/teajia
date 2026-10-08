import { afterEach, describe, expect, it } from 'vitest';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';
import { readQuoteFields } from '../../src/lib/curateStructuredFields';
import { getCurateQuote, listCurateQuotes, prepareCurateQuoteWrite } from '../src/curateQuotes';
import { curateQuoteTools } from '../src/mcpTools/curateQuotes';
import { previewCurateUndo, confirmCurateMutation } from '../src/curateMutations';
import { QUOTE_SCHEMA } from '../src/mcpTools/curateSchemas';
const databases: SqliteD1[] = [];
afterEach(() => { for (const db of databases.splice(0)) db.close(); });
const auth = { accountId: 'a', userId: 'owner', tokenId: 'token', userEmail: 'owner@test.dev' } as any;
function setup(shape: 'schema' | 'migrations') {
  const db = new SqliteD1(shape); databases.push(db);
  seedIdentity(db, { accountId: 'a', userId: 'owner' });
  db.sqlite.exec("INSERT INTO customers(id,account_id,name) VALUES ('vendor','a','LKY')");
  return db;
}
const unknown = { vendor_id: 'vendor', reference: 'LKY', discount_percent: 25, discount_condition_type: 'unknown', minimum_order_amount: 2000, currency: 'HKD' };
async function write(db: SqliteD1, input: any, id?: string) {
  const prepared = await prepareCurateQuoteWrite(db as any, auth, input, id);
  db.batch(prepared.statements as any);
  return getCurateQuote(db as any, auth, prepared.id);
}
describe('supplier discount conditions are explicit private quote evidence', () => {
  it('accepts an unknown 25% threshold without guessing from the quote order minimum', () => {
    expect(readQuoteFields(unknown)).toMatchObject(unknown);
    expect(readQuoteFields(unknown)).not.toHaveProperty('discount_min_amount');
    expect(readQuoteFields({ vendor_id: 'vendor', discount_condition_type: 'unknown', lines: [{ id: 'line', compass_entry_id: 'tea', discount_percent: 25 }] })).toMatchObject({ discount_condition_type: 'unknown' });
    expect(readQuoteFields({ reference: 'Original quote' })).toEqual({ reference: 'Original quote' });
  });
  it('validates paired threshold currency, percent bounds, whole quantity and matching conditions', () => {
    for (const fields of [
      { discount_percent: 101 }, { discount_percent: NaN }, { discount_percent: -1 },
      { discount_condition_type: 'unknown' }, { discount_percent: 25, discount_condition_type: 'invented' },
      { discount_percent: 25, discount_condition_type: 'min_order_amount' },
      { discount_percent: 25, discount_condition_type: 'min_order_amount', discount_min_amount: 100 },
      { discount_percent: 25, discount_condition_type: 'min_quantity', discount_min_quantity: 1.5 },
      { discount_percent: 25, discount_condition_type: 'unknown', discount_min_weight_grams: 1000 },
      { discount_percent: 25, discount_condition_type: 'min_order_weight', discount_min_weight_grams: -1 },
      { discount_percent: 25, discount_condition_type: 'min_order_amount', discount_min_amount: 0, discount_min_currency: 'HKD' },
      { discount_percent: 25, discount_condition_type: 'min_quantity', discount_min_quantity: 0 },
    ]) expect(() => readQuoteFields(fields)).toThrow();
    expect(() => readQuoteFields({ discount_percent: 25, discount_condition_type: 'min_order_amount', discount_min_amount: 100, discount_min_currency: 'unrecognized' }, {}, () => null)).toThrow(/currency/);
    expect(readQuoteFields({ discount_percent: 0, discount_condition_type: 'min_quantity', discount_min_quantity: 1 })).toMatchObject({ discount_percent: 0, discount_min_quantity: 1 });
    expect(readQuoteFields({ discount_percent: 25, discount_condition_type: 'min_order_amount', discount_min_amount: 100, discount_min_currency: 'cny' })).toMatchObject({ discount_min_amount: 100, discount_min_currency: 'Yuan' });
  });
  it.each(['schema','migrations'] as const)('round trips, patches, clears and undoes thresholds on %s without pricing or notes', async shape => {
    const db = setup(shape);
    const original = await write(db, unknown);
    expect(original).toMatchObject({ ...unknown, discount_min_amount: null, discount_min_currency: null, discount_min_weight_grams: null, discount_min_quantity: null });
    const amount = await write(db, { discount_condition_type: 'min_order_amount', discount_min_amount: 100, discount_min_currency: 'cny' }, original!.id);
    expect(amount).toMatchObject({ discount_percent: 25, discount_min_amount: 100, discount_min_currency: 'Yuan', minimum_order_amount: 2000, currency: 'HKD' });
    expect(await listCurateQuotes(db as any, auth)).toMatchObject([{ discount_min_amount: 100 }]);
    await expect(write(db, { discount_min_amount: null }, original!.id)).rejects.toThrow(/together/);
    await expect(write(db, { discount_percent: null }, original!.id)).rejects.toThrow(/explicit/);
    const cleared = await write(db, { discount_percent: null, discount_condition_type: null, discount_min_amount: null, discount_min_currency: null }, original!.id);
    expect(cleared).toMatchObject({ discount_percent: null, discount_condition_type: null, discount_min_amount: null, discount_min_currency: null });
    const undo = await previewCurateUndo({ DB: db } as any, auth);
    await confirmCurateMutation({ DB: db } as any, auth, undo.confirmation_token);
    expect(await getCurateQuote(db as any, auth, original!.id)).toMatchObject({ discount_percent: 25, discount_condition_type: 'min_order_amount', discount_min_amount: 100, discount_min_currency: 'Yuan' });
    for (const table of ['products','stock_ledger','notes']) expect(db.sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get()).toMatchObject({ n: 0 });
    expect(db.sqlite.prepare("SELECT notes FROM customers WHERE id='vendor'").get()).toMatchObject({ notes: null });
  });
  it('a condition governs a stated line discount and partial updates preserve it', async () => {
    const db = setup('schema');
    db.sqlite.exec("INSERT INTO tea_compass_entries(id,account_id,user_id,name,vendor_id) VALUES ('tea','a','owner','Tea','vendor')");
    const quote = await write(db, { vendor_id: 'vendor', discount_condition_type: 'unknown', lines: [{ id: 'line', compass_entry_id: 'tea', discount_percent: 25 }] });
    expect(quote).toMatchObject({ discount_percent: null, discount_condition_type: 'unknown', lines: [{ discount_percent: 25 }] });
    expect(await write(db, { reference: 'Revised reference' }, quote!.id)).toMatchObject({ discount_condition_type: 'unknown', lines: [{ discount_percent: 25 }] });
    await expect(write(db, { lines: [{ id: 'line', compass_entry_id: 'tea', discount_percent: null }] }, quote!.id)).rejects.toThrow(/explicit/);
    expect(db.sqlite.prepare("SELECT discount_percent FROM tea_compass_entries WHERE id='tea'").get()).toMatchObject({ discount_percent: null });
  });
  it.each(['min_order_weight','min_quantity','none'] as const)('stores %s with the exact stated threshold', async condition => {
    const db = setup('schema');
    const threshold = condition === 'min_order_weight' ? { discount_min_weight_grams: 1000 } : condition === 'min_quantity' ? { discount_min_quantity: 10 } : {};
    expect(await write(db, { vendor_id: 'vendor', discount_percent: 25, discount_condition_type: condition, ...threshold })).toMatchObject({ discount_condition_type: condition, ...threshold });
  });
  it('previews and confirms conditions durably and detects a changed condition after preview', async () => {
    const db = setup('schema'); const tool = curateQuoteTools.handlers.curate_save_quote;
    const preview = await tool({ DB: db } as any, auth, { quote: unknown }) as any;
    expect(preview.preview.will_file).toMatchObject(unknown);
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM curate_quotes').get()).toMatchObject({ n: 0 });
    const result = await tool({ DB: db } as any, auth, { confirm: preview.confirmation_token }) as any;
    expect(result.quote).toMatchObject(unknown);
    const edit = await tool({ DB: db } as any, auth, { quote_id: result.quote.id, quote: { discount_percent: 20 } }) as any;
    db.sqlite.prepare('UPDATE curate_quotes SET discount_condition_type=? WHERE id=?').run('none', result.quote.id);
    expect(await tool({ DB: db } as any, auth, { confirm: edit.confirmation_token })).toMatchObject({ error: 'quote_changed_since_preview' });
  });
  it('advertises the exact header fields and nullable condition enum', () => {
    expect(QUOTE_SCHEMA.properties.discount_condition_type.enum).toEqual(['none','min_order_amount','min_order_weight','min_quantity','unknown',null]);
    for (const field of ['discount_percent','discount_min_amount','discount_min_currency','discount_min_weight_grams','discount_min_quantity']) expect(QUOTE_SCHEMA.properties).toHaveProperty(field);
  });
});
