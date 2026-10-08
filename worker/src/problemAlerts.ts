/**
 * One Telegram message when a NEW (or returning) serious problem lands in the
 * problem ledger, so the owner hears about it without opening the site.
 *
 * Rules, all enforced here and pinned by worker/tests/problem-alerts.test.ts:
 *  - only a new row or a reopened one; a repeat of an open row is silent
 *  - only severity high or critical; visitor wifi drops are medium and noise
 *  - at most DAILY_ALERT_CAP per UTC day, counted in D1 (isolates differ); the
 *    last one of the day says alerts are paused
 *  - never throws and never logs the token: a failed alert must not fail the
 *    request or cron tick that triggered it
 */
import { describeIncident, type IncidentRow } from '../../src/lib/incidentWords';
import type { IncidentWrite } from './incidents';

export const DAILY_ALERT_CAP = 10;
export const FIXES_URL = 'https://www.teajia.com/account/fixes';

type AlertEnv = { DB: D1Database; TELEGRAM_BOT_TOKEN?: string; TELEGRAM_CHAT_ID?: string };
type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface AlertResult { sent: boolean; reason?: string }

function problemText(row: IncidentRow, reopened: boolean): string {
  const head = reopened ? 'Teajia: a problem came back.' : 'Teajia: something needs fixing.';
  const seen = row.first_seen ? `First seen ${row.first_seen} UTC.` : 'First seen just now.';
  return `${head}\n${describeIncident(row)}\n${seen}\n${FIXES_URL}`;
}

const PAUSED_TEXT = `Teajia: problem alerts are paused for today (too many). Check the page.\n${FIXES_URL}`;

/** Posts plain text to Telegram. Never throws; never logs the token. */
export async function sendProblemAlert(env: AlertEnv, text: string, fetchImpl: FetchLike = fetch): Promise<AlertResult> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return { sent: false, reason: 'not configured' };
  try {
    const res = await fetchImpl(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { sent: false, reason: `telegram answered ${res.status}` };
    return { sent: true };
  } catch {
    // The error text can carry the request URL, which holds the token.
    return { sent: false, reason: 'telegram unreachable' };
  }
}

/** Decides whether a ledger write deserves a message, and sends it. Never throws. */
export async function alertForProblem(env: AlertEnv, write: IncidentWrite, fetchImpl: FetchLike = fetch): Promise<AlertResult> {
  try {
    const { row, change } = write;
    if (!row || change === 'repeat') return { sent: false, reason: 'not new' };
    if (row.severity !== 'high' && row.severity !== 'critical') return { sent: false, reason: 'severity' };
    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return { sent: false, reason: 'not configured' };

    const counted = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM problem_alerts WHERE date(sent_at) = date('now')",
    ).first<{ n: number }>();
    const today = Number(counted?.n ?? 0);
    if (today >= DAILY_ALERT_CAP) return { sent: false, reason: 'daily cap' };

    const paused = today === DAILY_ALERT_CAP - 1;
    const text = paused ? PAUSED_TEXT : problemText(row as unknown as IncidentRow, change === 'reopened');
    const result = await sendProblemAlert(env, text, fetchImpl);
    await env.DB.prepare(
      'INSERT INTO problem_alerts (id, incident_id, signature, kind, ok) VALUES (?, ?, ?, ?, ?)',
    ).bind(crypto.randomUUID(), String(row.id ?? ''), String(row.signature ?? ''), paused ? 'paused' : change, result.sent ? 1 : 0).run();
    return result;
  } catch {
    return { sent: false, reason: 'error' };
  }
}
