import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { descriptionForTeaRecord } from '../src/curateTeaDescriptionRequest';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

let db: SqliteD1;
const account = 'description-shop';
const user = 'description-owner';
const secret = 'description-route-test-key';
const notes = 'Adrian noticed a clean mineral finish in this spring tea from Yiwu.';
const clip = 'The leaves were picked in spring.';
const arExcerpt = 'This spring tea comes from Yiwu.';
const base = 'The exact original description.';
const input = (sources = [{ id: 'entry:tea-here', title: 'Client title', text: notes }]) => ({ entryId: 'tea-here', sources });
const env = () => ({ DB: db as unknown as D1Database, GROQ_API_KEY: 'mock-only-key' });
const changes = () => (db.sqlite.prepare('SELECT total_changes() AS count').get() as any).count;
function reply(sourceId: string, quote: string) {
  return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ paragraphs: [{ text: 'A spring tea from Yiwu.', citations: [{ sourceId, quote }] }] }) } }] }), { status: 200 });
}
function provider(sourceId = 'entry:tea-here', quote = notes) {
  const fetchMock = vi.fn().mockImplementation(async () => reply(sourceId, quote));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
function readProviderSources(mock: ReturnType<typeof vi.fn>) {
  const body = JSON.parse(mock.mock.calls[0][1].body);
  return JSON.parse(body.messages[1].content).sources as Array<{ id: string; title: string; text: string }>;
}
beforeEach(() => {
  db = new SqliteD1();
  seedIdentity(db, { accountId: account, userId: user, role: 'owner', bundles: ['catalog', 'stock'] });
  seedIdentity(db, { accountId: 'other-shop', userId: 'other-owner', role: 'owner' });
  seedIdentity(db, { accountId: account, userId: 'viewer', role: 'viewer', bundles: [] });
  db.sqlite.prepare(`INSERT INTO tea_compass_entries
    (id,account_id,user_id,name,type,year,origin_region,notes,description,tea_key,audio_clips)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run('tea-here', account, user, 'Canonical Mountain Tea', 'Sheng', 2024, 'Yiwu', notes, base, 'canonical-key', JSON.stringify([{ timestamp: '2026-10-21T00:00:00Z', transcript: clip }]));
  db.sqlite.prepare('INSERT INTO tea_compass_entries (id,account_id,user_id,name,notes) VALUES (?,?,?,?,?)').run('tea-sibling', account, user, 'Sibling Tea', 'Sibling private note');
  db.sqlite.prepare('INSERT INTO tea_compass_entries (id,account_id,user_id,name,notes) VALUES (?,?,?,?,?)').run('tea-foreign', 'other-shop', 'other-owner', 'Foreign Tea', 'Foreign private note');
  const insertNote = db.sqlite.prepare('INSERT INTO notes (id,account_id,compass_entry_id,tea_key,text,source_type,author_id,author_name,deleted) VALUES (?,?,?,?,?,?,?,?,?)');
  insertNote.run('voice-here', account, 'tea-here', null, 'Exact linked voice transcript.', 'voice', user, 'Adrian', 0);
  insertNote.run('migrated-here', account, null, 'canonical-key', 'An older linked observation.', 'manual', user, 'Adrian', 0);
  insertNote.run('deleted-here', account, 'tea-here', null, 'A deleted private observation.', 'voice', user, 'Adrian', 1);
  insertNote.run('foreign-note', 'other-shop', 'tea-here', 'canonical-key', 'Foreign account transcript.', 'voice', 'other-owner', 'Other', 0);
  insertNote.run('sibling-note', account, 'tea-sibling', null, 'Sibling transcript.', 'voice', user, 'Adrian', 0);
  const insertLink = db.sqlite.prepare(`INSERT INTO curate_ar_links (id,account_id,entry_id,source_id,source_title,source_hash,excerpt,excerpt_start,excerpt_end,request_id,linked_by_user_id,linked_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (const [id, shop, tea] of [['link-here', account, 'tea-here'], ['link-sibling', account, 'tea-sibling'], ['link-foreign', 'other-shop', 'tea-foreign']]) {
    insertLink.run(id, shop, tea, 'ar-original-uuid', 'Maintained AR source', 'sha256:version-one', arExcerpt, 0, arExcerpt.length, 'completed-read', user, Date.now());
  }
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); db.close(); });

describe('description generation reads the same scoped saved tea', () => {
  it('returns exact current baseDescription, canonical source titles and citations without any database writes', async () => {
    const fetchMock = provider();
    const before = changes();
    const result = await descriptionForTeaRecord(env(), { accountId: account }, input());
    expect(result).toMatchObject({ description: 'A spring tea from Yiwu.', baseDescription: base, citations: [{ sourceId: 'entry:tea-here', quote: notes }] });
    expect(readProviderSources(fetchMock).find(source => source.id === 'entry:tea-here')).toEqual({ id: 'entry:tea-here', title: 'Tea notes', text: notes });
    expect(changes()).toBe(before);
    expect(db.sqlite.prepare('SELECT description,notes,year FROM tea_compass_entries WHERE id=?').get('tea-here')).toMatchObject({ description: base, notes, year: 2024 });
  });
  it('loads facts only from the saved tea and ignores invented client facts and a forged description baseline', async () => {
    const fetchMock = provider();
    const result = await descriptionForTeaRecord(env(), { accountId: account }, { ...input(), facts: { name: 'Forged royal tea', year: 9999, origin_region: 'Invented place' }, baseDescription: 'Forged baseline' });
    const facts = readProviderSources(fetchMock).find(source => source.id === 'tea-record')!;
    expect(facts.text).toContain('Canonical Mountain Tea');
    expect(facts.text).toContain('year: 2024');
    expect(facts.text).toContain('origin_region: Yiwu');
    expect(facts.text).not.toMatch(/9999|Forged|Invented/);
    expect(result.baseDescription).toBe(base);
  });
  it('refuses another account tea before requesting the provider', async () => {
    const fetchMock = provider();
    await expect(descriptionForTeaRecord(env(), { accountId: account }, { ...input(), entryId: 'tea-foreign' })).rejects.toMatchObject({ status: 404, code: 'description_tea_not_found' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([
    { id: 'ar:link-sibling', text: arExcerpt },
    { id: 'ar:link-foreign', text: arExcerpt },
    { id: 'note:foreign-note', text: 'Foreign account transcript.' },
    { id: 'note:sibling-note', text: 'Sibling transcript.' },
    { id: 'note:deleted-here', text: 'A deleted private observation.' },
  ])('refuses unavailable source $id before requesting the provider', async source => {
    const fetchMock = provider();
    const before = changes();
    await expect(descriptionForTeaRecord(env(), { accountId: account }, input([{ ...source, title: 'Spoofed title' }]))).rejects.toMatchObject({ status: 409, code: 'description_source_changed' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(changes()).toBe(before);
  });
  it('refuses a formerly valid excerpt after its saved source changes', async () => {
    const fetchMock = provider();
    const staleSelection = input();
    db.sqlite.prepare('UPDATE tea_compass_entries SET notes=? WHERE id=?').run('Revised source words, saved after selection.', 'tea-here');
    const before = changes();
    await expect(descriptionForTeaRecord(env(), { accountId: account }, staleSelection)).rejects.toMatchObject({ status: 409, code: 'description_source_changed' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(changes()).toBe(before);
  });
  it('rejects provider citations to available material that the person did not select', async () => {
    provider('ar:link-here', arExcerpt);
    const before = changes();
    await expect(descriptionForTeaRecord(env(), { accountId: account }, input())).rejects.toMatchObject({ status: 502, code: 'description_invalid_response' });
    expect(changes()).toBe(before);
  });
  it('rejects changed excerpts and fabricated sources rather than silently substituting current text', async () => {
    const fetchMock = provider();
    for (const source of [{ id: 'entry:tea-here', text: 'A made-up harvest claim.' }, { id: 'ar:missing-link', text: arExcerpt }]) {
      await expect(descriptionForTeaRecord(env(), { accountId: account }, input([{ ...source, title: 'Selected' }]))).rejects.toMatchObject({ status: 409 });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([
    { id: 'ar:link-here', title: 'AR Create · Maintained AR source', text: 'spring tea comes from Yiwu' },
    { id: 'note:voice-here', title: 'Voice note · Adrian', text: 'linked voice transcript' },
    { id: 'note:migrated-here', title: 'Written note · Adrian', text: 'older linked observation' },
    { id: 'clip:0:2026-10-21T00:00:00Z', title: 'Voice transcript', text: 'leaves were picked in spring' },
  ])('accepts an exact saved excerpt from $id without mutating any source', async source => {
    const fetchMock = provider(source.id, source.text);
    const before = changes();
    const result = await descriptionForTeaRecord(env(), { accountId: account }, input([source]));
    expect(result.citations).toEqual([{ sourceId: source.id, quote: source.text }]);
    expect(readProviderSources(fetchMock).find(item => item.id === source.id)).toEqual(source);
    expect(changes()).toBe(before);
  });
});

async function route(path: string, method = 'GET', token?: string, body?: unknown) {
  return worker.fetch(new Request(`https://worker.test${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}`, 'X-Teajia-Account': account } : {}), 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), { ...env(), JWT_SECRET: secret, PROVIDER_LIMITER: { limit: async () => ({ success: true }) } } as any);
}
describe('public worker routes keep description and source access authenticated', () => {
  it('requires a shop JWT for description proposals and private AR user endpoints', async () => {
    const fetchMock = provider();
    for (const [path, method, body] of [
      ['/api/curate/description-proposal', 'POST', input()],
      ['/api/curate/ar-create/status', 'GET', undefined],
      ['/api/curate/ar-create/links?entryId=tea-here', 'GET', undefined],
      ['/api/curate/ar-create/requests', 'POST', { kind: 'search', query: 'Yiwu' }],
      ['/api/curate/ar-create/pair/claim', 'POST', { code: 'ABCDEFGH' }],
    ] as const) expect((await route(path, method, undefined, body)).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('turns away a signed-in viewer before any provider call', async () => {
    const fetchMock = provider();
    const token = await signedToken(secret, { sub: 'viewer', active_account_id: account, platform_role: null });
    expect((await route('/api/curate/description-proposal', 'POST', token, input())).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('does not let a body-supplied account override the JWT account in the real route', async () => {
    const fetchMock = provider();
    const token = await signedToken(secret, { sub: user, active_account_id: account, platform_role: null });
    const response = await route('/api/curate/description-proposal', 'POST', token, { ...input(), entryId: 'tea-foreign', accountId: 'other-shop' });
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: 'description_tea_not_found' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('allows an authorized proposal through the real route while preserving saved description and source bytes', async () => {
    const fetchMock = provider('ar:link-here', arExcerpt);
    const token = await signedToken(secret, { sub: user, active_account_id: account, platform_role: null });
    const response = await route('/api/curate/description-proposal', 'POST', token, input([{ id: 'ar:link-here', title: 'Client title ignored', text: arExcerpt }]));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ baseDescription: base, citations: [{ sourceId: 'ar:link-here', quote: arExcerpt }] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(db.sqlite.prepare('SELECT description,notes FROM tea_compass_entries WHERE id=?').get('tea-here')).toMatchObject({ description: base, notes });
    expect(db.sqlite.prepare('SELECT excerpt FROM curate_ar_links WHERE id=?').get('link-here')).toMatchObject({ excerpt: arExcerpt });
  });
});

const stagedSource = () => ({ requestId: 'read-preview', sourceId: 'preview-source', title: 'Original preview title', hash: 'sha256:preview', text: arExcerpt, start: 7, end: 7 + arExcerpt.length });
function seedStagedRead(patch: { accountId?: string; userId?: string; expiresAt?: number; status?: string; kind?: string } = {}) {
  const source = stagedSource();
  db.sqlite.prepare(`INSERT INTO curate_ar_jobs (id,account_id,created_by_user_id,kind,source_id,status,created_at,expires_at,result_json) VALUES (?,?,?,?,?,?,?,?,?)`).run(source.requestId, patch.accountId ?? account, patch.userId ?? user, patch.kind ?? 'read', source.sourceId, patch.status ?? 'completed', Date.now(), patch.expiresAt ?? Date.now() + 60_000, JSON.stringify({ source: { id: source.sourceId, title: source.title, hash: source.hash, text: 'Before ' + source.text + ' After' } }));
}
describe('unsaved AR passage description previews', () => {
  it('uses verified pending excerpts without creating links or changing the tea', async () => {
    seedStagedRead();
    const source = stagedSource();
    const id = `staged-ar:${source.requestId}:${source.sourceId}`;
    const fetchMock = provider(id, source.text);
    const before = changes();
    const result = await descriptionForTeaRecord(env(), { accountId: account, userId: user }, { ...input([]), stagedArSources: [source] });
    expect(result.citations).toEqual([{ sourceId: id, quote: source.text }]);
    expect(result.baseDescription).toBe(base);
    expect(readProviderSources(fetchMock).find(item => item.id === id)).toEqual({ id, title: 'AR Create · Original preview title', text: source.text });
    expect(changes()).toBe(before);
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM curate_ar_links WHERE source_id=?').get(source.sourceId)).toEqual({ n: 0 });
  });
  it.each([
    { accountId: 'other-shop' }, { userId: 'another-person' }, { expiresAt: Date.now() - 1000 }, { status: 'claimed' }, { kind: 'search' },
  ])('refuses inaccessible, expired or unfinished read proof %j', async patch => {
    seedStagedRead(patch);
    const fetchMock = provider();
    const before = changes();
    await expect(descriptionForTeaRecord(env(), { accountId: account, userId: user }, { ...input([]), stagedArSources: [stagedSource()] })).rejects.toMatchObject({ status: 404, code: 'ar_read_not_found' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(changes()).toBe(before);
  });
  it.each([
    { hash: 'sha256:forged' }, { title: 'Forged title' }, { sourceId: 'different-source' }, { text: 'Invented claims from another tea.' }, { start: 0 }, { end: 999 },
  ])('refuses client changes to the original proof %j', async patch => {
    seedStagedRead();
    const fetchMock = provider();
    const before = changes();
    await expect(descriptionForTeaRecord(env(), { accountId: account, userId: user }, { ...input([]), stagedArSources: [{ ...stagedSource(), ...patch }] })).rejects.toMatchObject({ status: 400, code: 'ar_excerpt_mismatch' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(changes()).toBe(before);
  });
  it('requires a user identity and bounds the combined selection', async () => {
    seedStagedRead();
    const fetchMock = provider();
    await expect(descriptionForTeaRecord(env(), { accountId: account }, { ...input([]), stagedArSources: [stagedSource()] })).rejects.toMatchObject({ status: 401 });
    await expect(descriptionForTeaRecord(env(), { accountId: account, userId: user }, { ...input(), stagedArSources: Array(12).fill(stagedSource()) })).rejects.toMatchObject({ status: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('passes the authenticated user through the actual route without saving the link', async () => {
    seedStagedRead();
    const source = stagedSource();
    provider(`staged-ar:${source.requestId}:${source.sourceId}`, source.text);
    const token = await signedToken(secret, { sub: user, active_account_id: account, platform_role: null });
    const before = changes();
    const response = await route('/api/curate/description-proposal', 'POST', token, { ...input([]), stagedArSources: [source] });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ baseDescription: base });
    // Authentication may update audit state, so pin the canonical tea and link directly.
    expect(changes()).toBeGreaterThanOrEqual(before);
    expect(db.sqlite.prepare('SELECT description FROM tea_compass_entries WHERE id=?').get('tea-here')).toEqual({ description: base });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM curate_ar_links WHERE source_id=?').get(source.sourceId)).toEqual({ n: 0 });
  });
});


describe('full transcript working-material handoff', () => {
  it('accepts separate exact quote fragments from the same read with distinct canonical citation identities', async () => {
    seedStagedRead();
    const first = { ...stagedSource(), fragment: true };
    const lastText = 'After';
    const lastStart = ('Before ' + arExcerpt + ' After').indexOf(lastText);
    const last = { ...first, text: lastText, start: lastStart, end: lastStart + lastText.length };
    const firstId = `staged-ar:${first.requestId}:${first.sourceId}:${first.start}:${first.end}`;
    const lastId = `staged-ar:${last.requestId}:${last.sourceId}:${last.start}:${last.end}`;
    const fetchMock = provider(firstId, first.text);
    const before = changes();
    const result = await descriptionForTeaRecord(env(), { accountId: account, userId: user }, { ...input([]), stagedArSources: [first, last] });
    expect(result.citations).toEqual([{ sourceId: firstId, quote: first.text }]);
    expect(readProviderSources(fetchMock).filter(item => item.id.startsWith('staged-ar:'))).toEqual([
      { id: firstId, title: 'AR Create · Original preview title', text: first.text },
      { id: lastId, title: 'AR Create · Original preview title', text: lastText },
    ]);
    expect(changes()).toBe(before);
  });
  it('refuses long complete transcripts as direct description input rather than silently truncating them', async () => {
    const original = 'All original transcript details. '.repeat(500);
    const source = { ...stagedSource(), mode: 'full', text: original, start: 0, end: original.length };
    db.sqlite.prepare(`INSERT INTO curate_ar_jobs (id,account_id,created_by_user_id,kind,source_id,status,created_at,expires_at,result_json) VALUES (?,?,?,?,?,?,?,?,?)`).run(source.requestId, account, user, 'read', source.sourceId, 'completed', Date.now(), Date.now() + 60_000, JSON.stringify({ source: { id: source.sourceId, title: source.title, hash: source.hash, text: original } }));
    const fetchMock = provider(); const before = changes();
    await expect(descriptionForTeaRecord(env(), { accountId: account, userId: user }, { ...input([]), stagedArSources: [source] })).rejects.toMatchObject({ status: 422, code: 'description_full_transcript_requires_review' });
    expect(fetchMock).not.toHaveBeenCalled(); expect(changes()).toBe(before);
  });
  it('rejects malformed fragment selectors without requesting the provider', async () => {
    seedStagedRead(); const fetchMock = provider();
    await expect(descriptionForTeaRecord(env(), { accountId: account, userId: user }, { ...input([]), stagedArSources: [{ ...stagedSource(), fragment: 'forged-id' }] })).rejects.toMatchObject({ status: 400, code: 'description_invalid_source' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('unsaved working material for public descriptions', () => {
  const draft = { id: 'draft-note:voice-one', title: 'New voice memo', text: 'Acquired as more than thirty years old.' };
  it('accepts draft notes and attributed research, preserves exact citations and performs no writes or research fetches', async () => {
    const fetchMock = provider(draft.id, draft.text);
    const before = changes();
    const result = await descriptionForTeaRecord(env(), { accountId: account }, { ...input([]), draftSources: [draft, { id: 'research:shuixian', title: 'Shuixian context', text: 'Research supplied for review.', url: 'https://example.org/tea' }] });
    expect(result.citations).toEqual([{ sourceId: draft.id, quote: draft.text }]);
    expect(readProviderSources(fetchMock)).toContainEqual({ ...draft, title: 'User-supplied working material · New voice memo' });
    expect(readProviderSources(fetchMock).find(source => source.id === 'research:shuixian')?.title).toContain('User-supplied');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(changes()).toBe(before);
  });
  it('still requires the tea to belong to this account before calling AI', async () => {
    const fetchMock = provider(draft.id, draft.text);
    const before = changes();
    await expect(descriptionForTeaRecord(env(), { accountId: account }, { ...input([]), entryId: 'tea-foreign', draftSources: [draft] })).rejects.toMatchObject({ status: 404, code: 'description_tea_not_found' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(changes()).toBe(before);
  });
  it.each([
    'not-an-array', [null], [{ ...draft, id: 'tea-record' }], [{ ...draft, id: 'ar:link-here' }],
    [{ ...draft, id: 'research:' }], [{ ...draft, id: `draft-note:${'a'.repeat(256)}` }],
    [{ ...draft, title: '' }], [{ ...draft, title: 'x'.repeat(257) }],
    [{ ...draft, text: ' ' }], [{ ...draft, text: 'x'.repeat(12001) }],
    [{ ...draft, url: 'http://example.org' }], [{ ...draft, url: 'https://user:secret@example.org' }],
    [{ ...draft, url: 'not-a-url' }], [{ ...draft, url: 123 }], [{ ...draft, url: `https://example.org/${'a'.repeat(2048)}` }],
  ])('rejects malformed or unbounded draft material %#', async draftSources => {
    const fetchMock = provider();
    const before = changes();
    await expect(descriptionForTeaRecord(env(), { accountId: account }, { ...input([]), draftSources })).rejects.toMatchObject({ status: 400, code: 'description_invalid_source' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(changes()).toBe(before);
  });
  it('rejects duplicate identities, combined source count and combined character budgets before AI', async () => {
    const fetchMock = provider();
    await expect(descriptionForTeaRecord(env(), { accountId: account }, { ...input([]), draftSources: [draft, draft] })).rejects.toMatchObject({ code: 'description_duplicate_source' });
    await expect(descriptionForTeaRecord(env(), { accountId: account }, { ...input(), draftSources: Array.from({ length: 12 }, (_, i) => ({ ...draft, id: `draft-note:${i}` })) })).rejects.toMatchObject({ code: 'description_invalid_input' });
    await expect(descriptionForTeaRecord(env(), { accountId: account }, { ...input(), draftSources: [{ ...draft, text: 'x'.repeat(11999) }] })).rejects.toMatchObject({ code: 'description_character_limit' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
