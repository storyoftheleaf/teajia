import { describe, expect, it } from 'vitest';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';
import { curateIntakeTools } from '../src/mcpTools/curateIntake';

/*
 * Adrian (2026-11-27): every vendor has a code like V1 and every tea or sample
 * a number within its vendor, so he can say "V1T12" instead of typing names.
 * The database hands the numbers out (migration 0149) whichever door adds the
 * tea, and never hands the same number out twice.
 */

const ACCOUNT = 'acc-codes';
type R = Record<string, any>;
const auth = { accountId: ACCOUNT, userId: 'adrian', userEmail: 'adrian@test.dev', tokenId: 'tok', creatorTier: 'account_owner' } as any;

function setup() {
  const db = new SqliteD1('migrations');
  seedIdentity(db, { userId: 'adrian', accountId: ACCOUNT, role: 'owner' });
  const run = (sql: string, ...values: unknown[]) => db.sqlite.prepare(sql).run(...values);
  return { db, run, get: (sql: string, ...values: unknown[]) => db.sqlite.prepare(sql).get(...values) as R };
}

describe('short codes', () => {
  it('numbers vendors and their teas as they arrive, and never reuses a number', () => {
    const { db, run, get } = setup();
    run(`INSERT INTO customers(id,name,account_id,tags) VALUES ('huang','Huang Wei',?,'["vendor"]')`, ACCOUNT);
    run(`INSERT INTO customers(id,name,account_id,tags) VALUES ('lin','Lin',?,'["vendor"]')`, ACCOUNT);
    run(`INSERT INTO customers(id,name,account_id,tags) VALUES ('guest','A guest',?,'[]')`, ACCOUNT);
    expect(get('SELECT code FROM curate_vendor_short_codes WHERE vendor_id = ?', 'huang').code).toBe('V1');
    expect(get('SELECT code FROM curate_vendor_short_codes WHERE vendor_id = ?', 'lin').code).toBe('V2');
    expect(get('SELECT code FROM curate_vendor_short_codes WHERE vendor_id = ?', 'guest')).toBeUndefined();

    for (const id of ['a', 'b', 'c']) run(`INSERT INTO tea_compass_entries(id,user_id,account_id,name,vendor_id) VALUES (?,?,?,?, 'huang')`, id, 'adrian', ACCOUNT, `Tea ${id}`);
    run(`INSERT INTO tea_compass_entries(id,user_id,account_id,name,linked_customer_id) VALUES ('s','adrian',?,'Sample','lin')`, ACCOUNT);
    const number = (id: string) => get('SELECT vendor_tea_number AS n FROM tea_compass_entries WHERE id = ?', id)?.n;
    expect(['a', 'b', 'c', 's'].map(number)).toEqual([1, 2, 3, 1]);

    run(`DELETE FROM tea_compass_entries WHERE id = 'c'`);
    run(`INSERT INTO tea_compass_entries(id,user_id,account_id,name,vendor_id) VALUES ('d','adrian',?,'Tea d','huang')`, ACCOUNT);
    expect(number('d')).toBe(4);
    // An edit keeps the number; a move to another vendor takes that vendor's next.
    run(`UPDATE tea_compass_entries SET notes = 'tasted' WHERE id = 'a'`);
    expect(number('a')).toBe(1);
    run(`UPDATE tea_compass_entries SET vendor_id = 'lin' WHERE id = 'b'`);
    expect(number('b')).toBe(2);
    // A contact tagged vendor later gets the next V code.
    run(`UPDATE customers SET tags = '["vendor"]' WHERE id = 'guest'`);
    expect(get('SELECT code FROM curate_vendor_short_codes WHERE vendor_id = ?', 'guest').code).toBe('V3');
    db.close();
  });

  it('lets the agent find a tea or vendor by its code, typed codes included', async () => {
    const { db, run } = setup();
    run(`INSERT INTO customers(id,name,account_id,tags) VALUES ('huang','Huang Wei',?,'["vendor"]')`, ACCOUNT);
    run(`INSERT INTO customers(id,name,account_id,tags) VALUES ('lin','Lin',?,'["vendor"]')`, ACCOUNT);
    run(`INSERT INTO curate_vendor_profiles(vendor_id,account_id,vendor_code) VALUES ('lin',?,'LN2')`, ACCOUNT);
    for (const [id, vendor] of [['a', 'huang'], ['b', 'huang'], ['c', 'lin']]) run(`INSERT INTO tea_compass_entries(id,user_id,account_id,name,vendor_id) VALUES (?,?,?,?,?)`, id, 'adrian', ACCOUNT, `Tea ${id}`, vendor);
    const find = (query: string) => curateIntakeTools.handlers.curate_find({ DB: db } as any, auth, { query }) as Promise<R>;

    const one = await find('v1t2');
    expect(one.teas.map((t: R) => [t.id, t.code])).toEqual([['b', 'V1T2']]);
    expect((await find('V1')).teas.map((t: R) => t.id).sort()).toEqual(['a', 'b']);
    expect((await find('V1')).vendors.map((v: R) => [v.id, v.code])).toEqual([['huang', 'V1']]);
    // A code typed on the vendor page is shown, and the V code still works.
    expect((await find('LN2T1')).teas.map((t: R) => [t.id, t.code])).toEqual([['c', 'LN2T1']]);
    expect((await find('V2T1')).teas.map((t: R) => t.id)).toEqual(['c']);
    // Ordinary searches are untouched.
    expect((await find('Tea a')).teas.map((t: R) => t.id)).toEqual(['a']);
    db.close();
  });
});
