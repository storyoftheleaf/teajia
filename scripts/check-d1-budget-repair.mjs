import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';

// Same authenticated receiver as worker/src/problemAlerts.ts. This path never
// calls Teajia or stores incident state in the exhausted application database.
export const REPAIR_ENDPOINT = 'https://app.i64os.com/api/v1/repairs/incident';
export const REPAIR_SECRET_HEADER = 'x-i64os-repair-secret';
const STATES = new Set(['ok', 'warning', 'critical', 'unknown']);
const KINDS = ['quota', 'telemetry'];

export function emptyRepairState() { return { version: 1, episodes: {}, lastCheckedAt: null }; }

export function validateRepairState(state) {
  if (state?.version !== 1 || !state.episodes || typeof state.episodes !== 'object' || Array.isArray(state.episodes)) throw new Error('Repair state is invalid; refusing to lose deduplication history');
  for (const [kind, episode] of Object.entries(state.episodes)) {
    if (!KINDS.includes(kind) || !episode || typeof episode.active !== 'boolean' || !Number.isFinite(Date.parse(episode.firstSeen)) || !Number.isInteger(episode.count) || episode.count < 1 || !Array.isArray(episode.accepted) || episode.accepted.some(s => !['warning', 'critical', 'unknown'].includes(s))) {
      throw new Error('Repair state is invalid; refusing to lose deduplication history');
    }
  }
  return state;
}

export async function readRepairState(file) {
  try { return validateRepairState(JSON.parse(await readFile(file, 'utf8'))); }
  catch (error) {
    if (error?.code === 'ENOENT') return emptyRepairState();
    throw new Error('Repair state could not be read; refusing duplicate dispatch');
  }
}

export async function writeRepairState(file, state) {
  await mkdir(dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  await writeFile(temporary, `${JSON.stringify(validateRepairState(state), null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, file);
}

export function planRepair(report, previous, accountId, runUrl = null) {
  if (!STATES.has(report.status) || !Number.isFinite(Date.parse(report.checkedAt)) || !accountId) throw new Error('Repair evidence is invalid');
  const state = structuredClone(validateRepairState(previous));
  state.lastCheckedAt = report.checkedAt;
  // Unknown telemetry cannot prove quota recovery. A known reading clears
  // telemetry; only a below-warning reading clears the quota episode.
  for (const kind of KINDS) {
    const recovered = kind === 'telemetry' ? report.status !== 'unknown' : report.status === 'ok';
    if (recovered && state.episodes[kind]?.active) {
      state.episodes[kind].active = false;
      state.episodes[kind].recoveredAt = report.checkedAt;
    }
  }
  if (report.status === 'ok') return { state, incident: null, reason: 'healthy' };
  const kind = report.status === 'unknown' ? 'telemetry' : 'quota';
  let episode = state.episodes[kind];
  const reopened = Boolean(episode && !episode.active);
  if (!episode?.active) {
    episode = { active: true, firstSeen: report.checkedAt, count: 0, accepted: [], reopened };
    state.episodes[kind] = episode;
  }
  episode.count += 1;
  episode.lastSeen = report.checkedAt;
  episode.status = report.status;
  const deduplicated = episode.accepted.includes(report.status)
    || (report.status === 'warning' && episode.accepted.includes('critical'));
  if (deduplicated) return { state, incident: null, reason: 'already accepted for this episode' };

  // Stable across bounded retries and later runs after ambiguous delivery.
  // A real escalation has its own signature. Recovery rearms our handoff,
  // but MUST NOT bypass the receiver's seven-day per-signature safety gate.
  const hash = createHash('sha256').update(`${accountId}:${kind}:${report.status}`).digest('hex').slice(0, 32);
  const id = `d1_${hash}`;
  const metrics = report.status === 'unknown'
    ? 'Account-wide Cloudflare D1 usage cannot be measured. Inspect the budget workflow artifact for the sanitized telemetry failure.'
    : `Account-wide D1 daily usage: ${report.rowsRead} rows read of ${report.budgets.reads}; ${report.rowsWritten} rows written of ${report.budgets.writes}. UTC day ${report.utcDay}.`;
  const transition = episode.accepted.length ? 'escalated' : episode.reopened ? 'reopened' : 'new';
  const safeRunUrl = typeof runUrl === 'string' && /^https:\/\/github\.com\/storyoftheleaf\/teajia\/actions\/runs\/\d+$/.test(runUrl) ? runUrl : null;
  const change = JSON.stringify({ transition, externalMonitor: true, ledger: 'GitHub workflow artifact; this incident has no Teajia D1 ledger row', runUrl: safeRunUrl });
  return {
    state, kind,
    incident: {
      source: 'teajia', repo: 'storyoftheleaf/teajia',
      incident: {
        id, signature: `d1-budget:${kind}:${report.status}:${hash}`,
        category: 'infrastructure', severity: report.status === 'critical' ? 'critical' : report.status === 'warning' ? 'medium' : 'high',
        route: 'github-actions/d1-budget', method: 'MONITOR', http_status: null,
        error_code: report.status === 'unknown' ? 'd1_monitor_unavailable' : 'd1_budget_threshold',
        safe_message: metrics,
        sentence: report.status === 'unknown' ? 'The independent database usage monitor is unavailable.' : `The account-wide database budget is at ${report.status} level.`,
        first_seen: episode.firstSeen, last_seen: report.checkedAt, occurrence_count: episode.count, change,
      },
    },
  };
}

export async function deliverRepair(body, secret, { fetchImpl = fetch, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  if (!secret) return { status: 'failed', attempts: 0, reason: 'I64OS_REPAIR_SECRET is missing' };
  let reason = 'Repair receiver unreachable';
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    let retryable = true;
    try {
      const response = await fetchImpl(REPAIR_ENDPOINT, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'teajia-d1-budget/1.0', [REPAIR_SECRET_HEADER]: secret },
        body: JSON.stringify(body), signal: AbortSignal.timeout(5000), redirect: 'error',
      });
      if (response.status === 202) {
        const receipt = await response.json();
        if (receipt?.ok === true && receipt?.data?.accepted === true) return { status: 'accepted', attempts: attempt, incidentId: body.incident.id, signature: body.incident.signature };
        reason = 'Repair receiver did not confirm acceptance';
      } else {
        reason = `Repair receiver HTTP ${response.status}`;
        retryable = response.status === 429 || response.status >= 500;
      }
    } catch { reason = 'Repair receiver unreachable or invalid receipt'; }
    if (!retryable || attempt === 3) return { status: 'failed', attempts: attempt, reason };
    await sleep(attempt * 500);
  }
}

export async function stageBudgetRepair(report, { stateFile, accountId, runUrl } = {}) {
  const previous = await readRepairState(stateFile);
  const plan = planRepair(report, previous, accountId, runUrl);
  // Persist intent BEFORE sending. If the process exits or the response is
  // lost, the next run sends the same signature and the receiver deduplicates.
  await writeRepairState(stateFile, plan.state);
  return plan;
}

export async function handoffBudgetRepair(report, { stateFile, accountId, secret, runUrl, fetchImpl, sleep } = {}) {
  const plan = await stageBudgetRepair(report, { stateFile, accountId, runUrl });
  if (!secret) return { status: 'failed', attempts: 0, reason: 'I64OS_REPAIR_SECRET is missing' };
  if (!plan.incident) return { status: report.status === 'ok' ? 'not_needed' : 'deduplicated', reason: plan.reason };
  const result = await deliverRepair(plan.incident, secret, { fetchImpl, sleep });
  if (result.status === 'accepted') {
    plan.state.episodes[plan.kind].accepted.push(report.status);
    plan.state.episodes[plan.kind].lastReceipt = result;
    await writeRepairState(stateFile, plan.state);
  }
  return result;
}
