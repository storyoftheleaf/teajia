/**
 * The Tea Table's routes (worker/src/teaTable.ts), kept out of api.ts, which
 * is past its length ceiling. Shapes in src/lib/teaTableContract.ts.
 */
import { useQuery } from '@tanstack/react-query';
import { API_URL, authedFetch, fetchWithTimeout, handleResponse, hasToken } from './api';
import { teaTableOpen, type TeaTableKind } from './teaTable';
import type { TeaTableManageItem, TeaTableMine, TeaTablePage, TeaTableRecapState, TeaTableShow } from './teaTableContract';

const path = (kind: TeaTableKind, id: string) => `${encodeURIComponent(kind)}/${encodeURIComponent(id)}`;

export const teaTableApi = {
  /** One page of the table. The same answer for everyone, read fresh each time. */
  page: async (show: TeaTableShow, before: string | null, signal?: AbortSignal): Promise<TeaTablePage> => {
    const query = new URLSearchParams();
    if (show !== 'all') query.set('show', show);
    if (before) query.set('before', before);
    const tail = query.toString();
    return handleResponse(await fetchWithTimeout(`${API_URL}/api/tea-table${tail ? `?${tail}` : ''}`, { signal, cache: 'no-store' }));
  },
  /** What the caller kept, and which pieces are their own. */
  mine: (): Promise<TeaTableMine> => authedFetch(`${API_URL}/api/tea-table/me`),
  keep: (kind: TeaTableKind, id: string, kept: boolean): Promise<{ kind: TeaTableKind; id: string; kept: boolean }> =>
    authedFetch(`${API_URL}/api/tea-table/keeps/${path(kind, id)}`, { method: kept ? 'PUT' : 'DELETE' }),
  /** The author takes their own tasting off the table. It stays on their page. */
  takeOff: (id: string): Promise<{ kind: 'tasting'; id: string; on_table: false }> =>
    authedFetch(`${API_URL}/api/tea-table/mine/tasting/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  hold: (kind: TeaTableKind, id: string, days: number | null): Promise<{ held_until: string | null }> =>
    authedFetch(`${API_URL}/api/tea-table/holds/${path(kind, id)}`, days === null
      ? { method: 'DELETE' }
      : { method: 'PUT', body: JSON.stringify({ days }) }),
  recap: {
    state: (eventId: string): Promise<TeaTableRecapState> =>
      authedFetch(`${API_URL}/api/admin/tea-table/recaps/${encodeURIComponent(eventId)}`),
    put: (eventId: string, on: boolean): Promise<TeaTableRecapState> =>
      authedFetch(`${API_URL}/api/admin/tea-table/recaps/${encodeURIComponent(eventId)}`, { method: on ? 'PUT' : 'DELETE' }),
  },
  manage: {
    list: (): Promise<{ items: TeaTableManageItem[] }> => authedFetch(`${API_URL}/api/admin/tea-table`),
    hide: (kind: TeaTableKind, id: string, hidden: boolean): Promise<{ hidden: boolean }> =>
      authedFetch(`${API_URL}/api/admin/tea-table/hide`, { method: 'POST', body: JSON.stringify({ kind, id, hidden }) }),
  },
};

export const TEA_TABLE_MINE_KEY = ['tea-table', 'mine'] as const;

/** The caller's keeps and own pieces, when the Tea Table is open and they are signed in. */
export function useTeaTableMine(enabled = true) {
  return useQuery({
    queryKey: TEA_TABLE_MINE_KEY,
    queryFn: () => teaTableApi.mine(),
    enabled: enabled && teaTableOpen() && hasToken(),
    staleTime: 0,
  });
}
