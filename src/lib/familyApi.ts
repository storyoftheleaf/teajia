/**
 * Teajia family: member photographs, covers, sharing, restock requests,
 * reports and the shop's side of them. Routes in worker/src/familyRoutes.ts;
 * the shapes and limits in src/lib/familyContract.ts. Make both photograph
 * copies with `prepareFamilyPhotograph` (src/lib/familyPhotographSizes.ts).
 * Nothing here ever carries a score.
 *
 * Kept out of api.ts, which is past its length ceiling
 * (src/admin/guards/driftCeilings.test.ts). Import it from here.
 */
import { API_URL, authedBlobFetch, authedFetch, fetchWithTimeout, handleResponse } from './api';
import type { FamilyFeedbackNote, FamilySheetRange, FamilyMyTea, FamilyOfferedPhotograph, FamilyPageTier, FamilyPhotoPage, FamilyPhotograph, FamilyReport, FamilyRestockRequest, FamilyShareState, FamilyShopUse, FamilyTargetKind, FamilyTeaPhotographs, FamilyPhotographShape, FamilyPhotographFrame } from './familyContract';

import { prepareFamilyPhotograph } from './familyPhotographSizes';

export async function addProductPhotograph(productId: string, file: File, page?: FamilyPhotoPage) {
  const { full, small } = await prepareFamilyPhotograph(file);
  return familyApi.uploadPhotograph({ productId, full, small, page });
}

export const familyApi = {
  /** Both copies of one photograph of a shop tea. `page` is the tasting page it was taken on. */
  uploadPhotograph: (input: { productId: string; full: Blob; small: Blob; page?: FamilyPhotoPage }): Promise<{ photograph: FamilyPhotograph; remaining: number }> => {
    const form = new FormData();
    form.append('product_id', input.productId);
    form.append('full', input.full, 'full.jpg');
    form.append('small', input.small, 'small.jpg');
    if (input.page) form.append('page', input.page);
    return authedFetch(`${API_URL}/api/family/photographs`, { method: 'POST', body: form });
  },
  /** The member's own photographs, cover and share state for one tea. */
  myTea: (productId: string): Promise<FamilyMyTea> =>
    authedFetch(`${API_URL}/api/family/teas/${encodeURIComponent(productId)}/mine`),
  /** Make one of the member's photographs their cover for this tea; null clears it. Only they see it. */
  setCover: (productId: string, photographId: string | null): Promise<{ product_id: string; cover_photograph_id: string | null }> =>
    authedFetch(`${API_URL}/api/family/teas/${encodeURIComponent(productId)}/cover`, { method: 'PUT', body: JSON.stringify({ photograph_id: photographId }) }),
  /** One photograph's own share choice. */
  setPhotographShare: (photographId: string, shareState: FamilyShareState): Promise<{ photograph: FamilyPhotograph }> =>
    authedFetch(`${API_URL}/api/family/photographs/${encodeURIComponent(photographId)}/share`, { method: 'PUT', body: JSON.stringify({ share_state: shareState }) }),
  /** How the author wants one photograph shown: square, upright (2:3) or across (3:2). */
  setPhotographShape: (photographId: string, shape: FamilyPhotographShape, frame: FamilyPhotographFrame | null = null): Promise<{ photograph: FamilyPhotograph }> =>
    authedFetch(`${API_URL}/api/family/photographs/${encodeURIComponent(photographId)}/shape`, { method: 'PUT', body: JSON.stringify({ shape, frame }) }),
  /** "Remove from my page". The shop keeps what was offered to it. */
  removePhotograph: (photographId: string): Promise<{ id: string; removed: true }> =>
    authedFetch(`${API_URL}/api/family/photographs/${encodeURIComponent(photographId)}/remove`, { method: 'POST' }),
  /** The Share step after Save: the tasting and its photographs together. Save the tasting first. */
  shareTasting: (productId: string, shareState: FamilyShareState): Promise<{ product_id: string; journal_entry_id: string; share_state: FamilyShareState; photographs_updated: number; page_id: string | null; page_path: string | null; page_created: boolean }> =>
    authedFetch(`${API_URL}/api/family/teas/${encodeURIComponent(productId)}/share`, { method: 'PUT', body: JSON.stringify({ share_state: shareState }) }),
  /** What a public tea page shows: the lead picture, placed photographs and "From the family". No sign-in needed. */
  teaPhotographs: async (productId: string): Promise<FamilyTeaPhotographs> =>
    handleResponse(await fetchWithTimeout(`${API_URL}/api/family/teas/${encodeURIComponent(productId)}/photographs`)),
  /** "Find me more" on a sold-out tea. */
  requestRestock: (productId: string, note?: string): Promise<{ product_id: string; requested: true; already_asked: boolean }> =>
    authedFetch(`${API_URL}/api/family/teas/${encodeURIComponent(productId)}/restock-request`, { method: 'POST', body: JSON.stringify({ note: note ?? null }) }),
  /** A visitor's report. Works signed out. */
  report: async (input: { target_kind: FamilyTargetKind; target_id: string; reason?: string }): Promise<{ received: true }> =>
    handleResponse(await fetchWithTimeout(`${API_URL}/api/family/reports`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
    })),
  /** A voice note from a member: up to two minutes. Staff keep using `api.transcribeAudio`. */
  transcribeVoiceNote: (audio: Blob, durationSeconds: number): Promise<{ text: string; recording_id: string; raw_text?: string }> => {
    const form = new FormData();
    const ext = audio.type.includes('mp4') ? 'mp4' : audio.type.includes('wav') ? 'wav' : 'webm';
    form.append('file', audio, `recording.${ext}`);
    form.append('duration_seconds', String(Math.round(durationSeconds)));
    return authedFetch(`${API_URL}/api/transcribe`, { method: 'POST', body: form });
  },

  shop: {
    /** The owner's word for a person: Teajia family, Tea creator or Tea master. The page itself does not change. */
    setPageTier: (contributorId: string, tier: FamilyPageTier): Promise<{ id: string; page_tier: FamilyPageTier; word: string; pay: boolean }> =>
      authedFetch(`${API_URL}/api/admin/family/pages/${encodeURIComponent(contributorId)}/tier`, { method: 'PUT', body: JSON.stringify({ tier }) }),
    /** The owner's hand on the people list: name a founding member, or pin a person to the top of their group. */
    setListPlace: (contributorId: string, place: { founding?: boolean; pinned?: boolean }): Promise<{ id: string; founding: boolean; pinned: boolean }> =>
      authedFetch(`${API_URL}/api/admin/family/pages/${encodeURIComponent(contributorId)}/list`, { method: 'PUT', body: JSON.stringify(place) }),
    /** Every photograph ever offered to the shop, newest first. */
    offered: (): Promise<{ photographs: Array<FamilyOfferedPhotograph & { hidden: boolean }> }> =>
      authedFetch(`${API_URL}/api/admin/family/photographs`),
    /** place: show on the tea page; lead: the tea's lead picture; pass: decline; restore: undo the last of these. */
    decide: (photographId: string, action: 'place' | 'lead' | 'pass' | 'restore'): Promise<{ id: string; product_id: string; shop_use: FamilyShopUse }> =>
      authedFetch(`${API_URL}/api/admin/family/photographs/${encodeURIComponent(photographId)}/${action}`, { method: 'POST' }),
    hide: (target: { target_kind: FamilyTargetKind; target_id: string }): Promise<{ hidden: true }> =>
      authedFetch(`${API_URL}/api/admin/family/hide`, { method: 'POST', body: JSON.stringify(target) }),
    unhide: (target: { target_kind: FamilyTargetKind; target_id: string }): Promise<{ hidden: false }> =>
      authedFetch(`${API_URL}/api/admin/family/unhide`, { method: 'POST', body: JSON.stringify(target) }),
    reports: (status: FamilyReport['status'] = 'open'): Promise<{ reports: FamilyReport[] }> =>
      authedFetch(`${API_URL}/api/admin/family/reports?status=${encodeURIComponent(status)}`),
    dismissReport: (reportId: string): Promise<{ id: string; status: 'dismissed' }> =>
      authedFetch(`${API_URL}/api/admin/family/reports/${encodeURIComponent(reportId)}/dismiss`, { method: 'POST' }),
    restockRequests: (status: FamilyRestockRequest['status'] = 'open'): Promise<{ requests: FamilyRestockRequest[] }> =>
      authedFetch(`${API_URL}/api/admin/family/restock-requests?status=${encodeURIComponent(status)}`),
    /** Every note about the shop's teas, with the member's impression and score. Owner only. */
    feedback: (): Promise<{ notes: FamilyFeedbackNote[] }> =>
      authedFetch(`${API_URL}/api/admin/family/feedback`),
    /** The day's notes and ratings as a CSV file to save. A download, not a scheduled job. */
    sheet: (range: FamilySheetRange): Promise<Blob> =>
      authedBlobFetch(`${API_URL}/api/admin/family/sheet?day=${encodeURIComponent(range.day)}&from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`),
    answerRestock: (requestId: string): Promise<{ id: string; status: 'answered' }> =>
      authedFetch(`${API_URL}/api/admin/family/restock-requests/${encodeURIComponent(requestId)}/answer`, { method: 'POST' }),
  },
};
