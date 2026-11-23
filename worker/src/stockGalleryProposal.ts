// A proposed gallery is one immutable private object. Its ordered byte ranges
// are metadata on that object, so readers can never see a partial gallery.
import { sha256Hex } from './inquiryDomain';

const PREFIX = '/api/admin/stock-gallery/';
const UUID = /^(?:[a-f0-9]{32}|[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12})$/i;
const HASH = /^[a-f0-9]{64}$/;
const MAX_PHOTO = 6 * 1024 * 1024;
const MAX_PHOTOS = 4;
type Slot = { sha256: string; length: number; type: string };
type Scope = { accountId: string; userId: string };
type Env = { DB: D1Database; ATLAS_BUCKET?: R2Bucket };

function privateResponse(body: BodyInit | null, status: number, type = 'application/json') {
  return new Response(body, { status, headers: {
    'Content-Type': type, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
  } });
}
function failure(message: string, status: number) {
  return privateResponse(JSON.stringify({ error: message }), status);
}

async function stage(request: Request, bucket: R2Bucket, prefix: string, stockId: string) {
  const length = request.headers.get('content-length');
  if (!length || !/^\d+$/.test(length)) return failure('A fixed upload size is required.', 411);
  if (Number(length) > MAX_PHOTO * MAX_PHOTOS + 64 * 1024) return failure('Gallery exceeds the size limit.', 413);
  if (!request.headers.get('content-type')?.startsWith('multipart/form-data;')) return failure('Upload ordered JPEG files.', 415);
  let form: FormData;
  try { form = await request.formData(); } catch { return failure('Invalid gallery upload.', 400); }
  const files = form.getAll('photo') as Array<string | File>;
  if (!files.length || files.length > MAX_PHOTOS) return failure('Choose one to four JPEG files.', 400);
  const slots: Slot[] = [];
  const images: ArrayBuffer[] = [];
  for (const file of files) {
    if (typeof file === 'string' || file.type !== 'image/jpeg') return failure('Each photo must be a JPEG.', 415);
    if (file.size > MAX_PHOTO) return failure('Each photo must be at most 6 MiB.', 413);
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff || bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) {
      return failure('Invalid JPEG file.', 415);
    }
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', buffer));
    const sha256 = Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
    if (slots.some(slot => slot.sha256 === sha256)) return failure('A photo appears twice.', 400);
    slots.push({ sha256, length: file.size, type: 'image/jpeg' });
    images.push(buffer);
  }
  const metadata = JSON.stringify(slots);
  const id = await sha256Hex(metadata);
  const key = prefix + id;
  let created = false;
  if (!await bucket.head(key)) {
    created = !!await bucket.put(key, new Blob(images), {
      onlyIf: { etagDoesNotMatch: '*' }, customMetadata: { slots: metadata },
      httpMetadata: { contentType: 'application/octet-stream' },
    });
  }
  return privateResponse(JSON.stringify({ id, stockId, photos: slots,
    previewPath: '/admin/stock/gallery-proposals/' + stockId + '/' + id }), created ? 201 : 200);
}

export async function serveStockGalleryProposal(
  request: Request, env: Env, getAccount: () => Promise<Scope | { error: Response }>,
) {
  const scope = await getAccount();
  if ('error' in scope) return privateResponse(scope.error.body, scope.error.status);
  const member = await env.DB.prepare(
    `SELECT 1 FROM account_members m JOIN accounts a ON a.id=m.account_id JOIN users u ON u.id=m.user_id
     WHERE m.user_id=? AND m.account_id=? AND m.status='active' AND a.status='active'
       AND (m.role='owner' OR u.platform_role='platform_owner')`,
  ).bind(scope.userId, scope.accountId).first();
  if (!member) return failure('Shop owner access required.', 403);
  const [stockId, proposalId, slotNumber, ...extra] = new URL(request.url).pathname.slice(PREFIX.length).split('/');
  if (!UUID.test(stockId) || extra.length || (proposalId !== undefined && !HASH.test(proposalId))) return failure('Proposal unavailable.', 404);
  const row = await env.DB.prepare(
    'SELECT product_name, given_name FROM products WHERE id=? AND account_id=?',
  ).bind(stockId, scope.accountId).first<{ product_name: string; given_name: string | null }>();
  if (!row) return failure('Stock item unavailable.', 404);
  const bucket = env.ATLAS_BUCKET;
  if (!bucket) return failure('Private media storage unavailable.', 503);
  const prefix = 'stock-gallery-proposals/' + scope.accountId + '/' + stockId + '/';
  if (request.method === 'POST' && proposalId === undefined) return stage(request, bucket, prefix, stockId);
  if (proposalId === undefined && ['GET', 'HEAD'].includes(request.method)) {
    return privateResponse(request.method === 'HEAD' ? null : JSON.stringify({ stockId,
      name: row.given_name || row.product_name, productName: row.product_name, photos: [] }), 200);
  }
  if (!proposalId || !['GET', 'HEAD'].includes(request.method)) return failure('Method unavailable.', 405);
  const key = prefix + proposalId;
  const entry = await bucket.head(key);
  if (!entry?.customMetadata?.slots) return failure('Proposal unavailable.', 404);
  const slots: Slot[] = JSON.parse(entry.customMetadata.slots);
  const head = request.method === 'HEAD';
  if (slotNumber === undefined) {
    return privateResponse(head ? null : JSON.stringify({ stockId, name: row.given_name || row.product_name,
      productName: row.product_name, id: proposalId, photos: slots }), 200);
  }
  if (!/^[1-4]$/.test(slotNumber) || Number(slotNumber) > slots.length) return failure('Photo unavailable.', 404);
  const index = Number(slotNumber) - 1;
  const slot = slots[index];
  if (head) return privateResponse(null, 200, slot.type);
  const offset = slots.slice(0, index).reduce((sum, previous) => sum + previous.length, 0);
  const object = await bucket.get(key, { range: { offset, length: slot.length } });
  return object ? privateResponse(object.body, 200, slot.type) : failure('Photo unavailable.', 404);
}
