import { compassValuesFromImport } from './compassCodec';
import { validateCurateContextPair } from './curateContextValidation';

export interface CurateImportContext {
  accountId: string;
  userId: string;
}

interface ImportEnv { DB: D1Database }

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

function inspectStructuredPayload(root: unknown): PayloadInspection {
  const stack: Array<{ value: unknown; key: string; depth: number }> = [{ value: root, key: '', depth: 0 }];
  let visited = 0;
  while (stack.length) {
    const current = stack.pop()!;
    if (++visited > 5000 || current.depth > 24) return 'too_complex';
    const normalizedKey = current.key.toLowerCase().replace(/[-\s]/g, '_');
    if (typeof current.value === 'string') {
      const candidate = current.value.trim();
      if (/^data:[^,]*;base64,/i.test(candidate) || (candidate.length >= 128 && binaryShaped(candidate))) return 'binary';
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
    const batchId = crypto.randomUUID();
    const statements: D1PreparedStatement[] = [env.DB.prepare(
      `INSERT INTO curate_import_batches (id, account_id, created_by_user_id, title, review_state, journey_id, visit_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(batchId, ctx.accountId, ctx.userId, title, 'pending', journeyId, visitId)];
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
    await env.DB.batch(statements);
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

export async function addCurateImportSource(request: Request, env: ImportEnv, ctx: CurateImportContext, params: Record<string, string>) {
  if (!await scopedBatch(env, params.id, ctx.accountId)) return response({ error: 'Import not found' }, 404);
  let body: Record<string, unknown>;
  try { body = object(await request.json()) ?? {}; } catch { return response({ error: 'Invalid JSON' }, 400); }
  try {
    const allowed = new Set(['kind', 'pasted_text', 'r2_object_key', 'metadata']);
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
    await env.DB.prepare(
      `INSERT INTO curate_import_sources (id, batch_id, account_id, created_by_user_id, kind, pasted_text, r2_object_key, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, params.id, ctx.accountId, ctx.userId, kind, pastedText, objectKey, metadataJson).run();
    const row = await env.DB.prepare('SELECT * FROM curate_import_sources WHERE id = ? AND account_id = ?').bind(id, ctx.accountId).first<Record<string, unknown>>();
    return response(sourceRow(row!), 201);
  } catch (error) {
    if (error instanceof Error && error.message === 'invalid_text') return response({ error: 'Invalid or oversized text field' }, 400);
    throw error;
  }
}

export async function updateCurateImportItem(request: Request, env: ImportEnv, ctx: CurateImportContext, params: Record<string, string>) {
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
    await env.DB.prepare(`UPDATE curate_import_items SET ${updates.join(', ')} WHERE id = ? AND account_id = ?`).bind(...values, params.itemId, ctx.accountId).run();
  }
  const updated = await scopedItem(env, params.id, params.itemId, ctx.accountId);
  return response(itemRow(updated!));
}

export async function acceptCurateImportItem(_request: Request, env: ImportEnv, ctx: CurateImportContext, params: Record<string, string>) {
  const item = await scopedItem(env, params.id, params.itemId, ctx.accountId);
  if (!item) return response({ error: 'Import item not found' }, 404);
  if (item.review_state === 'abandoned') return response({ error: 'Abandoned items cannot be accepted' }, 409);
  if (item.compass_entry_id) return response({ ...itemRow(item), already_accepted: true });
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
       VALUES (?, ?, ?, ?, ${compassColumns.map(() => '?').join(', ')})`
    ).bind(compassId, ctx.userId, ctx.accountId, params.itemId, ...compassColumns.map(column => compassValues[column as keyof typeof compassValues])),
    // The ownership EXISTS is part of the same D1 transaction as the insert.
    // A global id collision owned by anyone else makes this update a no-op.
    env.DB.prepare(
      `UPDATE curate_import_items SET review_state = ?, compass_entry_id = ?, reviewed_by_user_id = ?, reviewed_at = datetime('now'), updated_at = datetime('now')
       WHERE id = ? AND account_id = ? AND compass_entry_id IS NULL
         AND EXISTS (SELECT 1 FROM tea_compass_entries WHERE id = ? AND user_id = ? AND account_id = ? AND import_item_id = ?)`
    ).bind('accepted', compassId, ctx.userId, params.itemId, ctx.accountId, compassId, ctx.userId, ctx.accountId, params.itemId),
  ]);
  const linkedChanges = results[1]?.meta.changes ?? 0;
  const updated = await scopedItem(env, params.id, params.itemId, ctx.accountId);
  if (!updated?.compass_entry_id) return response({ error: 'Compass entry id is unavailable' }, 409);
  return response({ ...itemRow(updated), ...(linkedChanges ? {} : { already_accepted: true }) }, linkedChanges ? 201 : 200);
}

export async function mergeCurateImportItem(request: Request, env: ImportEnv, ctx: CurateImportContext, params: Record<string, string>) {
  const item = await scopedItem(env, params.id, params.itemId, ctx.accountId);
  if (!item) return response({ error: 'Import item not found' }, 404);
  if (item.review_state === 'abandoned') return response({ error: 'Abandoned items cannot be merged' }, 409);
  let body: Record<string, unknown>;
  try { body = object(await request.json()) ?? {}; } catch { return response({ error: 'Invalid JSON' }, 400); }
  const compassId = typeof body.compass_entry_id === 'string' ? body.compass_entry_id : '';
  if (!compassId) return response({ error: 'compass_entry_id is required' }, 400);
  const compass = await env.DB.prepare('SELECT id FROM tea_compass_entries WHERE id = ? AND account_id = ?').bind(compassId, ctx.accountId).first();
  if (!compass) return response({ error: 'Compass entry not found' }, 404);
  if (item.compass_entry_id && item.compass_entry_id !== compassId) return response({ error: 'Import item is already linked' }, 409);
  await env.DB.prepare(
    `UPDATE curate_import_items SET review_state = ?, compass_entry_id = ?, reviewed_by_user_id = ?, reviewed_at = datetime('now'), updated_at = datetime('now')
     WHERE id = ? AND account_id = ?`
  ).bind('merged', compassId, ctx.userId, params.itemId, ctx.accountId).run();
  return response(itemRow((await scopedItem(env, params.id, params.itemId, ctx.accountId))!));
}
