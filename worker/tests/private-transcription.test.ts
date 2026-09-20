import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';

const SECRET = 'secret';
async function token() {
  const enc = (value: object) => btoa(JSON.stringify(value));
  const now = Math.floor(Date.now() / 1000);
  const data = `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc({ sub: 'user-1', email: 'u@test.dev', name: 'User', session_version: 0, iat: now, exp: now + 3600 })}`;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data)));
  return `${data}.${btoa(String.fromCharCode(...signature))}`;
}

class Bucket {
  objects = new Map<string, { bytes: ArrayBuffer; type: string }>();
  async put(key: string, value: ArrayBuffer | ReadableStream, options: any) {
    const bytes = value instanceof ArrayBuffer ? value : await new Response(value).arrayBuffer();
    this.objects.set(key, { bytes, type: options.httpMetadata.contentType });
  }
  async get(key: string) {
    const object = this.objects.get(key);
    return object ? { arrayBuffer: async () => object.bytes, httpMetadata: { contentType: object.type } } : null;
  }
  async delete(key: string) { this.objects.delete(key); }
}

class Db {
  recording: any = null;
  failCompletionUpdate = false;
  prepare(sql: string) {
    const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase(); let values: any[] = [];
    const statement = {
      bind: (...input: any[]) => { values = input; return statement; },
      first: async () => {
        if (normalized.includes('select platform_role, session_version from users')) return { platform_role: null, session_version: 0 };
        if (normalized.includes('select session_version from users')) return { session_version: 0 };
        if (normalized.includes('from account_members am')) return { role: 'staff', permissions: '{"bundles":["catalog"]}', kind: 'location' };
        if (normalized.includes('select status from accounts')) return { status: 'active' };
        if (normalized.includes('from private_recordings')) {
          return this.recording && this.recording.id === values[0] && this.recording.account_id === values[1] && this.recording.user_id === values[2] ? this.recording : null;
        }
        return null;
      },
      run: async () => {
        if (this.failCompletionUpdate && normalized.startsWith("update private_recordings set status = 'completed'")) {
          throw new Error('D1 completion write failed');
        }
        if (normalized.startsWith('insert into private_recordings')) this.recording = { id: values[0], account_id: values[1], user_id: values[2], object_key: values[3], mime_type: values[4], size_bytes: values[5], expires_at: values[6] };
        if (normalized.startsWith('delete from private_recordings')) this.recording = null;
        return { success: true, meta: { changes: 1 } };
      },
      all: async () => {
        if (normalized.includes('from private_recordings') && normalized.includes('expires_at <=')) {
          return { results: this.recording ? [{ id: this.recording.id, object_key: this.recording.object_key }] : [] };
        }
        return { results: [] };
      },
    };
    return statement;
  }
}

async function request(path: string, method = 'POST', body?: BodyInit, account = 'account-1') {
  const headers = new Headers({ authorization: `Bearer ${await token()}`, 'X-Teajia-Account': account });
  return new Request(`https://test.dev${path}`, { method, headers, body });
}

afterEach(() => vi.restoreAllMocks());

describe('private transcription persistence', () => {
  it('persists private audio before a provider failure and retries it successfully', async () => {
    const db = new Db(); const bucket = new Bucket();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('upstream detail', { status: 503 })));
    const form = new FormData();
    form.set('file', new File([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 1, 2])], 'recording.webm', { type: 'audio/webm' }));
    const failed = await worker.fetch(await request('/api/transcribe', 'POST', form), { DB: db, MEDIA_BUCKET: bucket, JWT_SECRET: SECRET, GROQ_API_KEY: 'groq', PROVIDER_LIMITER: { limit: async () => ({ success: true }) } } as any);
    expect(failed.status).toBe(502);
    const failure = await failed.json() as any;
    expect(failure).toMatchObject({ code: 'provider_error', recording_id: expect.any(String), retryable: true });
    expect(db.recording.object_key).toMatch(/^private-recordings\/account-1\/user-1\//);
    expect(bucket.objects.has(db.recording.object_key)).toBe(true);

    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ text: 'Recovered transcript' })));
    const retried = await worker.fetch(await request(`/api/transcriptions/${failure.recording_id}/retry`), { DB: db, MEDIA_BUCKET: bucket, JWT_SECRET: SECRET, GROQ_API_KEY: 'groq', PROVIDER_LIMITER: { limit: async () => ({ success: true }) } } as any);
    expect(await retried.json()).toMatchObject({ text: 'Recovered transcript', recording_id: failure.recording_id });
    expect(bucket.objects.size).toBe(0);
  });

  it('denies cross-account access, supports discard, and never serves private audio publicly', async () => {
    const db = new Db(); const bucket = new Bucket();
    db.recording = { id: 'rec-1', account_id: 'account-1', user_id: 'user-1', object_key: 'private-recordings/account-1/user-1/rec-1.webm', mime_type: 'audio/webm' };
    bucket.objects.set(db.recording.object_key, { bytes: new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]).buffer, type: 'audio/webm' });
    const env = { DB: db, MEDIA_BUCKET: bucket, JWT_SECRET: SECRET, GROQ_API_KEY: 'groq', PROVIDER_LIMITER: { limit: async () => ({ success: true }) } } as any;

    expect((await worker.fetch(await request('/api/transcriptions/rec-1/retry', 'POST', undefined, 'account-2'), env)).status).toBe(404);
    expect((await worker.fetch(new Request(`https://test.dev/api/media/${db.recording.object_key}`), env)).status).toBe(404);
    expect((await worker.fetch(await request('/api/transcriptions/rec-1', 'DELETE'), env)).status).toBe(200);
    expect(db.recording).toBeNull();
    expect(bucket.objects.size).toBe(0);
  });

  it('deletes expired private audio and its database row during scheduled cleanup', async () => {
    const db = new Db(); const bucket = new Bucket();
    db.recording = { id: 'expired-1', account_id: 'account-1', user_id: 'user-1', object_key: 'private-recordings/account-1/user-1/expired-1.webm', mime_type: 'audio/webm' };
    bucket.objects.set(db.recording.object_key, { bytes: new ArrayBuffer(1), type: 'audio/webm' });

    await worker.scheduled({} as ScheduledEvent, { DB: db, MEDIA_BUCKET: bucket } as any, {} as ExecutionContext);

    expect(bucket.objects.size).toBe(0);
    expect(db.recording).toBeNull();
  });

  it('keeps the only audio copy retryable when the completion write fails', async () => {
    const db = new Db(); const bucket = new Bucket();
    db.failCompletionUpdate = true;
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ text: 'Transcript not yet durable' })));
    const form = new FormData();
    form.set('file', new File([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 1, 2])], 'recording.webm', { type: 'audio/webm' }));

    const response = await worker.fetch(await request('/api/transcribe', 'POST', form), { DB: db, MEDIA_BUCKET: bucket, JWT_SECRET: SECRET, GROQ_API_KEY: 'groq', PROVIDER_LIMITER: { limit: async () => ({ success: true }) } } as any);

    expect(response.status).toBe(500);
    expect(bucket.objects.has(db.recording.object_key)).toBe(true);
  });
});
