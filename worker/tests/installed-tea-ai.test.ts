import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installedTeaJson, INSTALLED_TEA_MODEL } from '../src/curateInstalledAi';
import { fileSaid } from '../src/curateSaidFiling';
import { proposeTeaDescription } from '../src/curateTeaDescription';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';
const passage = 'The supplier describes this Shuixian as over thirty years old.';
const input = { facts: {}, sources: [{ id: 'talk-1', title: 'Shop conversation', text: passage }] };
describe('tea previews use the existing installed AI binding without a Groq key', () => {
 it('files the actual source through the existing field validator without any network key', async () => {
  const run = vi.fn().mockResolvedValue({ response: JSON.stringify({ parts: [{ kind: 'tea', text: 'Shuixian', fields: { name: 'Shuixian', year: 'invented' } }] }) });
  const parts = await fileSaid({ AI: { run } }, passage, 'Shuixian');
  expect(run).toHaveBeenCalledWith(INSTALLED_TEA_MODEL, expect.objectContaining({ max_tokens: 1024, stream: false, response_format: { type: 'json_object' }, messages: [expect.objectContaining({ content: expect.stringContaining(passage) })] }));
  expect(parts[0].fields.year).toBeUndefined();
 });
 it('returns a description only with exact source citations', async () => {
  const run = vi.fn().mockResolvedValue({ response: { paragraphs: [{ text: 'A Shuixian described by its supplier as over thirty years old.', citations: [{ sourceId: 'talk-1', quote: passage }] }] } });
  const result = await proposeTeaDescription({ AI: { run } }, input);
  expect(result.citations).toEqual([{ sourceId: 'talk-1', quote: passage }]);
  expect(result.description).toContain('described by its supplier');
 });
 it('rejects fabricated citations from the installed provider too', async () => {
  const run = vi.fn().mockResolvedValue({ response: JSON.stringify({ paragraphs: [{ text: 'Invented.', citations: [{ sourceId: 'talk-1', quote: 'invented evidence' }] }] }) });
  await expect(proposeTeaDescription({ AI: { run } }, input)).rejects.toMatchObject({ code: 'description_invalid_response' });
 });
 it('fails closed for malformed or missing installed AI output', async () => {
  await expect(installedTeaJson({ AI: { run: vi.fn().mockResolvedValue({ response: 'not JSON' }) } }, [], 100)).rejects.toThrow();
  await expect(installedTeaJson({}, [], 100)).rejects.toThrow('unavailable');
 });
 it('bounds inference time and clears its timer', async () => {
  vi.useFakeTimers();
  try {
   const result = installedTeaJson({ AI: { run: () => new Promise(() => {}) } }, [], 100);
   const assertion = expect(result).rejects.toThrow('too long');
   await vi.advanceTimersByTimeAsync(20_000); await assertion;
   expect(vi.getTimerCount()).toBe(0);
  } finally { vi.useRealTimers(); }
 });
});

/**
 * Incident cdd4e239 (2026-10-28): POST /api/curate/description-proposal, 502,
 * once. Production has no Groq key — the 503 on this same route on 2026-10-21
 * was `description_provider_unavailable` and the installed binding is what
 * answers it now — so every 502 here is the installed model's reply failing to
 * be read. A reply wrapped in a sentence and a single busy moment are both
 * recoverable, and neither is a server failure the owner should be shown.
 */
describe('a readable or retryable installed reply is not a 502 on the description route', () => {
 const account = 'installed-ai-shop';
 const user = 'installed-ai-owner';
 const secret = 'installed-ai-route-test-key';
 const notes = 'The supplier describes this Shuixian as over thirty years old.';
 const draft = { paragraphs: [{ text: 'A Shuixian the supplier describes as over thirty years old.', citations: [{ sourceId: 'entry:tea-installed', quote: notes }] }] };
 let db: SqliteD1;
 /** No GROQ_API_KEY, exactly as the live worker runs it. */
 const installedEnv = (run: unknown) => ({
  DB: db as unknown as D1Database, JWT_SECRET: secret,
  PROVIDER_LIMITER: { limit: async () => ({ success: true }) }, AI: { run },
 } as any);
 const propose = async (env: any) => worker.fetch(new Request('https://worker.test/api/curate/description-proposal', {
  method: 'POST',
  headers: { Authorization: `Bearer ${await signedToken(secret, { sub: user, active_account_id: account, platform_role: null })}`, 'X-Teajia-Account': account, 'Content-Type': 'application/json' },
  body: JSON.stringify({ entryId: 'tea-installed', sources: [{ id: 'entry:tea-installed', title: 'Client title', text: notes }] }),
 }), env);
 beforeEach(() => {
  db = new SqliteD1();
  seedIdentity(db, { accountId: account, userId: user, role: 'owner', bundles: ['catalog', 'stock'] });
  db.sqlite.prepare('INSERT INTO tea_compass_entries (id,account_id,user_id,name,notes,description,audio_clips) VALUES (?,?,?,?,?,?,?)')
   .run('tea-installed', account, user, 'Shuixian', notes, 'The exact original description.', '[]');
 });
 afterEach(() => { vi.restoreAllMocks(); db.close(); });

 it.each([
  ['a code fence', '```json\n' + JSON.stringify(draft) + '\n```'],
  ['a sentence', `Here is the description you asked for: ${JSON.stringify(draft)} Let me know.`],
 ])('reads a good object the model wrapped in %s', async (_shape, reply) => {
  const run = vi.fn().mockResolvedValue({ response: reply });
  const response = await propose(installedEnv(run));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ description: draft.paragraphs[0].text, citations: [{ sourceId: 'entry:tea-installed', quote: notes }] });
  expect(run).toHaveBeenCalledTimes(1);
 });

 it('asks once more after a busy moment instead of calling it a server failure', async () => {
  const run = vi.fn()
   .mockRejectedValueOnce(new Error('Capacity temporarily exceeded'))
   .mockResolvedValue({ response: JSON.stringify(draft) });
  const response = await propose(installedEnv(run));
  expect(response.status).toBe(200);
  expect(run).toHaveBeenCalledTimes(2);
 });

 it('still fails closed, after exactly two attempts, when no reply holds an object', async () => {
  const run = vi.fn().mockResolvedValue({ response: 'I cannot draft this.' });
  const response = await propose(installedEnv(run));
  expect(response.status).toBe(502);
  expect(await response.json()).toMatchObject({ code: 'description_provider_failed' });
  expect(run).toHaveBeenCalledTimes(2);
 });

 it('does not retry a spent deadline, because the next wait is the caller\'s too', async () => {
  vi.useFakeTimers();
  try {
   const run = vi.fn().mockImplementation(() => new Promise(() => {}));
   const pending = installedTeaJson({ AI: { run } }, [], 100);
   const assertion = expect(pending).rejects.toThrow('too long');
   await vi.advanceTimersByTimeAsync(20_000);
   await assertion;
   expect(run).toHaveBeenCalledTimes(1);
  } finally { vi.useRealTimers(); }
 });
});
