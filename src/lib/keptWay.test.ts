// The way in kept on the guest's phone (Launch 2, H8; audit A2 finding F7).
// A copy whose end cannot be read is removed 24 hours after it was kept, and
// a photograph handed out by a signed address is kept under its own address,
// so the kept copy still shows it once the signature has run out.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { keepWay, keptPhoto, keptPhotoKey, keptWayExpired, readKeptWay, sweepEndedWays, UNDATED_WAY_KEEP_MS } from './keptWay';

function memoryStorage() {
  const items = new Map<string, string>();
  return {
    get length() { return items.size; },
    key: (index: number) => [...items.keys()][index] ?? null,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => { items.set(key, value); },
    removeItem: (key: string) => { items.delete(key); },
    clear: () => items.clear(),
  };
}

function memoryCaches() {
  const stores = new Map<string, Map<string, Response>>();
  const open = async (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name)!;
    return {
      keys: async () => [...store.keys()].map(url => ({ url })),
      put: async (url: string, response: Response) => { store.set(url, response); },
      match: async (url: string) => store.get(url)?.clone(),
      delete: async (url: string) => store.delete(url),
    };
  };
  return { stores, api: { open, delete: async (name: string) => stores.delete(name) } };
}

const SIGNED = 'https://media.teajia.co/accounts/a/venue-guide/gate.jpg?exp=100&for=seat&sig=abc';
const guide = { steps: [{ description: 'Blue gate', image_url: SIGNED }] };
let caches: ReturnType<typeof memoryCaches>;
let fetched: string[];

beforeEach(() => {
  caches = memoryCaches();
  fetched = [];
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('window', { location: { href: 'https://www.teajia.com/m/token' } });
  vi.stubGlobal('caches', caches.api);
  vi.stubGlobal('fetch', vi.fn(async (url: string) => { fetched.push(url); return new Response('jpeg'); }));
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:kept' }));
});

afterEach(() => vi.unstubAllGlobals());

describe('the kept way', () => {
  it('removes an undated copy 24 hours after it was kept, on any sweep', async () => {
    const now = Date.parse('2026-11-26T10:00:00Z');
    await keepWay('page', { ends_at: null, title: 'Table', address: 'Here', map_link: null, guide }, now);
    expect(readKeptWay('page', now + UNDATED_WAY_KEEP_MS - 1)).not.toBeNull();
    // Opening it again does not keep it on for longer.
    await keepWay('page', { ends_at: null, title: 'Table', address: 'Here', map_link: null, guide }, now + HOUR);
    await sweepEndedWays(now + UNDATED_WAY_KEEP_MS);
    expect(readKeptWay('page', now + UNDATED_WAY_KEEP_MS)).toBeNull();
    expect(localStorage.length).toBe(0);
  });

  it('removes a dated copy at its end, and an undated one with no record of when it was kept', () => {
    expect(keptWayExpired({ ends_at: 1000 }, 999)).toBe(false);
    expect(keptWayExpired({ ends_at: 1000 }, 1000)).toBe(true);
    expect(keptWayExpired({ ends_at: null }, 0)).toBe(true);
    expect(keptWayExpired({ ends_at: null, kept_at: 0 }, UNDATED_WAY_KEEP_MS - 1)).toBe(false);
  });

  it('fetches a photograph by its signed address and keeps it under its own', async () => {
    await keepWay('page', { ends_at: Date.now() + DAY, title: null, address: null, map_link: null, guide });
    expect(fetched).toHaveLength(1);
    expect(fetched[0]).toContain('sig=abc');
    const kept = caches.stores.get('teajia-way:page')!;
    expect([...kept.keys()]).toEqual(['https://www.teajia.com/api/media/accounts/a/venue-guide/gate.jpg']);
    // A later answer signs the same photograph afresh: it is not fetched again,
    // and the kept copy is found by either address.
    const later = SIGNED.replace('sig=abc', 'sig=def');
    await keepWay('page', { ends_at: Date.now() + DAY, title: null, address: null, map_link: null, guide: { steps: [{ description: 'Blue gate', image_url: later }] } });
    expect(fetched).toHaveLength(1);
    expect(await keptPhoto('page', `/api/media/accounts/a/venue-guide/gate.jpg?exp=1&for=seat&sig=zzz`)).toBe('blob:kept');
    expect(keptPhotoKey('/api/media/x.jpg?sig=1#top')).toBe('https://www.teajia.com/api/media/x.jpg');
  });
});

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
