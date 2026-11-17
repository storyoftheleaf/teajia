import { COMPASS_SAMPLE_HOLDING } from './compassHoldings';

const CAPTURE_PREFIX = '/api/curate/capture/';
const SHOP_PREFIX = 'https://media.teajia.co/curate-approved/';
const ENTRY_ID = /^[A-Za-z0-9_-]{1,120}$/;
const PHOTO_ID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

type PhotoScope = { accountId: string; userId: string };
type PhotoEnv = { DB: D1Database; ATLAS_BUCKET?: R2Bucket };
type Approval = { id: string; account_id: string; product_id: string; entry_id: string; photo_id: string; approved_by_user_id: string };

export const validCaptureEntryId = (id: string) => ENTRY_ID.test(id);
export const validCapturePhotoId = (id: string) => PHOTO_ID.test(id);
export const capturePhotoPath = (entryId: string, photoId: string) => `${CAPTURE_PREFIX}${entryId}/photos/${photoId}`;
export const shopPhotoUrl = (approvalId: string) => SHOP_PREFIX + approvalId;
export function shopPhotoApprovalId(url?: string | null) {
  const id = url?.startsWith(SHOP_PREFIX) ? url.slice(SHOP_PREFIX.length) : '';
  return validCapturePhotoId(id) ? id : null;
}

const captureObjectKey = (accountId: string, entryId: string, photoId: string) =>
  `curate/capture/${encodeURIComponent(accountId)}/${entryId}/${photoId}`;

export async function captureEntry(db: D1Database, entryId: string) {
  return db.prepare('SELECT id, account_id, user_id, photos, draft_product_id, deleted_at, archived_at, merged_into_id FROM tea_compass_entries WHERE id = ?')
    .bind(entryId).first<{ id: string; account_id: string; user_id: string; photos: string; draft_product_id: string | null; deleted_at: string | null; archived_at: string | null; merged_into_id: string | null }>();
}

export function captureEntryAllowed(entry: Awaited<ReturnType<typeof captureEntry>>, scope: PhotoScope, manager: boolean) {
  return !!entry && entry.account_id === scope.accountId && !entry.deleted_at && !entry.archived_at && !entry.merged_into_id
    && (entry.user_id === scope.userId || manager);
}

function photoList(value: string | null): string[] {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed.filter(photo => typeof photo === 'string') : [];
  } catch { return []; }
}

export async function storeCapturePhoto(env: PhotoEnv, scope: PhotoScope, entryId: string, photoId: string, file: File) {
  const bucket = env.ATLAS_BUCKET!;
  const key = captureObjectKey(scope.accountId, entryId, photoId);
  const bytes = await file.arrayBuffer();
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
  const stored = await bucket.put(key, bytes, {
    onlyIf: { etagDoesNotMatch: '*' },
    httpMetadata: { contentType: file.type },
    customMetadata: { uploader: scope.userId, sha256: digest },
  });
  if (stored) return 201;
  const existing = await bucket.head(key);
  return existing?.customMetadata?.uploader === scope.userId
    && existing.customMetadata.sha256 === digest && existing.httpMetadata?.contentType === file.type ? 200 : 409;
}

export async function privateCapturePhoto(env: PhotoEnv, scope: PhotoScope, entryId: string, photoId: string, manager: boolean) {
  const entry = await captureEntry(env.DB, entryId);
  if (entry && !captureEntryAllowed(entry, scope, manager)) return null;
  const object = await env.ATLAS_BUCKET?.get(captureObjectKey(scope.accountId, entryId, photoId));
  // Newly captured images can be previewed while an offline draft is syncing.
  // Until the photo is on the tea, only the uploading operator can read it.
  if (!object || (object.customMetadata?.uploader !== scope.userId && !photoList(entry?.photos ?? null).includes(capturePhotoPath(entryId, photoId)))) return null;
  return object;
}

export function capturePhotoResponse(object: R2ObjectBody | null, head = false): Response {
  const type = object?.httpMetadata?.contentType;
  const headers = {
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  };
  if (!object || !type || !IMAGE_TYPES.has(type)) return new Response(null, { status: 404, headers });
  return new Response(head ? null : object.body, { headers: { ...headers, 'Content-Type': type, 'Content-Length': String(object.size) } });
}

export async function loadCapturePhotoReview(env: PhotoEnv, scope: PhotoScope, entryId: string, photoId: string, manager: boolean) {
  const entry = await captureEntry(env.DB, entryId);
  if (!captureEntryAllowed(entry, scope, manager) || !photoList(entry!.photos).includes(capturePhotoPath(entryId, photoId))) return null;
  if (!await env.ATLAS_BUCKET?.head(captureObjectKey(scope.accountId, entryId, photoId))) return null;
  const product = await env.DB.prepare(`SELECT p.id, p.product_name, p.given_name, p.image_url, p.additional_images,
      p.is_public, p.shown_in_shop, p.status, p.updated_at, a.public_enabled, a.status AS account_status
    FROM products p JOIN accounts a ON a.id = p.account_id
    WHERE p.account_id = ? AND p.id = COALESCE(?, (SELECT id FROM products WHERE account_id = ? AND source_compass_entry_id = ?
      ORDER BY ${COMPASS_SAMPLE_HOLDING} LIMIT 1))
      AND (p.source_compass_entry_id IS NULL OR p.source_compass_entry_id = ?) AND p.status IS NOT 'Archived'`)
    .bind(scope.accountId, entry!.draft_product_id, scope.accountId, entryId, entryId)
    .first<{ id: string; product_name: string; given_name: string | null; image_url: string | null; additional_images: string | null; is_public: number; shown_in_shop: number; status: string; updated_at: string | null; public_enabled: number; account_status: string }>();
  if (!product) return null;
  const { id, ...snapshot } = product;
  return {
    product_id: id,
    name: snapshot.given_name || snapshot.product_name,
    live: snapshot.is_public === 1 && snapshot.shown_in_shop === 1 && ['Active', 'Sold Out'].includes(snapshot.status)
      && snapshot.public_enabled === 1 && snapshot.account_status === 'active',
    snapshot,
  };
}

type Review = NonNullable<Awaited<ReturnType<typeof loadCapturePhotoReview>>>;

export function prepareCaptureApproval(env: PhotoEnv, scope: PhotoScope, entryId: string, photoId: string, approvalId: string, review: Review, manager: boolean) {
  const { product_id, snapshot } = review;
  const hasApproval = 'EXISTS (SELECT 1 FROM capture_shop_photo_approvals WHERE id = ? AND account_id = ? AND approved_by_user_id = ?)';
  const approvalBinds = [approvalId, scope.accountId, scope.userId];
  const url = shopPhotoUrl(approvalId);
  const now = new Date().toISOString();
  return [
    env.DB.prepare(`INSERT OR IGNORE INTO capture_shop_photo_approvals (id, account_id, product_id, entry_id, photo_id, approved_by_user_id)
      SELECT ?, p.account_id, p.id, e.id, ?, ? FROM products p JOIN accounts a ON a.id = p.account_id
      JOIN tea_compass_entries e ON e.account_id = p.account_id
      WHERE p.id = ? AND p.account_id = ? AND e.id = ? AND (e.user_id = ? OR ? = 1)
        AND p.id = COALESCE(e.draft_product_id, (SELECT id FROM products WHERE account_id = e.account_id
          AND source_compass_entry_id = e.id ORDER BY ${COMPASS_SAMPLE_HOLDING} LIMIT 1))
        AND (p.source_compass_entry_id IS NULL OR p.source_compass_entry_id = e.id)
        AND e.deleted_at IS NULL AND e.archived_at IS NULL AND e.merged_into_id IS NULL
        AND EXISTS (SELECT 1 FROM json_each(CASE WHEN json_valid(e.photos) THEN e.photos ELSE '[]' END) WHERE value = ?)
        AND p.product_name IS ? AND p.given_name IS ? AND p.image_url IS ? AND p.additional_images IS ?
        AND p.updated_at IS ? AND p.is_public IS ? AND p.shown_in_shop IS ? AND p.status IS ?
        AND a.public_enabled IS ? AND a.status IS ?`).bind(approvalId, photoId, scope.userId, product_id, scope.accountId, entryId, scope.userId, Number(manager),
      capturePhotoPath(entryId, photoId), snapshot.product_name, snapshot.given_name, snapshot.image_url, snapshot.additional_images, snapshot.updated_at,
      snapshot.is_public, snapshot.shown_in_shop, snapshot.status, snapshot.public_enabled, snapshot.account_status),
    env.DB.prepare(`UPDATE products SET image_url = ?, updated_at = ? WHERE id = ? AND account_id = ?
      AND changes() = 1 AND ${hasApproval}`).bind(url, now, product_id, scope.accountId, ...approvalBinds),
  ];
}

export async function captureApproval(env: PhotoEnv, id: string) {
  return env.DB.prepare('SELECT * FROM capture_shop_photo_approvals WHERE id = ?').bind(id).first<Approval>();
}

export async function approvedCapturePhoto(env: PhotoEnv, approvalId: string, accountId?: string) {
  const url = shopPhotoUrl(approvalId);
  const row = await env.DB.prepare(`SELECT approval.* FROM capture_shop_photo_approvals approval
    JOIN products p ON p.id = approval.product_id AND p.account_id = approval.account_id
    JOIN accounts a ON a.id = p.account_id
    WHERE approval.id = ? AND p.image_url = ?
      AND ${accountId ? 'p.account_id = ?' : "a.status = 'active' AND a.public_enabled = 1 AND p.is_public = 1 AND p.shown_in_shop = 1 AND p.status IN ('Active', 'Sold Out')"}`)
    .bind(approvalId, url, ...(accountId ? [accountId] : [])).first<Approval>();
  return row ? (await env.ATLAS_BUCKET?.get(captureObjectKey(row.account_id, row.entry_id, row.photo_id))) ?? null : null;
}
