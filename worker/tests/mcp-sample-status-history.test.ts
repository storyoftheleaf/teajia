import { describe, expect, it } from 'vitest';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';
import { writingToolModule } from '../src/mcpTools/writing';
import { confirmCurateMutation, previewCurateUndo, readCurateHistory } from '../src/curateMutations';
import type { ToolAuth, ToolEnv } from '../src/mcpTools/registry';

function setup() {
  const db = new SqliteD1();
  seedIdentity(db, { userId: 'manager', accountId: 'shop' });
  db.exec(`INSERT INTO tea_sample_sets(id,account_id,name) VALUES('set','shop','Samples');
    INSERT INTO tea_compass_entries(id,account_id,user_id,name,sample_state,sample_set_id)
      VALUES('tea','shop','original-author','Tea','requested','set');
    INSERT INTO tea_samples(id,account_id,set_id,compass_entry_id,name,status,grams,grams_known,created_by,user_id)
      VALUES('sample','shop','set','tea','Tea','requested',10,0,'original-author','original-author');`);
  const auth: ToolAuth = { accountId: 'shop', userId: 'manager', userEmail: 'manager@test.dev', tokenId: 'token', creatorTier: 'owner' };
  const env: ToolEnv = { DB: db as unknown as D1Database };
  const row = (table: string) => db.prepare(`SELECT * FROM ${table} WHERE id=?`).bind(table === 'tea_samples' ? 'sample' : 'tea').first<any>();
  const status = (args: Record<string, unknown>, actor = auth) => writingToolModule.handlers.set_sample_status(env, actor, { sample_id: 'sample', status: 'received', ...args }) as Promise<any>;
  return { db, env, auth, row, status };
}

describe('Curate-linked sample status through MCP', () => {
  it('updates the merge survivor, keeps the physical sample source and records the previewed agent', async () => {
    const { db, env, auth, row, status } = setup();
    db.exec(`INSERT INTO tea_compass_entries(id,account_id,user_id,name,sample_state)
      VALUES('survivor','shop','survivor-author','Survivor','requested');
      UPDATE tea_compass_entries SET merged_into_id='survivor', archived_at='merged' WHERE id='tea';`);
    const original = row('tea_compass_entries');
    const p = await status({ status: 'tasted', agent: 'Sourcing helper' });
    await status({ status: 'tasted', agent: 'Changed after preview', confirm: p.confirmation_token });
    expect(row('tea_samples')).toMatchObject({ status: 'tasted', compass_entry_id: 'tea', grams: 10, grams_known: 0 });
    expect(row('tea_compass_entries')).toEqual(original);
    expect(db.prepare("SELECT * FROM tea_compass_entries WHERE id='survivor'").first<any>()).toMatchObject({ sample_state: 'tasted', user_id: 'survivor-author' });
    const history = (await readCurateHistory(env, auth)).history;
    expect(history[0].agent_name).toBe('Sourcing helper');
    const undo = await previewCurateUndo(env, auth);
    await confirmCurateMutation(env, auth, undo.confirmation_token);
    expect(db.prepare("SELECT * FROM tea_compass_entries WHERE id='survivor'").first<any>().sample_state).toBe('requested');
    expect(row('tea_compass_entries')).toEqual(original);
    db.close();
  });

  it('rejects changed merge redirects and inactive surviving tea links', async () => {
    const { db, status, row } = setup();
    db.exec(`INSERT INTO tea_compass_entries(id,account_id,user_id,name,sample_state)
      VALUES('survivor','shop','author','Survivor','requested');
      UPDATE tea_compass_entries SET merged_into_id='survivor', archived_at='merged' WHERE id='tea';`);
    const p = await status({});
    db.exec("UPDATE tea_compass_entries SET merged_into_id=NULL WHERE id='tea'");
    expect(await status({ confirm: p.confirmation_token })).toMatchObject({ error: 'stale_preview' });
    expect(row('tea_samples').status).toBe('requested');
    await expect(status({})).rejects.toThrow('inactive tea link');
    db.exec("UPDATE tea_compass_entries SET archived_at=NULL, deleted_at='deleted' WHERE id='tea'");
    await expect(status({})).rejects.toThrow('inactive tea link');
    db.close();
  });

  it('previews without writes, records both lifecycle facts and undoes them without measuring or reauthoring', async () => {
    const { db, env, auth, row, status } = setup();
    const sample = row('tea_samples'); const tea = row('tea_compass_entries');
    const p = await status({});
    expect(row('tea_samples')).toEqual(sample);
    expect(row('tea_compass_entries')).toEqual(tea);
    expect((await readCurateHistory(env, auth)).history).toEqual([]);
    const result = await status({ confirm: p.confirmation_token });
    expect(result).toMatchObject({ committed: true, mutation_id: expect.any(String) });
    expect(row('tea_samples')).toMatchObject({ status: 'received', grams: 10, grams_known: 0, user_id: 'original-author', created_by: 'original-author' });
    expect(row('tea_compass_entries')).toMatchObject({ sample_state: 'received', user_id: 'original-author' });
    const history = (await readCurateHistory(env, auth, { entity_type: 'tea', entity_id: 'tea' })).history;
    expect(history).toHaveLength(1);
    expect(history[0].actor_user_id).toBe('manager');
    expect(history[0].records.map((r: any) => r.entity_type).sort()).toEqual(['sample', 'tea']);
    const undo = await previewCurateUndo(env, auth);
    await confirmCurateMutation(env, auth, undo.confirmation_token);
    expect(row('tea_samples')).toEqual(sample);
    expect(row('tea_compass_entries')).toEqual(tea);
    db.close();
  });

  it('rejects stale sample or tea previews atomically and never logs a successful status', async () => {
    for (const change of ["UPDATE tea_samples SET status='tasted' WHERE id='sample'", "UPDATE tea_compass_entries SET notes='newer' WHERE id='tea'", "UPDATE tea_samples SET grams=8 WHERE id='sample'"]) {
      const { db, env, auth, row, status } = setup();
      const p = await status({}); db.exec(change);
      const sample = row('tea_samples'); const tea = row('tea_compass_entries');
      expect(await status({ confirm: p.confirmation_token })).toMatchObject({ error: 'stale_preview' });
      expect(row('tea_samples')).toEqual(sample); expect(row('tea_compass_entries')).toEqual(tea);
      expect((await readCurateHistory(env, auth)).history).toEqual([]);
      expect(db.prepare("SELECT COUNT(*) AS n FROM activity_logs WHERE action='SAMPLE_STATUS_SET_MCP'").first<any>().n).toBe(0);
      db.close();
    }
  });

  it('requires actual Curate management at preview and again after capability revocation', async () => {
    const { db, status } = setup();
    db.exec("UPDATE account_members SET role='staff', permissions='{}'");
    await expect(status({})).rejects.toThrow('Curate management');
    db.exec("UPDATE account_members SET permissions='{\"curate_manage\":true}'");
    const p = await status({});
    db.exec("UPDATE account_members SET permissions='{}'");
    await expect(status({ confirm: p.confirmation_token })).rejects.toThrow('Curate management');
    expect(db.prepare('SELECT COUNT(*) AS n FROM curate_mutations').first<any>().n).toBe(0);
    db.close();
  });

  it('retains the unlinked shelf behavior but requires a fresh preview if a tea is linked later', async () => {
    const { db, status, row } = setup();
    db.exec("UPDATE tea_samples SET compass_entry_id=NULL; UPDATE account_members SET role='staff', permissions='{}'");
    const first = await status({});
    expect(await status({ confirm: first.confirmation_token })).toMatchObject({ committed: true });
    const second = await status({ status: 'tasted' });
    db.exec("UPDATE tea_samples SET compass_entry_id='tea'");
    expect(await status({ status: 'tasted', confirm: second.confirmation_token })).toMatchObject({ error: 'stale_preview' });
    expect(row('tea_samples').status).toBe('received');
    db.close();
  });
});
