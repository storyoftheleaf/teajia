/**
 * The browser's half of publishing from the page (migration 0030).
 *
 * What this pins: the stored states are read once and override the map in
 * both directions; any failure to read them settles to the map, so a bad
 * minute never hides a live story; a visitor's route waits while the read is
 * in flight instead of flashing the wrong page; the owner never waits; and a
 * press updates every reader at once.
 *
 * The real store and the real gate hook run here. Only `fetch` and the one
 * authenticated write are stubbed, since the network is the thing being
 * simulated, and storage is a plain map so the real hook reads a real token.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const store = vi.hoisted(() => {
  const map = new Map<string, string>();
  const storage = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  };
  (globalThis as Record<string, unknown>).localStorage = storage;
  (globalThis as Record<string, unknown>).sessionStorage = storage;
  return map;
});

const write = vi.hoisted(() => vi.fn());
vi.mock('../../lib/api', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../lib/api')>();
  return { ...real, setReadPublishStateRequest: write };
});

import { getReadPublishSnapshot, loadReadPublishState, resetReadPublishStateForTests, setReadPublishState } from './readPublishState';
import { useArticleAccess } from './publishGate';

const Probe: React.FC<{ href: string }> = ({ href }) => <span>{String(useArticleAccess(href))}</span>;
const access = (href: string) => renderToStaticMarkup(<Probe href={href} />).replace(/<\/?span>/g, '');

function signInAsTeajiaOwner() {
  const body = Buffer.from(JSON.stringify({
    sub: 'adrian', memberships: [{ account_id: 'acc_teajia_bali', role: 'owner', account_kind: 'platform', is_platform_account: true }],
  }), 'utf8').toString('base64url');
  store.set('teajia_token', `header.${body}.signature`);
}

beforeEach(() => {
  store.clear();
  resetReadPublishStateForTests();
  write.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe('reading the stored states', () => {
  it('overrides the map in both directions once read', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({
      states: { '/read/history': 'live', '/read/porcelain-and-tea': 'draft', '/read/x': 'nonsense' },
    })));
    await loadReadPublishState();
    expect(getReadPublishSnapshot()).toEqual({ settled: true, states: { '/read/history': 'live', '/read/porcelain-and-tea': 'draft' } });
    // /read/history is a draft in the map, /read/porcelain-and-tea is live there.
    expect(access('/read/history')).toBe('true');
    expect(access('/read/porcelain-and-tea')).toBe('false');
    // A path with no stored state is the map's: /read/ritual live, /read/legend a draft.
    expect(access('/read/ritual')).toBe('true');
    expect(access('/read/legend')).toBe('false');
  });

  it('settles to the map on any failure, so a live story is never hidden', async () => {
    for (const failing of [
      vi.fn(async () => new Response('down', { status: 503 })),
      vi.fn(async () => { throw new TypeError('network'); }),
      // The dev server's own shell, which is what an unmocked /api call returns in the browser suite.
      vi.fn(async () => new Response('<!doctype html><html></html>', { headers: { 'content-type': 'text/html' } })),
    ]) {
      resetReadPublishStateForTests();
      vi.stubGlobal('fetch', failing);
      await loadReadPublishState();
      expect(getReadPublishSnapshot()).toEqual({ settled: true, states: {} });
      expect(access('/read/porcelain-and-tea')).toBe('true');
      expect(access('/read/history')).toBe('false');
    }
  });

  it('asks only once per page load', async () => {
    const upstream = vi.fn(async () => Response.json({ states: {} }));
    vi.stubGlobal('fetch', upstream);
    await Promise.all([loadReadPublishState(), loadReadPublishState()]);
    await loadReadPublishState();
    expect(upstream).toHaveBeenCalledTimes(1);
  });
});

describe('the route while the read is in flight', () => {
  it('holds a visitor on the loader rather than guessing', () => {
    expect(getReadPublishSnapshot().settled).toBe(false);
    expect(access('/read/porcelain-and-tea')).toBe('pending');
    expect(access('/read/history')).toBe('pending');
  });

  it('never holds Teajia\'s owner', () => {
    signInAsTeajiaOwner();
    expect(access('/read/history')).toBe('true');
  });
});

describe('pressing the button', () => {
  it('updates every reader with the states the worker answers', async () => {
    write.mockResolvedValue({ path: '/read/history', state: 'live', changed: true, states: { '/read/history': 'live' } });
    await setReadPublishState('/read/history', 'live');
    expect(write).toHaveBeenCalledWith('/read/history', 'live');
    expect(getReadPublishSnapshot()).toEqual({ settled: true, states: { '/read/history': 'live' } });
    expect(access('/read/history')).toBe('true');
  });

  it('changes nothing when the worker refuses', async () => {
    write.mockRejectedValue(new Error('Only Teajia\'s own editors may publish a Read story'));
    resetReadPublishStateForTests({ settled: true, states: {} });
    await expect(setReadPublishState('/read/history', 'live')).rejects.toThrow(/editors/);
    expect(getReadPublishSnapshot().states).toEqual({});
    expect(access('/read/history')).toBe('false');
  });
});
