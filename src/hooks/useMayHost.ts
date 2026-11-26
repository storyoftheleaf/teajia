// Launch 2, a few hosts: whether this person may see the host pages. Both
// gates stand together: the switch (src/lib/fewHosts.ts) and what the server
// says this person may host (GET /api/me/hosting, `doors`). In Launch 2 only
// approved hosts have doors; when Launch 3 lifts that gate on the server,
// anyone gets the by-request door and this hook needs no change. While the
// switch is closed nothing is asked of the server.
import { useQuery } from '@tanstack/react-query';
import { api, hasToken } from '../lib/api';
import { fewHostsOpen } from '../lib/fewHosts';

export function useMayHost(): boolean {
  const open = fewHostsOpen();
  const signedIn = hasToken();
  const { data } = useQuery({
    queryKey: ['me-hosting'],
    queryFn: () => api.hosting.get(),
    enabled: open && signedIn,
    staleTime: 60_000,
    retry: false,
  });
  return open && signedIn && Array.isArray(data?.doors) && data.doors.length > 0;
}
