import { describe, expect, it } from 'vitest';
import { summaryStatusOnRefetch } from './domain';

describe('summaryStatusOnRefetch', () => {
  it('keeps a ready status while refetching behind a good cache, so publishing stays open', () => {
    expect(summaryStatusOnRefetch('ready', true, false)).toBe('ready');
  });
  it('blocks on the first load, an empty cache, or a different account', () => {
    expect(summaryStatusOnRefetch('loading', false, false)).toBe('loading');
    expect(summaryStatusOnRefetch('ready', false, false)).toBe('loading');
    expect(summaryStatusOnRefetch('ready', true, true)).toBe('loading');
  });
  it('keeps a stale status behind a cache', () => {
    expect(summaryStatusOnRefetch('stale', true, false)).toBe('stale');
  });
});
