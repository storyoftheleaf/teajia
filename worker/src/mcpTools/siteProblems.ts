/**
 * Site problems for agents: the list on /account/fixes (`incident_ledger`) and
 * the step that marks one handled.
 *
 * The rule is "fix first, then mark resolved with resolution_ref" (CLAUDE.md,
 * Site problems go to the builder). Before 2026-11-27 an agent could follow
 * the first half and not the second: nothing on the connector read the ledger.
 * These run the same SELECT and UPDATE as GET and PATCH
 * /api/platform/incidents, for the platform owner only, because the ledger is
 * the whole platform's and not one shop's.
 */
import { incidentToApi, INCIDENT_STATUSES, type IncidentStatus } from '../incidents';
import type { ToolAuth, ToolDefinition, ToolEnv, ToolModule } from './registry';
import { consumeTicket, INVALID_TICKET, issueTicket, previewEnvelope, type TicketPayload } from './tickets';

interface ResolveTicket extends TicketPayload {
  kind: 'resolve_site_problem';
  incidentId: string;
  fromStatus: string;
  status: IncidentStatus;
  resolutionRef: string | null;
}

const platformOwner = (_env: ToolEnv, auth: ToolAuth) => auth.creatorTier === 'platform_owner';
const OPEN = ['open', 'acknowledged', 'repairing', 'observing'];

async function listSiteProblems(env: ToolEnv, _auth: ToolAuth, args: any) {
  const includeResolved = args?.include_resolved === true;
  const limit = Math.min(Math.max(Number(args?.limit) || 25, 1), 100);
  const { results } = await env.DB.prepare(
    `SELECT * FROM incident_ledger
      ${includeResolved ? '' : `WHERE status IN (${OPEN.map(() => '?').join(', ')})`}
      ORDER BY
        CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
        last_seen DESC
      LIMIT ?`,
  ).bind(...(includeResolved ? [] : OPEN), limit).all<Record<string, unknown>>();
  const problems = (results ?? []).map(incidentToApi);
  return { problems, count: problems.length, where: '/account/fixes' };
}

async function resolveSiteProblem(env: ToolEnv, auth: ToolAuth, args: any) {
  const confirm = typeof args?.confirm === 'string' ? args.confirm.trim() : '';
  if (confirm) {
    const t = await consumeTicket<ResolveTicket, 'resolve_site_problem'>(env, confirm, 'resolve_site_problem', auth);
    if (!t) return INVALID_TICKET;
    // Pinned to the status the preview read: if someone moved it since, nothing is written.
    const result = await env.DB.prepare(
      `UPDATE incident_ledger SET status = ?, resolution_ref = ?,
         resolved_at = CASE WHEN ? = 'resolved' THEN datetime('now') ELSE NULL END
       WHERE id = ? AND status = ?`,
    ).bind(t.status, t.resolutionRef, t.status, t.incidentId, t.fromStatus).run();
    if (!result.meta?.changes) return { error: 'problem_changed', message: 'The problem changed since the preview. Read it again with list_site_problems.' };
    const row = await env.DB.prepare('SELECT * FROM incident_ledger WHERE id = ?').bind(t.incidentId).first<Record<string, unknown>>();
    return { committed: true, problem: incidentToApi(row || {}) };
  }

  const incidentId = typeof args?.problem_id === 'string' ? args.problem_id.trim() : '';
  if (!incidentId) return { error: 'problem_id_required', message: 'problem_id is required. Find it with list_site_problems.' };
  const status = (typeof args?.status === 'string' ? args.status.trim() : 'resolved') as IncidentStatus;
  if (!INCIDENT_STATUSES.includes(status)) return { error: 'invalid_status', message: `status must be one of ${INCIDENT_STATUSES.join(', ')}.` };
  const resolutionRef = typeof args?.resolution_ref === 'string' ? args.resolution_ref.trim().slice(0, 240) || null : null;
  if (status === 'resolved' && !resolutionRef) {
    return { error: 'resolution_ref_required', message: 'A problem is marked resolved only with what fixed it: a PR, a commit or a short note.' };
  }
  const row = await env.DB.prepare('SELECT * FROM incident_ledger WHERE id = ?').bind(incidentId).first<Record<string, unknown>>();
  if (!row) return { error: 'not_found', message: 'No site problem has that id.' };
  const token = await issueTicket<ResolveTicket>(env, {
    kind: 'resolve_site_problem', accountId: auth.accountId, incidentId, fromStatus: String(row.status), status, resolutionRef,
  }, auth.tokenId);
  return previewEnvelope({
    action: 'resolve_site_problem',
    read_back: `Mark "${String(row.safe_message ?? row.error_code ?? incidentId)}" as ${status}${resolutionRef ? `, fixed by ${resolutionRef}` : ''}.`,
    problem: incidentToApi(row),
    from_status: row.status,
    to_status: status,
    resolution_ref: resolutionRef,
  }, token);
}

const defs: ToolDefinition[] = [
  {
    name: 'list_site_problems',
    scope: 'inventory:read',
    available: platformOwner,
    description: 'The site problems on /account/fixes: errors, failing checks and stale rates the site recorded, worst first. Open ones by default; include_resolved adds the handled ones. For the platform owner only. Fix the problem first, then mark it with resolve_site_problem.',
    inputSchema: {
      type: 'object',
      properties: {
        include_resolved: { type: 'boolean', description: 'Also list problems already resolved.' },
        limit: { type: 'number', description: 'Most to return (default 25, max 100).' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'resolve_site_problem',
    scope: 'admin:write',
    available: platformOwner,
    description: 'Mark a site problem resolved (or acknowledged, repairing, observing, or open again). Resolved needs resolution_ref: the PR, commit or note that fixed it. Two-step: preview, then confirm with the token after the owner agrees. For the platform owner only.',
    inputSchema: {
      type: 'object',
      properties: {
        problem_id: { type: 'string', description: 'From list_site_problems.' },
        status: { type: 'string', enum: [...INCIDENT_STATUSES], description: 'Default resolved.' },
        resolution_ref: { type: 'string', description: 'What fixed it, e.g. "PR 595". Required for resolved.' },
        confirm: { type: 'string', description: 'The confirmation_token from the preview.' },
      },
      additionalProperties: false,
    },
  },
];

export const siteProblemTools: ToolModule = {
  area: 'site-problems',
  defs,
  handlers: { list_site_problems: listSiteProblems, resolve_site_problem: resolveSiteProblem },
};
