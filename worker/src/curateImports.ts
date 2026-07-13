import { compassValuesFromImport } from './compassCodec';
import { validateCurateContextPair } from './curateContextValidation';
import { buildImportAnalysisPrompt, decodeImportAnalysisProposal, normalizeImportProposal, renormalizeImportItemData, type ImportMatchCandidates } from './curateImportAnalysis';
import { CurateImportFinalizeError, finalizeCurateImport, type CurateFinalizeData, type FinalizeReceiptLine } from './curateImportFinalize';
import { decodeInventoryReceipt, inventoryPurposeConflict } from './inventoryDomain';

export interface CurateImportContext {
  accountId: string;
  userId: string;
}

interface ImportEnv {
  DB: D1Database;
  MEDIA_BUCKET?: R2Bucket;
  ANTHROPIC_API_KEY?: string;
  CURATE_IMPORT_ANALYSIS_MODEL?: string;
}

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
    manually_corrected_fields: parseJson(row.manually_corrected_fields_json, []),
    uncertainty_json: undefined,
    parsed_data_json: undefined,
    manually_corrected_fields_json: undefined,
  };
}

function groupRow(row: Record<string, unknown>) {
  return { ...row, vendor_confidence: row.vendor_confidence == null ? null : Number(row.vendor_confidence), uncertainty: parseJson(row.uncertainty_json, {}), uncertainty_json: undefined };
}

async function scopedBatch(env: ImportEnv, id: string, accountId: string) {
  return env.DB.prepare('SELECT * FROM curate_import_batches WHERE id = ? AND account_id = ?').bind(id, accountId).first<Record<string, unknown>>();
}

function batchIsTerminal(batch: Record<string, unknown>) { return batch.review_state === 'completed' || batch.review_state === 'abandoned' || typeof batch.finalize_idempotency_key === 'string'; }
function terminalResponse() { return response({ error: 'Completed or abandoned imports cannot be changed' }, 409); }
function analysisSupersededResponse() { return response({ error: 'Import analysis was superseded by finalization', code: 'analysis_superseded' }, 409); }

class AnalysisSupersededError extends Error {}

async function scopedItem(env: ImportEnv, batchId: string, itemId: string, accountId: string) {
  return env.DB.prepare('SELECT * FROM curate_import_items WHERE id = ? AND batch_id = ? AND account_id = ?').bind(itemId, batchId, accountId).first<Record<string, unknown>>();
}

async function fullBatch(env: ImportEnv, id: string, accountId: string) {
  const batch = await scopedBatch(env, id, accountId);
  if (!batch) return null;
  const [sources, groups, items] = await Promise.all([
    env.DB.prepare('SELECT * FROM curate_import_sources WHERE batch_id = ? AND account_id = ? ORDER BY created_at, id').bind(id, accountId).all<Record<string, unknown>>(),
    env.DB.prepare('SELECT * FROM curate_import_vendor_groups WHERE batch_id = ? AND account_id = ? ORDER BY position, created_at, id').bind(id, accountId).all<Record<string, unknown>>(),
    env.DB.prepare('SELECT * FROM curate_import_items WHERE batch_id = ? AND account_id = ? ORDER BY position, created_at, id').bind(id, accountId).all<Record<string, unknown>>(),
  ]);
  return { batch, sources: sources.results.map(sourceRow), groups: groups.results.map(groupRow), items: items.results.map(itemRow) };
}

function normalizedName(value: string | null | undefined) {
  return (value ?? '').normalize('NFKD').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function vendorMatch(name: string | null, vendors: ImportMatchCandidates['vendors']) {
  const target = normalizedName(name);
  if (!target) return { id: null, confidence: null };
  let best: { id: string | null; confidence: number | null } = { id: null, confidence: null };
  for (const vendor of vendors) {
    const names = [vendor.name, ...(vendor.aliases ?? [])].map(normalizedName).filter(Boolean);
    const confidence = names.some(candidate => candidate === target) ? 1
      : names.some(candidate => candidate.includes(target) || target.includes(candidate)) ? 0.72 : 0;
    if (confidence > (best.confidence ?? 0)) best = { id: vendor.id, confidence };
  }
  return best;
}

function resolveIdentityCandidate(item: ReturnType<typeof renormalizeImportItemData>, candidates: NonNullable<ImportMatchCandidates['identities']>, vendorName: string | null) {
  const englishNames = [item.englishName, item.originalName].map(normalizedName).filter(Boolean);
  const originalName = typeof item.originalName === 'string' ? item.originalName : '';
  const chineseName = normalizedName(typeof item.chineseName === 'string' ? item.chineseName : /\p{Script=Han}/u.test(originalName) ? originalName : null);
  const ranked = candidates.map(candidate => {
    if (candidate.category !== item.category) return { candidate, score: 0 };
    const candidateName = normalizedName(candidate.name);
    const candidateChinese = normalizedName(candidate.chineseName);
    let score = englishNames.includes(candidateName) && candidateName ? 0.32
      : englishNames.some(name => candidateName && (name.includes(candidateName) || candidateName.includes(name))) ? 0.16 : 0;
    if (chineseName && candidateChinese && chineseName === candidateChinese) score += 0.18;
    if (item.year != null && candidate.year != null && item.year === candidate.year) score += 0.1;
    if (normalizedName(item.originCountry as string | null) && normalizedName(item.originCountry as string | null) === normalizedName(candidate.originCountry)) score += 0.08;
    if (normalizedName(item.originRegion as string | null) && normalizedName(item.originRegion as string | null) === normalizedName(candidate.originRegion)) score += 0.1;
    if (normalizedName(item.type as string | null) && normalizedName(item.type as string | null) === normalizedName(candidate.type)) score += 0.08;
    if (normalizedName(item.form as string | null) && normalizedName(item.form as string | null) === normalizedName(candidate.form)) score += 0.07;
    if (normalizedName(item.classification as string | null) && normalizedName(item.classification as string | null) === normalizedName(candidate.classification)) score += 0.07;
    if (normalizedName(vendorName) && normalizedName(vendorName) === normalizedName(candidate.vendorName)) score += 0.08;
    return { candidate, score };
  }).sort((a, b) => b.score - a.score);
  const best = ranked[0];
  if (!best || best.score === 0) return { duplicateResolution: 'new' as const, proposedCompassEntryId: null, proposedProductId: null };
  const runnerUp = ranked[1]?.score ?? 0;
  const matched = best.score >= 0.72 && best.score - runnerUp >= 0.15;
  return { duplicateResolution: matched ? 'matched' as const : 'unresolved' as const, proposedCompassEntryId: best.candidate.id, proposedProductId: matched ? best.candidate.productId ?? null : null };
}

function anthopicText(value: unknown): string {
  const body = object(value);
  const content = body && Array.isArray(body.content) ? body.content : [];
  const textPart = content.find(part => object(part)?.type === 'text');
  const textValue = object(textPart)?.text;
  if (typeof textValue !== 'string') throw new Error('analysis_response_missing_text');
  return textValue.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
}

async function analysisEvidence(env: ImportEnv, sources: Record<string, unknown>[]) {
  if (sources.length > 50) throw new Error('analysis_too_many_sources');
  const evidenceSources: Array<{ id: string; kind: string; text?: string | null; mediaType?: string | null; objectKey?: string | null }> = [];
  const media: Array<Record<string, unknown>> = [];
  let totalText = 0;
  let totalMediaBytes = 0;
  for (const source of sources) {
    let extractedText = typeof source.pasted_text === 'string' ? source.pasted_text : null;
    const metadata = parseJson(source.metadata_json, {}) as Record<string, unknown>;
    const mediaType = typeof metadata.content_type === 'string' ? metadata.content_type : 'application/octet-stream';
    if (mediaType === 'application/msword' || mediaType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') throw new Error('analysis_unsupported_document');
    if (typeof source.r2_object_key === 'string' && env.MEDIA_BUCKET) {
      const stored = await env.MEDIA_BUCKET.get(source.r2_object_key);
      if (stored) {
        const bytes = new Uint8Array(await new Response(stored.body).arrayBuffer());
        if (bytes.byteLength > 5 * 1024 * 1024) throw new Error('analysis_media_too_large');
        if (['text/plain', 'text/csv', 'application/csv', 'application/json'].includes(mediaType)) {
          extractedText = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
          if (extractedText.length > 500_000) throw new Error('analysis_text_too_large');
        } else if (mediaType.startsWith('image/') || mediaType === 'application/pdf') {
          if (media.length >= 20 || (totalMediaBytes += bytes.byteLength) > 20 * 1024 * 1024) throw new Error('analysis_media_total_too_large');
          let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
          if (mediaType.startsWith('image/')) media.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: btoa(binary) } });
          else media.push({ type: 'document', source: { type: 'base64', media_type: mediaType, data: btoa(binary) } });
        }
      }
    }
    if (extractedText) {
      totalText += extractedText.length;
      if (totalText > 1_000_000) throw new Error('analysis_text_total_too_large');
    }
    evidenceSources.push({ id: String(source.id), kind: String(source.kind), text: extractedText, mediaType, objectKey: typeof source.r2_object_key === 'string' ? source.r2_object_key : null });
  }
  if (!evidenceSources.some(source => Boolean(source.text?.trim())) && !media.length) throw new Error('analysis_no_usable_evidence');
  return { evidence: { sources: evidenceSources }, media };
}

function validateEvidenceReferences(proposal: ReturnType<typeof normalizeImportProposal>, evidence: { sources: Array<{ id: string }> }) {
  const ids = new Set(evidence.sources.map(source => source.id));
  for (const item of proposal.groups.flatMap(group => group.items)) {
    if (!item.evidenceRefs.length || item.evidenceRefs.some(ref => !ids.has(ref.split(':')[0]))) throw new Error('analysis_invalid_evidence_reference');
  }
}

export async function analyzeCurateImport(_request: Request, env: ImportEnv, ctx: CurateImportContext, params: Record<string, string>) {
  const batch = await scopedBatch(env, params.id, ctx.accountId);
  if (!batch) return response({ error: 'Import not found' }, 404);
  if (batchIsTerminal(batch)) return terminalResponse();
  if (!env.ANTHROPIC_API_KEY) return response({ error: 'Import analysis is not configured' }, 503);
  const model = env.CURATE_IMPORT_ANALYSIS_MODEL || 'claude-sonnet-4-20250514';
  const attemptToken = crypto.randomUUID();
  const started = await env.DB.prepare("UPDATE curate_import_batches SET analysis_state = 'analyzing', analysis_error = NULL, analysis_attempt_token = ?, updated_at = datetime('now') WHERE id = ? AND account_id = ? AND review_state NOT IN ('completed', 'abandoned') AND finalize_idempotency_key IS NULL")
    .bind(attemptToken, params.id, ctx.accountId).run();
  if (!(started.meta.changes ?? 0)) return analysisSupersededResponse();
  try {
    const [sourcesResult, vendorsResult, priorVendorEvidenceResult, journeysResult, identitiesResult, productsResult, groupsResult, itemsResult] = await Promise.all([
      env.DB.prepare('SELECT * FROM curate_import_sources WHERE batch_id = ? AND account_id = ? ORDER BY created_at, id').bind(params.id, ctx.accountId).all<Record<string, unknown>>(),
      env.DB.prepare('SELECT id, name, company, tags FROM customers WHERE account_id = ? ORDER BY name LIMIT 200').bind(ctx.accountId).all<Record<string, unknown>>(),
      env.DB.prepare('SELECT proposed_vendor_name, resolved_vendor_customer_id FROM curate_import_vendor_groups WHERE account_id = ? AND resolved_vendor_customer_id IS NOT NULL').bind(ctx.accountId).all<Record<string, unknown>>(),
      env.DB.prepare('SELECT id, name FROM curate_journeys WHERE account_id = ? ORDER BY created_at DESC').bind(ctx.accountId).all<Record<string, unknown>>(),
      env.DB.prepare('SELECT id, name, chinese_name, category, draft_product_id, year, origin_region, type, form, vendor_name FROM tea_compass_entries WHERE account_id = ? AND user_id = ? ORDER BY updated_at DESC LIMIT 200').bind(ctx.accountId, ctx.userId).all<Record<string, unknown>>(),
      env.DB.prepare('SELECT id, source_compass_entry_id, product_name, given_name, chinese_name, type, form, year, origin_country, origin_region, vendor, inventory_purpose FROM products WHERE account_id = ?').bind(ctx.accountId).all<Record<string, unknown>>(),
      env.DB.prepare('SELECT * FROM curate_import_vendor_groups WHERE batch_id = ? AND account_id = ? ORDER BY position').bind(params.id, ctx.accountId).all<Record<string, unknown>>(),
      env.DB.prepare('SELECT * FROM curate_import_items WHERE batch_id = ? AND account_id = ? ORDER BY position').bind(params.id, ctx.accountId).all<Record<string, unknown>>(),
    ]);
    const vendors = vendorsResult.results.filter(row => {
      const tags = parseJson(row.tags, []); return Array.isArray(tags) && tags.includes('vendor');
    }).map(row => ({
      id: String(row.id), name: String(row.name),
      aliases: [row.company, ...priorVendorEvidenceResult.results.filter(evidence => evidence.resolved_vendor_customer_id === row.id).map(evidence => evidence.proposed_vendor_name)]
        .filter(value => typeof value === 'string' && value) as string[],
    }));
    const productsByIdentity = new Map(productsResult.results.filter(row => typeof row.source_compass_entry_id === 'string').map(row => [String(row.source_compass_entry_id), row]));
    const candidates: ImportMatchCandidates = {
      vendors,
      journeys: journeysResult.results.map(row => ({ id: String(row.id), name: String(row.name) })),
      identities: identitiesResult.results.map(row => {
        const product = productsByIdentity.get(String(row.id));
        return { id: String(row.id), name: typeof row.name === 'string' ? row.name : typeof product?.given_name === 'string' ? product.given_name : null, chineseName: typeof row.chinese_name === 'string' ? row.chinese_name : typeof product?.chinese_name === 'string' ? product.chinese_name : null, category: row.category === 'teaware' ? 'teaware' : 'tea', productId: product ? String(product.id) : (typeof row.draft_product_id === 'string' ? row.draft_product_id : null), year: typeof row.year === 'number' ? row.year : typeof product?.year === 'string' ? Number(product.year) : null, originCountry: typeof product?.origin_country === 'string' ? product.origin_country : null, originRegion: typeof row.origin_region === 'string' ? row.origin_region : typeof product?.origin_region === 'string' ? product.origin_region : null, type: typeof row.type === 'string' ? row.type : typeof product?.type === 'string' ? product.type : null, form: typeof row.form === 'string' ? row.form : typeof product?.form === 'string' ? product.form : null, classification: typeof product?.type === 'string' ? product.type : null, vendorName: typeof row.vendor_name === 'string' ? row.vendor_name : typeof product?.vendor === 'string' ? product.vendor : null };
      }),
      products: productsResult.results.map(row => ({ id: String(row.id), compassEntryId: typeof row.source_compass_entry_id === 'string' ? row.source_compass_entry_id : null, name: typeof row.given_name === 'string' ? row.given_name : typeof row.product_name === 'string' ? row.product_name : null, category: row.type === 'Teaware' ? 'teaware' : 'tea', purpose: typeof row.inventory_purpose === 'string' ? row.inventory_purpose : null })),
    };
    const { evidence, media } = await analysisEvidence(env, sourcesResult.results);
    const ai = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 8192, temperature: 0, messages: [{ role: 'user', content: [...media, { type: 'text', text: buildImportAnalysisPrompt(evidence, candidates) }] }] }),
    });
    if (!ai.ok) throw new Error(`analysis_provider_${ai.status}`);
    const normalized = normalizeImportProposal(decodeImportAnalysisProposal(JSON.parse(anthopicText(await ai.json()))));
    validateEvidenceReferences(normalized, evidence);
    normalized.groups = normalized.groups.map(group => ({ ...group, items: group.items.map(item => renormalizeImportItemData({ ...item, ...resolveIdentityCandidate(item, candidates.identities ?? [], group.proposedVendorName) })) }));
    const existingGroups = new Map(groupsResult.results.map(row => [String(row.group_key), row]));
    const existingItems = new Map(itemsResult.results.map(row => [String((parseJson(row.parsed_data_json, {}) as Record<string, unknown>).sourceItemId ?? ''), row]));
    const keptGroupIds = new Set<string>();
    const keptItemIds = new Set<string>();
    const statements: D1PreparedStatement[] = [];
    let position = 0;
    for (let groupPosition = 0; groupPosition < normalized.groups.length; groupPosition++) {
      const group = normalized.groups[groupPosition];
      const existingGroup = existingGroups.get(group.key);
      const groupId = existingGroup ? String(existingGroup.id) : crypto.randomUUID();
      keptGroupIds.add(groupId);
      const matched = vendorMatch(group.proposedVendorName, vendors);
      const proposedCandidate = group.proposedVendorCustomerId && vendors.some(vendor => vendor.id === group.proposedVendorCustomerId) ? group.proposedVendorCustomerId : matched.id;
      const confidence = group.vendorConfidence ?? matched.confidence;
      const resolvedVendor = confidence != null && confidence >= 0.9 ? proposedCandidate : null;
      if (existingGroup) statements.push(env.DB.prepare(
        `UPDATE curate_import_vendor_groups SET position = ?, proposed_vendor_name = ?, resolved_vendor_customer_id = COALESCE(resolved_vendor_customer_id, ?), vendor_confidence = ?, uncertainty_json = ?, updated_at = datetime('now')
         WHERE id = ? AND account_id = ? AND EXISTS (SELECT 1 FROM curate_import_batches WHERE analysis_attempt_token = ? AND id = ? AND account_id = ? AND review_state NOT IN ('completed', 'abandoned') AND finalize_idempotency_key IS NULL)`
      ).bind(groupPosition, group.proposedVendorName, resolvedVendor, confidence, JSON.stringify(group.uncertainty ?? {}), groupId, ctx.accountId, attemptToken, params.id, ctx.accountId));
      else statements.push(env.DB.prepare(
        `INSERT INTO curate_import_vendor_groups (id, batch_id, account_id, position, group_key, proposed_vendor_name, resolved_vendor_customer_id, vendor_confidence, uncertainty_json)
         SELECT ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM curate_import_batches WHERE analysis_attempt_token = ? AND id = ? AND account_id = ? AND review_state NOT IN ('completed', 'abandoned') AND finalize_idempotency_key IS NULL)`
      ).bind(groupId, params.id, ctx.accountId, groupPosition, group.key, group.proposedVendorName, resolvedVendor, confidence, JSON.stringify(group.uncertainty ?? {}), attemptToken, params.id, ctx.accountId));
      for (const proposed of group.items) {
        const existing = existingItems.get(proposed.sourceItemId);
        const itemId = existing ? String(existing.id) : crypto.randomUUID();
        keptItemIds.add(itemId);
        const manual = existing ? parseJson(existing.manually_corrected_fields_json, []) : [];
        const manualFields = Array.isArray(manual) ? manual.filter(value => typeof value === 'string') as string[] : [];
        const previousParsed = existing ? parseJson(existing.parsed_data_json, {}) as Record<string, unknown> : {};
        const parsed: Record<string, unknown> = { ...proposed };
        for (const path of manualFields) if (path.startsWith('parsed_data.')) {
          const key = path.slice('parsed_data.'.length); parsed[key] = previousParsed[key];
        }
        const normalizedParsed = renormalizeImportItemData(parsed);
        const name = manualFields.includes('name') ? existing?.name : (normalizedParsed.englishName ?? normalizedParsed.originalName ?? null);
        const category = manualFields.includes('category') ? existing?.category : proposed.category;
        const uncertainty = manualFields.includes('uncertainty') ? parseJson(existing?.uncertainty_json, {}) : proposed.uncertainty;
        if (existing) statements.push(env.DB.prepare(
          `UPDATE curate_import_items SET vendor_group_id = ?, position = ?, category = ?, name = ?, parsed_data_json = ?, confidence = ?, uncertainty_json = ?, review_state = 'reviewing', updated_at = datetime('now')
           WHERE id = ? AND batch_id = ? AND account_id = ? AND EXISTS (SELECT 1 FROM curate_import_batches WHERE analysis_attempt_token = ? AND id = ? AND account_id = ? AND review_state NOT IN ('completed', 'abandoned') AND finalize_idempotency_key IS NULL)`
        ).bind(groupId, position++, category, name, JSON.stringify(normalizedParsed), Object.values(proposed.confidence).length ? Math.min(...Object.values(proposed.confidence)) : null, JSON.stringify(uncertainty), itemId, params.id, ctx.accountId, attemptToken, params.id, ctx.accountId));
        else statements.push(env.DB.prepare(
          `INSERT INTO curate_import_items (id, batch_id, source_id, account_id, created_by_user_id, position, category, name, raw_text, parsed_data_json, confidence, uncertainty_json, review_state, compass_entry_id, reserved_compass_entry_id, vendor_group_id, manually_corrected_fields_json)
           SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'reviewing', NULL, ?, ?, '[]' WHERE EXISTS (SELECT 1 FROM curate_import_batches WHERE analysis_attempt_token = ? AND id = ? AND account_id = ? AND review_state NOT IN ('completed', 'abandoned') AND finalize_idempotency_key IS NULL)`
        ).bind(itemId, params.id, null, ctx.accountId, ctx.userId, position++, category, name, null, JSON.stringify(normalizedParsed), Object.values(proposed.confidence).length ? Math.min(...Object.values(proposed.confidence)) : null, JSON.stringify(proposed.uncertainty), crypto.randomUUID(), groupId, attemptToken, params.id, ctx.accountId));
      }
    }
    for (const row of itemsResult.results) if (!keptItemIds.has(String(row.id)) && !(parseJson(row.manually_corrected_fields_json, []) as unknown[]).length) {
      statements.push(env.DB.prepare("DELETE FROM curate_import_items WHERE id = ? AND batch_id = ? AND account_id = ? AND EXISTS (SELECT 1 FROM curate_import_batches WHERE analysis_attempt_token = ? AND id = ? AND account_id = ? AND review_state NOT IN ('completed', 'abandoned') AND finalize_idempotency_key IS NULL)").bind(row.id, params.id, ctx.accountId, attemptToken, params.id, ctx.accountId));
    }
    for (const row of groupsResult.results) if (!keptGroupIds.has(String(row.id))) {
      statements.push(env.DB.prepare("DELETE FROM curate_import_vendor_groups WHERE id = ? AND batch_id = ? AND account_id = ? AND EXISTS (SELECT 1 FROM curate_import_batches WHERE analysis_attempt_token = ? AND id = ? AND account_id = ? AND review_state NOT IN ('completed', 'abandoned') AND finalize_idempotency_key IS NULL)").bind(row.id, params.id, ctx.accountId, attemptToken, params.id, ctx.accountId));
    }
    statements.push(env.DB.prepare(
      "UPDATE curate_import_batches SET review_state = 'reviewing', analysis_state = 'complete', analysis_overview = ?, analysis_language = ?, analysis_version = analysis_version + 1, analysis_model = ?, analysis_error = NULL, analysis_attempt_token = NULL, updated_at = datetime('now') WHERE analysis_attempt_token = ? AND id = ? AND account_id = ? AND review_state NOT IN ('completed', 'abandoned') AND finalize_idempotency_key IS NULL"
    ).bind(normalized.overview, normalized.language, model, attemptToken, params.id, ctx.accountId));
    const persisted = await env.DB.batch(statements);
    if (!(persisted.at(-1)?.meta.changes ?? 0)) throw new AnalysisSupersededError();
    return response(await fullBatch(env, params.id, ctx.accountId));
  } catch (error) {
    if (error instanceof AnalysisSupersededError) return analysisSupersededResponse();
    const message = error instanceof Error ? error.message.slice(0, 500) : 'analysis_failed';
    const failed = await env.DB.prepare("UPDATE curate_import_batches SET analysis_state = 'failed', analysis_error = ?, analysis_attempt_token = NULL, updated_at = datetime('now') WHERE analysis_attempt_token = ? AND id = ? AND account_id = ? AND review_state NOT IN ('completed', 'abandoned') AND finalize_idempotency_key IS NULL")
      .bind(message, attemptToken, params.id, ctx.accountId).run();
    if (!(failed.meta.changes ?? 0)) return analysisSupersededResponse();
    const status = message === 'analysis_no_usable_evidence' ? 422 : message === 'analysis_unsupported_document' ? 415 : 502;
    return response({ error: 'Import analysis failed', code: message }, status);
  }
}

export type CurateFinalizeMovement = (line: FinalizeReceiptLine, idempotencyKey: string) => Promise<{ movementId: string }>;

function parsedFinalizeItem(row: Record<string, unknown>) {
  const parsed = parseJson(row.parsed_data_json, {}) as Record<string, unknown>;
  const category = row.category === 'teaware' ? 'teaware' : 'tea';
  const quantity = category === 'teaware' ? parsed.totalUnits : parsed.totalQuantityGrams;
  const unit = category === 'teaware' ? 'unit' : 'g';
  const purpose = parsed.inventoryPurpose ?? parsed.inventory_purpose ?? parsed.purpose ?? null;
  const productId = parsed.productId ?? parsed.product_id ?? null;
  return {
    id: String(row.id), groupId: String(row.vendor_group_id ?? ''), category,
    name: String(row.name ?? parsed.englishName ?? parsed.originalName ?? ''),
    compassEntryId: typeof row.compass_entry_id === 'string' ? row.compass_entry_id : parsed.duplicateResolution === 'matched' && typeof parsed.proposedCompassEntryId === 'string' ? parsed.proposedCompassEntryId : null,
    productId: typeof productId === 'string' ? productId : parsed.duplicateResolution === 'matched' && typeof parsed.proposedProductId === 'string' ? parsed.proposedProductId : null,
    duplicateResolution: parsed.duplicateResolution === 'matched' || parsed.duplicateResolution === 'new' || parsed.duplicateResolution === 'unresolved' ? parsed.duplicateResolution : 'unresolved',
    quantity: typeof quantity === 'number' ? quantity : null, unit,
    packCount: typeof parsed.packCount === 'number' ? parsed.packCount : null,
    lineCost: typeof parsed.lineCost === 'number' ? parsed.lineCost : null,
    lineCostExact: typeof parsed.lineCostExact === 'string' ? parsed.lineCostExact : null,
    currency: typeof parsed.currency === 'string' ? parsed.currency : null,
    unitCost: typeof parsed.unitCost === 'number' ? parsed.unitCost : null,
    unitCostExact: typeof parsed.unitCostExact === 'string' ? parsed.unitCostExact : null,
    purpose: purpose === 'working' || purpose === 'sample' || purpose === 'personal' ? purpose : null,
    blockingFields: Array.isArray(parsed.blockingFields) ? parsed.blockingFields.filter(value => typeof value === 'string') as string[] : [],
  } as const;
}

export async function finalizeCurateImportRequest(request: Request, env: ImportEnv, ctx: CurateImportContext, params: Record<string, string>, receiveLine: CurateFinalizeMovement) {
  let body: Record<string, unknown>;
  try { body = object(await request.json()) ?? {}; } catch { return response({ error: 'Invalid JSON' }, 400); }
  const idempotencyKey = typeof body.idempotency_key === 'string' ? body.idempotency_key.trim() : '';
  try {
    const result = await finalizeCurateImport({
      accountId: ctx.accountId, userId: ctx.userId,
      loadImport: async batchId => {
        const batch = await scopedBatch(env, batchId, ctx.accountId);
        if (!batch) return null;
        const [groupRows, itemRows] = await Promise.all([
          env.DB.prepare(`SELECT g.*, c.name vendor_name, c.tags vendor_tags FROM curate_import_vendor_groups g
            LEFT JOIN customers c ON c.id = g.resolved_vendor_customer_id AND c.account_id = g.account_id
            WHERE g.batch_id = ? AND g.account_id = ? ORDER BY g.position`).bind(batchId, ctx.accountId).all<Record<string, unknown>>(),
          env.DB.prepare('SELECT * FROM curate_import_items WHERE batch_id = ? AND account_id = ? AND review_state != ? ORDER BY position').bind(batchId, ctx.accountId, 'abandoned').all<Record<string, unknown>>(),
        ]);
        const groups = groupRows.results.map(row => {
          const tags = parseJson(row.vendor_tags, []);
          const validVendor = typeof row.resolved_vendor_customer_id === 'string' && Array.isArray(tags) && tags.includes('vendor');
          return { id: String(row.id), vendorId: validVendor ? String(row.resolved_vendor_customer_id) : null, vendorName: typeof row.vendor_name === 'string' ? row.vendor_name : null, position: Number(row.position) };
        });
        return {
          batch: { id: batchId, accountId: ctx.accountId, journeyId: typeof batch.journey_id === 'string' ? batch.journey_id : null, reviewState: String(batch.review_state) },
          groups, items: itemRows.results.map(parsedFinalizeItem),
        } as CurateFinalizeData;
      },
      loadFinalization: async batchId => {
        const batch = await scopedBatch(env, batchId, ctx.accountId);
        if (!batch || typeof batch.finalize_idempotency_key !== 'string') return null;
        return { idempotencyKey: batch.finalize_idempotency_key, result: typeof batch.finalize_result_json === 'string' ? parseJson(batch.finalize_result_json, null) : null };
      },
      reserveFinalization: async (batchId, key) => {
        const changed = await env.DB.prepare("UPDATE curate_import_batches SET finalize_idempotency_key = ?, analysis_attempt_token = NULL, analysis_state = CASE WHEN analysis_state = 'analyzing' THEN 'complete' ELSE analysis_state END WHERE id = ? AND account_id = ? AND review_state NOT IN ('completed', 'abandoned') AND (finalize_idempotency_key IS NULL OR finalize_idempotency_key = ?)")
          .bind(key, batchId, ctx.accountId, key).run();
        if (!(changed.meta.changes ?? 0)) throw new CurateImportFinalizeError('idempotency_conflict', 'Import was already finalized with a different idempotency key');
      },
      ensureIdentity: async (item, batch) => {
        if (item.compassEntryId) {
          const owned = await env.DB.prepare('SELECT id, category FROM tea_compass_entries WHERE id = ? AND account_id = ? AND user_id = ?').bind(item.compassEntryId, ctx.accountId, ctx.userId).first<Record<string, unknown>>();
          if (owned?.category === item.category) {
            await env.DB.prepare("UPDATE curate_import_items SET compass_entry_id = ?, review_state = 'merged', reviewed_by_user_id = ?, reviewed_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND batch_id = ? AND account_id = ?")
              .bind(item.compassEntryId, ctx.userId, item.id, batch.id, ctx.accountId).run();
            return item.compassEntryId;
          }
          if (item.duplicateResolution === 'matched') throw new CurateImportFinalizeError('validation_failed', 'Matched Curate identity is missing or incompatible', [{ field: 'duplicateResolution', itemId: item.id, message: 'Choose a valid matching identity' }]);
        }
        const row = await scopedItem(env, batch.id, item.id, ctx.accountId);
        if (!row) throw new CurateImportFinalizeError('not_found', 'Import item not found');
        const compassId = String(row.reserved_compass_entry_id);
        const parsed = parseJson(row.parsed_data_json, {}) as Record<string, unknown>;
        const structured = compassValuesFromImport(parsed);
        const values = { ...structured, name: item.name, category: item.category, notes: row.raw_text ?? null, status: 'logged', journey_id: batch.journeyId };
        const columns = Object.keys(values);
        await env.DB.batch([
          env.DB.prepare(`INSERT OR IGNORE INTO tea_compass_entries (id, user_id, account_id, import_item_id, ${columns.join(', ')}) VALUES (?, ?, ?, ?, ${columns.map(() => '?').join(', ')})`)
            .bind(compassId, ctx.userId, ctx.accountId, item.id, ...columns.map(column => values[column as keyof typeof values])),
          env.DB.prepare("UPDATE curate_import_items SET compass_entry_id = ?, review_state = 'accepted', reviewed_by_user_id = ?, reviewed_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND batch_id = ? AND account_id = ?")
            .bind(compassId, ctx.userId, item.id, batch.id, ctx.accountId),
        ]);
        const owned = await env.DB.prepare('SELECT id FROM tea_compass_entries WHERE id = ? AND account_id = ? AND user_id = ? AND import_item_id = ?').bind(compassId, ctx.accountId, ctx.userId, item.id).first();
        if (!owned) throw new Error('Compass identity could not be resolved');
        return compassId;
      },
      ensureProduct: async (item, compassEntryId) => {
        if (item.productId) {
          const owned = await env.DB.prepare('SELECT * FROM products WHERE id = ? AND account_id = ?').bind(item.productId, ctx.accountId).first<Record<string, unknown>>();
          const categoryMatches = owned && (owned.type === 'Teaware') === (item.category === 'teaware');
          const identityMatches = owned?.source_compass_entry_id === compassEntryId;
          if (!owned || !categoryMatches || !identityMatches) throw new CurateImportFinalizeError('validation_failed', 'Selected holding does not belong to this Curate identity', [{ field: 'product', itemId: item.id, message: 'Choose a matching holding' }]);
          const conflict = inventoryPurposeConflict(owned, item.purpose!);
          if (conflict) throw new CurateImportFinalizeError('validation_failed', 'Selected holding has a different inventory purpose', [{ field: 'purpose', itemId: item.id, message: `Holding is ${conflict}` }]);
          return item.productId;
        }
        const entry = await env.DB.prepare('SELECT draft_product_id, type, chinese_name, origin_region, year FROM tea_compass_entries WHERE id = ? AND account_id = ? AND user_id = ?').bind(compassEntryId, ctx.accountId, ctx.userId).first<Record<string, unknown>>();
        if (typeof entry?.draft_product_id === 'string') {
          const owned = await env.DB.prepare('SELECT * FROM products WHERE id = ? AND account_id = ?').bind(entry.draft_product_id, ctx.accountId).first<Record<string, unknown>>();
          if (owned && !inventoryPurposeConflict(owned, item.purpose!)) return entry.draft_product_id;
        }
        const identity = await env.DB.prepare('SELECT * FROM products WHERE account_id = ? AND source_compass_entry_id = ?').bind(ctx.accountId, compassEntryId).first<Record<string, unknown>>();
        if (identity) {
          const categoryMatches = (identity.type === 'Teaware') === (item.category === 'teaware');
          const conflict = inventoryPurposeConflict(identity, item.purpose!);
          if (!categoryMatches || conflict) throw new CurateImportFinalizeError('validation_failed', 'Existing identity holding is incompatible with this import', [{ field: conflict ? 'purpose' : 'product', itemId: item.id, message: conflict ? `Holding is ${conflict}` : 'Holding category differs' }]);
          return String(identity.id);
        }
        const productId = crypto.randomUUID();
        await env.DB.batch([
          env.DB.prepare(`INSERT OR IGNORE INTO products (id, account_id, type, product_name, given_name, chinese_name, year, origin_region, status, stock_grams, quantity_units, inventory_purpose, is_sample, is_personal, stock_known_at, is_public, shown_in_shop, source_compass_entry_id, owner_user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Draft', ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`)
            .bind(productId, ctx.accountId, item.category === 'teaware' ? 'Teaware' : (entry?.type ?? 'Misc'), item.name, item.name, entry?.chinese_name ?? null, entry?.year ?? null, entry?.origin_region ?? null,
              item.unit === 'g' ? 0 : null, item.unit === 'unit' ? 0 : null, item.purpose, item.purpose === 'sample' ? 1 : 0, item.purpose === 'personal' ? 1 : 0, new Date().toISOString(), compassEntryId, ctx.userId),
          env.DB.prepare("UPDATE tea_compass_entries SET draft_product_id = (SELECT id FROM products WHERE account_id = ? AND source_compass_entry_id = ?), updated_at = datetime('now') WHERE id = ? AND account_id = ? AND user_id = ?")
            .bind(ctx.accountId, compassEntryId, compassEntryId, ctx.accountId, ctx.userId),
        ]);
        const canonical = await env.DB.prepare('SELECT id FROM products WHERE account_id = ? AND source_compass_entry_id = ?').bind(ctx.accountId, compassEntryId).first<Record<string, unknown>>();
        if (!canonical) throw new Error('Inventory holding could not be resolved');
        return String(canonical.id);
      },
      createReceipt: async (group, lines, key, journeyId) => {
        if (!lines.length) throw new CurateImportFinalizeError('validation_failed', 'Inventory receipt cannot be empty', [{ field: 'items', groupId: group.id, message: 'Add at least one item' }]);
        for (const line of lines) decodeInventoryReceipt({ product_id: line.productId, quantity: line.quantity, unit: line.unit, intended_purpose: line.purpose, source_kind: 'curate_import', source_ref: line.itemId });
        const linked = await env.DB.prepare(`SELECT r.inventory_receipt_id FROM curate_import_receipts r WHERE r.account_id = ? AND r.vendor_group_id = ?`).bind(ctx.accountId, group.id).first<Record<string, unknown>>();
        let receiptId = linked ? String(linked.inventory_receipt_id) : '';
        if (!receiptId) {
          receiptId = crypto.randomUUID();
          const fingerprint = JSON.stringify({ batch_id: params.id, vendor_group_id: group.id, journey_id: journeyId, lines });
          const statements: D1PreparedStatement[] = [env.DB.prepare(`INSERT INTO inventory_receipts (id, account_id, state, vendor_name, source_kind, source_ref, created_by_user_id, idempotency_key, request_fingerprint) VALUES (?, ?, 'in_transit', ?, 'curate_import', ?, ?, ?, ?)`)
            .bind(receiptId, ctx.accountId, group.vendorName, journeyId ?? params.id, ctx.userId, key, fingerprint)];
          for (const line of lines) statements.push(env.DB.prepare(`INSERT INTO inventory_receipt_lines (id, receipt_id, account_id, product_id, expected_quantity, unit, intended_purpose, source_kind, source_ref, original_cost_amount, original_cost_currency, original_unit_cost, pack_count, original_cost_amount_exact, original_unit_cost_exact) VALUES (?, ?, ?, ?, ?, ?, ?, 'curate_import', ?, ?, ?, ?, ?, ?, ?)`)
            .bind(crypto.randomUUID(), receiptId, ctx.accountId, line.productId, line.quantity, line.unit, line.purpose, line.itemId, line.originalCostAmount, line.originalCostCurrency, line.originalUnitCost, line.packCount, line.originalCostAmountExact, line.originalUnitCostExact));
          statements.push(env.DB.prepare('INSERT INTO curate_import_receipts (id, account_id, batch_id, vendor_group_id, inventory_receipt_id) VALUES (?, ?, ?, ?, ?)').bind(crypto.randomUUID(), ctx.accountId, params.id, group.id, receiptId));
          try { await env.DB.batch(statements); } catch (error) {
            const raced = await env.DB.prepare('SELECT inventory_receipt_id FROM curate_import_receipts WHERE account_id = ? AND vendor_group_id = ?').bind(ctx.accountId, group.id).first<Record<string, unknown>>();
            if (!raced) throw error; receiptId = String(raced.inventory_receipt_id);
          }
        }
        const rows = await env.DB.prepare('SELECT * FROM inventory_receipt_lines WHERE receipt_id = ? AND account_id = ? ORDER BY created_at, id').bind(receiptId, ctx.accountId).all<Record<string, unknown>>();
        return { id: receiptId, groupId: group.id, lines: rows.results.map(row => ({
          id: String(row.id), receiptId, itemId: String(row.source_ref), productId: String(row.product_id),
          compassEntryId: lines.find(line => line.itemId === row.source_ref)?.compassEntryId ?? '', quantity: Number(row.expected_quantity), unit: row.unit as 'g' | 'unit',
          purpose: row.intended_purpose as 'working' | 'sample' | 'personal', originalCostAmount: Number(row.original_cost_amount), originalCostCurrency: String(row.original_cost_currency),
          originalUnitCost: Number(row.original_unit_cost), packCount: Number(row.pack_count), originalCostAmountExact: String(row.original_cost_amount_exact ?? row.original_cost_amount), originalUnitCostExact: String(row.original_unit_cost_exact ?? row.original_unit_cost),
        })) };
      },
      receiveLine,
      complete: async (batchId, key, finalizeResult) => {
        const changed = await env.DB.prepare(`UPDATE curate_import_batches SET review_state = 'completed', finalize_idempotency_key = ?, finalize_result_json = ?, analysis_state = CASE WHEN analysis_state = 'analyzing' THEN 'complete' ELSE analysis_state END, completed_at = datetime('now'), updated_at = datetime('now')
          WHERE id = ? AND account_id = ? AND (finalize_idempotency_key IS NULL OR finalize_idempotency_key = ?)`)
          .bind(key, JSON.stringify(finalizeResult), batchId, ctx.accountId, key).run();
        if (!(changed.meta.changes ?? 0)) throw new CurateImportFinalizeError('idempotency_conflict', 'Import was finalized by another request');
      },
    }, params.id, idempotencyKey);
    return response({ batch: await scopedBatch(env, params.id, ctx.accountId), receipts: result.receipts, items: result.items });
  } catch (error) {
    if (error instanceof CurateImportFinalizeError) {
      const status = error.code === 'not_found' ? 404 : 409;
      return response({ error: error.message, code: error.code, issues: error.issues }, status);
    }
    console.error('Curate import finalization failed', error);
    return response({ error: 'Import finalization failed' }, 500);
  }
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

export async function updateCurateImportGroup(request: Request, env: ImportEnv, ctx: CurateImportContext, params: Record<string, string>) {
  const batch = await scopedBatch(env, params.id, ctx.accountId);
  if (!batch) return response({ error: 'Import not found' }, 404);
  if (batchIsTerminal(batch)) return terminalResponse();
  const group = await env.DB.prepare('SELECT * FROM curate_import_vendor_groups WHERE id = ? AND batch_id = ? AND account_id = ?').bind(params.groupId, params.id, ctx.accountId).first<Record<string, unknown>>();
  if (!group) return response({ error: 'Vendor group not found' }, 404);
  let body: Record<string, unknown>;
  try { body = object(await request.json()) ?? {}; } catch { return response({ error: 'Invalid JSON' }, 400); }
  if (Object.keys(body).some(key => key !== 'resolved_vendor_customer_id')) return response({ error: 'Unknown update field' }, 400);
  const vendorId = body.resolved_vendor_customer_id;
  if (vendorId !== null && typeof vendorId !== 'string') return response({ error: 'Invalid vendor' }, 400);
  if (typeof vendorId === 'string') {
    const vendor = await env.DB.prepare('SELECT id, tags FROM customers WHERE id = ? AND account_id = ?').bind(vendorId, ctx.accountId).first<Record<string, unknown>>();
    const tags = parseJson(vendor?.tags, []);
    if (!vendor || !Array.isArray(tags) || !tags.includes('vendor')) return response({ error: 'Selected customer is not tagged as a vendor' }, 400);
  }
  const changed = await env.DB.prepare("UPDATE curate_import_vendor_groups SET resolved_vendor_customer_id = ?, updated_at = datetime('now') WHERE id = ? AND account_id = ? AND EXISTS (SELECT 1 FROM curate_import_batches WHERE id = ? AND account_id = ? AND review_state NOT IN ('completed', 'abandoned') AND finalize_idempotency_key IS NULL)")
    .bind(vendorId, params.groupId, ctx.accountId, params.id, ctx.accountId).run();
  if (!(changed.meta.changes ?? 0)) return terminalResponse();
  const updated = await env.DB.prepare('SELECT * FROM curate_import_vendor_groups WHERE id = ? AND batch_id = ? AND account_id = ?').bind(params.groupId, params.id, ctx.accountId).first<Record<string, unknown>>();
  return response(groupRow(updated!));
}

export async function createVendorForCurateImportGroup(request: Request, env: ImportEnv, ctx: CurateImportContext, params: Record<string, string>) {
  const batch = await scopedBatch(env, params.id, ctx.accountId);
  if (!batch) return response({ error: 'Import not found' }, 404);
  if (batchIsTerminal(batch)) return terminalResponse();
  const group = await env.DB.prepare('SELECT * FROM curate_import_vendor_groups WHERE id = ? AND batch_id = ? AND account_id = ?').bind(params.groupId, params.id, ctx.accountId).first<Record<string, unknown>>();
  if (!group) return response({ error: 'Vendor group not found' }, 404);
  let body: Record<string, unknown>;
  try { body = object(await request.json()) ?? {}; } catch { return response({ error: 'Invalid JSON' }, 400); }
  let name: string;
  try { name = text(body.name, 240, true)!; } catch { return response({ error: 'Vendor name is required' }, 400); }
  if (typeof group.resolved_vendor_customer_id === 'string') {
    const existing = await env.DB.prepare('SELECT * FROM customers WHERE id = ? AND account_id = ?').bind(group.resolved_vendor_customer_id, ctx.accountId).first<Record<string, unknown>>();
    const tags = parseJson(existing?.tags, []);
    if (existing && Array.isArray(tags) && tags.includes('vendor')) {
      if (normalizedName(String(existing.name)) !== normalizedName(name)) return response({ error: 'Vendor group already created with a different name' }, 409);
      return response({ vendor: existing, group: groupRow(group) });
    }
  }
  const vendorId = `curate-vendor-${params.groupId}`;
  const deterministicWinner = await env.DB.prepare('SELECT * FROM customers WHERE id = ? AND account_id = ?').bind(vendorId, ctx.accountId).first<Record<string, unknown>>();
  if (deterministicWinner && normalizedName(String(deterministicWinner.name)) !== normalizedName(name)) return response({ error: 'Vendor group was concurrently created with a different name' }, 409);
  const results = await env.DB.batch([
    env.DB.prepare(`INSERT OR IGNORE INTO customers (id, account_id, name, company, email, phone, whatsapp, country, preferred_currency, tags, notes, source)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, '["vendor"]', ?, 'curate_import' WHERE EXISTS (SELECT 1 FROM curate_import_batches WHERE id = ? AND account_id = ? AND review_state NOT IN ('completed', 'abandoned') AND finalize_idempotency_key IS NULL)`)
      .bind(vendorId, ctx.accountId, name, text(body.company, 240), text(body.email, 320), text(body.phone, 100), text(body.whatsapp, 100), text(body.country, 120), text(body.preferred_currency, 20), text(body.notes, 2000), params.id, ctx.accountId),
    env.DB.prepare(`UPDATE curate_import_vendor_groups SET resolved_vendor_customer_id = ?, updated_at = datetime('now')
      WHERE id = ? AND account_id = ?
        AND EXISTS (SELECT 1 FROM customers WHERE id = ? AND account_id = ? AND name = ?)
        AND EXISTS (SELECT 1 FROM curate_import_batches WHERE id = ? AND account_id = ? AND review_state NOT IN ('completed', 'abandoned') AND finalize_idempotency_key IS NULL)`)
      .bind(vendorId, params.groupId, ctx.accountId, vendorId, ctx.accountId, name, params.id, ctx.accountId),
  ]);
  const winner = await env.DB.prepare('SELECT * FROM customers WHERE id = ? AND account_id = ?').bind(vendorId, ctx.accountId).first<Record<string, unknown>>();
  if (!winner || normalizedName(String(winner.name)) !== normalizedName(name)) return response({ error: 'Vendor group was concurrently created with a different name' }, 409);
  if (!(results[1]?.meta.changes ?? 0)) return terminalResponse();
  const [vendor, updated] = await Promise.all([
    env.DB.prepare('SELECT * FROM customers WHERE id = ? AND account_id = ?').bind(vendorId, ctx.accountId).first<Record<string, unknown>>(),
    env.DB.prepare('SELECT * FROM curate_import_vendor_groups WHERE id = ? AND batch_id = ? AND account_id = ?').bind(params.groupId, params.id, ctx.accountId).first<Record<string, unknown>>(),
  ]);
  return response({ vendor, group: groupRow(updated!) }, 201);
}

export async function setCurateImportJourney(request: Request, env: ImportEnv, ctx: CurateImportContext, params: Record<string, string>) {
  const batch = await scopedBatch(env, params.id, ctx.accountId);
  if (!batch) return response({ error: 'Import not found' }, 404);
  if (batchIsTerminal(batch)) return terminalResponse();
  let body: Record<string, unknown>;
  try { body = object(await request.json()) ?? {}; } catch { return response({ error: 'Invalid JSON' }, 400); }
  if (Object.keys(body).some(key => key !== 'journey_id')) return response({ error: 'Unknown update field' }, 400);
  const journeyId = body.journey_id == null ? null : typeof body.journey_id === 'string' ? body.journey_id : undefined;
  if (journeyId === undefined) return response({ error: 'Invalid journey_id' }, 400);
  const contextError = await validateCurateContextPair(env, ctx.accountId, { journey_id: journeyId, visit_id: batch.visit_id as string | null });
  if (contextError) return response({ error: contextError }, 400);
  const changed = await env.DB.prepare("UPDATE curate_import_batches SET journey_id = ?, updated_at = datetime('now') WHERE id = ? AND account_id = ? AND review_state NOT IN ('completed', 'abandoned') AND finalize_idempotency_key IS NULL")
    .bind(journeyId, params.id, ctx.accountId).run();
  if (!(changed.meta.changes ?? 0)) return terminalResponse();
  return response(await scopedBatch(env, params.id, ctx.accountId));
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
       (SELECT 1 FROM curate_import_batches WHERE id = ? AND account_id = ? AND review_state NOT IN ('completed', 'abandoned') AND finalize_idempotency_key IS NULL)`
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
    env.DB.prepare("UPDATE curate_import_items SET review_state = 'abandoned', updated_at = datetime('now') WHERE batch_id = ? AND account_id = ? AND review_state IN ('pending', 'reviewing') AND EXISTS (SELECT 1 FROM curate_import_batches WHERE id = ? AND account_id = ? AND review_state NOT IN ('completed', 'abandoned') AND finalize_idempotency_key IS NULL)").bind(params.id, ctx.accountId, params.id, ctx.accountId),
    env.DB.prepare("UPDATE curate_import_batches SET review_state = 'abandoned', updated_at = datetime('now') WHERE id = ? AND account_id = ? AND review_state NOT IN ('completed', 'abandoned') AND finalize_idempotency_key IS NULL").bind(params.id, ctx.accountId),
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
  await env.DB.prepare("UPDATE curate_import_batches SET review_state = ?, updated_at = datetime('now') WHERE id = ? AND account_id = ? AND review_state NOT IN ('completed', 'abandoned') AND finalize_idempotency_key IS NULL")
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
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM curate_import_batches WHERE id = ? AND account_id = ? AND review_state NOT IN ('completed', 'abandoned') AND finalize_idempotency_key IS NULL)`
    ).bind(sourceId, params.id, ctx.accountId, ctx.userId, kind, null, key, clientEvidenceId, JSON.stringify(metadata), params.id, ctx.accountId).run();
    if (!(inserted.meta.changes ?? 0)) {
      const winner = await env.DB.prepare('SELECT * FROM curate_import_sources WHERE batch_id = ? AND account_id = ? AND client_evidence_id = ?')
        .bind(params.id, ctx.accountId, clientEvidenceId).first<Record<string, unknown>>();
      if (winner?.r2_object_key === key) return response({ ...sourceRow(winner), already_uploaded: true });
      await env.MEDIA_BUCKET.delete(key);
      return terminalResponse();
    }
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
         SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM curate_import_batches WHERE id = ? AND account_id = ? AND review_state NOT IN ('completed', 'abandoned') AND finalize_idempotency_key IS NULL)`
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
  const manualFields = new Set((() => {
    const parsed = parseJson(current.manually_corrected_fields_json, []);
    return Array.isArray(parsed) ? parsed.filter(value => typeof value === 'string') as string[] : [];
  })());
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
        manualFields.add('category');
      } else if (key === 'position') {
        const number = Number(value); if (!Number.isInteger(number) || number < 0) return response({ error: 'Invalid position' }, 400);
        updates.push('position = ?'); values.push(number);
      } else if (key === 'confidence') {
        const number = value == null ? null : Number(value); if (number != null && (!Number.isFinite(number) || number < 0 || number > 1)) return response({ error: 'Invalid confidence' }, 400);
        updates.push('confidence = ?'); values.push(number);
      } else if (key === 'parsed_data' || key === 'uncertainty') {
        const storedValue = key === 'parsed_data' ? renormalizeImportItemData(value) : value;
        updates.push(`${key}_json = ?`); values.push(jsonField(storedValue, {}));
        if (key === 'parsed_data') {
          const before = parseJson(current.parsed_data_json, {}) as Record<string, unknown>;
          const after = storedValue as Record<string, unknown>;
          const derived = new Set(['totalQuantityGrams', 'totalUnits', 'lineCost', 'unitCost', 'blockingFields']);
          for (const field of new Set([...Object.keys(before), ...Object.keys(after)])) {
            if (derived.has(field)) continue;
            if (JSON.stringify(before[field]) !== JSON.stringify(after[field])) manualFields.add(`parsed_data.${field}`);
          }
        } else if (JSON.stringify(parseJson(current.uncertainty_json, {})) !== JSON.stringify(value ?? {})) manualFields.add('uncertainty');
      } else {
        updates.push(`${key} = ?`); values.push(text(value, key === 'raw_text' ? 20_000 : 500));
        if (key === 'name' || key === 'raw_text') manualFields.add(key);
      }
    }
  } catch { return response({ error: 'Invalid update' }, 400); }
  if (updates.length) {
    updates.push('manually_corrected_fields_json = ?'); values.push(JSON.stringify([...manualFields].sort()));
    updates.push("updated_at = datetime('now')");
    const changed = await env.DB.prepare(`UPDATE curate_import_items SET ${updates.join(', ')} WHERE id = ? AND account_id = ? AND EXISTS (SELECT 1 FROM curate_import_batches WHERE id = ? AND account_id = ? AND review_state NOT IN ('completed', 'abandoned') AND finalize_idempotency_key IS NULL)`).bind(...values, params.itemId, ctx.accountId, params.id, ctx.accountId).run();
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
  if (batchIsTerminal(batch)) return terminalResponse();
  if (item.compass_entry_id) return response({ ...itemRow(item), already_accepted: true });
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
       SELECT ?, ?, ?, ?, ${compassColumns.map(() => '?').join(', ')} WHERE EXISTS (SELECT 1 FROM curate_import_batches WHERE id = ? AND account_id = ? AND review_state NOT IN ('completed', 'abandoned') AND finalize_idempotency_key IS NULL)`
    ).bind(compassId, ctx.userId, ctx.accountId, params.itemId, ...compassColumns.map(column => compassValues[column as keyof typeof compassValues]), params.id, ctx.accountId),
    // The ownership EXISTS is part of the same D1 transaction as the insert.
    // A global id collision owned by anyone else makes this update a no-op.
    env.DB.prepare(
      `UPDATE curate_import_items SET review_state = ?, compass_entry_id = ?, reviewed_by_user_id = ?, reviewed_at = datetime('now'), updated_at = datetime('now')
       WHERE id = ? AND account_id = ? AND compass_entry_id IS NULL
         AND EXISTS (SELECT 1 FROM tea_compass_entries WHERE id = ? AND user_id = ? AND account_id = ? AND import_item_id = ?)
         AND EXISTS (SELECT 1 FROM curate_import_batches WHERE id = ? AND account_id = ? AND review_state NOT IN ('completed', 'abandoned') AND finalize_idempotency_key IS NULL)`
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
     WHERE id = ? AND account_id = ? AND EXISTS (SELECT 1 FROM curate_import_batches WHERE id = ? AND account_id = ? AND review_state NOT IN ('completed', 'abandoned') AND finalize_idempotency_key IS NULL)`
  ).bind('merged', compassId, ctx.userId, params.itemId, ctx.accountId, params.id, ctx.accountId).run();
  if (!(changed.meta.changes ?? 0)) return terminalResponse();
  await refreshImportBatchState(env, params.id, ctx.accountId);
  return response(itemRow((await scopedItem(env, params.id, params.itemId, ctx.accountId))!));
}
