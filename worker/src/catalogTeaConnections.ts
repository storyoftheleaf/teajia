import type { TeaEditorialPacket } from '../../shared/catalog/teaEditorial';
import type { TeaConnection, TeaConnectionEdit, TeaIdentityFinding } from '../../shared/catalog/teaConnection';
import { customerTagList } from './customerContactHandles';

type Scope = { accountId: string; userId: string };
type IndexItem = { id: string; digest: string };
type StockRow = { id: string; vendor_id: string | null };
type ContactRow = { id: string; name: string; tags: string | null };
type PrivateState = { vendorId?: string | null; finding?: TeaIdentityFinding; version: number };

async function readStock(db: D1Database, accountId: string, locator: string, bySlug: boolean) {
  const query = bySlug
    ? 'SELECT id, vendor_id FROM products WHERE account_id = ? AND (id = ?2 OR slug = ?2) LIMIT 2'
    : 'SELECT id, vendor_id FROM products WHERE account_id = ? AND id = ?';
  const result = await db.prepare(query).bind(accountId, locator).all<StockRow>();
  return result.results.length === 1 ? result.results[0] : null;
}

function listingLocator(address: string) {
  try {
    const url = new URL(address, 'https://www.teajia.com');
    if (!['https://www.teajia.com', 'https://teajia.com'].includes(url.origin)) return null;
    return url.pathname.match(/^\/shop\/product\/([a-z0-9_-]+)\/?$/i)?.[1] ?? null;
  } catch {
    return null;
  }
}

async function hashKey(value: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

async function resolveTarget(request: Request, db: D1Database, bucket: R2Bucket, root: string, scope: Scope, items: IndexItem[]) {
  const params = new URL(request.url).searchParams;
  const view = params.get('view');
  const id = params.get('id');
  if (!id || id.length > 1024) return null;
  if (view === 'intake') {
    const entry = items.find(item => item.id === id);
    if (!entry || !/^[a-f0-9]{64}$/.test(entry.digest)) return null;
    const page = await bucket.get(root + 'pages/' + entry.digest + '.json');
    if (!page) return null;
    const { stockId } = await page.json<{ stockId?: string }>();
    const stock = stockId ? await readStock(db, scope.accountId, stockId, false) : null;
    // A missing or cross-account Stock row cannot become an intake assignment.
    if (stockId && !stock) return null;
    return { view, stock, revision: entry.digest, stateId: await hashKey('intake:' + id), canAssignVendor: true };
  }

  if (view !== 'editorial' && view !== 'holds' && view !== 'histories') return null;
  const object = await bucket.get(root + 'editorial.json');
  if (!object) return null;
  const packet = await object.json<TeaEditorialPacket>();
  if (view === 'editorial') {
    const passage = packet.passages.find(item => item.id === id);
    const stockId = passage?.id.match(/^lot-([a-f0-9-]{36})$/i)?.[1];
    if (passage?.kind !== 'Lot opening' || !stockId) return null;
    const stock = await readStock(db, scope.accountId, stockId, false);
    return stock ? { view, stock, revision: passage.revision, stateId: null, canAssignVendor: true } : null;
  }

  const item = (view === 'holds' ? packet.holds : packet.histories).find(citation => citation.url === id);
  if (!item) return null;
  const locator = listingLocator(item.url);
  const stock = locator ? await readStock(db, scope.accountId, locator, true) : null;
  // Evidence and its finding are private to the hold, even when it refers to a Stock lot.
  const stateId = view === 'holds' ? await hashKey('holds:' + id) : null;
  const revision = await hashKey(JSON.stringify(item));
  return { view, stock, revision, stateId, canAssignVendor: Boolean(stock) };
}

function readContact(db: D1Database, accountId: string, id: string | null, activeOnly = false) {
  if (!id) return Promise.resolve(null);
  const active = activeOnly ? ' AND deleted_at IS NULL AND archived_at IS NULL AND merged_into_id IS NULL' : '';
  return db.prepare('SELECT id, name, tags FROM customers WHERE account_id = ? AND id = ?' + active)
    .bind(accountId, id).first<ContactRow>();
}

function isEdit(input: unknown): input is TeaConnectionEdit {
  if (!input || typeof input !== 'object' || !('expected' in input) || !input.expected || typeof input.expected !== 'object') return false;
  if (!('action' in input)) return false;
  if (input.action === 'vendor') return 'vendorId' in input &&
    (input.vendorId === null || (typeof input.vendorId === 'string' && input.vendorId.length > 0 && input.vendorId.length <= 128));
  return input.action === 'finding' && 'text' in input && typeof input.text === 'string' && input.text.trim().length > 0
    && input.text.length <= 4000 && 'resolved' in input && typeof input.resolved === 'boolean';
}

/** Called after the private packet's owner and account checks. */
export async function serveTeaConnection(
  request: Request, db: D1Database, bucket: R2Bucket, root: string, scope: Scope, items: IndexItem[],
  reply: (status: number, body?: BodyInit | null) => Response,
) {
  const target = await resolveTarget(request, db, bucket, root, scope, items);
  if (!target) return reply(404);
  const stateKey = target.stateId ? root + 'connections/' + target.stateId + '.json' : null;
  const object = stateKey ? await bucket.get(stateKey) : null;
  const state = object ? await object.json<PrivateState>() : { version: 0 };
  const stockId = target.stock?.id ?? null;
  const vendorId = (target.stock ? target.stock.vendor_id : state.vendorId) || null;
  const vendor = await readContact(db, scope.accountId, vendorId);
  const snapshot: TeaConnection = {
    revision: target.revision, stockId, vendorId, vendor: vendor && { id: vendor.id, name: vendor.name },
    canAssignVendor: target.canAssignVendor, finding: state.finding ?? null, version: state.version,
  };

  if (request.method !== 'PUT') return reply(200, JSON.stringify(snapshot));
  if (!request.headers.get('Content-Type')?.includes('application/json')) return reply(415);
  if (Number(request.headers.get('content-length')) > 8192) return reply(413);
  const raw = await request.text();
  if (raw.length > 8192) return reply(413);
  let input: unknown;
  try { input = JSON.parse(raw); } catch { return reply(400); }
  if (!isEdit(input)) return reply(400);
  const { expected } = input;
  if (expected.revision !== snapshot.revision || expected.stockId !== stockId ||
      expected.vendorId !== vendorId || expected.version !== state.version) return reply(409);

  if (input.action === 'vendor') {
    if (!target.canAssignVendor) return reply(404);
    if (input.vendorId === vendorId) return reply(200, JSON.stringify(snapshot));
    const picked = await readContact(db, scope.accountId, input.vendorId, true);
    if (input.vendorId && (!picked || !customerTagList(picked.tags).some(tag => tag.trim().toLowerCase() === 'vendor'))) return reply(400);
    snapshot.vendorId = input.vendorId;
    snapshot.vendor = picked && { id: picked.id, name: picked.name };
    if (target.stock) {
      // Keep the private Stock display label and its People ID in sync.
      const saved = await db.prepare(
        `UPDATE products SET vendor_id = ?1, vendor = ?2
          WHERE account_id = ?3 AND id = ?4 AND NULLIF(vendor_id, '') IS ?5
            AND (?1 IS NULL OR EXISTS (
              SELECT 1 FROM customers c WHERE c.id = ?1 AND c.account_id = ?3
                AND c.name = ?2 AND c.tags IS ?6
                AND c.deleted_at IS NULL AND c.archived_at IS NULL AND c.merged_into_id IS NULL
            ))`,
      ).bind(input.vendorId, picked?.name ?? null, scope.accountId, target.stock.id, vendorId, picked?.tags ?? null).run();
      return saved.meta.changes === 1 ? reply(200, JSON.stringify(snapshot)) : reply(409);
    }
    state.vendorId = input.vendorId;
  } else {
    if (target.view !== 'holds') return reply(404);
    const finding = { text: input.text.trim(), resolved: input.resolved };
    if (state.finding?.text === finding.text && state.finding.resolved === finding.resolved) return reply(200, JSON.stringify(snapshot));
    state.finding = finding;
    snapshot.finding = finding;
  }

  if (!stateKey) return reply(404);
  snapshot.version = ++state.version;
  const saved = await bucket.put(stateKey, JSON.stringify(state), {
    onlyIf: object ? { etagMatches: object.etag } : { etagDoesNotMatch: '*' },
    httpMetadata: { contentType: 'application/json', cacheControl: 'private, no-store' },
  });
  return saved ? reply(200, JSON.stringify(snapshot)) : reply(409);
}
