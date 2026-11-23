/**
 * Tea Wisdom pilot: the Wisdom claims an article relies on.
 * Contract: docs/_notes/tea-wisdom-claims.md, "Article claim uses".
 *
 * The worker only stores and returns uses. Whether a use needs review is
 * computed in the browser with `articleUseNeedsReview`, against whichever
 * claims set the screen is using, so nothing here knows a claim's revision.
 *
 * Routes:
 * - GET  /api/admin/articles/:id/wisdom-claim-uses   the article's uses (publish bundle, own account)
 * - PUT  /api/admin/articles/:id/wisdom-claim-uses   replace them all in one batch
 * - GET  /api/admin/wisdom-claim-uses?page_id=…      the account's articles citing a Wisdom page, drafts included,
 *                                                    each with every claim it cites
 * - GET  /api/wisdom/claim-uses/articles?page_id=…   published articles only, for signed-out readers
 *
 * The public article response carries its uses too (`publicArticleClaimUses`).
 */

import articleClaims from './articleWisdomClaimIndex.json';

const publicClaimIds = new Set(articleClaims.filter(claim => claim.public).map(claim => claim.id));

function citedHistory(uses: ArticleClaimUseRow[]) {
  return uses.flatMap(use => {
    const claim = articleClaims.find(item => item.id === use.claim_id);
    const revision = claim?.revisions.find(item => item.rev === use.rev_used);
    if (!claim || !revision) return [];
    return [{ claim_id: claim.id, rev_used: revision.rev, text: revision.text, withdrawn: claim.withdrawn }];
  });
}

export interface ArticleClaimUseEnv {
  DB: D1Database;
}

type Ctx = { accountId: string } | { error: Response };

export interface ArticleClaimUseDeps<E extends ArticleClaimUseEnv> {
  requireBundle(request: Request, env: E, bundle: 'publish'): Promise<Ctx>;
}

type Handler<E> = (request: Request, env: E, params: Record<string, string>) => Promise<Response>;

export type ArticleClaimUseKind = 'prose' | 'live_block';

/** As stored and as returned. snake_case like every other article field. */
export interface ArticleClaimUseRow {
  article_id: string;
  block_index: number;
  claim_id: string;
  rev_used: number;
  use_kind: ArticleClaimUseKind;
}

export const MAX_CLAIM_USES_PER_ARTICLE = 200;
const SLUG = '[a-z0-9]+(?:-[a-z0-9]+)*';
const CLAIM_ID = new RegExp(`^${SLUG}:${SLUG}$`);
const PAGE_ID = new RegExp(`^${SLUG}$`);
const USE_KINDS: readonly ArticleClaimUseKind[] = ['prose', 'live_block'];

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

const refuse = (status: number, error: string, code: string) => json({ error, code }, status);

/** Before the migration has run (or on a database that never got it), there are simply no uses. */
function isMissingTable(error: unknown): boolean {
  return /no such table:\s*article_wisdom_claim_uses/i.test(String((error as Error)?.message ?? error));
}

const USE_COLUMNS = 'u.article_id, u.block_index, u.claim_id, u.rev_used, u.use_kind';

function blockCount(blocks: unknown): number {
  if (Array.isArray(blocks)) return blocks.length;
  try {
    const parsed = JSON.parse(String(blocks ?? '[]'));
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

/** The uses of one article, only when they were recorded under the article's own account. */
async function usesOf(db: D1Database, articleId: string, accountId: string): Promise<ArticleClaimUseRow[]> {
  try {
    const rows = await db.prepare(
      `SELECT ${USE_COLUMNS}
         FROM article_wisdom_claim_uses u
        WHERE u.article_id = ? AND u.account_id = ?
        ORDER BY u.block_index ASC, u.claim_id ASC`,
    ).bind(articleId, accountId).all<ArticleClaimUseRow>();
    return rows.results ?? [];
  } catch (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
}

/** For the public article response: the caller has already established the article is published. */
export async function publicArticleClaimUses(db: D1Database, articleId: string): Promise<ArticleClaimUseRow[]> {
  try {
    const rows = await db.prepare(
      `SELECT ${USE_COLUMNS}
         FROM article_wisdom_claim_uses u
         JOIN articles a ON a.id = u.article_id AND a.account_id = u.account_id
        WHERE u.article_id = ? AND a.status = 'published'
        ORDER BY u.block_index ASC, u.claim_id ASC`,
    ).bind(articleId).all<ArticleClaimUseRow>();
    return (rows.results ?? []).filter(row => publicClaimIds.has(row.claim_id));
  } catch (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
}

type ParsedUses = { uses: Omit<ArticleClaimUseRow, 'article_id'>[] } | { error: Response };

/** Every refusal names the entry it refused, so the editor can point at it. */
export function parseClaimUses(body: unknown, blocks: number): ParsedUses {
  const list = body && typeof body === 'object' && !Array.isArray(body) ? (body as { uses?: unknown }).uses : undefined;
  if (!Array.isArray(list)) return { error: refuse(400, 'Send the uses as a list under "uses".', 'uses_required') };
  if (list.length > MAX_CLAIM_USES_PER_ARTICLE) {
    return { error: refuse(400, `An article can record at most ${MAX_CLAIM_USES_PER_ARTICLE} claim uses.`, 'too_many_uses') };
  }
  const seen = new Set<string>();
  const uses: Omit<ArticleClaimUseRow, 'article_id'>[] = [];
  for (const [index, raw] of list.entries()) {
    const entry = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const blockIndex = entry.block_index;
    const claimId = typeof entry.claim_id === 'string' ? entry.claim_id.trim() : '';
    const revUsed = entry.rev_used;
    const useKind = entry.use_kind;
    if (!Number.isInteger(blockIndex) || (blockIndex as number) < 0 || (blockIndex as number) >= blocks) {
      return { error: refuse(400, `Use ${index + 1} points at a block this article does not have.`, 'invalid_block_index') };
    }
    if (!CLAIM_ID.test(claimId)) {
      return { error: refuse(400, `Use ${index + 1} needs a claim id written as page:section.`, 'invalid_claim_id') };
    }
    if (!Number.isInteger(revUsed) || (revUsed as number) < 1) {
      return { error: refuse(400, `Use ${index + 1} needs the revision it was written against.`, 'invalid_rev_used') };
    }
    if (!USE_KINDS.includes(useKind as ArticleClaimUseKind)) {
      return { error: refuse(400, `Use ${index + 1} must be prose or a live block.`, 'invalid_use_kind') };
    }
    const key = `${blockIndex}|${claimId}`;
    if (seen.has(key)) {
      return { error: refuse(400, `Use ${index + 1} repeats a claim already recorded on that block.`, 'duplicate_use') };
    }
    seen.add(key);
    uses.push({ block_index: blockIndex as number, claim_id: claimId, rev_used: revUsed as number, use_kind: useKind as ArticleClaimUseKind });
  }
  return { uses };
}

export function articleWisdomClaimUseRoutes<E extends ArticleClaimUseEnv>(
  deps: ArticleClaimUseDeps<E>,
): [string, string, Handler<E>][] {
  async function ownArticle(env: E, articleId: string, accountId: string) {
    return env.DB.prepare('SELECT id, blocks FROM articles WHERE id = ? AND account_id = ?')
      .bind(articleId, accountId)
      .first<{ id: string; blocks: string | null }>();
  }

  const list: Handler<E> = async (request, env, params) => {
    const ctx = await deps.requireBundle(request, env, 'publish');
    if ('error' in ctx) return ctx.error;
    const article = await ownArticle(env, params.id, ctx.accountId);
    if (!article) return refuse(404, 'Article not found', 'article_not_found');
    const uses = await usesOf(env.DB, article.id, ctx.accountId);
    return json({ uses, history: citedHistory(uses) });
  };

  const replace: Handler<E> = async (request, env, params) => {
    const ctx = await deps.requireBundle(request, env, 'publish');
    if ('error' in ctx) return ctx.error;
    const article = await ownArticle(env, params.id, ctx.accountId);
    if (!article) return refuse(404, 'Article not found', 'article_not_found');
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return refuse(400, 'The request body was not JSON.', 'invalid_json');
    }
    const parsed = parseClaimUses(body, blockCount(article.blocks));
    if ('error' in parsed) return parsed.error;
    const statements = [
      env.DB.prepare('DELETE FROM article_wisdom_claim_uses WHERE article_id = ? AND account_id = ?').bind(article.id, ctx.accountId),
      ...parsed.uses.map(use => env.DB.prepare(
        `INSERT INTO article_wisdom_claim_uses (account_id, article_id, block_index, claim_id, rev_used, use_kind)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).bind(ctx.accountId, article.id, use.block_index, use.claim_id, use.rev_used, use.use_kind)),
    ];
    await env.DB.batch(statements);
    return json({ uses: await usesOf(env.DB, article.id, ctx.accountId) });
  };

  /** Articles citing any claim on one Wisdom page. */
  async function citing(env: E, pageId: string, scope: { accountId: string } | 'published') {
    const where = scope === 'published'
      ? `a.status = 'published'`
      : `a.account_id = ? AND a.status != 'archived'`;
    const binds: unknown[] = scope === 'published' ? [`${pageId}:%`] : [scope.accountId, `${pageId}:%`];
    try {
      const rows = await env.DB.prepare(
        // Every claim each citing article uses, not just this page's, so a page
        // can link to the other Wisdom pages read alongside it.
        `SELECT a.id, a.title, a.slug, a.status, group_concat(DISTINCT u.claim_id) AS claim_ids
           FROM article_wisdom_claim_uses u
           JOIN articles a ON a.id = u.article_id AND a.account_id = u.account_id
          WHERE ${where}
            AND EXISTS (SELECT 1 FROM article_wisdom_claim_uses mine
                         WHERE mine.article_id = u.article_id AND mine.account_id = u.account_id AND mine.claim_id LIKE ?)
          GROUP BY a.id
          ORDER BY a.title ASC`,
      ).bind(...binds).all<{ id: string; title: string; slug: string; status: string; claim_ids: string | null }>();
      return (rows.results ?? []).map(row => ({
        id: row.id,
        title: row.title,
        slug: row.slug,
        status: row.status,
        claim_ids: String(row.claim_ids ?? '').split(',').filter(Boolean).sort(),
      }));
    } catch (error) {
      if (isMissingTable(error)) return [];
      throw error;
    }
  }

  const pageIdFrom = (request: Request) => new URL(request.url).searchParams.get('page_id')?.trim() ?? '';

  const adminCiting: Handler<E> = async (request, env) => {
    const ctx = await deps.requireBundle(request, env, 'publish');
    if ('error' in ctx) return ctx.error;
    const pageId = pageIdFrom(request);
    if (!PAGE_ID.test(pageId)) return refuse(400, 'Name the Wisdom page as page_id.', 'invalid_page_id');
    return json({ articles: await citing(env, pageId, { accountId: ctx.accountId }) });
  };

  const publicCiting: Handler<E> = async (request, env) => {
    const pageId = pageIdFrom(request);
    if (!PAGE_ID.test(pageId)) return refuse(400, 'Name the Wisdom page as page_id.', 'invalid_page_id');
    const articles = (await citing(env, pageId, 'published')).flatMap(({ status: _status, ...article }) => {
      const claim_ids = article.claim_ids.filter(id => publicClaimIds.has(id));
      return claim_ids.length ? [{ ...article, claim_ids }] : [];
    });
    return json({ articles });
  };

  return [
    ['GET', '/api/admin/articles/:id/wisdom-claim-uses', list],
    ['PUT', '/api/admin/articles/:id/wisdom-claim-uses', replace],
    ['GET', '/api/admin/wisdom-claim-uses', adminCiting],
    ['GET', '/api/wisdom/claim-uses/articles', publicCiting],
  ];
}

// ── Keeping uses on their blocks when an article's blocks change ─────────────
//
// The table stores block_index (the contract's shape). Blocks carry a stable
// `blockId` the editor assigns, so when a save moves, inserts or deletes
// blocks, each use follows its block to its new position. A block saved
// before ids existed is found again by its exact content. A use whose block is
// gone is dropped: the sentence it vouched for no longer exists.

type StoredBlock = Record<string, unknown>;

function parseBlocks(blocks: unknown): StoredBlock[] {
  if (Array.isArray(blocks)) return blocks as StoredBlock[];
  try {
    const parsed = JSON.parse(String(blocks ?? '[]'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const blockIdOf = (block: StoredBlock | undefined) =>
  typeof block?.blockId === 'string' && block.blockId ? block.blockId : null;

function contentOf(block: StoredBlock): string {
  const { blockId: _id, ...rest } = block;
  return JSON.stringify(rest, Object.keys(rest).sort());
}

/** For each old block index, its index in the new blocks, or null when it was removed. */
export function remapBlockIndexes(oldBlocks: unknown, newBlocks: unknown): (number | null)[] {
  const before = parseBlocks(oldBlocks);
  const after = parseBlocks(newBlocks);
  const byId = new Map<string, number>();
  after.forEach((block, index) => { const id = blockIdOf(block); if (id && !byId.has(id)) byId.set(id, index); });
  const claimed = new Set<number>();
  const result: (number | null)[] = before.map(block => {
    const id = blockIdOf(block);
    if (id && byId.has(id)) { const index = byId.get(id)!; claimed.add(index); return index; }
    return null;
  });
  // Blocks with no id yet (saved before ids existed): the first unclaimed block with the same content.
  before.forEach((block, oldIndex) => {
    if (result[oldIndex] !== null) return;
    if (blockIdOf(block) && byId.size > 0) return; // it had an id, and that id is gone: removed
    const content = contentOf(block);
    const match = after.findIndex((candidate, index) => !claimed.has(index) && contentOf(candidate) === content);
    if (match >= 0) { claimed.add(match); result[oldIndex] = match; return; }
    // An id-less block edited in the same save: it stays where it was, if that slot is still free.
    if (!blockIdOf(block) && oldIndex < after.length && !claimed.has(oldIndex) && !blockIdOf(after[oldIndex])) {
      claimed.add(oldIndex);
      result[oldIndex] = oldIndex;
    }
  });
  return result;
}

/** Called by the article update route after it has written new blocks. */
export async function moveClaimUsesWithBlocks(
  db: D1Database,
  accountId: string,
  articleId: string,
  oldBlocks: unknown,
  newBlocks: unknown,
): Promise<void> {
  const uses = await usesOf(db, articleId, accountId);
  if (uses.length === 0) return;
  const map = remapBlockIndexes(oldBlocks, newBlocks);
  const moved = uses
    .map(use => ({ ...use, block_index: map[use.block_index] ?? null }))
    .filter((use): use is ArticleClaimUseRow => use.block_index !== null);
  const unchanged = moved.length === uses.length && moved.every((use, index) => use.block_index === uses[index].block_index);
  if (unchanged) return;
  const seen = new Set<string>();
  const statements = [
    db.prepare('DELETE FROM article_wisdom_claim_uses WHERE article_id = ? AND account_id = ?').bind(articleId, accountId),
    ...moved
      .filter(use => { const key = `${use.block_index}|${use.claim_id}`; if (seen.has(key)) return false; seen.add(key); return true; })
      .map(use => db.prepare(
        `INSERT INTO article_wisdom_claim_uses (account_id, article_id, block_index, claim_id, rev_used, use_kind)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).bind(accountId, articleId, use.block_index, use.claim_id, use.rev_used, use.use_kind)),
  ];
  await db.batch(statements);
}
