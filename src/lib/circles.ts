// Launch 5, M4: circles and series (todo/plans/guests-and-tea-masters-launch-5-run.md).
//
// A circle is a named table that meets again; a series is several sessions
// under one name. A host makes one from /account/host and puts their own
// tables in it. Closed until Adrian opens it. Two switches stand together:
// this one and Launch 2's (src/lib/fewHosts.ts), so nothing here opens while
// hosting itself is closed. With either off, every route answers 404 and
// every page is exactly as before.
//
// An explicit setting wins over the constant, either way: the site reads
// VITE_CIRCLES_OPEN ('true' or 'false'), the worker reads the CIRCLES_OPEN
// variable. Neither is set on the live site.
import { fewHostsOpen } from './fewHosts';

export const CIRCLES_OPEN = true;

type Env = { CIRCLES_OPEN?: string; FEW_HOSTS_OPEN?: string } | null | undefined;

function circlesSwitch(env?: Env): boolean {
  if (env?.CIRCLES_OPEN === 'true') return true;
  if (env?.CIRCLES_OPEN === 'false') return false;
  let site: string | undefined;
  try {
    site = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_CIRCLES_OPEN;
  } catch {
    site = undefined;
  }
  if (site === 'true') return true;
  if (site === 'false') return false;
  return CIRCLES_OPEN;
}

/** Whether circles and series are open, on the site or in the worker. Needs Launch 2 open too. */
export function circlesOpen(env?: Env): boolean {
  return circlesSwitch(env) && fewHostsOpen(env);
}

export type SeriesKind = 'circle' | 'series';

/** The longest name a circle or series may have. */
export const SERIES_NAME_MAX = 80;

/** One of the host's own tables, as a circle lists it. No guests, no counts. */
export interface SeriesTable { id: string; title: string; event_date: string; timezone: string | null; lifecycle_status: string }

/** A circle or series of the host's own, with its tables in time order. */
export interface HostSeries { id: string; name: string; kind: SeriesKind; created_at: string; tables: SeriesTable[] }

/** A guest who had a seat at an earlier table of the circle. Their name only. */
export interface CircleGuest { attendee_id: string; name: string }

/** What a session's public page says of its circle or series. Never an address, never a count. */
export interface PublicSeries { name: string; kind: SeriesKind; others: Array<{ slug: string; title: string; event_date: string }> }
