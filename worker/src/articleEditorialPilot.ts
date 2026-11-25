import type { TeajiaWordforgeDraftV1 } from './wordforgeArticleDraft';
import { ARTICLE_PUBLICATION_REVIEW } from './articlePublicationReview';
import { sha256Hex } from './inquiryDomain';

export const PILOT_ISSUE_SLOT = 'synthetic-editorial-pilot:lead';
export const PILOT_MEDIA = '/editorial-pilot-proof.png';
export const PILOT_SOURCE = 'editorial-ab-pilot';

export async function readEditorialPilot(db: D1Database, accountId: string, articleId: string) {
  const row = await db.prepare(
    `SELECT r.id, r.source_revision, r.content_hash, r.source_article_json,
            a.slug, a.read_issue_slot, a.approved_source_revision_id, approved.source_revision AS approved_source_revision,
            c.display_name AS byline,
            (SELECT json_array(placed.id, placed.publication_generation)
               FROM articles placed WHERE placed.account_id = a.account_id AND placed.read_issue_slot = ?) AS occupant
       FROM article_external_sources s
       JOIN articles a ON a.id = s.article_id AND a.account_id = s.account_id
       JOIN wordforge_article_revisions r ON r.external_source_id = s.id AND r.source_revision = s.source_revision
       LEFT JOIN wordforge_article_revisions approved ON approved.id = a.approved_source_revision_id
       LEFT JOIN contributors c ON c.id = json_extract(r.source_article_json, '$.author_id')
         AND c.account_id = s.account_id AND c.is_published = 1
      WHERE s.source_system = 'wordforge' AND s.source_id = ? AND s.account_id = ? AND s.article_id = ?`
  ).bind(PILOT_ISSUE_SLOT, PILOT_SOURCE, accountId, articleId).first<{
    id: string;
    source_revision: number;
    content_hash: string;
    source_article_json: string;
    slug: string;
    read_issue_slot: string | null;
    approved_source_revision_id: string | null;
    approved_source_revision: number | null;
    byline: string | null;
    occupant: string | null;
  }>();
  if (!row) return null;
  const article = JSON.parse(row.source_article_json) as TeajiaWordforgeDraftV1['article'];
  return {
    candidateId: row.id, sourceRevision: row.source_revision, contentHash: row.content_hash,
    blocks: [...article.blocks, ...(article.credits.length ? [{ type: 'back_matter' as const, variant: 'copyright' as const, lines: article.credits }] : [])],
    slug: row.slug, placed: row.read_issue_slot === PILOT_ISSUE_SLOT,
    approvedId: row.approved_source_revision_id, approvedSourceRevision: row.approved_source_revision, byline: row.byline, occupant: row.occupant, article,
  };
}

type Candidate = NonNullable<Awaited<ReturnType<typeof readEditorialPilot>>>;

export function editorialPilotDigest(snapshot: string, candidate: Candidate, place: boolean) {
  return sha256Hex(JSON.stringify([snapshot, candidate.candidateId, candidate.contentHash, candidate.byline, candidate.occupant, place]));
}

// This sandbox fixture has one shared immutable illustration and one
// account-owned, public contributor. The pilot does not admit other media or links.
export function isApprovedPilotProjection({ article, byline }: Candidate) {
  return Boolean(article.author_id && byline) && article.subject_ids.length === 0
    && article.cover_image_url === PILOT_MEDIA
    && article.blocks.every(block => {
      switch (block.type) {
        case 'cover': return block.image === PILOT_MEDIA;
        case 'image': return block.url === PILOT_MEDIA && (block.images === undefined || (Array.isArray(block.images) && block.images.every(url => url === PILOT_MEDIA)));
        case 'pull_sidebar': return !block.image || block.image === PILOT_MEDIA;
        case 'intro': case 'paragraph': case 'section_heading': case 'qa_pair':
        case 'quote': case 'epilogue': case 'back_matter': return true;
        default: return false;
      }
    });
}

export async function commitEditorialPilot(db: D1Database, input: {
  accountId: string;
  articleId: string;
  actorId: string;
  snapshot: string;
  digest: string;
  candidate: Candidate;
  place: boolean;
  priorEdition: object | null;
}) {
  const { article } = input.candidate;
  const receiptId = crypto.randomUUID();
  const slot = input.place ? PILOT_ISSUE_SLOT : null;
  const [changed] = await db.batch([
    db.prepare(
      `UPDATE articles SET title = ?, subtitle = ?, category = ?, tags = ?, cover_image_url = ?, blocks = ?,
                layout_template = 'immersive_scroll', author_id = ?, subject_ids = '[]',
                pull_quote = NULL, pull_quote_subject = NULL,
                approved_source_revision_id = ?, read_issue_slot = ?, editorial_receipt_id = ?,
                published_at = COALESCE(published_at, datetime('now')), status = 'published',
                updated_at = datetime('now'), publication_generation = publication_generation + 1
        WHERE id = ? AND account_id = ? AND ${ARTICLE_PUBLICATION_REVIEW} = ?
          AND (SELECT json_array(placed.id, placed.publication_generation)
                 FROM articles placed WHERE placed.account_id = articles.account_id AND placed.read_issue_slot = ?) IS ?
          AND EXISTS (SELECT 1 FROM contributors WHERE id = ? AND account_id = articles.account_id
                      AND is_published = 1 AND display_name = ?)`
    ).bind(article.title, article.subtitle, article.category, JSON.stringify(article.tags),
      article.cover_image_url, JSON.stringify(input.candidate.blocks), article.author_id,
      input.candidate.candidateId, slot, receiptId, input.articleId, input.accountId, input.snapshot,
      PILOT_ISSUE_SLOT, input.candidate.occupant, article.author_id, input.candidate.byline),
    db.prepare(
      `INSERT INTO article_editorial_receipts
        (id, article_id, actor_id, review_digest, candidate_id, public_generation, prior_edition_json, approved_edition_json, read_issue_slot)
       SELECT ?, id, ?, ?, approved_source_revision_id, publication_generation, ?, ?, read_issue_slot
         FROM articles WHERE id = ? AND account_id = ? AND editorial_receipt_id = ?`
    ).bind(receiptId, input.actorId, input.digest, input.priorEdition && JSON.stringify(input.priorEdition),
      JSON.stringify({ ...article, blocks: input.candidate.blocks, slug: input.candidate.slug, layout_template: "immersive_scroll", byline: input.candidate.byline }),
      input.articleId, input.accountId, receiptId),
  ]);
  return changed.meta.changes === 1 ? receiptId : null;
}
