// Claim ledger: the approval record for Tea Wisdom claims.
// Contract: docs/_notes/tea-wisdom-claims.md

const HAN_SCRIPT = /\p{Script=Han}/u;
const CLAIM_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*$/;
const AXES = new Set(['named_tea_history', 'grade', 'place', 'type', 'process', 'maker_history', 'sensory_observation', 'terminology']);
const NEVER_LISTING = new Set(['maker_history', 'terminology', 'sensory_observation']);
const SOURCE_ROLES = new Set(['standard', 'producer', 'seller_own_batch', 'study', 'specialist_editorial', 'taster']);
const STATUSES = new Set(['draft', 'approved', 'withdrawn']);
const ORIGINS = new Set(['approved', 'legacy_import']);
const APPLIES_KEYS = new Set(['named_tea', 'type', 'grade', 'origin_includes', 'name_includes', 'name_any', 'process_in_name', 'form']);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const BASES = new Set(['sourced', 'trade_knowledge']);

export const basisOf = entry => entry.basis ?? 'sourced';

export const claimIdFor = (pageId, sectionKey) => `${pageId}:${sectionKey}`;

function fail(claimId, message) {
  throw new Error(`claims.json ${claimId}: ${message}`);
}

function assertPublicText(claimId, label, value) {
  if (typeof value !== 'string' || !value.trim()) fail(claimId, `${label} is required`);
  if (HAN_SCRIPT.test(value)) fail(claimId, `${label} must not contain Han script`);
}

function validateAppliesWhen(claimId, appliesWhen) {
  if (!appliesWhen || typeof appliesWhen !== 'object' || Array.isArray(appliesWhen)) fail(claimId, 'applies_when must be an object');
  for (const [key, value] of Object.entries(appliesWhen)) {
    if (!APPLIES_KEYS.has(key)) fail(claimId, `applies_when has unsupported key ${key}`);
    if (key === 'origin_includes' || key === 'name_includes' || key === 'name_any' || key === 'process_in_name') {
      if (!Array.isArray(value) || value.length === 0 || value.some(item => typeof item !== 'string' || !item.trim())) {
        fail(claimId, `applies_when.${key} must be a non-empty list of strings`);
      }
    } else if (typeof value !== 'string' || !value.trim()) {
      fail(claimId, `applies_when.${key} must be a non-empty string`);
    }
  }
  for (const key of ['name_includes', 'name_any']) {
    if (appliesWhen[key] && !appliesWhen.origin_includes) fail(claimId, `applies_when.${key} is only valid together with origin_includes`);
  }
  if (appliesWhen.process_in_name && !appliesWhen.type) fail(claimId, 'applies_when.process_in_name is only valid together with type');
  if (appliesWhen.process_in_name && appliesWhen.origin_includes) fail(claimId, 'applies_when.process_in_name names a way of making, so it is never combined with a place');
}

/**
 * Validate the ledger against the parsed pages and the private provenance document.
 * Returns a Map of claimId -> entry.
 */
export function validateLedger(ledger, sourcePages, provenance) {
  if (ledger?.schema_version !== 1 || !Array.isArray(ledger.claims)) {
    throw new Error('claims.json must have schema_version 1 and a claims array');
  }
  const sourceIds = new Set(provenance.sources.map(source => source.source_id));
  const evidenceUses = new Map();
  for (const source of provenance.sources) {
    for (const evidence of source.evidence) {
      evidenceUses.set(evidence.evidence_id, evidence.uses.map(use => claimIdFor(use.page_id, use.section_key)));
    }
  }
  const sections = new Map();
  for (const page of sourcePages) {
    for (const section of page.sections) sections.set(claimIdFor(page.id, section.key), { page, section });
  }

  const entries = new Map();
  for (const entry of ledger.claims) {
    const claimId = entry?.claim_id;
    if (!CLAIM_ID_PATTERN.test(claimId ?? '')) throw new Error(`claims.json has an invalid claim_id ${claimId}`);
    if (entries.has(claimId)) fail(claimId, 'duplicate claim');
    entries.set(claimId, entry);

    if (!AXES.has(entry.axis)) fail(claimId, `unsupported axis ${entry.axis}`);
    if (typeof entry.listing_eligible !== 'boolean') fail(claimId, 'listing_eligible must be a boolean');
    if (entry.listing_eligible && NEVER_LISTING.has(entry.axis)) fail(claimId, `axis ${entry.axis} is never listing-eligible`);
    validateAppliesWhen(claimId, entry.applies_when);

    if (!BASES.has(basisOf(entry))) fail(claimId, `unsupported basis ${entry.basis}`);
    const located = sections.get(claimId);
    if (entry.axis === 'named_tea_history' && (
      located?.page.kind !== 'named_tea' || entry.applies_when.named_tea !== located.page.id || basisOf(entry) !== 'sourced'
    )) fail(claimId, 'named tea history requires a sourced claim matched to its own named tea page');
    if (located && basisOf(entry) === 'sourced' && located.section.sourceIds.length === 0) {
      fail(claimId, 'a sourced claim needs at least one [cite:] marker in its section (or basis "trade_knowledge")');
    }
    if (entry.attribution != null && entry.axis !== 'sensory_observation') {
      fail(claimId, 'attribution is only for sensory_observation claims');
    }
    if (entry.attribution != null) {
      const attribution = entry.attribution;
      if (!sourceIds.has(attribution.source_id)) fail(claimId, `attribution source ${attribution.source_id} is missing`);
      if (!SOURCE_ROLES.has(attribution.source_role)) fail(claimId, `unsupported attribution source_role ${attribution.source_role}`);
      assertPublicText(claimId, 'attribution.sample', attribution.sample);
    }

    if (!Array.isArray(entry.terms)) fail(claimId, 'terms must be a list');
    for (const term of entry.terms) {
      if (!HAN_SCRIPT.test(term?.original ?? '')) fail(claimId, 'terms[].original must contain Han script');
      assertPublicText(claimId, 'terms[].pinyin', term.pinyin);
      assertPublicText(claimId, 'terms[].gloss', term.gloss);
    }

    if (!STATUSES.has(entry.status)) fail(claimId, `unsupported status ${entry.status}`);
    if (!Array.isArray(entry.revisions)) fail(claimId, 'revisions must be a list');
    entry.revisions.forEach((revision, index) => {
      if (revision.rev !== index + 1) fail(claimId, 'revisions must be numbered 1, 2, 3… in order');
      if (!ORIGINS.has(revision.origin)) fail(claimId, `rev ${revision.rev} has unsupported origin ${revision.origin}`);
      assertPublicText(claimId, `rev ${revision.rev} text`, revision.text);
      assertPublicText(claimId, `rev ${revision.rev} scope`, revision.scope);
      assertPublicText(claimId, `rev ${revision.rev} reason`, revision.reason);
      if (!DATE_PATTERN.test(revision.approved_at ?? '')) fail(claimId, `rev ${revision.rev} approved_at must be YYYY-MM-DD`);
      if (!Array.isArray(revision.evidence_ids)) fail(claimId, `rev ${revision.rev} evidence_ids must be a list`);
      if (revision.origin === 'legacy_import') {
        if (typeof revision.legacy_ref !== 'string' || !revision.legacy_ref) fail(claimId, `rev ${revision.rev} legacy_import needs legacy_ref`);
        if (located && located.page.visibility !== 'draft') fail(claimId, 'legacy_import revisions are only allowed on draft pages');
      } else if (revision.evidence_ids.length === 0 && basisOf(entry) === 'sourced') {
        fail(claimId, `rev ${revision.rev} needs evidence_ids`);
      }
      for (const evidenceId of revision.evidence_ids) {
        const uses = evidenceUses.get(evidenceId);
        if (!uses) fail(claimId, `rev ${revision.rev} evidence ${evidenceId} does not exist`);
        if (!uses.includes(claimId)) fail(claimId, `evidence ${evidenceId} uses do not list this claim`);
      }
    });

    if (entry.status === 'draft') {
      if (entry.current_rev !== null) fail(claimId, 'a draft claim has current_rev null');
    } else if (!Number.isInteger(entry.current_rev) || entry.current_rev < 1 || entry.current_rev > entry.revisions.length) {
      fail(claimId, 'current_rev must point at an existing revision');
    }
    if (entry.status === 'withdrawn') {
      if (!entry.withdrawn || !DATE_PATTERN.test(entry.withdrawn.at ?? '')) fail(claimId, 'withdrawn needs { at, reason }');
      assertPublicText(claimId, 'withdrawn.reason', entry.withdrawn.reason);
    } else if (entry.withdrawn != null) {
      fail(claimId, 'withdrawn is only set when status is withdrawn');
    }

    if (!sections.has(claimId) && entry.status !== 'withdrawn') fail(claimId, 'its Markdown section no longer exists');
  }
  for (const claimId of sections.keys()) {
    if (!entries.has(claimId)) throw new Error(`${claimId} has no claims.json entry`);
  }
  return entries;
}

export function currentRevision(entry) {
  return entry.current_rev ? entry.revisions[entry.current_rev - 1] : undefined;
}

export function reviewStateFor(entry, sectionText) {
  if (entry.status === 'withdrawn') return 'withdrawn';
  if (entry.status === 'draft') return 'draft';
  return currentRevision(entry).text === sectionText ? 'approved' : 'pending';
}

const camelRevision = revision => ({
  rev: revision.rev,
  origin: revision.origin,
  ...(revision.legacy_ref ? { legacyRef: revision.legacy_ref } : {}),
  scope: revision.scope,
  text: revision.text,
  approvedAt: revision.approved_at,
  reason: revision.reason,
  evidenceIds: revision.evidence_ids,
});

/** Project one claim. `preview` adds pending text, history and non-approved states. */
export function projectClaim(entry, page, section, { preview }) {
  const state = section ? reviewStateFor(entry, section.text) : 'withdrawn';
  const current = currentRevision(entry);
  const base = {
    claimId: entry.claim_id,
    pageId: page?.id ?? entry.claim_id.split(':')[0],
    sectionKey: entry.claim_id.split(':')[1],
    label: section?.label ?? '',
    axis: entry.axis,
    basis: basisOf(entry),
    listingEligible: entry.listing_eligible,
    appliesWhen: entry.applies_when,
    ...(entry.attribution ? { attribution: {
      sourceId: entry.attribution.source_id,
      sourceRole: entry.attribution.source_role,
      sample: entry.attribution.sample,
    } } : {}),
    terms: entry.terms,
    rev: current?.rev ?? null,
    scope: current?.scope ?? '',
    text: current?.text ?? section?.text ?? '',
    sourceIds: section?.sourceIds ?? [],
    reviewState: state,
  };
  if (!preview) return base;
  return {
    ...base,
    ...(state === 'pending' || state === 'draft' ? { pendingText: section.text } : {}),
    previousRevisions: entry.revisions.map(camelRevision),
    ...(entry.withdrawn ? { withdrawn: entry.withdrawn } : {}),
    ...(page ? { pageVisibility: page.visibility } : {}),
  };
}
