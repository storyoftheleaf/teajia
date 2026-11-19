import { API_URL, authedBlobFetch, authedFetch, type ApiRequestInit } from './api';
import type { SquarePhotoFrame } from './cropImage';
import { notifyCommerceChanged } from './refreshCommerce';

export type CapturePhotoFrame = SquarePhotoFrame;
export type CapturePhotoAuth = NonNullable<ApiRequestInit['expectedAuth']>;
export type CaptureShopPhotoReview = { product_id: string; name: string; live: boolean; snapshot: Record<string, unknown> };

const capturePhotoEndpoint = (entryId: string, photoId: string) =>
  `${API_URL}/api/curate/capture/${encodeURIComponent(entryId)}/photos/${encodeURIComponent(photoId)}`;

export const capturePhotoApi = {
  upload: async (entryId: string, file: File | Blob, expectedAuth: CapturePhotoAuth): Promise<string> => {
    const form = new FormData();
    form.append('file', file, file instanceof File ? file.name : 'photo.jpg');
    const result = await authedFetch(capturePhotoEndpoint(entryId, crypto.randomUUID()), {
      method: 'POST', body: form, expectedAuth,
    });
    return result.url;
  },
  blob: (entryId: string, photoId: string, expectedAuth: CapturePhotoAuth, original = false) =>
    authedBlobFetch(capturePhotoEndpoint(entryId, photoId) + (original ? '?original=1' : ''), { expectedAuth, cache: 'no-store', reportIncident: false }),
  frame: (entryId: string, photoId: string, expectedAuth: CapturePhotoAuth): Promise<{ frame: CapturePhotoFrame | null }> =>
    authedFetch(capturePhotoEndpoint(entryId, photoId) + '/frame', { expectedAuth, cache: 'no-store' }),
  saveFrame: (entryId: string, photoId: string, file: Blob, frame: CapturePhotoFrame, expectedAuth: CapturePhotoAuth): Promise<{ ok: true }> => {
    const data = new FormData();
    data.append('file', file, 'square-preview.jpg');
    data.append('frame', JSON.stringify(frame));
    return authedFetch(capturePhotoEndpoint(entryId, photoId) + '/frame', { method: 'PUT', body: data, expectedAuth });
  },
  stockBlob: (approvalId: string, expectedAuth: CapturePhotoAuth) =>
    authedBlobFetch(`${API_URL}/api/curate/shop-photos/${encodeURIComponent(approvalId)}`, { expectedAuth, cache: 'no-store', reportIncident: false }),
  review: (entryId: string, photoId: string, expectedAuth: CapturePhotoAuth): Promise<CaptureShopPhotoReview> =>
    authedFetch(`${capturePhotoEndpoint(entryId, photoId)}/shop-review`, { expectedAuth, cache: 'no-store' }),
  approve: async (entryId: string, photoId: string, review: CaptureShopPhotoReview, approvalId: string, expectedAuth: CapturePhotoAuth) => {
    const result = await authedFetch(`${capturePhotoEndpoint(entryId, photoId)}/shop-review`, {
      expectedAuth, retryTimeouts: true, method: 'POST',
      body: JSON.stringify({ approval_id: approvalId, product_id: review.product_id, snapshot: review.snapshot }),
    });
    notifyCommerceChanged(expectedAuth.accountId, false, [review.product_id]);
    return result;
  },
};
