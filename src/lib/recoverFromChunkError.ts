// Shared recovery for a broken/stale app load. A new deployment rotates the
// hashed chunk filenames; a stale service-worker precache or an already-open
// page can keep pointing at names that no longer exist, so a plain reload just
// re-serves the same broken assets. Purging the Workbox precache and refreshing
// the service worker first makes the reload actually pull the current build.
//
// Best-effort throughout: any failure falls through to a plain reload, which is
// still better than leaving the user stuck on the error screen.
import { api, hasToken } from './api';
import { classifyIncident } from './incidents';

async function reportChunkRecovery(): Promise<void> {
  if (!hasToken()) return;
  const route = typeof window === 'undefined' ? '/unknown' : window.location.pathname;
  const incident = classifyIncident(new Error('Chunk load recovery requested'), {
    route,
    method: 'GET',
  });
  const report = api.incidents.report({
    ...incident,
    signature: 'client:get:app-shell:none:chunk_load_recovered',
    category: 'client',
    severity: 'medium',
    error_code: 'chunk_load_recovered',
  }).catch(() => {});
  await Promise.race([
    report,
    new Promise<void>(resolve => setTimeout(resolve, 500)),
  ]);
}

export async function clearStaleAppCaches(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.update().catch(() => {})));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      // Only the Workbox precache holds hashed app chunks; leave the api/media/
      // font runtime caches alone so offline reads survive.
      await Promise.all(
        keys
          .filter((k) => k.includes('precache') || k.includes('workbox') || k === 'assets-cache')
          .map((k) => caches.delete(k))
      );
    }
  } catch {
    // ignore — the caller reloads regardless
  }
}

// Purge stale caches, then hard-reload. Used by the "Reload Application"
// affordance so pressing it genuinely recovers instead of re-serving the
// broken chunk.
export async function recoverAndReload(): Promise<void> {
  await reportChunkRecovery();
  await clearStaleAppCaches();
  window.location.reload();
}
