// The way to the house, kept on the guest's phone (Launch 2, slice H8:
// todo/plans/guests-and-tea-masters-launch-2-run.md, "Sol, H8").
//
// When a confirmed guest opens the way in, its steps and lines are kept in a
// small localStorage record keyed by the guest's page, and its photographs in
// the browser's Cache storage, so the page still shows the way where the
// signal ends. What was kept is removed when a guest page is next opened after
// the session's end (the same end the worker uses, shared/sessionEnd.ts), and
// at once when the server stops giving this page the way (a seat that is no
// longer confirmed). Every storage call is wrapped: a private window, or a
// browser that refuses storage, still renders the page and simply keeps
// nothing.
import type { VenueGuide } from '../types/events';
import { sessionEndsAt, type SessionTimes } from '../../shared/sessionEnd';
import { mediaUrl } from './mediaUrl';

const RECORD_PREFIX = 'teajia.way.';
const CACHE_PREFIX = 'teajia-way:';

export interface KeptWay {
  v: 1;
  /** When the session ends, in milliseconds; null when it cannot be read. */
  ends_at: number | null;
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
  if (kept.ends_at !== null && now >= kept.ends_at) {
    void forgetWay(page);
    return null;
  }
  return kept;
}

/** Remove every kept way whose session has ended. Run when a guest page opens. */
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
    if (!kept || (kept.ends_at !== null && now >= kept.ends_at)) await forgetWay(page);
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
  const photos = [...new Set(way.guide.steps.map(step => wayPhotoUrl(step.image_url)).filter((url): url is string => Boolean(url)))];
  try {
    storage()?.setItem(recordKey(page), JSON.stringify({ v: 1, ...way, photos } satisfies KeptWay));
  } catch {
    return;
  }
  const store = cacheStorage();
  if (!store) return;
  try {
    const cache = await store.open(cacheName(page));
    const kept = new Set((await cache.keys()).map(request => request.url));
    await Promise.all(photos.map(async url => {
      const absolute = new URL(url, window.location.href).href;
      if (kept.has(absolute)) return;
      try {
        const response = await fetch(absolute, { credentials: 'same-origin' });
        if (response.ok) await cache.put(absolute, response);
      } catch { /* left out; the steps are still kept */ }
    }));
    // A photograph the host has since taken out is not kept.
    const wanted = new Set(photos.map(url => new URL(url, window.location.href).href));
    await Promise.all([...kept].filter(url => !wanted.has(url)).map(url => cache.delete(url)));
  } catch { /* the steps are still kept */ }
}

/** A kept photograph as an address the page can show, or null. The caller revokes it. */
export async function keptPhoto(page: string, url: string): Promise<string | null> {
  const store = cacheStorage();
  if (!store) return null;
  try {
    const cache = await store.open(cacheName(page));
    const response = await cache.match(new URL(url, window.location.href).href);
    if (!response) return null;
    return URL.createObjectURL(await response.blob());
  } catch {
    return null;
  }
}
