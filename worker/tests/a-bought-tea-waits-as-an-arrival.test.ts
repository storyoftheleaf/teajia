import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { curateIntakeTools } from '../src/mcpTools/curateIntake';
import { curateArrivalTools } from '../src/mcpTools/curateArrivals';
import { readCurateHoldings } from '../src/curateHoldings';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

/**
 * A tea entered with a quantity becomes stock, and nothing has to be retyped.
 *
 * Before this, `curate_add_tea` had no quantity and no state, so a bulk buy
 * entered tea by tea recorded the tea and lost how much of it there was: the
 * only way through was `sample: true`, which put a purchase on the sample
 * shelf. Quantities lived outside the system entirely.
 *
 * Ordered and on-the-way now wait as an arrival for `curate_approve_arrival`,
 * which was already the app's own incoming shelf; received goes straight into
 * stock through the same service that approval calls, so both doors leave the
 * same product, receipt and ledger row behind. Driven against a database
 * seeded from the migration ledger, with the acceptance service reached
 * through the worker's own route rather than a stand-in, because the point of
 * the test is that the shelf really moves.
 */

const SECRET = 'bought-tea-secret';
const ACCOUNT = 'account-a';
const OWNER = 'account-owner';
const auth = { accountId: ACCOUNT, userId: OWNER, userEmail: 'owner@test.dev', tokenId: 'token-one', creatorTier: 'account_owner' } as any;

const databases: SqliteD1[] = [];
afterEach(() => { while (databases.length) databases.pop()!.close(); });

async function acceptThroughTheApp(db: SqliteD1, proposalId: string) {
  const token = await signedToken(SECRET, { sub: OWNER, email: `${OWNER}@test.dev`, name: OWNER, active_account_id: ACCOUNT, platform_role: null });
  return worker.fetch(new Request(`https://worker.test/api/curate/receipt-proposals/${proposalId}/accept`, {
    method: 'POST',
    headers: new Headers({ Authorization: `Bearer ${token}`, 'X-Teajia-Account': ACCOUNT, 'Content-Type': 'application/json' }),
  }), { DB: db as any, JWT_SECRET: SECRET } as any);
}

function database() {
  const db = new SqliteD1('migrations');
  databases.push(db);
  seedIdentity(db, { userId: OWNER, accountId: ACCOUNT, role: 'owner', bundles: ['catalog', 'stock', 'publish', 'sell'] });
  db.sqlite.prepare(`INSERT INTO customers (id, account_id, name, tags) VALUES ('vendor-1', ?, 'Huang Wei', '["vendor"]')`).run(ACCOUNT);
  return { db, env: { DB: db, curateReceipts: { accept: (_scope: unknown, id: string) => acceptThroughTheApp(db, id) } } as any };
}

const addTea = (env: any, args: Record<string, unknown>) => curateIntakeTools.handlers.curate_add_tea(env, auth, args) as Promise<any>;
const arrival = (env: any, name: string, args: Record<string, unknown>) => curateArrivalTools.handlers[name](env, auth, args) as Promise<any>;
const proposals = (db: SqliteD1) => db.sqlite.prepare('SELECT * FROM curate_receipt_proposals').all() as any[];

describe('a tea bought and on the way', () => {
  const ON_THE_WAY = {
    name: 'Yiwu Gushu', vendor_name: 'Huang Wei', type: 'Sheng',
    bought: { quantity: { amount: 2, unit: 'kg' }, state: 'in_transit' },
    agent: 'GrokBot',
  };

  it('reads the quantity back in grams and writes nothing before confirmation', async () => {
    const { db, env } = database();

    const preview = await addTea(env, ON_THE_WAY);

    const bought = (preview.preview.will_file as string[]).find(line => line.startsWith('Bought'))!;
    expect(bought).toContain('2 kg (2000 g)');
    expect(bought).toContain('on the way');
    expect(preview.confirmation_token).toBeTruthy();
    expect(proposals(db)).toHaveLength(0);
  });

  it('waits as a pending arrival, and approving it moves exactly those grams into stock', async () => {
    const { db, env } = database();
    const preview = await addTea(env, ON_THE_WAY);

    const committed = await addTea(env, { ...ON_THE_WAY, confirm: preview.confirmation_token });

    expect(committed.committed).toBe(true);
    expect(committed.bought).toMatchObject({ quantity: 2000, unit: 'g', state: 'in_transit', waiting_to_be_approved: true });
    expect(proposals(db)).toEqual([expect.objectContaining({
      status: 'pending', quantity: 2000, unit: 'g', purpose: 'working', acquisition_state: 'in_transit', product_name: 'Yiwu Gushu',
    })]);
    /* Bought is not here: no product, no ledger row, until it lands. */
    expect(db.sqlite.prepare('SELECT COUNT(*) AS count FROM products').get()).toEqual({ count: 0 });

    const listed = await arrival(env, 'curate_list_arrivals', {});
    expect(listed).toMatchObject({ count: 1, arrivals: [{ quantity: 2000, acquisition_state: 'in_transit' }] });
    const approval = await arrival(env, 'curate_approve_arrival', { arrival_id: listed.arrivals[0].arrival_id });
    const approved = await arrival(env, 'curate_approve_arrival', { arrival_id: listed.arrivals[0].arrival_id, confirm: approval.confirmation_token });

    expect(approved.committed).toBe(true);
    expect(db.sqlite.prepare('SELECT stock_grams, inventory_purpose, is_public FROM products').get())
      .toMatchObject({ stock_grams: 2000, inventory_purpose: 'working', is_public: 0 });
    expect(db.sqlite.prepare('SELECT delta, movement_unit, reason FROM stock_ledger').get())
      .toMatchObject({ delta: 2000, movement_unit: 'gram', reason: 'PURCHASE_RECEIPT' });
    expect(proposals(db)[0].status).toBe('accepted');
  });
});

describe('a tea already here', () => {
  it('goes into stock on confirmation, through the service the arrivals screen calls', async () => {
    const { db, env } = database();
    const args = {
      name: 'Shop Floor Shou', vendor_name: 'Huang Wei', type: 'Shou',
      bought: { quantity: { amount: 1, unit: 'jin' }, state: 'received' },
    };
    const preview = await addTea(env, args);

    const committed = await addTea(env, { ...args, confirm: preview.confirmation_token });

    expect(committed.bought).toMatchObject({ quantity: 500, unit: 'g', state: 'received', waiting_to_be_approved: false, received: true });
    expect(db.sqlite.prepare('SELECT stock_grams FROM products').get()).toEqual({ stock_grams: 500 });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS count FROM stock_ledger').get()).toEqual({ count: 1 });
    expect(proposals(db)[0]).toMatchObject({ status: 'accepted', acquisition_state: 'received' });
  });

  it('counts pieces as pieces when nobody has said what one weighs, for teaware', async () => {
    const { db, env } = database();
    const args = {
      name: 'Zhuni Teapot', category: 'teaware', vendor_name: 'Huang Wei',
      bought: { quantity: { amount: 2, unit: 'piece' }, state: 'received' },
    };
    const preview = await addTea(env, args);
    await addTea(env, { ...args, confirm: preview.confirmation_token });

    expect(proposals(db)[0]).toMatchObject({ quantity: 2, unit: 'unit' });
    expect(db.sqlite.prepare('SELECT quantity_units, stock_grams FROM products').get()).toMatchObject({ quantity_units: 2 });
  });
});

describe('what a bought quantity refuses rather than guesses', () => {
  it('will not turn cakes of tea into grams nobody stated, and takes the weight when it is given', async () => {
    const { env } = database();
    const cakes = { name: 'Pressed Cake', bought: { quantity: { amount: 4, unit: 'cake' }, state: 'received' } };

    await expect(addTea(env, cakes)).rejects.toThrow(/not a weight until somebody says what one weighs/);

    const withWeight = await addTea(env, { ...cakes, pack_size_grams: 357 });
    const line = (withWeight.preview.will_file as string[]).find(entry => entry.startsWith('Bought'))!;
    expect(line).toContain('1428 g');
  });

  it('refuses a unit nobody named and a state nobody named', async () => {
    const { env } = database();
    await expect(addTea(env, { name: 'A', bought: { quantity: { amount: 1, unit: 'box' }, state: 'received' } })).rejects.toThrow(/quantity.unit must be one of/);
    await expect(addTea(env, { name: 'A', bought: { quantity: { amount: 1, unit: 'kg' }, state: 'maybe' } })).rejects.toThrow(/bought.state must be one of/);
    await expect(addTea(env, { name: 'A', bought: { quantity: { amount: 0, unit: 'kg' }, state: 'received' } })).rejects.toThrow(/greater than zero/);
  });

  it('sends a sample to the sample shelf, never to bought stock', async () => {
    const { env } = database();
    await expect(addTea(env, {
      name: 'Free Sample', bought: { quantity: { amount: 5, unit: 'g' }, state: 'received', purpose: 'sample' },
    })).rejects.toThrow(/use sample_state/);
  });
});

describe('sample grams and stock grams stay separate', () => {
  it('moves bought grams into stock while the sample portion stays unknown until it is weighed', async () => {
    const { db, env } = database();
    const args = {
      name: 'Two Shelves', vendor_name: 'Huang Wei',
      sample: true, sample_state: 'received',
      bought: { quantity: { amount: 1, unit: 'kg' }, state: 'received' },
    };
    const preview = await addTea(env, args);
    await addTea(env, { ...args, confirm: preview.confirmation_token });

    const [holding] = await readCurateHoldings(db as any, ACCOUNT);
    expect(holding.stock_grams).toBe(1000);
    /* Never 5 g, never 10 g: a received sample weighs what it weighs, and
       nobody has put it on the scales. */
    expect(holding.sample_grams).toBeNull();
    expect(holding.samples).toEqual([expect.objectContaining({ status: 'received', grams: null, grams_known: 0 })]);
    expect(db.sqlite.prepare('SELECT grams, grams_known FROM tea_samples').get()).toMatchObject({ grams_known: 0 });
  });

  it('records a measured sample weight when it is actually stated', async () => {
    const { db, env } = database();
    const args = { name: 'Weighed', sample_state: 'received', sample_grams: 7.5 };
    const preview = await addTea(env, args);
    await addTea(env, { ...args, confirm: preview.confirmation_token });

    const [holding] = await readCurateHoldings(db as any, ACCOUNT);
    expect(holding.sample_grams).toBe(7.5);
    expect(holding.stock_grams).toBe(0);
  });
});
