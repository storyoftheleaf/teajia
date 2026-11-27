// The way to the house, kept on the guest's phone (Launch 2, slice H8:
// todo/plans/guests-and-tea-masters-launch-2-run.md, "Sol, H8").
//
// When a confirmed guest opens the way in, its steps and lines are kept in a
// small localStorage record keyed by the guest's page, and its photographs in
// the browser's Cache storage, so the page still shows the way where the
// signal ends. What was kept is removed whenever the site next opens after the
// session's end (the same end the worker uses, shared/sessionEnd.ts), or 24
// hours after it was kept when its end cannot be read, and at once when the
// server stops giving this page the way (a seat that is no longer confirmed).
// The step photographs arrive by addresses signed for this seat and this
// answer only (worker/src/wayMedia.ts), so they are kept under their address
// without the signature: the bytes stay on the phone after the signature has
// run out. Every storage call is wrapped: a private window, or a browser that
// refuses storage, still renders the page and simply keeps nothing.
import type { VenueGuide } from '../types/events';
import { sessionEndsAt, type SessionTimes } from '../../shared/sessionEnd';
import { mediaUrl } from './mediaUrl';

const RECORD_PREFIX = 'teajia.way.';
const CACHE_PREFIX = 'teajia-way:';
/** How long a copy whose end cannot be read is kept. */
export const UNDATED_WAY_KEEP_MS = 24 * 60 * 60 * 1000;

export interface KeptWay {
  v: 1;
  /** When the session ends, in milliseconds; null when it cannot be read. */
  ends_at: number | null;
  /** When this copy was kept, in milliseconds. */
  kept_at?: number;
  title: string | null;
  map_link: string | null;
  address: string | null;
  guide: VenueGuide;
  /** The addresses the photographs were kept under. */
  photos: string[];
}

const recordKey = (page: string) => `${RECORD_PREFIX}${page}`;
const cacheName = (page: string) => `${CACHE_PREFIX}${page}`;

function storage(): Storage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}

function cacheStorage(): CacheStorage | null {
  try { return typeof caches === 'undefined' ? null : caches; } catch { return null; }
}

/** The address a step photograph is fetched from, and kept under. */
export function wayPhotoUrl(url: string | undefined): string | undefined {
  return mediaUrl(url);
}

/** The address a photograph is kept under: its own, without the signature. */
export function keptPhotoKey(url: string): string {
  const absolute = new URL(url, window.location.href);
  absolute.search = '';
  absolute.hash = '';
  return absolute.href;
}

/** Whether a kept copy has outlived its session, or 24 hours when its end cannot be read. */
export function keptWayExpired(kept: Pick<KeptWay, 'ends_at' | 'kept_at'>, now = Date.now()): boolean {
  if (kept.ends_at !== null && Number.isFinite(kept.ends_at)) return now >= kept.ends_at;
  const keptAt = typeof kept.kept_at === 'number' && Number.isFinite(kept.kept_at) ? kept.kept_at : null;
  // An undated copy with no record of when it was kept is not kept on.
  return keptAt === null || now >= keptAt + UNDATED_WAY_KEEP_MS;
}

/** When this session ends, by the shared rule. */
export function wayEndsAt(session: SessionTimes): number | null {
  return sessionEndsAt(session);
}

function parse(raw: string | null): KeptWay | null {
  if (!raw) return null;
  try {
    const kept = JSON.parse(raw) as KeptWay;
    return kept && kept.v === 1 && kept.guide && Array.isArray(kept.guide.steps) ? kept : null;
  } catch {
    return null;
  }
}

/** Remove what this guest page kept. */
export async function forgetWay(page: string): Promise<void> {
  try { storage()?.removeItem(recordKey(page)); } catch { /* nothing kept */ }
  try { await cacheStorage()?.delete(cacheName(page)); } catch { /* nothing kept */ }
}

/** What this guest page kept, or null. A copy past the session's end is removed, never returned. */
export function readKeptWay(page: string, now = Date.now()): KeptWay | null {
  let raw: string | null = null;
  try { raw = storage()?.getItem(recordKey(page)) ?? null; } catch { return null; }
  const kept = parse(raw);
  if (!kept) return null;
  if (keptWayExpired(kept, now)) {
    void forgetWay(page);
    return null;
  }
  return kept;
}

/** Remove every kept way whose session has ended. Run when the site opens and when a guest page opens. */
export async function sweepEndedWays(now = Date.now()): Promise<void> {
  const store = storage();
  if (!store) return;
  const pages: string[] = [];
  try {
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key?.startsWith(RECORD_PREFIX)) pages.push(key.slice(RECORD_PREFIX.length));
    }
  } catch {
    return;
  }
  await Promise.all(pages.map(async page => {
    let kept: KeptWay | null = null;
    try { kept = parse(store.getItem(recordKey(page))); } catch { /* unreadable */ }
    if (!kept || keptWayExpired(kept, now)) await forgetWay(page);
  }));
}

/**
 * Keep the way for this guest page: the record first, then each photograph.
 * A photograph that cannot be fetched is left out; the steps are still kept.
 */
export async function keepWay(page: string, way: Omit<KeptWay, 'v' | 'photos'>, now = Date.now()): Promise<void> {
  if (way.ends_at !== null && now >= way.ends_at) {
    await forgetWay(page);
    return;
  }
  const photos = [...new Set([...way.guide.steps.map(step => wayPhotoUrl(step.image_url)), wayPhotoUrl(way.guide.space_image_url)].filter((url): url is string => Boolean(url)))];
  // An undated copy keeps the time it was first kept, so opening the page
  // again does not keep it on for ever.
  const earlier = (() => { try { return parse(storage()?.getItem(recordKey(page)) ?? null); } catch { return null; } })();
  const keptAt = way.ends_at === null && typeof earlier?.kept_at === 'number' ? earlier.kept_at : now;
  try {
    storage()?.setItem(recordKey(page), JSON.stringify({ v: 1, ...way, kept_at: keptAt, photos } satisfies KeptWay));
  } catch {
    return;
  }
  const store = cacheStorage();
  if (!store) return;
  try {
    const cache = await store.open(cacheName(page));
    const kept = new Set((await cache.keys()).map(request => request.url));
    await Promise.all(photos.map(async url => {
      const key = keptPhotoKey(url);
      if (kept.has(key)) return;
      try {
        const response = await fetch(new URL(url, window.location.href).href, { credentials: 'same-origin' });
        if (response.ok) await cache.put(key, response);
      } catch { /* left out; the steps are still kept */ }
    }));
    // A photograph the host has since taken out is not kept.
    const wanted = new Set(photos.map(keptPhotoKey));
    await Promise.all([...kept].filter(url => !wanted.has(url)).map(url => cache.delete(url)));
  } catch { /* the steps are still kept */ }
}

/** A kept photograph as an address the page can show, or null. The caller revokes it. */
export async function keptPhoto(page: string, url: string): Promise<string | null> {
  const store = cacheStorage();
  if (!store) return null;
  try {
    const cache = await store.open(cacheName(page));
    const response = await cache.match(keptPhotoKey(url));
    if (!response) return null;
    return URL.createObjectURL(await response.blob());
  } catch {
    return null;
  }
}
