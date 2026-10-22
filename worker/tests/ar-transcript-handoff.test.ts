import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { handleArBridge } from '../src/curateArBridge';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';

const scope = { accountId: 'handoff-shop', userId: 'handoff-owner' };
const foreign = { accountId: 'foreign-shop', userId: 'foreign-owner' };
let db: SqliteD1;
const changes = () => (db.sqlite.prepare('SELECT total_changes() AS n').get() as { n: number }).n;
function call(query = '', options: { scope?: typeof scope | null; method?: string; id?: string } = {}) {
  return handleArBridge(new Request(`https://teajia.test/api/curate/ar-create/links${query}`, { method: options.method ?? 'GET' }), { DB: db as unknown as D1Database }, options.scope === null ? undefined : options.scope ?? scope, 'links', options.id);
}
function seedLink(id: string, entryId: string, sourceId: string, accountId = scope.accountId) {
  const text = `The entire original ${sourceId} transcript.\nAll its tea discussion stays attached.`;
  db.sqlite.prepare(`INSERT INTO curate_ar_links
    (id,account_id,entry_id,source_id,source_title,source_hash,excerpt,excerpt_start,excerpt_end,request_id,linked_by_user_id,linked_at,transcript_mode)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, accountId, entryId, sourceId, `Conversation ${sourceId}`, `sha256:${sourceId}`, text, 0, text.length, `read-${id}`, scope.userId, 1000, 'full');
}
beforeEach(() => {
  db = new SqliteD1();
  seedIdentity(db, { ...scope, role: 'owner', bundles: ['gather'] });
  seedIdentity(db, { ...foreign, role: 'owner', bundles: ['gather'] });
  const tea = db.sqlite.prepare('INSERT INTO tea_compass_entries(id,account_id,user_id,name,chinese_name,notes,description) VALUES(?,?,?,?,?,?,?)');
  tea.run('shuixian', scope.accountId, scope.userId, 'Aged Shuixian', '水仙', 'Acquired as over thirty years old.', 'Reviewed public draft.');
  tea.run('dancong', scope.accountId, scope.userId, 'Fenghuang Dancong', '鳳凰單叢', 'Existing second tea notes.', 'Second tea description.');
  tea.run('foreign-tea', foreign.accountId, foreign.userId, 'Private foreign tea', '外店', 'Private foreign notes.', 'Private foreign description.');
  seedLink('shuixian-first', 'shuixian', 'transcript-one');
  seedLink('dancong-first', 'dancong', 'transcript-one');
  seedLink('shuixian-second', 'shuixian', 'transcript-two');
  seedLink('foreign-first', 'foreign-tea', 'transcript-one', foreign.accountId);
  seedLink('foreign-only', 'foreign-tea', 'private-transcript', foreign.accountId);
});
afterEach(() => db.close());

describe('transcript-first tea handoff references', () => {
  it('finds existing teas with canonical names and full-reference metadata without repeating transcript text or writing', async () => {
    const before = changes();
    const originals = db.sqlite.prepare('SELECT * FROM curate_ar_links ORDER BY id').all();
    const response = await call('?sourceId=transcript-one');
    expect(response.status).toBe(200);
    const { links } = await response.json() as any;
    expect(links).toHaveLength(2);
    expect(links).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'shuixian-first', entryId: 'shuixian', entryName: 'Aged Shuixian', entryChineseName: '水仙', sourceId: 'transcript-one', mode: 'full' }),
      expect.objectContaining({ id: 'dancong-first', entryId: 'dancong', entryName: 'Fenghuang Dancong', entryChineseName: '鳳凰單叢', sourceId: 'transcript-one', mode: 'full' }),
    ]));
    const originalText = 'The entire original transcript-one transcript.\nAll its tea discussion stays attached.';
    for (const link of links) {
      expect(link.start).toBe(0); expect(link.end).toBe(originalText.length);
      expect(link).not.toHaveProperty('text');
      expect(link).toMatchObject({ hash: 'sha256:transcript-one', mode: 'full' });
    }
    expect(db.sqlite.prepare('SELECT * FROM curate_ar_links ORDER BY id').all()).toEqual(originals);
    expect(JSON.stringify(links)).not.toMatch(/foreign|Private foreign/);
    expect(changes()).toBe(before);
  });
  it('preserves the original entry lookup and supports multiple full transcripts on one tea', async () => {
    const before = changes(); const response = await call('?entryId=shuixian');
    expect(response.status).toBe(200);
    const { links } = await response.json() as any;
    expect(links.map((link: any) => link.sourceId).sort()).toEqual(['transcript-one', 'transcript-two']);
    expect(links.every((link: any) => link.entryId === 'shuixian' && link.mode === 'full')).toBe(true);
    expect(changes()).toBe(before);
  });
  it('hides foreign references even when the source ID is identical or an inconsistent link points across accounts', async () => {
    // The FK names an entry globally. The reverse JOIN must additionally match
    // its account, rather than allowing a malformed historical row to leak it.
    seedLink('inconsistent-link', 'foreign-tea', 'transcript-one');
    const before = changes();
    const result = await (await call('?sourceId=transcript-one')).json() as any;
    expect(result.links).toHaveLength(2); expect(JSON.stringify(result)).not.toMatch(/foreign|外店|inconsistent/);
    expect(await (await call('?sourceId=private-transcript')).json()).toEqual({ links: [] });
    const foreignResult = await (await call('?sourceId=transcript-one', { scope: foreign })).json() as any;
    expect(foreignResult.links).toHaveLength(1); expect(foreignResult.links[0].entryId).toBe('foreign-tea');
    expect(changes()).toBe(before);
  });
  it.each(['', '?entryId=shuixian&sourceId=transcript-one', '?entryId=shuixian&sourceId=', '?entryId=&sourceId=transcript-one', '?sourceId=transcript-one&sourceId=transcript-two', '?entryId=shuixian&entryId=dancong', '?sourceId=', '?sourceId=..%2Fprivate', '?sourceId=' + 'a'.repeat(161), '?entryId=..%2Fprivate'])('rejects missing, ambiguous or invalid lookup %s', async query => {
    const before = changes(); const response = await call(query);
    expect(response.status).toBe(400); expect(changes()).toBe(before);
  });
  it('requires a signed-in account context and refuses foreign or missing tea identities', async () => {
    const before = changes();
    expect((await call('?sourceId=transcript-one', { scope: null })).status).toBe(401);
    expect((await call('?entryId=foreign-tea')).status).toBe(404);
    expect((await call('?entryId=missing-tea')).status).toBe(404);
    expect(changes()).toBe(before);
  });
  it('unlinking removes only that source/tea reference, preserves both teas and all other references, and refuses another shop’s link', async () => {
    const originals = db.sqlite.prepare('SELECT id,name,chinese_name,notes,description FROM tea_compass_entries ORDER BY id').all();
    expect((await call('', { method: 'DELETE', id: 'foreign-first' })).status).toBe(404);
    const response = await call('', { method: 'DELETE', id: 'shuixian-first' });
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ removed: true });
    expect(db.sqlite.prepare('SELECT id,name,chinese_name,notes,description FROM tea_compass_entries ORDER BY id').all()).toEqual(originals);
    expect((await (await call('?sourceId=transcript-one')).json() as any).links.map((link: any) => link.entryId)).toEqual(['dancong']);
    expect((await (await call('?entryId=shuixian')).json() as any).links.map((link: any) => link.sourceId)).toEqual(['transcript-two']);
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM curate_ar_links WHERE account_id=?').get(foreign.accountId)).toMatchObject({ n: 2 });
    expect((await call('', { method: 'DELETE', id: 'shuixian-first' })).status).toBe(404);
  });
});
