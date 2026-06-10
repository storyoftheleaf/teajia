#!/usr/bin/env node
/**
 * Walk-through findings → TODO.md
 *
 * The "walk with me" companion (BriefingPage + WalkthroughDock) logs a verdict
 * and note per step to D1 (feature_status, keyed by `${walkthroughId}#${index}`).
 * This script pulls every step flagged broken / needs-revision, or carrying a
 * note, and appends them as todo lines under the "### Feature guide (owner
 * walk-throughs)" section of TODO.md — so problems you flag while walking a flow
 * become real, trackable todos in the repo.
 *
 * The Cloudflare Worker can't write your local TODO.md (no filesystem), so this
 * runs locally: it reads remote D1 via wrangler, then edits TODO.md on disk.
 *
 * Usage:
 *   node scripts/intake-findings.mjs            # append new findings to TODO.md
 *   node scripts/intake-findings.mjs --dry      # print what would be added, write nothing
 *
 * Idempotent: a finding's stepId is recorded in an HTML comment on its todo
 * line, so re-running never duplicates an already-synced finding.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.dirname(__dirname);
const WORKER_DIR = path.join(PROJECT_ROOT, 'worker');
const TODO_PATH = path.join(PROJECT_ROOT, 'TODO.md');
const SECTION = '### Feature guide (owner walk-throughs)';
const DRY = process.argv.includes('--dry');

// Resolve a walk-through id + step text from its id, so the todo line reads in
// plain language instead of "wt:event#2". Kept in sync with BriefingPage's
// WALKTHROUGHS by title only — the step text comes straight from D1's note, and
// the walk id is shown as a tag, so this needs no per-step duplication here.
function tagFor(stepId) {
  const [walkId, idx] = stepId.split('#');
  return `${walkId.replace(/^wt:/, '')} step ${Number(idx) + 1}`;
}

function queryD1() {
  // --json returns [{ results: [...] }]; only flagged or noted rows matter.
  const sql =
    "SELECT feature_id, works, notes FROM feature_status " +
    "WHERE feature_id LIKE 'wt:%' AND (works IN ('broken','needs_revision') OR (notes IS NOT NULL AND trim(notes) != ''))";
  const out = execSync(
    `npx wrangler d1 execute teajia-db --remote --json --command=${JSON.stringify(sql)}`,
    { cwd: WORKER_DIR, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'inherit'] },
  );
  const parsed = JSON.parse(out);
  const block = Array.isArray(parsed) ? parsed[0] : parsed;
  return (block?.results ?? []).map((r) => ({
    stepId: r.feature_id,
    works: r.works,
    note: (r.notes ?? '').trim(),
  }));
}

function toTodoLine(f) {
  const severity = f.works === 'broken' ? 'broken' : 'looks off';
  const body = f.note || `Flagged ${severity} during walk-through`;
  // band: you-required (an owner-flagged problem needs the owner's judgment).
  return `- [ ] ${body} _(band: you-required)_ _(effort: quick)_ <!-- finding:${f.stepId} -->`;
}

function main() {
  if (!fs.existsSync(TODO_PATH)) {
    console.error(`TODO.md not found at ${TODO_PATH}`);
    process.exit(1);
  }

  let findings;
  try {
    findings = queryD1();
  } catch (e) {
    console.error('Failed to query D1. Are you logged into wrangler? (cd worker && npx wrangler whoami)');
    console.error(String(e.message || e).split('\n')[0]);
    process.exit(1);
  }

  if (findings.length === 0) {
    console.log('No flagged walk-through findings in D1. Nothing to sync.');
    return;
  }

  let md = fs.readFileSync(TODO_PATH, 'utf-8');

  // Skip findings already synced (their stepId appears in an existing comment).
  const fresh = findings.filter((f) => !md.includes(`finding:${f.stepId} `) && !md.includes(`finding:${f.stepId}-->`) && !md.includes(`finding:${f.stepId} -->`));
  if (fresh.length === 0) {
    console.log(`All ${findings.length} findings already in TODO.md. Nothing new.`);
    return;
  }

  const lines = fresh.map(toTodoLine);

  if (DRY) {
    console.log(`Would add ${fresh.length} finding(s) under "${SECTION}":\n`);
    console.log(lines.join('\n'));
    return;
  }

  // Insert under the existing section header; if absent, create it under ## Soon.
  const sectionIdx = md.indexOf(SECTION);
  if (sectionIdx !== -1) {
    const insertAt = md.indexOf('\n', sectionIdx) + 1;
    md = md.slice(0, insertAt) + lines.join('\n') + '\n' + md.slice(insertAt);
  } else {
    const soonIdx = md.indexOf('## Soon');
    const insertAt = soonIdx !== -1 ? md.indexOf('\n', soonIdx) + 1 : 0;
    const block = `\n${SECTION}\n${lines.join('\n')}\n`;
    md = md.slice(0, insertAt) + block + md.slice(insertAt);
  }

  fs.writeFileSync(TODO_PATH, md);
  console.log(`Added ${fresh.length} finding(s) to TODO.md under "${SECTION}":`);
  for (const f of fresh) console.log(`  • [${tagFor(f.stepId)}] ${f.note || f.works}`);
  console.log('\nReview them in TODO.md, then triage as usual.');
}

main();
