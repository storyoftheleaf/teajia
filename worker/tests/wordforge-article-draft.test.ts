import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import worker from '../src/index';
import { decodeWordforgeDraft, upsertWordforgeDraft } from '../src/wordforgeArticleDraft';
import { seedIdentity, signedToken, SqliteD1 } from './helpers/sqliteD1';
import { hashWordforgeDraft } from './helpers/wordforgeDraftHash';

const fixture = JSON.parse(readFileSync(join(process.cwd(), 'worker/tests/fixtures/teajia-wordforge-draft.v1.json'), 'utf8'));
const integrationEnv = (db: SqliteD1, overrides: Record<string, unknown> = {}) => ({
  DB: db,
  WORDFORGE_INTEGRATION_TOKEN: 'receiver-secret',
  WORDFORGE_ACCOUNT_ID: 'acc-wordforge',
  ...overrides,
}) as any;

function request(payload: unknown = fixture, token = 'receiver-secret', sourceId = fixture.source.id) {
  return new Request(`https://worker.test/api/integrations/wordforge/articles/${sourceId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

describe('WordForge draft decoder', () => {
  it('accepts the canonical handoff fixture', () => {
    expect(decodeWordforgeDraft(fixture)).toEqual(fixture);
    expect(fixture.article.blocks.map((block: { type: string }) => block.type)).toEqual([
      'cover', 'intro', 'paragraph', 'section_heading', 'qa_pair',
      'quote', 'image', 'pull_sidebar', 'epilogue', 'back_matter',
    ]);
  });

  it.each(['account_id', 'status', 'published_at'] as const)('rejects caller-controlled %s', field => {
    const payload = structuredClone(fixture);
    payload.article[field] = field === 'account_id' ? 'another-account' : 'published';
    expect(() => decodeWordforgeDraft(payload)).toThrow(/unknown field/i);
  });

  it('accepts exact paragraph and pull-sidebar shapes', () => {
    const payload = structuredClone(fixture);
    payload.article.blocks = [
      fixture.article.blocks[0],
      { type: 'paragraph', variant: 'drop_cap', text: 'A bounded narrative page.', textEffect: 'letter-expand' },
      { type: 'pull_sidebar', side: 'image', body: 'Weather at elevation', sidebar: 'Cloud redraws the picking window.', image: 'https://images.example.test/cloud.jpg' },
    ];
    expect(decodeWordforgeDraft(payload).article.blocks).toEqual(payload.article.blocks);
  });

  it('carries a prose block opting out of tea-term pop-ups, and only as a boolean', () => {
    const payload = structuredClone(fixture);
    payload.article.blocks = [
      fixture.article.blocks[0],
      { type: 'paragraph', text: 'A gaiwan the writer wants left plain.', noTerms: true },
      { type: 'quote', text: 'Pour from the gaiwan.', noTerms: false },
    ];
    expect(decodeWordforgeDraft(payload).article.blocks).toEqual(payload.article.blocks);
    const bad = structuredClone(payload);
    (bad.article.blocks[1] as { noTerms: unknown }).noTerms = 'yes';
    expect(() => decodeWordforgeDraft(bad)).toThrow(/noTerms must be a boolean/);
  });

  it('rejects unknown blocks, prose over 600 characters, invalid sidebar shapes, and multi-item Q&A blocks', () => {
    for (const block of [
      { type: 'video', url: 'https://example.test' },
      { type: 'intro', text: 'x'.repeat(601) },
      { type: 'paragraph', text: 'x'.repeat(601) },
      { type: 'paragraph', variant: 'grid', text: 'bounded' },
      { type: 'paragraph', text: 'bounded', textEffect: 'fireworks' },
      { type: 'paragraph', text: 'bounded', surprise: true },
      { type: 'pull_sidebar', side: 'middle', body: 'Title', sidebar: 'Aside' },
      { type: 'pull_sidebar', side: 'right', body: 'x'.repeat(601), sidebar: 'Aside' },
      { type: 'pull_sidebar', side: 'right', body: 'Title', sidebar: 'x'.repeat(601) },
      { type: 'pull_sidebar', side: 'right', body: 'Title', sidebar: 'Aside', surprise: true },
      { type: 'qa_pair', items: [{ q: 'One?', a: 'One.' }, { q: 'Two?', a: 'Two.' }] },
    ]) {
      const payload = structuredClone(fixture);
      payload.article.blocks = [fixture.article.blocks[0], block];
      expect(() => decodeWordforgeDraft(payload)).toThrow();
    }
  });
});

describe('PUT WordForge article draft integration', () => {
  it('requires configured bearer authentication', async () => {
    const db = new SqliteD1();
    expect((await worker.fetch(request(fixture, ''), integrationEnv(db))).status).toBe(401);
    expect((await worker.fetch(request(fixture, 'wrong'), integrationEnv(db))).status).toBe(401);
    expect((await worker.fetch(request(), integrationEnv(db, { WORDFORGE_INTEGRATION_TOKEN: undefined }))).status).toBe(503);
    db.close();
  });

  it('creates once, no-ops an identical revision, and updates the same draft for a newer revision', async () => {
    const db = new SqliteD1('migrations');
    db.sqlite.prepare("INSERT INTO accounts (id, slug, name, status) VALUES (?, ?, ?, 'active')").run('acc-wordforge', 'wordforge', 'WordForge');
    const first = await worker.fetch(request(), integrationEnv(db));
    expect(first.status).toBe(201);
    const created = await first.json() as any;
    expect(created).toMatchObject({ created: true, unchanged: false, source_revision: 1, candidate_id: expect.any(String) });
    expect(db.sqlite.prepare('SELECT status, account_id FROM articles WHERE id = ?').get(created.article_id)).toMatchObject({ status: 'draft', account_id: 'acc-wordforge' });

    const same = await worker.fetch(request(), integrationEnv(db));
    expect(same.status).toBe(200);
    expect(await same.json()).toMatchObject({ article_id: created.article_id, candidate_id: created.candidate_id, created: false, unchanged: true });

    const newer = structuredClone(fixture);
    newer.source.revision = 2;
    newer.article.title = 'Listening to the Mountain, Revised';
    newer.source.content_hash = hashWordforgeDraft(newer);
    const updated = await worker.fetch(request(newer), integrationEnv(db));
    expect(updated.status).toBe(200);
    expect(await updated.json()).toMatchObject({ article_id: created.article_id, source_revision: 2, unchanged: false });
    expect(db.sqlite.prepare('SELECT title, status FROM articles WHERE id = ?').get(created.article_id)).toMatchObject({ title: newer.article.title, status: 'draft' });
    expect((await worker.fetch(request(), integrationEnv(db))).status).toBe(409);
    db.close();
  });

  it('rejects conflicting revisions and source IDs', async () => {
    const db = new SqliteD1('migrations');
    db.sqlite.prepare("INSERT INTO accounts (id, slug, name, status) VALUES (?, ?, ?, 'active')").run('acc-wordforge', 'wordforge', 'WordForge');
    expect((await worker.fetch(request(fixture, 'receiver-secret', 'different'), integrationEnv(db))).status).toBe(400);
    expect((await worker.fetch(request(), integrationEnv(db))).status).toBe(201);
    const conflict = structuredClone(fixture);
    conflict.article.title = 'Different content with a reused revision';
    const badHash = await worker.fetch(request(conflict), integrationEnv(db));
    expect(badHash.status).toBe(400);
    expect(await badHash.json()).toMatchObject({ code: 'wordforge_content_hash_mismatch' });
    conflict.source.content_hash = hashWordforgeDraft(conflict);
    expect((await worker.fetch(request(conflict), integrationEnv(db))).status).toBe(409);
    const stale = structuredClone(fixture);
    stale.source.revision = 0;
    expect((await worker.fetch(request(stale), integrationEnv(db))).status).toBe(400);
    db.close();
  });

  it('rejects bodies larger than 256 KB', async () => {
    const db = new SqliteD1();
    const huge = new Request(`https://worker.test/api/integrations/wordforge/articles/${fixture.source.id}`, {
      method: 'PUT', headers: { Authorization: 'Bearer receiver-secret' }, body: 'x'.repeat(256 * 1024 + 1),
    });
    expect((await worker.fetch(huge, integrationEnv(db))).status).toBe(413);
    db.close();
  });
});

describe('WordForge-managed article administration', () => {
  it('protects external prose while leaving presentation and publication under Teajia control', async () => {
    const db = new SqliteD1('migrations');
    const identity = seedIdentity(db, { accountId: 'acc-wordforge', bundles: ['publish'] });
    const received = await worker.fetch(request(), integrationEnv(db));
    const { article_id: articleId } = await received.json() as any;
    const token = await signedToken('jwt-secret', { sub: identity.userId, email: identity.email, active_account_id: identity.accountId });
    const admin = (path: string, method: string, body?: object) => worker.fetch(new Request(`https://worker.test${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'X-Teajia-Account': identity.accountId, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    }), { DB: db, JWT_SECRET: 'jwt-secret' } as any);

    const articlePath = `/api/admin/articles/${articleId}`;
    const review = async () => (await (await admin(articlePath, 'GET')).json() as { review_digest: string }).review_digest;
    const protectedUpdate = await admin(articlePath, 'PUT', { title: 'Locally rewritten', review_digest: await review() });
    expect(protectedUpdate.status).toBe(409);
    expect(await protectedUpdate.json()).toMatchObject({ code: 'externally_managed_article' });

    const presentation = await admin(`/api/admin/articles/${articleId}`, 'PUT', {
      cover_image_url: 'https://images.example.test/local-cover.jpg', layout_template: 'immersive_scroll', reading_time_mins: 8,
      review_digest: await review(),
    });
    expect(presentation.status).toBe(200);
    expect(await presentation.json()).toMatchObject({ cover_image_url: 'https://images.example.test/local-cover.jpg', layout_template: 'immersive_scroll', reading_time_mins: 8 });

    const revision = structuredClone(fixture);
    revision.source.revision = 2;
    revision.article.title = 'Latest private draft';
    revision.article.cover_image_url = 'https://images.example.test/new-sender-cover.jpg';
    revision.source.content_hash = hashWordforgeDraft(revision);
    expect((await worker.fetch(request(revision), integrationEnv(db))).status).toBe(200);
    expect(await (await admin(`/api/admin/articles/${articleId}`, 'GET')).json()).toMatchObject({
      title: revision.article.title,
      cover_image_url: 'https://images.example.test/local-cover.jpg',
      layout_template: 'immersive_scroll',
      reading_time_mins: 8,
    });

    expect((await admin(`${articlePath}/publish`, 'POST', { review_digest: await review() })).status).toBe(200);
    expect(db.sqlite.prepare('SELECT status FROM articles WHERE id = ?').get(articleId)).toMatchObject({ status: 'published' });
    expect((await admin(`${articlePath}/unpublish`, 'POST', { review_digest: await review() })).status).toBe(200);
    expect(db.sqlite.prepare('SELECT status FROM articles WHERE id = ?').get(articleId)).toMatchObject({ status: 'draft' });
    db.close();
  });
});

describe('a WordForge re-sync keeps Wisdom claim uses on their blocks', () => {
  it('moves each use with its block when the sync reorders the story', async () => {
    const db = new SqliteD1();
    seedIdentity(db, { userId: 'editor', accountId: 'acc-one' });
    const first = decodeWordforgeDraft(structuredClone(fixture));
    const { article_id } = await upsertWordforgeDraft(db as any, 'acc-one', first);
    const blocks = first.article.blocks;
    // The intro (block 1) and the quote (block 5) each carry a claim.
    db.exec(`INSERT INTO article_wisdom_claim_uses (account_id, article_id, block_index, claim_id, rev_used, use_kind) VALUES
      ('acc-one', '${article_id}', 1, 'shou:wet-piling', 1, 'prose'),
      ('acc-one', '${article_id}', 5, 'gong-ting:definition', 1, 'prose')`);
    const next = structuredClone(first);
    next.source.revision = 2;
    // Move the quote to directly after the cover; everything else shifts down one.
    next.article.blocks = [blocks[0], blocks[5], ...blocks.slice(1, 5), ...blocks.slice(6)];
    next.source.content_hash = hashWordforgeDraft(next);
    await upsertWordforgeDraft(db as any, 'acc-one', next);
    const rows = db.sqlite.prepare('SELECT block_index, claim_id FROM article_wisdom_claim_uses ORDER BY block_index').all();
    expect(rows).toEqual([
      { block_index: 1, claim_id: 'gong-ting:definition' },
      { block_index: 2, claim_id: 'shou:wet-piling' },
    ]);
  });
});
