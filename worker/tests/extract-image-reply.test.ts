import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isRetryableProviderStatus, parseExtractReply } from '../src/extractImageReply';

describe('reading the label scanner reply', () => {
  it('reads a bare object, a fenced one, and one wrapped in a sentence', () => {
    expect(parseExtractReply('{"name":"Y562"}')).toEqual({ name: 'Y562' });
    expect(parseExtractReply('```json\n{"name":"Y562"}\n```')).toEqual({ name: 'Y562' });
    expect(parseExtractReply('Here is what I found: {"name":"Y562","year":1993} Hope that helps.'))
      .toEqual({ name: 'Y562', year: 1993 });
  });

  it('is a failed scan only when there is no object at all', () => {
    expect(parseExtractReply('')).toBeNull();
    expect(parseExtractReply('I could not read this label.')).toBeNull();
    expect(parseExtractReply('{"name": "cut off')).toBeNull();
    expect(parseExtractReply('[1,2]')).toBeNull();
  });

  it('retries a busy or overloaded provider, never a bad request', () => {
    for (const s of [429, 500, 503, 529]) expect(isRetryableProviderStatus(s)).toBe(true);
    for (const s of [400, 401, 403, 404, 413]) expect(isRetryableProviderStatus(s)).toBe(false);
  });

  it('the scanner turns thinking off so it cannot spend the reply on it', () => {
    const src = readFileSync(join(process.cwd(), 'worker/src/index.ts'), 'utf8');
    const start = src.indexOf('const handleExtractFromImage');
    const body = src.slice(start, src.indexOf('// ── Waitlist Cascade Helper', start));
    expect(body).toMatch(/thinking:\s*\{\s*type:\s*'disabled'\s*\}/);
    expect(body).toMatch(/parseExtractReply\(/);
  });
});
