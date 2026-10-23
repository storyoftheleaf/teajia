/** A deliberately separate capability: never a user login or a refresh token. */
export const LIBRARY_PREVIEW_ORIGIN = 'http://127.0.0.1:7789';
const BASE = '/api/dev/library-preview';
const TTL = 8 * 60 * 60 * 1000;
type Owner = { userId: string; accountId: string; sessionVersion: number };
type Dependencies = { DB: D1Database; owner: (request: Request) => Promise<Owner | Response> };
type Grant = { id: string; user_id: string; account_id: string; session_version: number; origin: string; challenge: string; code_expires_at: number; expires_at: number; revoked_at: number | null; consumed_at: number | null };
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
const fail = () => response({ error: 'Library preview access unavailable or expired' }, 403);
const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const random = () => base64url(crypto.getRandomValues(new Uint8Array(32)));
const hash = async (value: string) => base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))));
const bearer = (request: Request) => request.headers.get('Authorization')?.replace(/^Bearer /i, '') || '';
export const isLibraryPreviewCredential = (request: Request) => bearer(request).startsWith('tjlp_');
const validText = (value: unknown) => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);

async function stillOwner(DB: D1Database, grant: Pick<Grant, 'account_id' | 'user_id' | 'session_version'>) {
  // Re-check ownership, session version and account status on EVERY use. No stale JWT claims.
  const row = await DB.prepare(`SELECT u.session_version, u.platform_role, a.status account_status, m.role, m.status membership_status
    FROM users u JOIN accounts a ON a.id = ? LEFT JOIN account_members m ON m.account_id = a.id AND m.user_id = u.id
    WHERE u.id = ?`).bind(grant.account_id, grant.user_id).first<any>();
  return !!row && row.account_status === 'active' && Number(row.session_version || 0) === grant.session_version
    && (row.platform_role ? row.platform_role === 'platform_owner' : (row.role === 'owner' && row.membership_status === 'active'));
}

const pick = (row: Record<string, any>, keys: string[]) => Object.fromEntries(keys.filter(k => row[k] !== undefined).map(k => [k, row[k]]));
const entryFields = 'id name chinese_name type form year season origin_country origin_region classification cultivar price_amount price_currency price_per_unit_grams category teaware_category material capacity_ml quantity era vendor_id vendor_name status buy_quantity_grams buy_quantity_units buy_total draft_product_id decision sample_state pack_size_grams pack_size_label created_at updated_at'.split(' ');
const lineFields = 'name product_name type quantity quantity_grams priceIsPerGram unitWeightGrams compass_entry_id product_id pricePerUnit currency'.split(' ');

async function snapshot(DB: D1Database, grant: Grant) {
  const rows = (await DB.prepare(`SELECT ${entryFields.join(',')}, tasting FROM tea_compass_entries WHERE account_id = ? AND deleted_at IS NULL AND archived_at IS NULL AND merged_into_id IS NULL ORDER BY created_at DESC`).bind(grant.account_id).all<any>()).results;
  const entries = rows.map(row => {
    let tasted = row.sample_state === 'tasted';
    try { const tasting = typeof row.tasting === 'string' ? JSON.parse(row.tasting) : row.tasting; tasted ||= !!tasting && Object.values(tasting).some(v => Array.isArray(v) ? v.length > 0 : v != null); } catch { /* malformed historical tasting is not evidence */ }
    return { ...pick(row, entryFields), preview_tasted: tasted };
  });
  const entryIds = new Set(rows.map(row => row.id));
  const productIds = new Set(rows.map(row => row.draft_product_id).filter(Boolean));
  const matches = (line: any) => entryIds.has(line.compass_entry_id) || productIds.has(line.product_id);
  const orders = (await DB.prepare('SELECT id, status, display_currency, created_at, updated_at, items_json FROM purchase_orders WHERE account_id = ?').bind(grant.account_id).all<any>()).results;
  const purchaseOrders = orders.flatMap(order => {
    let lines: any[]; try { lines = JSON.parse(order.items_json || '[]'); } catch { return []; }
    if (!Array.isArray(lines)) return [];
    const selected = lines.filter(line => line && typeof line === 'object' && matches(line)).map(line => pick(line, lineFields));
    return selected.length ? [{ ...order, items_json: JSON.stringify(selected) }] : [];
  });
  const receiptLines = (await DB.prepare(`SELECT r.id receipt_id, r.state, r.source_ref receipt_source_ref,
    l.id, l.product_id, l.expected_quantity, l.received_quantity, l.cancelled_quantity, l.unit, l.source_ref
    FROM inventory_receipts r JOIN inventory_receipt_lines l ON l.receipt_id = r.id AND l.account_id = r.account_id
    WHERE r.account_id = ?`).bind(grant.account_id).all<any>()).results;
  const grouped = new Map<string, { id: string; state: string; source_ref: string | null; lines: any[] }>();
  for (const line of receiptLines) {
    if (!productIds.has(line.product_id)) continue;
    if (!grouped.has(line.receipt_id)) grouped.set(line.receipt_id, { id: line.receipt_id, state: line.state, source_ref: line.receipt_source_ref, lines: [] });
    grouped.get(line.receipt_id)!.lines.push(pick(line, ['id','product_id','expected_quantity','received_quantity','cancelled_quantity','unit','source_ref']));
  }
  const receipts = [...grouped.values()];
  const proposals = (await DB.prepare('SELECT id, compass_entry_id, product_id, quantity, unit, acquisition_kind, status, idempotency_key, ledger_id FROM curate_receipt_proposals WHERE account_id = ?').bind(grant.account_id).all<any>()).results.filter(matches);
  const rates = (await DB.prepare('SELECT currency, rate_to_usd FROM exchange_rates').all<any>()).results;
  return { entries, purchaseOrders, receipts, proposals, rates: rates.map(r => ({ currency: r.currency, rateToUSD: r.rate_to_usd })), transactions: [], ledgerDraftsAvailable: false, accountId: grant.account_id, expiresAt: grant.expires_at };
}

export async function handleLibraryPreview(request: Request, deps: Dependencies): Promise<Response | null> {
  const url = new URL(request.url);
  if (request.method === 'OPTIONS') return null;
  const scoped = isLibraryPreviewCredential(request);
  // This guard precedes MCP, auth refresh, media and all regular API routing.
  if (scoped && (url.pathname !== `${BASE}/snapshot` || request.method !== 'GET')) return fail();
  if (!url.pathname.startsWith(`${BASE}/`)) return null;
  try {
    const { DB } = deps;
    if (url.pathname === `${BASE}/snapshot` && request.method === 'GET') {
      if (!scoped || request.headers.get('Origin') !== LIBRARY_PREVIEW_ORIGIN) return fail();
      const grant = await DB.prepare('SELECT * FROM library_preview_grants WHERE token_hash = ?').bind(await hash(bearer(request))).first<Grant>();
      if (!grant || grant.revoked_at || !grant.consumed_at || grant.expires_at <= Date.now() || !await stillOwner(DB, grant)) return fail();
      const requestedAccount = request.headers.get('X-Teajia-Account');
      if (requestedAccount && requestedAccount !== grant.account_id) return fail();
      return response(await snapshot(DB, grant));
    }
    if (url.pathname === `${BASE}/redeem` && request.method === 'POST') {
      if (request.headers.get('Origin') !== LIBRARY_PREVIEW_ORIGIN) return fail();
      const body = await request.json() as any;
      if (!validText(body.code) || typeof body.verifier !== 'string' || !/^[A-Za-z0-9._~-]{43,128}$/.test(body.verifier) || body.origin !== LIBRARY_PREVIEW_ORIGIN) return fail();
      const codeHash = await hash(body.code);
      const grant = await DB.prepare('SELECT * FROM library_preview_grants WHERE code_hash = ?').bind(codeHash).first<Grant>();
      if (!grant || grant.revoked_at || grant.consumed_at || grant.code_expires_at <= Date.now() || grant.origin !== body.origin || grant.challenge !== await hash(body.verifier) || !await stillOwner(DB, grant)) return fail();
      const token = `tjlp_${random()}`;
      const now = Date.now();
      const expiresAt = now + TTL;
      // Atomic consume: parallel redemption cannot mint two usable capabilities.
      const result = await DB.prepare('UPDATE library_preview_grants SET token_hash = ?, consumed_at = ?, expires_at = ? WHERE id = ? AND consumed_at IS NULL AND revoked_at IS NULL AND code_expires_at > ?').bind(await hash(token), now, expiresAt, grant.id, now).run();
      if (result.meta.changes !== 1) return fail();
      return response({ token, expiresAt, accountId: grant.account_id, grantId: grant.id });
    }
    if (!['GET', 'POST', 'DELETE'].includes(request.method)) return fail();
    // Issuance/revocation require a real owner login on the live site.
    const sameOriginList = request.method === 'GET' && url.pathname === `${BASE}/grants` && !request.headers.get('Origin');
    if (!sameOriginList && !['https://teajia.com', 'https://www.teajia.com'].includes(request.headers.get('Origin') || '')) return fail();
    const owner = await deps.owner(request);
    if (owner instanceof Response) return owner;
    if (!await stillOwner(DB, { account_id: owner.accountId, user_id: owner.userId, session_version: owner.sessionVersion })) return fail();
    if (url.pathname === `${BASE}/grants` && request.method === 'POST') {
      const body = await request.json() as any;
      if (body.origin !== LIBRARY_PREVIEW_ORIGIN || !validText(body.challenge)) return fail();
      const now = Date.now(); const code = random(); const id = crypto.randomUUID();
      await DB.prepare('INSERT INTO library_preview_grants (id,user_id,account_id,session_version,origin,challenge,code_hash,code_expires_at,expires_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(id, owner.userId, owner.accountId, owner.sessionVersion, body.origin, body.challenge, await hash(code), now + 60_000, now + 60_000, now).run();
      return response({ code, expiresAt: now + 60_000, grantId: id });
    }
    if (url.pathname === `${BASE}/grants` && request.method === 'GET') {
      const grants = (await DB.prepare('SELECT id, origin, created_at, expires_at, consumed_at FROM library_preview_grants WHERE user_id = ? AND account_id = ? AND revoked_at IS NULL AND expires_at > ? ORDER BY created_at DESC').bind(owner.userId, owner.accountId, Date.now()).all()).results;
      return response({ grants });
    }
    const revoke = /^\/api\/dev\/library-preview\/grants\/([a-f0-9-]{36})$/.exec(url.pathname);
    if (revoke && request.method === 'DELETE') {
      await DB.prepare('UPDATE library_preview_grants SET revoked_at = ? WHERE id = ? AND user_id = ? AND account_id = ?').bind(Date.now(), revoke[1], owner.userId, owner.accountId).run();
      return response({ revoked: true });
    }
    return fail();
  } catch { return response({ error: 'Library preview temporarily unavailable' }, 503); }
}
