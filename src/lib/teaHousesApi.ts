/**
 * The tea house portfolio's routes (worker/src/teaHouses.ts), kept out of
 * api.ts, which is past its length ceiling. Shapes in src/lib/teaHousesContract.ts.
 */
import { useQuery } from '@tanstack/react-query';
import { API_URL, authedFetch, fetchWithTimeout, handleResponse } from './api';
import { teaHousesOpen } from './teaHouses';
import type { TeaHouseBuild, TeaHouseManage, TeaHousePage, TeaHousePart, TeaHouseWork } from './teaHousesContract';

const house = (id: string) => encodeURIComponent(id);

export const teaHousesApi = {
  work: async (): Promise<TeaHouseWork> =>
    handleResponse(await fetchWithTimeout(`${API_URL}/api/tea-houses/work`, { cache: 'no-store' })),
  page: async (slug: string): Promise<TeaHousePage> =>
    handleResponse(await fetchWithTimeout(`${API_URL}/api/tea-houses/work/${encodeURIComponent(slug)}`, { cache: 'no-store' })),
  build: async (): Promise<TeaHouseBuild> =>
    handleResponse(await fetchWithTimeout(`${API_URL}/api/tea-houses/build`, { cache: 'no-store' })),
  manage: {
    list: (): Promise<TeaHouseManage> => authedFetch(`${API_URL}/api/admin/tea-houses`),
    savePart: (houseId: string, part: TeaHousePart, words: string, photographs: string[]): Promise<TeaHouseManage> =>
      authedFetch(`${API_URL}/api/admin/tea-houses/${house(houseId)}/parts/${part}`, {
        method: 'PUT', body: JSON.stringify({ words, photographs }),
      }),
    removePart: (houseId: string, part: TeaHousePart): Promise<TeaHouseManage> =>
      authedFetch(`${API_URL}/api/admin/tea-houses/${house(houseId)}/parts/${part}`, { method: 'DELETE' }),
    show: (houseId: string, shown: boolean): Promise<TeaHouseManage> =>
      authedFetch(`${API_URL}/api/admin/tea-houses/${house(houseId)}/page`, { method: 'PUT', body: JSON.stringify({ shown }) }),
    order: (houses: string[]): Promise<TeaHouseManage> =>
      authedFetch(`${API_URL}/api/admin/tea-houses/order`, { method: 'PUT', body: JSON.stringify({ houses }) }),
  },
};

export const teaHouseFreshRead = {
  staleTime: 0,
  refetchOnMount: 'always',
  refetchOnWindowFocus: 'always',
} as const;

export const TEA_HOUSES_WORK_KEY = ['tea-houses', 'work'] as const;

/** The shown houses in Adrian's order, while the portfolio is open. */
export function useTeaHouseWork() {
  return useQuery({
    queryKey: TEA_HOUSES_WORK_KEY,
    queryFn: () => teaHousesApi.work(),
    enabled: teaHousesOpen(),
    ...teaHouseFreshRead,
  });
}
