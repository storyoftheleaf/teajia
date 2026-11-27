import { API_URL, authedFetch } from './api';

/** Make a collection from shop teas and get its link to send (anyone signed in). */
export function makeCollection(payload: { title: string; note?: string; product_ids: string[] }): Promise<{ id: string; slug: string; item_count: number; left_out: number }> {
  return authedFetch(`${API_URL}/api/me/collections/make`, { method: 'POST', body: JSON.stringify(payload) });
}
