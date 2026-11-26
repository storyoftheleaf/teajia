/**
 * A host's own agent token (Launch 5, M6 part two;
 * todo/plans/guests-and-tea-masters-launch-5-run.md, hard question 2).
 *
 * A host connects their own assistant to their own tables, guests, teas,
 * notes and chest. The key is an ordinary row of mcp_tokens with exactly one
 * scope, `host:self`, on the host's own personal account. What that scope may
 * call is HOST_SELF_TOOLS in mcp.ts, and nothing else is listed or callable.
 *
 * The rules, each held here and nowhere else:
 * - Two switches stand together: HOST_TOKENS_OPEN and Launch 2's
 *   FEW_HOSTS_OPEN (src/lib/hostTokens.ts). Closed, every route answers 404
 *   and no host key works on /mcp, whatever it was minted under.
 * - Only a person who may host now mints. A stopped host (users.
 *   hosting_stopped_at) mints nothing, and every key of theirs stops working
 *   at once, because /mcp reads their standing on every request. A stopped
 *   host may still see and disconnect their keys.
 * - The key lives on the host's own personal account, and /mcp refuses it on
 *   any other account. The secret is shown once; only its SHA-256 is kept,
 *   as for every other MCP token.
 * - A host sees and disconnects only their own host keys. A shop token on the
 *   same account is never listed here and never revoked from here.
 */
import { anyoneMayHost, hostDoorsFor, hostStanding } from './hostApproval';
import { sha256Hex } from './inquiryDomain';
import {
  HOST_SELF_SCOPE, HOST_TOKEN_LABEL_MAX, hostTokensOpen,
  type HostToken, type HostTokenList, type HostTokenMinted,
} from '../../src/lib/hostTokens';

export type HostTokensEnv = {
  DB: D1Database; HOST_TOKENS_OPEN?: string; FEW_HOSTS_OPEN?: string; ANYONE_HOSTS_OPEN?: string;
};

/** The stored scopes of a host key, exactly. A row is a host key when its scopes are this string. */
export const HOST_SELF_SCOPES_JSON = JSON.stringify([HOST_SELF_SCOPE]);

/** How many live keys one host may hold at once. Never shown as a number. */
export const HOST_TOKENS_MAX = 10;

/** A host key lasts a year, like every other MCP token. */
const HOST_TOKEN_LIFETIME_SECONDS = 365 * 24 * 3600;

const PERSONAL_ACCOUNT_SQL = `SELECT a.id FROM accounts a
  JOIN account_members m ON m.account_id = a.id AND m.user_id = a.personal_inventory_user_id
    AND m.role = 'owner' AND m.status = 'active'
  WHERE a.personal_inventory_user_id = ? AND a.owner_user_id = a.personal_inventory_user_id AND a.status = 'active'`;

async function personalAccountId(db: D1Database, userId: string): Promise<string | null> {
  const row = await db.prepare(PERSONAL_ACCOUNT_SQL).bind(userId).first<{ id: string }>();
  return row?.id ?? null;
}

/** Whether this person may host right now: approved, or anyone may host, and not stopped. */
async function mayHostNow(env: HostTokensEnv, userId: string) {
  const standing = await hostStanding(env.DB, userId);
  return { may: Boolean(hostDoorsFor(standing, anyoneMayHost(env))), stopped: standing.stopped };
}

/**
 * Whether a host key may act right now, read on every /mcp request: both
 * switches open, the key's account is the person's own active personal
 * account, and they may host now (a stopped host's keys refuse at once).
 */
export async function hostTokenMayAct(env: HostTokensEnv, userId: string, accountId: string): Promise<boolean> {
  if (!hostTokensOpen(env) || !userId || !accountId) return false;
  if (await personalAccountId(env.DB, userId) !== accountId) return false;
  return (await mayHostNow(env, userId)).may;
}

// ── Routes ──────────────────────────────────────────────────────────────────

type Handler<E> = (request: Request, env: E, params: Record<string, string>) => Promise<Response>;

export interface HostTokensDeps<E> {
  requireAuthenticatedUser(request: Request, env: E): Promise<{ userId: string; email: string; name: string } | { error: Response }>;
  /** The person's own personal account, made on demand (ensurePersonalInventoryAccount in index.ts). */
  ensurePersonalAccount(env: E, userId: string, name: string | undefined): Promise<{ id: string } | null>;
}

function answer(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
  });
}
const refuse = (status: number, code: string, error: string) => answer({ error, code }, status);
const notFound = () => refuse(404, 'not_found', 'Not found');

function mcpUrlOf(request: Request): string {
  return `${new URL(request.url).origin}/mcp`;
}

const TOKEN_COLUMNS = 'id, label, token_prefix AS prefix, created_at, last_used_at';
const LIVE_HOST_TOKEN_SQL = `user_id = ? AND account_id = ? AND scopes = ? AND revoked_at IS NULL
  AND (expires_at IS NULL OR expires_at >= ?)`;

async function liveHostTokens(db: D1Database, userId: string, accountId: string): Promise<HostToken[]> {
  const { results } = await db.prepare(
    `SELECT ${TOKEN_COLUMNS} FROM mcp_tokens WHERE ${LIVE_HOST_TOKEN_SQL} ORDER BY created_at DESC, id DESC`,
  ).bind(userId, accountId, HOST_SELF_SCOPES_JSON, Math.floor(Date.now() / 1000)).all<HostToken>();
  return results;
}

/** A label as the host gave it, or a refusal. */
export function readHostTokenLabel(body: Record<string, unknown> | null): { label: string } | { refused: string } {
  const label = typeof body?.label === 'string' ? body.label.trim().replace(/\s+/g, ' ') : '';
  if (!label) return { refused: 'Give it a name, so you know which assistant it is.' };
  if (label.length > HOST_TOKEN_LABEL_MAX) return { refused: `Keep the name under ${HOST_TOKEN_LABEL_MAX} characters.` };
  return { label };
}

/**
 * GET    /api/me/assistant-tokens          the host's live keys, never a secret
 * POST   /api/me/assistant-tokens {label}  make one; the secret is in this answer only
 * DELETE /api/me/assistant-tokens/:id      disconnect one of the host's own keys
 */
export function hostTokensRoutes<E extends HostTokensEnv>(deps: HostTokensDeps<E>): [string, string, Handler<E>][] {
  /**
   * The signed-in person, when keys are open and they may host, were stopped
   * after hosting, or still hold a live key of their own from when they could
   * (Teajia withdrew their approval). Whoever holds a key may always see and
   * disconnect it; only a person who may host now makes a new one.
   */
  const hostFor = async (request: Request, env: E) => {
    if (!hostTokensOpen(env)) return { error: notFound() };
    const person = await deps.requireAuthenticatedUser(request, env);
    if ('error' in person) return person;
    const standing = await mayHostNow(env, person.userId);
    if (!standing.may && !standing.stopped) {
      const accountId = await personalAccountId(env.DB, person.userId);
      const holds = accountId ? (await liveHostTokens(env.DB, person.userId, accountId)).length > 0 : false;
      if (!holds) return { error: notFound() };
    }
    return { ...person, ...standing };
  };

  const list: Handler<E> = async (request, env) => {
    const host = await hostFor(request, env);
    if ('error' in host) return host.error;
    const accountId = await personalAccountId(env.DB, host.userId);
    const tokens = accountId ? await liveHostTokens(env.DB, host.userId, accountId) : [];
    const body: HostTokenList = { tokens, may_connect: host.may, mcp_url: mcpUrlOf(request) };
    return answer(body);
  };

  const mint: Handler<E> = async (request, env) => {
    const host = await hostFor(request, env);
    if ('error' in host) return host.error;
    if (!host.may && !host.stopped) return notFound();
    if (!host.may) return refuse(403, 'hosting_stopped', 'New keys are paused on your account. Write to Teajia to talk it over.');
    const input = readHostTokenLabel(await request.json().catch(() => null) as Record<string, unknown> | null);
    if ('refused' in input) return refuse(400, 'label', input.refused);
    const account = await deps.ensurePersonalAccount(env, host.userId, host.name);
    if (!account) return refuse(409, 'account_unavailable', 'Your account is unavailable.');
    if ((await liveHostTokens(env.DB, host.userId, account.id)).length >= HOST_TOKENS_MAX) {
      return refuse(409, 'too_many_keys', 'Disconnect an assistant you no longer use, then make a new key.');
    }

    // 32 random bytes, the same shape as every other MCP token.
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const secret = `tjmcp_${btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
    const id = crypto.randomUUID();
    const prefix = secret.slice(0, 14);
    const expiresAt = Math.floor(Date.now() / 1000) + HOST_TOKEN_LIFETIME_SECONDS;
    // The limit is held in the write itself, so two keys made at once cannot pass it together.
    const nowSeconds = Math.floor(Date.now() / 1000);
    const inserted = await env.DB.prepare(
      `INSERT INTO mcp_tokens (id, account_id, user_id, user_email, label, token_hash, token_prefix, scopes, creator_tier, expires_at)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'account_owner', ?9
        WHERE (SELECT COUNT(*) FROM mcp_tokens WHERE user_id = ?3 AND account_id = ?2 AND scopes = ?8 AND revoked_at IS NULL
                 AND (expires_at IS NULL OR expires_at >= ?10)) < ?11`,
    ).bind(id, account.id, host.userId, host.email, input.label, await sha256Hex(secret), prefix, HOST_SELF_SCOPES_JSON,
      expiresAt, nowSeconds, HOST_TOKENS_MAX).run();
    if (!Number(inserted.meta?.changes || 0)) {
      return refuse(409, 'too_many_keys', 'Disconnect an assistant you no longer use, then make a new key.');
    }
    await env.DB.prepare(
      `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
       VALUES (?, 'MCP_TOKEN_MINTED', ?, ?, 'mcp_token', ?, ?)`,
    ).bind(crypto.randomUUID(), `Host assistant key made: ${input.label}`, host.email, id, account.id).run();

    const row = await env.DB.prepare(`SELECT ${TOKEN_COLUMNS} FROM mcp_tokens WHERE id = ?`).bind(id).first<HostToken>();
    const body: HostTokenMinted = {
      id, label: input.label, prefix, created_at: row?.created_at ?? new Date().toISOString(), last_used_at: null,
      token: secret, mcp_url: mcpUrlOf(request),
    };
    return answer(body, 201);
  };

  const revoke: Handler<E> = async (request, env, params) => {
    const host = await hostFor(request, env);
    if ('error' in host) return host.error;
    const accountId = await personalAccountId(env.DB, host.userId);
    if (!accountId) return refuse(404, 'key_not_found', 'Key not found');
    const result = await env.DB.prepare(
      `UPDATE mcp_tokens SET revoked_at = datetime('now')
        WHERE id = ? AND user_id = ? AND account_id = ? AND scopes = ? AND revoked_at IS NULL`,
    ).bind(params.id, host.userId, accountId, HOST_SELF_SCOPES_JSON).run();
    if (!result.meta?.changes) return refuse(404, 'key_not_found', 'Key not found');
    await env.DB.prepare(
      `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
       VALUES (?, 'MCP_TOKEN_REVOKED', ?, ?, 'mcp_token', ?, ?)`,
    ).bind(crypto.randomUUID(), `Host assistant key disconnected: ${params.id}`, host.email, params.id, accountId).run();
    return answer({ ok: true });
  };

  return [
    ['GET', '/api/me/assistant-tokens', list],
    ['POST', '/api/me/assistant-tokens', mint],
    ['DELETE', '/api/me/assistant-tokens/:id', revoke],
  ];
}
