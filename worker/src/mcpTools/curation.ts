/**
 * Curation tools: what appears in the shop, and what it looks like.
 *
 * Two gaps this closes. Adrian could already tell an agent to change a tea's
 * price, its stock, its archive status and whether it is listed at all, but not
 * what the shop actually *shows*: collections were admin-UI-only, so the one
 * surface that decides which teas a visitor meets first had no agent path. And
 * no tool could set a photo, which meant every tea an agent created arrived
 * blank and had to be finished by hand in the browser — the round trip the MCP
 * server exists to remove.
 *
 * Shop semantics, taken from the REST routes rather than invented here
 * (index.ts, handlePublishToShop / handleSetProductFeatured):
 *
 *   - A collection is a set of products belonging to ONE account.
 *   - A row in `collection_publications` with `target_type='shop'` and
 *     `unpublished_at IS NULL` is what makes that collection public on the
 *     storefront (GET /api/collections/shop). Unpublishing is a timestamp, not
 *     a delete: the record of what was shown when survives.
 *   - The account's "Featured" strip is not a separate mechanism. It is one
 *     collection carrying `is_featured_collection = 1`, published to the shop.
 *     So adding a tea to that collection is exactly what the admin's Featured
 *     toggle does, and these tools say so in their output rather than letting
 *     an agent discover it by accident.
 *
 * REQUIRES A ONE-LINE CHANGE IN mcp.ts THAT THIS MODULE MUST NOT MAKE ITSELF
 * (six tool groups were written against this file at once; every one of them
 * editing mcp.ts is the merge conflict mcpTools/ exists to prevent):
 *
 *   1. Registration — in `TOOL_MODULES`:
 *        import { curationTools } from './mcpTools/curation';
 *        const TOOL_MODULES: ToolModule[] = [curationTools];
 *
 *   2. Annotations — `visibleToolDefs` overwrites a module's own `annotations`
 *      with `annotationsFor(name)`, which reads three sets in mcp.ts. Until
 *      `list_collections` joins READ_ONLY_TOOLS it is advertised to clients as
 *      a tool that writes, and a careful client will refuse to call it on its
 *      own. The idempotent ones below should likewise join IDEMPOTENT_TOOLS:
 *      confirming any of them twice with the same arguments lands in the same
 *      end state. The `annotations` on each def here record the intent so the
 *      edit is a copy, not a judgement call.
 *
 *   3. Audit — `logMcpToolCall` only writes an activity_logs row for names in
 *      AUDITED_TOOLS. Every mutating tool here writes its own activity_logs row
 *      at commit, so nothing is lost, but the uniform MCP_TOOL_CALL trail skips
 *      them until the names are added.
 */
import type { ToolAuth, ToolDefinition, ToolEnv, ToolHandler, ToolModule } from './registry';
import { INVALID_TICKET as BAD_TICKET, PENDING_TTL_MS, consumeTicket as consumeShared, issueTicket } from './tickets';


// Tiers that count as account ownership. Mirrors OWNER_TIERS in mcp.ts, which
// cannot be imported: mcp.ts imports this folder, so the arrow only points one
// way. Scope enforcement is mcp.ts's job and already ran before any handler
// here is reached; this copy is only for the reads, which are deliberately
// scoped `inventory:read` and therefore reachable by a non-owner token.
const OWNER_TIERS: ReadonlySet<string> = new Set(['platform_owner', 'account_owner']);

/* ── confirmation tickets ────────────────────────────────────────────────────
 *
 * The same durable pattern mcp.ts uses, against the same table, for the same
 * reason: Cloudflare may route the preview call and the confirm call to
 * different isolates, and isolates are recycled freely, so a Map in module
 * memory loses pending mutations across both boundaries and surfaces as a
 * spurious `invalid_or_expired_confirmation_token` mid-conversation.
 *
 * Deliberately re-implemented rather than shared: mcp.ts's helpers are typed
 * against its own `PendingMutation` union, and widening that union is an edit
 * to the file this folder exists to stop editing. What must NOT diverge is the
 * storage contract, so it does not: hash-only storage, an expiry, a bind to the
 * issuing token, and single-use by atomic UPDATE…RETURNING. Our `kind` values
 * all carry the `curation:` prefix, which is also what keeps the two consumers
 * off each other's rows — mcp.ts checks its kind, we check ours, and neither
 * can commit a ticket the other issued.
 */

type Ticket =
  | { kind: 'curation:create_collection'; accountId: string; userId: string; userEmail: string; title: string; note: string | null; heroImageUrl: string | null; productIds: string[] }
  | { kind: 'curation:add_tea_to_collection'; accountId: string; userEmail: string; collectionId: string; productIds: string[] }
  | { kind: 'curation:remove_tea_from_collection'; accountId: string; userEmail: string; collectionId: string; productIds: string[] }
  | { kind: 'curation:publish_collection'; accountId: string; userId: string; userEmail: string; collectionId: string }
  | { kind: 'curation:unpublish_collection'; accountId: string; userEmail: string; collectionId: string }
  | { kind: 'curation:set_tea_image'; accountId: string; userEmail: string; productId: string; imageUrl: string | null }
  | { kind: 'curation:add_tea_images'; accountId: string; userEmail: string; productId: string; imageUrls: string[]; expectedRaw: string | null }
  | { kind: 'curation:remove_tea_image'; accountId: string; userEmail: string; productId: string; imageUrl: string; expectedRaw: string | null };


/* ── argument reading ────────────────────────────────────────────────────────
 *
 * One switch, at the boundary, for the same reason productUpdatePayload.ts has
 * one: an empty string is what a form and a voice transcript both produce when
 * the speaker said nothing, and `String(args.x)` turns that into a value the
 * database will happily store. A title of "" is not a title.
 */

function optionalText(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
}

/** Reads a list of ids from either `product_ids: [...]` or a single `product_id`. */
function readProductIds(args: any): string[] {
  const raw: unknown[] = Array.isArray(args?.product_ids)
    ? args.product_ids
    : (args?.product_id != null ? [args.product_id] : []);
  const out: string[] = [];
  for (const entry of raw) {
    const id = optionalText(entry);
    // Duplicates are dropped rather than refused: "add these three, one twice"
    // is a transcription artefact, not a request worth failing.
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

/**
 * An image URL the storefront can actually fetch.
 *
 * Uploads land on https://media.teajia.co/... (index.ts handleUploadImage), and
 * a root-relative path is served same-origin, so those two shapes are the whole
 * legitimate set. Everything else is refused by name: `data:` would put a
 * megabyte of base64 in a D1 row that every catalog read then carries, and
 * `javascript:` is a stored-XSS payload wearing a photo's clothes. Refusing is
 * the point — a bad URL accepted here renders as a broken image on a product
 * page, which nobody reports.
 */
function readImageUrl(value: unknown): { url: string } | { error: string } {
  const url = optionalText(value);
  if (!url) return { error: 'image_url_required' };
  if (url.length > 2000) return { error: 'image_url_too_long' };
  if (url.startsWith('/')) return { url };
  if (/^https?:\/\/\S+$/i.test(url)) return { url };
  return { error: `image_url_must_be_http_https_or_root_relative: ${url.slice(0, 60)}` };
}

/* ── row lookup ──────────────────────────────────────────────────────────── */

type ProductRow = { id: string; given_name: string | null; product_name: string; image_url: string | null; additional_images: string | null };

/**
 * Resolve a product id within the caller's account, tolerating the id prefixes
 * that search_tea hands back but refusing an ambiguous one.
 *
 * The built-in tools accept `id = ? OR id LIKE ?` and take the first row. That
 * is fine for a price edit an operator reads back, and wrong for a photo: two
 * teas sharing an id prefix would mean the picture lands on whichever row
 * SQLite returned first, silently, and the tea you were looking at stays blank.
 * So a prefix that matches more than one product is an error naming the
 * candidates, not a coin toss.
 */
async function resolveProduct(env: ToolEnv, accountId: string, productId: string): Promise<ProductRow | { error: string; candidates?: string[] }> {
  const exact = await env.DB.prepare(
    `SELECT id, given_name, product_name, image_url, additional_images
       FROM products WHERE id = ? AND account_id = ?`
  ).bind(productId, accountId).first() as ProductRow | null;
  if (exact) return exact;

  const { results } = await env.DB.prepare(
    `SELECT id, given_name, product_name, image_url, additional_images
       FROM products WHERE account_id = ? AND id LIKE ? LIMIT 5`
  ).bind(accountId, `${productId}-%`).all() as { results: ProductRow[] };
  if (!results || results.length === 0) return { error: 'product_not_found' };
  if (results.length > 1) {
    return { error: 'product_id_ambiguous', candidates: results.map(r => r.id) };
  }
  return results[0];
}

function productLabel(row: ProductRow): string {
  return row.given_name || row.product_name;
}

type CollectionRow = {
  id: string; title: string; note: string | null; status: string;
  curator_user_id: string | null; is_featured_collection: number | null;
};

/** Every collection read starts here, so `account_id` is never optional. */
async function loadCollection(env: ToolEnv, accountId: string, collectionId: string): Promise<CollectionRow | null> {
  return await env.DB.prepare(
    `SELECT id, title, note, status, curator_user_id, is_featured_collection
       FROM collections WHERE id = ? AND account_id = ?`
  ).bind(collectionId, accountId).first() as CollectionRow | null;
}

/**
 * A curator may only touch their own collections; an owner may touch any in the
 * account. Mirrors the REST handlers, which apply the same rule — an agent path
 * that skipped it would be a way around the browser's own permission check.
 */
function mayTouchCollection(auth: ToolAuth, collection: CollectionRow): boolean {
  if (OWNER_TIERS.has(auth.creatorTier)) return true;
  return collection.curator_user_id === auth.userId;
}

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
}

/** Mirrors slugifyTitle + buildCollectionSlug in index.ts so a collection
 *  published from here reads the same in a URL as one published from the UI. */
function buildCollectionSlug(title: string): string {
  const base = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'collection';
  return `${base}-${crypto.randomUUID().replace(/-/g, '').slice(0, 4)}`;
}

async function reserveSlug(env: ToolEnv, title: string): Promise<string | null> {
  // `collection_publications.slug` is globally UNIQUE, so a collision is a
  // failed INSERT rather than a shadowed row. Five tries against a 4-character
  // suffix is what the REST route uses and has never exhausted.
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = buildCollectionSlug(title);
    const taken = await env.DB.prepare('SELECT 1 FROM collection_publications WHERE slug = ?').bind(candidate).first();
    if (!taken) return candidate;
  }
  return null;
}

function auditStmt(env: ToolEnv, action: string, details: unknown, auth: { userEmail: string }, entityType: string, entityId: string, accountId: string) {
  return env.DB.prepare(
    `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(crypto.randomUUID(), action, typeof details === 'string' ? details : JSON.stringify(details), auth.userEmail, entityType, entityId, accountId);
}

/* ── additional_images ───────────────────────────────────────────────────────
 *
 * The column is a JSON array stored as TEXT (schema.sql, products). Everything
 * that reads it does `try { JSON.parse } catch { [] }` and moves on, which is
 * right for a read — a display falling back to no extra photos loses nothing.
 * It is exactly wrong for a write: parsing to `[]` and then saving means an
 * unreadable column is quietly replaced by whatever this call adds, and the
 * photos that were in there are gone with no error anywhere. So a write path
 * refuses to guess.
 */
function parseImageArray(raw: string | null): { list: string[] } | { error: string } {
  if (raw == null || raw.trim() === '') return { list: [] };
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return { error: 'additional_images_unreadable' }; }
  if (!Array.isArray(parsed)) return { error: 'additional_images_unreadable' };
  const list: string[] = [];
  for (const entry of parsed) {
    const url = optionalText(entry);
    // A null or blank slot in the stored array is dropped on the way through,
    // because writing it back would keep an entry nothing can render. Anything
    // that IS a URL is preserved exactly, including one this module would
    // refuse to accept as new input: old rows are not ours to re-validate.
    if (url) list.push(url);
  }
  return { list };
}

/**
 * Compare two image URLs ignoring the `?v=` cache-buster the upload route
 * appends. Re-uploading into a stable slot returns the same key with a new
 * timestamp, so a caller asking to remove "the photo on the page" will
 * routinely hand back a string that differs from the stored one by a query
 * they never see. Matching on the path alone is what makes remove work.
 */
function sameImage(a: string, b: string): boolean {
  if (a === b) return true;
  const strip = (s: string) => s.split('?')[0];
  return strip(a) === strip(b);
}

/** Products' image columns mirror into tea_profiles (id = 'prof_' + product id,
 *  PROFILE_MIRROR_COLUMNS in index.ts) so partner catalog browse never shows a
 *  photo the shop has already replaced. The UPDATE matches nothing for teaware
 *  and other rows with no profile, which is the intended no-op. */
function profileImageMirror(env: ToolEnv, productId: string, sets: Record<string, string | null>) {
  const cols = Object.keys(sets);
  return env.DB.prepare(
    `UPDATE tea_profiles SET ${cols.map(c => `${c} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`
  ).bind(...cols.map(c => sets[c]), `prof_${productId}`);
}

/* ══ A. Collections ═══════════════════════════════════════════════════════ */

const listCollections: ToolHandler = async (env, auth, args) => {
  const status = optionalText(args?.status);
  if (status && !['draft', 'active', 'archived'].includes(status)) {
    return { error: 'status_must_be_draft_active_or_archived' };
  }
  const collectionId = optionalText(args?.collection_id);
  const productId = optionalText(args?.product_id);

  let sql = `
    SELECT c.id, c.title, c.note, c.status, c.hero_image_url,
           c.curator_display_name, c.is_featured_collection,
           c.created_at, c.updated_at,
           (SELECT COUNT(*) FROM collection_items ci WHERE ci.collection_id = c.id) AS item_count,
           (SELECT p.slug FROM collection_publications p
             WHERE p.collection_id = c.id AND p.target_type = 'shop' AND p.unpublished_at IS NULL
             LIMIT 1) AS shop_slug
      FROM collections c
     WHERE c.account_id = ?`;
  const binds: unknown[] = [auth.accountId];
  // A non-owner token sees only what it curates, exactly as the REST list does.
  if (!OWNER_TIERS.has(auth.creatorTier)) { sql += ' AND c.curator_user_id = ?'; binds.push(auth.userId); }
  if (collectionId) { sql += ' AND c.id = ?'; binds.push(collectionId); }
  if (status) { sql += ' AND c.status = ?'; binds.push(status); }
  if (productId) {
    sql += ' AND EXISTS (SELECT 1 FROM collection_items ci WHERE ci.collection_id = c.id AND ci.product_id = ?)';
    binds.push(productId);
  }
  sql += ' ORDER BY c.updated_at DESC LIMIT 100';

  const { results } = await env.DB.prepare(sql).bind(...binds).all() as { results: any[] };
  const rows = (results ?? []).map(r => ({
    collection_id: r.id,
    title: r.title,
    note: r.note,
    status: r.status,
    item_count: Number(r.item_count) || 0,
    published_to_shop: r.shop_slug != null,
    shop_slug: r.shop_slug ?? null,
    is_featured_collection: r.is_featured_collection === 1,
    curator: r.curator_display_name ?? null,
    updated_at: r.updated_at,
  }));

  // Items only when one collection was named. Removing a tea needs its product
  // id, and asking the operator to go read it out of the browser would defeat
  // the point of the tool; loading items for a hundred collections at once
  // would not.
  let items: unknown[] | undefined;
  if (collectionId && rows.length === 1) {
    const { results: itemRows } = await env.DB.prepare(
      `SELECT ci.product_id, ci.position, ci.item_note, ci.recommended_quantity, ci.recommended_price_usd,
              COALESCE(p.given_name, p.product_name) AS product_name,
              p.status AS product_status, p.image_url
         FROM collection_items ci
         JOIN products p ON p.id = ci.product_id AND p.account_id = ?
        WHERE ci.collection_id = ?
        ORDER BY ci.position ASC`
    ).bind(auth.accountId, collectionId).all() as { results: any[] };
    items = itemRows ?? [];
  }

  return {
    collections: rows,
    count: rows.length,
    ...(items ? { items } : {}),
    note: 'published_to_shop=true means this collection is live on the storefront. The collection with is_featured_collection=true is the shop\'s Featured strip.',
  };
};

const createCollection: ToolHandler = async (env, auth, args) => {
  const title = optionalText(args?.title);
  // A collection with no title is unfindable in the admin list and prints as a
  // blank heading on the storefront, so this is refused rather than defaulted.
  if (!title) return { error: 'title_required' };
  const note = optionalText(args?.note);
  const heroImageUrl = optionalText(args?.hero_image_url);
  if (heroImageUrl) {
    const checked = readImageUrl(heroImageUrl);
    if ('error' in checked) return { error: checked.error };
  }
  const requested = readProductIds({ product_ids: args?.initial_product_ids });
  const confirm = optionalText(args?.confirm);

  // Every seed product is checked against THIS account before it can be
  // previewed, let alone stored: a collection is a shop-facing set, and a
  // foreign product id in it would publish another shop's tea on this one.
  const resolved: { id: string; name: string }[] = [];
  for (const pid of requested) {
    const row = await resolveProduct(env, auth.accountId, pid);
    if ('error' in row) return { error: row.error, product_id: pid, ...(row.candidates ? { candidates: row.candidates } : {}) };
    resolved.push({ id: row.id, name: productLabel(row) });
  }

  if (!confirm) {
    const token = await issueTicket(env, {
      kind: 'curation:create_collection', accountId: auth.accountId, userId: auth.userId,
      userEmail: auth.userEmail, title, note, heroImageUrl, productIds: resolved.map(r => r.id),
    }, auth.tokenId);
    return {
      preview: {
        action: 'create_collection',
        title, note, hero_image_url: heroImageUrl,
        initial_products: resolved,
        status_on_create: 'draft',
        shop_effect: 'None yet. A new collection is a draft and is invisible to the storefront until publish_collection puts it there.',
      },
      confirmation_token: token,
      expires_in_seconds: PENDING_TTL_MS / 1000,
    };
  }

  const ticket = await consumeShared<Ticket, 'curation:create_collection'>(env, confirm, 'curation:create_collection', auth);
  if (!ticket || ticket.kind !== 'curation:create_collection') return BAD_TICKET;

  const id = newId('col');
  const now = new Date().toISOString();
  const stmts = [
    env.DB.prepare(
      `INSERT INTO collections (id, account_id, title, note, hero_image_url, status,
                                created_by_user_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?)`
    ).bind(id, ticket.accountId, ticket.title, ticket.note, ticket.heroImageUrl, ticket.userId, now, now),
  ];
  ticket.productIds.forEach((pid, idx) => {
    stmts.push(env.DB.prepare(
      `INSERT INTO collection_items (id, collection_id, product_id, position) VALUES (?, ?, ?, ?)`
    ).bind(newId('ci'), id, pid, idx + 1));
  });
  stmts.push(auditStmt(env, 'COLLECTION_CREATE_MCP', { title: ticket.title, items: ticket.productIds.length }, ticket, 'collection', id, ticket.accountId));
  await env.DB.batch(stmts);

  return {
    committed: true, action: 'create_collection',
    collection_id: id, title: ticket.title, status: 'draft',
    item_count: ticket.productIds.length,
    next: 'Call publish_collection to put it on the storefront.',
  };
};

const addTeaToCollection: ToolHandler = async (env, auth, args) => {
  const collectionId = optionalText(args?.collection_id);
  if (!collectionId) return { error: 'collection_id_required' };
  const requested = readProductIds(args);
  if (requested.length === 0) return { error: 'product_id_or_product_ids_required' };
  const confirm = optionalText(args?.confirm);

  const collection = await loadCollection(env, auth.accountId, collectionId);
  if (!collection) return { error: 'collection_not_found' };
  if (!mayTouchCollection(auth, collection)) return { error: 'forbidden_not_your_collection' };

  const resolved: { id: string; name: string }[] = [];
  for (const pid of requested) {
    const row = await resolveProduct(env, auth.accountId, pid);
    if ('error' in row) return { error: row.error, product_id: pid, ...(row.candidates ? { candidates: row.candidates } : {}) };
    resolved.push({ id: row.id, name: productLabel(row) });
  }

  const { results: existing } = await env.DB.prepare(
    'SELECT product_id FROM collection_items WHERE collection_id = ?'
  ).bind(collectionId).all() as { results: { product_id: string }[] };
  const have = new Set((existing ?? []).map(r => r.product_id));
  const toAdd = resolved.filter(r => !have.has(r.id));

  if (!confirm) {
    const token = await issueTicket(env, {
      kind: 'curation:add_tea_to_collection', accountId: auth.accountId, userEmail: auth.userEmail,
      collectionId, productIds: toAdd.map(r => r.id),
    }, auth.tokenId);
    return {
      preview: {
        action: 'add_tea_to_collection',
        collection: { id: collectionId, title: collection.title, status: collection.status },
        will_add: toAdd,
        already_present: resolved.filter(r => have.has(r.id)),
        shop_effect: collection.is_featured_collection === 1
          ? 'This is the shop\'s Featured collection, so these teas become featured on the storefront.'
          : 'Visible on the storefront only while this collection is published to the shop.',
      },
      confirmation_token: token,
      expires_in_seconds: PENDING_TTL_MS / 1000,
    };
  }

  const ticket = await consumeShared<Ticket, 'curation:add_tea_to_collection'>(env, confirm, 'curation:add_tea_to_collection', auth);
  if (!ticket || ticket.kind !== 'curation:add_tea_to_collection' || ticket.collectionId !== collectionId) return BAD_TICKET;

  const maxRow = await env.DB.prepare(
    'SELECT COALESCE(MAX(position), 0) AS max_pos FROM collection_items WHERE collection_id = ?'
  ).bind(collectionId).first() as { max_pos: number } | null;
  let pos = Number(maxRow?.max_pos) || 0;

  const stmts = ticket.productIds
    // Re-checked at commit rather than trusted from the preview: the UNIQUE
    // (collection_id, product_id) constraint would abort the whole batch if the
    // same tea were added from the admin UI in between, taking the other adds
    // and the audit row down with it.
    .filter(pid => !have.has(pid))
    .map(pid => {
      pos += 1;
      return env.DB.prepare(
        'INSERT INTO collection_items (id, collection_id, product_id, position) VALUES (?, ?, ?, ?)'
      ).bind(newId('ci'), collectionId, pid, pos);
    });
  stmts.push(env.DB.prepare('UPDATE collections SET updated_at = ? WHERE id = ? AND account_id = ?')
    .bind(new Date().toISOString(), collectionId, ticket.accountId));
  stmts.push(auditStmt(env, 'COLLECTION_ITEMS_ADD_MCP', { products: ticket.productIds }, ticket, 'collection', collectionId, ticket.accountId));
  await env.DB.batch(stmts);

  return {
    committed: true, action: 'add_tea_to_collection',
    collection_id: collectionId, collection_title: collection.title,
    added: ticket.productIds, added_count: ticket.productIds.length,
  };
};

const removeTeaFromCollection: ToolHandler = async (env, auth, args) => {
  const collectionId = optionalText(args?.collection_id);
  if (!collectionId) return { error: 'collection_id_required' };
  const requested = readProductIds(args);
  if (requested.length === 0) return { error: 'product_id_or_product_ids_required' };
  const confirm = optionalText(args?.confirm);

  const collection = await loadCollection(env, auth.accountId, collectionId);
  if (!collection) return { error: 'collection_not_found' };
  if (!mayTouchCollection(auth, collection)) return { error: 'forbidden_not_your_collection' };

  // Removal resolves against what the collection actually holds, not against
  // the products table: a tea can be in a collection and archived, and the
  // point of removing it is usually that it is no longer sellable.
  const { results: present } = await env.DB.prepare(
    `SELECT ci.product_id, COALESCE(p.given_name, p.product_name) AS product_name
       FROM collection_items ci
       LEFT JOIN products p ON p.id = ci.product_id AND p.account_id = ?
      WHERE ci.collection_id = ?`
  ).bind(auth.accountId, collectionId).all() as { results: { product_id: string; product_name: string | null }[] };
  const byId = new Map((present ?? []).map(r => [r.product_id, r.product_name]));

  const toRemove = requested.filter(id => byId.has(id));
  const notPresent = requested.filter(id => !byId.has(id));

  if (!confirm) {
    const token = await issueTicket(env, {
      kind: 'curation:remove_tea_from_collection', accountId: auth.accountId, userEmail: auth.userEmail,
      collectionId, productIds: toRemove,
    }, auth.tokenId);
    return {
      preview: {
        action: 'remove_tea_from_collection',
        collection: { id: collectionId, title: collection.title, status: collection.status },
        will_remove: toRemove.map(id => ({ id, name: byId.get(id) ?? null })),
        not_in_collection: notPresent,
        remaining_after: Math.max(0, byId.size - toRemove.length),
        shop_effect: 'Removes the tea from this collection only. The product itself, its stock and its shop listing are untouched.',
      },
      confirmation_token: token,
      expires_in_seconds: PENDING_TTL_MS / 1000,
    };
  }

  const ticket = await consumeShared<Ticket, 'curation:remove_tea_from_collection'>(env, confirm, 'curation:remove_tea_from_collection', auth);
  if (!ticket || ticket.kind !== 'curation:remove_tea_from_collection' || ticket.collectionId !== collectionId) return BAD_TICKET;
  if (ticket.productIds.length === 0) {
    return { committed: true, action: 'remove_tea_from_collection', collection_id: collectionId, removed: [], removed_count: 0 };
  }

  const placeholders = ticket.productIds.map(() => '?').join(',');
  await env.DB.batch([
    env.DB.prepare(
      `DELETE FROM collection_items WHERE collection_id = ? AND product_id IN (${placeholders})`
    ).bind(collectionId, ...ticket.productIds),
    env.DB.prepare('UPDATE collections SET updated_at = ? WHERE id = ? AND account_id = ?')
      .bind(new Date().toISOString(), collectionId, ticket.accountId),
    auditStmt(env, 'COLLECTION_ITEMS_REMOVE_MCP', { products: ticket.productIds }, ticket, 'collection', collectionId, ticket.accountId),
  ]);

  const left = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM collection_items WHERE collection_id = ?'
  ).bind(collectionId).first() as { n: number } | null;

  return {
    committed: true, action: 'remove_tea_from_collection',
    collection_id: collectionId, collection_title: collection.title,
    removed: ticket.productIds, removed_count: ticket.productIds.length,
    items_remaining: Number(left?.n) || 0,
    // Deliberately NOT auto-unpublished when it empties. handleSetProductFeatured
    // does that for the system Featured strip because an empty strip is a hole in
    // the homepage; a hand-made collection emptied mid-edit is a work in progress,
    // and silently taking it off the shop would be a second decision nobody asked
    // for. unpublish_collection is one call away and says what it does.
    ...(Number(left?.n) === 0 ? { warning: 'This collection is now empty. If it is published to the shop it will show as an empty set until you unpublish_collection or add teas.' } : {}),
  };
};

const publishCollection: ToolHandler = async (env, auth, args) => {
  const collectionId = optionalText(args?.collection_id);
  if (!collectionId) return { error: 'collection_id_required' };
  const confirm = optionalText(args?.confirm);

  const collection = await loadCollection(env, auth.accountId, collectionId);
  if (!collection) return { error: 'collection_not_found' };
  if (!mayTouchCollection(auth, collection)) return { error: 'forbidden_not_your_collection' };

  const count = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM collection_items WHERE collection_id = ?'
  ).bind(collectionId).first() as { n: number } | null;
  // The same floor the REST route holds. An empty published collection is a
  // blank panel on the storefront that reads as a broken page.
  if ((Number(count?.n) || 0) === 0) return { error: 'collection_is_empty', message: 'Add at least one tea before publishing.' };

  const active = await env.DB.prepare(
    `SELECT id, slug, published_at FROM collection_publications
      WHERE collection_id = ? AND target_type = 'shop' AND unpublished_at IS NULL LIMIT 1`
  ).bind(collectionId).first() as { id: string; slug: string; published_at: string } | null;

  if (!confirm) {
    const token = await issueTicket(env, {
      kind: 'curation:publish_collection', accountId: auth.accountId, userId: auth.userId,
      userEmail: auth.userEmail, collectionId,
    }, auth.tokenId);
    return {
      preview: {
        action: 'publish_collection',
        collection: { id: collectionId, title: collection.title, status: collection.status },
        item_count: Number(count?.n) || 0,
        already_published: Boolean(active),
        existing_slug: active?.slug ?? null,
        shop_effect: 'Makes this collection and its teas visible to the public on the storefront (GET /api/collections/shop). A draft collection is promoted to active.',
      },
      confirmation_token: token,
      expires_in_seconds: PENDING_TTL_MS / 1000,
    };
  }

  const ticket = await consumeShared<Ticket, 'curation:publish_collection'>(env, confirm, 'curation:publish_collection', auth);
  if (!ticket || ticket.kind !== 'curation:publish_collection' || ticket.collectionId !== collectionId) return BAD_TICKET;

  // Idempotent, like the REST route: publishing twice is one publication, not
  // two rows racing to be the one the storefront reads.
  if (active) {
    return {
      committed: true, action: 'publish_collection', created: false,
      collection_id: collectionId, publication_id: active.id, slug: active.slug,
      published_at: active.published_at,
      note: 'Already published to the shop; nothing changed.',
    };
  }

  const slug = await reserveSlug(env, collection.title);
  if (!slug) return { error: 'slug_generation_failed' };

  const pubId = newId('pub');
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO collection_publications
         (id, collection_id, target_type, target_id, slug, recipients_json, created_by_user_id)
       VALUES (?, ?, 'shop', NULL, ?, NULL, ?)`
    ).bind(pubId, collectionId, slug, ticket.userId),
    // Promote draft -> active on first publish, and only from draft: an
    // archived collection being republished should not be silently revived.
    env.DB.prepare(
      `UPDATE collections SET status = CASE WHEN status = 'draft' THEN 'active' ELSE status END,
                              updated_at = ?
        WHERE id = ? AND account_id = ?`
    ).bind(new Date().toISOString(), collectionId, ticket.accountId),
    auditStmt(env, 'COLLECTION_PUBLISH_SHOP_MCP', { publication_id: pubId, slug, title: collection.title }, ticket, 'collection', collectionId, ticket.accountId),
  ]);

  return {
    committed: true, action: 'publish_collection', created: true,
    collection_id: collectionId, collection_title: collection.title,
    publication_id: pubId, slug,
    item_count: Number(count?.n) || 0,
  };
};

const unpublishCollection: ToolHandler = async (env, auth, args) => {
  const collectionId = optionalText(args?.collection_id);
  if (!collectionId) return { error: 'collection_id_required' };
  const confirm = optionalText(args?.confirm);

  const collection = await loadCollection(env, auth.accountId, collectionId);
  if (!collection) return { error: 'collection_not_found' };
  if (!mayTouchCollection(auth, collection)) return { error: 'forbidden_not_your_collection' };

  const active = await env.DB.prepare(
    `SELECT id, slug, published_at FROM collection_publications
      WHERE collection_id = ? AND target_type = 'shop' AND unpublished_at IS NULL LIMIT 1`
  ).bind(collectionId).first() as { id: string; slug: string; published_at: string } | null;
  if (!active) return { error: 'not_published_to_shop' };

  if (!confirm) {
    const token = await issueTicket(env, {
      kind: 'curation:unpublish_collection', accountId: auth.accountId,
      userEmail: auth.userEmail, collectionId,
    }, auth.tokenId);
    return {
      preview: {
        action: 'unpublish_collection',
        collection: { id: collectionId, title: collection.title },
        publication_id: active.id, slug: active.slug, published_at: active.published_at,
        shop_effect: 'Removes the collection from the public storefront. The collection, its teas and the publication record all survive — unpublishing stamps a date, it does not delete.',
      },
      confirmation_token: token,
      expires_in_seconds: PENDING_TTL_MS / 1000,
    };
  }

  const ticket = await consumeShared<Ticket, 'curation:unpublish_collection'>(env, confirm, 'curation:unpublish_collection', auth);
  if (!ticket || ticket.kind !== 'curation:unpublish_collection' || ticket.collectionId !== collectionId) return BAD_TICKET;

  const now = new Date().toISOString();
  await env.DB.batch([
    // Re-guarded on `unpublished_at IS NULL` so a confirm arriving after the
    // admin UI already unpublished cannot overwrite the earlier timestamp and
    // move the date the shop stopped showing it.
    env.DB.prepare(
      `UPDATE collection_publications SET unpublished_at = ?
        WHERE collection_id = ? AND target_type = 'shop' AND unpublished_at IS NULL`
    ).bind(now, collectionId),
    auditStmt(env, 'COLLECTION_UNPUBLISH_SHOP_MCP', { publication_id: active.id, slug: active.slug }, ticket, 'collection', collectionId, ticket.accountId),
  ]);

  return {
    committed: true, action: 'unpublish_collection',
    collection_id: collectionId, collection_title: collection.title,
    publication_id: active.id, unpublished_at: now,
  };
};

/* ══ B. Images ════════════════════════════════════════════════════════════ */

const setTeaImage: ToolHandler = async (env, auth, args) => {
  const productId = optionalText(args?.product_id);
  if (!productId) return { error: 'product_id_required' };
  const confirm = optionalText(args?.confirm);

  // `image_url: null` is how a photo is cleared, and it is the one case where
  // absence is a value: the caller named the field. A missing field is not the
  // same request and is refused, because "set the image" with no image is a
  // dropped argument, not an instruction to blank the product page.
  const clearing = args != null && 'image_url' in args && args.image_url === null;
  let imageUrl: string | null = null;
  if (!clearing) {
    const checked = readImageUrl(args?.image_url);
    if ('error' in checked) return { error: checked.error };
    imageUrl = checked.url;
  }

  const product = await resolveProduct(env, auth.accountId, productId);
  if ('error' in product) return { error: product.error, ...(product.candidates ? { candidates: product.candidates } : {}) };

  if (!confirm) {
    const token = await issueTicket(env, {
      kind: 'curation:set_tea_image', accountId: auth.accountId, userEmail: auth.userEmail,
      productId: product.id, imageUrl,
    }, auth.tokenId);
    return {
      preview: {
        action: 'set_tea_image',
        product: { id: product.id, name: productLabel(product) },
        current_image_url: product.image_url,
        new_image_url: imageUrl,
        clearing,
        note: 'This replaces the primary photo only. The extra photos in additional_images are untouched.',
      },
      confirmation_token: token,
      expires_in_seconds: PENDING_TTL_MS / 1000,
    };
  }

  const ticket = await consumeShared<Ticket, 'curation:set_tea_image'>(env, confirm, 'curation:set_tea_image', auth);
  if (!ticket || ticket.kind !== 'curation:set_tea_image' || ticket.productId !== product.id) return BAD_TICKET;

  await env.DB.batch([
    env.DB.prepare(
      "UPDATE products SET image_url = ?, updated_at = datetime('now') WHERE id = ? AND account_id = ?"
    ).bind(ticket.imageUrl, ticket.productId, ticket.accountId),
    profileImageMirror(env, ticket.productId, { image_url: ticket.imageUrl }),
    auditStmt(env, 'PRODUCT_IMAGE_SET_MCP', { image_url: ticket.imageUrl, previous: product.image_url }, ticket, 'product', ticket.productId, ticket.accountId),
  ]);

  return {
    committed: true, action: 'set_tea_image',
    product_id: ticket.productId, product: productLabel(product),
    image_url: ticket.imageUrl,
  };
};

const addTeaImages: ToolHandler = async (env, auth, args) => {
  const productId = optionalText(args?.product_id);
  if (!productId) return { error: 'product_id_required' };
  const confirm = optionalText(args?.confirm);

  const rawUrls: unknown[] = Array.isArray(args?.image_urls)
    ? args.image_urls
    : (args?.image_url != null ? [args.image_url] : []);
  if (rawUrls.length === 0) return { error: 'image_url_or_image_urls_required' };
  const incoming: string[] = [];
  for (const entry of rawUrls) {
    const checked = readImageUrl(entry);
    // One bad URL fails the whole call rather than being skipped. A partial
    // success here reads as a success, and the photo nobody noticed was dropped
    // is the one the operator thought they had added.
    if ('error' in checked) return { error: checked.error };
    if (!incoming.some(u => sameImage(u, checked.url))) incoming.push(checked.url);
  }

  const product = await resolveProduct(env, auth.accountId, productId);
  if ('error' in product) return { error: product.error, ...(product.candidates ? { candidates: product.candidates } : {}) };

  const parsed = parseImageArray(product.additional_images);
  if ('error' in parsed) {
    return {
      error: parsed.error,
      product_id: product.id,
      message: 'additional_images does not hold a readable JSON array, so adding to it would overwrite whatever is in there. Fix the column in the admin before adding photos.',
    };
  }
  const existingList = parsed.list;
  const toAdd = incoming.filter(url => !existingList.some(have => sameImage(have, url)));
  const nextList = [...existingList, ...toAdd];

  if (!confirm) {
    const token = await issueTicket(env, {
      kind: 'curation:add_tea_images', accountId: auth.accountId, userEmail: auth.userEmail,
      productId: product.id, imageUrls: toAdd, expectedRaw: product.additional_images,
    }, auth.tokenId);
    return {
      preview: {
        action: 'add_tea_images',
        product: { id: product.id, name: productLabel(product) },
        current_additional_images: existingList,
        will_add: toAdd,
        already_present: incoming.filter(url => !toAdd.includes(url)),
        resulting_additional_images: nextList,
      },
      confirmation_token: token,
      expires_in_seconds: PENDING_TTL_MS / 1000,
    };
  }

  const ticket = await consumeShared<Ticket, 'curation:add_tea_images'>(env, confirm, 'curation:add_tea_images', auth);
  if (!ticket || ticket.kind !== 'curation:add_tea_images' || ticket.productId !== product.id) return BAD_TICKET;

  // The column is read-modify-written, so a change between preview and confirm
  // would be overwritten by a list computed before it existed. Comparing the
  // raw text the preview saw is the cheapest honest guard: if anything moved,
  // refuse and make the caller look again rather than drop someone's photos.
  if ((ticket.expectedRaw ?? null) !== (product.additional_images ?? null)) {
    return {
      error: 'additional_images_changed_since_preview',
      message: 'Someone else edited this tea\'s photos while the confirmation was pending. Call add_tea_images again to see the current list.',
      current_additional_images: existingList,
    };
  }
  if (ticket.imageUrls.length === 0) {
    return { committed: true, action: 'add_tea_images', product_id: product.id, added: [], added_count: 0, additional_images: existingList };
  }

  const serialized = JSON.stringify(nextList);
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE products SET additional_images = ?, updated_at = datetime('now') WHERE id = ? AND account_id = ?"
    ).bind(serialized, ticket.productId, ticket.accountId),
    profileImageMirror(env, ticket.productId, { canonical_photos: serialized }),
    auditStmt(env, 'PRODUCT_IMAGES_ADD_MCP', { added: ticket.imageUrls, count: nextList.length }, ticket, 'product', ticket.productId, ticket.accountId),
  ]);

  return {
    committed: true, action: 'add_tea_images',
    product_id: ticket.productId, product: productLabel(product),
    added: ticket.imageUrls, added_count: ticket.imageUrls.length,
    additional_images: nextList,
  };
};

const removeTeaImage: ToolHandler = async (env, auth, args) => {
  const productId = optionalText(args?.product_id);
  if (!productId) return { error: 'product_id_required' };
  const target = optionalText(args?.image_url);
  if (!target) return { error: 'image_url_required' };
  const confirm = optionalText(args?.confirm);

  const product = await resolveProduct(env, auth.accountId, productId);
  if ('error' in product) return { error: product.error, ...(product.candidates ? { candidates: product.candidates } : {}) };

  const parsed = parseImageArray(product.additional_images);
  if ('error' in parsed) {
    return {
      error: parsed.error,
      product_id: product.id,
      message: 'additional_images does not hold a readable JSON array, so removing one entry would rewrite the column from a guess. Fix it in the admin first.',
    };
  }
  const existingList = parsed.list;
  const nextList = existingList.filter(url => !sameImage(url, target));
  if (nextList.length === existingList.length) {
    return {
      error: 'image_not_in_additional_images',
      product_id: product.id,
      additional_images: existingList,
      // Said out loud because the primary photo and the extras look identical
      // on a product page, and the natural next move is to try harder here
      // rather than reach for the right tool.
      hint: product.image_url && sameImage(product.image_url, target)
        ? 'That is the tea\'s PRIMARY photo. Clear it with set_tea_image and image_url set to null.'
        : undefined,
    };
  }

  if (!confirm) {
    const token = await issueTicket(env, {
      kind: 'curation:remove_tea_image', accountId: auth.accountId, userEmail: auth.userEmail,
      productId: product.id, imageUrl: target, expectedRaw: product.additional_images,
    }, auth.tokenId);
    return {
      preview: {
        action: 'remove_tea_image',
        product: { id: product.id, name: productLabel(product) },
        current_additional_images: existingList,
        will_remove: target,
        resulting_additional_images: nextList,
        note: 'The file itself is left in storage. This only stops the product page showing it.',
      },
      confirmation_token: token,
      expires_in_seconds: PENDING_TTL_MS / 1000,
    };
  }

  const ticket = await consumeShared<Ticket, 'curation:remove_tea_image'>(env, confirm, 'curation:remove_tea_image', auth);
  if (!ticket || ticket.kind !== 'curation:remove_tea_image' || ticket.productId !== product.id) return BAD_TICKET;
  if ((ticket.expectedRaw ?? null) !== (product.additional_images ?? null)) {
    return {
      error: 'additional_images_changed_since_preview',
      message: 'Someone else edited this tea\'s photos while the confirmation was pending. Call remove_tea_image again to see the current list.',
      current_additional_images: existingList,
    };
  }

  const serialized = JSON.stringify(nextList);
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE products SET additional_images = ?, updated_at = datetime('now') WHERE id = ? AND account_id = ?"
    ).bind(serialized, ticket.productId, ticket.accountId),
    profileImageMirror(env, ticket.productId, { canonical_photos: serialized }),
    auditStmt(env, 'PRODUCT_IMAGE_REMOVE_MCP', { removed: ticket.imageUrl, count: nextList.length }, ticket, 'product', ticket.productId, ticket.accountId),
  ]);

  return {
    committed: true, action: 'remove_tea_image',
    product_id: ticket.productId, product: productLabel(product),
    removed: ticket.imageUrl,
    additional_images: nextList,
  };
};

/* ── definitions ─────────────────────────────────────────────────────────── */

const CONFIRM_ARG = { type: 'string', description: 'Confirmation token from the preview response. Omit on the first call.' };

const defs: ToolDefinition[] = [
  {
    name: 'list_collections',
    scope: 'inventory:read',
    description: 'List this shop\'s collections — the curated sets of teas the storefront shows. Each row says how many teas it holds and whether it is published to the shop (published_to_shop=true means it is live to the public). The row with is_featured_collection=true is the shop\'s Featured strip. Pass collection_id to get that collection\'s teas with their product ids, which is what remove_tea_from_collection needs. Read-only.',
    inputSchema: {
      type: 'object',
      properties: {
        collection_id: { type: 'string', description: 'Optional. Limit to one collection and include its teas.' },
        status: { type: 'string', enum: ['draft', 'active', 'archived'], description: 'Optional. Filter by collection status.' },
        product_id: { type: 'string', description: 'Optional. Only collections that contain this tea — answers "where does this tea appear?".' },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: 'create_collection',
    scope: 'catalog:write',
    description: 'Create a new collection: a named set of teas that can then be published to the shop. Created as a draft and invisible to the public until publish_collection. Optionally seed it with teas. Two-step preview/confirm.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'The collection\'s name, as it will read on the storefront.' },
        note: { type: 'string', description: 'Optional. A line of context shown with the collection.' },
        hero_image_url: { type: 'string', description: 'Optional. https:// URL for the collection\'s header image.' },
        initial_product_ids: { type: 'array', items: { type: 'string' }, description: 'Optional. Product ids from search_tea to seed the collection with.' },
        confirm: CONFIRM_ARG,
      },
      required: ['title'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: 'add_tea_to_collection',
    scope: 'catalog:write',
    description: 'Add one or more teas to a collection. Teas already in it are reported and skipped, never duplicated. If the collection is the shop\'s Featured strip, this is what makes a tea featured. Two-step preview/confirm.',
    inputSchema: {
      type: 'object',
      properties: {
        collection_id: { type: 'string', description: 'Collection id from list_collections.' },
        product_ids: { type: 'array', items: { type: 'string' }, description: 'Product ids from search_tea. Use this or product_id.' },
        product_id: { type: 'string', description: 'A single product id, for the common case.' },
        confirm: CONFIRM_ARG,
      },
      required: ['collection_id'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'remove_tea_from_collection',
    scope: 'catalog:write',
    description: 'Remove one or more teas from a collection. The products themselves, their stock and their shop listings are untouched — only their membership of this set changes. Two-step preview/confirm.',
    inputSchema: {
      type: 'object',
      properties: {
        collection_id: { type: 'string', description: 'Collection id from list_collections.' },
        product_ids: { type: 'array', items: { type: 'string' }, description: 'Product ids to remove. Use this or product_id.' },
        product_id: { type: 'string', description: 'A single product id, for the common case.' },
        confirm: CONFIRM_ARG,
      },
      required: ['collection_id'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'publish_collection',
    scope: 'catalog:write',
    description: 'Publish a collection to the public storefront (target_type=shop). This is what makes its teas visible to shoppers. Requires at least one tea. A draft collection is promoted to active. Publishing an already-published collection changes nothing. Two-step preview/confirm.',
    inputSchema: {
      type: 'object',
      properties: {
        collection_id: { type: 'string', description: 'Collection id from list_collections.' },
        confirm: CONFIRM_ARG,
      },
      required: ['collection_id'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'unpublish_collection',
    scope: 'catalog:write',
    description: 'Take a collection off the public storefront. The collection, its teas and the record of when it was shown all survive; only its public visibility ends. Two-step preview/confirm.',
    inputSchema: {
      type: 'object',
      properties: {
        collection_id: { type: 'string', description: 'Collection id from list_collections.' },
        confirm: CONFIRM_ARG,
      },
      required: ['collection_id'],
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'set_tea_image',
    scope: 'catalog:write',
    description: 'Set a tea\'s primary photo — the one the shop and every listing shows. Takes a URL that is already hosted (upload the file first via the admin, then pass the returned https://media.teajia.co/... URL). Pass image_url as null to clear the photo. The extra photos are untouched. Two-step preview/confirm.',
    inputSchema: {
      type: 'object',
      properties: {
        product_id: { type: 'string', description: 'Product id from search_tea/get_tea.' },
        image_url: { type: ['string', 'null'], description: 'https:// or root-relative URL of the photo. null clears the primary photo.' },
        confirm: CONFIRM_ARG,
      },
      required: ['product_id', 'image_url'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'add_tea_images',
    scope: 'catalog:write',
    description: 'Add extra photos to a tea, appended after the ones it already has. URLs only, already hosted. Photos the tea already has are reported and skipped. Never replaces the existing set. Two-step preview/confirm.',
    inputSchema: {
      type: 'object',
      properties: {
        product_id: { type: 'string', description: 'Product id from search_tea/get_tea.' },
        image_urls: { type: 'array', items: { type: 'string' }, description: 'https:// or root-relative photo URLs to append. Use this or image_url.' },
        image_url: { type: 'string', description: 'A single photo URL, for the common case.' },
        confirm: CONFIRM_ARG,
      },
      required: ['product_id'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'remove_tea_image',
    scope: 'catalog:write',
    description: 'Remove one extra photo from a tea by its URL. Matches on the URL ignoring any ?v= cache-buster. To clear the PRIMARY photo use set_tea_image with image_url null instead. The file is left in storage. Two-step preview/confirm.',
    inputSchema: {
      type: 'object',
      properties: {
        product_id: { type: 'string', description: 'Product id from search_tea/get_tea.' },
        image_url: { type: 'string', description: 'The photo URL to remove, as shown by list_collections/get_tea.' },
        confirm: CONFIRM_ARG,
      },
      required: ['product_id', 'image_url'],
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  },
];

const handlers: Record<string, ToolHandler> = {
  list_collections: listCollections,
  create_collection: createCollection,
  add_tea_to_collection: addTeaToCollection,
  remove_tea_from_collection: removeTeaFromCollection,
  publish_collection: publishCollection,
  unpublish_collection: unpublishCollection,
  set_tea_image: setTeaImage,
  add_tea_images: addTeaImages,
  remove_tea_image: removeTeaImage,
};

export const curationTools: ToolModule = {
  area: 'curation (collections + images)',
  defs,
  handlers,
};

// Exported for the tests, which exercise the two places absence and a silent
// drop can cost real photos without anything failing.
export const __testables = { parseImageArray, sameImage, readImageUrl, optionalText, readProductIds };
