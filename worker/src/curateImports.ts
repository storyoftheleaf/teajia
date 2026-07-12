import { compassValuesFromImport } from './compassCodec';
import { validateCurateContextPair } from './curateContextValidation';

export interface CurateImportContext {
  accountId: string;
  userId: string;
}

interface ImportEnv { DB: D1Database; MEDIA_BUCKET?: R2Bucket }

const SOURCE_KINDS = new Set(['wechat', 'invoice', 'vendor_list', 'photo', 'file', 'paste']);
const ITEM_STATES = new Set(['pending', 'reviewing', 'accepted', 'merged', 'abandoned']);
const ITEM_CATEGORIES = new Set(['tea', 'teaware']);

function response(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function text(value: unknown, max: number, required = false): string | null {
  if (value == null && !required) return null;
  if (typeof value !== 'string' || (required && !value.trim()) || value.length > max) throw new Error('invalid_text');
  return value;
}

function jsonField(value: unknown, fallback: unknown) {
  if (value == null) return JSON.stringify(fallback);
  JSON.stringify(value);
  return JSON.stringify(value);
}

type PayloadInspection = 'safe' | 'binary' | 'too_complex';

function binaryShaped(value: unknown): boolean {
  if (typeof value === 'string') {
    const candidate = value.trim();
    return /^data:[^,]*;base64,/i.test(candidate)
      || (candidate.length >= 8 && candidate.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(candidate));
  }
  return Array.isArray(value) && value.length > 0 && value.every(entry => Number.isInteger(entry) && Number(entry) >= 0 && Number(entry) <= 255);
}

function inspectStructuredPayload(root: unknown, detectUnlabelledBase64 = true): PayloadInspection {
  const stack: Array<{ value: unknown; key: string; depth: number }> = [{ value: root, key: '', depth: 0 }];
  let visited = 0;
  while (stack.length) {
    const current = stack.pop()!;
    if (++visited > 5000 || current.depth > 24) return 'too_complex';
    const normalizedKey = current.key.toLowerCase().replace(/[-\s]/g, '_');
    if (typeof current.value === 'string') {
      const candidate = current.value.trim();
      if (/^data:[^,]*;base64,/i.test(candidate) || (detectUnlabelledBase64 && candidate.length >= 128 && binaryShaped(candidate))) return 'binary';
    }
    if (['base64', 'file_bytes', 'filebytes', 'bytes', 'binary', 'blob'].includes(normalizedKey) && current.value != null) return 'binary';
    if (normalizedKey === 'data' && binaryShaped(current.value)) return 'binary';
    if (Array.isArray(current.value)) {
      for (const child of current.value) stack.push({ value: child, key: '', depth: current.depth + 1 });
    } else {
      const record = object(current.value);
      if (record) for (const [key, child] of Object.entries(record)) stack.push({ value: child, key, depth: current.depth + 1 });
    }
  }
  return 'safe';
}

function safeR2ObjectKey(key: string, accountId: string, batchId: string): boolean {
  const prefix = `curate/${accountId}/${batchId}/`;
  return key.startsWith(prefix)
    && key.length > prefix.length
    && key.length <= 1000
    && !/[\u0000-\u001f\u007f\\]/.test(key)
    && !/%(?:00|2e|2f|5c)/i.test(key)
    && !key.includes('//')
    && key.split('/').every(segment => segment !== '.' && segment !== '..');
}

function parseJson(value: unknown, fallback: unknown) {
  if (typeof value !== 'string') return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

function sourceRow(row: Record<string, unknown>) {
  return { ...row, metadata: parseJson(row.metadata_json, {}), metadata_json: undefined };
}

function itemRow(row: Record<string, unknown>) {
  return {
    ...row,
    confidence: row.confidence == null ? null : Number(row.confidence),
    uncertainty: parseJson(row.uncertainty_json, {}),
    parsed_data: parseJson(row.parsed_data_json, {}),
    uncertainty_json: undefined,
    parsed_data_json: undefined,
  };
}

async function scopedBatch(env: ImportEnv, id: string, accountId: string) {
  return env.DB.prepare('SELECT * FROM curate_import_batches WHERE id = ? AND account_id = ?').bind(id, accountId).first<Record<string, unknown>>();
}

function batchIsTerminal(batch: Record<string, unknown>) { return batch.review_state === 'completed' || batch.review_state === 'abandoned'; }
function terminalResponse() { return response({ error: 'Completed or abandoned imports cannot be changed' }, 409); }

async function scopedItem(env: ImportEnv, batchId: string, itemId: string, accountId: string) {
  return env.DB.prepare('SELECT * FROM curate_import_items WHERE id = ? AND batch_id = ? AND account_id = ?').bind(itemId, batchId, accountId).first<Record<string, unknown>>();
}

async function fullBatch(env: ImportEnv, id: string, accountId: string) {
  const batch = await scopedBatch(env, id, accountId);
  if (!batch) return null;
  const [sources, items] = await Promise.all([
    env.DB.prepare('SELECT * FROM curate_import_sources WHERE batch_id = ? AND account_id = ? ORDER BY created_at, id').bind(id, accountId).all<Record<string, unknown>>(),
    env.DB.prepare('SELECT * FROM curate_import_items WHERE batch_id = ? AND account_id = ? ORDER BY position, created_at, id').bind(id, accountId).all<Record<string, unknown>>(),
  ]);
  return { batch, sources: sources.results.map(sourceRow), items: items.results.map(itemRow) };
}

export async function createCurateImport(request: Request, env: ImportEnv, ctx: CurateImportContext) {
  let body: Record<string, unknown>;
  try { body = object(await request.json()) ?? {}; } catch { return response({ error: 'Invalid JSON' }, 400); }
  try {
    const idempotencyKey = text(body.idempotency_key, 200, true)!;
    const title = text(body.title, 240, true)!;
    const journeyId = text(body.journey_id, 100);
    const visitId = text(body.visit_id, 100);
    const contextError = await validateCurateContextPair(env, ctx.accountId, { journey_id: journeyId, visit_id: visitId });
    if (contextError) return response({ error: contextError }, 400);
    const sourceKind = body.source_kind == null ? null : text(body.source_kind, 40, true);
    const pastedText = body.pasted_text == null ? null : text(body.pasted_text, 250_000);
    if (sourceKind && !SOURCE_KINDS.has(sourceKind)) return response({ error: 'Unsupported source kind' }, 400);
    const rawItems = body.items == null ? [] : body.items;
    if (!Array.isArray(rawItems) || rawItems.length > 1000) return response({ error: 'items must be an array of at most 1000 entries' }, 400);
    const fingerprint = JSON.stringify({ title, journey_id: journeyId, visit_id: visitId, source_kind: sourceKind, pasted_text: pastedText, items: rawItems });
    const replay = await env.DB.prepare('SELECT * FROM curate_import_batches WHERE account_id = ? AND client_idempotency_key = ?').bind(ctx.accountId, idempotencyKey).first<Record<string, unknown>>();
    if (replay) return replay.request_fingerprint === fingerprint
      ? response(await fullBatch(env, String(replay.id), ctx.accountId))
      : response({ error: 'idempotency_key already used for a different import' }, 409);
    const batchId = crypto.randomUUID();
    const statements: D1PreparedStatement[] = [env.DB.prepare(
      `INSERT INTO curate_import_batches (id, account_id, created_by_user_id, title, review_state, journey_id, visit_id, client_idempotency_key, request_fingerprint)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(batchId, ctx.accountId, ctx.userId, title, 'pending', journeyId, visitId, idempotencyKey, fingerprint)];
    let initialSourceId: string | null = null;
    if (pastedText != null) {
      initialSourceId = crypto.randomUUID();
      statements.push(env.DB.prepare(
        `INSERT INTO curate_import_sources (id, batch_id, account_id, created_by_user_id, kind, pasted_text, r2_object_key, metadata_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(initialSourceId, batchId, ctx.accountId, ctx.userId, sourceKind ?? 'paste', pastedText, null, '{}'));
    }
    for (let index = 0; index < rawItems.length; index++) {
      const raw = object(rawItems[index]);
      if (!raw) return response({ error: `items[${index}] must be an object` }, 400);
      const structuredInspection = inspectStructuredPayload({
        parsed_data: raw.parsed_data ?? {},
        uncertainty: raw.uncertainty ?? {},
      }, false);
      if (structuredInspection !== 'safe') {
        return response({
          error: structuredInspection === 'binary'
            ? `items[${index}] contains embedded binary data; store attachments in R2`
            : `items[${index}] structured fields are too deeply nested or too large`,
        }, 400);
      }
      const position = raw.position == null ? index : Number(raw.position);
      const confidence = raw.confidence == null ? null : Number(raw.confidence);
      const category = raw.category == null ? 'tea' : text(raw.category, 20, true)!;
      if (!Number.isInteger(position) || position < 0 || !ITEM_CATEGORIES.has(category)) return response({ error: `Invalid item at index ${index}` }, 400);
      if (confidence != null && (!Number.isFinite(confidence) || confidence < 0 || confidence > 1)) return response({ error: `Invalid confidence at index ${index}` }, 400);
      statements.push(env.DB.prepare(
        `INSERT INTO curate_import_items
           (id, batch_id, source_id, account_id, created_by_user_id, position, category, name, raw_text, parsed_data_json, confidence, uncertainty_json, review_state, compass_entry_id, reserved_compass_entry_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(crypto.randomUUID(), batchId, initialSourceId, ctx.accountId, ctx.userId, position, category,
        text(raw.name, 500), text(raw.raw_text, 20_000), jsonField(raw.parsed_data, {}), confidence,
        jsonField(raw.uncertainty, {}), 'pending', null, crypto.randomUUID()));
    }
    try { await env.DB.batch(statements); }
    catch (error) {
      const raced = await env.DB.prepare('SELECT * FROM curate_import_batches WHERE account_id = ? AND client_idempotency_key = ?').bind(ctx.accountId, idempotencyKey).first<Record<string, unknown>>();
      if (raced) return raced.request_fingerprint === fingerprint
        ? response(await fullBatch(env, String(raced.id), ctx.accountId))
        : response({ error: 'idempotency_key already used for a different import' }, 409);
      throw error;
    }
    return response(await fullBatch(env, batchId, ctx.accountId), 201);
  } catch (error) {
    if (error instanceof Error && error.message === 'invalid_text') return response({ error: 'Invalid or oversized text field' }, 400);
    throw error;
  }
}

export async function getCurateImport(_request: Request, env: ImportEnv, ctx: CurateImportContext, params: Record<string, string>) {
  const result = await fullBatch(env, params.id, ctx.accountId);
  return result ? response(result) : response({ error: 'Import not found' }, 404);
}

export async function addCurateImportItem(request: Request, env: ImportEnv, ctx: CurateImportContext, params: Record<string, string>) {
  const batch = await scopedBatch(env, params.id, ctx.accountId);
  if (!batch) return response({ error: 'Import not found' }, 404);
  if (batchIsTerminal(batch)) return terminalResponse();
  let body: Record<string, unknown>;
  try { body = object(await request.json()) ?? {}; } catch { return response({ error: 'Invalid JSON' }, 400); }
  const category = typeof body.category === 'string' ? body.category : 'tea';
  if (!ITEM_CATEGORIES.has(category)) return response({ error: 'Invalid category' }, 400);
  let name: string | null;
  try { name = text(body.name, 500, true); } catch { return response({ error: 'Name is required' }, 400); }
  const sourceId = typeof body.source_id === 'string' ? body.source_id : null;
  if (sourceId && !await env.DB.prepare('SELECT * FROM curate_import_sources WHERE id = ? AND batch_id = ? AND account_id = ?').bind(sourceId, params.id, ctx.accountId).first()) return response({ error: 'Source must belong to this import' }, 400);
  const existing = await env.DB.prepare('SELECT * FROM curate_import_items WHERE batch_id = ? AND account_id = ?').bind(params.id, ctx.accountId).all<Record<string, unknown>>();
  const id = crypto.randomUUID();
  const inserted = await env.DB.prepare(
    `INSERT INTO curate_import_items (id, batch_id, source_id, account_id, created_by_user_id, position, category, name, raw_text, parsed_data_json, confidence, uncertainty_json, review_state, compass_entry_id, reserved_compass_entry_id)
     SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS
       (SELECT 1 FROM curate_import_batches WHERE id = ? AND account_id = ? AND review_state NOT IN ('completed', 'abandoned'))`
  ).bind(id, params.id, sourceId, ctx.accountId, ctx.userId, existing.results.length, category, name, null, '{}', null, '{}', 'pending', null, crypto.randomUUID(), params.id, ctx.accountId).run();
  if (!(inserted.meta.changes ?? 0)) return terminalResponse();
  await refreshImportBatchState(env, params.id, ctx.accountId);
  return response(itemRow((await scopedItem(env, params.id, id, ctx.accountId))!), 201);
}

export async function abandonCurateImport(_request: Request, env: ImportEnv, ctx: CurateImportContext, params: Record<string, string>) {
  const batch = await scopedBatch(env, params.id, ctx.accountId);
  if (!batch) return response({ error: 'Import not found' }, 404);
  if (batchIsTerminal(batch)) return terminalResponse();
  const results = await env.DB.batch([
    env.DB.prepare("UPDATE curate_import_items SET review_state = 'abandoned', updated_at = datetime('now') WHERE batch_id = ? AND account_id = ? AND review_state IN ('pending', 'reviewing') AND EXISTS (SELECT 1 FROM curate_import_batches WHERE id = ? AND account_id = ? AND review_state NOT IN ('completed', 'abandoned'))").bind(params.id, ctx.accountId, params.id, ctx.accountId),
    env.DB.prepare("UPDATE curate_import_batches SET review_state = 'abandoned', updated_at = datetime('now') WHERE id = ? AND account_id = ? AND review_state NOT IN ('completed', 'abandoned')").bind(params.id, ctx.accountId),
  ]);
  if (!(results[1]?.meta.changes ?? 0)) return terminalResponse();
  return response({ success: true, id: params.id, review_state: 'abandoned' });
}

export async function listIncompleteCurateImports(_request: Request, env: ImportEnv, ctx: CurateImportContext) {
  const batches = await env.DB.prepare(
    "SELECT * FROM curate_import_batches WHERE account_id = ? AND review_state != 'completed' AND review_state != 'abandoned' ORDER BY updated_at DESC, created_at DESC LIMIT 25"
  ).bind(ctx.accountId).all<Record<string, unknown>>();
  const imports = (await Promise.all(batches.results.map(batch => fullBatch(env, String(batch.id), ctx.accountId)))).filter(Boolean);
  return response({ imports });
}

async function refreshImportBatchState(env: ImportEnv, batchId: string, accountId: string) {
  const items = await env.DB.prepare('SELECT * FROM curate_import_items WHERE batch_id = ? AND account_id = ?').bind(batchId, accountId).all<Record<string, unknown>>();
  if (!items.results.length) return;
  const completed = items.results.every(item => ['accepted', 'merged', 'abandoned'].includes(String(item.review_state)));
  await env.DB.prepare("UPDATE curate_import_batches SET review_state = ?, updated_at = datetime('now') WHERE id = ? AND account_id = ? AND review_state NOT IN ('completed', 'abandoned')")
    .bind(completed ? 'completed' : 'reviewing', batchId, accountId).run();
}

const EVIDENCE_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
  'application/pdf', 'application/json', 'text/plain', 'text/csv', 'application/csv',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const EVIDENCE_MAX_BYTES = 10 * 1024 * 1024;

export async function uploadCurateImportEvidence(request: Request, env: ImportEnv, ctx: CurateImportContext, params: Record<string, string>) {
  const batch = await scopedBatch(env, params.id, ctx.accountId);
  if (!batch) return response({ error: 'Import not found' }, 404);
  if (batchIsTerminal(batch)) return terminalResponse();
  if (!env.MEDIA_BUCKET) return response({ error: 'Evidence storage is not configured. Your file was not saved.' }, 503);
  const contentType = (request.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
  if (!EVIDENCE_TYPES.has(contentType)) return response({ error: 'Unsupported evidence file type' }, 415);
  const declaredSize = Number(request.headers.get('Content-Length') || 0);
  if (declaredSize > EVIDENCE_MAX_BYTES) return response({ error: 'Evidence files must be 10 MB or smaller' }, 413);
  const encodedFilename = request.headers.get('X-Filename') || '';
  const clientEvidenceId = request.headers.get('X-Client-Evidence-Id') || '';
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(clientEvidenceId)) return response({ error: 'Invalid client evidence identity' }, 400);
  const existing = await env.DB.prepare(
    'SELECT * FROM curate_import_sources WHERE batch_id = ? AND account_id = ? AND client_evidence_id = ?'
  ).bind(params.id, ctx.accountId, clientEvidenceId).first<Record<string, unknown>>();
  if (existing) return response({ ...sourceRow(existing), already_uploaded: true });
  let filename = '';
  try { filename = decodeURIComponent(encodedFilename); } catch { return response({ error: 'Invalid evidence filename' }, 400); }
  if (!filename || filename.length > 500 || /[\u0000-\u001f\u007f]/.test(filename)) return response({ error: 'Invalid evidence filename' }, 400);
  const bytes = await request.arrayBuffer();
  if (!bytes.byteLength) return response({ error: 'Evidence file is empty' }, 400);
  if (bytes.byteLength > EVIDENCE_MAX_BYTES) return response({ error: 'Evidence files must be 10 MB or smaller' }, 413);
  const head = new Uint8Array(bytes.slice(0, 16));
  const ascii = new TextDecoder().decode(head);
  const matchesType = contentType === 'application/pdf' ? ascii.startsWith('%PDF-')
    : contentType === 'application/json' ? (() => {
      try { JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); return true; }
      catch { return false; }
    })()
    : contentType === 'image/jpeg' ? head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff
    : contentType === 'image/png' ? [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => head[index] === byte)
    : contentType === 'image/webp' ? ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP'
    : contentType === 'image/heic' || contentType === 'image/heif' ? ascii.slice(4, 8) === 'ftyp'
    : contentType === 'application/msword' ? [0xd0, 0xcf, 0x11, 0xe0].every((byte, index) => head[index] === byte)
    : contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ? ascii.startsWith('PK')
    : true;
  if (!matchesType) return response({ error: 'Evidence content does not match its declared file type' }, 415);
  const extensionByType: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif', 'application/pdf': 'pdf', 'application/json': 'json', 'text/plain': 'txt', 'text/csv': 'csv', 'application/csv': 'csv', 'application/msword': 'doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx' };
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(byte => byte.toString(16).padStart(2, '0')).join('');
  const key = `curate/${ctx.accountId}/${params.id}/${clientEvidenceId}-${digest}.${extensionByType[contentType]}`;
  const sourceId = crypto.randomUUID();
  const kind = contentType.startsWith('image/') ? 'photo' : contentType === 'application/pdf' ? 'invoice' : 'file';
  const metadata = { filename, content_type: contentType, size: bytes.byteLength, extraction_status: 'not_available', client_evidence_id: clientEvidenceId };
  await env.MEDIA_BUCKET.put(key, bytes, { httpMetadata: { contentType }, customMetadata: { account_id: ctx.accountId, batch_id: params.id, source_id: sourceId } });
  try {
    const inserted = await env.DB.prepare(
      `INSERT INTO curate_import_sources (id, batch_id, account_id, created_by_user_id, kind, pasted_text, r2_object_key, client_evidence_id, metadata_json)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM curate_import_batches WHERE id = ? AND account_id = ? AND review_state NOT IN ('completed', 'abandoned'))`
    ).bind(sourceId, params.id, ctx.accountId, ctx.userId, kind, null, key, clientEvidenceId, JSON.stringify(metadata), params.id, ctx.accountId).run();
    if (!(inserted.meta.changes ?? 0)) { await env.MEDIA_BUCKET.delete(key); return terminalResponse(); }
  } catch (error) {
    const winner = await env.DB.prepare('SELECT * FROM curate_import_sources WHERE batch_id = ? AND account_id = ? AND client_evidence_id = ?')
      .bind(params.id, ctx.accountId, clientEvidenceId).first<Record<string, unknown>>();
    if (winner) {
      if (winner.r2_object_key !== key) await env.MEDIA_BUCKET.delete(key);
      return response({ ...sourceRow(winner), already_uploaded: true });
    }
    await env.MEDIA_BUCKET.delete(key); throw error;
  }
  const row = await env.DB.prepare('SELECT * FROM curate_import_sources WHERE id = ? AND account_id = ?').bind(sourceId, ctx.accountId).first<Record<string, unknown>>();
  return response(sourceRow(row!), 201);
}

export async function getCurateImportEvidence(_request: Request, env: ImportEnv, ctx: CurateImportContext, params: Record<string, string>) {
  if (!env.MEDIA_BUCKET) return response({ error: 'Evidence storage is not configured' }, 503);
  const source = await env.DB.prepare(
    'SELECT * FROM curate_import_sources WHERE id = ? AND batch_id = ? AND account_id = ?'
  ).bind(params.sourceId, params.id, ctx.accountId).first<Record<string, unknown>>();
  if (!source?.r2_object_key || typeof source.r2_object_key !== 'string' || !safeR2ObjectKey(source.r2_object_key, ctx.accountId, params.id)) {
    return response({ error: 'Evidence not found' }, 404);
  }
  const objectBody = await env.MEDIA_BUCKET.get(source.r2_object_key);
  if (!objectBody) return response({ error: 'Evidence not found' }, 404);
  const metadata = parseJson(source.metadata_json, {}) as Record<string, unknown>;
  const contentType = typeof metadata.content_type === 'string' && EVIDENCE_TYPES.has(metadata.content_type) ? metadata.content_type : 'application/octet-stream';
  const filename = typeof metadata.filename === 'string' ? metadata.filename : 'evidence';
  const disposition = contentType.startsWith('image/') ? 'inline' : 'attachment';
  return new Response(objectBody.body, { headers: {
    'Content-Type': contentType,
    'Content-Disposition': `${disposition}; filename*=UTF-8''${encodeURIComponent(filename)}`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
  } });
}

export async function addCurateImportSource(request: Request, env: ImportEnv, ctx: CurateImportContext, params: Record<string, string>) {
  const batch = await scopedBatch(env, params.id, ctx.accountId);
  if (!batch) return response({ error: 'Import not found' }, 404);
  if (batchIsTerminal(batch)) return terminalResponse();
  let body: Record<string, unknown>;
  try { body = object(await request.json()) ?? {}; } catch { return response({ error: 'Invalid JSON' }, 400); }
  try {
    const allowed = new Set(['kind', 'pasted_text', 'r2_object_key', 'metadata', 'idempotency_key']);
    if (Object.keys(body).some(key => !allowed.has(key))) return response({ error: 'Unknown source field' }, 400);
    const kind = text(body.kind, 40, true)!;
    if (!SOURCE_KINDS.has(kind)) return response({ error: 'Unsupported source kind' }, 400);
    const pastedText = text(body.pasted_text, 250_000);
    const objectKey = text(body.r2_object_key, 1000);
    const inspection = inspectStructuredPayload(body.metadata ?? {});
    if (inspection !== 'safe') return response({ error: inspection === 'binary' ? 'Upload files to object storage; provide only r2_object_key' : 'Source metadata is too deeply nested or too large' }, 400);
    if (pastedText == null && objectKey == null) return response({ error: 'pasted_text or r2_object_key is required' }, 400);
    if (objectKey != null && !safeR2ObjectKey(objectKey, ctx.accountId, params.id)) return response({ error: 'r2_object_key must be scoped to this account and import batch' }, 400);
    const id = crypto.randomUUID();
    const metadataJson = jsonField(body.metadata, {});
    const idempotencyKey = text(body.idempotency_key, 200, true)!;
    const fingerprint = JSON.stringify({ batch_id: params.id, kind, pasted_text: pastedText, r2_object_key: objectKey, metadata: JSON.parse(metadataJson) });
    const replay = await env.DB.prepare('SELECT * FROM curate_import_sources WHERE account_id = ? AND client_idempotency_key = ?').bind(ctx.accountId, idempotencyKey).first<Record<string, unknown>>();
    if (replay) return replay.request_fingerprint === fingerprint
      ? response(sourceRow(replay))
      : response({ error: 'idempotency_key already used for a different source' }, 409);
    let inserted: D1Result<unknown>;
    try {
      inserted = await env.DB.prepare(
        `INSERT INTO curate_import_sources (id, batch_id, account_id, created_by_user_id, kind, pasted_text, r2_object_key, metadata_json, client_idempotency_key, request_fingerprint)
         SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM curate_import_batches WHERE id = ? AND account_id = ? AND review_state NOT IN ('completed', 'abandoned'))`
      ).bind(id, params.id, ctx.accountId, ctx.userId, kind, pastedText, objectKey, metadataJson, idempotencyKey, fingerprint, params.id, ctx.accountId).run();
    } catch (error) {
      const raced = await env.DB.prepare('SELECT * FROM curate_import_sources WHERE account_id = ? AND client_idempotency_key = ?').bind(ctx.accountId, idempotencyKey).first<Record<string, unknown>>();
      if (raced) return raced.request_fingerprint === fingerprint
        ? response(sourceRow(raced))
        : response({ error: 'idempotency_key already used for a different source' }, 409);
      throw error;
    }
    if (!(inserted.meta.changes ?? 0)) return terminalResponse();
    const row = await env.DB.prepare('SELECT * FROM curate_import_sources WHERE id = ? AND account_id = ?').bind(id, ctx.accountId).first<Record<string, unknown>>();
    return response(sourceRow(row!), 201);
  } catch (error) {
    if (error instanceof Error && error.message === 'invalid_text') return response({ error: 'Invalid or oversized text field' }, 400);
    throw error;
  }
}

export async function updateCurateImportItem(request: Request, env: ImportEnv, ctx: CurateImportContext, params: Record<string, string>) {
  const batch = await scopedBatch(env, params.id, ctx.accountId);
  if (!batch) return response({ error: 'Import not found' }, 404);
  if (batchIsTerminal(batch)) return terminalResponse();
  const current = await scopedItem(env, params.id, params.itemId, ctx.accountId);
  if (!current) return response({ error: 'Import item not found' }, 404);
  let body: Record<string, unknown>;
  try { body = object(await request.json()) ?? {}; } catch { return response({ error: 'Invalid JSON' }, 400); }
  const allowed = new Set(['source_id', 'position', 'category', 'name', 'raw_text', 'parsed_data', 'confidence', 'uncertainty', 'review_state']);
  if (Object.keys(body).some(key => !allowed.has(key))) return response({ error: 'Unknown update field' }, 400);
  const updates: string[] = [];
  const values: unknown[] = [];
  try {
    for (const [key, value] of Object.entries(body)) {
      if (key === 'source_id') {
        if (value !== null && typeof value !== 'string') return response({ error: 'Invalid source_id' }, 400);
        if (value !== null) {
          const source = await env.DB.prepare(
            'SELECT id FROM curate_import_sources WHERE id = ? AND batch_id = ? AND account_id = ?'
          ).bind(value, params.id, ctx.accountId).first();
          if (!source) return response({ error: 'Source must belong to this import' }, 400);
        }
        updates.push('source_id = ?'); values.push(value);
      } else if (key === 'review_state') {
        if (typeof value !== 'string' || !ITEM_STATES.has(value) || value === 'accepted' || value === 'merged') return response({ error: 'Invalid review_state' }, 400);
        updates.push('review_state = ?'); values.push(value);
      } else if (key === 'category') {
        if (typeof value !== 'string' || !ITEM_CATEGORIES.has(value)) return response({ error: 'Invalid category' }, 400);
        updates.push('category = ?'); values.push(value);
      } else if (key === 'position') {
        const number = Number(value); if (!Number.isInteger(number) || number < 0) return response({ error: 'Invalid position' }, 400);
        updates.push('position = ?'); values.push(number);
      } else if (key === 'confidence') {
        const number = value == null ? null : Number(value); if (number != null && (!Number.isFinite(number) || number < 0 || number > 1)) return response({ error: 'Invalid confidence' }, 400);
        updates.push('confidence = ?'); values.push(number);
      } else if (key === 'parsed_data' || key === 'uncertainty') {
        updates.push(`${key}_json = ?`); values.push(jsonField(value, {}));
      } else {
        updates.push(`${key} = ?`); values.push(text(value, key === 'raw_text' ? 20_000 : 500));
      }
    }
  } catch { return response({ error: 'Invalid update' }, 400); }
  if (updates.length) {
    updates.push("updated_at = datetime('now')");
    const changed = await env.DB.prepare(`UPDATE curate_import_items SET ${updates.join(', ')} WHERE id = ? AND account_id = ? AND EXISTS (SELECT 1 FROM curate_import_batches WHERE id = ? AND account_id = ? AND review_state NOT IN ('completed', 'abandoned'))`).bind(...values, params.itemId, ctx.accountId, params.id, ctx.accountId).run();
    if (!(changed.meta.changes ?? 0)) return terminalResponse();
  }
  await refreshImportBatchState(env, params.id, ctx.accountId);
  const updated = await scopedItem(env, params.id, params.itemId, ctx.accountId);
  return response(itemRow(updated!));
}

export async function acceptCurateImportItem(_request: Request, env: ImportEnv, ctx: CurateImportContext, params: Record<string, string>) {
  const batch = await scopedBatch(env, params.id, ctx.accountId);
  if (!batch) return response({ error: 'Import not found' }, 404);
  const item = await scopedItem(env, params.id, params.itemId, ctx.accountId);
  if (!item) return response({ error: 'Import item not found' }, 404);
  if (item.compass_entry_id) return response({ ...itemRow(item), already_accepted: true });
  if (batchIsTerminal(batch)) return terminalResponse();
  if (item.review_state === 'abandoned') return response({ error: 'Abandoned items cannot be accepted' }, 409);
  if (Object.keys(parseJson(item.uncertainty_json, {})).length > 0) return response({ error: 'Review uncertain fields before accepting this item' }, 409);
  const compassId = typeof item.reserved_compass_entry_id === 'string' ? item.reserved_compass_entry_id : '';
  if (!compassId) return response({ error: 'Import item has no Compass reservation' }, 409);
  const parsed = parseJson(item.parsed_data_json, {});
  const structured = object(parsed) ? compassValuesFromImport(parsed as Record<string, unknown>) : {};
  const compassValues = {
    ...structured,
    name: item.name ?? null,
    category: item.category ?? 'tea',
    notes: item.raw_text ?? null,
    status: 'logged',
  };
  const compassColumns = Object.keys(compassValues);
  const results = await env.DB.batch([
    env.DB.prepare(
      `INSERT OR IGNORE INTO tea_compass_entries (id, user_id, account_id, import_item_id, ${compassColumns.join(', ')})
       SELECT ?, ?, ?, ?, ${compassColumns.map(() => '?').join(', ')} WHERE EXISTS (SELECT 1 FROM curate_import_batches WHERE id = ? AND account_id = ? AND review_state NOT IN ('completed', 'abandoned'))`
    ).bind(compassId, ctx.userId, ctx.accountId, params.itemId, ...compassColumns.map(column => compassValues[column as keyof typeof compassValues]), params.id, ctx.accountId),
    // The ownership EXISTS is part of the same D1 transaction as the insert.
    // A global id collision owned by anyone else makes this update a no-op.
    env.DB.prepare(
      `UPDATE curate_import_items SET review_state = ?, compass_entry_id = ?, reviewed_by_user_id = ?, reviewed_at = datetime('now'), updated_at = datetime('now')
       WHERE id = ? AND account_id = ? AND compass_entry_id IS NULL
         AND EXISTS (SELECT 1 FROM tea_compass_entries WHERE id = ? AND user_id = ? AND account_id = ? AND import_item_id = ?)
         AND EXISTS (SELECT 1 FROM curate_import_batches WHERE id = ? AND account_id = ? AND review_state NOT IN ('completed', 'abandoned'))`
    ).bind('accepted', compassId, ctx.userId, params.itemId, ctx.accountId, compassId, ctx.userId, ctx.accountId, params.itemId, params.id, ctx.accountId),
  ]);
  const linkedChanges = results[1]?.meta.changes ?? 0;
  const updated = await scopedItem(env, params.id, params.itemId, ctx.accountId);
  if (!updated?.compass_entry_id) return response({ error: 'Compass entry id is unavailable' }, 409);
  await refreshImportBatchState(env, params.id, ctx.accountId);
  return response({ ...itemRow(updated), ...(linkedChanges ? {} : { already_accepted: true }) }, linkedChanges ? 201 : 200);
}

export async function mergeCurateImportItem(request: Request, env: ImportEnv, ctx: CurateImportContext, params: Record<string, string>) {
  const batch = await scopedBatch(env, params.id, ctx.accountId);
  if (!batch) return response({ error: 'Import not found' }, 404);
  if (batchIsTerminal(batch)) return terminalResponse();
  const item = await scopedItem(env, params.id, params.itemId, ctx.accountId);
  if (!item) return response({ error: 'Import item not found' }, 404);
  if (item.review_state === 'abandoned') return response({ error: 'Abandoned items cannot be merged' }, 409);
  let body: Record<string, unknown>;
  try { body = object(await request.json()) ?? {}; } catch { return response({ error: 'Invalid JSON' }, 400); }
  const compassId = typeof body.compass_entry_id === 'string' ? body.compass_entry_id : '';
  if (!compassId) return response({ error: 'compass_entry_id is required' }, 400);
  const compass = await env.DB.prepare('SELECT id FROM tea_compass_entries WHERE id = ? AND user_id = ? AND account_id = ?').bind(compassId, ctx.userId, ctx.accountId).first();
  if (!compass) return response({ error: 'Compass entry not found' }, 404);
  if (item.compass_entry_id && item.compass_entry_id !== compassId) return response({ error: 'Import item is already linked' }, 409);
  const changed = await env.DB.prepare(
    `UPDATE curate_import_items SET review_state = ?, compass_entry_id = ?, reviewed_by_user_id = ?, reviewed_at = datetime('now'), updated_at = datetime('now')
     WHERE id = ? AND account_id = ? AND EXISTS (SELECT 1 FROM curate_import_batches WHERE id = ? AND account_id = ? AND review_state NOT IN ('completed', 'abandoned'))`
  ).bind('merged', compassId, ctx.userId, params.itemId, ctx.accountId, params.id, ctx.accountId).run();
  if (!(changed.meta.changes ?? 0)) return terminalResponse();
  await refreshImportBatchState(env, params.id, ctx.accountId);
  return response(itemRow((await scopedItem(env, params.id, params.itemId, ctx.accountId))!));
}
