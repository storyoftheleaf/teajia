// Email about tea (Adrian, 2026-11-28; words in src/lib/emailConsent.ts).
//
// A person says once whether Teajia may email them about teas and tables, and
// host by host which hosts may. Every answer is kept with when it was given,
// where (sign-up or the account page) and the version of the words shown, in
// email_consent_log; the current answer sits on users and user_email_hosts.
//
// Emails about a person's own orders are not gated by any of this.
//
// Only the person changes their own answers. A host is offered once the person
// has sat at one of that host's tables.

import { EMAIL_CONSENT_WORDING_VERSION, emailConsentTickedFor } from '../../src/lib/emailConsent';

type EmailConsentEnv = { DB: D1Database };
type Handler<E> = (request: Request, env: E, params: Record<string, string>) => Promise<Response>;
type Deps<E> = {
  requireUser: (request: Request, env: E) => Promise<{ userId: string } | { error: Response }>;
};
export type EmailConsentSource = 'signup' | 'signup-google' | 'account';

function privateJson(value: unknown, status = 200) {
  const response = Response.json(value, { status });
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

function logStatement(db: D1Database, userId: string, hostUserId: string | null, consent: boolean, source: EmailConsentSource, at: string) {
  return db.prepare(
    `INSERT INTO email_consent_log (id, user_id, host_user_id, consent, source, wording_version, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(crypto.randomUUID(), userId, hostUserId, consent ? 1 : 0, source, EMAIL_CONSENT_WORDING_VERSION, at);
}

/** The statements that keep Teajia's answer for a person who is signing up. */
export function signupEmailConsentStatements(db: D1Database, userId: string, consent: boolean, source: EmailConsentSource) {
  const at = new Date().toISOString();
  return [
    db.prepare('UPDATE users SET email_updates_consent = ?, email_updates_consent_at = ? WHERE id = ?').bind(consent ? 1 : 0, at, userId),
    logStatement(db, userId, null, consent, source, at),
  ];
}

/** Everything kept about a person's email answers, for deleting their account. */
export function emailConsentErasureStatements(db: D1Database, userId: string) {
  return [
    db.prepare('DELETE FROM user_email_hosts WHERE user_id = ? OR host_user_id = ?').bind(userId, userId),
    db.prepare('DELETE FROM email_consent_log WHERE user_id = ? OR host_user_id = ?').bind(userId, userId),
  ];
}

/**
 * Whether a person has said yes to email about tea from Teajia, or, with a
 * host, from that host. Order emails never ask this.
 */
export async function mayEmailAboutTea(db: D1Database, userId: string, hostUserId?: string): Promise<boolean> {
  if (hostUserId) {
    const row = await db.prepare('SELECT allowed FROM user_email_hosts WHERE user_id = ? AND host_user_id = ?')
      .bind(userId, hostUserId).first<{ allowed: number }>();
    return row?.allowed === 1;
  }
  const row = await db.prepare('SELECT email_updates_consent FROM users WHERE id = ?').bind(userId).first<{ email_updates_consent: number | null }>();
  return row?.email_updates_consent === 1;
}

/** The hosts whose tables this person has sat at, each with their answer. */
async function hostsFor(db: D1Database, userId: string) {
  const { results } = await db.prepare(
    `SELECT h.id AS host_user_id, h.name, choice.allowed, choice.decided_at
       FROM (SELECT DISTINCT e.host_user_id
               FROM event_attendees a JOIN events e ON e.id = a.event_id
              WHERE a.user_id = ? AND a.status = 'confirmed'
                AND e.host_user_id IS NOT NULL AND e.host_user_id <> ?
             UNION
             SELECT host_user_id FROM user_email_hosts WHERE user_id = ?) sat
       JOIN users h ON h.id = sat.host_user_id
       LEFT JOIN user_email_hosts choice ON choice.user_id = ? AND choice.host_user_id = h.id
      ORDER BY lower(h.name), h.id`
  ).bind(userId, userId, userId, userId).all<{ host_user_id: string; name: string; allowed: number | null; decided_at: string | null }>();
  return (results || []).map(row => ({
    host_user_id: row.host_user_id,
    name: row.name || 'A host',
    allowed: row.allowed === 1,
    decided_at: row.decided_at,
  }));
}

async function satWith(db: D1Database, userId: string, hostUserId: string) {
  const row = await db.prepare(
    `SELECT 1 FROM event_attendees a JOIN events e ON e.id = a.event_id
      WHERE a.user_id = ? AND a.status = 'confirmed' AND e.host_user_id = ? AND e.host_user_id <> ? LIMIT 1`
  ).bind(userId, hostUserId, userId).first();
  return Boolean(row);
}

export async function readEmailConsent(db: D1Database, userId: string) {
  const row = await db.prepare('SELECT email_updates_consent, email_updates_consent_at FROM users WHERE id = ?')
    .bind(userId).first<{ email_updates_consent: number | null; email_updates_consent_at: string | null }>();
  return {
    teajia: { consent: row?.email_updates_consent === 1, decided_at: row?.email_updates_consent_at ?? null },
    hosts: await hostsFor(db, userId),
  };
}

function countryOf(request: Request): string | null {
  const cf = (request as Request & { cf?: { country?: unknown } }).cf;
  return typeof cf?.country === 'string' ? cf.country : null;
}

export function emailConsentRoutes<E extends EmailConsentEnv>(deps: Deps<E>): [string, string, Handler<E>][] {
  const readBoolean = async (request: Request, field: string) => {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    return typeof body?.[field] === 'boolean' ? body[field] as boolean : null;
  };

  // Whether the sign-up box opens ticked for this visitor.
  const signupDefault: Handler<E> = async request => privateJson({ ticked: emailConsentTickedFor(countryOf(request)) });

  const read: Handler<E> = async (request, env) => {
    const user = await deps.requireUser(request, env);
    if ('error' in user) return user.error;
    return privateJson(await readEmailConsent(env.DB, user.userId));
  };

  const setTeajia: Handler<E> = async (request, env) => {
    const user = await deps.requireUser(request, env);
    if ('error' in user) return user.error;
    const consent = await readBoolean(request, 'consent');
    if (consent === null) return privateJson({ error: 'Say consent: true or false.' }, 400);
    const at = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare('UPDATE users SET email_updates_consent = ?, email_updates_consent_at = ? WHERE id = ?').bind(consent ? 1 : 0, at, user.userId),
      logStatement(env.DB, user.userId, null, consent, 'account', at),
    ]);
    return privateJson(await readEmailConsent(env.DB, user.userId));
  };

  // The box from the sign-up page, after Google brought the person back. It
  // is kept only when the person has not answered yet: an answer already
  // given, on the account page or an earlier sign-up, stands.
  const finishSignup: Handler<E> = async (request, env) => {
    const user = await deps.requireUser(request, env);
    if ('error' in user) return user.error;
    const consent = await readBoolean(request, 'consent');
    if (consent === null) return privateJson({ error: 'Say consent: true or false.' }, 400);
    const at = new Date().toISOString();
    const [kept] = await env.DB.batch([
      env.DB.prepare('UPDATE users SET email_updates_consent = ?, email_updates_consent_at = ? WHERE id = ? AND email_updates_consent_at IS NULL')
        .bind(consent ? 1 : 0, at, user.userId),
    ]);
    if (kept.meta.changes) await logStatement(env.DB, user.userId, null, consent, 'signup-google', at).run();
    return privateJson(await readEmailConsent(env.DB, user.userId));
  };

  const setHost: Handler<E> = async (request, env, { hostUserId }) => {
    const user = await deps.requireUser(request, env);
    if ('error' in user) return user.error;
    const allowed = await readBoolean(request, 'allowed');
    if (allowed === null) return privateJson({ error: 'Say allowed: true or false.' }, 400);
    // Saying yes is for a host they have sat with; no is always theirs to say.
    if (allowed && !await satWith(env.DB, user.userId, hostUserId)) return privateJson({ error: 'Not found' }, 404);
    const at = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO user_email_hosts (user_id, host_user_id, allowed, decided_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (user_id, host_user_id) DO UPDATE SET allowed = excluded.allowed, decided_at = excluded.decided_at`
      ).bind(user.userId, hostUserId, allowed ? 1 : 0, at),
      logStatement(env.DB, user.userId, hostUserId, allowed, 'account', at),
    ]);
    return privateJson(await readEmailConsent(env.DB, user.userId));
  };

  return [
    ['GET', '/api/public/email-consent/default', signupDefault],
    ['GET', '/api/me/email-consent', read],
    ['PUT', '/api/me/email-consent', setTeajia],
    ['POST', '/api/me/email-consent/signup', finishSignup],
    ['PUT', '/api/me/email-consent/hosts/:hostUserId', setHost],
  ];
}
