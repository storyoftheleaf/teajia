import { useAppStore } from './store';
import { api, hasToken } from './api';
import { DISPOSITIONS } from '../components/TeaDiscovery/dispositions';
import type { DiscoveryLevel, TeaDiscoveryProfile } from '../components/TeaDiscovery/types';

// Store profile → API payload. dispositionName is denormalized from the catalog
// so the worker/MCP can return a human-readable label without the client copy.
function toPayload(p: TeaDiscoveryProfile) {
  return {
    answers: p.answers,
    level: p.level,
    dispositionId: p.dispositionId,
    dispositionName: DISPOSITIONS[p.dispositionId]?.name ?? '',
    completedAt: p.completedAt,
  };
}

// API row → store profile. The name is re-derived from dispositionId on render,
// so it is intentionally not kept on the store shape.
function fromServer(raw: any): TeaDiscoveryProfile | null {
  if (!raw || !raw.dispositionId) return null;
  return {
    answers: raw.answers ?? {},
    level: (raw.level ?? 'curious') as DiscoveryLevel,
    dispositionId: raw.dispositionId,
    completedAt: raw.completedAt ?? new Date().toISOString(),
  };
}

/** Persist a profile to the server (fire-and-forget). Falls back to the store value. */
export async function pushTeaDiscoveryProfile(profile?: TeaDiscoveryProfile): Promise<void> {
  if (!hasToken()) return;
  const p = profile ?? useAppStore.getState().teaDiscoveryProfile;
  if (!p) return;
  try {
    await api.teaDiscovery.save(toPayload(p));
  } catch (err) {
    console.warn('[TeaDiscovery] push failed:', err);
  }
}

/**
 * Reconcile the device-saved profile with the server on login.
 * Last-write-wins by completedAt:
 *  - server newer  → adopt it locally (cross-device continuity)
 *  - local newer   → push it up (e.g. taken while anonymous, then signed in)
 */
export async function syncTeaDiscoveryProfile(): Promise<void> {
  if (!hasToken()) return;
  try {
    const data = await api.teaDiscovery.get();
    const server = fromServer(data?.profile);
    const local = useAppStore.getState().teaDiscoveryProfile;

    const serverT = server ? new Date(server.completedAt).getTime() : -1;
    const localT = local ? new Date(local.completedAt).getTime() : -1;

    if (server && serverT > localT) {
      useAppStore.getState().setTeaDiscoveryProfile(server);
    } else if (local && localT > serverT) {
      await pushTeaDiscoveryProfile(local);
    }
  } catch (err) {
    console.warn('[TeaDiscovery] sync failed:', err);
  }
}
