/**
 * "Does anyone know this tea?" routes (worker/src/knowThisTea.ts), kept out of
 * api.ts, which is past its length ceiling. Shapes in
 * src/lib/knowThisTeaContract.ts.
 */
import { API_URL, authedFetch, fetchWithTimeout, handleResponse } from './api';
import { prepareFamilyPhotograph } from './familyPhotographSizes';
import type { KnowThisTeaAsked, KnowThisTeaManageItem, TeaTableQuestion } from './knowThisTeaContract';

const base = (id: string) => `${API_URL}/api/tea-table/questions/${encodeURIComponent(id)}`;
type Answer = Promise<{ question: TeaTableQuestion }>;

export const knowThisTeaApi = {
  /**
   * Put a question on the table. `photo` has already been through the photo
   * editor; both copies are made here, re-encoded so no camera details go.
   */
  ask: async (photo: File, whereFrom: string): Answer => {
    const { full, small } = await prepareFamilyPhotograph(photo);
    const form = new FormData();
    form.append('where_from', whereFrom);
    form.append('full', full, 'full.jpg');
    form.append('small', small, 'small.jpg');
    return authedFetch(`${API_URL}/api/tea-table/questions`, { method: 'POST', body: form });
  },
  /** One question on the table. The same for everyone. */
  one: async (id: string, signal?: AbortSignal): Answer =>
    handleResponse(await fetchWithTimeout(base(id), { signal, cache: 'no-store' })),
  /** What people told the asker. Answers only for the asker. */
  asked: (id: string): Promise<KnowThisTeaAsked> => authedFetch(`${base(id)}/asked`),
  takeOff: (id: string): Promise<{ on_table: false }> => authedFetch(base(id), { method: 'DELETE' }),
  tell: (id: string, input: { words: string; tea?: string; name_shown: boolean }): Promise<{ told: true }> =>
    authedFetch(`${base(id)}/note`, { method: 'PUT', body: JSON.stringify(input) }),
  name: (id: string, input: { name?: string; tea?: string }): Answer =>
    authedFetch(`${base(id)}/named`, { method: 'PUT', body: JSON.stringify(input) }),
  unname: (id: string): Answer => authedFetch(`${base(id)}/named`, { method: 'DELETE' }),
  thank: (id: string, noteId: string | null): Answer => noteId
    ? authedFetch(`${base(id)}/thanks`, { method: 'PUT', body: JSON.stringify({ note_id: noteId }) })
    : authedFetch(`${base(id)}/thanks`, { method: 'DELETE' }),
  manage: {
    list: (): Promise<{ items: KnowThisTeaManageItem[] }> => authedFetch(`${API_URL}/api/admin/tea-table/questions`),
    hide: (id: string, hidden: boolean): Promise<{ hidden: boolean }> =>
      authedFetch(`${API_URL}/api/admin/tea-table/questions/${encodeURIComponent(id)}/hide`, { method: 'POST', body: JSON.stringify({ hidden }) }),
  },
};
