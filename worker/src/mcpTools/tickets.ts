/**
 * The durable preview/confirm ticket, in one place.
 *
 * Four tool modules were written at once and each one independently
 * re-implemented this helper, because `mcp.ts` imports them and importing its
 * helpers back would be a cycle. All four reasoned correctly and all four
 * reasoned separately, so the shop ended up with four copies of one mechanism
 * that disagreed in three ways:
 *
 *   - Two put `kind` and `account_id` inside the UPDATE. Two checked them after
 *     the row came back, which marks a wrong-kind ticket consumed on its way to
 *     being rejected: a confused model hands an add_stock ticket to
 *     publish_collection and SPENDS a confirmation nobody ever saw the preview
 *     of. The guard belongs in the WHERE.
 *   - Three awaited the housekeeping reap inside a try. One left it floating on
 *     `.catch()`, which throws against the D1 shim the worker tests run on,
 *     because that shim returns a plain object from `run()`.
 *   - Three redefined `sha256Hex` that `inquiryDomain` already exports.
 *
 * That is the four-freight-rates shape with a different number in it: one fact,
 * several homes, free to drift, and here the drift is a security property
 * rather than a price. So the mechanism lives here, once, and every module
 * imports it. `mcp.ts` imports the TTL from here too, so the five copies of
 * "5 minutes" — one real and four comments promising to mirror it — are one.
 *
 * Why the row and not a Map: Cloudflare may route the preview call and the
 * confirm call to different isolates and may recycle either between them, so
 * an in-memory pending mutation is lost across both boundaries and surfaces as
 * a spurious expired-token error in the middle of a sentence Adrian is
 * speaking. Only the SHA-256 of the token is stored, so a leaked ticket row
 * cannot be replayed.
 */
import { sha256Hex } from '../inquiryDomain';
import type { ToolAuth, ToolEnv } from './registry';

/** How long a preview stays confirmable. The only definition. */
export const PENDING_TTL_MS = 5 * 60 * 1000;

/** What every module's mutation payload has to carry to be storable here. */
export interface TicketPayload {
  kind: string;
  accountId: string;
}

/** The single answer to every unusable ticket, so no caller invents its own. */
export const INVALID_TICKET = { error: 'invalid_or_expired_confirmation_token' } as const;

/** The envelope a preview returns. Shaped exactly like the built-in tools'. */
export function previewEnvelope(preview: Record<string, unknown>, token: string) {
  return { preview, confirmation_token: token, expires_in_seconds: PENDING_TTL_MS / 1000 };
}

/**
 * Store a pending mutation and return the token that commits it.
 *
 * The reap is awaited inside a try rather than left floating: an unawaited D1
 * write can be cancelled when the worker returns its response, so a
 * fire-and-forget reap is a lie, and a housekeeping line is never worth failing
 * a real preview over.
 */
export async function issueTicket<T extends TicketPayload>(
  env: ToolEnv, mutation: T, tokenId: string | null,
): Promise<string> {
  const now = Date.now();
  try {
    await env.DB.prepare('DELETE FROM mcp_confirmation_tickets WHERE expires_at < ?').bind(now).run();
  } catch { /* housekeeping only */ }

  const token = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO mcp_confirmation_tickets (token_hash, account_id, kind, payload_json, expires_at, token_id)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(
    await sha256Hex(token), mutation.accountId, mutation.kind,
    JSON.stringify(mutation), now + PENDING_TTL_MS, tokenId,
  ).run();
  return token;
}

/**
 * Claim a pending mutation, once.
 *
 * Single-use is the atomicity of the one statement: `consumed_at IS NULL` sits
 * in the WHERE and the write sits in the SET, so of two concurrent confirms
 * exactly one comes back with a row and the loser sees what an expired ticket
 * looks like.
 *
 * `kind` and `account_id` are in the WHERE, not checked afterwards, because
 * consuming is destructive and this table holds every tool's tickets.
 */
export async function consumeTicket<T extends TicketPayload, K extends T['kind']>(
  env: ToolEnv, token: string, kind: K, auth: ToolAuth,
): Promise<Extract<T, { kind: K }> | null> {
  const now = Date.now();
  const row = await env.DB.prepare(
    `UPDATE mcp_confirmation_tickets SET consumed_at = ?
       WHERE token_hash = ? AND kind = ? AND account_id = ?
         AND consumed_at IS NULL AND expires_at > ?
     RETURNING payload_json, token_id`
  ).bind(now, await sha256Hex(token), kind, auth.accountId, now)
    .first<{ payload_json: string; token_id: string | null }>();
  if (!row) return null;
  /* The ticket belongs to the token that asked for it, so a sibling token in
     the same shop cannot commit a mutation it never previewed. A NULL token_id
     is tolerated only because mcp.ts tolerates it for tickets that predate the
     column; nothing issued here ever writes one. */
  if (row.token_id != null && row.token_id !== auth.tokenId) return null;
  let payload: T;
  try { payload = JSON.parse(row.payload_json) as T; } catch { return null; }
  /* Re-read both from the payload rather than trusting the row we matched on:
     the row says what was indexed, the payload says what will be executed. */
  if (payload.kind !== kind) return null;
  if (payload.accountId !== auth.accountId) return null;
  return payload as Extract<T, { kind: K }>;
}
