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
    case 'section_heading':
      exact(block, ['type', 'text'], at);
      string(block.text, `${at}.text`, 600);
      break;
    case 'paragraph':
      exact(block, ['type', 'variant', 'text', 'textEffect'], at);
      string(block.text, `${at}.text`, 600);
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
      exact(block, ['type', 'variant', 'text', 'attribution'], at);
      string(block.text, `${at}.text`, 600);
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
      exact(block, ['type', 'text', 'signature'], at);
      string(block.text, `${at}.text`, 600);
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

export async function upsertWordforgeDraft(
  db: D1Database,
  accountId: string,
  payload: TeajiaWordforgeDraftV1,
): Promise<{ article_id: string; created: boolean; unchanged: boolean; source_revision: number }> {
  const current = await db.prepare(
    `SELECT article_id, source_revision, content_hash FROM article_external_sources
      WHERE account_id = ? AND source_system = 'wordforge' AND source_id = ?`,
  ).bind(accountId, payload.source.id).first<{ article_id: string; source_revision: number; content_hash: string }>();

  if (current) {
    if (payload.source.revision < current.source_revision || (payload.source.revision === current.source_revision && payload.source.content_hash !== current.content_hash)) {
      throw new WordforgeDraftError('WordForge source revision conflicts with the stored draft', 409, 'wordforge_revision_conflict');
    }
    if (payload.source.revision === current.source_revision) {
      return { article_id: current.article_id, created: false, unchanged: true, source_revision: current.source_revision };
    }
    await db.batch([
      db.prepare(
        `UPDATE articles SET title = ?, subtitle = ?, author_id = ?, slug = ?, status = 'draft', category = ?, tags = ?,
          cover_image_url = ?, blocks = ?, layout_template = ?, subject_ids = ?, published_at = NULL, updated_at = datetime('now')
          WHERE id = ? AND account_id = ?`,
      ).bind(payload.article.title, payload.article.subtitle, payload.article.author_id, payload.article.slug, payload.article.category,
        JSON.stringify(payload.article.tags), payload.article.cover_image_url, JSON.stringify(payload.article.blocks), payload.article.layout_template,
        JSON.stringify(payload.article.subject_ids), current.article_id, accountId),
      db.prepare(
        `UPDATE article_external_sources SET source_revision = ?, content_hash = ?, last_synced_at = datetime('now'), updated_at = datetime('now')
          WHERE account_id = ? AND source_system = 'wordforge' AND source_id = ?`,
      ).bind(payload.source.revision, payload.source.content_hash, accountId, payload.source.id),
    ]);
    return { article_id: current.article_id, created: false, unchanged: false, source_revision: payload.source.revision };
  }

  const articleId = crypto.randomUUID();
  await db.batch([
    db.prepare(
      `INSERT INTO articles (id, account_id, title, subtitle, author_id, slug, status, category, tags, cover_image_url, blocks, layout_template, subject_ids)
       VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?)`,
    ).bind(articleId, accountId, payload.article.title, payload.article.subtitle, payload.article.author_id, payload.article.slug,
      payload.article.category, JSON.stringify(payload.article.tags), payload.article.cover_image_url, JSON.stringify(payload.article.blocks),
      payload.article.layout_template, JSON.stringify(payload.article.subject_ids)),
    db.prepare(
      `INSERT INTO article_external_sources (id, account_id, source_system, source_id, source_revision, content_hash, article_id)
       VALUES (?, ?, 'wordforge', ?, ?, ?, ?)`,
    ).bind(crypto.randomUUID(), accountId, payload.source.id, payload.source.revision, payload.source.content_hash, articleId),
  ]);
  return { article_id: articleId, created: true, unchanged: false, source_revision: payload.source.revision };
}

export async function isWordforgeManagedArticle(db: D1Database, accountId: string, articleId: string): Promise<boolean> {
  const row = await db.prepare(
    `SELECT 1 AS managed FROM article_external_sources
      WHERE account_id = ? AND article_id = ? AND source_system = 'wordforge'`,
  ).bind(accountId, articleId).first();
  return !!row;
}
