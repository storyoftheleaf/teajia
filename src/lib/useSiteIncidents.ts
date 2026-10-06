import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { splitIncidents, type IncidentRow } from './incidentWords';

/** Shared by Your Table (the count) and the Needs fixing page (the list). */
export const SITE_INCIDENTS_KEY = ['platform', 'incidents'] as const;

/**
 * The open problem ledger, for the platform owner only. `enabled` must be the
 * owner check: a visitor never makes this request, so they never see, count or
 * cause a builder problem. The read itself reports nothing (see api.incidents).
 */
export function useSiteIncidents(enabled: boolean) {
  return useQuery<IncidentRow[]>({
    queryKey: SITE_INCIDENTS_KEY,
    enabled,
    staleTime: 1000 * 60 * 2,
    retry: false,
    queryFn: async () => {
      const res = await api.incidents.list();
      return Array.isArray(res?.incidents) ? (res.incidents as IncidentRow[]) : [];
    },
  });
}

/** How many open problems were seen inside the active window. */
export function activeIncidentCount(rows: readonly IncidentRow[] | undefined): number {
  return rows ? splitIncidents(rows).active.length : 0;
}
