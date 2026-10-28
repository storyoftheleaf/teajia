import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { transcriptReviewChunks, transcriptPassages, workingMaterialForTeaRecord, workingMaterialSchema } from '../src/curateWorkingMaterial';
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
  const run = vi.fn().mockImplementation(async (_model, input) => {
    const payload = JSON.parse(input.messages[1].content);
    const requested = makeNotes(payload) as any[];
    const notes = requested.map(({ quote, ...item }) => ({ ...item, quoteId: item.quoteId ?? payload.segment.passages.find((passage: any) => passage.text.includes(quote))?.id ?? 'unknown-passage' }));
    return { response: JSON.stringify({ notes }) };
  });
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
    const text = `${'Other conversation.\n'.repeat(1400)}${claim}`;
    const proof = source(text);
    const { run, env } = provider(payload => payload.segment.passages.some((passage: any) => passage.text.includes(claim)) ? [note()] : []);
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
    for (const [, request] of run.mock.calls) {
      const payload = JSON.parse(request.messages[1].content);
      expect(payload.segment).not.toHaveProperty('text');
      expect(payload.segment.passages.map((passage: any) => passage.text).join('')).toBe(text.slice(payload.segment.start, payload.segment.end));
      expect(request.response_format).toEqual({ type: 'json_schema', json_schema: workingMaterialSchema(payload.segment.passages.filter((passage: any) => passage.text.trim()).map((passage: any) => passage.id)) });
    }
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
  it('indexes every original UTF-16 character once, including blank lines, CRLF and emoji', () => {
    const text = `\n${'x'.repeat(3999)}🍵\r\n\nSame words.\nSame words.\n`;
    const passages = transcriptPassages(text, 47);
    expect(passages.map(passage => passage.text).join('')).toBe(text);
    let next = 47;
    for (const passage of passages) {
      expect(passage.start).toBe(next);
      expect(passage.text).toBe(text.slice(passage.start - 47, passage.end - 47));
      expect(passage.text.length).toBeLessThanOrEqual(4000);
      expect(passage.text).not.toMatch(/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/);
      next = passage.end;
    }
    expect(next).toBe(47 + text.length);
    expect(new Set(passages.map(passage => passage.id)).size).toBe(passages.length);
    expect(transcriptPassages(text, 47)).toEqual(passages);
  });
  it('maps a selected repeated passage to its own position instead of the first text match', async () => {
    const text = `${claim}\n\n${claim}\n`;
    const passages = transcriptPassages(text);
    const second = passages.filter(passage => passage.text.includes(claim))[1];
    const proof = source(text);
    const { env } = provider(() => [{ ...note(), quoteId: second.id }]);
    const before = changes();
    const result = await workingMaterialForTeaRecord(env, scope, { entryId: 'shuixian', sources: [proof] });
    expect(result.notes).toHaveLength(1);
    expect(result.notes[0]).toMatchObject({ quote: second.text, start: second.start, end: second.end });
    expect(result.notes[0].start).toBeGreaterThan(text.indexOf(claim));
    expect(changes()).toBe(before);
  });
  it('rejects raw model quotations without a selected passage identity', async () => {
    const proof = source(claim);
    const { env, run } = provider();
    run.mockResolvedValue({ response: JSON.stringify({ notes: [note()] }) });
    await expect(workingMaterialForTeaRecord(env, scope, { entryId: 'shuixian', sources: [proof] })).rejects.toMatchObject({ code: 'working_material_invalid_response' });
  });
  it('keeps the exact selected source text even if a legacy model also supplies invented quote text', async () => {
    const proof = source(claim); const passage = transcriptPassages(claim)[0];
    const { env, run } = provider();
    run.mockResolvedValue({ response: JSON.stringify({ notes: [{ ...note('Invented quotation'), quoteId: passage.id }] }) });
    const result = await workingMaterialForTeaRecord(env, scope, { entryId: 'shuixian', sources: [proof] });
    expect(result.notes[0]).toMatchObject({ quote: claim, start: 0, end: claim.length });
  });
  it('preserves the original offsets when reviewing an explicitly selected excerpt', async () => {
    const fullText = `Before.\n${claim}\nAfter.`;
    const original = source(fullText);
    const start = fullText.indexOf(claim);
    const proof = { ...original, start, end: start + claim.length, text: claim, mode: 'excerpt' };
    const { env } = provider(() => [note()]);
    const result = await workingMaterialForTeaRecord(env, scope, { entryId: 'shuixian', sources: [proof] });
    expect(result.notes[0]).toMatchObject({ quote: claim, start, end: start + claim.length });
  });
  it('deduplicates the same evidence seen in the overlap', async () => {
    const text = `${'x\n'.repeat(5775)}${claim}\n${'y'.repeat(13000)}`;
    const proof = source(text);
    const { env } = provider(payload => payload.segment.passages.some((passage: any) => passage.text.includes(claim)) ? [note(), note()] : []);
    const result = await workingMaterialForTeaRecord(env, scope, { entryId: 'shuixian', sources: [proof] });
    expect(result.notes).toHaveLength(1);
    expect(result.notes[0].start).toBe(11550);
  });
  it.each(['openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'configured-model'])('keeps the fallback provider compatible with %s without writing evidence', async model => {
    const proof = source(claim);
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ notes: [{ ...note(), quoteId: transcriptPassages(claim)[0].id }] }) } }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const before = changes();
    const result = await workingMaterialForTeaRecord({ DB: db as unknown as D1Database, GROQ_API_KEY: 'test', CURATE_IMPORT_FALLBACK_MODEL: model }, scope, { entryId: 'shuixian', sources: [proof] });
    expect(result.notes[0].quote).toBe(claim);
    const request = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(request.response_format).toEqual(model === 'configured-model' ? { type: 'json_object' } : { type: 'json_schema', json_schema: { name: 'tea_working_material', strict: true, schema: workingMaterialSchema([transcriptPassages(claim)[0].id]) } });
    expect(changes()).toBe(before);
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
    expect(run).toHaveBeenCalledTimes(3);
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
