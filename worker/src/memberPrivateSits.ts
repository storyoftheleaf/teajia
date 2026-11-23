interface PrivateSitEnv {
  DB: D1Database;
}

type Authenticate<E> = (request: Request, env: E) => Promise<{ userId: string } | { error: Response }>;

type PrivateSitRow = {
  id: string;
  owner_user_id: string;
  sit_date: string;
  title: string | null;
  description: string | null;
  tea_id: string | null;
  tea_name: string | null;
  note: string | null;
  invite_pending: number;
};

function privateJson(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' },
  });
}

function missingSit(): Response {
  return privateJson({ error: 'This private sit is unavailable.' }, 404);
}

async function readObject(request: Request): Promise<Record<string, unknown> | null> {
  const value: unknown = await request.json().catch(() => null);
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function optionalText(value: unknown, max: number): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.length > max) return undefined;
  return value.trim() || null;
}

function optionalDetails(body: Record<string, unknown>) {
  const title = optionalText(body.title, 120);
  const description = optionalText(body.description, 700);
  if (title === undefined || description === undefined) return null;
  return { title, description };
}

function dateOnly(value: unknown): string | null {
  if (value === undefined) return new Date().toISOString().slice(0, 10);
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value ? value : null;
}

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');

async function hashInvite(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return toHex(new Uint8Array(digest));
}

export function memberPrivateSitAccessPredicate(viewer: string) {
  return `(sit.owner_user_id = ${viewer} OR EXISTS (
    SELECT 1 FROM member_private_sit_invites AS membership
    WHERE membership.sit_id = sit.id AND membership.accepted_by_user_id = ${viewer}
  ))`;
}

const visibleSits = `
  WITH viewer(id) AS (VALUES (?1))
  SELECT sit.id, sit.owner_user_id, sit.sit_date, sit.title, sit.description, sit.tea_id, sit.tea_name, notes.note,
    CASE WHEN sit.owner_user_id = viewer.id THEN EXISTS (
      SELECT 1 FROM member_private_sit_invites AS invite
      WHERE invite.sit_id = sit.id AND invite.revoked_at IS NULL AND invite.accepted_by_user_id IS NULL
        AND invite.expires_at > unixepoch()
    ) ELSE 0 END AS invite_pending
  FROM member_private_sits AS sit
  CROSS JOIN viewer
  LEFT JOIN member_private_sit_notes AS notes ON notes.sit_id = sit.id AND notes.user_id = viewer.id
  WHERE ${memberPrivateSitAccessPredicate('viewer.id')}
`;

function asMemberSit(row: PrivateSitRow, userId: string) {
  return {
    id: row.id,
    date: row.sit_date,
    title: row.title,
    description: row.description,
    tea: row.tea_name ? { id: row.tea_id, name: row.tea_name } : null,
    note: row.note,
    role: row.owner_user_id === userId ? 'host' : 'guest',
    invitePending: Boolean(row.invite_pending),
  };
}

async function listSits(db: D1Database, userId: string): Promise<Response> {
  const { results } = await db.prepare(`${visibleSits} ORDER BY sit.sit_date DESC, sit.created_at DESC, sit.id DESC`)
    .bind(userId).all<PrivateSitRow>();
  return privateJson({ sits: results.map(row => asMemberSit(row, userId)) });
}

async function getSit(db: D1Database, userId: string, id: string) {
  return db.prepare(`${visibleSits} AND sit.id = ?2`).bind(userId, id).first<PrivateSitRow>();
}

async function createSit(request: Request, db: D1Database, userId: string): Promise<Response> {
  const body = await readObject(request);
  if (!body) return privateJson({ error: 'Enter valid sit details.' }, 400);
  const details = optionalDetails(body);
  const date = dateOnly(body.date);
  const requestId = body.requestId === undefined ? crypto.randomUUID() : optionalText(body.requestId, 64);
  const tea = body.tea;
  const snapshot = tea && typeof tea === 'object' && !Array.isArray(tea) ? tea as Record<string, unknown> : null;
  const teaId = optionalText(snapshot?.id, 180);
  const teaName = optionalText(snapshot?.name, 200);
  if (!details || !date || !requestId || (tea != null && (!teaName || teaId === undefined))) {
    return privateJson({ error: 'Enter valid sit details.' }, 400);
  }
  // The supplied name is a snapshot. The reference is opaque here, so a sit cannot look up private teas.
  await db.prepare(`
    INSERT INTO member_private_sits (id, owner_user_id, request_id, sit_date, title, description, tea_id, tea_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(owner_user_id, request_id) DO NOTHING
  `).bind(crypto.randomUUID(), userId, requestId, date, details.title, details.description, teaId, teaName).run();
  const row = await db.prepare('SELECT id FROM member_private_sits WHERE owner_user_id = ? AND request_id = ?')
    .bind(userId, requestId).first<{ id: string }>();
  return row ? privateJson({ id: row.id }, 201) : missingSit();
}

async function acceptInvite(request: Request, db: D1Database, userId: string): Promise<Response> {
  const body = await readObject(request);
  const token = body?.token;
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return missingSit();
  const hash = await hashInvite(token);
  const now = Math.floor(Date.now() / 1000);
  await db.prepare(`
    UPDATE member_private_sit_invites AS invite SET accepted_by_user_id = ?1
    WHERE invite.token_hash = ?2 AND invite.expires_at > ?3
      AND invite.accepted_by_user_id IS NULL AND invite.revoked_at IS NULL
      AND EXISTS (SELECT 1 FROM member_private_sits AS sit WHERE sit.id = invite.sit_id AND sit.owner_user_id <> ?1)
      AND NOT EXISTS (
        SELECT 1 FROM member_private_sit_invites AS membership
        WHERE membership.sit_id = invite.sit_id AND membership.accepted_by_user_id = ?1
      )
  `).bind(userId, hash, now).run();
  const joined = await db.prepare(`SELECT sit_id FROM member_private_sit_invites
    WHERE token_hash = ? AND accepted_by_user_id = ?`).bind(hash, userId).first<{ sit_id: string }>();
  return joined ? privateJson({ id: joined.sit_id }) : missingSit();
}

async function changeInvite(request: Request, db: D1Database, sitId: string): Promise<Response> {
  const now = Math.floor(Date.now() / 1000);
  const revoke = db.prepare(`UPDATE member_private_sit_invites SET revoked_at = ?
    WHERE sit_id = ? AND accepted_by_user_id IS NULL AND revoked_at IS NULL`).bind(now, sitId);
  if (request.method === 'DELETE') {
    await revoke.run();
    return privateJson({ revoked: true });
  }
  const token = toHex(crypto.getRandomValues(new Uint8Array(32)));
  const hash = await hashInvite(token);
  const expiresAt = now + 7 * 24 * 60 * 60;
  await db.batch([
    revoke,
    db.prepare('INSERT INTO member_private_sit_invites (token_hash, sit_id, expires_at) VALUES (?, ?, ?)')
      .bind(hash, sitId, expiresAt),
  ]);
  return privateJson({ token }, 201);
}

async function saveNote(request: Request, db: D1Database, userId: string, sitId: string): Promise<Response> {
  const body = await readObject(request);
  const note = optionalText(body?.note, 2000);
  if (!body || !('note' in body) || note === undefined) return privateJson({ error: 'Enter a valid note.' }, 400);
  if (note === null) {
    await db.prepare('DELETE FROM member_private_sit_notes WHERE sit_id = ? AND user_id = ?').bind(sitId, userId).run();
  } else {
    await db.prepare(`INSERT INTO member_private_sit_notes (sit_id, user_id, note) VALUES (?, ?, ?)
      ON CONFLICT(sit_id, user_id) DO UPDATE SET note = excluded.note`).bind(sitId, userId, note).run();
  }
  return privateJson({ note });
}

export function createMemberPrivateSitsHandler<E extends PrivateSitEnv>(authenticate: Authenticate<E>) {
  return async (request: Request, env: E, params: Record<string, string>): Promise<Response> => {
    const identity = await authenticate(request, env);
    if ('error' in identity) return identity.error;
    const { userId } = identity;
    if (userId === 'env-admin') return privateJson({ error: 'Sign in to your personal account.' }, 401);
    const { DB: db } = env;
    const path = new URL(request.url).pathname;
    const { id } = params;

    if (path.endsWith('/accept')) return acceptInvite(request, db, userId);
    if (!id) {
      return request.method === 'POST' ? createSit(request, db, userId) : listSits(db, userId);
    }
    const row = await getSit(db, userId, id);
    if (!row) return missingSit();
    if (request.method === 'GET') return privateJson(asMemberSit(row, userId));
    if (path.endsWith('/note')) return saveNote(request, db, userId, id);
    if (row.owner_user_id !== userId) return missingSit();
    if (path.endsWith('/invite')) return changeInvite(request, db, id);
    const body = await readObject(request);
    const details = body && optionalDetails(body);
    const teaName = optionalText(body?.teaName, 200);
    if (!details || teaName === undefined) return privateJson({ error: 'Enter valid sit details.' }, 400);
    const updated = await db.prepare(`
      UPDATE member_private_sits SET title = ?, description = ?, tea_name = COALESCE(tea_name, ?)
      WHERE id = ? AND owner_user_id = ?
      RETURNING tea_id, tea_name
    `).bind(details.title, details.description, teaName, id, userId)
      .first<{ tea_id: string | null; tea_name: string | null }>();
    if (!updated) return missingSit();
    return privateJson({ ...details, tea: updated.tea_name ? { id: updated.tea_id, name: updated.tea_name } : null });
  };
}
