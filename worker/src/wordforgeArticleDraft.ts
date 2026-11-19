export const WORDFORGE_DRAFT_MAX_BYTES = 256 * 1024;

type JsonObject = Record<string, unknown>;
type ArticleBlock = JsonObject & { type: 'cover' | 'intro' | 'paragraph' | 'section_heading' | 'qa_pair' | 'quote' | 'image' | 'pull_sidebar' | 'epilogue' | 'back_matter' };

export type TeajiaWordforgeDraftV1 = {
  schema_version: 1;
  source: { system: 'wordforge'; id: string; revision: number; content_hash: string };
  article: {
    title: string;
    subtitle: string | null;
    slug: string;
    category: 'interview';
    tags: string[];
    layout_template: 'immersive';
    cover_image_url: string | null;
    author_id: string | null;
    subject_ids: string[];
    credits: string[];
    blocks: ArticleBlock[];
  };
};

export class WordforgeDraftError extends Error {
  constructor(message: string, readonly status = 400, readonly code = 'invalid_wordforge_draft') { super(message); }
}

const object = (value: unknown, at: string): JsonObject => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new WordforgeDraftError(`${at} must be an object`);
  return value as JsonObject;
};
const exact = (value: JsonObject, allowed: readonly string[], at: string) => {
  const unknown = Object.keys(value).find(key => !allowed.includes(key));
  if (unknown) throw new WordforgeDraftError(`${at} has unknown field: ${unknown}`);
};
const string = (value: unknown, at: string, max: number, nullable = false): string | null => {
  if (nullable && value === null) return null;
  if (typeof value !== 'string' || !value.trim()) throw new WordforgeDraftError(`${at} must be a non-empty string`);
  if (value.length > max) throw new WordforgeDraftError(`${at} exceeds ${max} characters`);
  return value;
};
const optionalString = (value: unknown, at: string, max: number) => {
  if (value === undefined) return;
  string(value, at, max);
};
const enumValue = (value: unknown, allowed: readonly string[], at: string) => {
  if (typeof value !== 'string' || !allowed.includes(value)) throw new WordforgeDraftError(`${at} is invalid`);
};
const stringArray = (value: unknown, at: string, maxItems: number, maxString: number): string[] => {
  if (!Array.isArray(value) || value.length > maxItems) throw new WordforgeDraftError(`${at} must contain at most ${maxItems} strings`);
  value.forEach((item, index) => string(item, `${at}[${index}]`, maxString));
  return value as string[];
};

// A prose block carries `noTerms: true` to keep its tea terms from opening
// glossary pop-ups (the reader links them automatically otherwise).
function optionalNoTerms(value: unknown, at: string): void {
  if (value !== undefined && typeof value !== 'boolean') throw new WordforgeDraftError(`${at}.noTerms must be a boolean`);
}

function decodeBlock(value: unknown, index: number): ArticleBlock {
  const block = object(value, `article.blocks[${index}]`);
  const at = `article.blocks[${index}]`;
  if (typeof block.type !== 'string') throw new WordforgeDraftError(`${at}.type is required`);
  switch (block.type) {
    case 'cover':
      exact(block, ['type', 'variant', 'title', 'subtitle', 'image', 'kicker'], at);
      string(block.title, `${at}.title`, 200);
      optionalString(block.subtitle, `${at}.subtitle`, 300);
      optionalString(block.image, `${at}.image`, 2048);
      optionalString(block.kicker, `${at}.kicker`, 100);
      if (block.variant !== undefined) enumValue(block.variant, ['main', 'photo_inset', 'minimal', 'masthead'], `${at}.variant`);
      break;
    case 'intro':
      exact(block, ['type', 'text', 'noTerms'], at);
      string(block.text, `${at}.text`, 600);
      optionalNoTerms(block.noTerms, at);
      break;
    case 'section_heading':
      exact(block, ['type', 'text'], at);
      string(block.text, `${at}.text`, 600);
      break;
    case 'paragraph':
      exact(block, ['type', 'variant', 'text', 'textEffect', 'noTerms'], at);
      string(block.text, `${at}.text`, 600);
      optionalNoTerms(block.noTerms, at);
      if (block.variant !== undefined) enumValue(block.variant, ['single', 'double', 'justified', 'center', 'drop_cap'], `${at}.variant`);
      if (block.textEffect !== undefined) enumValue(block.textEffect, [
        'none', 'scroll-highlight', 'word-rise', 'shimmer', 'blur-focus',
        'line-stagger', 'scale-jump', 'color-wipe', 'underline-draw', 'letter-expand',
      ], `${at}.textEffect`);
      break;
    case 'qa_pair': {
      exact(block, ['type', 'items'], at);
      if (!Array.isArray(block.items) || block.items.length !== 1) throw new WordforgeDraftError(`${at}.items must contain exactly one Q&A item`);
      const item = object(block.items[0], `${at}.items[0]`);
      exact(item, ['q', 'a'], `${at}.items[0]`);
      string(item.q, `${at}.items[0].q`, 300);
      string(item.a, `${at}.items[0].a`, 600);
      break;
    }
    case 'quote':
      exact(block, ['type', 'variant', 'text', 'attribution', 'noTerms'], at);
      string(block.text, `${at}.text`, 600);
      optionalNoTerms(block.noTerms, at);
      optionalString(block.attribution, `${at}.attribution`, 200);
      if (block.variant !== undefined) enumValue(block.variant, ['big', 'minimal'], `${at}.variant`);
      break;
    case 'image':
      exact(block, ['type', 'variant', 'url', 'images', 'description', 'caption'], at);
      if (block.url === undefined && block.images === undefined) throw new WordforgeDraftError(`${at} requires url or images`);
      optionalString(block.url, `${at}.url`, 2048);
      if (block.images !== undefined) stringArray(block.images, `${at}.images`, 12, 2048);
      if (typeof block.description !== 'string' || block.description.length > 500) throw new WordforgeDraftError(`${at}.description must be a string of at most 500 characters`);
      optionalString(block.caption, `${at}.caption`, 500);
      if (block.variant !== undefined) enumValue(block.variant, ['full_bleed', 'caption_bottom', 'split_vertical', 'film_strip', 'polaroid_scatter', 'circle_mask', 'arch_mask', 'book_plate', 'pinned_hero'], `${at}.variant`);
      break;
    case 'pull_sidebar':
      exact(block, ['type', 'side', 'body', 'sidebar', 'image'], at);
      enumValue(block.side, ['left', 'right', 'image'], `${at}.side`);
      string(block.body, `${at}.body`, 600);
      string(block.sidebar, `${at}.sidebar`, 600);
      optionalString(block.image, `${at}.image`, 2048);
      break;
    case 'epilogue':
      exact(block, ['type', 'text', 'signature', 'noTerms'], at);
      string(block.text, `${at}.text`, 600);
      optionalNoTerms(block.noTerms, at);
      optionalString(block.signature, `${at}.signature`, 200);
      break;
    case 'back_matter':
      exact(block, ['type', 'variant', 'lines'], at);
      enumValue(block.variant, ['copyright', 'dedication'], `${at}.variant`);
      stringArray(block.lines, `${at}.lines`, 20, 300);
      break;
    default:
      throw new WordforgeDraftError(`${at}.type is unsupported`);
  }
  return block as ArticleBlock;
}

export function decodeWordforgeDraft(input: unknown): TeajiaWordforgeDraftV1 {
  const root = object(input, 'payload');
  exact(root, ['schema_version', 'source', 'article'], 'payload');
  if (root.schema_version !== 1) throw new WordforgeDraftError('schema_version must be 1');
  const source = object(root.source, 'source');
  exact(source, ['system', 'id', 'revision', 'content_hash'], 'source');
  if (source.system !== 'wordforge') throw new WordforgeDraftError('source.system must be wordforge');
  string(source.id, 'source.id', 200);
  if (!Number.isSafeInteger(source.revision) || (source.revision as number) <= 0) throw new WordforgeDraftError('source.revision must be a positive integer');
  if (typeof source.content_hash !== 'string' || !/^[a-f0-9]{64}$/.test(source.content_hash)) throw new WordforgeDraftError('source.content_hash must be a lowercase SHA-256 hash');

  const article = object(root.article, 'article');
  exact(article, ['title', 'subtitle', 'slug', 'category', 'tags', 'layout_template', 'cover_image_url', 'author_id', 'subject_ids', 'credits', 'blocks'], 'article');
  string(article.title, 'article.title', 200);
  string(article.subtitle, 'article.subtitle', 300, true);
  const slug = string(article.slug, 'article.slug', 120) as string;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new WordforgeDraftError('article.slug must be a lowercase URL slug');
  if (article.category !== 'interview') throw new WordforgeDraftError('article.category must be interview');
  stringArray(article.tags, 'article.tags', 20, 64);
  if (article.layout_template !== 'immersive') throw new WordforgeDraftError('article.layout_template must be immersive');
  string(article.cover_image_url, 'article.cover_image_url', 2048, true);
  string(article.author_id, 'article.author_id', 128, true);
  stringArray(article.subject_ids, 'article.subject_ids', 20, 128);
  stringArray(article.credits, 'article.credits', 20, 300);
  if (!Array.isArray(article.blocks) || article.blocks.length === 0 || article.blocks.length > 120) throw new WordforgeDraftError('article.blocks must contain 1 to 120 blocks');
  const blocks = article.blocks.map(decodeBlock);
  if (blocks[0].type !== 'cover' || blocks.slice(1).some(block => block.type === 'cover')) throw new WordforgeDraftError('article.blocks must contain exactly one cover as the first block');
  return input as TeajiaWordforgeDraftV1;
}

type WordforgeReceipt = {
  article_id: string;
  candidate_id: string | null;
  created: boolean;
  unchanged: boolean;
  source_revision: number;
};

type CurrentSource = {
  id: string;
  article_id: string;
  source_revision: number;
  content_hash: string;
  candidate_id: string | null;
  source_article_json: string | null;
};

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as JsonObject;
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

async function verifySourceHash(payload: TeajiaWordforgeDraftV1) {
  const { system, id, content_hash } = payload.source;
  const body = canonicalJson({ schema_version: payload.schema_version, source: { system, id }, article: payload.article });
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body)));
  const digest = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  if (digest !== content_hash) {
    throw new WordforgeDraftError('WordForge content hash does not match the article', 400, 'wordforge_content_hash_mismatch');
  }
}

function readSource(db: D1Database, accountId: string, sourceId: string) {
  return db.prepare(
    `SELECT s.id, s.article_id, s.source_revision, s.content_hash,
            r.id AS candidate_id, r.source_article_json
       FROM article_external_sources s
       LEFT JOIN wordforge_article_revisions r ON r.external_source_id = s.id AND r.source_revision = s.source_revision
      WHERE s.account_id = ? AND s.source_system = 'wordforge' AND s.source_id = ?`,
  ).bind(accountId, sourceId).first<CurrentSource>();
}

function revisionConflict() {
  return new WordforgeDraftError('WordForge source revision conflicts with the stored draft', 409, 'wordforge_revision_conflict');
}

function priorReceipt(current: CurrentSource, source: TeajiaWordforgeDraftV1['source']): WordforgeReceipt | null {
  if (source.revision > current.source_revision) return null;
  if (source.revision !== current.source_revision || source.content_hash !== current.content_hash) throw revisionConflict();
  return {
    article_id: current.article_id,
    candidate_id: current.candidate_id,
    created: false,
    unchanged: true,
    source_revision: current.source_revision,
  };
}

// Contributor visibility follows the same account ownership/association rule
// as the existing contributor picker. Reuse this check at the transactional write.
const CONTRIBUTOR_SCOPE = `NOT EXISTS (
  SELECT 1 FROM json_each(?) reference
   WHERE NOT EXISTS (
     SELECT 1 FROM contributors contributor
      WHERE contributor.id = reference.value AND (
        contributor.account_id = ? OR EXISTS (
          SELECT 1 FROM contributor_accounts association
           WHERE association.contributor_id = contributor.id AND association.account_id = ?
        )
      )
   )
)`;

export async function upsertWordforgeDraft(
  db: D1Database,
  accountId: string,
  payload: TeajiaWordforgeDraftV1,
): Promise<WordforgeReceipt> {
  await verifySourceHash(payload);
  const { source, article } = payload;
  const current = await readSource(db, accountId, source.id);
  if (current) {
    const prior = priorReceipt(current, source);
    if (prior) return prior;
  }
  const contributorIds = JSON.stringify([...new Set([
    ...(article.author_id ? [article.author_id] : []), ...article.subject_ids,
  ])]);
  const scope = await db.prepare(`SELECT ${CONTRIBUTOR_SCOPE} AS allowed`)
    .bind(contributorIds, accountId, accountId).first<{ allowed: number }>();
  if (!scope?.allowed) {
    throw new WordforgeDraftError('Article contributors must be associated with the destination account', 400, 'wordforge_contributor_scope');
  }
  const candidateId = crypto.randomUUID();
  const sourceArticleJson = JSON.stringify(article);
  const tags = JSON.stringify(article.tags);
  const blocks = JSON.stringify(article.blocks);
  const subjectIds = JSON.stringify(article.subject_ids);

  if (current) {
    const previousArticle = current.source_article_json
      ? JSON.parse(current.source_article_json) as TeajiaWordforgeDraftV1['article']
      : null;
    const [staged] = await db.batch([
      db.prepare(
        `INSERT INTO wordforge_article_revisions (id, external_source_id, source_revision, content_hash, assigned_slug, source_article_json)
         SELECT ?, s.id, ?, ?, a.slug, ?
           FROM article_external_sources s
           JOIN articles a ON a.id = s.article_id AND a.account_id = s.account_id
          WHERE s.id = ? AND s.account_id = ? AND s.source_revision = ? AND s.content_hash = ?
            AND ${CONTRIBUTOR_SCOPE}`,
      ).bind(candidateId, source.revision, source.content_hash, sourceArticleJson,
        current.id, accountId, current.source_revision, current.content_hash, contributorIds, accountId, accountId),
      db.prepare(
        `UPDATE article_external_sources SET source_revision = ?, content_hash = ?, last_synced_at = datetime('now'), updated_at = datetime('now')
          WHERE id = ? AND account_id = ? AND EXISTS (SELECT 1 FROM wordforge_article_revisions WHERE id = ?)`,
      ).bind(source.revision, source.content_hash, current.id, accountId, candidateId),
      // The legacy editor still reads the first draft from articles. Once an
      // article has gone live, incoming revisions belong only to the private
      // history until there is a revision-bound approval path.
      db.prepare(
        `UPDATE articles SET title = ?, subtitle = ?, category = ?, tags = ?, blocks = ?,
           cover_image_url = CASE WHEN ? IS NOT NULL AND cover_image_url IS ? THEN ? ELSE cover_image_url END,
           author_id = CASE WHEN ? IS NOT NULL AND author_id IS ? THEN ? ELSE author_id END,
           subject_ids = CASE WHEN subject_ids = ? THEN ? ELSE subject_ids END,
           updated_at = datetime('now')
          WHERE id = ? AND account_id = ? AND status = 'draft' AND published_at IS NULL
            AND EXISTS (SELECT 1 FROM wordforge_article_revisions WHERE id = ?)`,
      ).bind(article.title, article.subtitle, article.category, tags, blocks,
        current.candidate_id, previousArticle?.cover_image_url ?? null, article.cover_image_url,
        current.candidate_id, previousArticle?.author_id ?? null, article.author_id,
        previousArticle ? JSON.stringify(previousArticle.subject_ids) : null, subjectIds,
        current.article_id, accountId, candidateId),
    ]);
    if (staged.meta.changes === 1) {
      return { article_id: current.article_id, candidate_id: candidateId, created: false, unchanged: false, source_revision: source.revision };
    }

    const winner = await readSource(db, accountId, source.id);
    const replay = winner && priorReceipt(winner, source);
    if (replay) return replay;
    throw revisionConflict();
  }

  const articleId = crypto.randomUUID();
  const externalSourceId = crypto.randomUUID();
  try {
    const [created] = await db.batch([
      db.prepare(
        `INSERT INTO articles (id, account_id, title, subtitle, author_id, slug, status, category, tags, cover_image_url, blocks, layout_template, subject_ids)
         SELECT ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ? WHERE ${CONTRIBUTOR_SCOPE}`,
      ).bind(articleId, accountId, article.title, article.subtitle, article.author_id, article.slug,
        article.category, tags, article.cover_image_url, blocks, article.layout_template, subjectIds,
        contributorIds, accountId, accountId),
      db.prepare(
        `INSERT INTO article_external_sources (id, account_id, source_system, source_id, source_revision, content_hash, article_id)
         SELECT ?, ?, 'wordforge', ?, ?, ?, ? FROM articles WHERE id = ? AND account_id = ?`,
      ).bind(externalSourceId, accountId, source.id, source.revision, source.content_hash, articleId, articleId, accountId),
      db.prepare(
        `INSERT INTO wordforge_article_revisions (id, external_source_id, source_revision, content_hash, assigned_slug, source_article_json)
         SELECT ?, ?, ?, ?, ?, ? FROM article_external_sources WHERE id = ? AND account_id = ?`,
      ).bind(candidateId, externalSourceId, source.revision, source.content_hash, article.slug, sourceArticleJson,
        externalSourceId, accountId),
    ]);
    if (created.meta.changes !== 1) throw revisionConflict();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const slugClaimed = message.includes('UNIQUE constraint failed: articles.slug');
    const sourceClaimed = message.includes('UNIQUE constraint failed: article_external_sources.account_id');
    if (!slugClaimed && !sourceClaimed) throw error;
    // An identical first delivery normally collides on the slug before it
    // reaches the source uniqueness constraint. Classify the source first.
    const winner = await readSource(db, accountId, source.id);
    if (winner) {
      const replay = priorReceipt(winner, source);
      if (replay) return replay;
      throw revisionConflict();
    }
    if (!slugClaimed) throw error;
    throw new WordforgeDraftError('Article slug is already in use', 409, 'wordforge_slug_conflict');
  }
  return { article_id: articleId, candidate_id: candidateId, created: true, unchanged: false, source_revision: source.revision };
}

export async function isWordforgeManagedArticle(db: D1Database, accountId: string, articleId: string): Promise<boolean> {
  const row = await db.prepare(
    `SELECT 1 AS managed FROM article_external_sources
      WHERE account_id = ? AND article_id = ? AND source_system = 'wordforge'`,
  ).bind(accountId, articleId).first();
  return !!row;
}
