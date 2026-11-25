import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { writingToolModule } from '../src/mcpTools/writing';
import { decodeWordforgeDraft } from '../src/wordforgeArticleDraft';
import { seedIdentity, signedToken, SqliteD1 } from './helpers/sqliteD1';
import { hashWordforgeDraft } from './helpers/wordforgeDraftHash';

const editionA = decodeWordforgeDraft(JSON.parse(readFileSync(
  new URL('./fixtures/teajia-wordforge-draft.v1.json', import.meta.url),
  'utf8',
)));

function revisedEdition(revision: number) {
  const edition = structuredClone(editionA);
  edition.source.revision = revision;
  edition.article.title = `Listening to the Mountain, revision ${revision}`;
  edition.article.slug = `proposed-address-${revision}`;
  edition.article.blocks[0].title = edition.article.title;
  edition.article.blocks[1].text = `This introduction belongs to revision ${revision}.`;
  edition.source.content_hash = hashWordforgeDraft(edition);
  return edition;
}

let testDb: SqliteD1 | undefined;
afterEach(() => {
  testDb?.close();
  testDb = undefined;
});

async function fixture(native = false) {
  const db = testDb = new SqliteD1('migrations');
  const editor = seedIdentity(db, { accountId: 'acc-editorial-fixture', bundles: ['publish'] });
  const jwtSecret = 'editorial-fixture-jwt';
  const receiverSecret = 'editorial-fixture-wordforge';
  let nextBatchGate: (() => Promise<void>) | undefined;
  let beforePublicationWrite: (() => void) | undefined;
  const env = {
    DB: {
      prepare(sql: string) {
        if (sql.includes('UPDATE articles SET status')) {
          const hook = beforePublicationWrite;
          beforePublicationWrite = undefined;
          hook?.();
        }
        return db.prepare(sql);
      },
      async batch(statements: Parameters<SqliteD1['batch']>[0]) {
        const gate = nextBatchGate;
        nextBatchGate = undefined;
        if (gate) await gate();
        return db.batch(statements);
      },
    },
    JWT_SECRET: jwtSecret,
    WORDFORGE_ACCOUNT_ID: editor.accountId,
    WORDFORGE_INTEGRATION_TOKEN: receiverSecret,
  } as unknown as Parameters<typeof worker.fetch>[1];
  const jwt = await signedToken(jwtSecret, {
    sub: editor.userId,
    email: editor.email,
    active_account_id: editor.accountId,
  });

  function request(path: string, init?: RequestInit) {
    return worker.fetch(new Request(`https://worker.test${path}`, init), env);
  }

  function intake(edition: typeof editionA) {
    return request(`/api/integrations/wordforge/articles/${edition.source.id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${receiverSecret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(edition),
    });
  }

  const adminRequest = (path: string, method: string, body?: object) => request(path, {
    method,
    headers: { Authorization: `Bearer ${jwt}`, 'X-Teajia-Account': editor.accountId, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const received = native
    ? await adminRequest('/api/admin/articles', 'POST', { title: 'Native draft', slug: 'native-review' })
    : await intake(editionA);
  expect(received.status).toBe(201);
  const receipt = await received.json() as { article_id?: string; id?: string };
  const articleId = (native ? receipt.id : receipt.article_id)!;
  const admin = (method: string, suffix = '', body?: object) =>
    adminRequest(`/api/admin/articles/${articleId}${suffix}`, method, body);
  const readReview = async () => (await (await admin('GET')).json() as { review_digest: string }).review_digest;

  return {
    db,
    articleId,
    intake,
    admin,
    readReview,
    beforePublicationWrite: (hook: () => void) => { beforePublicationWrite = hook; },
    publicDetail: (slug = editionA.article.slug) => request(`/api/articles/${slug}`),
    publicList: () => request('/api/articles'),
    publish: async () => admin('POST', '/publish', { review_digest: await readReview() }),
    mcpEdit: (title: string, confirm?: string) => writingToolModule.handlers.update_article_draft(env, {
      accountId: editor.accountId, userId: editor.userId, userEmail: editor.email, creatorTier: 'owner', tokenId: 'editorial-fixture-mcp',
    }, { article_id: articleId, title, confirm }),
    mcpPublication: (published: boolean, confirm?: string) => writingToolModule.handlers.set_article_published(env, {
      accountId: editor.accountId,
      userId: editor.userId,
      userEmail: editor.email,
      creatorTier: 'owner',
      tokenId: 'editorial-fixture-mcp',
    }, { article_id: articleId, published, confirm }),
    pauseNextBatch() {
      const entered = Promise.withResolvers<void>();
      const resume = Promise.withResolvers<void>();
      nextBatchGate = () => {
        entered.resolve();
        return resume.promise;
      };
      return { entered: entered.promise, resume: resume.resolve };
    },
    revisions: () => db.sqlite.prepare(
      'SELECT id, source_revision, content_hash, assigned_slug, source_article_json FROM wordforge_article_revisions ORDER BY source_revision',
    ).all(),
  };
}

describe('WordForge article revision intake', () => {
  it('keeps the existing public address and bytes while the new edition is staged privately', async () => {
    const article = await fixture();
    expect((await article.publish()).status).toBe(200);
    // An existing public row has no private history before migration 0057.
    article.db.sqlite.exec('DELETE FROM wordforge_article_revisions');
    article.db.sqlite.prepare('UPDATE articles SET updated_at = ? WHERE id = ?')
      .run('2026-01-01 00:00:00', article.articleId);

    const originalDetail = await article.publicDetail();
    expect(originalDetail.status).toBe(200);
    const approved = await originalDetail.text();
    expect(JSON.parse(approved)).toMatchObject({
      id: article.articleId,
      title: editionA.article.title,
      slug: editionA.article.slug,
      blocks: editionA.article.blocks,
      published_at: expect.any(String),
    });
    const originalList = await (await article.publicList()).text();
    expect(JSON.parse(originalList)).toEqual([expect.objectContaining({ id: article.articleId, title: editionA.article.title })]);

    const editionB = revisedEdition(2);
    const received = await article.intake(editionB);
    expect(received.status).toBe(200);
    const receipt = await received.json();
    expect(receipt).toMatchObject({ article_id: article.articleId, candidate_id: expect.any(String), source_revision: 2 });

    const currentDetail = await article.publicDetail();
    expect(currentDetail.status).toBe(200);
    expect(await currentDetail.text()).toBe(approved);
    expect(await (await article.publicList()).text()).toBe(originalList);
    expect((await article.publicDetail(editionB.article.slug)).status).toBe(404);

    const staged = article.revisions();
    expect(staged).toEqual([{
      id: receipt.candidate_id,
      source_revision: 2,
      content_hash: editionB.source.content_hash,
      assigned_slug: editionA.article.slug,
      source_article_json: JSON.stringify(editionB.article),
    }]);
    const replay = await article.intake(editionB);
    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual({ ...receipt, unchanged: true });
    expect(article.revisions()).toEqual(staged);
  });

  it('commits only the winning source revision and candidate when two deliveries observe A', async () => {
    const article = await fixture();
    const a = article.revisions();
    const delayed = article.pauseNextBatch();
    const b = article.intake(revisedEdition(2));
    await delayed.entered;
    const editionC = revisedEdition(3);
    try {
      expect((await article.intake(editionC)).status).toBe(200);
    } finally {
      delayed.resume();
    }

    const lost = await b;
    expect(lost.status).toBe(409);
    expect(await lost.json()).toMatchObject({ code: 'wordforge_revision_conflict' });
    expect(article.revisions()).toEqual([
      ...a,
      expect.objectContaining({ source_revision: 3, content_hash: editionC.source.content_hash }),
    ]);
    expect(article.db.sqlite.prepare('SELECT source_revision, content_hash FROM article_external_sources').get())
      .toMatchObject({ source_revision: 3, content_hash: editionC.source.content_hash });
    expect(article.db.sqlite.prepare('SELECT title, slug, status FROM articles WHERE id = ?').get(article.articleId))
      .toMatchObject({ title: editionC.article.title, slug: editionA.article.slug, status: 'draft' });
    expect((await article.publicDetail()).status).toBe(404);
  });

  it('checks public status at the write when legacy publication wins just before intake', async () => {
    const article = await fixture();
    const delayed = article.pauseNextBatch();
    const b = article.intake(revisedEdition(2));
    await delayed.entered;
    // The single-row legacy publish uses run(), so it can win during the pause.
    try {
      expect((await article.publish()).status).toBe(200);
    } finally {
      delayed.resume();
    }

    expect((await b).status).toBe(200);
    expect(await (await article.publicDetail()).json()).toMatchObject({
      title: editionA.article.title,
      blocks: editionA.article.blocks,
    });
    expect(article.revisions()).toEqual([
      expect.objectContaining({ source_revision: 1, source_article_json: JSON.stringify(editionA.article) }),
      expect.objectContaining({ source_revision: 2, source_article_json: JSON.stringify(revisedEdition(2).article) }),
    ]);
  });

  it('requires a new MCP review when WordForge updates an unpublished draft after preview', async () => {
    const article = await fixture();
    const preview = await article.mcpPublication(true);
    expect(preview).toMatchObject({
      preview: { article: { id: article.articleId, title: editionA.article.title }, current_status: 'draft' },
      confirmation_token: expect.any(String),
    });

    expect((await article.intake(revisedEdition(2))).status).toBe(200);
    const stale = await article.mcpPublication(true, preview.confirmation_token);
    expect.soft(stale).toMatchObject({ error: 'stale_article_review' });
    expect((await article.publicDetail()).status).toBe(404);
  });

  it('refuses a stale MCP ticket even when a pending WordForge revision leaves the live row unchanged', async () => {
    const article = await fixture();
    expect((await article.publish()).status).toBe(200);
    const live = await (await article.publicDetail()).text();
    const preview = await article.mcpPublication(false);
    expect(preview).toMatchObject({ confirmation_token: expect.any(String) });

    expect((await article.intake(revisedEdition(2))).status).toBe(200);
    const stale = await article.mcpPublication(false, preview.confirmation_token);
    expect.soft(stale).toMatchObject({ error: 'stale_article_review' });
    expect(await (await article.publicDetail()).text()).toBe(live);
  });

  it('publishes the unchanged article when its MCP review is confirmed', async () => {
    const article = await fixture();
    const preview = await article.mcpPublication(true);
    expect(preview).toMatchObject({
      preview: {
        article: { title: editionA.article.title, blocks: editionA.article.blocks },
        review_digest: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
    });
    const confirmed = await article.mcpPublication(true, preview.confirmation_token);
    expect(confirmed).toMatchObject({ committed: true, article: { title: editionA.article.title, status: 'published' } });
    expect((await article.publicDetail()).status).toBe(200);
  });
});

describe('REST article publication reviews', () => {
  it('requires the scoped article detail review and blocks direct status/date writes', async () => {
    const article = await fixture();
    expect(await article.readReview()).toMatch(/^[a-f0-9]{64}$/);
    expect((await article.admin('POST', '/publish')).status).toBe(400);
    expect((await article.admin('PUT', '', { status: 'published' })).status).toBe(400);
    expect((await article.admin('PUT', '', { published_at: '2025-02-02' })).status).toBe(400);
    expect((await article.publicDetail()).status).toBe(404);
  });

  it('refuses publication after a newer WordForge draft arrives', async () => {
    const article = await fixture();
    const digest = await article.readReview();
    expect((await article.intake(revisedEdition(2))).status).toBe(200);
    const stale = await article.admin('POST', '/publish', { review_digest: digest });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ code: 'stale_article_review' });
    expect((await article.publicDetail()).status).toBe(404);
    expect((await article.publish()).status).toBe(200);
    expect(await (await article.publicDetail()).json()).toMatchObject({ title: revisedEdition(2).article.title });
  });

  it('rejects a stale native editor save and binds publication to the digest of the accepted save', async () => {
    const article = await fixture(true);
    const opening = await article.readReview();
    const save = await article.admin('PUT', '', {
      title: 'Accepted native draft', blocks: [{ type: 'paragraph', text: 'Accepted text' }], review_digest: opening,
    });
    expect(save.status).toBe(200);
    const { review_digest: saved } = await save.json() as { review_digest: string };
    expect(saved).not.toBe(opening);
    const staleSave = await article.admin('PUT', '', { title: 'Stale editor overwrite', review_digest: opening });
    expect(staleSave.status).toBe(409);
    expect((await article.admin('POST', '/publish', { review_digest: saved })).status).toBe(200);
    expect(await (await article.publicDetail('native-review')).json()).toMatchObject({
      title: 'Accepted native draft', blocks: [{ type: 'paragraph', text: 'Accepted text' }],
    });
  });

  it('guards withdrawal and archive at the write and preserves the first publication date', async () => {
    const article = await fixture();
    const published = await article.publish();
    expect(published.status).toBe(200);
    const { review_digest: reviewed } = await published.json() as { review_digest: string };
    const live = await (await article.publicDetail()).text();
    article.beforePublicationWrite(() => {
      article.db.sqlite.prepare('UPDATE article_external_sources SET source_revision = ? WHERE article_id = ?')
        .run(2, article.articleId);
    });
    const stale = await article.admin('POST', '/unpublish', { review_digest: reviewed });
    expect(stale.status).toBe(409);
    expect((await article.admin('DELETE', '', { review_digest: reviewed })).status).toBe(409);
    expect(await (await article.publicDetail()).text()).toBe(live);

    const withdrawn = await article.admin('POST', '/unpublish', { review_digest: await article.readReview() });
    expect(withdrawn.status).toBe(200);
    expect((await article.publicDetail()).status).toBe(404);
    expect((await article.publish()).status).toBe(200);
    // Return every other snapshot field to its original value. The publication counter
    // still invalidates the earlier review across a same-second withdrawal and re-publish.
    const original = JSON.parse(live);
    article.db.sqlite.prepare(`UPDATE articles SET updated_at = ? WHERE id = ?`).run(original.updated_at, article.articleId);
    article.db.sqlite.prepare(`UPDATE article_external_sources SET source_revision = '1' WHERE article_id = ?`).run(article.articleId);
    expect((await article.admin('POST', '/unpublish', { review_digest: reviewed })).status).toBe(409);
    expect(await (await article.publicDetail()).json()).toMatchObject({
      title: editionA.article.title, published_at: JSON.parse(live).published_at,
    });
  });
});

 describe('native published replacement isolation', () => {
  it('stages a new native edition privately and retains its original public URL until exact approval', async () => {
    const article = await fixture(true);
    expect((await article.publish()).status).toBe(200);
    const publicA = await (await article.publicDetail('native-review')).text();
    const opening = await article.readReview();
    const saved = await article.admin('PUT', '', { title: 'Private native B', slug: 'new-private-url', blocks: [{ type: 'paragraph', text: 'Private B' }], review_digest: opening });
    expect(saved.status).toBe(200);
    const b = await saved.json() as { review_digest: string };
    expect(await (await article.publicDetail('native-review')).text()).toBe(publicA);
    expect((await article.publicDetail('new-private-url')).status).toBe(404);
    expect((await article.admin('POST', '/publish', { review_digest: opening })).status).toBe(409);
    expect((await article.admin('POST', '/publish', { review_digest: b.review_digest })).status).toBe(200);
    expect(await (await article.publicDetail('native-review')).json()).toMatchObject({ title: 'Private native B', slug: 'native-review', blocks: [{ type: 'paragraph', text: 'Private B' }] });
    expect((await article.publicDetail('new-private-url')).status).toBe(404);
  });
 });

it('stages a confirmed MCP native edit and refuses a superseded preview', async () => {
  const article = await fixture(true);
  expect((await article.publish()).status).toBe(200);
  const original = await (await article.publicDetail('native-review')).text();
  const older = await article.mcpEdit('Older proposed');
  const preview = await article.mcpEdit('Private MCP B');
  expect(await article.mcpEdit('Private MCP B', preview.confirmation_token)).toMatchObject({ committed: true });
  expect(await (await article.publicDetail('native-review')).text()).toBe(original);
  expect(await article.mcpEdit('Older proposed', older.confirmation_token)).toMatchObject({ error: 'stale_article_review' });
  expect((await article.publish()).status).toBe(200);
  expect(await (await article.publicDetail('native-review')).json()).toMatchObject({ title: 'Private MCP B' });
});

it('refuses native B when C wins after its save read and before the staging write', async () => {
  const article = await fixture(true);
  expect((await article.publish()).status).toBe(200);
  const publicA = await (await article.publicDetail('native-review')).text();
  const opening = await article.readReview();
  const gate = article.pauseNextBatch();
  const savingB = article.admin('PUT', '', { title: 'Delayed native B', review_digest: opening });
  await gate.entered;
  try { expect((await article.admin('PUT', '', { title: 'Winning native C', review_digest: opening })).status).toBe(200); }
  finally { gate.resume(); }
  expect((await savingB).status).toBe(409);
  expect(await (await article.admin('GET')).json()).toMatchObject({title:'Winning native C',has_pending_revision:true});
  expect(await (await article.publicDetail('native-review')).text()).toBe(publicA);
});

it('refuses a native replacement changed between the publication read and write', async () => {
  const article = await fixture(true);
  expect((await article.publish()).status).toBe(200);
  const publicA = await (await article.publicDetail('native-review')).text();
  const save = await article.admin('PUT', '', {title:'Reviewed native B',review_digest:await article.readReview()});
  const b = await save.json() as {review_digest:string};
  article.beforePublicationWrite(() => {
    article.db.sqlite.prepare(`UPDATE article_native_drafts SET draft_json = json_set(draft_json, '$.title', 'Unreviewed native C') WHERE article_id = ?`).run(article.articleId);
  });
  expect((await article.admin('POST','/publish',{review_digest:b.review_digest})).status).toBe(409);
  expect(await (await article.publicDetail('native-review')).text()).toBe(publicA);
});
