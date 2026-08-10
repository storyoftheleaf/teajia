import fs from 'node:fs/promises';
import path from 'node:path';

import { extractJournalAbstract } from './adapters/journal-abstract.mjs';
import { extractMarshalnArticle } from './adapters/marshaln-article.mjs';
import { extractCtmaArticle } from './adapters/ctma-article.mjs';
import { extractMoaPrintArticle } from './adapters/moa-print-article.mjs';
import { extractSpecialistArticle } from './adapters/specialist-article.mjs';
import { extractTbrsCultivar } from './adapters/tbrs-cultivar.mjs';
import { extractVietnamGiArticle } from './adapters/vietnam-gi-article.mjs';
import { canonicalJson, sha256 } from './canonical.mjs';
import { classifyClaimRelationships } from './claim-relationships.mjs';
import { buildEntityResolutionPreview } from './entity-resolution.mjs';
import { validateAllowlist } from './schema.mjs';
import { buildWebsiteHandoff } from './website-handoff.mjs';

const ADAPTERS = Object.freeze({
  'ctma-article': extractCtmaArticle,
  'journal-abstract': extractJournalAbstract,
  'marshaln-article': extractMarshalnArticle,
  'moa-print-article': extractMoaPrintArticle,
  'specialist-article': extractSpecialistArticle,
  'tbrs-cultivar': extractTbrsCultivar,
  'vietnam-gi-article': extractVietnamGiArticle,
});

function sleep(milliseconds) {
  return milliseconds > 0 ? new Promise((resolve) => setTimeout(resolve, milliseconds)) : Promise.resolve();
}

function localDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('Capture clock returned an invalid date');
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function confined(root, ...segments) {
  const resolvedRoot = path.resolve(root);
  const target = path.resolve(resolvedRoot, ...segments);
  if (target !== resolvedRoot && !target.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`Capture output escaped its root: ${target}`);
  }
  return target;
}

async function prepareOutputRoot(outputRoot) {
  const root = path.resolve(outputRoot);
  await fs.mkdir(root, { recursive: true });
  const existing = await fs.readdir(root);
  if (existing.length > 0) throw new Error(`Capture output root must be empty: ${root}`);
  return root;
}

async function writeCanonical(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${canonicalJson(value)}\n`, 'utf8');
}

function validatePacket(packet, source) {
  if (!packet || typeof packet !== 'object') throw new Error(`Adapter returned no packet for ${source.sourceId}`);
  for (const evidence of packet.evidence ?? []) {
    if (evidence.sourceId !== source.sourceId) throw new Error(`Evidence source mismatch for ${source.sourceId}`);
    if (packet.normalizedText.slice(evidence.start, evidence.end) !== evidence.exact) {
      throw new Error(`Evidence containment failed for ${evidence.evidenceId}`);
    }
  }
  for (const claim of packet.claims ?? []) {
    if (claim.sourceId !== source.sourceId) throw new Error(`Claim source mismatch for ${source.sourceId}`);
    if (!(packet.evidence ?? []).some(({ evidenceId }) => evidenceId === claim.evidenceId)) {
      throw new Error(`Claim evidence was not captured for ${claim.claimId}`);
    }
  }
}

async function loadPreviousClaims(previousRun) {
  if (!previousRun) return [];
  const contents = await fs.readFile(path.resolve(previousRun, 'claims.json'), 'utf8');
  const claims = JSON.parse(contents);
  if (!Array.isArray(claims)) throw new Error('Previous claims.json must contain an array');
  return claims;
}

function createPreview(currentClaims, previousClaims) {
  const current = new Map(currentClaims.map((claim) => [claim.claimId, claim]));
  const previous = new Map(previousClaims.map((claim) => [claim.claimId, claim]));
  const preview = { added: 0, changed: 0, unchanged: 0, missing: 0 };
  for (const [claimId, claim] of current) {
    const before = previous.get(claimId);
    if (!before) preview.added += 1;
    else if (before.payloadSha256 === claim.payloadSha256) preview.unchanged += 1;
    else preview.changed += 1;
  }
  for (const claimId of previous.keys()) if (!current.has(claimId)) preview.missing += 1;
  return Object.freeze(preview);
}

function duplicateSnapshotGroups(packets) {
  const byHash = new Map();
  for (const packet of packets) {
    const hash = packet.retrieval.normalizedSha256;
    if (!byHash.has(hash)) byHash.set(hash, []);
    byHash.get(hash).push(packet.source.sourceId);
  }
  return [...byHash.entries()]
    .filter(([, sourceIds]) => sourceIds.length > 1)
    .map(([normalizedSha256, sourceIds]) => ({ normalizedSha256, sourceIds: [...sourceIds].sort() }))
    .sort((left, right) => left.normalizedSha256.localeCompare(right.normalizedSha256));
}

function errorRecord(source, error) {
  return Object.freeze({
    sourceId: source.sourceId,
    url: source.url,
    adapter: source.adapter,
    errorType: error?.name || 'Error',
    message: error?.message || String(error),
  });
}

export async function captureBatch({ allowlist, outputRoot, fetcher = globalThis.fetch, previousRun = null, now = () => new Date() }) {
  if (typeof fetcher !== 'function') throw new Error('Capture requires a fetch function');
  const contract = validateAllowlist(allowlist);
  const root = await prepareOutputRoot(outputRoot);
  const previousClaims = await loadPreviousClaims(previousRun);
  const accessedDate = localDate(now());
  const packets = [];
  const errors = [];

  for (let index = 0; index < contract.sources.length; index += 1) {
    const source = contract.sources[index];
    try {
      const adapter = ADAPTERS[source.adapter];
      if (!adapter) throw new Error(`Unknown capture adapter: ${source.adapter}`);
      const response = await fetcher(source.url, {
        headers: { accept: 'text/html,application/xhtml+xml' },
        redirect: 'follow',
        teajiaTransport: source.fetchTransport,
      });
      if (!response?.ok) throw new Error(`HTTP ${response?.status ?? 'unknown'} retrieving ${source.url}`);
      const original = Buffer.from(await response.arrayBuffer());
      const html = original.toString('utf8');
      const extracted = adapter({ source, html });
      validatePacket(extracted, source);
      const packet = Object.freeze({
        source,
        metadata: extracted.metadata,
        retrieval: Object.freeze({
          accessedDate,
          httpStatus: response.status,
          contentType: response.headers?.get?.('content-type') || '',
          originalSha256: sha256(original),
          normalizedSha256: sha256(extracted.normalizedText),
          adapter: source.adapter,
          adapterVersion: source.adapterVersion,
        }),
        normalizedText: extracted.normalizedText,
        evidence: extracted.evidence,
        claims: extracted.claims,
      });
      const sourceRoot = confined(root, 'sources', source.sourceId);
      await fs.mkdir(sourceRoot, { recursive: true });
      await fs.writeFile(confined(sourceRoot, 'original.html'), original);
      await fs.writeFile(confined(sourceRoot, 'normalized.txt'), `${extracted.normalizedText}\n`, 'utf8');
      await writeCanonical(confined(sourceRoot, 'packet.json'), packet);
      packets.push(packet);
    } catch (error) {
      errors.push(errorRecord(source, error));
    }
    if (index < contract.sources.length - 1) await sleep(source.rateLimitMs);
  }

  packets.sort((left, right) => left.source.sourceId.localeCompare(right.source.sourceId));
  errors.sort((left, right) => left.sourceId.localeCompare(right.sourceId));
  const evidence = packets.flatMap((packet) => packet.evidence).sort((left, right) => left.evidenceId.localeCompare(right.evidenceId));
  const claims = packets.flatMap((packet) => packet.claims).sort((left, right) => left.claimId.localeCompare(right.claimId));
  const relationships = classifyClaimRelationships(claims);
  const entityResolution = buildEntityResolutionPreview(claims);
  const duplicateSnapshots = duplicateSnapshotGroups(packets);
  const preview = createPreview(claims, previousClaims);
  const autoMergeCandidateCount = entityResolution.filter(({ autoMerge }) => autoMerge).length;
  const continualCaptureEligible = errors.length === 0
    && duplicateSnapshots.length === 0
    && autoMergeCandidateCount === 0
    && claims.length > 0
    && claims.every(({ status }) => status === 'held' || status === 'captured');
  const manifest = Object.freeze({
    schemaVersion: 1,
    captureMode: 'preview-only',
    complete: errors.length === 0,
    sourceCount: packets.length,
    requestedSourceCount: contract.sources.length,
    evidenceCount: evidence.length,
    claimCount: claims.length,
    heldClaimCount: claims.filter(({ status }) => status === 'held').length,
    relationshipGroupCount: relationships.length,
    supportingInformationRelationshipCount: relationships.filter(({ classification }) => classification === 'supporting_information').length,
    differentScopeRelationshipCount: relationships.filter(({ classification }) => classification === 'different_scope_or_method').length,
    genuineContradictionCount: relationships.filter(({ classification }) => classification === 'genuine_contradiction').length,
    entityResolutionCandidateCount: entityResolution.length,
    privateVerificationCandidateCount: entityResolution.filter(({ proposedAction }) => proposedAction === 'private_verification').length,
    autoMergeCandidateCount,
    duplicateSnapshotGroupCount: duplicateSnapshots.length,
    continualCaptureEligible,
    errorCount: errors.length,
    sourceSnapshotSha256: sha256(canonicalJson(packets.map(({ source, retrieval, metadata }) => ({ source, retrieval, metadata })))),
    claimsSha256: sha256(canonicalJson(claims)),
  });

  await writeCanonical(confined(root, 'manifest.json'), manifest);
  await writeCanonical(confined(root, 'sources.json'), packets.map(({ source, metadata, retrieval }) => ({ source, metadata, retrieval })));
  await writeCanonical(confined(root, 'evidence.json'), evidence);
  await writeCanonical(confined(root, 'claims.json'), claims);
  await writeCanonical(confined(root, 'relationships.json'), relationships);
  await writeCanonical(confined(root, 'entity-resolution.json'), entityResolution);
  await writeCanonical(confined(root, 'duplicate-snapshots.json'), duplicateSnapshots);
  await writeCanonical(confined(root, 'errors.json'), errors);
  await writeCanonical(confined(root, 'preview.json'), preview);
  const websiteHandoff = buildWebsiteHandoff({ manifest, sources: packets, claims, entityResolution });
  await writeCanonical(confined(root, 'website-handoff.json'), websiteHandoff);

  return Object.freeze({
    root,
    manifest,
    sources: Object.freeze(packets),
    evidence: Object.freeze(evidence),
    claims: Object.freeze(claims),
    relationships,
    entityResolution,
    websiteHandoff,
    errors: Object.freeze(errors),
    preview,
  });
}
