// Launch 5, M6 part two: a host's own assistant key (src/lib/hostTokens.ts).
// Reached as api.hostTokens. Every route answers 404 until both switches
// open, and to anyone who may not host. The secret comes back from make()
// once and is never listed.
import type { HostTokenList, HostTokenMinted } from './hostTokens';

interface HostTokensApiDependencies {
  apiUrl: string;
  authedFetch: (url: string, init?: RequestInit) => Promise<any>;
}

export function createHostTokensApi({ apiUrl, authedFetch }: HostTokensApiDependencies) {
  const base = `${apiUrl}/api/me/assistant-tokens`;
  return {
    list: (): Promise<HostTokenList> => authedFetch(base),
    make: (label: string): Promise<HostTokenMinted> =>
      authedFetch(base, { method: 'POST', body: JSON.stringify({ label }) }),
    /** Disconnect one of the host's own keys. The assistant stops working at once. */
    revoke: (id: string): Promise<{ ok: true }> =>
      authedFetch(`${base}/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  };
}
