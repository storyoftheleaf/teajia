/** Outbound archive connector. Public pairing grants only a dedicated token,
 * never a shop JWT. Temporary reads expire; only reviewed excerpts are durable. */
export interface ArBridgeScope { accountId: string; userId: string }
export interface ArSourceSummary { id: string; title: string; hash?: string; snippet?: string }
export interface ArSource { id: string; title: string; hash: string; text: string }
export interface TeaArLink { id: string; entryId: string; sourceId: string; title: string; hash: string; text: string; start: number; end: number; linkedAt: string }
type Row = Record<string, any>;
const PAIR_MS = 10 * 60 * 1000;
const JOB_MS = 60 * 60 * 1000;
const LEASE_MS = 2 * 60 * 1000;
const MAX_BODY_BYTES = 900_000;
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export class BridgeError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
function fail(status: number, code: string, message: string): never { throw new BridgeError(status, code, message); }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const hash = async (value: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(byte => byte.toString(16).padStart(2, '0')).join('');
const tokenFor = async (secret: string) => `ar1_${await hash(`teajia-archive-device-token:v1:${secret}`)}`;
const iso = (time: number | null) => time == null ? null : new Date(time).toISOString();
const opaqueId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,160}$/.test(value);
const plain = (value: unknown, max: number): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);
const sourceTitle = (value: unknown): value is string => plain(value, 300) && !/^(?:\/|[a-z]:[\\/]|file:|\\\\)/i.test(value);
const sourceHash = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9:_-]{1,128}$/.test(value);

async function bodyOf(request: Request): Promise<Row> {
  if (Number(request.headers.get('Content-Length')) > MAX_BODY_BYTES) fail(413, 'ar_body_too_large', 'This request is too large. Choose a shorter source.');
  const reader = request.body?.getReader();
  let bytes = 0; let text = '';
  const decoder = new TextDecoder();
  if (reader) {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY_BYTES) { await reader.cancel(); fail(413, 'ar_body_too_large', 'This request is too large. Choose a shorter source.'); }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  }
  let value: unknown;
  try { value = JSON.parse(text || '{}'); } catch { fail(400, 'ar_invalid_json', 'Send a JSON object.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(400, 'ar_invalid_json', 'Send a JSON object.');
  return value as Row;
}

function scoped(ctx?: ArBridgeScope): ArBridgeScope {
  if (!ctx?.accountId || !ctx.userId) fail(401, 'ar_sign_in_required', 'Sign in to this shop to connect its archive.');
  return ctx;
}
export async function expireArBridgeRequests(db: D1Database, now = Date.now()): Promise<void> {
  // Originals are removed at the first bridge request after the one-hour
  // deadline, even if their connector never returns or the browser is closed.
  await db.prepare(`UPDATE curate_ar_jobs SET status='expired',result_json=NULL,result_hash=NULL,error=NULL,claimed_device_id=NULL,lease_until=NULL WHERE expires_at<=? AND status!='expired'`).bind(now).run();
  await db.prepare(`DELETE FROM curate_ar_jobs WHERE expires_at<?`).bind(now - 24 * JOB_MS).run();
  await db.prepare(`DELETE FROM curate_ar_devices WHERE account_id IS NULL AND pair_expires_at<?`).bind(now - 24 * JOB_MS).run();
}
async function deviceFor(request: Request, db: D1Database): Promise<Row> {
  const authorization = request.headers.get('Authorization') ?? '';
  const token = /^Bearer (ar1_[a-f0-9]{64})$/.exec(authorization)?.[1];
  if (!token) fail(401, 'ar_device_unauthorized', 'This connector is not paired. Pair it again from the shop.');
  const device = await db.prepare(`SELECT * FROM curate_ar_devices WHERE token_hash=? AND account_id IS NOT NULL AND paired_at IS NOT NULL AND revoked_at IS NULL`).bind(await hash(token)).first<Row>();
  if (!device) fail(401, 'ar_device_unauthorized', 'This connector is no longer paired. Pair it again from the shop.');
  return device;
}
async function requireEntry(db: D1Database, accountId: string, entryId: unknown) {
  if (!opaqueId(entryId)) fail(400, 'ar_invalid_entry', 'Choose a tea record.');
  const entry = await db.prepare('SELECT id FROM tea_compass_entries WHERE id=? AND account_id=?').bind(entryId, accountId).first();
  if (!entry) fail(404, 'ar_entry_not_found', 'The tea record was not found in this shop.');
}
const linkOf = (row: Row): TeaArLink => ({ id: row.id, entryId: row.entry_id, sourceId: row.source_id, title: row.source_title, hash: row.source_hash, text: row.excerpt, start: row.excerpt_start, end: row.excerpt_end, linkedAt: iso(row.linked_at)! });
/** Shared with description drafting: only this shop's reviewed links for this
 * tea are returned, never arbitrary browser-supplied source identities. */
export async function listTeaArLinks(db: D1Database, accountId: string, entryId: string): Promise<TeaArLink[]> {
  await requireEntry(db, accountId, entryId);
  const rows = await db.prepare('SELECT * FROM curate_ar_links WHERE account_id=? AND entry_id=? ORDER BY linked_at,id').bind(accountId, entryId).all<Row>();
  return rows.results.map(linkOf);
}

/** Resolve an exact, current read result without linking or changing any record.
 * Used by both durable linking and unsaved description review. */
export async function readTeaArExcerpt(db: D1Database, scope: ArBridgeScope, input: unknown, now = Date.now()): Promise<{ requestId: string; sourceId: string; title: string; hash: string; text: string; start: number; end: number }> {
  scoped(scope);
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail(400, 'ar_invalid_excerpt', 'Choose an exact source excerpt of at most 12,000 characters.');
  const body = input as Row;
  if (!opaqueId(body.requestId) || !opaqueId(body.sourceId) || !sourceTitle(body.title) || !sourceHash(body.hash) || typeof body.text !== 'string' || !body.text.trim() || body.text.length > 12000 || !Number.isSafeInteger(body.start) || !Number.isSafeInteger(body.end) || body.start < 0 || body.end <= body.start) fail(400, 'ar_invalid_excerpt', 'Choose an exact source excerpt of at most 12,000 characters.');
  const job = await db.prepare(`SELECT result_json FROM curate_ar_jobs WHERE id=? AND account_id=? AND created_by_user_id=? AND kind='read' AND status='completed' AND expires_at>?`).bind(body.requestId, scope.accountId, scope.userId, now).first<Row>();
  if (!job) fail(404, 'ar_read_not_found', 'Read this source again before reviewing an excerpt.');
  let source: ArSource;
  try { source = (JSON.parse(job.result_json) as { source: ArSource }).source; } catch { fail(409, 'ar_read_changed', 'Read this source again before reviewing an excerpt.'); }
  if (!source || typeof source.text !== 'string' || source.id !== body.sourceId || source.title !== body.title || source.hash !== body.hash || body.end > source.text.length || source.text.slice(body.start, body.end) !== body.text) fail(400, 'ar_excerpt_mismatch', 'The excerpt must match the source that was read. Select it again.');
  return { requestId: body.requestId, sourceId: source.id, title: source.title, hash: source.hash, text: body.text, start: body.start, end: body.end };
}

function cleanResult(kind: string, input: unknown): { sources: ArSourceSummary[] } | { source: ArSource } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail(400, 'ar_invalid_result', 'The connector returned an invalid result.');
  const raw = input as Row;
  if (kind === 'search') {
    if (!Array.isArray(raw.sources) || raw.sources.length > 30) fail(400, 'ar_invalid_result', 'Search results must contain at most 30 sources.');
    const seen = new Set<string>();
    const sources = raw.sources.map((item: Row) => {
      if (!item || !opaqueId(item.id) || !sourceTitle(item.title) || seen.has(item.id) || (item.hash != null && !sourceHash(item.hash)) || (item.snippet != null && (typeof item.snippet !== 'string' || item.snippet.length > 1000))) fail(400, 'ar_invalid_result', 'The connector returned invalid source metadata.');
      seen.add(item.id);
      return { id: item.id, title: item.title, ...(item.hash != null ? { hash: item.hash } : {}), ...(item.snippet != null ? { snippet: item.snippet } : {}) };
    });
    return { sources };
  }
  const source = raw.source;
  if (!source || !opaqueId(source.id) || !sourceTitle(source.title) || !sourceHash(source.hash) || typeof source.text !== 'string' || source.text.length > 200000) fail(400, 'ar_invalid_result', 'A source must include its identity, title, hash and at most 200,000 characters.');
  return { source: { id: source.id, title: source.title, hash: source.hash, text: source.text } };
}

/** Parent routes apply requireSourcing to every ctx route. Public actions are
 * pair/start and pair/status; connector actions authenticate a dedicated token.
 * Actions: pair/start POST, pair/status GET+id, pair/claim POST, status GET,
 * disconnect DELETE, requests POST or GET+id, connector/poll POST,
 * connector/result POST, links GET(?entryId)/POST/DELETE+id. */
export async function handleArBridge(request: Request, env: { DB: D1Database }, ctx: ArBridgeScope | undefined, action: string, id?: string): Promise<Response> {
  const db = env.DB;
  const now = Date.now();
  try {
    if (action === 'pair/start' && request.method === 'POST') {
      const deviceId = crypto.randomUUID();
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      const deviceSecret = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const codeRaw = [...crypto.getRandomValues(new Uint8Array(8))].map(byte => alphabet[byte % alphabet.length]).join('');
      const expires = now + PAIR_MS;
      await db.prepare(`INSERT INTO curate_ar_devices (id,secret_hash,code_hash,token_hash,created_at,pair_expires_at) VALUES (?,?,?,?,?,?)`).bind(deviceId, await hash(deviceSecret), await hash(codeRaw), await hash(await tokenFor(deviceSecret)), now, expires).run();
      return json({ deviceId, deviceSecret, code: `${codeRaw.slice(0, 4)}-${codeRaw.slice(4)}`, expiresAt: iso(expires) }, 201);
    }
    if (action === 'pair/status' && request.method === 'GET') {
      const secret = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(request.headers.get('Authorization') ?? '')?.[1] ?? '';
      if (!opaqueId(id) || !/^[A-Za-z0-9_-]{43}$/.test(secret)) fail(401, 'ar_pair_unauthorized', 'This pairing request could not be verified.');
      const row = await db.prepare('SELECT * FROM curate_ar_devices WHERE id=? AND secret_hash=?').bind(id, await hash(secret)).first<Row>();
      if (!row) fail(401, 'ar_pair_unauthorized', 'This pairing request could not be verified.');
      if (row.pair_expires_at <= now) fail(410, 'ar_pair_expired', 'The pairing code expired. Start pairing again.');
      if (row.revoked_at != null) fail(409, 'ar_pair_replaced', 'This connector was replaced. Start pairing again.');
      return row.account_id ? json({ status: 'paired', token: await tokenFor(secret) }) : json({ status: 'pending', expiresAt: iso(row.pair_expires_at) });
    }
    if (action === 'connector/poll' && request.method === 'POST') {
      const device = await deviceFor(request, db);
      await expireArBridgeRequests(db, now);
      await db.prepare('UPDATE curate_ar_devices SET last_seen_at=? WHERE id=? AND revoked_at IS NULL').bind(now, device.id).run();
      const claimed = await db.prepare(`UPDATE curate_ar_jobs SET status='claimed',claimed_device_id=?,lease_until=?
        WHERE id=(SELECT id FROM curate_ar_jobs WHERE account_id=? AND created_by_user_id=? AND expires_at>? AND
          (status='pending' OR (status='claimed' AND (claimed_device_id=? OR lease_until<=?)))
          ORDER BY created_at,id LIMIT 1)
        AND EXISTS(SELECT 1 FROM curate_ar_devices WHERE id=? AND revoked_at IS NULL)
        RETURNING id,kind,query,source_id`).bind(device.id, now + LEASE_MS, device.account_id, device.paired_by_user_id, now, device.id, now, device.id).first<Row>();
      return json({ jobs: claimed ? [{ id: claimed.id, kind: claimed.kind, ...(claimed.query != null ? { query: claimed.query } : {}), ...(claimed.source_id != null ? { sourceId: claimed.source_id } : {}) }] : [] });
    }
    if (action === 'connector/result' && request.method === 'POST') {
      const device = await deviceFor(request, db);
      await expireArBridgeRequests(db, now);
      const body = await bodyOf(request);
      if (!opaqueId(body.id)) fail(400, 'ar_invalid_job', 'Choose a connector request.');
      const job = await db.prepare('SELECT * FROM curate_ar_jobs WHERE id=? AND account_id=? AND created_by_user_id=?').bind(body.id, device.account_id, device.paired_by_user_id).first<Row>();
      if (!job) fail(404, 'ar_request_not_found', 'This request was not found for the connector.');
      if (job.expires_at <= now) fail(410, 'ar_request_expired', 'This request expired. Create a new request.');
      if (job.claimed_device_id !== device.id) fail(job.claimed_device_id ? 404 : 409, 'ar_job_not_claimed', 'This request has not been claimed by this connector.');
      const failed = body.error != null;
      if (failed === (body.result != null)) fail(400, 'ar_invalid_result', 'Send either a result or an error.');
      if (failed && (typeof body.error !== 'string' || !body.error.trim() || body.error.length > 1000)) fail(400, 'ar_invalid_result', 'Send a brief connector error.');
      const normalized = failed ? null : cleanResult(job.kind, body.result);
      if (normalized && 'source' in normalized && normalized.source.id !== job.source_id) fail(400, 'ar_source_mismatch', 'The returned source does not match this read request.');
      const error = failed ? (job.kind === 'read' ? 'The connector could not read this source. Try a new request.' : 'The connector could not search the archive. Try a new request.') : null;
      const resultJson = normalized ? JSON.stringify(normalized) : null;
      const resultHash = await hash(JSON.stringify({ result: normalized, error }));
      if (job.status === 'completed' || job.status === 'failed') {
        if (job.result_hash !== resultHash) fail(409, 'ar_result_conflict', 'This request already has a different result.');
        return json({ recorded: true });
      }
      const updated = await db.prepare(`UPDATE curate_ar_jobs SET status=?,result_json=?,result_hash=?,error=?,completed_at=? WHERE id=? AND account_id=? AND status='claimed' AND claimed_device_id=? AND expires_at>? AND EXISTS(SELECT 1 FROM curate_ar_devices WHERE id=? AND revoked_at IS NULL)`)
        .bind(failed ? 'failed' : 'completed', resultJson, resultHash, error, now, job.id, device.account_id, device.id, now, device.id).run();
      if (!updated.meta.changes) fail(409, 'ar_result_conflict', 'The request changed. Poll the connector again.');
      return json({ recorded: true });
    }

    const scope = scoped(ctx);
    await expireArBridgeRequests(db, now);
    if (action === 'pair/claim' && request.method === 'POST') {
      const body = await bodyOf(request);
      const code = typeof body.code === 'string' ? body.code.toUpperCase().replace(/[\s-]/g, '') : '';
      if (!/^[A-HJ-NP-Z2-9]{8}$/.test(code)) fail(400, 'ar_pair_invalid', 'Enter the eight-character pairing code.');
      const row = await db.prepare('SELECT * FROM curate_ar_devices WHERE code_hash=?').bind(await hash(code)).first<Row>();
      if (!row) fail(404, 'ar_pair_not_found', 'That pairing code was not found. Check the code or start again.');
      if (row.pair_expires_at <= now) fail(410, 'ar_pair_expired', 'The pairing code expired. Start pairing again.');
      if (row.account_id != null) {
        if (row.account_id === scope.accountId && row.paired_by_user_id === scope.userId && row.revoked_at == null) return json({ paired: true });
        fail(409, 'ar_pair_already_claimed', 'That connector is already paired. Start a new pairing request.');
      }
      const guard = 'EXISTS(SELECT 1 FROM curate_ar_devices WHERE id=? AND account_id IS NULL AND pair_expires_at>?)';
      const outcome = await db.batch([
        db.prepare(`UPDATE curate_ar_jobs SET status='failed',claimed_device_id=NULL,lease_until=NULL,result_json=NULL,result_hash=NULL,error=?,completed_at=? WHERE account_id=? AND created_by_user_id<>? AND status IN ('pending','claimed') AND ${guard}`).bind('The archive connector was replaced by another person. Pair your archive again before creating a new request.', now, scope.accountId, scope.userId, row.id, now),
        db.prepare(`UPDATE curate_ar_jobs SET status='pending',claimed_device_id=NULL,lease_until=NULL WHERE account_id=? AND created_by_user_id=? AND status='claimed' AND ${guard}`).bind(scope.accountId, scope.userId, row.id, now),
        db.prepare(`UPDATE curate_ar_devices SET revoked_at=? WHERE account_id=? AND revoked_at IS NULL AND ${guard}`).bind(now, scope.accountId, row.id, now),
        db.prepare('UPDATE curate_ar_devices SET account_id=?,paired_by_user_id=?,paired_at=? WHERE id=? AND account_id IS NULL AND pair_expires_at>?').bind(scope.accountId, scope.userId, now, row.id, now),
      ]);
      if (!outcome[3].meta.changes) fail(409, 'ar_pair_already_claimed', 'The pairing request changed. Start pairing again.');
      return json({ paired: true });
    }
    if (action === 'status' && request.method === 'GET') {
      const device = await db.prepare('SELECT last_seen_at,paired_by_user_id FROM curate_ar_devices WHERE account_id=? AND revoked_at IS NULL AND paired_at IS NOT NULL').bind(scope.accountId).first<Row>();
      return json({ connected: !!device?.last_seen_at && now - device.last_seen_at < LEASE_MS, paired: !!device, canSearch: device?.paired_by_user_id === scope.userId, lastSeen: iso(device?.last_seen_at ?? null) });
    }
    if (action === 'disconnect' && request.method === 'DELETE') {
      await db.batch([
        db.prepare('UPDATE curate_ar_devices SET revoked_at=? WHERE account_id=? AND revoked_at IS NULL').bind(now, scope.accountId),
        db.prepare(`UPDATE curate_ar_jobs SET status='failed',result_json=NULL,result_hash=NULL,error=?,completed_at=? WHERE account_id=? AND status IN ('pending','claimed')`).bind('The archive connector was disconnected. Pair it again and create a new request.', now, scope.accountId),
      ]);
      return json({ disconnected: true });
    }
    if (action === 'requests' && request.method === 'POST') {
      const body = await bodyOf(request);
      if (body.kind !== 'search' && body.kind !== 'read') fail(400, 'ar_invalid_request', 'Choose search or read.');
      if (body.kind === 'search' && !plain(body.query, 300)) fail(400, 'ar_invalid_query', 'Enter a search of at most 300 characters.');
      if (body.kind === 'read' && !opaqueId(body.sourceId)) fail(400, 'ar_invalid_source', 'Choose an archive source.');
      const active = await db.prepare('SELECT id,paired_by_user_id FROM curate_ar_devices WHERE account_id=? AND revoked_at IS NULL AND paired_at IS NOT NULL').bind(scope.accountId).first<Row>();
      if (!active) fail(409, 'ar_disconnected', 'Pair the archive connector before requesting a source.');
      if (active.paired_by_user_id !== scope.userId) fail(403, 'ar_personal_archive', 'Only the person who paired this archive can search or read it. Reviewed source references on teas remain shared.');
      const count = await db.prepare(`SELECT COUNT(*) AS total FROM curate_ar_jobs WHERE account_id=? AND status IN ('pending','claimed')`).bind(scope.accountId).first<{ total: number }>();
      if ((count?.total ?? 0) >= 20) fail(429, 'ar_queue_full', 'The archive has several pending requests. Let them finish before adding another.');
      const jobId = crypto.randomUUID();
      await db.prepare(`INSERT INTO curate_ar_jobs(id,account_id,created_by_user_id,kind,query,source_id,status,created_at,expires_at) VALUES(?,?,?,?,?,?,'pending',?,?)`).bind(jobId, scope.accountId, scope.userId, body.kind, body.kind === 'search' ? body.query.trim() : null, body.kind === 'read' ? body.sourceId : null, now, now + JOB_MS).run();
      return json({ id: jobId, status: 'pending', expiresAt: iso(now + JOB_MS) }, 201);
    }
    if (action === 'requests' && request.method === 'GET' && id) {
      const job = await db.prepare('SELECT * FROM curate_ar_jobs WHERE id=? AND account_id=? AND created_by_user_id=?').bind(id, scope.accountId, scope.userId).first<Row>();
      if (!job) fail(404, 'ar_request_not_found', 'This archive request was not found in this shop.');
      const status = ({ pending: 'pending', claimed: 'running', completed: 'complete', failed: 'error', expired: 'expired' } as Record<string, string>)[job.status];
      return json({ id: job.id, status, expiresAt: iso(job.expires_at), ...(job.result_json ? { result: JSON.parse(job.result_json) } : {}), ...(job.error ? { error: job.error } : {}), ...(status === 'expired' ? { error: 'This archive request expired. Create a new request.' } : {}) });
    }
    if (action === 'links' && request.method === 'GET') {
      const entryId = new URL(request.url).searchParams.get('entryId') ?? '';
      return json({ links: await listTeaArLinks(db, scope.accountId, entryId) });
    }
    if (action === 'links' && request.method === 'DELETE' && id) {
      const removed = await db.prepare('DELETE FROM curate_ar_links WHERE id=? AND account_id=?').bind(id, scope.accountId).run();
      if (!removed.meta.changes) fail(404, 'ar_link_not_found', 'This source reference was not found in this shop.');
      return json({ removed: true });
    }
    if (action === 'links' && request.method === 'POST') {
      const body = await bodyOf(request);
      await requireEntry(db, scope.accountId, body.entryId);
      await readTeaArExcerpt(db, scope, body, now);
      const existing = await db.prepare('SELECT * FROM curate_ar_links WHERE account_id=? AND entry_id=? AND source_id=?').bind(scope.accountId, body.entryId, body.sourceId).first<Row>();
      if (existing) {
        if (existing.source_hash === body.hash && existing.excerpt === body.text && existing.excerpt_start === body.start && existing.excerpt_end === body.end) return json({ link: linkOf(existing) });
        if (body.update !== true || body.expectedHash !== existing.source_hash) fail(409, 'ar_link_changed', 'This source is already linked. Review its existing excerpt before replacing it.');
        const updated = await db.prepare(`UPDATE curate_ar_links SET source_title=?,source_hash=?,excerpt=?,excerpt_start=?,excerpt_end=?,request_id=?,linked_by_user_id=?,linked_at=? WHERE id=? AND account_id=? AND source_hash=? AND excerpt=? AND excerpt_start=? AND excerpt_end=?`).bind(body.title, body.hash, body.text, body.start, body.end, body.requestId, scope.userId, now, existing.id, scope.accountId, existing.source_hash, existing.excerpt, existing.excerpt_start, existing.excerpt_end).run();
        if (!updated.meta.changes) fail(409, 'ar_link_changed', 'This source reference changed. Review it again before replacing it.');
        const linked = await db.prepare('SELECT * FROM curate_ar_links WHERE id=? AND account_id=?').bind(existing.id, scope.accountId).first<Row>();
        return json({ link: linkOf(linked!) });
      }
      const linkId = crypto.randomUUID();
      await db.prepare(`INSERT INTO curate_ar_links(id,account_id,entry_id,source_id,source_title,source_hash,excerpt,excerpt_start,excerpt_end,request_id,linked_by_user_id,linked_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(account_id,entry_id,source_id) DO NOTHING`).bind(linkId, scope.accountId, body.entryId, body.sourceId, body.title, body.hash, body.text, body.start, body.end, body.requestId, scope.userId, now).run();
      const linked = await db.prepare('SELECT * FROM curate_ar_links WHERE account_id=? AND entry_id=? AND source_id=?').bind(scope.accountId, body.entryId, body.sourceId).first<Row>();
      if (!linked || linked.source_hash !== body.hash || linked.excerpt !== body.text || linked.excerpt_start !== body.start || linked.excerpt_end !== body.end) fail(409, 'ar_link_changed', 'This source was linked elsewhere while you reviewed it. Review the saved reference.');
      return json({ link: linkOf(linked) }, 201);
    }
    return json({ error: 'Archive route not found.', code: 'ar_route_not_found' }, 404);
  } catch (error) {
    if (error instanceof BridgeError) return json({ error: error.message, code: error.code }, error.status);
    return json({ error: 'The archive connection could not complete this request. Try again.', code: 'ar_bridge_error' }, 500);
  }
}
