// A session's time, as a guest is shown it (review A9-12 and W1-2). One
// formatter for every guest page: the table's own clock, with its zone named,
// so a guest in another country reads the hour the host set and knows whose
// hour it is. With no zone stated, the viewer's own clock, named as such.
// The instant comes from the same rule as the session's end
// (shared/sessionEnd.ts sessionInstant), so a wall time stored without an
// offset is read in the session's own zone.

import { sessionInstant } from './sessionEnd';

export type SessionClock = {
  /** "Thursday" */
  day: string;
  /** "March 5, 2099" */
  date: string;
  /** "Thursday, March 5, 2099" */
  longDate: string;
  /** "11:30 PM" */
  hour: string;
  /** "Makassar time", "UTC" or "GMT+8" */
  zone: string;
  /** "11:30 PM, Makassar time" */
  time: string;
};

function validZone(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value.trim() });
    return value.trim();
  } catch {
    return null;
  }
}

function viewerZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** The zone said in words: the city of an IANA name, else its short name. */
export function zoneName(timeZone: string, at = Date.now()): string {
  if (/^(Etc\/)?(UTC|GMT|Universal|Zulu)$/i.test(timeZone)) return 'UTC';
  const city = /^[A-Za-z]+\/(?:[A-Za-z_-]+\/)?([A-Za-z_-]+)$/.exec(timeZone)?.[1];
  if (city && !timeZone.startsWith('Etc/')) return `${city.replace(/_/g, ' ')} time`;
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' })
      .formatToParts(new Date(at)).find(p => p.type === 'timeZoneName');
    return part?.value || timeZone;
  } catch {
    return timeZone;
  }
}

/**
 * The session's time in its own zone, named; or null when the date cannot be
 * read. `timeZone` is the session's (events.timezone).
 */
export function sessionClock(value: unknown, timeZone?: unknown): SessionClock | null {
  const zone = validZone(timeZone) ?? viewerZone();
  const instant = sessionInstant(value, zone);
  if (!instant) return null;
  const at = new Date(instant.at);
  const format = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-US', { timeZone: zone, ...options }).format(at);
  const day = format({ weekday: 'long' });
  const date = format({ month: 'long', day: 'numeric', year: 'numeric' });
  const hour = format({ hour: 'numeric', minute: '2-digit', hour12: true });
  const named = zoneName(zone, instant.at);
  return { day, date, longDate: `${day}, ${date}`, hour, zone: named, time: `${hour}, ${named}` };
}
