import { casualSitLimits, type CasualSitPublicationStatus, type CasualSitRecap } from '../../shared/casualSitPublication';
import { FAMILY_PAGE_NOT_HIDDEN_SQL } from './familyPersonTastings';
import { readSitPhotoRendition, sitPhotoRenditionResponse } from './revocableSitPhotos';
import { resolveSessionTeas, type PublicProductReader } from './sessionTeas';

type Env = { DB: D1Database; ATLAS_BUCKET?: R2Bucket };
type UserAuth<E> = (request: Request, env: E) => Promise<{ userId: string } | { error: Response }>;
type Handler<E> = (request: Request, env: E, params: Record<string, string>) => Promise<Response>;

const headers = {
  'Cache-Control': 'private, no-store',
  'CDN-Cache-Control': 'no-store',
  'Cloudflare-CDN-Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers });
const missing = () => json({ error: 'This sit recap is unavailable.' }, 404);

// This is the linked, explicitly published People profile. The editorial
// author fallback is insufficient for a member publishing their own recap.
const publicProfile = `c.is_published = 1 AND ${FAMILY_PAGE_NOT_HIDDEN_SQL}`;

// Match the exact recorded tea against the current public shop detail. The sit's
// opaque tea id can also name a holding, and is never projected on its own.
const publicShopTea = (shop: string) => `
  LEFT JOIN products product ON product.id = sit.tea_id AND product.account_id = ${shop}
    AND product.is_public = 1 AND product.shown_in_shop = 1
    AND product.status IN ('Active', 'Sold Out') AND product.type <> 'Teaware'
    AND sit.tea_name IN (product.given_name, product.product_name)
    AND EXISTS (SELECT 1 FROM accounts a WHERE a.id = product.account_id
      AND a.status = 'active' AND a.public_enabled = 1)`;

const currentPublication = `
  FROM casual_sit_publications publication
  JOIN member_private_sits sit ON sit.id = publication.sit_id
  JOIN contributors c ON c.id = publication.contributor_id AND c.user_id = sit.owner_user_id`;
const currentPhoto = `
  LEFT JOIN private_member_sit_photos photo ON photo.object_key = publication.photo_object_key
    AND photo.sit_id = sit.id AND photo.user_id = sit.owner_user_id`;
const publicColumns = `publication.slug, publication.title, publication.writing, publication.tea_name,
  sit.sit_date AS date, c.id AS profile_slug, c.display_name AS host_name,
  CASE WHEN publication.link_shop_tea = 1 THEN product.id END AS product_id,
  CASE WHEN photo.id IS NOT NULL THEN publication.photo_public_id END AS photo_public_id, publication.photo_alt,
  sit.owner_user_id, CASE WHEN publication.tea_name = sit.tea_name THEN sit.tea_id END AS recorded_tea_id`;

type PublicRow = {
  slug: string; title: string; writing: string; tea_name: string; date: string;
  profile_slug: string; host_name: string; product_id: string | null;
  photo_public_id: string | null; photo_alt: string | null;
  owner_user_id: string; recorded_tea_id: string | null;
};
/**
 * The poured tea as a record. A linked shop tea resolves in the shop; an
 * unlinked one resolves only as a holding in the host's own Tea Chest, and
 * only when the published name is the name the sit recorded.
 */
async function withTeas(db: D1Database, readPublic: PublicProductReader | undefined, shop: string, row: PublicRow) {
  const recap = projectRecap(row);
  const productId = row.product_id ?? row.recorded_tea_id;
  const [tea] = await resolveSessionTeas(db, readPublic ?? (() => Promise.resolve(null)),
    row.product_id ? shop : null, [row.owner_user_id], [{ menuId: null, productId, name: row.tea_name }]);
  return { ...recap, teas: tea ? [tea] : [] };
}

function projectRecap(row: PublicRow): CasualSitRecap {
  return {
    slug: row.slug, title: row.title, date: row.date, writing: row.writing,
    tea: { name: row.tea_name, productId: row.product_id },
    host: { slug: row.profile_slug, name: row.host_name },
    photo: row.photo_public_id && row.photo_alt ? { id: row.photo_public_id, alt: row.photo_alt } : null,
  };
}

type OwnerPublication = {
  slug: string; title: string; writing: string; tea_name: string; link_shop_tea: number;
  photo_id: string | null; photo_alt: string | null; contributor_id: string;
};
async function readStatus(db: D1Database, shop: string, sitId: string, userId: string): Promise<CasualSitPublicationStatus | null> {
  const sit = await db.prepare(
    `SELECT c.id AS profile_slug, c.display_name AS profile_name,
      CASE WHEN product.id IS NOT NULL THEN sit.tea_name END AS shop_tea_name
     FROM member_private_sits sit
     LEFT JOIN contributors c ON c.user_id = sit.owner_user_id AND ${publicProfile}
     ${publicShopTea('?1')}
     WHERE sit.id = ?2 AND sit.owner_user_id = ?3`,
  ).bind(shop, sitId, userId).first<{ profile_slug: string | null; profile_name: string; shop_tea_name: string | null }>();
  if (!sit) return null;

  const row = await db.prepare(
    `SELECT publication.slug, publication.title, publication.writing, publication.tea_name, publication.link_shop_tea,
      publication.contributor_id, photo.id AS photo_id, publication.photo_alt
     FROM casual_sit_publications publication JOIN member_private_sits sit ON sit.id = publication.sit_id
     ${currentPhoto}
     WHERE publication.sit_id = ? AND sit.owner_user_id = ?`,
  ).bind(sitId, userId).first<OwnerPublication>();

  return {
    profile: sit.profile_slug ? { slug: sit.profile_slug, name: sit.profile_name } : null,
    shopTeaName: sit.shop_tea_name,
    publication: row ? {
      slug: row.slug, title: row.title, writing: row.writing, teaName: row.tea_name,
      linkShopTea: Boolean(row.link_shop_tea),
      photo: row.photo_id && row.photo_alt ? { id: row.photo_id, alt: row.photo_alt } : null,
      visible: sit.profile_slug === row.contributor_id,
    } : null,
  };
}

function boundedText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string' || value.length > maxLength) return null;
  return value.trim() || null;
}

async function publish(
  request: Request, { DB, ATLAS_BUCKET }: Env, shopAccountId: string, sitId: string, userId: string,
  status: CasualSitPublicationStatus,
): Promise<Response> {
  if (!status.profile) return json({ error: 'Publish your People profile first.' }, 409);
  const input = await request.json().catch(() => null) as {
    title?: unknown; writing?: unknown; teaName?: unknown; linkShopTea?: unknown;
    photo?: { id?: unknown; alt?: unknown; confirmed?: unknown } | null;
  } | null;
  const title = boundedText(input?.title, casualSitLimits.title);
  const text = input?.writing ?? '';
  const writing = typeof text === 'string' && text.length <= casualSitLimits.writing ? text.trim() : null;
  const teaName = boundedText(input?.teaName, casualSitLimits.teaName);
  if (!title || writing === null || !teaName || typeof input?.linkShopTea !== 'boolean' || input.photo === undefined) {
    return json({ error: 'Enter a public title and exact tea name.' }, 400);
  }
  if (!writing && input.photo === null) return json({ error: 'Write a short recap or choose a photo.' }, 400);
  if (input.linkShopTea && status.shopTeaName !== teaName) {
    return json({ error: 'The exact shop tea is unavailable. Publish with the written tea name.' }, 409);
  }

  let photoKey: string | null = null;
  let photoAlt: string | null = null;
  if (input.photo !== null) {
    const photoId = boundedText(input.photo.id, 64);
    const alt = input.photo.alt;
    if (!photoId || input.photo.confirmed !== true || (alt !== undefined && (typeof alt !== 'string' || alt.length > casualSitLimits.photoAlt))) {
      return json({ error: 'Choose a photo and confirm you can share it publicly.' }, 400);
    }
    photoAlt = boundedText(alt, casualSitLimits.photoAlt) ?? `Photo from ${title}`;
    const photo = await DB.prepare(
      'SELECT object_key FROM private_member_sit_photos WHERE sit_id = ? AND user_id = ? AND id = ?',
    ).bind(sitId, userId, photoId).first<{ object_key: string }>();
    if (!photo) return json({ error: 'Choose a photo you added to this sit.' }, 409);
    if (!ATLAS_BUCKET) return json({ error: 'Photo storage is unavailable.' }, 503);
    if (!await readSitPhotoRendition(ATLAS_BUCKET, photo.object_key)) {
      return json({ error: 'This photo could not be prepared for publication.' }, 422);
    }
    photoKey = photo.object_key;
  }

  const updated = await DB.prepare(
    `INSERT INTO casual_sit_publications
       (sit_id, contributor_id, slug, title, writing, tea_name, link_shop_tea, photo_object_key, photo_public_id, photo_alt, published_at)
     SELECT sit.id, c.id, ?1, ?2, ?3, ?4, ?5, photo.object_key,
       CASE WHEN photo.object_key IS NOT NULL THEN ?6 END, ?7, ?8
     FROM member_private_sits sit JOIN contributors c ON c.user_id = sit.owner_user_id
     ${publicShopTea('?9')}
     LEFT JOIN private_member_sit_photos photo ON photo.object_key = ?10
       AND photo.sit_id = sit.id AND photo.user_id = sit.owner_user_id
     WHERE sit.id = ?11 AND sit.owner_user_id = ?12 AND c.id = ?13 AND ${publicProfile}
       AND (?5 = 0 OR (product.id IS NOT NULL AND sit.tea_name = ?4))
       AND (?10 IS NULL OR photo.object_key IS NOT NULL)
     ON CONFLICT(sit_id) DO UPDATE SET
       contributor_id = excluded.contributor_id,
       slug = CASE WHEN casual_sit_publications.contributor_id = excluded.contributor_id
         THEN casual_sit_publications.slug ELSE excluded.slug END,
       title = excluded.title, writing = excluded.writing, tea_name = excluded.tea_name,
       link_shop_tea = excluded.link_shop_tea,
       photo_public_id = CASE WHEN casual_sit_publications.photo_object_key = excluded.photo_object_key
         AND casual_sit_publications.contributor_id = excluded.contributor_id
         THEN casual_sit_publications.photo_public_id ELSE excluded.photo_public_id END,
       photo_object_key = excluded.photo_object_key, photo_alt = excluded.photo_alt`,
  ).bind(crypto.randomUUID(), title, writing, teaName, Number(input.linkShopTea),
    crypto.randomUUID(), photoAlt, new Date().toISOString(), shopAccountId, photoKey, sitId, userId, status.profile.slug).run();

  return updated.meta.changes
    ? json(await readStatus(DB, shopAccountId, sitId, userId))
    : json({ error: 'The profile, exact tea, or photo changed. Reopen the recap and try again.' }, 409);
}

export function casualSitPublicationRoutes<E extends Env>(deps: {
  requireUser: UserAuth<E>;
  shopAccountId: string;
  readPublic?: (env: E) => PublicProductReader;
}): [string, string, Handler<E>][] {
  const base = `SELECT ${publicColumns} ${currentPublication} ${currentPhoto}
    ${publicShopTea('?1')} WHERE ${publicProfile}`;
  const list: Handler<E> = async (_request, env, { slug }) => {
    const { DB } = env;
    const query = DB.prepare(`${base} AND c.id = ?2
      ORDER BY sit.sit_date DESC, publication.published_at DESC, publication.slug DESC LIMIT 24`);
    const { results } = await query.bind(deps.shopAccountId, slug).all<PublicRow>();
    const reader = deps.readPublic?.(env);
    return json({ recaps: await Promise.all(results.map(row => withTeas(DB, reader, deps.shopAccountId, row))) });
  };
  const recap: Handler<E> = async (_request, env, { slug }) => {
    const { DB } = env;
    const row = await DB.prepare(`${base} AND publication.slug = ?2`)
      .bind(deps.shopAccountId, slug).first<PublicRow>();
    return row ? json({ recap: await withTeas(DB, deps.readPublic?.(env), deps.shopAccountId, row) }) : missing();
  };
  const photo: Handler<E> = async (request, { DB, ATLAS_BUCKET }, { slug, photoId }) => {
    const read = () => DB.prepare(
      `SELECT photo.object_key ${currentPublication} ${currentPhoto}
       WHERE ${publicProfile} AND publication.slug = ? AND publication.photo_public_id = ?
         AND photo.object_key IS NOT NULL`,
    ).bind(slug, photoId).first<{ object_key: string }>();
    const source = await read();
    if (!source) return missing();
    if (!ATLAS_BUCKET) return json({ error: 'Photo storage is unavailable.' }, 503);
    const bytes = await readSitPhotoRendition(ATLAS_BUCKET, source.object_key);
    return bytes && (await read())?.object_key === source.object_key ? sitPhotoRenditionResponse(request, bytes) : missing();
  };
  const own: Handler<E> = async (request, env, { id }) => {
    const actor = await deps.requireUser(request, env);
    if ('error' in actor) return actor.error;
    if (actor.userId === 'env-admin') return json({ error: 'Sign in to your personal account.' }, 401);
    const status = await readStatus(env.DB, deps.shopAccountId, id, actor.userId);
    if (!status) return missing();
    if (request.method === 'GET') return json(status);
    if (request.method === 'PUT') return publish(request, env, deps.shopAccountId, id, actor.userId, status);
    await env.DB.prepare(`DELETE FROM casual_sit_publications WHERE sit_id = ?
      AND EXISTS (SELECT 1 FROM member_private_sits WHERE id = ? AND owner_user_id = ?)`)
      .bind(id, id, actor.userId).run();
    return json({ ...status, publication: null });
  };
  return [
    ['GET', '/api/casual-sits/:slug', recap],
    ['GET', '/api/casual-sits/:slug/photo/:photoId', photo],
    ['HEAD', '/api/casual-sits/:slug/photo/:photoId', photo],
    ['GET', '/api/people/:slug/casual-sits', list],
    ['GET', '/api/me/private-sits/:id/publication', own],
    ['PUT', '/api/me/private-sits/:id/publication', own],
    ['DELETE', '/api/me/private-sits/:id/publication', own],
  ];
}
