import { API_URL, authedFetch, fetchWithTimeout, hasSession } from './api';
import type { SendRecord, SendSummary } from '../admin/types';

/** A small public POST that says who is signed in when someone is. */
async function optionallyAuthedPost(url: string, body: unknown): Promise<void> {
  const init = { method: 'POST', body: JSON.stringify(body), background: true, reportIncident: false } as const;
  if (hasSession()) { await authedFetch(url, init); return; }
  await fetchWithTimeout(url, { ...init, headers: { 'Content-Type': 'application/json' } });
}

/** What happened to a sent invoice or collection link: worker/src/sendRecords.ts. */
export const sendsApi = {
  /** A tea on a sent link was opened. Best-effort, never throws. */
  teaOpened(link: { kind: 'collection'; slug: string } | { kind: 'invoice'; t: string }, tea: string): void {
    optionallyAuthedPost(`${API_URL}/api/public/link-tea-opened`, { ...link, tea }).catch(() => { /* a record is never worth an error */ });
  },
  list(params: { kind?: 'invoice' | 'collection'; q?: string; limit?: number } = {}): Promise<{ sends: SendSummary[] }> {
    const search = new URLSearchParams();
    if (params.kind) search.set('kind', params.kind);
    if (params.q) search.set('q', params.q);
    if (params.limit) search.set('limit', String(params.limit));
    return authedFetch(`${API_URL}/api/admin/sends${search.size ? `?${search}` : ''}`);
  },
  get(kind: 'invoice' | 'collection', id: string): Promise<SendRecord> {
    return authedFetch(`${API_URL}/api/admin/sends/${kind}/${encodeURIComponent(id)}`);
  },
};
