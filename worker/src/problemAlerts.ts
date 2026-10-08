/**
 * What the site does when a serious problem lands in the problem ledger.
 *
 * The owner does not want a message per problem and does not want to fix
 * things himself (2026-10-08). So:
 *  - a NEW or REOPENED high|critical problem is handed to i64os, which has
 *    Claude Code fix, test and merge it (handoffToRepair);
 *  - the site sends no message to the owner itself: i64os sends the one morning
 *    message and asks for the one tap that merges a fix.
 *
 * The handoff never throws and never logs a secret: a failed handoff or
 * note must not fail the request or cron tick that triggered it. Pinned by
 * worker/tests/problem-alerts.test.ts.
 */
import { describeIncident, type IncidentRow } from '../../src/lib/incidentWords';
import type { IncidentWrite } from './incidents';

export const REPAIR_ENDPOINT = 'https://app.i64os.com/api/v1/repairs/incident';
export const REPAIR_SECRET_HEADER = 'x-i64os-repair-secret';

type HandoffEnv = { DB: D1Database; I64OS_REPAIR_SECRET?: string };
type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface AlertResult { sent: boolean; reason?: string }

async function recordAlert(db: D1Database, incidentId: string, signature: string, kind: string, ok: boolean): Promise<void> {
  await db.prepare(
    'INSERT INTO problem_alerts (id, incident_id, signature, kind, ok) VALUES (?, ?, ?, ?, ?)',
  ).bind(crypto.randomUUID(), incidentId, signature, kind, ok ? 1 : 0).run();
}

/** Hands a new or returning serious problem to i64os. Never throws. */
export async function handoffToRepair(env: HandoffEnv, write: IncidentWrite, fetchImpl: FetchLike = fetch): Promise<AlertResult> {
  try {
    const { row, change } = write;
    if (!row || change === 'repeat') return { sent: false, reason: 'not new' };
    if (row.severity !== 'high' && row.severity !== 'critical') return { sent: false, reason: 'severity' };
    if (!env.I64OS_REPAIR_SECRET) return { sent: false, reason: 'not configured' };

    const r = row as Record<string, unknown>;
    const body = {
      source: 'teajia',
      repo: 'storyoftheleaf/teajia',
      incident: {
        id: r.id, signature: r.signature, category: r.category, severity: r.severity,
        route: r.route ?? null, method: r.method ?? null, http_status: r.http_status ?? null,
        error_code: r.error_code, safe_message: r.safe_message,
        sentence: describeIncident(row as unknown as IncidentRow),
        first_seen: r.first_seen, last_seen: r.last_seen, occurrence_count: r.occurrence_count,
        change,
      },
    };
    let ok = false;
    let reason: string | undefined;
    try {
      const res = await fetchImpl(REPAIR_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', [REPAIR_SECRET_HEADER]: env.I64OS_REPAIR_SECRET },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5000),
      });
      ok = res.ok;
      if (!ok) reason = `i64os answered ${res.status}`;
    } catch {
      reason = 'i64os unreachable';
    }
    try {
      await recordAlert(env.DB, String(r.id ?? ''), String(r.signature ?? ''), 'handoff', ok);
    } catch { /* the record of handoffs is a record, not a requirement */ }
    return ok ? { sent: true } : { sent: false, reason };
  } catch {
    return { sent: false, reason: 'error' };
  }
}
