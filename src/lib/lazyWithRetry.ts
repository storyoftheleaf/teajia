import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

// Retry a failed chunk load in place. A transient fetch failure is common on a
// jumpy/firewalled connection, especially for the large admin bundle.
//
// Every lazy page goes through this, not just the admin and the shop. Until
// 2026-10-11 the article reader loaded with a bare lazy(), so one dropped
// request on /read/porcelain-and-tea went straight to "Something went wrong"
// while the build was current and nothing was stale to reload into.
//
// Never reload automatically from this path. Automatic reload was the mechanism
// behind the rapid flashing incident: an old shell could fail its AdminApp
// preload, reload, and immediately repeat. After bounded retries, throw to the
// root ErrorBoundary; its button is the only explicit recovery navigation.
export const RETRY_DELAYS_MS = [400, 1200, 2500];

export async function importWithRetry<T>(
  factory: () => Promise<T>,
  delays: readonly number[] = RETRY_DELAYS_MS,
  wait: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await factory();
    } catch (err) {
      if (attempt >= delays.length) throw err;
      await wait(delays[attempt]);
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithRetry<C extends ComponentType<any>>(
  factory: () => Promise<{ default: C }>,
): LazyExoticComponent<C> {
  return lazy(() => importWithRetry(factory));
}
