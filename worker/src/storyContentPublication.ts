import { sha256Hex } from './inquiryDomain';

type Draft = { id: string; content: string; published_id: string | null };

const PUBLISHED_ID = `(SELECT p.id FROM story_content p
  WHERE p.account_id = story_content.account_id AND p.story_slug = story_content.story_slug AND p.state = 'published')`;

export function readStoryDraft(db: D1Database, accountId: string, slug: string) {
  return db.prepare(`SELECT id, content, ${PUBLISHED_ID} AS published_id FROM story_content
    WHERE account_id = ? AND story_slug = ? AND state = 'draft'`).bind(accountId, slug).first<Draft>();
}

export function storyReviewDigest(accountId: string, slug: string, draft: Draft) {
  return sha256Hex(JSON.stringify([accountId, slug, draft.id, draft.content, draft.published_id]));
}

export async function saveStoryDraft(db: D1Database, accountId: string, slug: string, content: string) {
  // Overlay row IDs are internal. Give every save or restore a new identity,
  // including a rewrite of identical bytes within the same second.
  const row = await db.prepare(`INSERT INTO story_content (id, account_id, story_slug, state, content)
    VALUES (?, ?, ?, 'draft', ?)
    ON CONFLICT(account_id, story_slug, state) DO UPDATE SET
      id = excluded.id, content = excluded.content, updated_at = datetime('now')
    RETURNING id, content, ${PUBLISHED_ID} AS published_id`)
    .bind(crypto.randomUUID(), accountId, slug, content).first<Draft>();
  if (!row) throw new Error('Story draft save did not return its revision');
  return storyReviewDigest(accountId, slug, row);
}

export async function publishStoryDraft(db: D1Database, accountId: string, slug: string, draft: Draft) {
  const newPublishedId = crypto.randomUUID();
  const reviewed = `FROM story_content d
    LEFT JOIN story_content p ON p.account_id = d.account_id AND p.story_slug = d.story_slug AND p.state = 'published'
    WHERE d.account_id = ? AND d.story_slug = ? AND d.state = 'draft' AND d.id = ? AND d.content = ? AND p.id IS ?`;
  const guard = [accountId, slug, draft.id, draft.content, draft.published_id] as const;
  // D1 runs this batch as one transaction. The history and public writes
  // both depend on the same revision check inside that transaction.
  const [, promoted] = await db.batch([
    db.prepare(`INSERT INTO story_content_versions (id, account_id, story_slug, content, label)
      SELECT ?, d.account_id, d.story_slug, p.content, 'before publish' ${reviewed} AND p.id IS NOT NULL`)
      .bind(crypto.randomUUID(), ...guard),
    db.prepare(`INSERT INTO story_content (id, account_id, story_slug, state, content)
      SELECT ?, d.account_id, d.story_slug, 'published', d.content ${reviewed}
      ON CONFLICT(account_id, story_slug, state) DO UPDATE SET
        id = excluded.id, content = excluded.content, updated_at = datetime('now')`)
      .bind(newPublishedId, ...guard),
    db.prepare(`DELETE FROM story_content_versions WHERE account_id = ? AND story_slug = ?
      AND EXISTS (SELECT 1 FROM story_content WHERE id = ? AND state = 'published')
      AND id NOT IN (
        SELECT id FROM story_content_versions WHERE account_id = ? AND story_slug = ?
        ORDER BY created_at DESC, rowid DESC LIMIT 20)`)
      .bind(accountId, slug, newPublishedId, accountId, slug),
  ]);
  if (promoted.meta.changes !== 1) return null;
  return storyReviewDigest(accountId, slug, { ...draft, published_id: newPublishedId });
}
