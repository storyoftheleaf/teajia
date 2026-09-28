// Tea Atlas: adding a source from the admin (docs/TEA_ATLAS.md, "Adding a
// source in the admin").
//
// The PDF is read and split in the browser; this is only the door it writes
// through. It follows the reader's rule for the shut door exactly: anyone who
// may not manage the library, readers with the tick included, gets the same
// plain 404 an unknown API route gets, decided before the bucket is touched.
//
//   GET /api/atlas-admin/can-manage        200 when this person may add sources
//   GET /api/atlas-admin/object/<key>      an index or added-source file, never cached
//   PUT /api/atlas-admin/object/<key>      write one file
//
// Writes stream straight into R2 without being parsed, so a request stays far
// under the Worker's 10 ms of CPU. Articles and pictures are write-once: a key
// that already exists answers 409 and is left alone, so this door can never
// overwrite a file of the Global Tea Hut package, or of an earlier source.

import { canReadTeaAtlas, type AtlasEnv } from './atlas';

/**
 * Who may add sources: the site owner. It is a second gate on top of reading,
 * so revoking the reading tick also shuts this. Fails closed.
 */
export async function canManageTeaAtlas(env: AtlasEnv, userId: string | null | undefined): Promise<boolean> {
  if (!userId || !(await canReadTeaAtlas(env, userId))) return false;
  try {
    const user = await env.DB.prepare('SELECT platform_role FROM users WHERE id = ?').bind(userId).first();
    return user?.platform_role === 'platform_owner';
  } catch {
    return false;
  }
}

const ID = '[A-Za-z0-9][A-Za-z0-9._-]{0,160}';

interface Shape {
  pattern: RegExp;
  type: string;
  /** Existing objects are never replaced. */
  writeOnce: boolean;
  /** Readable back through this door (the published files the merge needs). */
  readable: boolean;
}

const SHAPES: Shape[] = [
  { pattern: new RegExp(`^articles/${ID}\\.json$`), type: 'application/json', writeOnce: true, readable: false },
  { pattern: new RegExp(`^media/${ID}/${ID}\\.jpg$`), type: 'image/jpeg', writeOnce: true, readable: false },
  { pattern: /^index\/v1\/home\.json$/, type: 'application/json', writeOnce: false, readable: true },
  { pattern: new RegExp(`^index/v1/(sources|issues|topics)/${ID}\\.json$`), type: 'application/json', writeOnce: false, readable: true },
  { pattern: /^index\/v1\/search\/catalog\.json$/, type: 'application/json', writeOnce: false, readable: true },
  { pattern: /^index\/v1\/search\/text\/([a-z0-9_]{2}|u[0-9a-f]{2})\.json$/, type: 'application/json', writeOnce: false, readable: true },
  { pattern: /^added\/sources\.json$/, type: 'application/json', writeOnce: false, readable: true },
  { pattern: new RegExp(`^added/${ID}/manifest\\.json$`), type: 'application/json', writeOnce: false, readable: true },
];

export function atlasAdminShape(key: string): Shape | null {
  if (key.includes('..')) return null;
  return SHAPES.find(s => s.pattern.test(key)) ?? null;
}

/** The largest single file: a 1600 px picture is well under 1 MB; the catalogue grows slowly. */
const MAX_BYTES = 16 * 1024 * 1024;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

/**
 * Handle one `/api/atlas-admin/...` request, or `null` for the plain 404.
 * `userId` is the signed-in person (already verified by the caller), or null.
 */
export async function serveAtlasAdmin(
  request: Request,
  env: AtlasEnv,
  path: string,
  userId: string | null,
  audit?: (action: string, details: Record<string, unknown>) => Promise<void>,
): Promise<Response | null> {
  if (!(await canManageTeaAtlas(env, userId))) return null;
  if (path === 'can-manage' && request.method === 'GET') return json({ manage: true });
  if (!path.startsWith('object/') || !env.ATLAS_BUCKET) return null;

  let key = path.slice('object/'.length);
  try { key = decodeURIComponent(key); } catch { return null; }
  const shape = atlasAdminShape(key);
  if (!shape) return null;

  if (request.method === 'GET') {
    if (!shape.readable) return null;
    const obj = await env.ATLAS_BUCKET.get(key);
    if (!obj) return null;
    return new Response(obj.body, {
      headers: { 'Content-Type': shape.type, 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow, noarchive' },
    });
  }

  if (request.method === 'PUT') {
    const length = Number(request.headers.get('Content-Length') || 0);
    if (length > MAX_BYTES) return json({ error: 'Too large' }, 413);
    const body = await request.arrayBuffer();
    if (!body.byteLength) return json({ error: 'Empty' }, 400);
    if (body.byteLength > MAX_BYTES) return json({ error: 'Too large' }, 413);
    const options: R2PutOptions = { httpMetadata: { contentType: shape.type } };
    // Only one person can write here, one publish at a time, so looking first
    // is enough; nothing races it.
    if (shape.writeOnce && (await env.ATLAS_BUCKET.head(key))) return json({ error: 'Already there', key }, 409);
    await env.ATLAS_BUCKET.put(key, body, options);
    if (key === 'added/sources.json' && audit) await audit('atlas.source_added', { key, bytes: body.byteLength });
    return json({ ok: true, key });
  }
  return null;
}
