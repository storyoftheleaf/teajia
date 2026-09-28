// Tea Atlas data, fetched with the session (docs/TEA_ATLAS.md).
//
// Every read goes through the Worker's access check. A 404 means "not for
// you, or not there", which the reader shows as the site's ordinary 404; it
// never means anything else. Pictures are fetched the same way and shown from
// blob URLs, because an <img src> cannot carry the session and an open URL
// would be readable by anyone it was pasted to.

import { atlasResponse } from '../lib/api';

export class AtlasNotFound extends Error {
  constructor(path: string) {
    super(`Not found: ${path}`);
    this.name = 'AtlasNotFound';
  }
}

const jsonCache = new Map<string, Promise<unknown>>();

export function atlasJson<T>(path: string): Promise<T> {
  let pending = jsonCache.get(path) as Promise<T> | undefined;
  if (!pending) {
    pending = (async () => {
      const res = await atlasResponse(path);
      if (res.status === 404) throw new AtlasNotFound(path);
      if (!res.ok) throw new Error(`Tea Atlas request failed (${res.status})`);
      return res.json() as Promise<T>;
    })();
    jsonCache.set(path, pending);
    // A failure is not remembered: the next visit asks again.
    pending.catch(() => jsonCache.delete(path));
  }
  return pending;
}

// Object URLs for pictures, oldest dropped past a few hundred so a long
// reading session does not hold every picture in memory.
const IMAGE_LIMIT = 300;
const imageCache = new Map<string, Promise<string>>();

export function atlasImageUrl(src: string): Promise<string> {
  const hit = imageCache.get(src);
  if (hit) {
    imageCache.delete(src);
    imageCache.set(src, hit);
    return hit;
  }
  const pending = (async () => {
    const res = await atlasResponse(`media/${src}`);
    if (!res.ok) throw new AtlasNotFound(`media/${src}`);
    return URL.createObjectURL(await res.blob());
  })();
  imageCache.set(src, pending);
  pending.catch(() => imageCache.delete(src));
  while (imageCache.size > IMAGE_LIMIT) {
    const [oldest, url] = imageCache.entries().next().value as [string, Promise<string>];
    imageCache.delete(oldest);
    url.then(u => URL.revokeObjectURL(u)).catch(() => {});
  }
  return pending;
}

/** Forget everything, e.g. when the person signs out or switches account. */
export function clearAtlasCache() {
  jsonCache.clear();
  for (const url of imageCache.values()) url.then(u => URL.revokeObjectURL(u)).catch(() => {});
  imageCache.clear();
}
