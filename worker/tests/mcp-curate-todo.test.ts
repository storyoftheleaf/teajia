import { describe, expect, it } from 'vitest';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';
import { curateIntakeTools, openTodos, markTodoDone } from '../src/mcpTools/curateIntake';
import { curateManageModule } from '../src/mcpTools/curateManage';
const auth = { accountId: 'todo-shop', userId: 'owner', userEmail: 'owner@test.dev', tokenId: 'token', creatorTier: 'account_owner' };
function setup() {
  const db = new SqliteD1();
  seedIdentity(db, { userId: 'owner', accountId: auth.accountId, role: 'owner' });
  seedIdentity(db, { userId: 'other', accountId: 'other-shop', role: 'owner' });
  return db;
}
const call = (db: SqliteD1, args: any, who = auth) => curateIntakeTools.handlers.curate_todo({ DB: db } as any, who, args) as Promise<any>;
async function confirm(db: SqliteD1, args: any) {
  const preview = await call(db, args);
  expect(preview.confirmation_token).toBeTruthy();
  return { preview, result: await call(db, { confirm: preview.confirmation_token }) };
}
async function undo(db: SqliteD1) {
  const preview = await curateManageModule.handlers.curate_undo({ DB: db } as any, auth, {}) as any;
  return curateManageModule.handlers.curate_undo({ DB: db } as any, auth, { confirmation_token: preview.confirmation_token });
}
const row = (db: SqliteD1, id: string) => db.sqlite.prepare('SELECT * FROM curate_todos WHERE id=?').get(id) as any;

describe('every MCP reminder change previews, records attribution and supports undo', () => {
  it('does not write before confirmation and records exact owner, token, agent and before/after facts', async () => {
    const db = setup();
    const preview = await call(db, { action: 'add', text: 'Ask the vendor', agent: 'Hermes' });
    expect(await openTodos({ DB: db } as any, auth.accountId)).toEqual([]);
    const result = await call(db, { confirm: preview.confirmation_token });
    expect(result).toMatchObject({ added: true, confirmed: true });
    expect(row(db, result.todo_id)).toMatchObject({ text: 'Ask the vendor', created_by_user_id: 'owner', from_agent: 'Hermes' });
    const history = await curateManageModule.handlers.curate_history({ DB: db } as any, auth, { entity_type: 'todo', entity_id: result.todo_id }) as any;
    expect(history.history[0]).toMatchObject({ actor_user_id: 'owner', actor_token_id: 'token', agent_name: 'Hermes', command_type: 'todo:add' });
    expect(JSON.parse(history.history[0].records[0].before_json)).toBeNull();
    expect(JSON.parse(history.history[0].records[0].after_json).text).toBe('Ask the vendor');
    await undo(db);
    expect(row(db, result.todo_id).deleted_at).toBeTruthy();
    expect(await openTodos({ DB: db } as any, auth.accountId)).toEqual([]);
    db.close();
  });
  it('previews completion, edit and delete, then each can be undone', async () => {
    for (const action of ['done', 'edit', 'delete']) {
      const db = setup();
      const { result: added } = await confirm(db, { action: 'add', text: 'Original' });
      const preview = await call(db, { action, todo_id: added.todo_id, text: 'Changed', agent: 'Claude' });
      expect(row(db, added.todo_id)).toMatchObject({ text: 'Original', done_at: null, deleted_at: null });
      await call(db, { confirm: preview.confirmation_token });
      const changed = row(db, added.todo_id);
      if (action === 'done') expect(changed.done_at).toBeTruthy();
      if (action === 'edit') expect(changed.text).toBe('Changed');
      if (action === 'delete') {
        expect(changed.deleted_at).toBeTruthy();
        expect(await openTodos({ DB: db } as any, auth.accountId)).toEqual([]);
        expect((await curateIntakeTools.handlers.curate_whats_missing({ DB: db } as any, auth, {}) as any).todos).toEqual([]);
        expect(await markTodoDone({ DB: db } as any, auth, added.todo_id)).toBe(false);
      }
      await undo(db);
      expect(row(db, added.todo_id)).toMatchObject({ text: 'Original', done_at: null, deleted_at: null });
      db.close();
    }
  });
  it('does not cross shops or commit after management was revoked', async () => {
    const db = setup();
    const preview = await call(db, { action: 'add', text: 'Protected' });
    db.sqlite.prepare('UPDATE account_members SET role=? WHERE account_id=? AND user_id=?').run('viewer', auth.accountId, auth.userId);
    await expect(call(db, { confirm: preview.confirmation_token })).rejects.toThrow(/Curate management/);
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM curate_todos').get()).toMatchObject({ n: 0 });
    db.sqlite.prepare('UPDATE account_members SET role=? WHERE account_id=? AND user_id=?').run('owner', auth.accountId, auth.userId);
    const { result } = await confirm(db, { action: 'add', text: 'Protected' });
    const foreign = { ...auth, accountId: 'other-shop', userId: 'other' };
    await expect(call(db, { action: 'delete', todo_id: result.todo_id }, foreign)).rejects.toThrow(/not found/);
    db.close();
  });
  it('advertises confirmation and edit/delete actions without requiring action on confirmation calls', () => {
    const schema = curateIntakeTools.defs.find(def => def.name === 'curate_todo')!.inputSchema as any;
    expect(schema.properties.action.enum).toEqual(['add', 'done', 'edit', 'delete']);
    expect(schema.properties.confirm).toBeTruthy();
    expect(schema.required).toBeUndefined();
  });
});
