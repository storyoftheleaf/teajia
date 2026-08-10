export const PUBLISHER_ROLES = Object.freeze([
  'institute',
  'registry',
  'standards_body',
  'academic',
  'archive',
  'producer',
  'trade_association',
  'specialist_editorial',
  'retailer_reseller',
  'community',
]);

export const ENTITY_KINDS = Object.freeze([
  'tea_family',
  'named_tea',
  'tea_style',
  'cultivar',
  'germplasm_accession',
  'region',
  'major_region',
  'tea_area',
  'mountain',
  'village',
  'locality',
  'recognized_garden',
  'recognized_tree',
  'producer',
  'factory',
  'brand',
  'mark',
  'recipe',
  'glossary_term',
  'taxonomy_term',
  'exact_lot',
]);

export const CLAIM_SCOPES = Object.freeze([
  'identity',
  'geography',
  'historical',
  'legal',
  'cultivar_potential',
  'common_characteristics',
  'exact_lot',
  'processing',
  'storage',
  'brewing',
  'relationship',
]);

const ACCESS_POLICIES = new Set(['allowed', 'manual_only', 'blocked']);
const FETCH_TRANSPORTS = new Set(['primary', 'system']);
const ROLE_SET = new Set(PUBLISHER_ROLES);
const ENTITY_SET = new Set(ENTITY_KINDS);
const SCOPE_SET = new Set(CLAIM_SCOPES);

function requiredString(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required`);
  return value.trim();
}

function validateValues(values, allowed, label) {
  if (!Array.isArray(values) || values.length === 0) throw new Error(`${label} must contain at least one value`);
  const normalized = values.map((value) => requiredString(value, label));
  for (const value of normalized) {
    if (value === 'personal_tasting') throw new Error('Personal tasting cannot be extracted by Hermes');
    if (!allowed.has(value)) throw new Error(`Unknown ${label}: ${value}`);
  }
  return Object.freeze([...new Set(normalized)].sort());
}

function validateSource(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Source must be an object');
  const sourceId = requiredString(input.sourceId, 'Source ID');
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(sourceId)) throw new Error(`Source ID must be path-safe: ${sourceId}`);
  const urlText = requiredString(input.url, `URL for ${sourceId}`);
  let url;
  try {
    url = new URL(urlText);
  } catch {
    throw new Error(`Source URL must be HTTP(S): ${urlText}`);
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`Source URL must be HTTP(S): ${urlText}`);

  const publisherRole = requiredString(input.publisherRole, `Publisher role for ${sourceId}`);
  if (!ROLE_SET.has(publisherRole)) throw new Error(`Unknown publisher role: ${publisherRole}`);
  const accessPolicy = requiredString(input.accessPolicy, `Access policy for ${sourceId}`);
  if (!ACCESS_POLICIES.has(accessPolicy)) throw new Error(`Unknown access policy: ${accessPolicy}`);
  if (accessPolicy === 'blocked') throw new Error(`Blocked source cannot be included: ${sourceId}`);

  const rateLimitMs = Number(input.rateLimitMs);
  if (!Number.isFinite(rateLimitMs) || rateLimitMs < 0) throw new Error(`Rate limit for ${sourceId} must be a non-negative number`);

  const fetchTransport = typeof input.fetchTransport === 'string' ? input.fetchTransport.trim() : 'primary';
  if (!FETCH_TRANSPORTS.has(fetchTransport)) throw new Error(`Unknown fetch transport: ${fetchTransport}`);

  return Object.freeze({
    sourceId,
    url: url.toString(),
    publisher: requiredString(input.publisher, `Publisher for ${sourceId}`),
    publisherQualifications: typeof input.publisherQualifications === 'string' ? input.publisherQualifications.trim() : '',
    publisherRole,
    sourceFamily: requiredString(input.sourceFamily, `Source family for ${sourceId}`),
    language: requiredString(input.language, `Language for ${sourceId}`),
    accessPolicy,
    adapter: requiredString(input.adapter, `Adapter for ${sourceId}`),
    adapterVersion: requiredString(input.adapterVersion, `Adapter version for ${sourceId}`),
    fetchTransport,
    captureAuthor: typeof input.captureAuthor === 'string' ? input.captureAuthor.trim() : '',
    captureSubject: typeof input.captureSubject === 'string' ? input.captureSubject.trim() : '',
    permittedEntityKinds: validateValues(input.permittedEntityKinds, ENTITY_SET, 'entity kind'),
    permittedClaimScopes: validateValues(input.permittedClaimScopes, SCOPE_SET, 'claim scope'),
    rateLimitMs,
    accessNotes: typeof input.accessNotes === 'string' ? input.accessNotes.trim() : '',
    licence: typeof input.licence === 'string' ? input.licence.trim() : '',
    robotsDecision: typeof input.robotsDecision === 'string' ? input.robotsDecision.trim() : '',
  });
}

export function validateAllowlist(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Allowlist must be an object');
  if (input.schemaVersion !== 1) throw new Error('Allowlist schemaVersion must be 1');
  if (!Array.isArray(input.sources) || input.sources.length === 0) throw new Error('Allowlist must include at least one source');
  if (input.sources.length > 12) throw new Error('The pilot maximum is 12 sources');

  const sources = input.sources.map(validateSource);
  const seen = new Set();
  for (const source of sources) {
    if (seen.has(source.sourceId)) throw new Error(`Duplicate source ID: ${source.sourceId}`);
    seen.add(source.sourceId);
  }

  return Object.freeze({ schemaVersion: 1, sources: Object.freeze(sources) });
}
