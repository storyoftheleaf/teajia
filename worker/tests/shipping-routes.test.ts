import { describe, expect, it } from 'vitest';
import { SqliteD1 } from './helpers/sqliteD1';
import { RouteRefusal, learnFromBills, listRoutes, removeRoute, saveRoute } from '../src/shippingRoutes';

/**
 * Shipping routes (migration 0042), driven against the database the migration
 * ledger builds, which is the shape the live shop has. A route holds no rate
 * (rates are set in Logistics) and keeps one it already had; one shop never reads
 * another's; what past bills say is worked out from the bills, never stored.
 */
const A = 'acct-a';
const B = 'acct-b';
const db = () => new SqliteD1('migrations') as unknown as D1Database;

describe('shipping routes', () => {
  it('saves a route with no rate: freight rates are set in Logistics', async () => {
    const d = db();
    const r = await saveRoute(d, A, null, { mode: 'air', carrier: 'Bali Air Cargo', destination: 'Teajia Bali', packing_percent: '35', billing_step_kg: 1 });
    expect(r.rate_per_kg).toBeNull();
    expect(r.rate_currency).toBeNull();
    expect(r.packing_percent).toBe(35);
    const [listed] = await listRoutes(d, A);
    expect(listed).toMatchObject({ mode: 'air', carrier: 'Bali Air Cargo', rate_per_kg: null, billing_step_kg: 1 });
  });

  it('refuses a rate or its currency on a route, zero and blank included', async () => {
    const d = db();
    for (const body of [{ rate_per_kg: 85, rate_currency: 'Yuan' }, { rate_per_kg: 0 }, { rate_per_kg: '' }, { rate_currency: 'cny' }]) {
      await expect(saveRoute(d, A, null, { mode: 'air', ...body })).rejects.toThrow(/Logistics/);
    }
    expect(await listRoutes(d, A)).toHaveLength(0);
  });

  it('refuses nonsense by name instead of storing it', async () => {
    const d = db();
    await expect(saveRoute(d, A, null, { mode: 'truck' })).rejects.toThrow(/air or sea/);
    await expect(saveRoute(d, A, null, { mode: 'air', packing_percent: 'lots' })).rejects.toThrow(/packing_percent/);
    await expect(saveRoute(d, A, null, { mode: 'air', billing_step_kg: 0 })).rejects.toThrow(/billing_step_kg/);
  });

  it('an edit changes only what it names, and one shop never touches another', async () => {
    const d = db();
    const r = await saveRoute(d, A, null, { mode: 'sea', carrier: 'Keelung', minimum_kg: 5 });
    // A rate typed before 2026-11-27 stays in its row, unread, and an edit never drops it.
    await d.prepare('UPDATE shipping_routes SET rate_per_kg = 12, rate_currency = ? WHERE id = ?').bind('Yuan', r.id).run();
    await saveRoute(d, A, r.id, { carrier: 'Keelung sea freight' });
    const [after] = await listRoutes(d, A);
    expect(after).toMatchObject({ carrier: 'Keelung sea freight', rate_per_kg: 12, rate_currency: 'Yuan', minimum_kg: 5 });
    await expect(saveRoute(d, B, r.id, { carrier: 'stolen' })).rejects.toThrow(/No such route/);
    expect(await removeRoute(d, B, r.id)).toBe(false);
    expect(await listRoutes(d, B)).toHaveLength(0);
    expect(await removeRoute(d, A, r.id)).toBe(true);
    expect(await listRoutes(d, A)).toHaveLength(0);
  });

  it('learns from the last three bills on that mode, in one money', async () => {
    const d = db();
    const bill = (id: string, mode: string, total: number, currency: string, kg: number, on: string) =>
      d.prepare(`INSERT INTO curate_freight_costs (id, account_id, vendor_id, leg, mode, total_amount, currency, weight_kg, observed_on, created_by_user_id)
                 VALUES (?, ?, NULL, 'China to Bali', ?, ?, ?, ?, ?, 'u1')`).bind(id, A, mode, total, currency, kg, on).run();
    expect(await learnFromBills(d, A, 'air')).toBeNull();
    await bill('1', 'air', 850, 'Yuan', 10, '2026-09-01');
    await bill('2', 'air', 450, 'Yuan', 5, '2026-09-10');
    await bill('3', 'air', 100, 'USD', 2, '2026-09-20');
    await bill('4', 'sea', 120, 'Yuan', 10, '2026-09-20');
    // The newest air bill is in dollars, so only that one is counted.
    expect(await learnFromBills(d, A, 'air')).toEqual({ bills: 1, per_kg: 50, currency: 'USD' });
    await bill('5', 'air', 900, 'Yuan', 10, '2026-09-30');
    // Newest three: 900/10 and 100/2 USD and 450/5; yuan wins (newest), USD is left out.
    expect(await learnFromBills(d, A, 'air')).toEqual({ bills: 2, per_kg: 90, currency: 'Yuan' });
    expect(await learnFromBills(d, A, 'sea')).toEqual({ bills: 1, per_kg: 12, currency: 'Yuan' });
    expect(await learnFromBills(d, B, 'air')).toBeNull();
  });
});
