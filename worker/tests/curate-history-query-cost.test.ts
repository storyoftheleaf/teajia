import { afterEach, expect, it } from 'vitest';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';
import { readCurateHistory } from '../src/curateMutations';

const databases: SqliteD1[] = [];
afterEach(() => { for (const db of databases.splice(0)) db.close(); });

it('looks up each mutation’s records and undo by key instead of rescanning account history', async () => {
  const db = new SqliteD1('migrations'); databases.push(db);
  seedIdentity(db, { userId: 'owner', accountId: 'a', role: 'owner' });
  const insert = db.sqlite.prepare(`INSERT INTO curate_mutations
    (id,account_id,command_type,actor_user_id,confirmed_at,idempotency_key,undo_of)
    VALUES (?,?,'tea:edit','owner',?,?,?)`);
  const record = db.sqlite.prepare(`INSERT INTO curate_mutation_records VALUES (?,?, 'tea',?, 'null', '{}')`);
  for (const account of ['a', 'b']) for (let n=0;n<400;n++) {
    const id=`${account}-${n}`;
    insert.run(id,account,`2026-11-19T00:${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`,id,null);
    record.run(id,account,n===399?'target':`other-${n}`);
  }
  insert.run('undo','a','2026-11-19T01:00:00','undo','a-399');
  record.run('undo','a','target');
  const plans: string[]=[];
  const metered = { prepare(sql:string) {
    const prepared = db.prepare(sql);
    return { bind(...values:unknown[]) {
      plans.push(...db.sqlite.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...values).map((row:any)=>row.detail));
      return prepared.bind(...values);
    }};
  }};
  const result = await readCurateHistory({DB:metered} as any,
    {accountId:'a',userId:'owner',tokenId:'test',userEmail:'owner@test.dev',creatorTier:'account_owner'} as any,
    {entity_type:'tea',entity_id:'target'});
  expect(result.history.map(row=>row.id)).toEqual(['undo','a-399']);
  expect(result.history[1].undone_by).toBe('undo');
  expect(plans.some(plan=>/SEARCH r .*\(account_id=\? AND mutation_id=\?\)/.test(plan))).toBe(true);
  expect(plans.some(plan=>/SEARCH undone .*\(account_id=\? AND undo_of=\?\)/.test(plan))).toBe(true);
  expect(result.history.every(row=>row.records.every(record=>record.entity_id==='target'))).toBe(true);
});
