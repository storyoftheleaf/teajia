import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';
import { remapBlockIndexes } from '../src/articleWisdomClaimUses';

// Tea Wisdom pilot, Phase 3 (todo/plans/tea-wisdom-pilot-action-plan.md):
// an article records which Wisdom claim, at which revision, each block relies
// on. Contract: docs/_notes/tea-wisdom-claims.md, "Article claim uses".
// Driven through worker.fetch against a database built from the migrations,
// so the table under test is the one migration 0079 creates.

const SECRET = 'claim-uses-secret';
const SHOP = 'acc-one';
const OTHER = 'acc-other';
const databases: SqliteD1[] = [];
afterEach(() => { while (databases.length) databases.pop()!.close(); });

const BLOCKS = JSON.stringify([
  { type: 'intro', text: 'Two Gong Ting teas can differ in the cup.' },
  { type: 'section', heading: 'Start with the dry leaf', text: 'The Gong Ting row describes fine, tender material.' },
  { type: 'section', heading: 'Try two cups', text: 'Brew them side by side.' },
]);

function setup() {
  const db = new SqliteD1('migrations');
  databases.push(db);
  seedIdentity(db, { userId: 'editor', accountId: SHOP, role: 'owner' });
  seedIdentity(db, { userId: 'stranger', accountId: OTHER, role: 'owner' });
  const article = (id: string, account: string, status: string, slug = id) => db.sqlite.prepare(
    `INSERT INTO articles (id, account_id, title, slug, status, blocks) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, account, `Title ${id}`, slug, status, BLOCKS);
  article('grade-draft', SHOP, 'draft', 'what-a-ripe-puer-leaf-grade-can-tell-you');
  article('grade-live', SHOP, 'published', 'a-published-grade-piece');
  article('elsewhere', OTHER, 'draft');
  return { db, env: { DB: db as any, JWT_SECRET: SECRET } };
}

async function call(env: any, method: string, path: string, who: { userId: string; account: string } | null, body?: unknown) {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (who) {
    headers.set('Authorization', `Bearer ${await signedToken(SECRET, { sub: who.userId, email: `${who.userId}@test.dev`, name: who.userId, active_account_id: who.account, platform_role: null })}`);
    headers.set('X-Teajia-Account', who.account);
  }
  return worker.fetch(new Request(`https://worker.test${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), env);
}

const EDITOR = { userId: 'editor', account: SHOP };
const STRANGER = { userId: 'stranger', account: OTHER };
const USES = [
  { block_index: 0, claim_id: 'gong-ting:common-impressions', rev_used: 1, use_kind: 'prose' },
  { block_index: 1, claim_id: 'gong-ting:definition', rev_used: 1, use_kind: 'prose' },
  { block_index: 1, claim_id: 'special-grade:definition', rev_used: 1, use_kind: 'live_block' },
];

describe('article Wisdom claim uses', () => {
  it('replaces and lists an article’s uses for its own account', async () => {
    const { env } = setup();
    const put = await call(env, 'PUT', '/api/admin/articles/grade-draft/wisdom-claim-uses', EDITOR, { uses: USES });
    expect(put.status).toBe(200);
    const listed = await (await call(env, 'GET', '/api/admin/articles/grade-draft/wisdom-claim-uses', EDITOR)).json() as any;
    expect(listed.uses).toEqual([
      { article_id: 'grade-draft', block_index: 0, claim_id: 'gong-ting:common-impressions', rev_used: 1, use_kind: 'prose' },
      { article_id: 'grade-draft', block_index: 1, claim_id: 'gong-ting:definition', rev_used: 1, use_kind: 'prose' },
      { article_id: 'grade-draft', block_index: 1, claim_id: 'special-grade:definition', rev_used: 1, use_kind: 'live_block' },
    ]);

    // A second PUT replaces, it does not append.
    await call(env, 'PUT', '/api/admin/articles/grade-draft/wisdom-claim-uses', EDITOR, { uses: [USES[1]] });
    const after = await (await call(env, 'GET', '/api/admin/articles/grade-draft/wisdom-claim-uses', EDITOR)).json() as any;
    expect(after.uses.map((use: any) => use.claim_id)).toEqual(['gong-ting:definition']);
  });

  it('keeps another account out of the article and its uses', async () => {
    const { env, db } = setup();
    await call(env, 'PUT', '/api/admin/articles/grade-draft/wisdom-claim-uses', EDITOR, { uses: USES });
    expect((await call(env, 'GET', '/api/admin/articles/grade-draft/wisdom-claim-uses', STRANGER)).status).toBe(404);
    expect((await call(env, 'PUT', '/api/admin/articles/grade-draft/wisdom-claim-uses', STRANGER, { uses: [] })).status).toBe(404);
    expect((await call(env, 'GET', '/api/admin/articles/grade-draft/wisdom-claim-uses', null)).status).toBe(401);
    const stored = db.sqlite.prepare('SELECT COUNT(*) AS n FROM article_wisdom_claim_uses WHERE account_id = ?').get(SHOP) as { n: number };
    expect(stored.n).toBe(3);
    const stranger = await (await call(env, 'GET', '/api/admin/wisdom-claim-uses?page_id=gong-ting', STRANGER)).json() as any;
    expect(stranger.articles).toEqual([]);
  });

  it('refuses a use that points at a missing block, a bad claim id, revision or kind, or repeats itself', async () => {
    const { env, db } = setup();
    const refused = async (use: Record<string, unknown>, code: string) => {
      const response = await call(env, 'PUT', '/api/admin/articles/grade-draft/wisdom-claim-uses', EDITOR, { uses: [use] });
      expect(response.status).toBe(400);
      expect(((await response.json()) as any).code).toBe(code);
    };
    await refused({ ...USES[1], block_index: 3 }, 'invalid_block_index');
    await refused({ ...USES[1], claim_id: 'gong-ting' }, 'invalid_claim_id');
    await refused({ ...USES[1], rev_used: 0 }, 'invalid_rev_used');
    await refused({ ...USES[1], use_kind: 'quote' }, 'invalid_use_kind');
    const twice = await call(env, 'PUT', '/api/admin/articles/grade-draft/wisdom-claim-uses', EDITOR, { uses: [USES[1], USES[1]] });
    expect(((await twice.json()) as any).code).toBe('duplicate_use');
    const stored = db.sqlite.prepare('SELECT COUNT(*) AS n FROM article_wisdom_claim_uses').get() as { n: number };
    expect(stored.n).toBe(0);
  });

  it('serves a draft’s uses to its editor and never to a signed-out reader', async () => {
    const { env } = setup();
    await call(env, 'PUT', '/api/admin/articles/grade-draft/wisdom-claim-uses', EDITOR, { uses: USES });
    await call(env, 'PUT', '/api/admin/articles/grade-live/wisdom-claim-uses', EDITOR, { uses: [
      USES[1],
      { ...USES[1], claim_id: 'menghai-county:scope' },
      { ...USES[1], claim_id: 'menghai-county:unpublished' },
    ] });

    const admin = await (await call(env, 'GET', '/api/admin/wisdom-claim-uses?page_id=gong-ting', EDITOR)).json() as any;
    expect(admin.articles.map((article: any) => [article.id, article.status])).toEqual([
      ['grade-draft', 'draft'],
      ['grade-live', 'published'],
    ]);
    expect(admin.articles[0].claim_ids).toEqual(['gong-ting:common-impressions', 'gong-ting:definition', 'special-grade:definition']);

    // Gong Ting is public, so a reader sees the published article that cites it, never the draft.
    const reader = await (await call(env, 'GET', '/api/wisdom/claim-uses/articles?page_id=gong-ting', null)).json() as any;
    expect(reader.articles.map((article: any) => article.id)).toEqual(['grade-live']);
    const owner = await (await call(env, 'GET', '/api/admin/articles/grade-live/wisdom-claim-uses', EDITOR)).json() as any;
    expect(owner.history.map((entry: any) => entry.claim_id)).toEqual(['gong-ting:definition', 'menghai-county:scope']);
    expect(owner.history[1]).toMatchObject({ claim_id: 'menghai-county:scope', rev_used: 1, withdrawn: false });
    expect(owner.history[1].text.length).toBeGreaterThan(0);
    const published = await (await call(env, 'GET', '/api/wisdom/claim-uses/articles?page_id=menghai-county', null)).json() as any;
    expect(published.articles).toEqual([
      { id: 'grade-live', title: 'Title grade-live', slug: 'a-published-grade-piece', claim_ids: ['gong-ting:definition', 'menghai-county:scope'] },
    ]);

    // The draft itself is not found for a signed-out reader.
    expect((await call(env, 'GET', '/api/articles/what-a-ripe-puer-leaf-grade-can-tell-you', null)).status).toBe(404);

    // The published article carries its uses.
    const live = await (await call(env, 'GET', '/api/articles/a-published-grade-piece', null)).json() as any;
    expect(live.wisdom_claim_uses).toEqual([
      { article_id: 'grade-live', block_index: 1, claim_id: 'gong-ting:definition', rev_used: 1, use_kind: 'prose' },
      { article_id: 'grade-live', block_index: 1, claim_id: 'menghai-county:scope', rev_used: 1, use_kind: 'prose' },
    ]);
  });

  it('answers a page id that is not a slug with a plain refusal', async () => {
    const { env } = setup();
    const response = await call(env, 'GET', '/api/wisdom/claim-uses/articles?page_id=gong%25', null);
    expect(response.status).toBe(400);
  });
});

describe('claim uses follow their blocks', () => {
  const block = (id: string | null, text: string) => (id ? { type: 'paragraph', text, blockId: id } : { type: 'paragraph', text });

  it('maps by block id, drops a removed block, and finds an id-less block by its content', () => {
    expect(remapBlockIndexes(
      [block('a', 'one'), block('b', 'two'), block('c', 'three')],
      [block('c', 'three, edited'), block('new', 'inserted'), block('a', 'one')],
    )).toEqual([2, null, 0]);
    // Saved before ids existed: the first save with ids still finds each block.
    expect(remapBlockIndexes(
      [block(null, 'one'), block(null, 'two')],
      [block('y', 'two'), block('x', 'one')],
    )).toEqual([1, 0]);
  });

  it('moves the stored uses when a save reorders, inserts and deletes blocks', async () => {
    const { env, db } = setup();
    const blocks = [
      { type: 'intro', text: 'Two Gong Ting teas can differ in the cup.', blockId: 'intro' },
      { type: 'paragraph', text: 'Gong Ting names fine, tender leaf.', blockId: 'grades' },
      { type: 'paragraph', text: 'Brew them side by side.', blockId: 'exercise' },
    ];
    // A save names the version it was made against, so each one reads the article first.
    const review = async () => (await (await call(env, 'GET', '/api/admin/articles/grade-draft', EDITOR)).json() as { review_digest: string }).review_digest;
    expect((await call(env, 'PUT', '/api/admin/articles/grade-draft', EDITOR, { blocks, review_digest: await review() })).status).toBe(200);
    await call(env, 'PUT', '/api/admin/articles/grade-draft/wisdom-claim-uses', EDITOR, { uses: [
      { block_index: 0, claim_id: 'gong-ting:common-impressions', rev_used: 1, use_kind: 'prose' },
      { block_index: 1, claim_id: 'gong-ting:definition', rev_used: 1, use_kind: 'prose' },
      { block_index: 2, claim_id: 'gong-ting:blending', rev_used: 1, use_kind: 'prose' },
    ] });
    // A new block on top, the grade paragraph moved last, the intro deleted.
    const next = [
      { type: 'section_heading', text: 'A new heading', blockId: 'heading' },
      blocks[2],
      blocks[1],
    ];
    expect((await call(env, 'PUT', '/api/admin/articles/grade-draft', EDITOR, { blocks: next, review_digest: await review() })).status).toBe(200);
    const rows = db.sqlite.prepare('SELECT block_index, claim_id FROM article_wisdom_claim_uses ORDER BY block_index').all();
    expect(rows).toEqual([
      { block_index: 1, claim_id: 'gong-ting:blending' },
      { block_index: 2, claim_id: 'gong-ting:definition' },
    ]);
  });
});
