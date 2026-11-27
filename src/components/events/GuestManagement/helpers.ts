// ----------------------------------------------------------------
// GuestManagement - pure date/time helpers
// ----------------------------------------------------------------
import { sessionClock } from '../../../../shared/sessionClock';

// The table's own clock, with its zone named (shared/sessionClock.ts). Pass
// the session's timezone; without one the viewer's own clock is named.
export function formatEventDate(dateStr: string, timeZone?: string | null): string {
  return sessionClock(dateStr, timeZone)?.longDate ?? '';
}

export function formatDay(dateStr: string, timeZone?: string | null): string {
  return sessionClock(dateStr, timeZone)?.day ?? '';
}

export function formatTime(dateStr: string, timeZone?: string | null): string {
  return sessionClock(dateStr, timeZone)?.time ?? '';
}

export function getClaimTimeRemaining(deadline: string): string {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${mins}m remaining`;
  return `${mins}m remaining`;
}

export function isPast(dateStr: string): boolean {
  return new Date(dateStr).getTime() < Date.now();
}

export function isGuestEventCompleted(event?: { lifecycleStatus?: string | null; status?: string | null }): boolean {
  const lifecycle = event?.lifecycleStatus ?? event?.status;
  return lifecycle === 'completed' || lifecycle === 'archived';
}
