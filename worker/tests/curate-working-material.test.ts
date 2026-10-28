import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { transcriptReviewChunks, workingMaterialForTeaRecord } from '../src/curateWorkingMaterial';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';

let db: SqliteD1;
const scope = { accountId: 'working-shop', userId: 'working-owner' };
const changes = () => (db.sqlite.prepare('SELECT total_changes() AS count').get() as any).count;
const claim = 'Supplier: This is our Fenghuang Shuixian, acquired as over thirty years old.';
const note = (quote = claim) => ({ kind: 'supplier_claim', text: 'The supplier describes this Shuixian as over thirty years old; no harvest year is established.', quote, attribution: 'supplier', relevance: 'this_tea' });
function source(text: string, id = 'ar-talk', requestId = 'read-one', owner = scope.userId, accountId = scope.accountId) {
  const title = 'Shuixian sourcing conversation'; const hash = 'sha256:version-one';
  db.sqlite.prepare(`INSERT INTO curate_ar_jobs (id,account_id,created_by_user_id,kind,source_id,status,created_at,expires_at,result_json) VALUES (?,?,?,?,?,?,?,?,?)`).run(requestId, accountId, owner, 'read', id, 'completed', Date.now(), Date.now() + 60000, JSON.stringify({ source: { id, title, hash, text } }));
  return { requestId, sourceId: id, title, hash, text, start: 0, end: text.length, mode: 'full' };
}
function provider(makeNotes: (payload: any) => unknown = () => []) {
  const run = vi.fn().mockImplementation(async (_model, input) => ({ response: JSON.stringify({ notes: makeNotes(JSON.parse(input.messages[1].content)) }) }));
  return { run, env: { DB: db as unknown as D1Database, AI: { run } } };
}
beforeEach(() => {
  db = new SqliteD1();
  seedIdentity(db, { ...scope, role: 'owner' });
  seedIdentity(db, { accountId: 'other-shop', userId: 'other-owner', role: 'owner' });
  seedIdentity(db, { accountId: scope.accountId, userId: 'other-user', role: 'viewer' });
  db.sqlite.prepare('INSERT INTO tea_compass_entries (id,account_id,user_id,name,chinese_name,type,origin_region) VALUES (?,?,?,?,?,?,?)').run('shuixian', scope.accountId, scope.userId, 'Canonical Shuixian', '水仙', 'Oolong', 'Fenghuangshan');
  db.sqlite.prepare('INSERT INTO tea_compass_entries (id,account_id,user_id,name) VALUES (?,?,?,?)').run('foreign-tea', 'other-shop', 'other-owner', 'Private foreign tea');
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); db.close(); });

describe('complete transcript working material', () => {
  it('reviews the full tail, uses canonical tea identity and returns exact citations without writes', async () => {
    const text = `${'Other conversation. '.repeat(1400)}${claim}`;
    const proof = source(text);
    const { run, env } = provider(payload => payload.segment.text.includes(claim) ? [note()] : []);
    const before = changes();
    const result = await workingMaterialForTeaRecord(env, scope, { entryId: 'shuixian', name: 'Forged tea', sources: [proof], draftNotes: 'Unreviewed client claim' });
    expect(result.coverage).toEqual({ sources: 1, characters: text.length, chunks: transcriptReviewChunks(text).length, completedChunks: transcriptReviewChunks(text).length });
    expect(result.notes).toHaveLength(1);
    expect(result.notes[0]).toMatchObject({ quote: claim, start: text.indexOf(claim), end: text.length, attribution: 'supplier', relevance: 'this_tea', sourceId: proof.sourceId });
    expect(run).toHaveBeenCalledTimes(result.coverage.chunks);
    for (const [, input] of run.mock.calls) {
      const payload = JSON.parse(input.messages[1].content);
      expect(payload.tea).toMatchObject({ name: 'Canonical Shuixian', chinese_name: '水仙' });
      expect(JSON.stringify(payload)).not.toContain('Unreviewed client claim');
    }
    expect(changes()).toBe(before);
  });
  it('covers every character with bounded overlapping chunks, including surrogate boundaries', () => {
    const text = `${'x'.repeat(11999)}🍵${'y'.repeat(24000)}`;
    const chunks = transcriptReviewChunks(text);
    let end = 0;
    for (const chunk of chunks) {
      expect(chunk.start).toBeLessThanOrEqual(end);
      expect(chunk.text.length).toBeLessThanOrEqual(12000);
      expect(chunk.text).toBe(text.slice(chunk.start, chunk.end));
      expect(chunk.text).not.toMatch(/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/);
      end = chunk.end;
    }
    expect(end).toBe(text.length);
  });
  it('deduplicates the same evidence seen in the overlap', async () => {
    const text = `${'x'.repeat(11550)}${claim}${'y'.repeat(13000)}`;
    const proof = source(text);
    const { env } = provider(payload => payload.segment.text.includes(claim) ? [note(), note()] : []);
    const result = await workingMaterialForTeaRecord(env, scope, { entryId: 'shuixian', sources: [proof] });
    expect(result.notes).toHaveLength(1);
    expect(result.notes[0].start).toBe(11550);
  });
  it('rejects invented quotations instead of silently returning incomplete coverage', async () => {
    const proof = source(claim);
    const { env } = provider(() => [note('Invented jasmine and honey notes.')]);
    const before = changes();
    await expect(workingMaterialForTeaRecord(env, scope, { entryId: 'shuixian', sources: [proof] })).rejects.toMatchObject({ code: 'working_material_invalid_response' });
    expect(changes()).toBe(before);
  });
  it('fails the entire proposal when any chunk fails', async () => {
    const proof = source('x'.repeat(25000));
    const { env, run } = provider(payload => { if (payload.part === 2) throw new Error('Provider unavailable'); return []; });
    await expect(workingMaterialForTeaRecord(env, scope, { entryId: 'shuixian', sources: [proof] })).rejects.toMatchObject({ code: 'working_material_provider_failed' });
    // Three chunks, and the one that refuses is asked once more before the
    // proposal fails (`installedTeaJson`). A second refusal is the answer, so
    // the remaining chunks are still never sent.
    expect(run).toHaveBeenCalledTimes(4);
  });
  it('refuses a foreign tea before sending any private data to AI', async () => {
    const proof = source(claim); const { env, run } = provider();
    await expect(workingMaterialForTeaRecord(env, scope, { entryId: 'foreign-tea', sources: [proof] })).rejects.toMatchObject({ status: 404 });
    expect(run).not.toHaveBeenCalled();
  });
  it.each([['other-user', scope.accountId], ['other-owner', 'other-shop']])('refuses a source read owned by %s', async (owner, accountId) => {
    const proof = source(claim, 'ar-talk', 'read-one', owner, accountId); const { env, run } = provider();
    await expect(workingMaterialForTeaRecord(env, scope, { entryId: 'shuixian', sources: [proof] })).rejects.toMatchObject({ code: 'ar_read_not_found' });
    expect(run).not.toHaveBeenCalled();
  });
  it('does not silently shorten combined transcripts beyond its bound', async () => {
    const proofs = [source('x'.repeat(110000)), source('y'.repeat(110000), 'second-talk', 'read-two')];
    const { env, run } = provider();
    await expect(workingMaterialForTeaRecord(env, scope, { entryId: 'shuixian', sources: proofs })).rejects.toMatchObject({ code: 'working_material_character_limit', status: 413 });
    expect(run).not.toHaveBeenCalled();
  });
  it('keeps a stable signature on reread and changes it when the live transcript changes', async () => {
    const first = source(claim); const reread = source(claim, 'ar-talk', 'read-two');
    const changed = source(`${claim} More recorded context.`, 'ar-talk', 'read-three');
    const { env } = provider();
    const review = (proof: any) => workingMaterialForTeaRecord(env, scope, { entryId: 'shuixian', sources: [proof] });
    const a = await review(first); const b = await review(reread); const c = await review(changed);
    expect(a.sourceSignature).toBe(b.sourceSignature);
    expect(a.sourceSignature).not.toBe(c.sourceSignature);
  });
  it('keeps ambiguous material uncertain for review rather than promoting it to a tea fact', async () => {
    const quote = 'Then another tea was poured; this one is very old.';
    const proof = source(quote); const { env } = provider(() => [{ kind: 'uncertain', text: 'An age remark may refer to another tea.', quote, attribution: 'unclear', relevance: 'uncertain' }]);
    const result = await workingMaterialForTeaRecord(env, scope, { entryId: 'shuixian', sources: [proof] });
    expect(result.notes[0]).toMatchObject({ attribution: 'unclear', relevance: 'uncertain' });
  });
});
