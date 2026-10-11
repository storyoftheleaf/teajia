import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { importWithRetry, RETRY_DELAYS_MS } from './lazyWithRetry';

const noWait = async () => {};

describe('a page that fails to download is asked for again', () => {
  it('a dropped request is retried and the page still loads', async () => {
    let calls = 0;
    const page = await importWithRetry(async () => {
      calls += 1;
      if (calls < 3) throw new Error('Failed to fetch dynamically imported module');
      return { default: 'Reader' };
    }, RETRY_DELAYS_MS, noWait);
    expect(page.default).toBe('Reader');
    expect(calls).toBe(3);
  });

  it('gives up after the last retry so the error screen can offer a reload', async () => {
    let calls = 0;
    await expect(importWithRetry(async () => {
      calls += 1;
      throw new Error('Failed to fetch dynamically imported module');
    }, RETRY_DELAYS_MS, noWait)).rejects.toThrow('dynamically imported module');
    expect(calls).toBe(RETRY_DELAYS_MS.length + 1);
  });

  it('every lazy page in the app goes through the retry', () => {
    const src = readFileSync(join(process.cwd(), 'src/App.tsx'), 'utf8')
      .replace(/\/\/.*$/gm, '');
    expect(src).not.toMatch(/(^|[^A-Za-z])lazy\(/m);
    expect(src).toMatch(/lazyWithRetry\(\(\) => import\('\.\/components\/Reader'\)/);
  });
});
