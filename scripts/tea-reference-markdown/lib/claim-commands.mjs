// Pure ledger commands behind claims-cli.mjs. Each returns a new, validated ledger.
import { claimIdFor, currentRevision, validateLedger } from './claim-ledger.mjs';

export function parseMarksCsv(csv) {
  const rows = [];
  for (const line of csv.split('\n').slice(1)) {
    if (!line.trim()) continue;
    const cells = [];
    let cell = '';
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      if (quoted) {
        if (character === '"' && line[index + 1] === '"') { cell += '"'; index += 1; }
        else if (character === '"') quoted = false;
        else cell += character;
      } else if (character === '"') quoted = true;
      else if (character === ',') { cells.push(cell); cell = ''; }
      else cell += character;
    }
    cells.push(cell);
    rows.push({ id: cells[0], description: cells[7] });
  }
  return new Map(rows.map(row => [row.id, row.description]));
}

function locate(sourcePages, claimId) {
  for (const page of sourcePages) {
    for (const section of page.sections) {
      if (claimIdFor(page.id, section.key) === claimId) return { page, section };
    }
  }
  return {};
}

function evidenceFor(provenance, claimId) {
  return provenance.sources
    .flatMap(source => source.evidence)
    .filter(evidence => evidence.uses.some(use => claimIdFor(use.page_id, use.section_key) === claimId))
    .map(evidence => evidence.evidence_id);
}

export function applyClaimCommand({ ledger, sourcePages, provenance, command, claimId, options = {}, today, legacyMarks }) {
  const reason = options.reason?.trim();
  const next = structuredClone(ledger);
  const entry = next.claims.find(candidate => candidate.claim_id === claimId);
  if (!entry) throw new Error(`${claimId} has no claims.json entry; add its metadata as a draft first`);
  const { page, section } = locate(sourcePages, claimId);
  const previous = currentRevision(entry);

  if (command === 'approve') {
    if (!section) throw new Error(`${claimId} has no Markdown section to approve`);
    if (!reason) throw new Error('approve needs --reason');
    const scope = options.scope?.trim() || previous?.scope;
    if (!scope) throw new Error('approve needs --scope for a claim with no earlier revision');
    if (entry.status === 'approved' && previous?.text === section.text && previous?.scope === scope) {
      throw new Error(`${claimId}: Markdown already equals the current revision; nothing to approve`);
    }
    const evidenceIds = options.evidence
      ? options.evidence.split(',').map(value => value.trim()).filter(Boolean)
      : evidenceFor(provenance, claimId);
    entry.revisions.push({
      rev: entry.revisions.length + 1,
      origin: 'approved',
      scope,
      text: section.text,
      approved_at: today,
      reason,
      evidence_ids: evidenceIds,
    });
    entry.status = 'approved';
    entry.current_rev = entry.revisions.length;
    entry.withdrawn = null;
  } else if (command === 'withdraw') {
    if (!reason) throw new Error('withdraw needs --reason');
    if (entry.status === 'withdrawn') throw new Error(`${claimId} is already withdrawn`);
    entry.status = 'withdrawn';
    entry.withdrawn = { at: today, reason };
    if (entry.current_rev === null && entry.revisions.length) entry.current_rev = entry.revisions.length;
    if (entry.current_rev === null) throw new Error(`${claimId} has no revision to withdraw; delete its draft section instead`);
  } else if (command === 'import-legacy') {
    const from = options.from ?? '';
    const match = from.match(/^marks:([a-z0-9-]+)$/);
    if (!match) throw new Error('import-legacy needs --from marks:<id>');
    if (page?.visibility !== 'draft') throw new Error('import-legacy is only allowed for a claim on a draft page');
    const text = legacyMarks?.get(match[1]);
    if (!text) throw new Error(`legacy ${from} was not found`);
    const scope = options.scope?.trim();
    if (!scope) throw new Error('import-legacy needs --scope');
    entry.revisions.push({
      rev: entry.revisions.length + 1,
      origin: 'legacy_import',
      legacy_ref: from,
      scope,
      text,
      approved_at: today,
      reason: reason || 'Imported from the legacy marks corpus',
      evidence_ids: [],
    });
    entry.status = 'approved';
    entry.current_rev = entry.revisions.length;
  } else {
    throw new Error(`Unknown command ${command}; use approve, withdraw or import-legacy`);
  }
  validateLedger(next, sourcePages, provenance);
  return next;
}
