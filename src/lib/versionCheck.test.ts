import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A page that loses its files to a deploy loads the new build instead of
 * showing "Something went wrong", and never more than once per cooldown, so a
 * server still on the old build cannot start a reload loop.
 */

const reload = vi.fn();

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, String(v)); },
    removeItem: (k: string) => { map.delete(k); },
    clear: () => map.clear(),
  };
}

beforeEach(() => {
  vi.resetModules();
  reload.mockReset();
  vi.stubGlobal('sessionStorage', memoryStorage());
  vi.stubGlobal('navigator', { onLine: true });
  vi.stubGlobal('window', { location: { reload } });
});
afterEach(() => vi.unstubAllGlobals());

function serverBuild(buildId: string) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ buildId }), { status: 200 })));
}

async function load() {
  return import('./versionCheck');
}

describe('isChunkLoadError', () => {
  it('recognises each browser wording for a missing build file', async () => {
    const { isChunkLoadError } = await load();
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: https://teajia.com/assets/ArticlePage-abc.js'))).toBe(true);
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module'))).toBe(true);
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
  });
});

describe('reloadIntoNewerBuild', () => {
  it('reloads when the server is on a newer build', async () => {
    serverBuild('a-newer-build');
    const { reloadIntoNewerBuild } = await load();
    expect(await reloadIntoNewerBuild()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does not reload when the server is on this same build', async () => {
    serverBuild(__BUILD_ID__);
    const { reloadIntoNewerBuild } = await load();
    expect(await reloadIntoNewerBuild()).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('does not reload twice inside the cooldown, so it cannot loop', async () => {
    serverBuild('a-newer-build');
    sessionStorage.setItem('versionReloadAt', String(Date.now()));
    const { reloadIntoNewerBuild } = await load();
    expect(await reloadIntoNewerBuild()).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});
