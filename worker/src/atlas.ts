// Tea Atlas: the private reading library. Contract: docs/TEA_ATLAS.md.
//
// Two rules live here and nowhere else:
//
// 1. Who may read it (`canReadTeaAtlas`). The site owner, always; an active
//    member of the platform account whose membership carries the Tea Atlas
//    tick; nobody else. It is not a bundle, because every shop owner and
//    platform admin receives all bundles automatically and a licensed archive
//    must not follow them.
// 2. What the door looks like when it is shut. `serveAtlas` answers `null`
//    for anyone who may not read, for any path that is not a Tea Atlas shape,
//    and for a key the bucket does not hold. The caller turns `null` into the
//    same plain 404 an unknown API route gets, so a stranger cannot tell a real
//    article from a made-up one, or the library from nothing at all. The check
//    runs before the bucket is touched.

export interface AtlasEnv {
  DB: D1Database;
  ATLAS_BUCKET?: R2Bucket;
}

/** The tick, read from `account_members.permissions` (the JSON that holds `bundles`). */
export function hasTeaAtlasTick(permissionsJson: string | null | undefined): boolean {
  if (!permissionsJson) return false;
  try {
    return JSON.parse(permissionsJson)?.tea_atlas === true;
  } catch {
    return false;
  }
}

/** Set or clear the tick without touching anything else the permissions hold. */
export function withTeaAtlasTick(permissionsJson: string | null | undefined, granted: boolean): string {
  let existing: Record<string, unknown> = {};
  if (permissionsJson) {
    try {
      const parsed = JSON.parse(permissionsJson);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) existing = parsed;
    } catch { /* malformed: start clean, keep nothing we cannot read */ }
  }
  const next: Record<string, unknown> = { ...existing };
  if (granted) next.tea_atlas = true;
  else delete next.tea_atlas;
  return JSON.stringify(next);
}

/**
 * Whether this person may read the Tea Atlas. Fails closed: a database error
 * is a no, which the caller answers with the same 404 as everyone else.
 */
export async function canReadTeaAtlas(env: AtlasEnv, userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  try {
    const user = await env.DB.prepare('SELECT platform_role FROM users WHERE id = ?').bind(userId).first();
    if (!user) return false;
    if (user.platform_role === 'platform_owner') return true;
    const { results } = await env.DB.prepare(
      `SELECT am.permissions
       FROM account_members am
       JOIN accounts a ON a.id = am.account_id
       WHERE am.user_id = ? AND am.status = 'active'
         AND a.is_platform_owner = 1 AND a.status = 'active'`,
    ).bind(userId).all();
    return (results as Array<{ permissions: string | null }>).some(row => hasTeaAtlasTick(row.permissions));
  } catch {
    return false;
  }
}

const ID = '[A-Za-z0-9][A-Za-z0-9._-]{0,160}';
const SHAPES: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
  [/^home\.json$/, () => 'index/v1/home.json'],
  [new RegExp(`^(sources|issues|topics)/(${ID})\\.json$`), m => `index/v1/${m[1]}/${m[2]}.json`],
  [/^search\/catalog\.json$/, () => 'index/v1/search/catalog.json'],
  [/^search\/text\/([a-z0-9_]{2}|u[0-9a-f]{2})\.json$/, m => `index/v1/search/text/${m[1]}.json`],
  [new RegExp(`^articles/(${ID})\\.json$`), m => `articles/${m[1]}.json`],
  [new RegExp(`^media/(${ID})/(${ID})\\.jpe?g$`, 'i'), m => m[0]],
];

/** `/api/atlas/<path>` → bucket key, or null when the path is not a Tea Atlas shape. */
export function atlasKeyFor(path: string): string | null {
  if (path.includes('..')) return null;
  for (const [pattern, toKey] of SHAPES) {
    const m = path.match(pattern);
    if (m) return toKey(m);
  }
  return null;
}

/**
 * Serve one Tea Atlas object, or `null` for the plain 404. `userId` is the
 * signed-in person (already verified by the caller), or null when signed out.
 */
export async function serveAtlas(
  request: Request,
  env: AtlasEnv,
  path: string,
  userId: string | null,
): Promise<Response | null> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;
  if (!(await canReadTeaAtlas(env, userId))) return null;
  let decoded = path;
  try { decoded = decodeURIComponent(path); } catch { return null; }
  const key = atlasKeyFor(decoded);
  if (!key || !env.ATLAS_BUCKET) return null;

  const obj = await env.ATLAS_BUCKET.get(key, { onlyIf: request.headers });
  if (!obj) return null;

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('ETag', obj.httpEtag);
  // Private: a shared cache must never hold a licensed page for the next
  // visitor. Pictures never change under a name; indexes can on re-upload.
  headers.set('Cache-Control', key.startsWith('media/') ? 'private, max-age=604800' : 'private, max-age=300');
  headers.set('Vary', 'Authorization');
  headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  if (!('body' in obj) || !obj.body) return new Response(null, { status: 304, headers });
  return new Response(request.method === 'HEAD' ? null : obj.body, { headers });
}
