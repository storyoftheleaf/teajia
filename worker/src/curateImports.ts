import { compassValuesFromImport } from './compassCodec';
import { validateCurateContextPair } from './curateContextValidation';
import { applyImportRecordHints, buildImportAnalysisPrompt, buildImportRecordFallbackProposal, buildImportRecordHints, decodeImportAnalysisProposal, IMPORT_ANALYSIS_OUTPUT_SCHEMA, normalizeImportProposal, renormalizeImportItemData, type ImportAnalysisProposal, type ImportMatchCandidates } from './curateImportAnalysis';
import { canonicalImportToCompassValues, canonicalImportToProductValues, normalizeCanonicalImportRecord } from './curateImportCanonical';
import {
  buildGroqTextInput, buildGroqVisionInput, exactEvidenceExcerpt, normalizeImportSources,
  IMPORT_SOURCE_MAX_BYTES, IMPORT_SOURCE_TOTAL_MAX_BYTES, type CachedDerivedEvidence, type NormalizedEvidence, type StoredImportSource,
} from './curateImportEvidence';
import { CurateImportFinalizeError, finalizeCurateImport, holdingMatchesFinalizeItem, type CurateFinalizeData, type FinalizeReceiptLine } from './curateImportFinalize';
import { decodeInventoryReceipt, effectiveInventoryPurpose, inventoryPurposeConflict } from './inventoryDomain';

export interface CurateImportContext {
  accountId: string;
  userId: string;
}

interface ImportEnv {
  DB: D1Database;
  MEDIA_BUCKET?: R2Bucket;
  IMAGES?: ImagesBinding;
  AI?: {
    toMarkdown(input: { name: string; blob: Blob }): Promise<
      | { name?: string; format?: string; data?: string; error?: string }
      | Array<{ name?: string; format?: string; data?: string; error?: string }>
    >;
  };
  ANTHROPIC_API_KEY?: string;
  GROQ_API_KEY?: string;
  CURATE_IMPORT_ANALYSIS_MODEL?: string;
  CURATE_IMPORT_FALLBACK_MODEL?: string;
  CURATE_IMPORT_GROQ_VISION_MODEL?: string;
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
  return {
    ...row,
    metadata: parseJson(row.metadata_json, {}),
    reference_metadata: parseJson(row.reference_metadata_json, {}),
    metadata_json: undefined,
    reference_metadata_json: undefined,
  };
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
  return {
    batch: { ...batch, analysis_annotations: typedAnalysisAnnotations(batch.analysis_annotations_json) },
    sources: sources.results.map(sourceRow), groups: groups.results.map(groupRow), items: items.results.map(itemRow),
  };
}

function normalizedName(value: string | null | undefined) {
  return (value ?? '').normalize('NFKD').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

const MATERIAL_REVIEW_BLOCKERS: Record<string, string> = {
  vendor: 'vendor', identity: 'identity', translation: 'englishName', englishName: 'englishName', nameTranslation: 'englishName',
  packWeight: 'packWeight', weightUnit: 'weightUnit', quantity: 'packCount', packCount: 'packCount', priceBasis: 'priceBasis',
  price: 'priceAmount', priceAmount: 'priceAmount', currency: 'currency', disposition: 'disposition',
  inventoryPurpose: 'inventoryPurpose', purpose: 'inventoryPurpose',
};

function clearReviewedMaterialFields(value: Record<string, unknown>, reviewedFields: Set<string>) {
  const confidence = object(value.confidence) ?? {};
  const uncertainty = object(value.uncertainty) ?? {};
  for (const [sourceField, blocker] of Object.entries(MATERIAL_REVIEW_BLOCKERS)) if (reviewedFields.has(blocker)) {
    delete confidence[sourceField];
    delete uncertainty[sourceField];
  }
  return { ...value, confidence, uncertainty };
}

function vendorItemReviewPatch(env: ImportEnv, groupId: string, accountId: string, vendorId: string, vendorName: string, batchId: string) {
  return env.DB.prepare(`UPDATE curate_import_items SET parsed_data_json = json_set(
      json_remove(CASE WHEN json_valid(parsed_data_json) THEN parsed_data_json ELSE '{}' END, '$.confidence.vendor', '$.uncertainty.vendor'),
      '$.vendorResolution', json_object('kind', 'existing', 'vendorId', ?, 'vendorName', ?),
      '$.blockingFields', json(COALESCE((SELECT json_group_array(value) FROM json_each(json_extract(CASE WHEN json_valid(parsed_data_json) THEN parsed_data_json ELSE '{}' END, '$.blockingFields')) WHERE value != 'vendor'), '[]'))
    ), updated_at = datetime('now')
    WHERE vendor_group_id = ? AND account_id = ?
      AND EXISTS (SELECT 1 FROM curate_import_vendor_groups WHERE id = ? AND account_id = ? AND resolved_vendor_customer_id = ?)
      AND EXISTS (SELECT 1 FROM curate_import_batches WHERE id = ? AND account_id = ? AND review_state NOT IN ('completed', 'abandoned') AND finalize_idempotency_key IS NULL)`)
    .bind(vendorId, vendorName, groupId, accountId, groupId, accountId, vendorId, batchId, accountId);
}

function canonicalReviewMoney(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const source = String(value).trim();
  if (!/^\d+(?:\.\d+)?$/.test(source)) return null;
  const [whole, fraction = ''] = source.split('.');
  const canonicalWhole = whole.replace(/^0+(?=\d)/, '') || '0';
  const canonicalFraction = fraction.replace(/0+$/, '');
  return canonicalFraction ? `${canonicalWhole}.${canonicalFraction}` : canonicalWhole;
}

function materialReviewChanged(blocker: string, before: Record<string, unknown>, after: Record<string, unknown>) {
  if (blocker === 'priceAmount') return canonicalReviewMoney(before.priceAmount ?? before.priceAmountExact) !== canonicalReviewMoney(after.priceAmount ?? after.priceAmountExact);
  if (blocker === 'identity') return ['duplicateResolution', 'proposedCompassEntryId', 'proposedProductId']
    .some(field => JSON.stringify(before[field]) !== JSON.stringify(after[field]));
  return JSON.stringify(before[blocker]) !== JSON.stringify(after[blocker]);
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
  const englishNames = [item.englishName, item.originalName].map(value => normalizedName(typeof value === 'string' ? value : null)).filter(Boolean);
  const originalName = typeof item.originalName === 'string' ? item.originalName : '';
  const chineseName = normalizedName(typeof item.chineseName === 'string' ? item.chineseName : /\p{Script=Han}/u.test(originalName) ? originalName : null);
  const ranked = candidates.map(candidate => {
    if (candidate.category !== item.category) return { candidate, score: 0 };
    const candidateName = normalizedName(candidate.name);
    const candidateChinese = normalizedName(candidate.chineseName);
    const contradicts = (left: unknown, right: unknown) => normalizedName(typeof left === 'string' || typeof left === 'number' ? String(left) : null)
      && normalizedName(typeof right === 'string' || typeof right === 'number' ? String(right) : null)
      && normalizedName(String(left)) !== normalizedName(String(right));
    const contradiction = (item.year != null && candidate.year != null && item.year !== candidate.year)
      || contradicts(item.originCountry, candidate.originCountry) || contradicts(item.originRegion, candidate.originRegion)
      || contradicts(item.type, candidate.type) || contradicts(item.form, candidate.form)
      || contradicts(item.classification, candidate.classification) || contradicts(vendorName, candidate.vendorName);
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
    return { candidate, score, contradiction: Boolean(contradiction) };
  }).sort((a, b) => b.score - a.score);
  const best = ranked[0];
  if (!best || best.score === 0) return { duplicateResolution: 'new' as const, proposedCompassEntryId: null, proposedProductId: null };
  const runnerUp = ranked[1]?.score ?? 0;
  const matched = !best.contradiction && best.score >= 0.72 && best.score - runnerUp >= 0.15;
  return { duplicateResolution: matched ? 'matched' as const : 'unresolved' as const, proposedCompassEntryId: best.candidate.id, proposedProductId: matched ? best.candidate.productId ?? null : null };
}

function exactCanonicalIdentity(item: { category: string; originalName?: string | null; chineseName?: string | null; englishName?: string | null }, candidates: ImportMatchCandidates) {
  const sourceNames = [item.originalName, item.chineseName]
    .filter((name): name is string => typeof name === 'string' && Boolean(comparableName(name)));
  return (candidates.identities ?? []).find(identity => identity.category === item.category && sourceNames.some(sourceName => (
    comparableName(identity.chineseName) === comparableName(sourceName)
    || comparableName(identity.name) === comparableName(sourceName)
  )));
}

function applyCanonicalIdentityMatches(proposal: ImportAnalysisProposal, candidates: ImportMatchCandidates): ImportAnalysisProposal {
  return {
    ...proposal,
    groups: proposal.groups.map(group => ({
      ...group,
      items: group.items.map(item => {
        const canonical = exactCanonicalIdentity(item, candidates);
        if (!canonical?.name) return item;
        const uncertainty = { ...item.uncertainty };
        delete uncertainty.translation;
        delete uncertainty.englishName;
        delete uncertainty.nameTranslation;
        delete uncertainty.identity;
        delete uncertainty.duplicateResolution;
        return {
          ...item,
          englishName: canonical.name,
          confidence: { ...item.confidence, translation: 1, identity: 1 },
          validation: { ...item.validation, translation: 'canonical_match' },
          uncertainty,
        };
      }),
    })),
  };
}

function comparableName(value: string | null | undefined) {
  return normalizedName(value);
}

function anthopicText(value: unknown): string {
  const body = object(value);
  const content = body && Array.isArray(body.content) ? body.content : [];
  const textPart = content.find(part => object(part)?.type === 'text');
  const textValue = object(textPart)?.text;
  if (typeof textValue !== 'string') throw new Error('analysis_response_missing_text');
  return textValue.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
}

type AnalysisEvidenceSource = {
  id: string;
  kind: string;
  text?: string | null;
  mediaType?: string | null;
  objectKey?: string | null;
  pageCount?: number | null;
  referenceMetadata: Record<string, unknown>;
  analysisStatus: 'analyzed' | 'failed';
  analysisError: string | null;
  normalized: NormalizedEvidence;
};

function cachedDerivedEvidence(value: unknown): CachedDerivedEvidence | null {
  const derived = object(value);
  return derived
    && typeof derived.text === 'string'
    && typeof derived.sourceHash === 'string'
    && typeof derived.contentHash === 'string'
    && typeof derived.converter === 'string'
    && typeof derived.version === 'string'
    ? derived as unknown as CachedDerivedEvidence
    : null;
}

function failedNormalizedSource(source: Record<string, unknown>, mediaType: string, code: string, message = code): NormalizedEvidence {
  return {
    sourceId: String(source.id), kind: typeof source.kind === 'string' ? source.kind : 'file',
    name: String((parseJson(source.metadata_json, {}) as Record<string, unknown>).filename ?? source.id), status: 'failed', text: null,
    original: { objectKey: typeof source.r2_object_key === 'string' ? source.r2_object_key : null, mediaType, contentHash: null, authoritative: true },
    derived: null, vision: null, error: { code, message: message.slice(0, 500), retryable: !['source_too_large', 'unsupported_source_type'].includes(code) },
  };
}

function binaryBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let start = 0; start < bytes.length; start += chunkSize) binary += String.fromCharCode(...bytes.subarray(start, start + chunkSize));
  return btoa(binary);
}

async function analysisEvidence(env: ImportEnv, sources: Record<string, unknown>[]) {
  if (sources.length > 50) throw new Error('analysis_too_many_sources');
  const prepared: Array<{
    source: Record<string, unknown>;
    metadata: Record<string, unknown>;
    mediaType: string;
    name: string;
    blob: Blob | null;
    failure: NormalizedEvidence | null;
    stored?: StoredImportSource;
  }> = [];
  let aggregateBytes = 0;
  const encoder = new TextEncoder();
  for (const source of sources) {
    const metadata = parseJson(source.metadata_json, {}) as Record<string, unknown>;
    const referenceMetadata = parseJson(source.reference_metadata_json, {}) as Record<string, unknown>;
    const mediaType = typeof metadata.content_type === 'string'
      ? metadata.content_type
      : typeof source.pasted_text === 'string' ? 'text/plain' : 'application/octet-stream';
    const name = typeof metadata.filename === 'string' && metadata.filename ? metadata.filename
      : typeof source.pasted_text === 'string' ? `${source.id}.txt` : String(source.id);
    const base = { source, metadata, mediaType, name, blob: null as Blob | null, failure: null as NormalizedEvidence | null };
    const metadataBytes = typeof metadata.size === 'number' && Number.isFinite(metadata.size) && metadata.size >= 0
      ? metadata.size
      : null;
    const pastedBytes = typeof source.pasted_text === 'string' ? encoder.encode(source.pasted_text).byteLength : null;
    const declaredBytes = metadataBytes ?? pastedBytes;
    if (declaredBytes != null && declaredBytes > IMPORT_SOURCE_MAX_BYTES) {
      base.failure = failedNormalizedSource(source, mediaType, 'source_too_large');
      prepared.push(base);
      continue;
    }
    if (declaredBytes != null && aggregateBytes + declaredBytes > IMPORT_SOURCE_TOTAL_MAX_BYTES) {
      base.failure = failedNormalizedSource(source, mediaType, 'source_bytes_total_too_large');
      prepared.push(base);
      continue;
    }
    if (declaredBytes != null) aggregateBytes += declaredBytes;
    if (typeof source.r2_object_key === 'string') {
      const stored = env.MEDIA_BUCKET ? await env.MEDIA_BUCKET.get(source.r2_object_key) : null;
      if (!stored) {
        base.failure = failedNormalizedSource(source, mediaType, 'source_unavailable', 'Source bytes are unavailable');
        prepared.push(base);
        continue;
      }
      const bytes = new Uint8Array(await new Response(stored.body).arrayBuffer());
      if (bytes.byteLength > IMPORT_SOURCE_MAX_BYTES) {
        base.failure = failedNormalizedSource(source, mediaType, 'source_too_large');
        prepared.push(base);
        continue;
      }
      if (declaredBytes == null && aggregateBytes + bytes.byteLength > IMPORT_SOURCE_TOTAL_MAX_BYTES) {
        base.failure = failedNormalizedSource(source, mediaType, 'source_bytes_total_too_large');
        prepared.push(base);
        continue;
      }
      if (declaredBytes == null) aggregateBytes += bytes.byteLength;
      else if (bytes.byteLength > declaredBytes) {
        const additionalBytes = bytes.byteLength - declaredBytes;
        if (aggregateBytes + additionalBytes > IMPORT_SOURCE_TOTAL_MAX_BYTES) {
          base.failure = failedNormalizedSource(source, mediaType, 'source_bytes_total_too_large');
          prepared.push(base);
          continue;
        }
        aggregateBytes += additionalBytes;
      }
      base.blob = new Blob([bytes], { type: mediaType });
    }
    const entry = {
      ...base,
      stored: {
        id: String(source.id), kind: typeof source.kind === 'string' ? source.kind : undefined, name, mediaType,
        objectKey: typeof source.r2_object_key === 'string' ? source.r2_object_key : null,
        text: typeof source.pasted_text === 'string' ? source.pasted_text : null,
        blob: base.blob,
        cachedDerived: cachedDerivedEvidence(object(referenceMetadata.derived)),
      } satisfies StoredImportSource,
    };
    prepared.push(entry);
  }
  const ready = prepared.flatMap(entry => 'stored' in entry && entry.stored && !entry.failure ? [entry.stored] : []);
  const normalizedReady = ready.length ? await normalizeImportSources(ready, {
    toMarkdown: async input => {
      if (!env.AI) throw new Error('workers_ai_unavailable');
      const raw = await env.AI.toMarkdown(input);
      const result = Array.isArray(raw) ? raw.find(entry => entry.name === input.name) ?? raw[0] : raw;
      if (!result || result.format === 'error' || typeof result.data !== 'string') throw new Error(result?.error || 'workers_ai_conversion_failed');
      return result.data;
    },
    heicToJpeg: async input => {
      if (!env.IMAGES) throw new Error('cloudflare_images_unavailable');
      const transformed = await env.IMAGES
        .input(new Blob([input], { type: 'image/heic' }).stream())
        .output({ format: 'image/jpeg', quality: 90 });
      const converted = transformed.response();
      if (!converted.ok) throw new Error(`cloudflare_images_failed_${converted.status}`);
      return new Uint8Array(await converted.arrayBuffer());
    },
  }) : [];
  const normalizedById = new Map(normalizedReady.map(source => [source.sourceId, source]));
  const evidenceSources: AnalysisEvidenceSource[] = prepared.map(entry => {
    const normalized = entry.failure ?? normalizedById.get(String(entry.source.id))
      ?? failedNormalizedSource(entry.source, entry.mediaType, 'source_normalization_failed');
    return {
      id: normalized.sourceId, kind: normalized.kind, text: normalized.text,
      mediaType: normalized.original.mediaType, objectKey: normalized.original.objectKey,
      pageCount: typeof entry.metadata.page_count === 'number' ? entry.metadata.page_count : null,
      referenceMetadata: parseJson(entry.source.reference_metadata_json, {}) as Record<string, unknown>,
      analysisStatus: normalized.status, analysisError: normalized.error?.code ?? null, normalized,
    };
  });
  const media: Array<Record<string, unknown>> = [];
  for (const source of evidenceSources) {
    if (source.analysisStatus !== 'analyzed') continue;
    if (source.normalized.vision) {
      media.push({ type: 'image', source: { type: 'base64', media_type: source.normalized.vision.mediaType, data: binaryBase64(source.normalized.vision.bytes) } });
      continue;
    }
    if (source.mediaType === 'application/pdf') {
      const originalBlob = prepared.find(entry => String(entry.source.id) === source.id)?.blob;
      if (originalBlob) media.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: binaryBase64(new Uint8Array(await originalBlob.arrayBuffer())) } });
    }
  }
  return { evidence: { sources: evidenceSources }, normalized: evidenceSources.map(source => source.normalized), media };
}

function invalidEvidenceReference(ref: string, sources: Map<string, AnalysisEvidenceSource>) {
  const separator = ref.indexOf(':');
  const sourceId = separator < 0 ? ref : ref.slice(0, separator);
  const locator = separator < 0 ? '' : ref.slice(separator + 1);
  const source = sources.get(sourceId);
  if (!source || source.analysisStatus !== 'analyzed') return true;
  if (!locator) return false;
  const range = locator.match(/^(\d+)-(\d+)$/);
  if (range) return !source.text || Number(range[1]) < 0 || Number(range[2]) <= Number(range[1]) || Number(range[2]) > source.text.length;
  const page = locator.match(/^page=(\d+)$/);
  if (page) return !source.pageCount || Number(page[1]) < 1 || Number(page[1]) > source.pageCount;
  const region = locator.match(/^region=(0(?:\.\d+)?|1(?:\.0+)?),(0(?:\.\d+)?|1(?:\.0+)?),(0(?:\.\d+)?|1(?:\.0+)?),(0(?:\.\d+)?|1(?:\.0+)?)$/);
  return !region || Number(region[3]) <= 0 || Number(region[4]) <= 0 || Number(region[1]) + Number(region[3]) > 1 || Number(region[2]) + Number(region[4]) > 1;
}

function validateAnalysisAnnotations(annotations: NonNullable<ImportAnalysisProposal['annotations']>, evidence: { sources: AnalysisEvidenceSource[] }) {
  const sources = new Map(evidence.sources.map(source => [source.id, source]));
  for (const annotation of annotations) {
    const source = sources.get(annotation.sourceId);
    if (!source || source.analysisStatus !== 'analyzed' || !source.text?.includes(annotation.text)) throw new Error('analysis_invalid_annotation_provenance');
    if (!annotation.evidenceRef) continue;
    const refSourceId = annotation.evidenceRef.split(':')[0];
    if (refSourceId !== annotation.sourceId || invalidEvidenceReference(annotation.evidenceRef, sources)) throw new Error('analysis_invalid_annotation_provenance');
    const locator = annotation.evidenceRef.slice(annotation.evidenceRef.indexOf(':') + 1);
    const range = locator.match(/^(\d+)-(\d+)$/);
    if (range && exactEvidenceExcerpt(source.normalized, Number(range[1]), Number(range[2])).text !== annotation.text) {
      throw new Error('analysis_invalid_annotation_provenance');
    }
  }
}

function validateEvidenceReferences(proposal: ReturnType<typeof normalizeImportProposal>, evidence: { sources: AnalysisEvidenceSource[] }) {
  const sources = new Map(evidence.sources.map(source => [source.id, source]));
  for (const item of proposal.groups.flatMap(group => group.items)) {
    const refs = Array.isArray(item.evidenceRefs) ? item.evidenceRefs.filter((ref): ref is string => typeof ref === 'string') : [];
    if (!refs.length || refs.some(ref => invalidEvidenceReference(ref, sources))) throw new Error('analysis_invalid_evidence_reference');
  }
}

function evidenceReferencesBySource(proposal: ReturnType<typeof normalizeImportProposal>) {
  const references = new Map<string, string[]>();
  const refs = proposal.groups.flatMap(group => group.items).flatMap(item => (
    Array.isArray(item.evidenceRefs) ? item.evidenceRefs.filter((ref): ref is string => typeof ref === 'string') : []
  ));
  for (const ref of refs) {
    const sourceId = ref.split(':')[0];
    references.set(sourceId, [...(references.get(sourceId) ?? []), ref]);
  }
  return references;
}

type AnalysisAttemptAnnotation = {
  stage: 'converter' | 'provider';
  outcome: 'succeeded' | 'failed' | 'reused';
  sourceId?: string;
  sourceIds?: string[];
  converter?: string;
  provider?: string;
  model?: string;
  modality?: 'text' | 'multimodal' | 'vision' | 'deterministic';
  failureClass?: string;
};

function attemptedConverter(source: AnalysisEvidenceSource): string {
  if (source.normalized.derived) return source.normalized.derived.converter;
  const mediaType = source.normalized.original.mediaType;
  if (['text/plain', 'text/csv', 'application/csv', 'application/json'].includes(mediaType)) return 'direct-utf8';
  if (mediaType === 'application/msword') return 'legacy-doc-bounded-text';
  if (mediaType === 'image/heic' || mediaType === 'image/heif') return 'cloudflare-images-heic-jpeg+workers-ai-to-markdown';
  return 'workers-ai-to-markdown';
}

function converterAttemptAnnotations(sources: AnalysisEvidenceSource[]): AnalysisAttemptAnnotation[] {
  return sources.map(source => source.normalized.derived ? {
    stage: 'converter', sourceId: source.id, converter: source.normalized.derived.converter,
    outcome: source.normalized.derived.reused ? 'reused' : 'succeeded',
  } : {
    stage: 'converter', sourceId: source.id, converter: attemptedConverter(source), outcome: 'failed',
    failureClass: source.normalized.error?.code ?? 'source_normalization_failed',
  });
}

function sourceAnalysisStatements(env: ImportEnv, batchId: string, accountId: string, attemptToken: string, sources: AnalysisEvidenceSource[], references = new Map<string, string[]>()) {
  return sources.map(source => {
    const referenceMetadata: Record<string, unknown> = {
      ...source.referenceMetadata,
      references: [...new Set(references.get(source.id) ?? [])],
      attempts: converterAttemptAnnotations([source]),
    };
    if (source.normalized.derived && source.text != null) referenceMetadata.derived = {
      text: source.text,
      sourceHash: source.normalized.derived.sourceHash,
      contentHash: source.normalized.derived.contentHash,
      converter: source.normalized.derived.converter,
      version: source.normalized.derived.version,
      reused: source.normalized.derived.reused,
    };
    return env.DB.prepare(
      `UPDATE curate_import_sources SET analysis_status = ?, analysis_error = ?, reference_metadata_json = ?
     WHERE id = ? AND account_id = ? AND EXISTS (SELECT 1 FROM curate_import_batches WHERE analysis_attempt_token = ? AND id = ? AND account_id = ? AND review_state NOT IN ('completed', 'abandoned') AND finalize_idempotency_key IS NULL)`
    ).bind(source.analysisStatus, source.analysisError, JSON.stringify(referenceMetadata), source.id, accountId, attemptToken, batchId, accountId);
  });
}

function providerPrompt(evidence: { sources: AnalysisEvidenceSource[] }, candidates: ImportMatchCandidates): string {
  const analysisEvidence = { sources: evidence.sources.map(source => ({
    id: source.id, kind: source.kind, text: source.text, mediaType: source.mediaType, objectKey: source.objectKey,
  })) };
  let prompt = buildImportAnalysisPrompt(analysisEvidence, candidates)
    .replace(/\nEVIDENCE=.*$/s, '\nThe normalized untrusted records are attached below.');
  if (prompt.length <= 16_000) return prompt;
  const compactCandidates = {
    vendors: candidates.vendors.slice(0, 10).map(({ id, name }) => ({ id, name })),
    journeys: candidates.journeys.slice(0, 10),
    identities: (candidates.identities ?? []).slice(0, 10),
    products: (candidates.products ?? []).slice(0, 10),
  };
  prompt = prompt.replace(/ACCOUNT_CANDIDATES=.*\n/, `ACCOUNT_CANDIDATES=${JSON.stringify(compactCandidates)}\n`);
  if (prompt.length <= 16_000) return prompt;
  return prompt.replace(/RECORD_HINTS=.*\n/, 'RECORD_HINTS are applied deterministically after provider analysis.\n');
}

function boundedExcerpt(value: string, max = 1200) {
  return value.slice(0, max);
}

function exactSourceExcerpt(item: Record<string, unknown>, sources: Map<string, NormalizedEvidence>): string | null {
  const refs = Array.isArray(item.evidenceRefs) ? item.evidenceRefs : [];
  for (const ref of refs) {
    if (typeof ref !== 'string') continue;
    const match = ref.match(/^([^:]+):(\d+)-(\d+)$/);
    if (!match) continue;
    const source = sources.get(match[1]);
    if (!source) continue;
    try { return exactEvidenceExcerpt(source, Number(match[2]), Number(match[3])).text; } catch { /* validated separately */ }
  }
  return null;
}

const CANONICAL_EXTENSION_FIELDS = new Set([
  'sourceId', 'sourceExcerpt', 'sourceLanguage', 'disposition',
  'vendorResolution', 'identityResolution', 'holdingResolution',
]);

function analysisItemFields(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([key]) => !CANONICAL_EXTENSION_FIELDS.has(key)));
}

function canonicalStoredItem(
  value: Record<string, unknown>,
  context: { sourceLanguage?: string | null; sources?: Map<string, NormalizedEvidence>; vendorId?: string | null; vendorName?: string | null } = {},
) {
  const analysis = renormalizeImportItemData(analysisItemFields(value));
  if (object(value.validation)?.translation === 'canonical_match') {
    analysis.validation = { ...analysis.validation, translation: 'canonical_match' };
    analysis.blockingFields = analysis.blockingFields.filter(field => field !== 'englishName');
  }
  const evidenceRefs = Array.isArray(analysis.evidenceRefs) ? analysis.evidenceRefs.filter((ref): ref is string => typeof ref === 'string') : [];
  const sourceId = evidenceRefs[0]?.split(':')[0] ?? (typeof value.sourceId === 'string' ? value.sourceId : null);
  const sourceExcerpt = context.sources ? exactSourceExcerpt(analysis, context.sources)
    : typeof value.sourceExcerpt === 'string' && value.sourceExcerpt.trim() ? value.sourceExcerpt : null;
  const canonical = normalizeCanonicalImportRecord({
    ...value, ...analysis, sourceId, sourceExcerpt,
    sourceLanguage: context.sourceLanguage ?? value.sourceLanguage,
    vendorId: context.vendorId ?? undefined,
    vendorName: context.vendorName ?? undefined,
  });
  const blockers = Array.isArray(analysis.blockingFields) ? analysis.blockingFields.filter((field): field is string => typeof field === 'string' && field !== 'acquired' && field !== 'disposition') : [];
  if (canonical.disposition == null) blockers.push('disposition');
  return { ...analysis, ...canonical, blockingFields: [...new Set(blockers)] };
}

type PersistedAnalysisAnnotations = {
  records: Array<Record<string, unknown>>;
  attempts: AnalysisAttemptAnnotation[];
  reviewBlockers: Array<Record<string, unknown>>;
};

function parsedAnalysisAnnotations(value: unknown): PersistedAnalysisAnnotations {
  const parsed = typeof value === 'string' ? parseJson(value, {}) : object(value) ?? {};
  return {
    records: Array.isArray(parsed.records) ? parsed.records.flatMap((entry: unknown) => object(entry) ? [object(entry)!] : []) : [],
    attempts: Array.isArray(parsed.attempts) ? parsed.attempts.flatMap((entry: unknown) => object(entry) ? [object(entry)! as unknown as AnalysisAttemptAnnotation] : []) : [],
    reviewBlockers: Array.isArray(parsed.reviewBlockers) ? parsed.reviewBlockers.flatMap((entry: unknown) => object(entry) ? [object(entry)!] : []) : [],
  };
}

function typedAnalysisAnnotations(value: unknown) {
  return parsedAnalysisAnnotations(value).records.flatMap(record => {
    const kind = record.kind === 'fee' ? 'shipping_or_fee' : record.kind;
    if (!['heading', 'note', 'shipping_or_fee', 'subtotal', 'total', 'ignored_duplicate'].includes(String(kind))) return [];
    return [{
      kind,
      sourceId: typeof record.sourceId === 'string' ? record.sourceId : null,
      sourceExcerpt: typeof record.text === 'string' ? record.text : null,
      label: typeof record.text === 'string' ? record.text : null,
      amountExact: typeof record.amountExact === 'string' ? record.amountExact : null,
      currency: typeof record.currency === 'string' ? record.currency : null,
    }];
  });
}

function dedupeAnalysisRecords(records: Array<Record<string, unknown>>) {
  const seen = new Set<string>();
  return records.filter(record => {
    const key = JSON.stringify([record.sourceId, record.kind, record.text, record.evidenceRef]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mergeAnalysisAnnotations(
  priorValue: unknown,
  current: PersistedAnalysisAnnotations,
  retriedSourceIds: string[] | null,
): PersistedAnalysisAnnotations {
  if (!retriedSourceIds) return { ...current, records: dedupeAnalysisRecords(current.records) };
  const retried = new Set(retriedSourceIds);
  const prior = parsedAnalysisAnnotations(priorValue);
  const retainedAttempts = prior.attempts.flatMap(attempt => {
    if (attempt.sourceId) return retried.has(attempt.sourceId) ? [] : [attempt];
    if (attempt.sourceIds?.length) {
      const sourceIds = attempt.sourceIds.filter(sourceId => !retried.has(sourceId));
      return sourceIds.length ? [{ ...attempt, sourceIds }] : [];
    }
    return [attempt];
  });
  return {
    records: dedupeAnalysisRecords([...prior.records.filter(record => !retried.has(String(record.sourceId ?? ''))), ...current.records]),
    attempts: [...retainedAttempts, ...current.attempts],
    reviewBlockers: [...prior.reviewBlockers.filter(record => !retried.has(String(record.sourceId ?? ''))), ...current.reviewBlockers],
  };
}

function groqResponseText(payload: unknown): string {
  const body = object(payload);
  const choices = body && Array.isArray(body.choices) ? body.choices : [];
  const content = object(object(choices[0])?.message)?.content;
  if (typeof content !== 'string' || !content.trim()) throw new Error('analysis_fallback_empty_response');
  return content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
}

export async function analyzeCurateImport(request: Request, env: ImportEnv, ctx: CurateImportContext, params: Record<string, string>) {
  const batch = await scopedBatch(env, params.id, ctx.accountId);
  if (!batch) return response({ error: 'Import not found' }, 404);
  if (batchIsTerminal(batch)) return terminalResponse();
  if (!env.ANTHROPIC_API_KEY && !env.GROQ_API_KEY) {
    const directSources = await env.DB.prepare('SELECT id, kind, pasted_text FROM curate_import_sources WHERE batch_id = ? AND account_id = ? ORDER BY created_at, id')
      .bind(params.id, ctx.accountId).all<Record<string, unknown>>();
    const directHints = buildImportRecordHints({
      sources: directSources.results.map(source => ({
        id: String(source.id),
        kind: String(source.kind),
        text: typeof source.pasted_text === 'string' ? source.pasted_text : null,
      })),
    });
    if (!directHints.complete) return response({ error: 'Import analysis is not configured' }, 503);
  }
  let requestedSourceIds: string[] | null = null;
  try {
    const raw = await request.text();
    if (raw) {
      const body = object(JSON.parse(raw)) ?? {};
      if (body.source_ids != null) {
        if (!Array.isArray(body.source_ids) || body.source_ids.length < 1 || body.source_ids.length > 50 || body.source_ids.some(id => typeof id !== 'string' || !id || id.length > 100)) return response({ error: 'Invalid source retry selection' }, 400);
        requestedSourceIds = [...new Set(body.source_ids as string[])];
      }
    }
  } catch { return response({ error: 'Invalid JSON' }, 400); }
  if (requestedSourceIds) {
    const retrySources = await env.DB.prepare('SELECT * FROM curate_import_sources WHERE batch_id = ? AND account_id = ? ORDER BY created_at, id').bind(params.id, ctx.accountId).all<Record<string, unknown>>();
    const retryById = new Map(retrySources.results.map(source => [String(source.id), source]));
    if (requestedSourceIds.some(id => retryById.get(id)?.analysis_status !== 'failed')) return response({ error: 'Only failed records can be retried', code: 'analysis_source_not_failed' }, 409);
  }
  const model = env.CURATE_IMPORT_ANALYSIS_MODEL || 'claude-sonnet-4-6';
  const attemptToken = crypto.randomUUID();
  const started = await env.DB.prepare("UPDATE curate_import_batches SET analysis_state = 'analyzing', analysis_error = NULL, analysis_attempt_token = ?, updated_at = datetime('now') WHERE id = ? AND account_id = ? AND review_state NOT IN ('completed', 'abandoned') AND finalize_idempotency_key IS NULL")
    .bind(attemptToken, params.id, ctx.accountId).run();
  if (!(started.meta.changes ?? 0)) return analysisSupersededResponse();
  let analyzedSources: AnalysisEvidenceSource[] = [];
  let analysisAttempts: AnalysisAttemptAnnotation[] = [];
  let analysisRecordAnnotations: Array<Record<string, unknown>> = [];
  let analysisReviewBlockers: Array<Record<string, unknown>> = [];
  try {
    const [sourcesResult, vendorsResult, priorVendorEvidenceResult, journeysResult, identitiesResult, productsResult, groupsResult, itemsResult] = await Promise.all([
      env.DB.prepare('SELECT * FROM curate_import_sources WHERE batch_id = ? AND account_id = ? ORDER BY created_at, id').bind(params.id, ctx.accountId).all<Record<string, unknown>>(),
      env.DB.prepare("SELECT id, name, company, tags FROM customers WHERE account_id = ? AND EXISTS (SELECT 1 FROM json_each(CASE WHEN json_valid(tags) THEN tags ELSE '[]' END) WHERE value = 'vendor') ORDER BY name LIMIT 200").bind(ctx.accountId).all<Record<string, unknown>>(),
      env.DB.prepare('SELECT proposed_vendor_name, resolved_vendor_customer_id FROM curate_import_vendor_groups WHERE account_id = ? AND resolved_vendor_customer_id IS NOT NULL').bind(ctx.accountId).all<Record<string, unknown>>(),
      env.DB.prepare('SELECT id, name FROM curate_journeys WHERE account_id = ? ORDER BY created_at DESC').bind(ctx.accountId).all<Record<string, unknown>>(),
      env.DB.prepare('SELECT id, name, chinese_name, category, draft_product_id, year, origin_country, origin_region, type, form, classification, vendor_name FROM tea_compass_entries WHERE account_id = ? AND user_id = ? ORDER BY updated_at DESC LIMIT 200').bind(ctx.accountId, ctx.userId).all<Record<string, unknown>>(),
      env.DB.prepare('SELECT id, source_compass_entry_id, product_name, given_name, chinese_name, type, form, classification, year, origin_country, origin_region, vendor, inventory_purpose FROM products WHERE account_id = ?').bind(ctx.accountId).all<Record<string, unknown>>(),
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
        return { id: String(row.id), name: typeof row.name === 'string' ? row.name : typeof product?.given_name === 'string' ? product.given_name : null, chineseName: typeof row.chinese_name === 'string' ? row.chinese_name : typeof product?.chinese_name === 'string' ? product.chinese_name : null, category: row.category === 'teaware' ? 'teaware' : 'tea', productId: product ? String(product.id) : (typeof row.draft_product_id === 'string' ? row.draft_product_id : null), year: typeof row.year === 'number' ? row.year : typeof product?.year === 'string' ? Number(product.year) : null, originCountry: typeof row.origin_country === 'string' ? row.origin_country : typeof product?.origin_country === 'string' ? product.origin_country : null, originRegion: typeof row.origin_region === 'string' ? row.origin_region : typeof product?.origin_region === 'string' ? product.origin_region : null, type: typeof row.type === 'string' ? row.type : typeof product?.type === 'string' ? product.type : null, form: typeof row.form === 'string' ? row.form : typeof product?.form === 'string' ? product.form : null, classification: typeof row.classification === 'string' ? row.classification : typeof product?.classification === 'string' ? product.classification : null, vendorName: typeof row.vendor_name === 'string' ? row.vendor_name : typeof product?.vendor === 'string' ? product.vendor : null };
      }),
      products: productsResult.results.map(row => ({ id: String(row.id), compassEntryId: typeof row.source_compass_entry_id === 'string' ? row.source_compass_entry_id : null, name: typeof row.given_name === 'string' ? row.given_name : typeof row.product_name === 'string' ? row.product_name : null, category: row.type === 'Teaware' ? 'teaware' : 'tea', purpose: typeof row.inventory_purpose === 'string' ? row.inventory_purpose : null })),
    };
    const selectedSources = requestedSourceIds ? sourcesResult.results.filter(source => requestedSourceIds!.includes(String(source.id))) : sourcesResult.results;
    const { evidence, normalized: normalizedEvidence, media } = await analysisEvidence(env, selectedSources);
    analyzedSources = evidence.sources;
    analysisAttempts = converterAttemptAnnotations(analyzedSources);
    const hasUsableText = normalizedEvidence.some(source => source.status === 'analyzed' && Boolean(source.text?.trim()));
    if (!normalizedEvidence.some(source => source.status === 'analyzed' && (Boolean(source.text?.trim()) || Boolean(source.vision)))) throw new Error('analysis_no_usable_evidence');
    const prompt = providerPrompt(evidence, candidates);
    const recordHints = buildImportRecordHints(evidence);
    const recordHintsBySource = new Map(evidence.sources
      .filter(source => source.analysisStatus === 'analyzed' && Boolean(source.text?.trim()))
      .map(source => [source.id, buildImportRecordHints({ sources: [source] })]));
    analysisRecordAnnotations = recordHints.annotations;
    const analyzedSourceIds = analyzedSources.map(source => source.id);
    const boundedPrompt = hasUsableText ? buildGroqTextInput(normalizedEvidence, prompt).content : prompt;
    let decoded: ImportAnalysisProposal | null = null;
    let validatedNormalized: ReturnType<typeof normalizeImportProposal> | null = null;
    let validatedAnnotations: Array<Record<string, unknown>> | null = null;
    let analysisModel = model;
    let providerFailure = 'analysis_provider_unavailable';
    const validateCandidate = (candidate: ImportAnalysisProposal) => {
      const annotations = dedupeAnalysisRecords([
        ...recordHints.annotations.map(annotation => ({ ...annotation })),
        ...(candidate.annotations ?? []).map(annotation => ({ ...annotation })),
      ]);
      validateAnalysisAnnotations(annotations as NonNullable<ImportAnalysisProposal['annotations']>, evidence);
      const normalized = normalizeImportProposal(applyCanonicalIdentityMatches(
        applyImportRecordHints(candidate, recordHints, candidates),
        candidates,
      ));
      validateEvidenceReferences(normalized, evidence);
      return { annotations, normalized };
    };
    if (env.ANTHROPIC_API_KEY) try {
      const ai = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model,
          max_tokens: 8192,
          temperature: 0,
          output_config: { format: { type: 'json_schema', schema: IMPORT_ANALYSIS_OUTPUT_SCHEMA } },
          messages: [{ role: 'user', content: [...media, { type: 'text', text: boundedPrompt }] }],
        }),
      });
      if (!ai.ok) {
        const providerError = await ai.text();
        console.error(`Curate import analysis upstream error: ${ai.status}: ${providerError.slice(0, 1000)}`);
        throw new Error(`analysis_provider_${ai.status}`);
      }
      const candidate = decodeImportAnalysisProposal(JSON.parse(anthopicText(await ai.json())));
      const validated = validateCandidate(candidate);
      decoded = candidate;
      validatedNormalized = validated.normalized;
      validatedAnnotations = validated.annotations;
      analysisAttempts.push({ stage: 'provider', provider: 'anthropic', model, modality: media.length ? 'multimodal' : 'text', outcome: 'succeeded', sourceIds: analyzedSourceIds });
    } catch (error) {
      providerFailure = error instanceof Error ? error.message : providerFailure;
      analysisAttempts.push({ stage: 'provider', provider: 'anthropic', model, modality: media.length ? 'multimodal' : 'text', outcome: 'failed', failureClass: providerFailure, sourceIds: analyzedSourceIds });
      console.error(`Curate import primary analysis failed: ${providerFailure.slice(0, 500)}`);
    }
    if (!decoded && env.GROQ_API_KEY) {
      const fallbackPrompt = recordHints.complete
        ? [
            'Translate each non-English originalName in BASE_PROPOSAL into a concise, natural English tea name.',
            'Return only the complete valid JSON object. Do not add or remove items. Keep every value except englishName and uncertainty exactly as supplied.',
            'When a translation is supplied, remove uncertainty.englishName. Do not guess identity matches or candidate ids.',
            `BASE_PROPOSAL=${JSON.stringify(buildImportRecordFallbackProposal(recordHints))}`,
          ].join('\n')
        : `${prompt}\nReturn only one valid JSON object matching the requested import shape.`;
      const visionSources = normalizedEvidence.filter(source => source.status === 'analyzed' && source.vision).slice(0, 4);
      const groqModalities: Array<'vision' | 'text'> = visionSources.length ? (hasUsableText ? ['vision', 'text'] : ['vision']) : ['text'];
      for (const modality of groqModalities) {
        if (decoded) break;
        const fallbackModel = modality === 'vision'
          ? env.CURATE_IMPORT_GROQ_VISION_MODEL || 'qwen/qwen3.6-27b'
          : env.CURATE_IMPORT_FALLBACK_MODEL || 'openai/gpt-oss-20b';
        try {
          const textContent = hasUsableText ? buildGroqTextInput(normalizedEvidence, fallbackPrompt).content : fallbackPrompt;
          const content = modality === 'vision' ? [
            { type: 'text', text: textContent },
            ...visionSources.map(source => buildGroqVisionInput(source, 'Analyze this image only as part of the attached untrusted record.').content)
              .flat().filter(part => part.type === 'image_url'),
          ] : textContent;
          const ai = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST', headers: { 'content-type': 'application/json', Authorization: `Bearer ${env.GROQ_API_KEY}` },
            body: JSON.stringify({
              model: fallbackModel,
              messages: [{ role: 'user', content }],
              temperature: 0,
              max_completion_tokens: 2048,
              response_format: { type: 'json_object' },
            }),
          });
          if (!ai.ok) {
            const providerError = await ai.text();
            console.error(`Curate import fallback analysis upstream error: ${ai.status}: ${providerError.slice(0, 1000)}`);
            throw new Error(`analysis_fallback_provider_${ai.status}`);
          }
          const candidate = decodeImportAnalysisProposal(JSON.parse(groqResponseText(await ai.json())));
          const validated = validateCandidate(candidate);
          decoded = candidate;
          validatedNormalized = validated.normalized;
          validatedAnnotations = validated.annotations;
          analysisModel = fallbackModel;
          analysisAttempts.push({ stage: 'provider', provider: 'groq', model: fallbackModel, modality, outcome: 'succeeded', sourceIds: analyzedSourceIds });
        } catch (error) {
          providerFailure = error instanceof Error ? error.message : providerFailure;
          analysisAttempts.push({ stage: 'provider', provider: 'groq', model: fallbackModel, modality, outcome: 'failed', failureClass: providerFailure, sourceIds: analyzedSourceIds });
          console.error(`Curate import fallback analysis failed: ${providerFailure.slice(0, 500)}`);
        }
      }
    }
    let deterministicIncompleteSourceIds = new Set<string>();
    if (!decoded) {
      deterministicIncompleteSourceIds = new Set([...recordHintsBySource]
        .filter(([, hints]) => !hints.complete)
        .map(([sourceId]) => sourceId));
      const provenItems = [...recordHintsBySource.values()].flatMap(hints => hints.complete
        ? hints.items
        : hints.items.filter(item => item.arithmeticMatches));
      const provenHints = deterministicIncompleteSourceIds.size === 0 ? recordHints : {
        ...recordHints,
        complete: true,
        items: provenItems,
      };
      if (!provenHints.items.length) throw new Error(providerFailure);
      const candidate = buildImportRecordFallbackProposal(provenHints);
      const validated = validateCandidate(candidate);
      decoded = candidate;
      validatedNormalized = validated.normalized;
      validatedAnnotations = validated.annotations;
      analysisModel = 'record-parser-v1';
      analysisAttempts.push({ stage: 'provider', provider: 'deterministic', model: analysisModel, modality: 'deterministic', outcome: 'succeeded', sourceIds: analyzedSourceIds });
    }
    analysisRecordAnnotations = validatedAnnotations!;
    if (deterministicIncompleteSourceIds.size) {
      analysisReviewBlockers = analyzedSources.filter(source => deterministicIncompleteSourceIds.has(source.id)).map(source => ({
        sourceId: source.id,
        code: 'analysis_partial_record_unparsed',
        kind: 'review_blocker',
        text: boundedExcerpt(source.text!, 1000),
        evidenceRef: source.id,
      }));
      analyzedSources = analyzedSources.map(source => deterministicIncompleteSourceIds.has(source.id)
        ? { ...source, analysisStatus: 'failed' as const, analysisError: 'analysis_partial_record_unparsed' }
        : source);
    }
    const normalized = validatedNormalized!;
    const evidenceReferences = evidenceReferencesBySource(normalized);
    const normalizedEvidenceById = new Map(normalizedEvidence.map(source => [source.sourceId, source]));
    const existingGroups = new Map(groupsResult.results.map(row => [String(row.group_key), row]));
    const groupSourceIds = (group: (typeof normalized.groups)[number]) => [...new Set(group.items
      .map(item => Array.isArray(item.evidenceRefs) && typeof item.evidenceRefs[0] === 'string' ? item.evidenceRefs[0].split(':')[0] : null)
      .filter((sourceId): sourceId is string => Boolean(sourceId)))]
      .sort();
    const persistedGroupKey = (group: (typeof normalized.groups)[number]) => requestedSourceIds
      ? JSON.stringify([groupSourceIds(group), group.key])
      : group.key;
    const existingSourceIdsByGroup = new Map<string, string[]>();
    for (const item of itemsResult.results) if (typeof item.vendor_group_id === 'string' && typeof item.source_id === 'string') {
      const sourceIds = existingSourceIdsByGroup.get(item.vendor_group_id) ?? [];
      if (!sourceIds.includes(item.source_id)) sourceIds.push(item.source_id);
      existingSourceIdsByGroup.set(item.vendor_group_id, sourceIds.sort());
    }
    const sameSourceIds = (left: string[], right: string[]) => left.length === right.length && left.every((value, index) => value === right[index]);
    const existingGroupFor = (group: (typeof normalized.groups)[number]) => {
      const exact = existingGroups.get(persistedGroupKey(group));
      if (exact || !requestedSourceIds) return exact;
      const legacy = existingGroups.get(group.key);
      return legacy && sameSourceIds(existingSourceIdsByGroup.get(String(legacy.id)) ?? [], groupSourceIds(group)) ? legacy : undefined;
    };
    normalized.groups = normalized.groups.map(group => {
      const existing = existingGroupFor(group);
      const vendorConfirmed = typeof existing?.resolved_vendor_customer_id === 'string';
      const uncertainty = { ...(group.uncertainty ?? {}) };
      if (vendorConfirmed) delete uncertainty.vendor;
      const vendorBlocked = !vendorConfirmed && ((group.vendorConfidence != null && group.vendorConfidence < 0.8) || 'vendor' in uncertainty);
      return { ...group, vendorConfidence: vendorConfirmed ? 1 : group.vendorConfidence, uncertainty, items: group.items.map(item => {
        const trustedHintMatch = item.duplicateResolution === 'matched' && typeof item.proposedCompassEntryId === 'string'
          && (candidates.identities ?? []).some(candidate => candidate.id === item.proposedCompassEntryId
            && (item.proposedProductId == null || candidate.productId === item.proposedProductId));
        const identityResolution = trustedHintMatch ? {
          duplicateResolution: 'matched' as const,
          proposedCompassEntryId: item.proposedCompassEntryId,
          proposedProductId: item.proposedProductId ?? null,
        } : resolveIdentityCandidate(item, candidates.identities ?? [], group.proposedVendorName);
        const resolved = renormalizeImportItemData({ ...item, ...identityResolution });
        const canonicalIdentity = exactCanonicalIdentity(resolved, candidates);
        if (canonicalIdentity?.name) {
          resolved.englishName = canonicalIdentity.name;
          resolved.validation = { ...resolved.validation, translation: 'canonical_match' };
          resolved.blockingFields = resolved.blockingFields.filter(field => field !== 'englishName');
        }
        const blockers = Array.isArray(resolved.blockingFields) ? resolved.blockingFields.filter((field): field is string => typeof field === 'string') : [];
        return vendorBlocked ? { ...resolved, blockingFields: [...new Set([...blockers, 'vendor'])] } : resolved;
      }) };
    });
    const itemIdentity = (sourceId: unknown, sourceItemId: unknown) => `${String(sourceId ?? '')}\u0000${String(sourceItemId ?? '')}`;
    const existingItems = new Map(itemsResult.results.map(row => {
      const parsed = parseJson(row.parsed_data_json, {}) as Record<string, unknown>;
      return [itemIdentity(row.source_id, parsed.sourceItemId), row];
    }));
    const keptGroupIds = new Set<string>();
    const keptItemIds = new Set<string>();
    const statements: D1PreparedStatement[] = sourceAnalysisStatements(env, params.id, ctx.accountId, attemptToken, analyzedSources, evidenceReferences);
    let position = 0;
    for (let groupPosition = 0; groupPosition < normalized.groups.length; groupPosition++) {
      const group = normalized.groups[groupPosition];
      const groupKey = persistedGroupKey(group);
      const existingGroup = existingGroupFor(group);
      const groupId = existingGroup ? String(existingGroup.id) : crypto.randomUUID();
      keptGroupIds.add(groupId);
      const matched = vendorMatch(group.proposedVendorName, vendors);
      const proposedCandidate = group.proposedVendorCustomerId && vendors.some(vendor => vendor.id === group.proposedVendorCustomerId) ? group.proposedVendorCustomerId : matched.id;
      const confidence = group.vendorConfidence ?? matched.confidence;
      const resolvedVendor = confidence != null && confidence >= 0.9 ? proposedCandidate : null;
      if (existingGroup) statements.push(env.DB.prepare(
        `UPDATE curate_import_vendor_groups SET position = ?, group_key = ?, proposed_vendor_name = ?, resolved_vendor_customer_id = COALESCE(resolved_vendor_customer_id, ?), vendor_confidence = ?, uncertainty_json = ?, updated_at = datetime('now')
         WHERE id = ? AND account_id = ? AND EXISTS (SELECT 1 FROM curate_import_batches WHERE analysis_attempt_token = ? AND id = ? AND account_id = ? AND review_state NOT IN ('completed', 'abandoned') AND finalize_idempotency_key IS NULL)`
      ).bind(groupPosition, groupKey, group.proposedVendorName, resolvedVendor, confidence, JSON.stringify(group.uncertainty ?? {}), groupId, ctx.accountId, attemptToken, params.id, ctx.accountId));
      else statements.push(env.DB.prepare(
        `INSERT INTO curate_import_vendor_groups (id, batch_id, account_id, position, group_key, proposed_vendor_name, resolved_vendor_customer_id, vendor_confidence, uncertainty_json)
         SELECT ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM curate_import_batches WHERE analysis_attempt_token = ? AND id = ? AND account_id = ? AND review_state NOT IN ('completed', 'abandoned') AND finalize_idempotency_key IS NULL)`
      ).bind(groupId, params.id, ctx.accountId, groupPosition, groupKey, group.proposedVendorName, resolvedVendor, confidence, JSON.stringify(group.uncertainty ?? {}), attemptToken, params.id, ctx.accountId));
      for (const proposed of group.items) {
        const proposedSourceId = Array.isArray(proposed.evidenceRefs) && typeof proposed.evidenceRefs[0] === 'string' ? proposed.evidenceRefs[0].split(':')[0] : null;
        const existing = existingItems.get(itemIdentity(proposedSourceId, proposed.sourceItemId));
        const itemId = existing ? String(existing.id) : crypto.randomUUID();
        keptItemIds.add(itemId);
        const manual = existing ? parseJson(existing.manually_corrected_fields_json, []) : [];
        const manualFields = Array.isArray(manual) ? manual.filter(value => typeof value === 'string') as string[] : [];
        const previousParsed = existing ? parseJson(existing.parsed_data_json, {}) as Record<string, unknown> : {};
        const parsed: Record<string, unknown> = { ...proposed };
        for (const path of manualFields) if (path.startsWith('parsed_data.')) {
          const key = path.slice('parsed_data.'.length); parsed[key] = previousParsed[key];
        }
        const normalizedParsed = canonicalStoredItem(parsed, {
          sourceLanguage: normalized.language,
          sources: normalizedEvidenceById,
          vendorId: resolvedVendor,
          vendorName: group.proposedVendorName,
        });
        const name = manualFields.includes('name') ? existing?.name : (normalizedParsed.englishName ?? normalizedParsed.originalName ?? null);
        const category = manualFields.includes('category') ? existing?.category : proposed.category;
        const uncertainty = manualFields.includes('uncertainty') ? parseJson(existing?.uncertainty_json, {}) : proposed.uncertainty;
        const confidenceValues = Object.values(object(proposed.confidence) ?? {}).filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
        if (existing) statements.push(env.DB.prepare(
          `UPDATE curate_import_items SET vendor_group_id = ?, position = ?, category = ?, name = ?, parsed_data_json = ?, confidence = ?, uncertainty_json = ?, review_state = 'reviewing', updated_at = datetime('now')
           WHERE id = ? AND batch_id = ? AND account_id = ? AND EXISTS (SELECT 1 FROM curate_import_batches WHERE analysis_attempt_token = ? AND id = ? AND account_id = ? AND review_state NOT IN ('completed', 'abandoned') AND finalize_idempotency_key IS NULL)`
        ).bind(groupId, position++, category, name, JSON.stringify(normalizedParsed), confidenceValues.length ? Math.min(...confidenceValues) : null, JSON.stringify(uncertainty), itemId, params.id, ctx.accountId, attemptToken, params.id, ctx.accountId));
        else statements.push(env.DB.prepare(
          `INSERT INTO curate_import_items (id, batch_id, source_id, account_id, created_by_user_id, position, category, name, raw_text, parsed_data_json, confidence, uncertainty_json, review_state, compass_entry_id, reserved_compass_entry_id, vendor_group_id, manually_corrected_fields_json)
           SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'reviewing', NULL, ?, ?, '[]' WHERE EXISTS (SELECT 1 FROM curate_import_batches WHERE analysis_attempt_token = ? AND id = ? AND account_id = ? AND review_state NOT IN ('completed', 'abandoned') AND finalize_idempotency_key IS NULL)`
        ).bind(itemId, params.id, proposedSourceId, ctx.accountId, ctx.userId, position++, category, name, null, JSON.stringify(normalizedParsed), confidenceValues.length ? Math.min(...confidenceValues) : null, JSON.stringify(proposed.uncertainty), crypto.randomUUID(), groupId, attemptToken, params.id, ctx.accountId));
      }
    }
    for (const row of itemsResult.results) {
      if (keptItemIds.has(String(row.id))) continue;
      const belongsToRetry = !requestedSourceIds || (typeof row.source_id === 'string' && requestedSourceIds.includes(row.source_id));
      const manuallyCorrected = (parseJson(row.manually_corrected_fields_json, []) as unknown[]).length > 0;
      if (!belongsToRetry || manuallyCorrected) {
        if (typeof row.vendor_group_id === 'string') keptGroupIds.add(row.vendor_group_id);
        continue;
      }
      statements.push(env.DB.prepare("DELETE FROM curate_import_items WHERE id = ? AND batch_id = ? AND account_id = ? AND EXISTS (SELECT 1 FROM curate_import_batches WHERE analysis_attempt_token = ? AND id = ? AND account_id = ? AND review_state NOT IN ('completed', 'abandoned') AND finalize_idempotency_key IS NULL)").bind(row.id, params.id, ctx.accountId, attemptToken, params.id, ctx.accountId));
    }
    for (const row of groupsResult.results) if (!keptGroupIds.has(String(row.id))) {
      statements.push(env.DB.prepare("DELETE FROM curate_import_vendor_groups WHERE id = ? AND batch_id = ? AND account_id = ? AND EXISTS (SELECT 1 FROM curate_import_batches WHERE analysis_attempt_token = ? AND id = ? AND account_id = ? AND review_state NOT IN ('completed', 'abandoned') AND finalize_idempotency_key IS NULL)").bind(row.id, params.id, ctx.accountId, attemptToken, params.id, ctx.accountId));
    }
    const annotations = mergeAnalysisAnnotations(batch.analysis_annotations_json, {
      records: analysisRecordAnnotations,
      attempts: analysisAttempts,
      reviewBlockers: analysisReviewBlockers,
    }, requestedSourceIds);
    statements.push(env.DB.prepare(
      "UPDATE curate_import_batches SET review_state = 'reviewing', analysis_state = 'complete', analysis_overview = ?, analysis_language = ?, analysis_version = analysis_version + 1, analysis_model = ?, analysis_annotations_json = ?, analysis_error = NULL, analysis_attempt_token = NULL, updated_at = datetime('now') WHERE analysis_attempt_token = ? AND id = ? AND account_id = ? AND review_state NOT IN ('completed', 'abandoned') AND finalize_idempotency_key IS NULL"
    ).bind(normalized.overview, normalized.language, analysisModel, JSON.stringify(annotations), attemptToken, params.id, ctx.accountId));
    const persisted = await env.DB.batch(statements);
    if (!(persisted.at(-1)?.meta.changes ?? 0)) throw new AnalysisSupersededError();
    return response(await fullBatch(env, params.id, ctx.accountId));
  } catch (error) {
    if (error instanceof AnalysisSupersededError) return analysisSupersededResponse();
    const message = error instanceof Error ? error.message.slice(0, 500) : 'analysis_failed';
    const failedSources = analyzedSources.map(source => source.analysisStatus === 'analyzed'
      ? { ...source, analysisStatus: 'failed' as const, analysisError: message }
      : source);
    const failedStatements = sourceAnalysisStatements(env, params.id, ctx.accountId, attemptToken, failedSources);
    const annotations = mergeAnalysisAnnotations(batch.analysis_annotations_json, {
      records: analysisRecordAnnotations,
      attempts: analysisAttempts,
      reviewBlockers: analysisReviewBlockers,
    }, requestedSourceIds);
    failedStatements.push(env.DB.prepare("UPDATE curate_import_batches SET analysis_state = 'failed', analysis_error = ?, analysis_annotations_json = ?, analysis_attempt_token = NULL, updated_at = datetime('now') WHERE analysis_attempt_token = ? AND id = ? AND account_id = ? AND review_state NOT IN ('completed', 'abandoned') AND finalize_idempotency_key IS NULL")
      .bind(message, JSON.stringify(annotations), attemptToken, params.id, ctx.accountId));
    const failed = await env.DB.batch(failedStatements);
    if (!(failed.at(-1)?.meta.changes ?? 0)) return analysisSupersededResponse();
    const status = message === 'analysis_no_usable_evidence' || message === 'analysis_too_many_items' ? 422 : message === 'analysis_unsupported_document' ? 415 : 502;
    const publicMessage = message === 'analysis_no_usable_evidence'
      ? 'This record has no usable text, photo, or supported file to analyze.'
      : message === 'analysis_too_many_items'
        ? 'This record contains more than 100 items. Split it into smaller imports and try again.'
      : "We couldn't analyze this record. Your record is saved. Try again.";
    return response({ error: publicMessage, code: message }, status);
  }
}

export type CurateFinalizeMovement = (line: FinalizeReceiptLine, idempotencyKey: string) => Promise<{ movementId: string }>;

export function holdingMatchesImportIdentity(
  holding: Record<string, unknown>,
  item: Pick<CurateFinalizeData['items'][number], 'category' | 'purpose'>,
  compassEntryId: string,
  accountId: string,
) {
  return holdingMatchesFinalizeItem({
    accountId: String(holding.account_id ?? ''),
    compassEntryId: String(holding.source_compass_entry_id ?? ''),
    category: holding.type === 'Teaware' ? 'teaware' : 'tea',
    purpose: effectiveInventoryPurpose(holding).purpose,
  }, item, compassEntryId, accountId);
}

function parsedFinalizeItem(row: Record<string, unknown>) {
  const parsed = parseJson(row.parsed_data_json, {}) as Record<string, unknown>;
  const category = row.category === 'teaware' ? 'teaware' : 'tea';
  const quantity = category === 'teaware' ? parsed.totalUnits : parsed.totalQuantityGrams;
  const unit = category === 'teaware' ? 'unit' : 'g';
  const purpose = parsed.inventoryPurpose ?? parsed.inventory_purpose ?? parsed.purpose ?? null;
  const productId = parsed.productId ?? parsed.product_id ?? null;
  const disposition = parsed.disposition === 'in_transit' || parsed.disposition === 'library_only' || parsed.disposition === 'received'
    ? parsed.disposition
    : parsed.acquired === true ? 'received' : null;
  const blockingFields = Array.isArray(parsed.blockingFields) ? parsed.blockingFields.filter(value => typeof value === 'string') as string[] : [];
  if (!disposition) blockingFields.push('disposition');
  return {
    id: String(row.id), groupId: String(row.vendor_group_id ?? ''), category,
    disposition: disposition as CurateFinalizeData['items'][number]['disposition'],
    name: String(row.name ?? parsed.englishName ?? parsed.originalName ?? ''),
    compassEntryId: typeof row.compass_entry_id === 'string' ? row.compass_entry_id : parsed.duplicateResolution === 'matched' && typeof parsed.proposedCompassEntryId === 'string' ? parsed.proposedCompassEntryId : null,
    productId: disposition === 'library_only' ? null : typeof productId === 'string' ? productId : parsed.duplicateResolution === 'matched' && typeof parsed.proposedProductId === 'string' ? parsed.proposedProductId : null,
    identityDisposition: row.review_state === 'accepted' ? 'created' : row.review_state === 'merged' ? 'reused' : undefined,
    duplicateResolution: parsed.duplicateResolution === 'matched' || parsed.duplicateResolution === 'new' || parsed.duplicateResolution === 'unresolved' ? parsed.duplicateResolution : 'unresolved',
    quantity: typeof quantity === 'number' ? quantity : null, unit,
    packCount: typeof parsed.packCount === 'number' ? parsed.packCount : null,
    lineCost: typeof parsed.lineCost === 'number' ? parsed.lineCost : null,
    lineCostExact: typeof parsed.lineCostExact === 'string' ? parsed.lineCostExact : null,
    currency: typeof parsed.currency === 'string' ? parsed.currency : null,
    unitCost: typeof parsed.unitCost === 'number' ? parsed.unitCost : null,
    unitCostExact: typeof parsed.unitCostExact === 'string' ? parsed.unitCostExact : null,
    purpose: purpose === 'working' || purpose === 'sample' || purpose === 'personal' ? purpose : null,
    blockingFields: [...new Set(blockingFields)],
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
        const journeyId = typeof batch.journey_id === 'string' ? batch.journey_id : null;
        const [groupRows, itemRows, journey] = await Promise.all([
          env.DB.prepare(`SELECT g.*, c.name vendor_name, c.tags vendor_tags FROM curate_import_vendor_groups g
            LEFT JOIN customers c ON c.id = g.resolved_vendor_customer_id AND c.account_id = g.account_id
            WHERE g.batch_id = ? AND g.account_id = ? ORDER BY g.position`).bind(batchId, ctx.accountId).all<Record<string, unknown>>(),
          env.DB.prepare('SELECT * FROM curate_import_items WHERE batch_id = ? AND account_id = ? AND review_state != ? ORDER BY position').bind(batchId, ctx.accountId, 'abandoned').all<Record<string, unknown>>(),
          journeyId ? env.DB.prepare('SELECT name, season, year FROM curate_journeys WHERE id = ? AND account_id = ?').bind(journeyId, ctx.accountId).first<Record<string, unknown>>() : Promise.resolve(null),
        ]);
        const groups = groupRows.results.map(row => {
          const tags = parseJson(row.vendor_tags, []);
          const validVendor = typeof row.resolved_vendor_customer_id === 'string' && Array.isArray(tags) && tags.includes('vendor');
          return { id: String(row.id), vendorId: validVendor ? String(row.resolved_vendor_customer_id) : null, vendorName: typeof row.vendor_name === 'string' ? row.vendor_name : null, position: Number(row.position) };
        });
        return {
          batch: { id: batchId, accountId: ctx.accountId, journeyId, journeyName: journey ? [journey.name, journey.season, journey.year].filter(value => value != null && value !== '').join(' · ') : null, reviewState: String(batch.review_state) },
          groups, items: itemRows.results.map(parsedFinalizeItem),
        } as CurateFinalizeData;
      },
      loadFinalization: async batchId => {
        const batch = await scopedBatch(env, batchId, ctx.accountId);
        if (!batch || typeof batch.finalize_idempotency_key !== 'string') return null;
        return { idempotencyKey: batch.finalize_idempotency_key, result: typeof batch.finalize_result_json === 'string' ? parseJson(batch.finalize_result_json, null) : null };
      },
      validateResolutions: async data => {
        for (const item of data.items) {
          if (item.compassEntryId && item.duplicateResolution === 'matched') {
            const identity = await env.DB.prepare('SELECT id, category FROM tea_compass_entries WHERE id = ? AND account_id = ? AND user_id = ?').bind(item.compassEntryId, ctx.accountId, ctx.userId).first<Record<string, unknown>>();
            if (identity?.category !== item.category) throw new CurateImportFinalizeError('validation_failed', 'Matched Curate identity is missing or incompatible', [{ field: 'duplicateResolution', itemId: item.id, message: 'Choose a valid matching identity' }]);
          }
          if (item.disposition === 'library_only') continue;
          if (item.productId) {
            if (!item.compassEntryId) throw new CurateImportFinalizeError('validation_failed', 'Selected holding requires a Curate identity', [{ field: 'product', itemId: item.id, message: 'Choose the matching Library identity' }]);
            const holding = await env.DB.prepare('SELECT * FROM products WHERE id = ? AND account_id = ?').bind(item.productId, ctx.accountId).first<Record<string, unknown>>();
            if (!holding || !holdingMatchesImportIdentity(holding, item, item.compassEntryId, ctx.accountId)) throw new CurateImportFinalizeError('validation_failed', 'Selected holding is missing or incompatible', [{ field: 'product', itemId: item.id, message: 'Choose a holding linked to this identity, category, and purpose' }]);
          } else if (item.compassEntryId) {
            const canonical = await env.DB.prepare('SELECT * FROM products WHERE account_id = ? AND source_compass_entry_id = ?').bind(ctx.accountId, item.compassEntryId).first<Record<string, unknown>>();
            if (canonical && !holdingMatchesImportIdentity(canonical, item, item.compassEntryId, ctx.accountId)) throw new CurateImportFinalizeError('validation_failed', 'Existing identity holding is incompatible with this import', [{ field: inventoryPurposeConflict(canonical, item.purpose!) ? 'purpose' : 'product', itemId: item.id, message: 'Review the existing Inventory holding' }]);
          }
        }
      },
      reserveFinalization: async (batchId, key) => {
        const changed = await env.DB.prepare("UPDATE curate_import_batches SET finalize_idempotency_key = ?, analysis_attempt_token = NULL, analysis_state = CASE WHEN analysis_state = 'analyzing' THEN 'complete' ELSE analysis_state END WHERE id = ? AND account_id = ? AND review_state NOT IN ('completed', 'abandoned') AND finalize_idempotency_key IS NULL")
          .bind(key, batchId, ctx.accountId).run();
        if (!(changed.meta.changes ?? 0)) throw new CurateImportFinalizeError('idempotency_conflict', 'Import was already finalized with a different idempotency key');
      },
      releaseFinalization: async (batchId, key) => {
        await env.DB.prepare(`UPDATE curate_import_batches SET finalize_idempotency_key = NULL, updated_at = datetime('now')
          WHERE id = ? AND account_id = ? AND finalize_idempotency_key = ? AND review_state NOT IN ('completed', 'abandoned') AND finalize_result_json IS NULL`)
          .bind(batchId, ctx.accountId, key).run();
      },
      ensureIdentity: async (item, batch) => {
        if (item.compassEntryId) {
          const owned = await env.DB.prepare('SELECT id, category FROM tea_compass_entries WHERE id = ? AND account_id = ? AND user_id = ?').bind(item.compassEntryId, ctx.accountId, ctx.userId).first<Record<string, unknown>>();
          if (owned?.category === item.category) {
            await env.DB.prepare("UPDATE curate_import_items SET compass_entry_id = ?, review_state = 'merged', reviewed_by_user_id = ?, reviewed_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND batch_id = ? AND account_id = ?")
              .bind(item.compassEntryId, ctx.userId, item.id, batch.id, ctx.accountId).run();
            return { id: item.compassEntryId, disposition: item.identityDisposition ?? 'reused' };
          }
          if (item.duplicateResolution === 'matched') throw new CurateImportFinalizeError('validation_failed', 'Matched Curate identity is missing or incompatible', [{ field: 'duplicateResolution', itemId: item.id, message: 'Choose a valid matching identity' }]);
        }
        const row = await scopedItem(env, batch.id, item.id, ctx.accountId);
        if (!row) throw new CurateImportFinalizeError('not_found', 'Import item not found');
        const compassId = String(row.reserved_compass_entry_id);
        const parsed = parseJson(row.parsed_data_json, {}) as Record<string, unknown>;
        const canonical = normalizeCanonicalImportRecord(parsed);
        const structured = canonicalImportToCompassValues(canonical);
        const values = { ...structured, name: canonical.englishName ?? item.name, category: canonical.category, status: 'logged', journey_id: batch.journeyId };
        const columns = Object.keys(values);
        await env.DB.batch([
          env.DB.prepare(`INSERT OR IGNORE INTO tea_compass_entries (id, user_id, account_id, import_item_id, ${columns.join(', ')}) VALUES (?, ?, ?, ?, ${columns.map(() => '?').join(', ')})`)
            .bind(compassId, ctx.userId, ctx.accountId, item.id, ...columns.map(column => values[column as keyof typeof values])),
          env.DB.prepare("UPDATE curate_import_items SET compass_entry_id = ?, review_state = 'accepted', reviewed_by_user_id = ?, reviewed_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND batch_id = ? AND account_id = ?")
            .bind(compassId, ctx.userId, item.id, batch.id, ctx.accountId),
        ]);
        const owned = await env.DB.prepare('SELECT id FROM tea_compass_entries WHERE id = ? AND account_id = ? AND user_id = ? AND import_item_id = ?').bind(compassId, ctx.accountId, ctx.userId, item.id).first();
        if (!owned) throw new Error('Compass identity could not be resolved');
        return { id: compassId, disposition: 'created' };
      },
      ensureProduct: async (item, compassEntryId, identityDisposition) => {
        if (item.productId) {
          const owned = await env.DB.prepare('SELECT * FROM products WHERE id = ? AND account_id = ?').bind(item.productId, ctx.accountId).first<Record<string, unknown>>();
          const categoryMatches = owned && (owned.type === 'Teaware') === (item.category === 'teaware');
          const identityMatches = owned?.source_compass_entry_id === compassEntryId;
          if (!owned || !categoryMatches || !identityMatches) throw new CurateImportFinalizeError('validation_failed', 'Selected holding does not belong to this Curate identity', [{ field: 'product', itemId: item.id, message: 'Choose a matching holding' }]);
          const conflict = inventoryPurposeConflict(owned, item.purpose!);
          if (conflict) throw new CurateImportFinalizeError('validation_failed', 'Selected holding has a different inventory purpose', [{ field: 'purpose', itemId: item.id, message: `Holding is ${conflict}` }]);
          return { id: item.productId, disposition: 'reused' };
        }
        const entry = await env.DB.prepare('SELECT draft_product_id, type, chinese_name, origin_region, year FROM tea_compass_entries WHERE id = ? AND account_id = ? AND user_id = ?').bind(compassEntryId, ctx.accountId, ctx.userId).first<Record<string, unknown>>();
        if (typeof entry?.draft_product_id === 'string') {
          const owned = await env.DB.prepare('SELECT * FROM products WHERE id = ? AND account_id = ?').bind(entry.draft_product_id, ctx.accountId).first<Record<string, unknown>>();
          if (owned && holdingMatchesImportIdentity(owned, item, compassEntryId, ctx.accountId)) return { id: entry.draft_product_id, disposition: identityDisposition === 'created' ? 'created' : 'reused' };
        }
        const identity = await env.DB.prepare('SELECT * FROM products WHERE account_id = ? AND source_compass_entry_id = ?').bind(ctx.accountId, compassEntryId).first<Record<string, unknown>>();
        if (identity) {
          const categoryMatches = (identity.type === 'Teaware') === (item.category === 'teaware');
          const conflict = inventoryPurposeConflict(identity, item.purpose!);
          if (!categoryMatches || conflict) throw new CurateImportFinalizeError('validation_failed', 'Existing identity holding is incompatible with this import', [{ field: conflict ? 'purpose' : 'product', itemId: item.id, message: conflict ? `Holding is ${conflict}` : 'Holding category differs' }]);
          return { id: String(identity.id), disposition: identityDisposition === 'created' ? 'created' : 'reused' };
        }
        const importRow = await scopedItem(env, params.id, item.id, ctx.accountId);
        if (!importRow) throw new CurateImportFinalizeError('not_found', 'Import item not found');
        const canonical = normalizeCanonicalImportRecord(parseJson(importRow.parsed_data_json, {}) as Record<string, unknown>);
        const canonicalProduct = canonicalImportToProductValues(canonical);
        const productId = crypto.randomUUID();
        const productValues: Record<string, unknown> = {
          ...canonicalProduct,
          type: canonicalProduct.type ?? (item.category === 'teaware' ? 'Teaware' : entry?.type ?? 'Misc'),
          product_name: canonicalProduct.product_name ?? canonical.englishName ?? item.name,
          given_name: canonicalProduct.given_name ?? canonical.englishName ?? item.name,
          status: 'Draft',
          stock_grams: item.unit === 'g' ? 0 : null,
          quantity_units: item.unit === 'unit' ? 0 : null,
          inventory_purpose: item.purpose,
          is_sample: item.purpose === 'sample' ? 1 : 0,
          is_personal: item.purpose === 'personal' ? 1 : 0,
          stock_known_at: new Date().toISOString(),
          is_public: 0,
          shown_in_shop: 0,
          source_compass_entry_id: compassEntryId,
          owner_user_id: ctx.userId,
        };
        const productColumns = Object.keys(productValues);
        await env.DB.batch([
          env.DB.prepare(`INSERT OR IGNORE INTO products (id, account_id, ${productColumns.join(', ')}) VALUES (?, ?, ${productColumns.map(() => '?').join(', ')})`)
            .bind(productId, ctx.accountId, ...productColumns.map(column => productValues[column])),
          env.DB.prepare("UPDATE tea_compass_entries SET draft_product_id = (SELECT id FROM products WHERE account_id = ? AND source_compass_entry_id = ?), updated_at = datetime('now') WHERE id = ? AND account_id = ? AND user_id = ?")
            .bind(ctx.accountId, compassEntryId, compassEntryId, ctx.accountId, ctx.userId),
        ]);
        const storedHolding = await env.DB.prepare('SELECT id FROM products WHERE account_id = ? AND source_compass_entry_id = ?').bind(ctx.accountId, compassEntryId).first<Record<string, unknown>>();
        if (!storedHolding) throw new Error('Inventory holding could not be resolved');
        return { id: String(storedHolding.id), disposition: 'created' };
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
        return { id: receiptId, groupId: group.id, lines: rows.results.map(row => {
          const input = lines.find(line => line.itemId === row.source_ref);
          if (!input) throw new Error('Inventory receipt line source could not be resolved');
          return {
            id: String(row.id), receiptId, itemId: String(row.source_ref), productId: String(row.product_id),
            disposition: input.disposition, compassEntryId: input.compassEntryId,
            quantity: Number(row.expected_quantity), unit: row.unit as 'g' | 'unit',
            purpose: row.intended_purpose as 'working' | 'sample' | 'personal', originalCostAmount: row.original_cost_amount == null ? null : Number(row.original_cost_amount), originalCostCurrency: String(row.original_cost_currency),
            originalUnitCost: row.original_unit_cost == null ? null : Number(row.original_unit_cost), packCount: Number(row.pack_count), originalCostAmountExact: String(row.original_cost_amount_exact ?? row.original_cost_amount), originalUnitCostExact: String(row.original_unit_cost_exact ?? row.original_unit_cost),
          };
        }) };
      },
      receiveLine,
      complete: async (batchId, key, finalizeResult) => {
        const changed = await env.DB.prepare(`UPDATE curate_import_batches SET review_state = 'completed', finalize_idempotency_key = ?, finalize_result_json = ?, analysis_state = CASE WHEN analysis_state = 'analyzing' THEN 'complete' ELSE analysis_state END, completed_at = datetime('now'), updated_at = datetime('now')
          WHERE id = ? AND account_id = ? AND (finalize_idempotency_key IS NULL OR finalize_idempotency_key = ?)`)
          .bind(key, JSON.stringify(finalizeResult), batchId, ctx.accountId, key).run();
        if (!(changed.meta.changes ?? 0)) throw new CurateImportFinalizeError('idempotency_conflict', 'Import was finalized by another request');
      },
    }, params.id, idempotencyKey);
    return response({ batch: await scopedBatch(env, params.id, ctx.accountId), journey: result.journey, receipts: result.receipts, items: result.items });
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
    if (!Array.isArray(rawItems) || rawItems.length > 100) return response({ error: 'An import can contain at most 100 items.', code: 'import_item_limit' }, 400);
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
  let vendorName: string | null = null;
  if (typeof vendorId === 'string') {
    const vendor = await env.DB.prepare('SELECT id, name, tags FROM customers WHERE id = ? AND account_id = ?').bind(vendorId, ctx.accountId).first<Record<string, unknown>>();
    const tags = parseJson(vendor?.tags, []);
    if (!vendor || !Array.isArray(tags) || !tags.includes('vendor')) return response({ error: 'Selected customer is not tagged as a vendor' }, 400);
    vendorName = String(vendor.name);
  }
  const groupUncertainty = parseJson(group.uncertainty_json, {}) as Record<string, unknown>;
  delete groupUncertainty.vendor;
  const statements: D1PreparedStatement[] = [env.DB.prepare("UPDATE curate_import_vendor_groups SET resolved_vendor_customer_id = ?, vendor_confidence = ?, uncertainty_json = ?, updated_at = datetime('now') WHERE id = ? AND account_id = ? AND EXISTS (SELECT 1 FROM curate_import_batches WHERE id = ? AND account_id = ? AND review_state NOT IN ('completed', 'abandoned') AND finalize_idempotency_key IS NULL)")
    .bind(vendorId, vendorId == null ? null : 1, JSON.stringify(groupUncertainty), params.groupId, ctx.accountId, params.id, ctx.accountId)];
  if (typeof vendorId === 'string') statements.push(vendorItemReviewPatch(env, params.groupId, ctx.accountId, vendorId, vendorName!, params.id));
  const results = await env.DB.batch(statements);
  if (!(results[0]?.meta.changes ?? 0)) return terminalResponse();
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
      await vendorItemReviewPatch(env, params.groupId, ctx.accountId, String(existing.id), String(existing.name), params.id).run();
      return response({ vendor: existing, group: groupRow(group) });
    }
  }
  const vendorId = `curate-vendor-${params.groupId}`;
  const deterministicWinner = await env.DB.prepare('SELECT * FROM customers WHERE id = ? AND account_id = ?').bind(vendorId, ctx.accountId).first<Record<string, unknown>>();
  if (deterministicWinner && normalizedName(String(deterministicWinner.name)) !== normalizedName(name)) return response({ error: 'Vendor group was concurrently created with a different name' }, 409);
  const inserted = await env.DB.prepare(`INSERT OR IGNORE INTO customers (id, account_id, name, company, email, phone, whatsapp, country, preferred_currency, tags, notes, source)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, '["vendor"]', ?, 'curate_import' WHERE EXISTS (SELECT 1 FROM curate_import_batches WHERE id = ? AND account_id = ? AND review_state NOT IN ('completed', 'abandoned') AND finalize_idempotency_key IS NULL)`)
    .bind(vendorId, ctx.accountId, name, text(body.company, 240), text(body.email, 320), text(body.phone, 100), text(body.whatsapp, 100), text(body.country, 120), text(body.preferred_currency, 20), text(body.notes, 2000), params.id, ctx.accountId).run();
  const winner = await env.DB.prepare('SELECT * FROM customers WHERE id = ? AND account_id = ?').bind(vendorId, ctx.accountId).first<Record<string, unknown>>();
  if (!winner || normalizedName(String(winner.name)) !== normalizedName(name)) return response({ error: 'Vendor group was concurrently created with a different name' }, 409);
  const groupUncertainty = parseJson(group.uncertainty_json, {}) as Record<string, unknown>;
  delete groupUncertainty.vendor;
  const statements: D1PreparedStatement[] = [env.DB.prepare(`UPDATE curate_import_vendor_groups SET resolved_vendor_customer_id = ?, updated_at = datetime('now')
      WHERE id = ? AND account_id = ?
        AND EXISTS (SELECT 1 FROM customers WHERE id = ? AND account_id = ?)
        AND EXISTS (SELECT 1 FROM curate_import_batches WHERE id = ? AND account_id = ? AND review_state NOT IN ('completed', 'abandoned') AND finalize_idempotency_key IS NULL)`)
      .bind(vendorId, params.groupId, ctx.accountId, vendorId, ctx.accountId, params.id, ctx.accountId),
    env.DB.prepare("UPDATE curate_import_vendor_groups SET vendor_confidence = ?, uncertainty_json = ?, updated_at = datetime('now') WHERE id = ? AND account_id = ? AND resolved_vendor_customer_id = ? AND EXISTS (SELECT 1 FROM curate_import_batches WHERE id = ? AND account_id = ? AND review_state NOT IN ('completed', 'abandoned') AND finalize_idempotency_key IS NULL)")
      .bind(1, JSON.stringify(groupUncertainty), params.groupId, ctx.accountId, vendorId, params.id, ctx.accountId),
    vendorItemReviewPatch(env, params.groupId, ctx.accountId, vendorId, String(winner.name), params.id)];
  const results = await env.DB.batch(statements);
  if (!(results[0]?.meta.changes ?? 0)) {
    if (inserted.meta.changes) await env.DB.prepare("DELETE FROM customers WHERE id = ? AND account_id = ? AND source = 'curate_import' AND NOT EXISTS (SELECT 1 FROM curate_import_vendor_groups WHERE account_id = ? AND resolved_vendor_customer_id = ?)").bind(vendorId, ctx.accountId, ctx.accountId, vendorId).run();
    return terminalResponse();
  }
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
     SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
     WHERE (SELECT COUNT(*) FROM curate_import_items WHERE batch_id = ? AND account_id = ?) < 100
       AND EXISTS (SELECT 1 FROM curate_import_batches WHERE id = ? AND account_id = ? AND review_state NOT IN ('completed', 'abandoned') AND finalize_idempotency_key IS NULL)`
  ).bind(id, params.id, sourceId, ctx.accountId, ctx.userId, existing.results.length, category, name, null, '{}', null, '{}', 'pending', null, crypto.randomUUID(), params.id, ctx.accountId, params.id, ctx.accountId).run();
  if (!(inserted.meta.changes ?? 0)) {
    const latestBatch = await scopedBatch(env, params.id, ctx.accountId);
    if (latestBatch && !batchIsTerminal(latestBatch)) {
      const latestItems = await env.DB.prepare('SELECT id FROM curate_import_items WHERE batch_id = ? AND account_id = ?').bind(params.id, ctx.accountId).all();
      if (latestItems.results.length >= 100) return response({ error: 'An import can contain at most 100 items.', code: 'import_item_limit' }, 409);
    }
    return terminalResponse();
  }
  await refreshImportBatchState(env, params.id, ctx.accountId);
  return response(itemRow((await scopedItem(env, params.id, id, ctx.accountId))!), 201);
}

export async function abandonCurateImport(_request: Request, env: ImportEnv, ctx: CurateImportContext, params: Record<string, string>) {
  const batch = await scopedBatch(env, params.id, ctx.accountId);
  if (!batch) return response({ error: 'Import not found' }, 404);
  if (batch.review_state === 'abandoned') return response({ success: true, id: params.id, review_state: 'abandoned' });
  if (batchIsTerminal(batch)) return terminalResponse();
  const results = await env.DB.batch([
    env.DB.prepare("UPDATE curate_import_items SET review_state = 'abandoned', updated_at = datetime('now') WHERE batch_id = ? AND account_id = ? AND review_state IN ('pending', 'reviewing') AND EXISTS (SELECT 1 FROM curate_import_batches WHERE id = ? AND account_id = ? AND review_state NOT IN ('completed', 'abandoned') AND finalize_idempotency_key IS NULL)").bind(params.id, ctx.accountId, params.id, ctx.accountId),
    env.DB.prepare("UPDATE curate_import_batches SET review_state = 'abandoned', updated_at = datetime('now') WHERE id = ? AND account_id = ? AND review_state NOT IN ('completed', 'abandoned') AND finalize_idempotency_key IS NULL").bind(params.id, ctx.accountId),
  ]);
  if (!(results[1]?.meta.changes ?? 0)) {
    const latestBatch = await scopedBatch(env, params.id, ctx.accountId);
    if (latestBatch?.review_state === 'abandoned') return response({ success: true, id: params.id, review_state: 'abandoned' });
    return terminalResponse();
  }
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
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.oasis.opendocument.spreadsheet', 'application/vnd.oasis.opendocument.text',
]);
const EVIDENCE_MAX_BYTES = IMPORT_SOURCE_MAX_BYTES;
const OLE_COMPOUND_FILE_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] as const;

function zipContainerEntries(bytes: ArrayBuffer) {
  const data = new Uint8Array(bytes);
  const view = new DataView(bytes);
  const signatureAt = (offset: number, signature: number) => offset >= 0 && offset + 4 <= data.length && view.getUint32(offset, true) === signature;
  let endOffset = -1;
  const earliestEnd = Math.max(0, data.length - 65_557);
  for (let offset = data.length - 22; offset >= earliestEnd; offset--) if (signatureAt(offset, 0x06054b50)) {
    const commentLength = view.getUint16(offset + 20, true);
    if (offset + 22 + commentLength === data.length) { endOffset = offset; break; }
  }
  if (endOffset < 0 || !signatureAt(0, 0x04034b50)) return null;
  const disk = view.getUint16(endOffset + 4, true);
  const centralDisk = view.getUint16(endOffset + 6, true);
  const entriesOnDisk = view.getUint16(endOffset + 8, true);
  const entryCount = view.getUint16(endOffset + 10, true);
  const centralSize = view.getUint32(endOffset + 12, true);
  const centralOffset = view.getUint32(endOffset + 16, true);
  if (disk !== 0 || centralDisk !== 0 || entriesOnDisk !== entryCount || entryCount < 1 || entryCount > 10_000
    || centralOffset + centralSize !== endOffset) return null;
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const entries: Array<{ name: string; compression: number; content: Uint8Array }> = [];
  let offset = centralOffset;
  try {
    for (let index = 0; index < entryCount; index++) {
      if (!signatureAt(offset, 0x02014b50) || offset + 46 > endOffset) return null;
      const compression = view.getUint16(offset + 10, true);
      const compressedSize = view.getUint32(offset + 20, true);
      const filenameLength = view.getUint16(offset + 28, true);
      const extraLength = view.getUint16(offset + 30, true);
      const commentLength = view.getUint16(offset + 32, true);
      const localOffset = view.getUint32(offset + 42, true);
      const nextOffset = offset + 46 + filenameLength + extraLength + commentLength;
      if (nextOffset > endOffset || !signatureAt(localOffset, 0x04034b50) || localOffset + 30 > centralOffset) return null;
      const name = decoder.decode(data.subarray(offset + 46, offset + 46 + filenameLength));
      const localFilenameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      const localName = decoder.decode(data.subarray(localOffset + 30, localOffset + 30 + localFilenameLength));
      const contentOffset = localOffset + 30 + localFilenameLength + localExtraLength;
      if (!name || name !== localName || contentOffset + compressedSize > centralOffset) return null;
      entries.push({ name, compression, content: data.subarray(contentOffset, contentOffset + compressedSize) });
      offset = nextOffset;
    }
  } catch {
    return null;
  }
  return offset === endOffset ? entries : null;
}

function officeDocumentSignatureMatches(contentType: string, bytes: ArrayBuffer, head: Uint8Array) {
  if (contentType === 'application/msword' || contentType === 'application/vnd.ms-excel') {
    return OLE_COMPOUND_FILE_SIGNATURE.every((byte, index) => head[index] === byte);
  }
  const entries = zipContainerEntries(bytes);
  if (!entries) return false;
  const names = new Set(entries.map(entry => entry.name));
  if (contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return names.has('[Content_Types].xml') && entries.some(entry => entry.name.startsWith('word/'));
  }
  if (contentType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
    return names.has('[Content_Types].xml') && entries.some(entry => entry.name.startsWith('xl/'));
  }
  const mimetype = entries.find(entry => entry.name === 'mimetype');
  if (!mimetype || mimetype.compression !== 0) return false;
  const mime = new TextDecoder().decode(mimetype.content);
  if (contentType === 'application/vnd.oasis.opendocument.spreadsheet') {
    return mime === 'application/vnd.oasis.opendocument.spreadsheet';
  }
  if (contentType === 'application/vnd.oasis.opendocument.text') {
    return mime === 'application/vnd.oasis.opendocument.text';
  }
  return false;
}

function storedSourceBytes(source: Record<string, unknown>) {
  const metadata = parseJson(source.metadata_json, {}) as Record<string, unknown>;
  if (typeof metadata.admission_size === 'number' && Number.isFinite(metadata.admission_size) && metadata.admission_size >= 0) return metadata.admission_size;
  const pastedBytes = typeof source.pasted_text === 'string' ? new TextEncoder().encode(source.pasted_text).byteLength : 0;
  return pastedBytes + (typeof source.r2_object_key === 'string' ? IMPORT_SOURCE_MAX_BYTES : 0);
}

function sourceAdmissionLimit(sources: Record<string, unknown>[], incomingBytes: number) {
  if (sources.length >= 50) return { error: 'An import can contain at most 50 records.', code: 'analysis_too_many_sources' };
  const aggregateBytes = sources.reduce((total, source) => total + storedSourceBytes(source), 0);
  if (aggregateBytes + incomingBytes > IMPORT_SOURCE_TOTAL_MAX_BYTES) return { error: 'Import records must total 20 MB or less.', code: 'source_bytes_total_too_large' };
  return null;
}

export async function uploadCurateImportEvidence(request: Request, env: ImportEnv, ctx: CurateImportContext, params: Record<string, string>) {
  const batch = await scopedBatch(env, params.id, ctx.accountId);
  if (!batch) return response({ error: 'Import not found' }, 404);
  if (batchIsTerminal(batch)) return terminalResponse();
  if (!env.MEDIA_BUCKET) return response({ error: 'Record storage is not configured. Your file was not saved.' }, 503);
  const contentType = (request.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
  if (!EVIDENCE_TYPES.has(contentType)) return response({ error: 'Unsupported record file type' }, 415);
  const declaredSize = Number(request.headers.get('Content-Length') || 0);
  if (declaredSize > EVIDENCE_MAX_BYTES) return response({ error: 'Record files must be 5 MB or smaller' }, 413);
  const encodedFilename = request.headers.get('X-Filename') || '';
  const clientEvidenceId = request.headers.get('X-Client-Evidence-Id') || '';
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(clientEvidenceId)) return response({ error: 'Invalid client record identity' }, 400);
  const existing = await env.DB.prepare(
    'SELECT * FROM curate_import_sources WHERE batch_id = ? AND account_id = ? AND client_evidence_id = ?'
  ).bind(params.id, ctx.accountId, clientEvidenceId).first<Record<string, unknown>>();
  if (existing) return response({ ...sourceRow(existing), already_uploaded: true });
  let filename = '';
  try { filename = decodeURIComponent(encodedFilename); } catch { return response({ error: 'Invalid record filename' }, 400); }
  if (!filename || filename.length > 500 || /[\u0000-\u001f\u007f]/.test(filename)) return response({ error: 'Invalid record filename' }, 400);
  const bytes = await request.arrayBuffer();
  if (!bytes.byteLength) return response({ error: 'Record file is empty' }, 400);
  if (bytes.byteLength > EVIDENCE_MAX_BYTES) return response({ error: 'Record files must be 5 MB or smaller' }, 413);
  const head = new Uint8Array(bytes.slice(0, 16));
  const ascii = new TextDecoder().decode(head);
  const matchesType = contentType === 'application/pdf' ? ascii.startsWith('%PDF-')
    : contentType === 'application/json' ? (() => {
      try { JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes)); return true; }
      catch { return false; }
    })()
    : contentType === 'image/jpeg' ? head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff
    : contentType === 'image/png' ? [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => head[index] === byte)
    : contentType === 'image/webp' ? ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP'
    : contentType === 'image/heic' || contentType === 'image/heif' ? /^ftyp(?:heic|heif|heix|hevc|mif1)/.test(ascii.slice(4))
    : contentType === 'application/msword' || contentType === 'application/vnd.ms-excel'
      || contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      || contentType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      || contentType === 'application/vnd.oasis.opendocument.spreadsheet'
      || contentType === 'application/vnd.oasis.opendocument.text' ? officeDocumentSignatureMatches(contentType, bytes, head)
    : true;
  if (!matchesType) return response({ error: 'Record content does not match its declared file type' }, 415);
  const currentSources = await env.DB.prepare('SELECT * FROM curate_import_sources WHERE batch_id = ? AND account_id = ?')
    .bind(params.id, ctx.accountId).all<Record<string, unknown>>();
  const preflightLimit = sourceAdmissionLimit(currentSources.results, bytes.byteLength);
  if (preflightLimit) return response(preflightLimit, 413);
  const extensionByType: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif',
    'application/pdf': 'pdf', 'application/json': 'json', 'text/plain': 'txt', 'text/csv': 'csv', 'application/csv': 'csv',
    'application/msword': 'doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.oasis.opendocument.spreadsheet': 'ods', 'application/vnd.oasis.opendocument.text': 'odt',
  };
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(byte => byte.toString(16).padStart(2, '0')).join('');
  const key = `curate/${ctx.accountId}/${params.id}/${clientEvidenceId}-${digest}.${extensionByType[contentType]}`;
  const sourceId = crypto.randomUUID();
  const kind = contentType.startsWith('image/') ? 'photo' : contentType === 'application/pdf' ? 'invoice' : 'file';
  const metadata = { filename, content_type: contentType, size: bytes.byteLength, admission_size: bytes.byteLength, extraction_status: 'not_available', client_evidence_id: clientEvidenceId };
  await env.MEDIA_BUCKET.put(key, bytes, { httpMetadata: { contentType }, customMetadata: { account_id: ctx.accountId, batch_id: params.id, source_id: sourceId } });
  try {
    const inserted = await env.DB.prepare(
      `INSERT INTO curate_import_sources (id, batch_id, account_id, created_by_user_id, kind, pasted_text, r2_object_key, client_evidence_id, metadata_json, analysis_status)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
       WHERE (SELECT COUNT(*) FROM curate_import_sources WHERE batch_id = ? AND account_id = ?) < 50
         AND (SELECT COALESCE(SUM(CASE
           WHEN typeof(json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.admission_size')) IN ('integer', 'real')
             AND json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.admission_size') >= 0
             THEN json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.admission_size')
           ELSE (CASE WHEN pasted_text IS NOT NULL THEN length(CAST(pasted_text AS BLOB)) ELSE 0 END)
             + (CASE WHEN r2_object_key IS NOT NULL THEN ${IMPORT_SOURCE_MAX_BYTES} ELSE 0 END) END), 0)
           FROM curate_import_sources WHERE batch_id = ? AND account_id = ?) + ? <= ${IMPORT_SOURCE_TOTAL_MAX_BYTES}
         AND EXISTS (SELECT 1 FROM curate_import_batches WHERE id = ? AND account_id = ? AND review_state NOT IN ('completed', 'abandoned') AND finalize_idempotency_key IS NULL)`
    ).bind(sourceId, params.id, ctx.accountId, ctx.userId, kind, null, key, clientEvidenceId, JSON.stringify(metadata), 'pending', params.id, ctx.accountId, params.id, ctx.accountId, bytes.byteLength, params.id, ctx.accountId).run();
    if (!(inserted.meta.changes ?? 0)) {
      const winner = await env.DB.prepare('SELECT * FROM curate_import_sources WHERE batch_id = ? AND account_id = ? AND client_evidence_id = ?')
        .bind(params.id, ctx.accountId, clientEvidenceId).first<Record<string, unknown>>();
      if (winner?.r2_object_key === key) return response({ ...sourceRow(winner), already_uploaded: true });
      await env.MEDIA_BUCKET.delete(key);
      const latestBatch = await scopedBatch(env, params.id, ctx.accountId);
      if (latestBatch && !batchIsTerminal(latestBatch)) {
        const latestSources = await env.DB.prepare('SELECT * FROM curate_import_sources WHERE batch_id = ? AND account_id = ?').bind(params.id, ctx.accountId).all<Record<string, unknown>>();
        const limit = sourceAdmissionLimit(latestSources.results, bytes.byteLength);
        if (limit) return response(limit, 413);
      }
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
  if (!env.MEDIA_BUCKET) return response({ error: 'Record storage is not configured' }, 503);
  const source = await env.DB.prepare(
    'SELECT * FROM curate_import_sources WHERE id = ? AND batch_id = ? AND account_id = ?'
  ).bind(params.sourceId, params.id, ctx.accountId).first<Record<string, unknown>>();
  if (!source?.r2_object_key || typeof source.r2_object_key !== 'string' || !safeR2ObjectKey(source.r2_object_key, ctx.accountId, params.id)) {
    return response({ error: 'Record not found' }, 404);
  }
  const objectBody = await env.MEDIA_BUCKET.get(source.r2_object_key);
  if (!objectBody) return response({ error: 'Record not found' }, 404);
  const metadata = parseJson(source.metadata_json, {}) as Record<string, unknown>;
  const contentType = typeof metadata.content_type === 'string' && EVIDENCE_TYPES.has(metadata.content_type) ? metadata.content_type : 'application/octet-stream';
  const filename = typeof metadata.filename === 'string' ? metadata.filename : 'record';
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
    const requestedMetadataJson = jsonField(body.metadata, {});
    const idempotencyKey = text(body.idempotency_key, 200, true)!;
    const fingerprint = JSON.stringify({ batch_id: params.id, kind, pasted_text: pastedText, r2_object_key: objectKey, metadata: JSON.parse(requestedMetadataJson) });
    const replay = await env.DB.prepare('SELECT * FROM curate_import_sources WHERE account_id = ? AND client_idempotency_key = ?').bind(ctx.accountId, idempotencyKey).first<Record<string, unknown>>();
    if (replay) return replay.request_fingerprint === fingerprint
      ? response(sourceRow(replay))
      : response({ error: 'idempotency_key already used for a different source' }, 409);
    const pastedBytes = pastedText == null ? 0 : new TextEncoder().encode(pastedText).byteLength;
    let objectBytes = 0;
    if (objectKey != null) {
      let objectHead: R2Object | null = null;
      try { objectHead = env.MEDIA_BUCKET ? await env.MEDIA_BUCKET.head(objectKey) : null; } catch { /* use conservative bound */ }
      objectBytes = objectHead && Number.isFinite(objectHead.size) && objectHead.size >= 0 ? objectHead.size : IMPORT_SOURCE_MAX_BYTES;
    }
    const incomingBytes = pastedBytes + objectBytes;
    if (incomingBytes > IMPORT_SOURCE_MAX_BYTES) return response({ error: 'A source must total 5 MB or less.', code: 'source_too_large' }, 413);
    const metadataJson = JSON.stringify({ ...JSON.parse(requestedMetadataJson), size: incomingBytes, admission_size: incomingBytes });
    const currentSources = await env.DB.prepare('SELECT * FROM curate_import_sources WHERE batch_id = ? AND account_id = ?').bind(params.id, ctx.accountId).all<Record<string, unknown>>();
    const preflightLimit = sourceAdmissionLimit(currentSources.results, incomingBytes);
    if (preflightLimit) return response(preflightLimit, 413);
    let inserted: D1Result<unknown>;
    try {
      inserted = await env.DB.prepare(
        `INSERT INTO curate_import_sources (id, batch_id, account_id, created_by_user_id, kind, pasted_text, r2_object_key, metadata_json, client_idempotency_key, request_fingerprint)
         SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
         WHERE (SELECT COUNT(*) FROM curate_import_sources WHERE batch_id = ? AND account_id = ?) < 50
           AND (SELECT COALESCE(SUM(CASE
             WHEN typeof(json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.admission_size')) IN ('integer', 'real')
               AND json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.admission_size') >= 0
               THEN json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.admission_size')
             ELSE (CASE WHEN pasted_text IS NOT NULL THEN length(CAST(pasted_text AS BLOB)) ELSE 0 END)
               + (CASE WHEN r2_object_key IS NOT NULL THEN ${IMPORT_SOURCE_MAX_BYTES} ELSE 0 END) END), 0)
             FROM curate_import_sources WHERE batch_id = ? AND account_id = ?) + ? <= ${IMPORT_SOURCE_TOTAL_MAX_BYTES}
           AND EXISTS (SELECT 1 FROM curate_import_batches WHERE id = ? AND account_id = ? AND review_state NOT IN ('completed', 'abandoned') AND finalize_idempotency_key IS NULL)`
      ).bind(id, params.id, ctx.accountId, ctx.userId, kind, pastedText, objectKey, metadataJson, idempotencyKey, fingerprint, params.id, ctx.accountId, params.id, ctx.accountId, incomingBytes, params.id, ctx.accountId).run();
    } catch (error) {
      const raced = await env.DB.prepare('SELECT * FROM curate_import_sources WHERE account_id = ? AND client_idempotency_key = ?').bind(ctx.accountId, idempotencyKey).first<Record<string, unknown>>();
      if (raced) return raced.request_fingerprint === fingerprint
        ? response(sourceRow(raced))
        : response({ error: 'idempotency_key already used for a different source' }, 409);
      throw error;
    }
    if (!(inserted.meta.changes ?? 0)) {
      const latestBatch = await scopedBatch(env, params.id, ctx.accountId);
      if (latestBatch && !batchIsTerminal(latestBatch)) {
        const latestSources = await env.DB.prepare('SELECT * FROM curate_import_sources WHERE batch_id = ? AND account_id = ?').bind(params.id, ctx.accountId).all<Record<string, unknown>>();
        const limit = sourceAdmissionLimit(latestSources.results, incomingBytes);
        if (limit) return response(limit, 413);
      }
      return terminalResponse();
    }
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
  const parsedDataExplicitlySupplied = 'parsed_data' in body;
  const allowed = new Set(['source_id', 'position', 'category', 'name', 'raw_text', 'parsed_data', 'reviewed_fields', 'confidence', 'uncertainty', 'review_state']);
  if (Object.keys(body).some(key => !allowed.has(key))) return response({ error: 'Unknown update field' }, 400);
  const updates: string[] = [];
  const values: unknown[] = [];
  const explicitReviewedFields = new Set<string>();
  if (body.reviewed_fields != null) {
    if (!Array.isArray(body.reviewed_fields) || body.reviewed_fields.some(field => typeof field !== 'string' || !Object.values(MATERIAL_REVIEW_BLOCKERS).includes(field))) return response({ error: 'Invalid reviewed_fields' }, 400);
    for (const field of body.reviewed_fields) explicitReviewedFields.add(field as string);
  }
  const reviewedFieldsOnly = explicitReviewedFields.size > 0 && !parsedDataExplicitlySupplied;
  if (reviewedFieldsOnly) {
    const parsed = parseJson(current.parsed_data_json, {}) as Record<string, unknown>;
    const sourceFields = new Set(Object.entries(MATERIAL_REVIEW_BLOCKERS).filter(([, blocker]) => explicitReviewedFields.has(blocker)).map(([field]) => field));
    const blockingFields = Array.isArray(parsed.blockingFields) ? parsed.blockingFields.filter(field => !sourceFields.has(String(field)) && !explicitReviewedFields.has(String(field))) : [];
    body.parsed_data = { ...clearReviewedMaterialFields(parsed, explicitReviewedFields), blockingFields };
  }
  const manualFields = new Set((() => {
    const parsed = parseJson(current.manually_corrected_fields_json, []);
    return Array.isArray(parsed) ? parsed.filter(value => typeof value === 'string') as string[] : [];
  })());
  try {
    for (const [key, value] of Object.entries(body)) {
      if (key === 'reviewed_fields') continue;
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
        let normalizedInput = value;
        if (key === 'parsed_data') {
          const submittedValue = object(value);
          if (!submittedValue) return response({ error: 'Invalid update' }, 400);
          const submitted = { ...submittedValue };
          delete submitted.acquired;
          if (submitted.disposition != null && submitted.disposition !== 'received' && submitted.disposition !== 'in_transit' && submitted.disposition !== 'library_only') return response({ error: 'Invalid disposition' }, 400);
          if (submitted.inventoryPurpose != null && submitted.inventoryPurpose !== 'working' && submitted.inventoryPurpose !== 'sample' && submitted.inventoryPurpose !== 'personal') return response({ error: 'Invalid inventoryPurpose' }, 400);
          if (parsedDataExplicitlySupplied && 'priceAmount' in submitted && 'priceAmountExact' in submitted
            && canonicalReviewMoney(submitted.priceAmount) !== canonicalReviewMoney(submitted.priceAmountExact)) return response({ error: 'priceAmountExact must match priceAmount' }, 400);
          const before = parseJson(current.parsed_data_json, {}) as Record<string, unknown>;
          const reviewed = new Set(explicitReviewedFields);
          for (const blocker of new Set(Object.values(MATERIAL_REVIEW_BLOCKERS))) if (materialReviewChanged(blocker, before, submitted)) reviewed.add(blocker);
          const reviewedSourceFields = new Set(Object.entries(MATERIAL_REVIEW_BLOCKERS).filter(([, blocker]) => reviewed.has(blocker)).map(([field]) => field));
          const blockingFields = Array.isArray(submitted.blockingFields)
            ? submitted.blockingFields.filter(field => !reviewedSourceFields.has(String(field)) && !reviewed.has(String(field)))
            : [];
          normalizedInput = { ...clearReviewedMaterialFields(submitted, reviewed), blockingFields };
        }
        const storedValue = key === 'parsed_data' ? (reviewedFieldsOnly ? normalizedInput : canonicalStoredItem(normalizedInput as Record<string, unknown>)) : value;
        if (key === 'parsed_data' && !reviewedFieldsOnly) delete (storedValue as Record<string, unknown>).acquired;
        updates.push(`${key}_json = ?`); values.push(jsonField(storedValue, {}));
        if (key === 'parsed_data' && !reviewedFieldsOnly) {
          const before = parseJson(current.parsed_data_json, {}) as Record<string, unknown>;
          const after = storedValue as Record<string, unknown>;
          const derived = new Set(['totalQuantityGrams', 'totalUnits', 'priceAmountExact', 'lineCost', 'lineCostExact', 'unitCost', 'unitCostExact', 'blockingFields']);
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
  if (batch.analysis_state === 'complete' || typeof item.vendor_group_id === 'string') return response({ error: 'Analyzed inventory imports must be completed through Inventory finalization' }, 409);
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
  if (batch.analysis_state === 'complete' || typeof item.vendor_group_id === 'string') return response({ error: 'Analyzed inventory imports must be completed through Inventory finalization' }, 409);
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
