import { describe, expect, it } from 'vitest';
import {
  areaFor, countPhrase, describeIncident, parseLedgerTime, relativeTime, splitIncidents,
  type IncidentRow,
} from './incidentWords';

const NOW = Date.parse('2026-10-07T12:00:00Z');
const ago = (days: number) => new Date(NOW - days * 86_400_000).toISOString().slice(0, 19).replace('T', ' ');

describe('describeIncident', () => {
  it('uses the server sentence for rates_stale', () => {
    expect(describeIncident({ id: '1', error_code: 'rates_stale', safe_message: 'Rates last refreshed 4 days ago.' }))
      .toBe('Rates last refreshed 4 days ago.');
  });
  it('words a server error with its area and number', () => {
    expect(describeIncident({ id: '1', error_code: 'http_503', http_status: 503, route: '/api/products' }))
      .toBe("The shop's product list failed to load (server error 503).");
  });
  it('words a transport failure as a visitor problem', () => {
    expect(describeIncident({ id: '1', error_code: 'transport_failure', route: '/api/events' }))
      .toBe("A visitor's browser couldn't reach the sessions.");
  });
  it('never prints a bare code when nothing matches', () => {
    expect(describeIncident({ id: '1', error_code: 'unknown', route: '/api/weird/thing' }))
      .toBe('Something went wrong with "weird thing".');
  });
});

describe('areaFor', () => {
  it('falls back to the tidied route and strips ids', () => {
    expect(areaFor('/api/gadgets/3f2a9b1c-aaaa-bbbb')).toBe('"gadgets"');
    expect(areaFor('')).toBe('the site');
  });
});

describe('time words', () => {
  it('reads the ledger as UTC', () => {
    expect(parseLedgerTime('2026-10-07 12:00:00')).toBe(NOW);
  });
  it('says days ago and how many times', () => {
    expect(relativeTime(ago(3), NOW)).toBe('3 days ago');
    expect(relativeTime(ago(1), NOW)).toBe('1 day ago');
    expect(relativeTime(null, NOW)).toBe('at an unknown time');
    expect(countPhrase(1)).toBe('once');
    expect(countPhrase(7)).toBe('7 times');
  });
});

describe('splitIncidents', () => {
  const row = (id: string, lastSeenDaysAgo: number | null, status = 'open'): IncidentRow => ({
    id, status, last_seen: lastSeenDaysAgo === null ? null : ago(lastSeenDaysAgo),
  });
  it('puts 14 days and older in quiet, newer in active', () => {
    const { active, quiet } = splitIncidents([row('a', 2), row('b', 13), row('c', 14), row('d', 60)], NOW);
    expect(active.map(r => r.id)).toEqual(['a', 'b']);
    expect(quiet.map(r => r.id)).toEqual(['c', 'd']);
  });
  it('keeps an undatable row active and drops resolved ones', () => {
    const { active, quiet } = splitIncidents([row('x', null), row('y', 1, 'resolved')], NOW);
    expect(active.map(r => r.id)).toEqual(['x']);
    expect(quiet).toEqual([]);
  });
});
