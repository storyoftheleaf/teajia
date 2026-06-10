import { useAppStore } from './store';
import { api, hasToken } from './api';
import { threadsFromStored, threadNames } from '../components/TeaDiscovery/threads';
import type { DiscoveryLevel, TeaDiscoveryProfile } from '../components/TeaDiscovery/types';

// Store profile → API payload. Threads are serialized into the legacy single-
// disposition columns: ids comma-joined into `dispositionId`, their joined names
// into `dispositionName` (the worker/MCP/admin treat both as opaque display
// strings), so no schema migration is needed for the threads model.
function toPayload(p: TeaDiscoveryProfile) {
  return {
    answers: p.answers,
    level: p.level,
    dispositionId: p.threadIds.join(','),
    dispositionName: threadNames(p.threadIds),
    completedAt: p.completedAt,
  };
}

// API row → store profile. Threads are parsed back from the stored `dispositionId`
// (handles both new comma-joined thread ids and legacy single-archetype ids).
function fromServer(raw: any): TeaDiscoveryProfile | null {
  if (!raw || !raw.dispositionId) return null;
  return {
    answers: raw.answers ?? {},
    level: (raw.level ?? 'curious') as DiscoveryLevel,
    threadIds: threadsFromStored(raw.dispositionId),
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
