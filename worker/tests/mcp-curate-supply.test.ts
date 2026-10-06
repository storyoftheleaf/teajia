import { describe, expect, it } from 'vitest';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';
import { curateIntakeTools } from '../src/mcpTools/curateIntake';
import { curateSupplyTools } from '../src/mcpTools/curateSupply';

/*
 * Adrian's example, 2026-10-07, said to GrokBot in one breath:
 *
 *   "I have this 2008 cooked puer I just got from Yee On Tea. A hundred dollars
 *    per hundred grams. Smoky, calming, slightly dry. I'm interested in buying
 *    it. Call it Deep Forest. It ships by boat to my Bali warehouse."
 *
 * and later "I want one kilo of it". What has to be true afterwards, asked of
 * the database the app reads: the vendor knows it quotes in HKD and stores in
 * Hong Kong; the tea carries its shop name, its intent and how it ships; the
 * shipping legs he reported give a landed cost; and the order is on the
 * Purchase Orders page with the message to copy and an arrival to approve.
 */

const ACCOUNT = 'acc-supply';
type R = Record<string, any>;

function makeDb(schema: 'schema' | 'migrations' = 'schema') {
  const db = new SqliteD1(schema);
  seedIdentity(db, { userId: 'adrian', accountId: ACCOUNT, role: 'owner' });
  // Units per US dollar, the way the exchange table holds them.
  db.sqlite.prepare('INSERT OR REPLACE INTO exchange_rates (currency, rate_to_usd) VALUES (?, ?)').run('HKD', 7.8);
  db.sqlite.prepare('INSERT OR REPLACE INTO exchange_rates (currency, rate_to_usd) VALUES (?, ?)').run('Yuan', 7.1);
  return db;
}

const auth = () => ({ accountId: ACCOUNT, userId: 'adrian', userEmail: 'a@test.dev', tokenId: 'tok', creatorTier: 'account_owner' }) as any;
const tools = { ...curateIntakeTools.handlers, ...curateSupplyTools.handlers };
const call = (db: SqliteD1, name: string, args: any): Promise<R> => tools[name]({ DB: db } as any, auth(), args) as Promise<R>;
async function confirm(db: SqliteD1, name: string, args: any) {
  const preview = await call(db, name, args);
  expect(preview.confirmation_token, JSON.stringify(preview)).toBeTruthy();
  return { preview, result: await call(db, name, { ...args, confirm: preview.confirmation_token }) };
}

async function deepForest(db: SqliteD1) {
  await confirm(db, 'curate_save_vendor', {
    name: 'Yee On Tea', agent: 'GrokBot', city: 'Hong Kong', country: 'Hong Kong',
    price_currency: 'hkd', storage: 'Hong Kong traditional storage', story: 'In business for about 70 years',
    ships_from: 'Sheung Wan, Hong Kong', route: 'courier to Guangzhou, then boat to Bali', lead_time_days: 35,
  });
  await confirm(db, 'curate_add_tea', {
    agent: 'GrokBot', name: '2008 Shou', shop_name: 'Deep Forest', vendor_name: 'Yee On Tea',
    type: 'Shou', year: '2008', storage: 'Hong Kong', origin_country: 'China', origin_region: 'Yunnan',
    price: { amount: 100, currency: 'HKD', per_grams: 100 },
    tasting: { flavor: ['smoky'], feeling: ['calming'], finish: ['finish-dry'] },
    wants: 'considering', ships_by: 'sea',
    description: 'A calm, smoky shou with the soft depth of Hong Kong storage.',
    note: 'Yee On has been in business for 70 years',
    said: 'I have this 2008 cooked puer I just got from Yee On Tea. A hundred dollars per hundred grams. Smoky, calming, slightly dry. Interested in buying. Call it Deep Forest. Ships by boat to Bali.',
  });
  return db.sqlite.prepare("SELECT * FROM tea_compass_entries WHERE name = '2008 Shou'").get() as R;
}

describe('one sentence about Deep Forest lands where the app reads it', () => {
  it('the tea carries its shop name, its intent, how it ships, and a public description apart from the private notes', async () => {
    const db = makeDb();
    const tea = await deepForest(db);
    expect(tea).toMatchObject({
      shop_name: 'Deep Forest', transport_mode: 'sea', decision: 'considering', status: 'want',
      price_amount: 100, price_currency: 'HKD', price_per_unit_grams: 100, storage: 'Hong Kong', year: 2008,
      description: 'A calm, smoky shou with the soft depth of Hong Kong storage.',
    });
    expect(tea.description).not.toMatch(/Yee On/);
    expect(JSON.parse(tea.tasting)).toEqual({ flavor: ['smoky'], feeling: ['calming'], finish: ['finish-dry'] });
  });

  it('the vendor remembers how it works, so the next tea from them needs fewer questions', async () => {
    const db = makeDb();
    await deepForest(db);
    const v = await call(db, 'curate_get_vendor', { name: 'Yee On Tea' });
    expect(v.knows).toMatchObject({ quotes_in: 'HKD', storage: 'Hong Kong traditional storage', ships_from: 'Sheung Wan, Hong Kong', lead_time_days: 35 });
    expect(v.knows.story).toMatch(/70 years/);
    expect(v.teas[0]).toMatchObject({ name: '2008 Shou', shop_name: 'Deep Forest' });
  });

  it('a later fact about the vendor is added to their story, not written over it', async () => {
    const db = makeDb();
    await deepForest(db);
    await confirm(db, 'curate_save_vendor', { name: 'Yee On Tea', story: 'Third generation runs the shop now' });
    const v = await call(db, 'curate_get_vendor', { name: 'Yee On Tea' });
    expect(v.knows.story).toMatch(/70 years[\s\S]*Third generation/);
    expect(v.knows.quotes_in).toBe('HKD');
  });
});

describe('shipping costs are kept as he said them, per vendor and per leg', () => {
  it('works out the cost per kilo from a total and a weight, and the newest figure replaces the older as current', async () => {
    const db = makeDb();
    await deepForest(db);
    const { preview } = await confirm(db, 'curate_record_freight', {
      vendor_name: 'Yee On Tea', leg: 'Hong Kong to Guangzhou', mode: 'courier',
      total: { amount: 450, currency: 'HKD' }, weight_kg: 3, observed_on: '2026-09-01',
    });
    expect(preview.preview.read_back).toMatch(/450 HKD for 3 kg, so 150 HKD a kilo/);
    const second = await confirm(db, 'curate_record_freight', {
      vendor_name: 'Yee On Tea', leg: 'Hong Kong to Guangzhou', mode: 'courier',
      total: { amount: 600, currency: 'HKD' }, weight_kg: 5, observed_on: '2026-10-05',
    });
    expect(second.preview.preview.replaces_as_current.per_kg).toBe('150 HKD');
    const v = await call(db, 'curate_get_vendor', { name: 'Yee On Tea' });
    expect(v.freight).toHaveLength(1);
    expect(v.freight[0]).toMatchObject({ leg: 'Hong Kong to Guangzhou', per_kg: '120 HKD' });
    expect((db.sqlite.prepare('SELECT COUNT(*) AS n FROM curate_freight_costs').get() as R).n).toBe(2);
  });

  it('refuses a shipping cost without a currency or a weight', async () => {
    const db = makeDb();
    await expect(call(db, 'curate_record_freight', { shared: true, leg: 'Boat', total: { amount: 2000 }, weight_kg: 20 })).rejects.toThrow(/currency/);
    await expect(call(db, 'curate_record_freight', { shared: true, leg: 'Boat', total: { amount: 2000, currency: 'Yuan' } })).rejects.toThrow(/weight_kg/);
  });
});

describe('"I want one kilo of it"', () => {
  async function withFreight(db: SqliteD1) {
    const tea = await deepForest(db);
    await confirm(db, 'curate_record_freight', { vendor_name: 'Yee On Tea', leg: 'Hong Kong to Guangzhou', mode: 'courier', total: { amount: 450, currency: 'HKD' }, weight_kg: 3 });
    await confirm(db, 'curate_record_freight', { shared: true, leg: 'Guangzhou to Bali by boat', mode: 'sea', total: { amount: 2000, currency: 'Yuan' }, weight_kg: 20, transit_days: 30 });
    return tea;
  }

  it('prices the order, adds the real freight legs, and leaves the order, the message and the arrival waiting', async () => {
    const db = makeDb();
    const tea = await withFreight(db);
    const { preview, result } = await confirm(db, 'curate_order', {
      agent: 'GrokBot', vendor_name: 'Yee On Tea', ships_by: 'sea',
      lines: [{ tea_id: tea.id, quantity: { amount: 1, unit: 'kg' } }],
      shared_legs: ['Guangzhou to Bali by boat'],
      message: '你好，我想订购2008年熟普洱一公斤。\nHello, I would like 1 kg of the 2008 shou.',
    });
    // 100 HKD per 100 g x 1000 g = 1000 HKD = $128.21; freight 150 HKD/kg = $19.23, 100 Yuan/kg = $14.08.
    expect(preview.preview.read_back).toMatch(/1 kg of Deep Forest at 100 HKD per 100 g = 1,000 HKD/);
    expect(preview.preview.read_back).toMatch(/Landed about \$161\.52/);
    expect(result.committed).toBe(true);

    const po = db.sqlite.prepare('SELECT * FROM purchase_orders').get() as R;
    expect(po).toMatchObject({ vendor_name: 'Yee On Tea', status: 'pending', display_currency: 'HKD', total_usd: 128.21 });
    expect(po.message_text).toMatch(/熟普洱/);
    expect(po.notes).toMatch(/Landed about \$161\.52/);
    expect(JSON.parse(po.items_json)[0]).toMatchObject({ product_name: 'Deep Forest', quantity_grams: 1000, compass_entry_id: tea.id });

    const arrival = db.sqlite.prepare('SELECT * FROM curate_receipt_proposals').get() as R;
    expect(arrival).toMatchObject({ compass_entry_id: tea.id, quantity: 1000, unit: 'g', status: 'pending', acquisition_kind: 'purchase', product_name: 'Deep Forest' });

    expect(db.sqlite.prepare('SELECT decision, status, buy_quantity_grams FROM tea_compass_entries WHERE id = ?').get(tea.id))
      .toEqual({ decision: 'selected', status: 'buying', buy_quantity_grams: 1000 });
  });

  it('says plainly when no shipping cost is on record, rather than inventing one', async () => {
    const db = makeDb();
    const tea = await deepForest(db);
    const preview = await call(db, 'curate_order', { vendor_name: 'Yee On Tea', lines: [{ tea_id: tea.id, quantity: { amount: 2, unit: 'jin' } }] });
    expect(preview.preview.read_back).toMatch(/landed cost is unknown/);
  });

  it('refuses to price an order in a currency the shop has no rate for, rather than reading it as dollars', async () => {
    const db = makeDb();
    const tea = await deepForest(db);
    db.sqlite.prepare("DELETE FROM exchange_rates WHERE currency = 'HKD'").run();
    await expect(call(db, 'curate_order', { vendor_name: 'Yee On Tea', lines: [{ tea_id: tea.id, quantity: { amount: 1, unit: 'kg' } }] }))
      .rejects.toThrow(/no exchange rate for HKD/);
  });

  it('a cake ordered by the piece needs its weight', async () => {
    const db = makeDb();
    const tea = await deepForest(db);
    await expect(call(db, 'curate_order', { vendor_name: 'Yee On Tea', lines: [{ tea_id: tea.id, quantity: { amount: 2, unit: 'piece' } }] }))
      .rejects.toThrow(/piece_grams/);
  });

  it('a tea with no price asks for one', async () => {
    const db = makeDb();
    await confirm(db, 'curate_add_tea', { name: 'Unpriced', vendor_name: 'Yee On Tea' });
    const id = (db.sqlite.prepare("SELECT id FROM tea_compass_entries WHERE name = 'Unpriced'").get() as R).id;
    await expect(call(db, 'curate_order', { vendor_name: 'Yee On Tea', lines: [{ tea_id: id, quantity: { amount: 1, unit: 'kg' } }] }))
      .rejects.toThrow(/no price with a currency/);
  });
});

describe('import and export contacts stay out of the vendor list', () => {
  it('a freight forwarder is its own contact, tagged freight, not offered as a vendor', async () => {
    const db = makeDb();
    await confirm(db, 'curate_save_vendor', { name: 'Bali Sea Cargo', role: 'freight', whatsapp: '+62 811', note: 'Handles the Guangzhou to Benoa boat' });
    const row = db.sqlite.prepare("SELECT type, tags FROM customers WHERE name = 'Bali Sea Cargo'").get() as R;
    expect(row.type).toBe('logistics');
    expect(JSON.parse(row.tags)).toEqual(['freight']);
    const found = await call(db, 'curate_find', { query: 'Bali' });
    expect(found.vendors).toHaveLength(0);
  });
});

describe('against the live database shape (migration ledger through 0032)', () => {
  it('the new columns and tables exist and the whole flow runs', async () => {
    const db = makeDb('migrations');
    const tea = await deepForest(db);
    expect(tea.shop_name).toBe('Deep Forest');
    await confirm(db, 'curate_record_freight', { vendor_name: 'Yee On Tea', leg: 'Hong Kong to Guangzhou', total: { amount: 450, currency: 'HKD' }, weight_kg: 3 });
    const { result } = await confirm(db, 'curate_order', { vendor_name: 'Yee On Tea', lines: [{ tea_id: tea.id, quantity: { amount: 1, unit: 'kg' } }] });
    expect(result.committed).toBe(true);
  });
});
