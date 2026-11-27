import { afterEach, describe, expect, it } from 'vitest';
import { accountFreightDefaults, addPricingFields } from '../src/productPricing';
import { freightFor, packedM3PerKg, serviceRatesFromRows, type FreightDefaults } from '../src/shippingRate';
import { SqliteD1 } from './helpers/sqliteD1';

// A tea names the logistics service it travels by (migration 0148). The rate
// stays on the service: freight comes from the last confirmed shipment by that
// service, else the service's quote, else the shop rate, which is also what a
// tea with no service keeps.

const rates = new Map([['USD', 1], ['Yuan', 7]]);
const lookup = (c: string) => rates.get(c);

const services = serviceRatesFromRows([
  { id: 'air', basis: 'kg', rate: 70, currency: 'Yuan', active: 1, name: 'Airmail', logistics_company_name: 'Guangzhou' },
  { id: 'boat', basis: 'm3', rate: 700, currency: 'Yuan', active: 1, name: 'Boat', logistics_company_name: 'Guangzhou' },
  { id: 'suitcase', basis: 'fixed', rate: 50, currency: 'USD', active: 1, name: 'Suitcase', logistics_company_name: 'Me' },
  { id: 'old', basis: 'kg', rate: 1, currency: 'USD', active: 0, name: 'Old', logistics_company_name: 'Gone' },
], lookup);
const defaults: FreightDefaults = { shopPerKgUsd: 85 / 7, services, shipments: { 'shou|air': { perKgUsd: 4, dated: '2026-11-01' } } };

// 700 yuan for 1,000 g: 0.10 USD a gram before freight.
const tea = { id: 'yiwu', type: 'Sheng', form: 'Loose', cost_amount: 700, cost_currency: 'Yuan', quantity_purchased: 1000, shipping_rate_per_kg: null, fixed_retail_price_usd: null, stock_grams: 100 };
const retail = (extra: Record<string, unknown>) => addPricingFields({ ...tea, ...extra }, rates, defaults).retail_price_per_gram_usd;
const at = (freightPerKgUsd: number) => Math.round((0.1 + freightPerKgUsd / 1000) * 3 * 100) / 100;

describe('freight from the logistics service', () => {
  it('keeps the shop rate for a tea with no service, so no price moves until one is picked', () => {
    expect(retail({ freight_service_id: null })).toBe(at(85 / 7));
    expect(addPricingFields(tea, rates, defaults).freight_source).toBe('shop');
  });

  it('prices a kilo rate as it is and a cubic-metre rate through the packing estimate', () => {
    expect(retail({ freight_service_id: 'air' })).toBe(at(10));
    expect(packedM3PerKg({ form: 'Loose' })).toBe(0.008);
    expect(packedM3PerKg({ form: 'Cake' })).toBe(0.003);
    expect(freightFor({ ...tea, freight_service_id: 'boat' }, defaults).perKgUsd).toBeCloseTo(100 * 0.008, 12);
    expect(freightFor({ ...tea, form: 'Cake', freight_service_id: 'boat' }, defaults).perKgUsd).toBeCloseTo(100 * 0.003, 12);
  });

  it('prefers the last confirmed shipment by that service over its quote', () => {
    const shou = { ...tea, id: 'shou', freight_service_id: 'air' };
    expect(freightFor(shou, defaults)).toEqual({ perKgUsd: 4, source: 'shipment', dated: '2026-11-01' });
    expect(addPricingFields(shou, rates, defaults).retail_price_per_gram_usd).toBe(at(4));
    // A shipment by another service does not price this one.
    expect(freightFor({ ...shou, freight_service_id: 'boat' }, defaults).source).toBe('service');
  });

  it('falls back to the shop rate, and says why, for a fixed-price or archived service', () => {
    expect(freightFor({ ...tea, freight_service_id: 'suitcase' }, defaults)).toEqual({ perKgUsd: 85 / 7, source: 'shop', fellBack: 'fixed' });
    expect(freightFor({ ...tea, freight_service_id: 'old' }, defaults)).toEqual({ perKgUsd: 85 / 7, source: 'shop', fellBack: 'gone' });
  });

  it('lets a rate typed on the tea win over its service', () => {
    expect(retail({ freight_service_id: 'air', shipping_rate_per_kg: 35 })).toBe(at(5));
  });
});

describe('reading a shop\'s services and shipments from the database', () => {
  let db: SqliteD1;
  afterEach(() => db?.close?.());

  it('divides a confirmed shipment bill across its teas and reads it per tea and service', async () => {
    db = new SqliteD1('migrations');
    db.sqlite.exec('PRAGMA foreign_keys = OFF');
    // The rows below stand for a shipment already made; the guards that check how one is made are not under test.
    for (const { name } of db.sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'trigger' AND tbl_name LIKE 'logistics_%'").all() as Array<{ name: string }>) db.sqlite.exec(`DROP TRIGGER "${name}"`);
    db.sqlite.exec(`
      INSERT INTO accounts (id, name, slug, default_shipping_rate_per_kg, default_shipping_rate_currency) VALUES ('acct', 'Shop', 'shop', 85, 'Yuan');
      INSERT INTO exchange_rates (currency, rate_to_usd, last_updated) VALUES ('Yuan', 7, datetime('now'));
      INSERT INTO logistics_services (id, account_id, logistics_company_id, logistics_company_name, name, mode, basis, rate, currency, active, created_at, updated_at)
        VALUES ('air', 'acct', 'co', 'Guangzhou', 'Airmail', 'air', 'kg', 70, 'Yuan', 1, '2026-10-01', '2026-10-01');
      INSERT INTO logistics_shipments (id, account_id, logistics_company_name, mode, state, freight_json, service_id, idempotency_key, request_fingerprint, created_at, dispatched_at)
        VALUES ('s1', 'acct', 'Guangzhou', 'air', 'received', '{"basis":"fixed","rate":null,"billed_quantity":null,"total_amount":280,"currency":"Yuan","confirmed":true,"allocation_basis":"kg"}', 'air', 'k1', 'f1', '2026-11-01', '2026-11-02');
      INSERT INTO inventory_receipt_lines (id, receipt_id, account_id, product_id, expected_quantity, unit, intended_purpose, source_kind)
        VALUES ('r1', 'rc', 'acct', 'yiwu', 1000, 'g', 'working', 'test'), ('r2', 'rc', 'acct', 'shou', 3000, 'g', 'working', 'test');
      INSERT INTO logistics_shipment_lines (id, account_id, shipment_id, purchase_id, receipt_line_id, quantity, received_quantity, weight_kg, weight_estimated, volume_m3, volume_estimated)
        VALUES ('l1', 'acct', 's1', 'p', 'r1', 1000, 1000, 1, 0, NULL, 1), ('l2', 'acct', 's1', 'p', 'r2', 3000, 3000, 3, 0, NULL, 1);
    `);
    const read = await accountFreightDefaults({ DB: db as any }, 'acct', rates);
    // 280 yuan over 4 kg is 70 yuan a kilo for both, which is 10 dollars.
    expect(read.services.air).toMatchObject({ basis: 'kg', perUnitUsd: 10 });
    expect(read.shipments['yiwu|air']).toEqual({ perKgUsd: 10, dated: '2026-11-02' });
    expect(read.shipments['shou|air']).toEqual({ perKgUsd: 10, dated: '2026-11-02' });
    expect(read.shopPerKgUsd).toBeCloseTo(85 / 7, 12);
  });
});
