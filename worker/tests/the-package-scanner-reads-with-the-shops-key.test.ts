import { describe, it, expect } from 'vitest';
import {
  LABEL_SCAN_PROMPT,
  labelScanProviders,
  labelScanRequest,
  scanLabel,
} from '../src/labelScan';

const image = { base64: 'AAAA', mimeType: 'image/jpeg' };
const reply = (status: number, body: unknown) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });

describe('the package scanner', () => {
  it("asks the shop's OpenAI key first, then Claude, then Gemini", () => {
    expect(labelScanProviders({ openaiKey: 'sk-a', anthropicKey: 'ak', geminiKey: 'gk' }).map((p) => p.kind))
      .toEqual(['openai', 'claude', 'gemini']);
    expect(labelScanProviders({ anthropicKey: 'ak' }).map((p) => p.kind)).toEqual(['claude']);
    expect(labelScanProviders({})).toEqual([]);
  });

  it('sends GPT-5 the photo inline, asks for JSON, and sends no temperature', () => {
    const [openai] = labelScanProviders({ openaiKey: 'sk-a' });
    const { url, init } = labelScanRequest(openai, image);
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-a');
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe('gpt-5');
    expect(body.temperature).toBeUndefined();
    expect(body.max_tokens).toBeUndefined();
    expect(body.max_completion_tokens).toBeGreaterThan(0);
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.messages[0].content[1].image_url.url).toBe('data:image/jpeg;base64,AAAA');
  });

  it('a model override is obeyed', () => {
    const [openai] = labelScanProviders({ openaiKey: 'sk-a', openaiModel: 'gpt-4.1' });
    const body = JSON.parse(String(labelScanRequest(openai, image).init.body));
    expect(body.model).toBe('gpt-4.1');
    expect(body.max_tokens).toBe(4096);
  });

  it('sends Claude no temperature and thinking off', () => {
    const [claude] = labelScanProviders({ anthropicKey: 'ak' });
    const body = JSON.parse(String(labelScanRequest(claude, image).init.body));
    expect(body.temperature).toBeUndefined();
    expect(body.thinking).toEqual({ type: 'disabled' });
  });

  it('asks for the translation, the dates and the tea type a Chinese package carries', () => {
    for (const field of ['labelTranslation', 'productionDate', 'shelfLife', 'brewing', 'chineseName', '"type"', '"year"']) {
      expect(LABEL_SCAN_PROMPT).toContain(field);
    }
  });

  it("falls through to Claude when the shop's OpenAI key is refused", async () => {
    const calls: string[] = [];
    const fetcher = (async (url: string) => {
      calls.push(url);
      if (url.includes('openai')) return reply(401, { error: { message: 'bad key' } });
      return reply(200, { content: [{ type: 'text', text: '{"givenName":"Lao Ban Zhang"}' }] });
    }) as unknown as typeof fetch;
    const outcome = await scanLabel(labelScanProviders({ openaiKey: 'sk-a', anthropicKey: 'ak' }), image, fetcher, async () => {});
    expect(outcome).toEqual({ ok: true, text: '{"givenName":"Lao Ban Zhang"}', provider: 'claude' });
    expect(calls).toHaveLength(2);
  });

  it('reads the OpenAI answer and retries a busy one once', async () => {
    let n = 0;
    const fetcher = (async () => {
      n += 1;
      if (n === 1) return reply(429, 'busy');
      return reply(200, { choices: [{ message: { content: '{"type":"Sheng","year":2019}' } }] });
    }) as unknown as typeof fetch;
    const outcome = await scanLabel(labelScanProviders({ openaiKey: 'sk-a' }), image, fetcher, async () => {});
    expect(outcome).toEqual({ ok: true, text: '{"type":"Sheng","year":2019}', provider: 'openai' });
    expect(n).toBe(2);
  });

  it('says which failure it was: nothing to call, or nobody answered', async () => {
    expect(await scanLabel([], image)).toEqual({ ok: false, error: 'no_ai_provider' });
    const down = (async () => reply(500, 'down')) as unknown as typeof fetch;
    expect(await scanLabel(labelScanProviders({ openaiKey: 'sk-a' }), image, down, async () => {}))
      .toEqual({ ok: false, error: 'provider_error' });
  });
});
