import { classifyRequest } from './allowanceGuard.mjs';
import { recordHealthProblem } from './incidents';

/**
 * The agent door (/mcp, /mcp/public) and the shared database allowance.
 *
 * The shared guard (i64os/ops/quota-guard, vendored as allowanceGuard.mjs)
 * files /mcp as background work, so on a day when Adrian's sites together pass
 * the background line, every agent call is refused until midnight UTC while
 * the website keeps working. Teajia is run through agents (Adrian, 2026-11-27:
 * "it's supposed to be agent-based"), so here the agent door is interactive
 * work, as a person at the admin is. The shared file is left as it is; this is
 * Teajia's own classification passed through guardFetch's `classify` option.
 */
export function classifyTeajiaRequest(request: Request): { priority: string; feature: string } {
  const decided = classifyRequest(request);
  return decided.feature === 'agent' ? { priority: 'interactive', feature: 'agent' } : decided;
}

/** At most one ledger write an hour per isolate, so a refused agent cannot spend the allowance reporting itself. */
const REPORT_EVERY_MS = 60 * 60 * 1000;
let lastReportedAt = 0;

/**
 * A refused agent call is a site problem, not a silent 503: it goes to the
 * incident ledger (shown on /account/fixes) under one fixed signature, so a
 * paused agent door is seen instead of looking like a broken connector.
 */
export function noteAgentRefusal(request: Request, response: Response, db: D1Database | undefined, ctx?: { waitUntil?(p: Promise<unknown>): void }): Response {
  const path = new URL(request.url).pathname;
  if (response.status !== 503 || !/^\/mcp(?:\/|$)/.test(path) || !db) return response;
  const now = Date.now();
  if (now - lastReportedAt < REPORT_EVERY_MS) return response;
  lastReportedAt = now;
  const report = response.clone().json().catch(() => null).then((body: any) => {
    const reason = typeof body?.reason === 'string' ? body.reason : typeof body?.error?.message === 'string' ? body.error.message : 'unavailable';
    const retry = typeof body?.retry_at === 'string' ? ` until ${body.retry_at}` : '';
    return recordHealthProblem(db, {
      signature: 'agent-endpoint-refused',
      category: 'server',
      severity: 'high',
      route: path,
      method: request.method,
      httpStatus: 503,
      errorCode: String(body?.code ?? 'agent_unavailable'),
      message: `The agent door refused a call (${reason})${retry}. Agents cannot read or change the shop until it reopens.`,
    });
  }).catch(() => undefined);
  ctx?.waitUntil?.(report);
  return response;
}
