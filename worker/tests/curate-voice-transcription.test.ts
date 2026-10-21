import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasTeaVoiceProvider, INSTALLED_VOICE_MODEL, transcribeTeaVoice, VOICE_TRANSCRIPTION_TIMEOUT_MS } from '../src/curateVoiceTranscription';

const audio = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 255, 0]);
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('voice transcription uses the installed connection when no Groq key is configured', () => {
  it('sends exact base64 bytes to Whisper and retains the spoken language', async () => {
    const run = vi.fn().mockResolvedValue({ text: '  这款水仙，三十多年。  ' });
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    expect(await transcribeTeaVoice({ AI: { run } }, audio, 'audio/webm')).toBe('这款水仙，三十多年。');
    expect(run).toHaveBeenCalledWith(INSTALLED_VOICE_MODEL, { audio: btoa(String.fromCharCode(...audio)), task: 'transcribe' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('preserves the configured Groq path and its file MIME without calling installed AI', async () => {
    const run = vi.fn();
    const fetch = vi.fn().mockResolvedValue(Response.json({ text: 'Supplier age claim.' })); vi.stubGlobal('fetch', fetch);
    expect(await transcribeTeaVoice({ GROQ_API_KEY: 'configured', AI: { run } }, audio.buffer, 'audio/mp4', 'memo.m4a')).toBe('Supplier age claim.');
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://api.groq.com/openai/v1/audio/transcriptions');
    expect(init.headers).toEqual({ Authorization: 'Bearer configured' });
    expect(init.body.get('model')).toBe('whisper-large-v3-turbo');
    const file = init.body.get('file') as File;
    expect([file.type, file.name]).toEqual(['audio/mp4', 'memo.m4a']);
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(audio);
    expect(run).not.toHaveBeenCalled();
  });

  it('accepts a whitespace key as absent and encodes audio beyond a spread argument limit', async () => {
    const bytes = new Uint8Array(100_000).fill(255);
    const run = vi.fn().mockResolvedValue({ text: 'Memo' });
    await transcribeTeaVoice({ GROQ_API_KEY: ' ', AI: { run } }, bytes, 'audio/webm');
    expect(atob(run.mock.calls[0][1].audio)).toHaveLength(bytes.length);
  });

  it('refuses empty audio or an absent connection before provider work', async () => {
    expect(hasTeaVoiceProvider({})).toBe(false);
    expect(hasTeaVoiceProvider({ AI: {} })).toBe(false);
    expect(hasTeaVoiceProvider({ AI: { run: vi.fn() } })).toBe(true);
    await expect(transcribeTeaVoice({}, audio, 'audio/webm')).rejects.toMatchObject({ code: 'provider_unavailable', status: 503 });
    await expect(transcribeTeaVoice({ AI: { run: vi.fn() } }, new Uint8Array(), 'audio/webm')).rejects.toMatchObject({ code: 'invalid_audio', status: 400 });
  });

  it.each([null, [], { text: '' }, { text: 4 }, { response: 'invented shape' }])('rejects incomplete provider output %j', async result => {
    await expect(transcribeTeaVoice({ AI: { run: vi.fn().mockResolvedValue(result) } }, audio, 'audio/webm')).rejects.toMatchObject({ code: 'provider_error', status: 502 });
  });

  it('sanitizes provider exceptions and preserves a failed Groq request for explicit retry', async () => {
    const run = vi.fn(); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('private upstream detail', { status: 503 })));
    await expect(transcribeTeaVoice({ GROQ_API_KEY: 'configured', AI: { run } }, audio, 'audio/webm')).rejects.toMatchObject({ message: 'Transcription failed', code: 'provider_error', status: 502 });
    expect(run).not.toHaveBeenCalled();
    await expect(transcribeTeaVoice({ AI: { run: vi.fn().mockRejectedValue(new Error('secret upstream detail')) } }, audio, 'audio/webm')).rejects.toMatchObject({ message: 'Transcription failed', code: 'provider_error' });
  });

  it.each(['installed', 'groq'])('bounds the entire %s operation and clears its timer', async provider => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockImplementation(() => new Promise(() => {})); vi.stubGlobal('fetch', fetch);
    const env = provider === 'groq' ? { GROQ_API_KEY: 'configured' } : { AI: { run: vi.fn().mockImplementation(() => new Promise(() => {})) } };
    const pending = transcribeTeaVoice(env, audio, 'audio/webm');
    const assertion = expect(pending).rejects.toMatchObject({ code: 'provider_timeout', status: 504 });
    await vi.advanceTimersByTimeAsync(VOICE_TRANSCRIPTION_TIMEOUT_MS); await assertion;
    expect(vi.getTimerCount()).toBe(0);
    if (provider === 'groq') expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
  });
});
