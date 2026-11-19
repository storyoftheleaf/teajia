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
  // Deleted evidence must still be found through its parent; unrelated
  // account history never belongs to this tea.
  db.sqlite.prepare(`INSERT INTO curate_media_assets
    (id,account_id,object_key,filename,mime_type,size_bytes,sha256,created_by_user_id,created_at)
    VALUES ('asset','a','test-object','test.jpg','image/jpeg',1,'digest','owner','2026-11-19')`).run();
  db.sqlite.prepare(`INSERT INTO curate_attachments
    (id,account_id,asset_id,entity_type,entity_id,role,created_by_user_id,created_at,deleted_at)
    VALUES ('target-attachment','a','asset','tea','target','leaf','owner','2026-11-19','2026-11-20')`).run();
  insert.run('attachment-change','a','2026-11-19T00:30:00','attachment-change',null);
  db.sqlite.prepare(`INSERT INTO curate_mutation_records VALUES
    ('attachment-change','a','attachment','target-attachment','null','{}')`).run();
  const plans: string[]=[];
  const statements:string[]=[];
  const metered = { prepare(sql:string) {
    statements.push(sql);
    const prepared = db.prepare(sql);
    return { bind(...values:unknown[]) {
      plans.push(...db.sqlite.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...values).map((row:any)=>row.detail));
      return prepared.bind(...values);
    }};
  }};
  const result = await readCurateHistory({DB:metered} as any,
    {accountId:'a',userId:'owner',tokenId:'test',userEmail:'owner@test.dev',creatorTier:'account_owner'} as any,
    {entity_type:'tea',entity_id:'target'});
  expect(statements).toHaveLength(3); // membership, mutations, all returned records
  expect(result.history.map(row=>row.id)).toEqual(['undo','attachment-change','a-399']);
  expect(result.history[2].undone_by).toBe('undo');
  expect(plans.some(plan=>/SEARCH m .*\(id=\?\)/.test(plan))).toBe(true);
  expect(plans.filter(plan=>/SEARCH r .*idx_curate_mutation_records_entity .*account_id=\? AND entity_type=\? AND entity_id=\?/.test(plan)), plans.join('\n')).toHaveLength(2);
  expect(plans.some(plan=>/SEARCH a .*idx_curate_attachment_entity .*account_id=\? AND entity_type=\? AND entity_id=\?/.test(plan)), plans.join('\n')).toBe(true);
  expect(plans.filter(plan=>/SEARCH r USING INDEX idx_curate_records_tea_(before|after)/.test(plan)), plans.join('\n')).toHaveLength(2);
  expect(plans.some(plan=>/SEARCH undone .*\(account_id=\? AND undo_of=\?\)/.test(plan))).toBe(true);
  expect(result.history.every(row=>row.records.every(record=>['target','target-attachment'].includes(record.entity_id)))).toBe(true);
});
