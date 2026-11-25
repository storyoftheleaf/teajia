import { sha256Hex } from './inquiryDomain';

export const NATIVE_ARTICLE_FIELDS = ['title', 'subtitle', 'author_id', 'category', 'tags', 'cover_image_url', 'blocks', 'layout_template', 'reading_time_mins', 'subject_ids', 'pull_quote', 'pull_quote_subject'] as const;
const NATIVE_DRAFT = `(SELECT draft_json FROM article_native_drafts WHERE article_id = articles.id AND base_generation = articles.publication_generation)`;

export const ARTICLE_REVIEW_PRODUCT_IDS = `(SELECT json_group_array(product_id) FROM (
  SELECT product_id FROM article_products WHERE article_id = articles.id ORDER BY product_id
))`;

// Keep the reviewed row and its WordForge head in one snapshot. A new source
// delivery can change the head without changing any column of a live article.
// Use the same expression in the UPDATE to catch edits after the confirm read.
export const ARTICLE_PUBLICATION_REVIEW = `json_array(
  4, ${NATIVE_DRAFT}, articles.publication_generation, articles.approved_source_revision_id, articles.read_issue_slot, articles.id, articles.account_id, articles.title, articles.subtitle,
  articles.author_id, articles.slug, articles.status, articles.category,
  articles.tags, articles.cover_image_url, articles.blocks, articles.layout_template,
  articles.reading_time_mins, articles.published_at, articles.created_at, articles.updated_at,
  articles.subject_ids, articles.pull_quote, articles.pull_quote_subject, articles.source_event_id,
  ${ARTICLE_REVIEW_PRODUCT_IDS},
  (SELECT json_array(id, source_id, source_revision, content_hash)
     FROM article_external_sources
    WHERE article_id = articles.id AND account_id = articles.account_id AND source_system = 'wordforge')
)`;

export const STALE_ARTICLE_REVIEW = {
  error: 'stale_article_review',
  detail: 'The article or its source revision changed after preview. Request a new preview before confirming.',
} as const;

export const ARTICLE_REVIEW_PROJECTION = `
  ${ARTICLE_PUBLICATION_REVIEW} AS review_snapshot,
  ${ARTICLE_REVIEW_PRODUCT_IDS} AS review_product_ids, ${NATIVE_DRAFT} AS native_draft_json`;

type ArticleReviewRow = Record<string, any> & {
  review_snapshot: string;
  review_product_ids: string;
};

export async function unpackArticleReview(row: ArticleReviewRow) {
  const { native_draft_json, review_snapshot: snapshot, review_product_ids: productIds, publication_generation: _generation, approved_source_revision_id: _approved,
    read_issue_slot: _slot, editorial_receipt_id: _receipt, ...article } = row;
  const draft = native_draft_json ? JSON.parse(native_draft_json) : null;
  return { article: draft ? { ...article, ...draft } : article, snapshot, productIds, reviewDigest: await sha256Hex(snapshot) };
}

export function readArticleReview(db: D1Database, accountId: string, articleId: string) {
  return db.prepare(`SELECT articles.*, ${ARTICLE_REVIEW_PROJECTION} FROM articles WHERE id = ? AND account_id = ?`)
    .bind(articleId, accountId).first<ArticleReviewRow>();
}

export function commitArticlePublication(db: D1Database, input: {
  accountId: string;
  articleId: string;
  status: 'published' | 'draft' | 'archived';
  publishedAt: string | null;
  snapshot: string;
}) {
  return db.prepare(`UPDATE articles SET status = ?, ${NATIVE_ARTICLE_FIELDS.map(field => `${field} = CASE WHEN ? = 'published' AND ${NATIVE_DRAFT} IS NOT NULL THEN json_extract(${NATIVE_DRAFT}, '$.${field}') ELSE ${field} END`).join(', ')},
            published_at = CASE WHEN ? = 'published' THEN ? ELSE published_at END,
            read_issue_slot = CASE WHEN ? = 'published' THEN read_issue_slot ELSE NULL END,
            updated_at = datetime('now'), publication_generation = publication_generation + 1
      WHERE id = ? AND account_id = ? AND ${ARTICLE_PUBLICATION_REVIEW} = ?
      RETURNING *, ${ARTICLE_REVIEW_PROJECTION}`)
    .bind(input.status, ...NATIVE_ARTICLE_FIELDS.map(() => input.status), input.status, input.publishedAt, input.status, input.articleId, input.accountId, input.snapshot)
    .first<ArticleReviewRow>();
}

// A candidate is private, tied to the exact row and prior candidate reviewed.
export async function stageNativeArticle(db: D1Database, accountId: string, articleId: string, fields: Record<string, unknown>, reviewed: ArticleReviewRow) {
  const { article, snapshot } = await unpackArticleReview(reviewed);
  const candidate = Object.fromEntries(NATIVE_ARTICLE_FIELDS.map(field => [field, Object.hasOwn(fields, field) ? fields[field] : article[field] ?? null]));
  const write = db.prepare(`INSERT INTO article_native_drafts (article_id, base_generation, draft_json)
    SELECT id, publication_generation, ? FROM articles WHERE id = ? AND account_id = ?
      AND approved_source_revision_id IS NULL AND ${ARTICLE_PUBLICATION_REVIEW} = ?
    ON CONFLICT(article_id) DO UPDATE SET base_generation = excluded.base_generation, draft_json = excluded.draft_json
    `).bind(JSON.stringify(candidate), articleId, accountId, snapshot);
  // Read inside the same atomic batch: a second editor must not turn this
  // save's response into a review of content this editor has never seen.
  const results = await db.batch([write, db.prepare(`SELECT articles.*, ${ARTICLE_REVIEW_PROJECTION} FROM articles WHERE id = ? AND account_id = ?`).bind(articleId, accountId)]);
  return results[0].meta.changes ? results[1].results[0] as ArticleReviewRow : null;
}
