import { API_URL, authedBlobFetch, authedFetch, type ApiRequestInit } from './api';
import { notifyCommerceChanged } from './refreshCommerce';

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
  blob: (entryId: string, photoId: string, expectedAuth: CapturePhotoAuth) =>
    authedBlobFetch(capturePhotoEndpoint(entryId, photoId), { expectedAuth, cache: 'no-store', reportIncident: false }),
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
