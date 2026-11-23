import { API_URL, authedBlobFetch, authedFetch, type ApiRequestInit } from '../../../lib/api';

export const BASE = '/admin/yixing';
export const KINDS = ['clay', 'color', 'shape'] as const;
export type Kind = typeof KINDS[number];
export type Auth = NonNullable<ApiRequestInit['expectedAuth']>;
export type Entry = {
  id: string; kind: Kind; name: string; chinese?: string; status: string; summary: string;
  sources: { title: string; url: string; locator?: string }[]; cues?: string[];
};
export type Pot = {
  id: string; name: string; observation: string; clayLead?: { label: string; note: string };
  comparisonIds: string[]; photos: { role: string; sha256: string; originalSha256: string }[];
  listing: { name: string; form?: string; mark?: string; description?: string };
};
export type ShapeEvidence = {
  formId: string; asset: string; chinese: string; pinyin: string; title: string; recordUrl: string;
  verdict: 'confirmed' | 'rejected';
};
export type ShapeAction = 'confirm' | 'reject' | 'withdraw';
export type Decision = Record<Kind, string> & {
  note: string; revision: number; rejectedClays?: string[];
  confirmedShape?: ShapeEvidence; rejectedShapes?: Record<string, ShapeEvidence>;
};
export type ClayAction = 'approve' | 'deny' | 'undo';
export type ChangeClay = (potId: string, clayId: string, action: ClayAction, revision: number) => Promise<Decision>;
export type ShapeChange = { formId: string; asset: string; action: ShapeAction; revision: number };
export type ChangeShape = (potId: string, change: ShapeChange) => Promise<Decision>;
export type Board = {
  reference: { title: string; scope: string; entries: Entry[] };
  pots: Pot[]; decisions: Record<string, Decision>;
};
export const EMPTY: Decision = { clay: '', color: '', shape: '', note: '', revision: 0 };
const api = API_URL + '/api/admin/yixing';
const options = (auth: Auth): ApiRequestInit => ({ expectedAuth: auth, cache: 'no-store', reportIncident: false });
export const loadBoard = (auth: Auth, signal: AbortSignal): Promise<Board> =>
  authedFetch(api, { ...options(auth), signal });
export const canReview = async (auth: Auth, signal: AbortSignal) => {
  await authedBlobFetch(api, { ...options(auth), method: 'HEAD', signal });
  return true;
};
export const loadPhoto = (hash: string, auth: Auth, signal: AbortSignal) =>
  authedBlobFetch(api + '/media/' + encodeURIComponent(hash) + '.jpg', { ...options(auth), signal });
export const saveReview = (id: string, { clay, color, shape, note, revision, rejectedClays }: Decision, auth: Auth): Promise<Decision> =>
  authedFetch(api + '/pots/' + encodeURIComponent(id), {
    ...options(auth), method: 'PUT', body: JSON.stringify({ clay, color, shape, note, revision, rejectedClays }),
  });
export const saveShapeVerdict = (id: string, change: ShapeChange, auth: Auth): Promise<Decision> =>
  authedFetch(api + '/pots/' + encodeURIComponent(id) + '/shape-verdict', {
    ...options(auth), method: 'PUT', retryTimeouts: false, body: JSON.stringify(change),
  });
export const shapeEvidenceName = (shape: ShapeEvidence) => [shape.chinese, shape.pinyin].filter(Boolean).join(' · ');
export const potPath = (id: string) => BASE + '/' + encodeURIComponent(id);
export function guidePath(pot?: Pot, anchor?: string, fromListing = false) {
  const params = new URLSearchParams();
  if (pot) params.set('pot', pot.id);
  if (fromListing) params.set('from', 'listing');
  return BASE + '/wisdom' + (params.size ? '?' + params : '') + (anchor ? '#' + encodeURIComponent(anchor) : '');
}
