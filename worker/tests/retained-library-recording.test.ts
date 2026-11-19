import { afterEach, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

const databases: SqliteD1[] = [];
afterEach(() => { databases.splice(0).forEach(db => db.close()); vi.restoreAllMocks(); });

it('keeps original audio on its exact encounter across retry, stale sync, expiry and explicit discard', async () => {
  const db = new SqliteD1('migrations'); databases.push(db);
  seedIdentity(db, { userId: 'speaker', accountId: 'shop', bundles: ['catalog'] });
  seedIdentity(db, { userId: 'colleague', accountId: 'shop', bundles: ['catalog'] });
  seedIdentity(db, { userId: 'speaker', accountId: 'other', bundles: ['catalog'] });
  const objects = new Map<string, ArrayBuffer>();
  const bucket = {
    async put(key: string, bytes: ArrayBuffer) { objects.set(key, bytes); },
    async head(key: string) { return objects.has(key) ? {} : null; },
    async get(key: string) { const bytes = objects.get(key); return bytes ? { arrayBuffer: async () => bytes } : null; },
    async delete(key: string) { objects.delete(key); },
  };
  let fail = true;
  const run = vi.fn(async () => { if (fail) throw new Error('fixture'); return { text: 'The original tea recording.' }; });
  const env = { DB: db, MEDIA_BUCKET: bucket, JWT_SECRET: 'fixture', AI: { run }, PROVIDER_LIMITER: { limit: async () => ({ success: true }) } };
  const call = async (path: string, method = 'GET', body?: unknown, user = 'speaker', account = 'shop') => {
    const token = user ? await signedToken('fixture', { sub: user, active_account_id: account }) : null;
    return worker.fetch(new Request('https://test.dev' + path, {
      method, headers: { ...(token ? { Authorization: 'Bearer ' + token, 'X-Teajia-Account': account } : {}),
        ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }) },
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    }), env as never, {} as never);
  };
  for (const id of ['tea', 'second']) {
    expect((await call('/api/compass/entries', 'POST', { id, name: id, audio_clips: [] })).status).toBe(201);
  }
  const bytes = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 1, 2]);
  const form = new FormData(); form.set('file', new File([bytes], 'note.webm', { type: 'audio/webm' }));
  const failed = await call('/api/transcribe', 'POST', form);
  expect(failed.status).toBe(502);
  const { recording_id: id } = await failed.json();
  expect(objects.size).toBe(1);
  expect((await call('/api/transcriptions/' + id + '/attach', 'POST', { compass_entry_id: 'tea' })).status).toBe(409);
  fail = false;
  const recovered = await call('/api/transcriptions/' + id + '/retry', 'POST');
  const transcription = await recovered.json();
  expect(transcription).toMatchObject({ recording_id: id, text: 'The original tea recording.', audio_url: expect.any(String) });
  expect(objects.size).toBe(1);
  const beforeRetries = run.mock.calls.length;
  expect((await call('/api/transcriptions/' + id + '/retry', 'POST')).status).toBe(200);
  expect(run.mock.calls.length).toBe(beforeRetries);

  for (const [user, account, status] of [['', 'shop', 401], ['colleague', 'shop', 404], ['speaker', 'other', 404]] as const) {
    expect((await call(transcription.audio_url, 'GET', undefined, user, account)).status).toBe(status);
    expect((await call('/api/transcriptions/' + id + '/attach', 'POST', { compass_entry_id: 'tea' }, user, account)).status).toBe(status);
  }
  const attach = (entryId = 'tea') => call('/api/transcriptions/' + id + '/attach', 'POST', { compass_entry_id: entryId });
  const competing = await Promise.all([
    attach(), call('/api/transcriptions/' + id + '/attach', 'POST', { compass_entry_id: 'second' }),
  ]);
  expect(competing.map(response => response.status).sort()).toEqual([200, 409]);
  // Request order does not determine which atomic attachment wins.
  const winner = await competing.find(response => response.status === 200)!.json();
  const winnerId = winner.entry.id as string;
  expect(['tea', 'second']).toContain(winnerId);
  const loserId = winnerId === 'tea' ? 'second' : 'tea';
  expect((await attach(winnerId)).status).toBe(200);
  const attached = await (await attach(winnerId)).json();
  expect(attached.entry.id).toBe(winnerId);
  expect(JSON.parse(attached.entry.audio_clips)).toEqual([attached.clip]);
  expect(attached.note).toMatchObject({ id: 'recording-' + id, compass_entry_id: winnerId, source_type: 'voice', visibility: 'private' });
  expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM notes').get()).toEqual({ n: 1 });
  expect((await attach(loserId)).status).toBe(409);

  const audio = await call(transcription.audio_url);
  expect(audio.headers.get('Cache-Control')).toBe('private, no-store');
  expect(new Uint8Array(await audio.arrayBuffer())).toEqual(bytes);
  expect((await call('/api/media/' + [...objects.keys()][0], 'GET', undefined, '')).status).toBe(404);

  // Stale snapshots cannot remove a durable attachment or forge one on another encounter.
  expect((await call('/api/compass/sync', 'POST', { entries: [{ id: winnerId, audio_clips: [] },
    { id: loserId, audio_clips: [attached.clip, { url: 'https://legacy.test/audio.mp3', timestamp: 'old' }] }] })).status).toBe(200);
  const entries = await (await call('/api/compass/entries')).json();
  expect(JSON.parse(entries.entries.find((row: any) => row.id === winnerId).audio_clips)).toHaveLength(1);
  expect(JSON.parse(entries.entries.find((row: any) => row.id === loserId).audio_clips)).toEqual([{ url: 'https://legacy.test/audio.mp3', timestamp: 'old' }]);
  db.sqlite.prepare("UPDATE private_recordings SET expires_at=datetime('now','-1 day')").run();
  await worker.scheduled({} as ScheduledEvent, env as never, {} as ExecutionContext);
  expect(objects.size).toBe(1);
  expect((await call(transcription.audio_url)).status).toBe(200);
  expect((await call('/api/transcriptions/' + id, 'DELETE')).status).toBe(200);
  expect(objects.size).toBe(0);
  expect((await call(transcription.audio_url)).status).toBe(404);
  expect(JSON.parse((db.sqlite.prepare('SELECT audio_clips FROM tea_compass_entries WHERE id=?').get(winnerId) as any).audio_clips)).toEqual([]);
  expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM notes').get()).toEqual({ n: 1 });
});
