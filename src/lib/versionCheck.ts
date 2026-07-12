// Self-heal for a stale build. Fetches the deployed version.json and, when the
// server's buildId no longer matches the one baked into this bundle, purges the
// stale service-worker precache and reloads. Keeps a long-open tab (or a page
// left on an old build behind a stale cache) from silently drifting behind
// production.
import { clearStaleAppCaches } from './recoverFromChunkError';

// Cap version-triggered reloads so a genuinely wedged browser (one where even a
// purge + reload can't reach the new build) settles on the old-but-working
// shell instead of reloading in a tight loop. Survives the reload via
// sessionStorage.
const RELOAD_KEY = 'versionReloadAt';
const RELOAD_COOLDOWN = 30_000;

let lastCheck = 0;
let reloading = false;

async function check() {
  if (reloading || !navigator.onLine) return;
  const now = Date.now();
  if (now - lastCheck < 60_000) return; // at most once a minute
  lastCheck = now;
  try {
    const res = await fetch(`/version.json?ts=${now}`, { cache: 'no-store' });
    if (!res.ok) return;
    const data = (await res.json()) as { buildId?: string };
    if (data.buildId && data.buildId !== __BUILD_ID__) {
      // Already reloaded for a version mismatch a moment ago and still stale?
      // Stop, don't loop; the shipped chunk-error recovery + next real visit
      // will converge.
      const lastReload = Number(sessionStorage.getItem(RELOAD_KEY) || '0');
      if (now - lastReload < RELOAD_COOLDOWN) return;
      sessionStorage.setItem(RELOAD_KEY, String(now));
      reloading = true;
      await clearStaleAppCaches();
      window.location.reload();
    }
  } catch {
    // offline or blocked, ignore and try again next trigger
  }
}

/** Start the self-heal: check on load, when the tab regains focus, and hourly. */
export function startVersionCheck() {
  check();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
  window.setInterval(check, 60 * 60 * 1000);
}
