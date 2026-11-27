import { hostArticlesOpen } from '../../src/lib/hostArticles';

interface OfferEnv {
  DB: D1Database;
  ATLAS_BUCKET?: R2Bucket;
  HOST_ARTICLES_OPEN?: string;
}

type User = { userId: string } | { error: Response };

interface Access<Env> {
  accountId: string;
  requireUser: (request: Request, env: Env) => Promise<User>;
  optionalUser: (request: Request, env: Env) => Promise<{ userId: string } | null>;
  requireOwner: (request: Request, env: Env) => Promise<Response | null>;
  limitSubmission: (env: Env, userId: string) => Promise<Response | null>;
}

type OfferRow = {
  id: string;
  writer_user_id: string | null;
  title: string;
  body: string;
  photo_ids: string;
  credit: number;
  author_name: string | null;
  status: 'offered' | 'published' | 'declined';
  created_at: string;
  slug: string | null;
};

const ARTICLE_ID_PREFIX = 'host-article-';
const MAX_PHOTOS = 8;
const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_PHOTOS * MAX_PHOTO_BYTES + 256 * 1024;
const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

export function isHostArticleId(id: string): boolean {
  return id.startsWith(ARTICLE_ID_PREFIX);
}

function response(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

const notFound = () => response({ error: 'Not found' }, 404);
const alreadyReviewed = () => response({ error: 'This offer has already been reviewed.' }, 409);
const photoKey = (id: string, photoId: string) => `host-article-offers/${id}/${photoId}.jpg`;
const publishedPhotoPath = (id: string, photoId: string) => `/api/articles/${id}/photos/${photoId}`;

export function publishedArticleMediaPath<T>(value: T): T | string {
  return typeof value === 'string' && /^\/api\/article-offers\/host-article-[^/]+\/photos\/[^/]+$/.test(value)
    ? value.replace('/api/article-offers/', '/api/articles/')
    : value;
}

const closed = () => Response.json({ error: 'Not found' }, { status: 404 });
const photoIds = (row: OfferRow): string[] => JSON.parse(row.photo_ids);

const OFFER_ROWS = `SELECT o.*, a.slug FROM host_article_offers o
  LEFT JOIN articles a ON a.id = o.id AND a.account_id = o.account_id AND a.status = 'published'
  WHERE o.account_id = ?`;

function offerToApi(row: OfferRow) {
  return {
    id: row.id, title: row.title, body: row.body, photos: photoIds(row),
    credit: Boolean(row.credit), author_name: row.author_name, status: row.status,
    slug: row.slug, created_at: row.created_at,
  };
}

async function hasHosted(db: D1Database, userId: string): Promise<boolean> {
  const earlierHost = await db.prepare(`SELECT 1 FROM member_private_sits WHERE owner_user_id = ?1
    UNION ALL
    SELECT 1 FROM event_contributors ec
      JOIN contributors c ON c.id = ec.contributor_id
      JOIN events e ON e.id = ec.event_id AND e.account_id = ec.account_id
      WHERE c.user_id = ?1 AND ec.role IN ('lead_host', 'co_host', 'guest_host')
        AND e.lifecycle_status NOT IN ('draft', 'cancelled')
    LIMIT 1`).bind(userId).first();
  if (earlierHost) return true;

  // Launch 2 adds a direct host identity, including hosts without a public page.
  const directHostColumn = await db.prepare(
    "SELECT 1 FROM pragma_table_info('events') WHERE name = 'host_user_id'",
  ).first();
  return Boolean(directHostColumn && await db.prepare(
    "SELECT 1 FROM events WHERE host_user_id = ? AND lifecycle_status NOT IN ('draft', 'cancelled') LIMIT 1",
  ).bind(userId).first());
}

async function readOfferForm(request: Request): Promise<FormData | Response> {
  const contentType = request.headers.get('Content-Type') || '';
  if (!request.body || !contentType.startsWith('multipart/form-data;')) {
    return response({ error: 'Expected an article form.' }, 400);
  }
  const tooLarge = () => response({ error: 'The article and its photos are too large.' }, 413);
  if (Number(request.headers.get('Content-Length')) > MAX_REQUEST_BYTES) return tooLarge();
  const reader = request.body.getReader();
  let size = 0;
  let exceeded = false;
  const bounded = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const chunk = await reader.read();
      if (chunk.done) return controller.close();
      size += chunk.value.byteLength;
      if (size <= MAX_REQUEST_BYTES) return controller.enqueue(chunk.value);
      exceeded = true;
      controller.error(new Error('Article form too large'));
      await reader.cancel();
    },
    cancel: reason => reader.cancel(reason),
  });
  try {
    return await new Response(bounded, { headers: { 'Content-Type': contentType } }).formData();
  } catch {
    return exceeded ? tooLarge() : response({ error: 'The article form could not be read.' }, 400);
  }
}

type Photo = { id: string; bytes?: ArrayBuffer };

async function readArticle(form: FormData, allowedPhotos: string[]) {
  const rawTitle = form.get('title');
  const rawBody = form.get('body');
  const title = typeof rawTitle === 'string' ? rawTitle.trim() : '';
  const body = typeof rawBody === 'string' ? rawBody.trim().replace(/\r\n?/g, '\n') : '';
  if (!title || title.length > 160 || !body || body.length > 40_000) {
    return response({ error: 'Enter a title up to 160 characters and an article up to 40,000 characters.' }, 400);
  }

  // Workerd returns File entries for multipart uploads. The worker types'
  // entries() signature only declares strings.
  const entries: [string, string | File][] = [...form.entries()];
  const fields = entries.filter(([key]) => key === 'keep_photo' || key === 'photos');
  if (fields.length > MAX_PHOTOS) return response({ error: 'Use up to eight photos.' }, 400);
  const photos: Photo[] = [];
  for (const [key, value] of fields) {
    if (key === 'keep_photo') {
      if (typeof value !== 'string' || !allowedPhotos.includes(value) || photos.some(photo => photo.id === value)) {
        return response({ error: 'Choose photos from this offer.' }, 400);
      }
      photos.push({ id: value });
      continue;
    }
    if (typeof value === 'string' || value.type !== 'image/jpeg' || value.size < 4 || value.size > MAX_PHOTO_BYTES) {
      return response({ error: 'Use JPEG photos up to 3 MB each.' }, 400);
    }
    const bytes = await value.arrayBuffer();
    const signature = new Uint8Array(bytes, 0, 3);
    if (signature[0] !== 255 || signature[1] !== 216 || signature[2] !== 255) {
      return response({ error: 'The photo could not be read as a JPEG.' }, 400);
    }
    photos.push({ id: crypto.randomUUID(), bytes });
  }
  return { title, body, photos };
}

async function removePhotos(bucket: R2Bucket | undefined, id: string, photos: string[]) {
  if (!bucket || !photos.length) return;
  try {
    await bucket.delete(photos.map(photo => photoKey(id, photo)));
  } catch (error) {
    console.warn('Could not remove unused host article photos', error);
  }
}

async function withNewPhotos(
  env: OfferEnv, id: string, photos: Photo[], save: () => Promise<Response>,
): Promise<Response> {
  const writes = photos.filter(photo => photo.bytes);
  if (writes.length && !env.ATLAS_BUCKET) return response({ error: 'Photo storage is unavailable.' }, 503);
  let storing = true;
  try {
    for (const photo of writes) {
      await env.ATLAS_BUCKET!.put(photoKey(id, photo.id), photo.bytes!, { httpMetadata: { contentType: 'image/jpeg' } });
    }
    storing = false;
    const result = await save();
    if (!result.ok) await removePhotos(env.ATLAS_BUCKET, id, writes.map(photo => photo.id));
    return result;
  } catch (error) {
    // After an uncertain database response, leave the objects private until
    // the database can confirm whether the operation committed.
    if (storing) await removePhotos(env.ATLAS_BUCKET, id, writes.map(photo => photo.id));
    throw error;
  }
}

export function createHostArticleHandlers<Env extends OfferEnv>(access: Access<Env>) {
  const { accountId } = access;

  async function member(request: Request, env: Env) {
    if (!hostArticlesOpen(env)) return closed();
    const user = await access.requireUser(request, env);
    if ('error' in user) return user.error;
    const canOffer = await hasHosted(env.DB, user.userId);
    if (request.method === 'GET') {
      const offers = await env.DB.prepare(`${OFFER_ROWS} AND o.writer_user_id = ? ORDER BY o.created_at DESC, o.id`)
        .bind(accountId, user.userId).all<OfferRow>();
      return response({ can_offer: canOffer, offers: offers.results.map(offerToApi) });
    }
    if (!canOffer) return response({ error: 'Hosting a session opens article offers.' }, 403);
    const limited = await access.limitSubmission(env, user.userId);
    if (limited) return limited;
    const form = await readOfferForm(request);
    if (form instanceof Response) return form;
    const submissionId = form.get('submission_id');
    const credit = form.get('credit');
    if (typeof submissionId !== 'string' || !UUID.test(submissionId)
      || (credit !== 'true' && credit !== 'false')) {
      return response({ error: 'Choose whether your name may appear, then send the article.' }, 400);
    }
    const findSubmission = () => env.DB.prepare(`${OFFER_ROWS} AND o.writer_user_id = ? AND o.submission_id = ?`)
      .bind(accountId, user.userId, submissionId).first<OfferRow>();
    const existing = await findSubmission();
    if (existing) return response(offerToApi(existing));
    const article = await readArticle(form, []);
    if (article instanceof Response) return article;

    const byline = credit === 'true' ? await env.DB.prepare('SELECT name FROM users WHERE id = ?')
      .bind(user.userId).first<{ name: string | null }>() : null;
    const id = ARTICLE_ID_PREFIX + crypto.randomUUID();
    const result = await withNewPhotos(env, id, article.photos, async () => {
      const inserted = await env.DB.prepare(`INSERT INTO host_article_offers
        (id, account_id, writer_user_id, submission_id, title, body, photo_ids, credit, author_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (account_id, writer_user_id, submission_id) DO NOTHING
        RETURNING *, NULL AS slug`)
        .bind(id, accountId, user.userId, submissionId, article.title, article.body,
          JSON.stringify(article.photos.map(photo => photo.id)), Number(credit === 'true'), byline?.name?.trim() || null)
        .first<OfferRow>();
      return inserted ? response(offerToApi(inserted), 201) : alreadyReviewed();
    });
    if (result.status !== 409) return result;
    const retried = await findSubmission();
    return retried ? response(offerToApi(retried)) : result;
  }

  async function review(request: Request, env: Env, params: Record<string, string>) {
    if (!hostArticlesOpen(env)) return closed();
    const denied = await access.requireOwner(request, env);
    if (denied) return denied;
    if (request.method === 'GET') {
      const offers = await env.DB.prepare(`${OFFER_ROWS} ORDER BY (o.status = 'offered') DESC, o.created_at DESC, o.id`)
        .bind(accountId).all<OfferRow>();
      return response({ offers: offers.results.map(offerToApi) });
    }

    const original = await env.DB.prepare(`${OFFER_ROWS} AND o.id = ?`).bind(accountId, params.id).first<OfferRow>();
    if (!original) return notFound();
    if (original.status !== 'offered') return alreadyReviewed();
    const form = await readOfferForm(request);
    if (form instanceof Response) return form;
    const action = form.get('action');
    if (action === 'decline') {
      const declined = await env.DB.prepare(`UPDATE host_article_offers SET status = 'declined'
        WHERE id = ? AND account_id = ? AND status = 'offered' RETURNING *, NULL AS slug`)
        .bind(original.id, accountId).first<OfferRow>();
      return declined ? response(offerToApi(declined)) : alreadyReviewed();
    }
    if (action !== 'publish') return response({ error: 'Choose Publish or Decline.' }, 400);

    const article = await readArticle(form, photoIds(original));
    if (article instanceof Response) return article;
    const ids = article.photos.map(photo => photo.id);
    const slugStem = article.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 64).replace(/^-|-$/g, '');
    const slug = `${slugStem || 'article'}-${original.id.slice(ARTICLE_ID_PREFIX.length)}`;
    const urls = ids.map(id => publishedPhotoPath(original.id, id));
    const blocks = [
      { type: 'cover', title: article.title, image: urls[0], variant: urls.length ? undefined : 'centered' },
      ...article.body.split(/\n+/).map(text => text.trim()).filter(Boolean).map(text => ({ type: 'paragraph', text })),
      ...urls.slice(1).map(url => ({ type: 'image', url })),
    ];
    const result = await withNewPhotos(env, original.id, article.photos, async () => {
      // Both writes commit together. A concurrent decision changes the guard
      // before this batch runs, so the losing request cannot create an article.
      const [insert] = await env.DB.batch([
        env.DB.prepare(`INSERT INTO articles
          (id, account_id, title, author_id, slug, status, cover_image_url, blocks, layout_template, published_at)
          SELECT id, account_id, ?, CASE WHEN credit = 1 AND author_name IS NOT NULL THEN writer_user_id END,
            ?, 'published', ?, ?, 'immersive_scroll', datetime('now')
          FROM host_article_offers WHERE id = ? AND account_id = ? AND status = 'offered'`)
          .bind(article.title, slug, urls[0] ?? null, JSON.stringify(blocks), original.id, accountId),
        env.DB.prepare(`UPDATE host_article_offers SET title = ?, body = ?, photo_ids = ?, status = 'published'
          WHERE id = ? AND account_id = ? AND status = 'offered'`)
          .bind(article.title, article.body, JSON.stringify(ids), original.id, accountId),
      ]);
      return insert.meta.changes
        ? response(offerToApi({ ...original, title: article.title, body: article.body, photo_ids: JSON.stringify(ids), status: 'published', slug }))
        : alreadyReviewed();
    });
    if (result.ok) await removePhotos(env.ATLAS_BUCKET, original.id, photoIds(original).filter(id => !ids.includes(id)));
    return result;
  }

  async function photo(request: Request, env: Env, params: Record<string, string>) {
    if (!hostArticlesOpen(env)) return closed();
    const offer = await env.DB.prepare(`${OFFER_ROWS} AND o.id = ?`).bind(accountId, params.id).first<OfferRow>();
    if (!offer || !photoIds(offer).includes(params.photoId)) return notFound();
    if (!offer.slug) {
      const user = await access.optionalUser(request, env);
      if (!user || (user.userId !== offer.writer_user_id && await access.requireOwner(request, env))) return notFound();
    }
    return servePhoto(env, offer.id, params.photoId);
  }

  async function publishedPhoto(_request: Request, env: Env, params: Record<string, string>) {
    if (!isHostArticleId(params.id) || !UUID.test(params.id.slice(ARTICLE_ID_PREFIX.length)) || !UUID.test(params.photoId)) {
      return notFound();
    }
    const article = await env.DB.prepare(`SELECT cover_image_url, blocks FROM articles
      WHERE id = ? AND status = 'published'`)
      .bind(params.id).first<{ cover_image_url: string | null; blocks: string | null }>();
    if (!article) return notFound();
    const path = publishedPhotoPath(params.id, params.photoId);
    if (publishedArticleMediaPath(article.cover_image_url) === path) return servePhoto(env, params.id, params.photoId);
    let blocks: unknown;
    try { blocks = JSON.parse(article.blocks || '[]'); } catch { return notFound(); }
    const used = Array.isArray(blocks) && blocks.some(block =>
      (block?.type === 'cover' && publishedArticleMediaPath(block.image) === path) ||
      (block?.type === 'image' && publishedArticleMediaPath(block.url) === path));
    return used ? servePhoto(env, params.id, params.photoId) : notFound();
  }

  async function servePhoto(env: Env, id: string, photoId: string) {
    const object = await env.ATLAS_BUCKET?.get(photoKey(id, photoId));
    if (!object) return notFound();
    return new Response(object.body, { headers: {
      'Content-Type': 'image/jpeg',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
    } });
  }

  return { member, review, photo, publishedPhoto };
}
