import type { ToolAuth, ToolDefinition, ToolEnv, ToolHandler, ToolModule } from './registry';
import { INVALID_TICKET, PENDING_TTL_MS, consumeTicket as consumeShared, issueTicket } from './tickets';
import { isWordforgeManagedArticle } from '../wordforgeArticleDraft';
import { buildEventArticleDraft } from '../eventArticleDraft';

/**
 * The journal, and the sample shelf: the two things Adrian works on that an
 * agent could not touch at all.
 *
 * Everything the MCP server could reach before this was stock, money and
 * people. His writing — the articles the shop publishes under his name — had
 * an admin screen and nothing else, so a session could describe an edit and
 * never make one. Same for the sample sets: the sourcing shelf was readable in
 * the UI and invisible to a session that was asked "what am I still waiting to
 * taste".
 *
 * ── Scope, and why these ────────────────────────────────────────────────────
 *
 * There is no `content:*` or `articles:*` scope. The list is `MCP_SCOPES` in
 * mcp.ts and it is a token-minting contract: every token already issued was
 * minted against that list, and a scope added there is a scope no existing
 * token holds. So these tools borrow the nearest existing ones rather than
 * inventing a ninth:
 *
 *   - Reads take `inventory:read`. It is already the general "read the shop's
 *     own material" scope — it is what `get_account_context` and `search_tea`
 *     carry — and every write scope implies it, so no token needs regranting.
 *   - Article writes take `catalog:write`, which is owner-tier. That is the
 *     scope that already governs what the public is told about the shop's
 *     material (`update_tea_pricing`, `set_tasting`, `set_archive_status`).
 *     Publishing a journal piece is that act exactly, and it happens under
 *     Adrian's byline, so an operator token must not be able to do it.
 *   - Sample status takes `stock:write`, operator-tier. Moving a sample from
 *     received to tasted is shelf work of the same kind as `add_stock`, and
 *     the person doing the tasting is not always the owner.
 *
 * If a `content:write` scope is ever added, these move to it; nothing here
 * depends on the borrowed names beyond the two lines that declare them.
 *
 * ── What this module needs from mcp.ts and could not do from here ───────────
 *
 * A tool module cannot edit mcp.ts, and three things live there that these
 * tools would otherwise carry themselves. Each is a real gap, not a nicety:
 *
 *   1. `annotationsFor()` builds every tool's annotations from the
 *      READ_ONLY_TOOLS / DESTRUCTIVE_TOOLS / IDEMPOTENT_TOOLS sets in mcp.ts,
 *      and `visibleToolDefs()` overwrites whatever a definition carries. So
 *      `list_articles` currently advertises `readOnlyHint: false`. Deliberately
 *      no `annotations` are set on the definitions below: a field that is
 *      silently discarded reads as live and is worse than an absent one. The
 *      fix is either adding these names to those sets or having
 *      `annotationsFor` defer to a definition's own annotations.
 *   2. `AUDITED_TOOLS` in mcp.ts decides what lands in `activity_logs`, so the
 *      confirmed writes below are not audited by that path. Each commit here
 *      writes its own `activity_logs` row instead, the way
 *      `commitSetArchiveStatus` does, so the history exists either way — but
 *      the MCP_TOOL_CALL envelope does not.
 *   3. `slugify()` and the article JSON parsing live in index.ts, which is the
 *      worker entrypoint and imports mcp.ts, so importing it from here is a
 *      cycle. They are reproduced below, marked, and should be hoisted into a
 *      shared module so the copies cannot drift.
 */

/* ────────────────────────────── confirmation tickets ─────────────────────── */

/**
 * The mechanism lives in `./tickets`, shared with the other tool modules. What
 * belongs here is only the payload.
 *
 * Kinds are namespaced `writing.*` because `mcp_confirmation_tickets` holds
 * every tool's tickets in one table, and consuming one is destructive. A model
 * that hands a `set_sample_status` token to `set_article_published` must be
 * refused before the row is claimed, not after — `consumeTicket` puts `kind`
 * and `account_id` in the WHERE for exactly that reason, and a namespaced kind
 * is what makes the match unambiguous.
 */
type WritingMutation =
  | {
      kind: 'writing.create_article_draft';
      accountId: string; userEmail: string; authorId: string;
      title: string; subtitle: string | null; slug: string; category: string | null;
      tags: string[]; coverImageUrl: string | null; pullQuote: string | null;
      layoutTemplate: string | null; readingTimeMins: number | null;
      blocks: Array<Record<string, unknown>>;
    }
  | {
      kind: 'writing.update_article_draft';
      accountId: string; userEmail: string; articleId: string;
      /** Only columns the caller actually named. A column absent here is untouched. */
      fields: Record<string, string | number | null>;
    }
  | {
      kind: 'writing.set_article_published';
      accountId: string; userEmail: string; articleId: string;
      published: boolean; publishedAt: string | null;
    }
  | {
      kind: 'writing.draft_article_from_event';
      accountId: string; userEmail: string; authorId: string; eventId: string;
    }
  | {
      kind: 'writing.set_sample_status';
      accountId: string; userEmail: string; sampleId: string;
      status: SampleStatus; previousStatus: string;
    };


/* ────────────────────────────── argument reading ─────────────────────────── */

/**
 * Absence, emptiness and zero are three different answers and this file keeps
 * them apart, for the reason `enteredNumber()` exists in the admin: JavaScript
 * makes conflating them the path of least resistance, and the conflation is
 * invisible once stored. Here the field that matters is prose rather than
 * money, and the failure is quieter but the same shape — a title silently
 * cleared to '' is a published article with no name.
 *
 *   - key absent      → leave the column alone
 *   - key present, null → clear the column (only where the column is nullable)
 *   - key present, ''   → refused. An empty string is not a value, and it is
 *                         far more often a client bug than an intent to clear.
 */
type Entered = { present: false } | { present: true; value: string | null };

function enteredText(args: any, key: string, max: number): Entered {
  if (!args || !(key in args) || args[key] === undefined) return { present: false };
  const raw = args[key];
  if (raw === null) return { present: true, value: null };
  if (typeof raw !== 'string') throw new Error(`${key} must be a string`);
  const trimmed = raw.trim();
  if (!trimmed) throw new Error(`${key} was given as an empty string. Pass null to clear it, or omit it to leave it alone.`);
  if (trimmed.length > max) throw new Error(`${key} exceeds ${max} characters`);
  return { present: true, value: trimmed };
}

function requiredText(args: any, key: string, max: number): string {
  const entered = enteredText(args, key, max);
  if (!entered.present || entered.value === null) throw new Error(`${key} is required`);
  return entered.value;
}

function enteredCount(args: any, key: string, max: number): Entered | { present: true; value: number } {
  if (!args || !(key in args) || args[key] === undefined) return { present: false };
  if (args[key] === null) return { present: true, value: null };
  const n = Number(args[key]);
  if (!Number.isFinite(n) || n < 0 || n > max) throw new Error(`${key} must be a number between 0 and ${max}`);
  return { present: true, value: Math.round(n) };
}

function optionalTags(args: any): string[] | null {
  if (!args || args.tags === undefined || args.tags === null) return null;
  if (!Array.isArray(args.tags)) throw new Error('tags must be an array of strings');
  if (args.tags.length > 20) throw new Error('tags accepts at most 20 entries');
  return args.tags.map((tag: unknown, i: number) => {
    if (typeof tag !== 'string' || !tag.trim()) throw new Error(`tags[${i}] must be a non-empty string`);
    if (tag.length > 64) throw new Error(`tags[${i}] exceeds 64 characters`);
    return tag.trim();
  });
}

function clampLimit(value: unknown, fallback: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}

/* ────────────────────────────── article helpers ──────────────────────────── */

/**
 * Verbatim copy of `slugify` in index.ts. Copied rather than shared because
 * index.ts is the worker entrypoint and importing it from a module mcp.ts
 * imports would be a cycle. It should be hoisted so these two cannot drift:
 * a slug is the article's public address, and two functions producing
 * different ones for the same title is a link that works from one door only.
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * `idx_articles_slug` is UNIQUE over the whole table, not per account — it
 * predates multi-tenancy like the `account_id` default does. So a slug can
 * collide with another shop's article, and the INSERT then dies on a
 * constraint the caller cannot see or fix. Resolve it here instead: the
 * existence probe reads nothing but the slug itself, which the caller supplied.
 */
async function availableSlug(env: ToolEnv, desired: string): Promise<string> {
  const base = desired || 'article';
  for (let attempt = 0; attempt < 25; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const taken = await env.DB.prepare('SELECT 1 AS taken FROM articles WHERE slug = ?').bind(candidate).first();
    if (!taken) return candidate;
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

function parseJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  try { return value ? JSON.parse(String(value)) : []; } catch { return []; }
}

/** Mirrors `articleToApi` in index.ts so both doors describe an article the same way. */
function articleToApi(row: Record<string, any>) {
  return {
    ...row,
    tags: parseJsonArray(row.tags),
    blocks: parseJsonArray(row.blocks),
    subject_ids: parseJsonArray(row.subject_ids),
  };
}

/** First readable sentence of a piece, for a list that has to be skimmed aloud. */
function articlePreview(blocks: unknown[]): string | null {
  for (const block of blocks) {
    const text = (block as any)?.text;
    if (typeof text === 'string' && text.trim()) return text.trim().slice(0, 160);
  }
  return null;
}

/**
 * The narrow authoring vocabulary an agent may write in.
 *
 * The renderer accepts far more (covers, Q&A pairs, image strips, pull
 * sidebars, back matter) and `decodeWordforgeDraft` is its validator, but that
 * validator is whole-payload and WordForge-shaped: it insists on
 * `source.system === 'wordforge'`, and its per-block half is not exported. A
 * second, laxer block validator living here is the four-freight-rates shape —
 * two doors onto one column with different rules — so this door is deliberately
 * the small one. Four text blocks, composed into the same shapes the renderer's
 * own validator accepts. Anything richer belongs in the admin editor or comes
 * in through the WordForge integration, which already has a validator.
 */
const BODY_BLOCK_TYPES = ['intro', 'paragraph', 'section_heading', 'quote'] as const;
type BodyBlockType = typeof BODY_BLOCK_TYPES[number];

/**
 * 600 characters is not an arbitrary cap. `MagazinePageReader` paginates body
 * text at 600 chars a page and the pages do not scroll, so a longer block does
 * not overflow gracefully — it renders text nobody can reach. The WordForge
 * validator enforces the same number on the same block types.
 */
const BLOCK_TEXT_MAX = 600;

function decodeBody(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('body must be a non-empty array of { type, text } blocks');
  }
  // 120 blocks is the renderer's ceiling and the cover takes one of them.
  if (value.length > 119) throw new Error('body accepts at most 119 blocks');
  return value.map((raw, i) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`body[${i}] must be an object`);
    const block = raw as Record<string, unknown>;
    const type = block.type;
    if (typeof type !== 'string' || !BODY_BLOCK_TYPES.includes(type as BodyBlockType)) {
      throw new Error(`body[${i}].type must be one of: ${BODY_BLOCK_TYPES.join(', ')}`);
    }
    const text = block.text;
    if (typeof text !== 'string' || !text.trim()) throw new Error(`body[${i}].text must be a non-empty string`);
    if (text.length > BLOCK_TEXT_MAX) {
      throw new Error(`body[${i}].text exceeds ${BLOCK_TEXT_MAX} characters. The reader does not scroll a page, so split it into another block.`);
    }
    return { type, text: text.trim() };
  });
}

function coverBlock(title: string, subtitle: string | null, image: string | null): Record<string, unknown> {
  return {
    type: 'cover',
    title,
    ...(subtitle ? { subtitle } : {}),
    ...(image ? { image } : {}),
  };
}

/** Columns `update_article_draft` may set, and the ones WordForge owns outright. */
const ARTICLE_UPDATABLE = new Set([
  'title', 'subtitle', 'slug', 'category', 'tags', 'cover_image_url',
  'blocks', 'layout_template', 'reading_time_mins', 'pull_quote',
]);
/**
 * Mirrors WORDFORGE_PROTECTED_ARTICLE_FIELDS in index.ts. A WordForge-managed
 * article's prose is written by a revisioned upstream; editing it here would be
 * overwritten by the next sync without anyone being told, so it is refused the
 * same way the HTTP route refuses it.
 */
const WORDFORGE_PROTECTED = new Set(['title', 'subtitle', 'slug', 'category', 'tags', 'blocks']);

async function loadArticle(env: ToolEnv, accountId: string, articleId: string) {
  return await env.DB.prepare(
    'SELECT * FROM articles WHERE id = ? AND account_id = ?'
  ).bind(articleId, accountId).first() as Record<string, any> | null;
}

async function logWriting(
  env: ToolEnv, accountId: string, userEmail: string,
  action: string, detail: string, entityType: string, entityId: string,
) {
  await env.DB.prepare(
    `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(crypto.randomUUID(), action, detail, userEmail, entityType, entityId, accountId).run();
}

/* ────────────────────────────── article tools ────────────────────────────── */

const toolListArticles: ToolHandler = async (env, auth, args) => {
  const status = args?.status ? String(args.status) : 'active';
  if (!['all', 'active', 'draft', 'published', 'archived'].includes(status)) {
    return { error: 'invalid_status_filter', accepted: ['all', 'active', 'draft', 'published', 'archived'] };
  }
  const limit = clampLimit(args?.limit, 20, 100);
  const query = args?.query ? String(args.query).trim().toLowerCase() : '';

  // 'active' is the admin list's own default: everything that is not archived.
  // 'all' includes archived, because "where did that piece go" is a real question.
  const where = ['a.account_id = ?'];
  const binds: unknown[] = [auth.accountId];
  if (status === 'active') where.push("a.status != 'archived'");
  else if (status !== 'all') { where.push('a.status = ?'); binds.push(status); }
  if (query) {
    where.push('(lower(a.title) LIKE ? OR lower(a.slug) LIKE ? OR lower(COALESCE(a.subtitle, \'\')) LIKE ?)');
    binds.push(`%${query}%`, `%${query}%`, `%${query}%`);
  }

  const rows = await env.DB.prepare(
    `SELECT a.id, a.title, a.subtitle, a.slug, a.status, a.category, a.tags, a.blocks,
            a.cover_image_url, a.reading_time_mins, a.published_at, a.source_event_id,
            a.created_at, a.updated_at,
            (SELECT 1 FROM article_external_sources x
              WHERE x.account_id = a.account_id AND x.article_id = a.id AND x.source_system = 'wordforge')
              AS wordforge_managed
       FROM articles a
      WHERE ${where.join(' AND ')}
      ORDER BY a.updated_at DESC
      LIMIT ?`
  ).bind(...binds, limit).all() as { results: Record<string, any>[] };

  return {
    count: rows.results.length,
    articles: rows.results.map(row => ({
      id: row.id,
      title: row.title,
      subtitle: row.subtitle,
      slug: row.slug,
      status: row.status,
      category: row.category,
      tags: parseJsonArray(row.tags),
      preview: articlePreview(parseJsonArray(row.blocks)),
      cover_image_url: row.cover_image_url,
      reading_time_mins: row.reading_time_mins,
      published_at: row.published_at,
      from_event_id: row.source_event_id,
      // Prose on a managed article is written upstream; update_article_draft
      // will refuse it, so say so here rather than at the point of failure.
      wordforge_managed: !!row.wordforge_managed,
      created_at: row.created_at,
      updated_at: row.updated_at,
    })),
  };
};

const toolGetArticle: ToolHandler = async (env, auth, args) => {
  const articleId = args?.article_id ? String(args.article_id).trim() : '';
  const slug = args?.slug ? String(args.slug).trim() : '';
  if (!articleId && !slug) throw new Error('article_id or slug is required');

  const row = articleId
    ? await loadArticle(env, auth.accountId, articleId)
    : await env.DB.prepare('SELECT * FROM articles WHERE slug = ? AND account_id = ?')
        .bind(slug, auth.accountId).first() as Record<string, any> | null;
  if (!row) return { error: 'not_found' };

  return {
    article: articleToApi(row),
    wordforge_managed: await isWordforgeManagedArticle(env.DB, auth.accountId, row.id),
  };
};

const toolCreateArticleDraft: ToolHandler = async (env, auth, args) => {
  const confirm = args?.confirm ? String(args.confirm) : null;

  if (!confirm) {
    const title = requiredText(args, 'title', 200);
    const subtitleArg = enteredText(args, 'subtitle', 300);
    const subtitle = subtitleArg.present ? subtitleArg.value : null;
    const coverArg = enteredText(args, 'cover_image_url', 2048);
    const coverImageUrl = coverArg.present ? coverArg.value : null;
    const categoryArg = enteredText(args, 'category', 100);
    const pullQuoteArg = enteredText(args, 'pull_quote', 600);
    const slugArg = enteredText(args, 'slug', 120);
    const readingTime = enteredCount(args, 'reading_time_mins', 600);
    const tags = optionalTags(args) ?? [];
    const body = decodeBody(args?.body);

    const desired = slugArg.present && slugArg.value ? slugify(slugArg.value) : slugify(title);
    const slug = await availableSlug(env, desired);

    const token = await issueTicket(env, {
      kind: 'writing.create_article_draft',
      accountId: auth.accountId, userEmail: auth.userEmail,
      // The event-draft route stamps the acting user's id as author_id, and the
      // list query resolves author_id against users OR contributors, so this is
      // an established value. A caller-supplied author_id is deliberately not
      // accepted: contributor ids are validated against this account by
      // validateArticleContributors() in index.ts, and a second, laxer check
      // living here is how a piece gets published under the wrong name.
      authorId: auth.userId,
      title, subtitle, slug,
      category: categoryArg.present ? categoryArg.value : null,
      tags,
      coverImageUrl,
      pullQuote: pullQuoteArg.present ? pullQuoteArg.value : null,
      layoutTemplate: 'immersive_scroll',
      readingTimeMins: readingTime.present ? (readingTime.value as number | null) : null,
      blocks: [coverBlock(title, subtitle, coverImageUrl), ...body],
    }, auth.tokenId);

    return {
      preview: {
        action: 'create_article_draft',
        title, subtitle, slug, category: categoryArg.present ? categoryArg.value : null,
        tags,
        block_count: body.length + 1,
        first_lines: articlePreview(body),
        status_after: 'draft',
        note: 'Created as a draft. Nothing is public until set_article_published.',
      },
      confirmation_token: token,
      expires_in_seconds: PENDING_TTL_MS / 1000,
    };
  }

  const m = await consumeShared<WritingMutation, 'writing.create_article_draft'>(env, confirm, 'writing.create_article_draft', auth);
  if (!m) return INVALID_TICKET;

  const id = crypto.randomUUID();
  // The slug was checked at preview time and five minutes have passed since.
  // Re-check it: the unique index is global, so a collision claimed in the
  // meantime would abort the INSERT with a constraint error the caller can
  // neither read nor act on.
  const slug = await availableSlug(env, m.slug);
  // account_id is named explicitly. The column carries
  // `DEFAULT 'acc_teajia_bali'` from before the platform was multi-tenant, so
  // an INSERT that omits it is perfectly valid and silently files the article
  // in one particular shop. There is a test for exactly this
  // (schema-defaults-are-decisions).
  await env.DB.prepare(
    `INSERT INTO articles (id, account_id, title, subtitle, author_id, slug, status, category, tags,
                           cover_image_url, blocks, layout_template, reading_time_mins, pull_quote)
     VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, m.accountId, m.title, m.subtitle, m.authorId, slug, m.category,
    JSON.stringify(m.tags), m.coverImageUrl, JSON.stringify(m.blocks),
    m.layoutTemplate, m.readingTimeMins, m.pullQuote,
  ).run();

  await logWriting(env, m.accountId, m.userEmail, 'ARTICLE_DRAFT_CREATED_MCP',
    `Article draft "${m.title}" created via MCP`, 'article', id);

  const created = await loadArticle(env, m.accountId, id);
  return { committed: true, action: 'create_article_draft', article: created ? articleToApi(created) : { id } };
};

const toolUpdateArticleDraft: ToolHandler = async (env, auth, args) => {
  const articleId = String(args?.article_id || '').trim();
  const confirm = args?.confirm ? String(args.confirm) : null;
  if (!articleId) throw new Error('article_id is required');

  const existing = await loadArticle(env, auth.accountId, articleId);
  if (!existing) return { error: 'not_found' };

  if (!confirm) {
    const fields: Record<string, string | number | null> = {};

    const title = enteredText(args, 'title', 200);
    if (title.present) {
      if (title.value === null) throw new Error('title cannot be cleared — an article without a title has no name anywhere it appears');
      fields.title = title.value;
    }
    const subtitle = enteredText(args, 'subtitle', 300);
    if (subtitle.present) fields.subtitle = subtitle.value;
    const category = enteredText(args, 'category', 100);
    if (category.present) fields.category = category.value;
    const cover = enteredText(args, 'cover_image_url', 2048);
    if (cover.present) fields.cover_image_url = cover.value;
    const pullQuote = enteredText(args, 'pull_quote', 600);
    if (pullQuote.present) fields.pull_quote = pullQuote.value;
    const readingTime = enteredCount(args, 'reading_time_mins', 600);
    if (readingTime.present) fields.reading_time_mins = readingTime.value as number | null;
    const slugArg = enteredText(args, 'slug', 120);
    if (slugArg.present) {
      if (slugArg.value === null) throw new Error('slug cannot be cleared — it is the article\'s public address');
      const desired = slugify(slugArg.value);
      fields.slug = desired === existing.slug ? desired : await availableSlug(env, desired);
    }
    const tags = optionalTags(args);
    if (tags) fields.tags = JSON.stringify(tags);

    if (args?.body !== undefined) {
      // Rewriting the body replaces every block, cover included, because the
      // cover carries the title and a body edit that left a stale cover behind
      // would publish two different titles on one piece.
      const body = decodeBody(args.body);
      const nextTitle = (fields.title as string | undefined) ?? existing.title;
      const nextSubtitle = 'subtitle' in fields ? (fields.subtitle as string | null) : (existing.subtitle ?? null);
      const nextCover = 'cover_image_url' in fields ? (fields.cover_image_url as string | null) : (existing.cover_image_url ?? null);
      fields.blocks = JSON.stringify([coverBlock(nextTitle, nextSubtitle, nextCover), ...body]);
    }

    const named = Object.keys(fields);
    if (named.length === 0) {
      throw new Error('Name at least one of: title, subtitle, slug, category, tags, cover_image_url, pull_quote, reading_time_mins, body');
    }
    if (named.some(field => WORDFORGE_PROTECTED.has(field))
      && await isWordforgeManagedArticle(env.DB, auth.accountId, articleId)) {
      return {
        error: 'externally_managed_article',
        detail: 'This article\'s prose is written in WordForge and re-synced from there. An edit made here would be overwritten without notice.',
      };
    }

    const token = await issueTicket(env, {
      kind: 'writing.update_article_draft',
      accountId: auth.accountId, userEmail: auth.userEmail, articleId, fields,
    }, auth.tokenId);

    return {
      preview: {
        action: 'update_article_draft',
        article: { id: articleId, title: existing.title, slug: existing.slug, status: existing.status },
        changing: named,
        // Editing a published piece changes what is live the moment it commits.
        // The admin route allows it; the caller should know which it is doing.
        live_now: existing.status === 'published',
      },
      confirmation_token: token,
      expires_in_seconds: PENDING_TTL_MS / 1000,
    };
  }

  const m = await consumeShared<WritingMutation, 'writing.update_article_draft'>(env, confirm, 'writing.update_article_draft', auth);
  if (!m || m.articleId !== articleId) return INVALID_TICKET;

  const cols = Object.keys(m.fields).filter(c => ARTICLE_UPDATABLE.has(c));
  if (cols.length === 0) return INVALID_TICKET;
  // Re-checked at commit, not only at preview: the WordForge integration could
  // have taken this article over during the five minutes the ticket was open,
  // and the whole point of the refusal is that the next sync silently discards
  // whatever was written here.
  if (cols.some(field => WORDFORGE_PROTECTED.has(field))
    && await isWordforgeManagedArticle(env.DB, m.accountId, m.articleId)) {
    return { error: 'externally_managed_article' };
  }
  await env.DB.prepare(
    `UPDATE articles SET ${cols.map(c => `${c} = ?`).join(', ')}, updated_at = datetime('now')
      WHERE id = ? AND account_id = ?`
  ).bind(...cols.map(c => m.fields[c]), m.articleId, m.accountId).run();

  await logWriting(env, m.accountId, m.userEmail, 'ARTICLE_UPDATED_MCP',
    `Article updated via MCP: ${cols.join(', ')}`, 'article', m.articleId);

  const updated = await loadArticle(env, m.accountId, m.articleId);
  return { committed: true, action: 'update_article_draft', changed: cols, article: updated ? articleToApi(updated) : null };
};

const toolSetArticlePublished: ToolHandler = async (env, auth, args) => {
  const articleId = String(args?.article_id || '').trim();
  if (!articleId) throw new Error('article_id is required');
  if (typeof args?.published !== 'boolean') throw new Error('published must be true or false');
  const published = args.published as boolean;
  const confirm = args?.confirm ? String(args.confirm) : null;

  const existing = await loadArticle(env, auth.accountId, articleId);
  if (!existing) return { error: 'not_found' };

  if (!confirm) {
    // Re-publishing keeps the original date. A piece that was public in March
    // and is corrected in September is still a March piece, and the journal
    // orders by published_at — moving it would silently reorder the archive.
    const publishedAt = published ? (existing.published_at || new Date().toISOString()) : null;
    const token = await issueTicket(env, {
      kind: 'writing.set_article_published',
      accountId: auth.accountId, userEmail: auth.userEmail, articleId, published, publishedAt,
    }, auth.tokenId);

    return {
      preview: {
        action: 'set_article_published',
        article: { id: articleId, title: existing.title, slug: existing.slug },
        current_status: existing.status,
        new_status: published ? 'published' : 'draft',
        already_in_target_state: existing.status === (published ? 'published' : 'draft'),
        published_at: published ? publishedAt : existing.published_at,
        public_effect: published
          ? 'The article becomes readable at /journal and is served by the public article API.'
          : 'The article returns to draft and disappears from the public journal. Its published_at date is kept, so re-publishing restores the original date.',
      },
      confirmation_token: token,
      expires_in_seconds: PENDING_TTL_MS / 1000,
    };
  }

  const m = await consumeShared<WritingMutation, 'writing.set_article_published'>(env, confirm, 'writing.set_article_published', auth);
  if (!m || m.articleId !== articleId) return INVALID_TICKET;

  if (m.published) {
    await env.DB.prepare(
      `UPDATE articles SET status = 'published', published_at = ?, updated_at = datetime('now')
        WHERE id = ? AND account_id = ?`
    ).bind(m.publishedAt, m.articleId, m.accountId).run();
  } else {
    // published_at is deliberately left standing, exactly as the unpublish
    // route leaves it.
    await env.DB.prepare(
      `UPDATE articles SET status = 'draft', updated_at = datetime('now')
        WHERE id = ? AND account_id = ?`
    ).bind(m.articleId, m.accountId).run();
  }

  await logWriting(env, m.accountId, m.userEmail,
    m.published ? 'ARTICLE_PUBLISHED_MCP' : 'ARTICLE_UNPUBLISHED_MCP',
    `Article "${existing.title}" ${m.published ? 'published' : 'unpublished'} via MCP`, 'article', m.articleId);

  const updated = await loadArticle(env, m.accountId, m.articleId);
  return { committed: true, action: 'set_article_published', article: updated ? articleToApi(updated) : null };
};

const toolDraftArticleFromEvent: ToolHandler = async (env, auth, args) => {
  const eventId = String(args?.event_id || '').trim();
  if (!eventId) throw new Error('event_id is required');
  const confirm = args?.confirm ? String(args.confirm) : null;

  const event = await env.DB.prepare(
    'SELECT id, account_id, title, subtitle FROM events WHERE id = ? AND account_id = ?'
  ).bind(eventId, auth.accountId).first() as Record<string, any> | null;
  if (!event) return { error: 'event_not_found' };

  // One article per event, enforced by idx_articles_account_source_event. Hand
  // back the existing one rather than failing: the caller wants the write-up,
  // and it already exists.
  const already = await env.DB.prepare(
    'SELECT * FROM articles WHERE account_id = ? AND source_event_id = ?'
  ).bind(auth.accountId, eventId).first() as Record<string, any> | null;
  if (already) return { existing: true, article: articleToApi(already) };

  const postSession = await env.DB.prepare(
    'SELECT * FROM event_post_session WHERE event_id = ? AND account_id = ?'
  ).bind(eventId, auth.accountId).first() as Record<string, any> | null;
  // buildEventArticleDraft is the worker's existing composer for this, shared
  // with the admin route, so both doors produce the same piece from the same
  // session notes.
  const draft = buildEventArticleDraft(event, postSession);

  if (!confirm) {
    const token = await issueTicket(env, {
      kind: 'writing.draft_article_from_event',
      accountId: auth.accountId, userEmail: auth.userEmail, authorId: auth.userId, eventId,
    }, auth.tokenId);
    return {
      preview: {
        action: 'draft_article_from_event',
        event: { id: eventId, title: event.title },
        has_post_session_notes: !!postSession,
        title: draft.title,
        block_count: draft.blocks.length,
        first_lines: articlePreview(draft.blocks),
        status_after: 'draft',
        note: postSession
          ? 'Composed from the event\'s post-session notes.'
          : 'No post-session notes exist for this event yet, so the draft is little more than a cover. Filling the post-session record first gives a fuller piece.',
      },
      confirmation_token: token,
      expires_in_seconds: PENDING_TTL_MS / 1000,
    };
  }

  const m = await consumeShared<WritingMutation, 'writing.draft_article_from_event'>(env, confirm, 'writing.draft_article_from_event', auth);
  if (!m || m.eventId !== eventId) return INVALID_TICKET;

  const id = crypto.randomUUID();
  const slug = await availableSlug(env, `${slugify(draft.title) || 'event'}-${eventId}`);
  try {
    // account_id named explicitly — see the note in create_article_draft.
    await env.DB.prepare(
      `INSERT INTO articles (id, account_id, title, subtitle, author_id, slug, status, category, tags,
                             cover_image_url, blocks, layout_template, source_event_id)
       VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, '[]', ?, ?, ?, ?)`
    ).bind(
      id, m.accountId, draft.title, draft.subtitle, m.authorId, slug, draft.category,
      draft.cover_image_url, JSON.stringify(draft.blocks), draft.layout_template, eventId,
    ).run();
  } catch {
    // The unique index on (account_id, source_event_id) is the race detector:
    // the admin UI may have made the same draft between preview and confirm.
    const raced = await env.DB.prepare(
      'SELECT * FROM articles WHERE account_id = ? AND source_event_id = ?'
    ).bind(m.accountId, eventId).first() as Record<string, any> | null;
    if (raced) return { existing: true, article: articleToApi(raced) };
    return { error: 'could_not_create_draft' };
  }

  await logWriting(env, m.accountId, m.userEmail, 'ARTICLE_DRAFT_CREATED_MCP',
    `Article draft created from event ${eventId} via MCP`, 'article', id);

  const created = await loadArticle(env, m.accountId, id);
  return { committed: true, existing: false, action: 'draft_article_from_event', article: created ? articleToApi(created) : { id } };
};

/* ────────────────────────────── samples ──────────────────────────────────── */

/**
 * What is built here, and what is deliberately not.
 *
 * The sample shelf is three tables — sets, samples, tastings — and only the
 * first two are the shop's own operational record. `tea_sample_tastings` is a
 * customer-facing surface: the public POST /api/samples/:id/tastings accepts
 * guests, stamps `taster_id` with the tasting customer's EMAIL when they are
 * signed in, and then auto-tags the matching customer row and mirrors the
 * verdict into reviews. Two things follow.
 *
 * First, no tool here returns tastings row by row. Under `inventory:read` that
 * would hand a stock-scoped token a list of customer email addresses, which is
 * what `customers:read` exists to gate. `get_sample` returns the aggregate
 * instead — how many tasted it, how the verdicts fell, the average rating —
 * which is the whole of what sourcing needs from it.
 *
 * Second, there is no `record_sample_tasting` tool. Writing a tasting is not
 * one INSERT: the HTTP path also tags the customer, mirrors to reviews and
 * dedupes on a client-supplied id. Reproducing half of that from here would be
 * a second door onto one act with different rules, which is the shape that once
 * gave this shop four freight rates at the same time. A session that needs a
 * tasting recorded should use the tasting surface.
 *
 * What is left is the operational fact an agent actually needs to write: where
 * a sample has got to. That is `set_sample_status`.
 */
const SAMPLE_STATUSES = ['requested', 'received', 'untasted', 'tasted', 'favorite', 'ordering', 'ordered', 'passed'] as const;
type SampleStatus = typeof SAMPLE_STATUSES[number];

const SAMPLE_SET_PURPOSES = ['sourcing', 'customer-request', 'customer-gifted', 'event', 'panel'];

/**
 * `tea_samples.notes` and `tea_sample_sets.notes` are Adrian's own private
 * notes — the type calls them "Admin private notes" and they are never shown to
 * a customer. Nothing in this module writes to either; they are read-only here
 * on purpose, so that no tool can quietly file marketing copy in the space
 * reserved for what he actually thought of the tea.
 *
 * The one exception to their being prose at all: a customer-requested sample
 * stores its request metadata there as JSON, including the requesting user's
 * id. That is machine material and a customer identifier, so it is decoded into
 * the request fields the shelf needs and the raw string is not returned.
 */
function readSampleNotes(row: Record<string, any>): { notes: string | null; requested_grams: number | null; request_note: string | null } {
  const raw = typeof row.notes === 'string' ? row.notes : null;
  if (!raw) return { notes: null, requested_grams: null, request_note: null };
  if (row.created_by === 'customer') {
    try {
      const meta = JSON.parse(raw);
      if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
        return {
          notes: null,
          requested_grams: typeof meta.quantity_grams === 'number' ? meta.quantity_grams : null,
          request_note: typeof meta.note === 'string' && meta.note.trim() ? meta.note.trim() : null,
        };
      }
    } catch { /* not the metadata envelope; fall through and treat it as prose */ }
  }
  return { notes: raw, requested_grams: null, request_note: null };
}

function sampleToApi(row: Record<string, any>) {
  const notes = readSampleNotes(row);
  return {
    id: row.id,
    name: row.name,
    chinese_name: row.chinese_name,
    type: row.type,
    form: row.form,
    year: row.year,
    origin_region: row.origin_region,
    source_id: row.source_id,
    source_name: row.source_name,
    product_id: row.product_id,
    compass_entry_id: row.compass_entry_id,
    tea_key: row.tea_key,
    set_id: row.set_id,
    status: row.status,
    grams: row.grams,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    ...notes,
    // user_id is deliberately absent: on a customer-requested sample it
    // identifies the customer, and this tool is scoped inventory:read.
  };
}

const toolListSampleSets: ToolHandler = async (env, auth, args) => {
  const purpose = args?.purpose ? String(args.purpose).trim() : '';
  if (purpose && !SAMPLE_SET_PURPOSES.includes(purpose)) {
    return { error: 'invalid_purpose', accepted: SAMPLE_SET_PURPOSES };
  }
  const includeArchived = args?.include_archived === true;
  const limit = clampLimit(args?.limit, 25, 100);

  // account_id is nullable on both sample tables — they predate tenancy the way
  // the articles default does. Scoping on equality means a legacy row with a
  // NULL account belongs to nobody and is invisible here, which is the correct
  // reading: it cannot be attributed to this shop.
  const where = ['s.account_id = ?'];
  const binds: unknown[] = [auth.accountId];
  if (purpose) { where.push('s.purpose = ?'); binds.push(purpose); }
  if (!includeArchived) where.push('s.archived = 0');

  const sets = await env.DB.prepare(
    `SELECT s.id, s.name, s.purpose, s.source_id, s.source_name, s.notes, s.archived,
            s.created_at, s.updated_at
       FROM tea_sample_sets s
      WHERE ${where.join(' AND ')}
      ORDER BY s.created_at DESC
      LIMIT ?`
  ).bind(...binds, limit).all() as { results: Record<string, any>[] };

  const counts = await env.DB.prepare(
    `SELECT set_id, status, COUNT(*) AS n
       FROM tea_samples WHERE account_id = ?
      GROUP BY set_id, status`
  ).bind(auth.accountId).all() as { results: Array<{ set_id: string; status: string; n: number }> };
  const bySet = new Map<string, Record<string, number>>();
  for (const row of counts.results) {
    const bucket = bySet.get(row.set_id) ?? {};
    bucket[row.status] = Number(row.n);
    bySet.set(row.set_id, bucket);
  }

  return {
    count: sets.results.length,
    sets: sets.results.map(set => {
      const byStatus = bySet.get(set.id) ?? {};
      const total = Object.values(byStatus).reduce((sum, n) => sum + n, 0);
      return {
        id: set.id,
        name: set.name,
        purpose: set.purpose,
        source_id: set.source_id,
        source_name: set.source_name,
        // A customer-request set stores a JSON envelope here, not prose; only
        // an owner-authored set has notes worth reading back.
        notes: set.purpose === 'customer-request' ? null : set.notes,
        archived: !!set.archived,
        sample_count: total,
        by_status: byStatus,
        // The shelf question is "what have I not tasted yet".
        awaiting_tasting: (byStatus.requested ?? 0) + (byStatus.received ?? 0) + (byStatus.untasted ?? 0),
        created_at: set.created_at,
        updated_at: set.updated_at,
      };
    }),
  };
};

const toolListSamples: ToolHandler = async (env, auth, args) => {
  const setId = args?.set_id ? String(args.set_id).trim() : '';
  const status = args?.status ? String(args.status).trim() : '';
  if (status && !SAMPLE_STATUSES.includes(status as SampleStatus)) {
    return { error: 'invalid_status', accepted: SAMPLE_STATUSES };
  }
  const query = args?.query ? String(args.query).trim().toLowerCase() : '';
  const limit = clampLimit(args?.limit, 50, 200);

  const where = ['account_id = ?'];
  const binds: unknown[] = [auth.accountId];
  if (setId) { where.push('set_id = ?'); binds.push(setId); }
  if (status) { where.push('status = ?'); binds.push(status); }
  if (query) {
    where.push("(lower(name) LIKE ? OR lower(COALESCE(chinese_name, '')) LIKE ? OR lower(COALESCE(source_name, '')) LIKE ?)");
    binds.push(`%${query}%`, `%${query}%`, `%${query}%`);
  }

  const rows = await env.DB.prepare(
    `SELECT * FROM tea_samples WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT ?`
  ).bind(...binds, limit).all() as { results: Record<string, any>[] };

  return { count: rows.results.length, samples: rows.results.map(sampleToApi) };
};

const toolGetSample: ToolHandler = async (env, auth, args) => {
  const sampleId = String(args?.sample_id || '').trim();
  if (!sampleId) throw new Error('sample_id is required');

  const row = await env.DB.prepare(
    'SELECT * FROM tea_samples WHERE id = ? AND account_id = ?'
  ).bind(sampleId, auth.accountId).first() as Record<string, any> | null;
  if (!row) return { error: 'not_found' };

  const set = await env.DB.prepare(
    'SELECT id, name, purpose FROM tea_sample_sets WHERE id = ? AND account_id = ?'
  ).bind(row.set_id, auth.accountId).first() as Record<string, any> | null;

  // Aggregate only — see the note above SAMPLE_STATUSES. Verdicts and ratings
  // are the sourcing signal; who gave them is customer data this scope does not
  // cover, and `personal_note` is the taster's own note space either way.
  const verdicts = await env.DB.prepare(
    `SELECT t.verdict AS verdict, COUNT(*) AS n,
            AVG(t.rating) AS avg_rating, SUM(t.would_buy) AS would_buy
       FROM tea_sample_tastings t
       JOIN tea_samples s ON s.id = t.sample_id AND s.account_id = ?
      WHERE t.sample_id = ?
      GROUP BY t.verdict`
  ).bind(auth.accountId, sampleId).all() as { results: Array<{ verdict: string; n: number; avg_rating: number | null; would_buy: number | null }> };

  const byVerdict: Record<string, number> = {};
  let tastingCount = 0;
  let wouldBuy = 0;
  let ratingSum = 0;
  let ratingCount = 0;
  for (const v of verdicts.results) {
    const n = Number(v.n);
    byVerdict[v.verdict] = n;
    tastingCount += n;
    wouldBuy += Number(v.would_buy ?? 0);
    if (v.avg_rating != null) { ratingSum += Number(v.avg_rating) * n; ratingCount += n; }
  }

  return {
    sample: sampleToApi(row),
    set: set ? { id: set.id, name: set.name, purpose: set.purpose } : null,
    tastings: {
      count: tastingCount,
      by_verdict: byVerdict,
      // Null rather than 0 when nobody has rated it: an unrated sample is not a
      // sample rated zero, and averaging an empty set into 0 reads as "bad tea".
      average_rating: ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 10) / 10 : null,
      would_buy_count: wouldBuy,
      note: 'Aggregate only. Individual tastings carry the taster\'s identity and are not exposed to an inventory-scoped token.',
    },
  };
};

const toolSetSampleStatus: ToolHandler = async (env, auth, args) => {
  const sampleId = String(args?.sample_id || '').trim();
  if (!sampleId) throw new Error('sample_id is required');
  const status = String(args?.status || '').trim();
  if (!SAMPLE_STATUSES.includes(status as SampleStatus)) {
    throw new Error(`status must be one of: ${SAMPLE_STATUSES.join(', ')}`);
  }
  const confirm = args?.confirm ? String(args.confirm) : null;

  const row = await env.DB.prepare(
    'SELECT id, name, status, set_id, created_by FROM tea_samples WHERE id = ? AND account_id = ?'
  ).bind(sampleId, auth.accountId).first() as Record<string, any> | null;
  if (!row) return { error: 'not_found' };

  if (!confirm) {
    const token = await issueTicket(env, {
      kind: 'writing.set_sample_status',
      accountId: auth.accountId, userEmail: auth.userEmail, sampleId,
      status: status as SampleStatus, previousStatus: String(row.status),
    }, auth.tokenId);
    return {
      preview: {
        action: 'set_sample_status',
        sample: { id: sampleId, name: row.name, set_id: row.set_id },
        current_status: row.status,
        new_status: status,
        already_in_target_state: row.status === status,
        note: 'Status only. This does not record a tasting, move stock, or write to the sample\'s notes.',
      },
      confirmation_token: token,
      expires_in_seconds: PENDING_TTL_MS / 1000,
    };
  }

  const m = await consumeShared<WritingMutation, 'writing.set_sample_status'>(env, confirm, 'writing.set_sample_status', auth);
  if (!m || m.sampleId !== sampleId) return INVALID_TICKET;

  await env.DB.prepare(
    "UPDATE tea_samples SET status = ?, updated_at = datetime('now') WHERE id = ? AND account_id = ?"
  ).bind(m.status, m.sampleId, m.accountId).run();

  await logWriting(env, m.accountId, m.userEmail, 'SAMPLE_STATUS_SET_MCP',
    `Sample "${row.name}" moved ${m.previousStatus} → ${m.status} via MCP`, 'tea_sample', m.sampleId);

  return {
    committed: true,
    action: 'set_sample_status',
    sample_id: m.sampleId,
    previous_status: m.previousStatus,
    status: m.status,
  };
};

/* ────────────────────────────── definitions ──────────────────────────────── */

const defs: ToolDefinition[] = [
  {
    name: 'list_articles',
    scope: 'inventory:read',
    description: 'List the shop\'s journal articles, most recently edited first, with a first-lines preview of each. Filter by status (active = everything not archived, the default) or a free-text match on title, subtitle or slug. This is how you find an article_id for get_article, update_article_draft or set_article_published.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'active (default, everything not archived), draft, published, archived, or all.' },
        query: { type: 'string', description: 'Free-text match on title, subtitle or slug.' },
        limit: { type: 'number', description: 'Max articles to return (default 20, max 100).' },
      },
    },
  },
  {
    name: 'get_article',
    scope: 'inventory:read',
    description: 'One article in full, by article_id or by slug: every block of its body, its tags, cover, pull quote and publication state. Also reports whether its prose is managed by WordForge, in which case it cannot be edited here.',
    inputSchema: {
      type: 'object',
      properties: {
        article_id: { type: 'string', description: 'Article id from list_articles.' },
        slug: { type: 'string', description: 'Used if article_id is omitted.' },
      },
    },
  },
  {
    name: 'create_article_draft',
    scope: 'catalog:write',
    description: 'Write a new journal article as a DRAFT. Nothing becomes public until set_article_published. The body is an ordered array of text blocks — intro, paragraph, section_heading, quote — each at most 600 characters, because a journal page does not scroll and longer text renders where nobody can reach it. The cover is composed from title, subtitle and cover_image_url; images, Q&A pairs and sidebars belong in the admin editor. Two-step preview/confirm.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'The article\'s title. Also printed on the cover block.' },
        subtitle: { type: 'string', description: 'Optional standfirst under the title.' },
        body: {
          type: 'array',
          description: 'Ordered body blocks. Each is { type, text } with type one of intro, paragraph, section_heading, quote. Max 600 characters of text per block, max 119 blocks.',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', description: 'intro | paragraph | section_heading | quote' },
              text: { type: 'string', description: 'The block\'s text, at most 600 characters.' },
            },
            required: ['type', 'text'],
          },
        },
        category: { type: 'string', description: 'Optional journal category, e.g. Field Notes.' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Up to 20 tags.' },
        cover_image_url: { type: 'string', description: 'Optional cover image URL.' },
        pull_quote: { type: 'string', description: 'Optional pulled quote shown alongside the piece.' },
        slug: { type: 'string', description: 'Optional URL slug. Derived from the title when omitted, and suffixed if already taken.' },
        reading_time_mins: { type: 'number', description: 'Optional reading time in minutes.' },
        confirm: { type: 'string', description: 'Confirmation token from preview response.' },
      },
      required: ['title', 'body'],
    },
  },
  {
    name: 'update_article_draft',
    scope: 'catalog:write',
    description: 'Edit an existing article. Only the fields you name change; passing null clears a nullable field, and an empty string is refused rather than treated as a clear. Passing body rewrites the whole body, cover included. Refuses articles whose prose is managed by WordForge, since the next sync would overwrite the edit. Editing an already-published article changes what is live the moment it commits — the preview says so. Two-step preview/confirm.',
    inputSchema: {
      type: 'object',
      properties: {
        article_id: { type: 'string', description: 'Article id from list_articles.' },
        title: { type: 'string', description: 'New title. Cannot be cleared.' },
        subtitle: { type: 'string', description: 'New standfirst, or null to clear it.' },
        body: {
          type: 'array',
          description: 'Replaces every body block. Same { type, text } shape as create_article_draft.',
          items: {
            type: 'object',
            properties: { type: { type: 'string' }, text: { type: 'string' } },
            required: ['type', 'text'],
          },
        },
        category: { type: 'string', description: 'New category, or null to clear it.' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Replaces the tag list.' },
        cover_image_url: { type: 'string', description: 'New cover image URL, or null to clear it.' },
        pull_quote: { type: 'string', description: 'New pulled quote, or null to clear it.' },
        slug: { type: 'string', description: 'New URL slug. Changing it changes the article\'s public address; old links stop resolving.' },
        reading_time_mins: { type: 'number', description: 'New reading time in minutes, or null to clear it.' },
        confirm: { type: 'string', description: 'Confirmation token from preview response.' },
      },
      required: ['article_id'],
    },
  },
  {
    name: 'set_article_published',
    scope: 'catalog:write',
    description: 'Publish an article to the public journal, or take it back to draft. Re-publishing keeps the original published_at date, so correcting an old piece does not move it to the top of the archive. Unpublishing keeps the date too. Two-step preview/confirm.',
    inputSchema: {
      type: 'object',
      properties: {
        article_id: { type: 'string', description: 'Article id from list_articles.' },
        published: { type: 'boolean', description: 'true to publish; false to return it to draft and remove it from the public journal.' },
        confirm: { type: 'string', description: 'Confirmation token from preview response.' },
      },
      required: ['article_id', 'published'],
    },
  },
  {
    name: 'draft_article_from_event',
    scope: 'catalog:write',
    description: 'Compose a draft write-up of a tea session from the event\'s post-session record: session notes, host notes, the tea ledger, the gallery and the shared tasting notes. Uses the same composer as the admin button, so both produce the same piece. One article per event — if one already exists it is returned instead of a second being made. Fill in the post-session record first; without it the draft is little more than a cover. Two-step preview/confirm.',
    inputSchema: {
      type: 'object',
      properties: {
        event_id: { type: 'string', description: 'The event to write up.' },
        confirm: { type: 'string', description: 'Confirmation token from preview response.' },
      },
      required: ['event_id'],
    },
  },
  {
    name: 'list_sample_sets',
    scope: 'inventory:read',
    description: 'List sample sets — the batches samples arrive and get tasted in — with a count of their samples by status and how many are still awaiting tasting. Filter by purpose (sourcing, customer-request, customer-gifted, event, panel). Archived sets are hidden unless asked for.',
    inputSchema: {
      type: 'object',
      properties: {
        purpose: { type: 'string', description: 'sourcing | customer-request | customer-gifted | event | panel' },
        include_archived: { type: 'boolean', description: 'Include archived sets (default false).' },
        limit: { type: 'number', description: 'Max sets to return (default 25, max 100).' },
      },
    },
  },
  {
    name: 'list_samples',
    scope: 'inventory:read',
    description: 'List sample portions: what they are, where they came from, how many grams, which set they sit in and what state they are in. Filter by set_id, by status, or a free-text match on name, Chinese name or source. Answers "what is still waiting to be tasted".',
    inputSchema: {
      type: 'object',
      properties: {
        set_id: { type: 'string', description: 'Only samples in this set (from list_sample_sets).' },
        status: { type: 'string', description: 'requested | received | untasted | tasted | favorite | ordering | ordered | passed' },
        query: { type: 'string', description: 'Free-text match on sample name, Chinese name or source name.' },
        limit: { type: 'number', description: 'Max samples to return (default 50, max 200).' },
      },
    },
  },
  {
    name: 'get_sample',
    scope: 'inventory:read',
    description: 'One sample in full, with its set and a summary of how it tasted: how many people tried it, how the verdicts fell, the average rating and how many would buy it. Individual tastings are not returned — they carry the taster\'s identity, which an inventory-scoped token does not cover.',
    inputSchema: {
      type: 'object',
      properties: {
        sample_id: { type: 'string', description: 'Sample id from list_samples.' },
      },
      required: ['sample_id'],
    },
  },
  {
    name: 'set_sample_status',
    scope: 'stock:write',
    description: 'Move one sample along the shelf: requested → received → untasted → tasted, then favorite, ordering, ordered or passed. This records where the sample has got to and nothing else — it does not record a tasting, move stock, or touch the sample\'s notes. Two-step preview/confirm.',
    inputSchema: {
      type: 'object',
      properties: {
        sample_id: { type: 'string', description: 'Sample id from list_samples.' },
        status: { type: 'string', description: 'requested | received | untasted | tasted | favorite | ordering | ordered | passed' },
        confirm: { type: 'string', description: 'Confirmation token from preview response.' },
      },
      required: ['sample_id', 'status'],
    },
  },
];

export const writingToolModule: ToolModule = {
  area: 'writing',
  defs,
  handlers: {
    list_articles: toolListArticles,
    get_article: toolGetArticle,
    create_article_draft: toolCreateArticleDraft,
    update_article_draft: toolUpdateArticleDraft,
    set_article_published: toolSetArticlePublished,
    draft_article_from_event: toolDraftArticleFromEvent,
    list_sample_sets: toolListSampleSets,
    list_samples: toolListSamples,
    get_sample: toolGetSample,
    set_sample_status: toolSetSampleStatus,
  },
};

export default writingToolModule;
