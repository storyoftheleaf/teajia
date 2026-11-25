import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1 } from './helpers/sqliteD1';
import { hashWordforgeDraft } from './helpers/wordforgeDraftHash';
import type { TeajiaWordforgeDraftV1 } from '../src/wordforgeArticleDraft';

const fixture: TeajiaWordforgeDraftV1 = JSON.parse(readFileSync(
  join(process.cwd(), 'worker/tests/fixtures/teajia-wordforge-draft.v1.json'), 'utf8',
));
const databases: SqliteD1[] = [];
afterEach(() => databases.splice(0).forEach(db => db.close()));

function database() {
  const db = new SqliteD1('migrations');
  databases.push(db);
  db.sqlite.exec(`INSERT INTO accounts (id, slug, name, status) VALUES
    ('acc-editorial', 'editorial', 'Invented editorial account', 'active'),
    ('acc-other', 'other', 'Invented other account', 'active')`);
  db.sqlite.exec(`INSERT INTO contributors (id, account_id, display_name) VALUES
    ('local-author', 'acc-editorial', 'Invented author'),
    ('foreign-person', 'acc-other', 'Invented other person')`);
  return db;
}

function edition(id: string, slug: string) {
  const payload = structuredClone(fixture);
  payload.source.id = id;
  payload.article.slug = slug;
  payload.source.content_hash = hashWordforgeDraft(payload);
  return payload;
}

function send(db: SqliteD1, payload: TeajiaWordforgeDraftV1, accountId = 'acc-editorial') {
  payload.source.content_hash = hashWordforgeDraft(payload);
  return worker.fetch(new Request(`https://worker.test/api/integrations/wordforge/articles/${payload.source.id}`, {
    method: 'PUT',
    headers: { Authorization: 'Bearer synthetic-intake-token', 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }), { DB: db, WORDFORGE_INTEGRATION_TOKEN: 'synthetic-intake-token', WORDFORGE_ACCOUNT_ID: accountId } as any);
}

function counts(db: SqliteD1) {
  return ['articles', 'article_external_sources', 'wordforge_article_revisions'].map(table =>
    (db.sqlite.prepare(`SELECT count(*) AS total FROM ${table}`).get() as { total: number }).total);
}

describe('Magazine intake identity and contributor acceptance', () => {
  it('keeps two output IDs from the same source family distinct and preserves the assigned address on rename', async () => {
    const db = database();
    const first = edition('invented-interview:article-one', 'invented-article-one');
    const second = edition('invented-interview:article-two', 'invented-article-two');
    const a = await (await send(db, first)).json() as any;
    const b = await (await send(db, second)).json() as any;
    expect(a.article_id).not.toBe(b.article_id);
    first.source.revision = 2;
    first.article.title = 'A renamed invented article';
    first.article.slug = 'new-requested-slug';
    const renamed = await send(db, first);
    expect(renamed.status).toBe(200);
    expect(await renamed.json()).toMatchObject({ article_id: a.article_id, source_revision: 2 });
    expect(db.sqlite.prepare('SELECT slug FROM articles WHERE id = ?').get(a.article_id)).toEqual({ slug: 'invented-article-one' });
    expect(db.sqlite.prepare('SELECT slug FROM articles WHERE id = ?').get(b.article_id)).toEqual({ slug: 'invented-article-two' });
    expect(counts(db)).toEqual([2, 2, 3]);
  });

  it('rolls back a conflicting slug without leaving a source or revision behind', async () => {
    const db = database();
    const first = await send(db, edition('first-output', 'occupied-address'));
    expect(first.status).toBe(201);
    const conflict = await send(db, edition('second-output', 'occupied-address'));
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toMatchObject({ code: 'wordforge_slug_conflict' });
    expect(counts(db)).toEqual([1, 1, 1]);
  });

  it('settles concurrent identical first deliveries on one draft and candidate receipt', async () => {
    const db = database();
    const payload = edition('concurrent-first-output', 'concurrent-first-output');
    const responses = await Promise.all([send(db, payload), send(db, structuredClone(payload))]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 201]);
    const receipts = await Promise.all(responses.map(response => response.json())) as any[];
    expect(receipts[0].article_id).toBe(receipts[1].article_id);
    expect(receipts[0].candidate_id).toBe(receipts[1].candidate_id);
    expect(counts(db)).toEqual([1, 1, 1]);
  });

  it('accepts only one conflicting first revision without partial source rows', async () => {
    const db = database();
    const first = edition('concurrent-conflicting-output', 'concurrent-conflicting-output');
    const second = structuredClone(first);
    second.article.title = 'A competing invented edition';
    const responses = await Promise.all([send(db, first), send(db, second)]);
    expect(responses.map(response => response.status).sort()).toEqual([201, 409]);
    const winner = responses[0].status === 201 ? first : second;
    expect(db.sqlite.prepare('SELECT title FROM articles').get()).toEqual({ title: winner.article.title });
    expect(counts(db)).toEqual([1, 1, 1]);
  });

  it('keeps the same output ID account-scoped without accepting a caller account override', async () => {
    const db = database();
    const first = await (await send(db, edition('shared-output-id', 'account-one-address'))).json() as any;
    const second = await (await send(db, edition('shared-output-id', 'account-two-address'), 'acc-other')).json() as any;
    expect(first.article_id).not.toBe(second.article_id);
    expect(db.sqlite.prepare('SELECT account_id FROM articles WHERE id = ?').get(first.article_id)).toEqual({ account_id: 'acc-editorial' });
    expect(db.sqlite.prepare('SELECT account_id FROM articles WHERE id = ?').get(second.article_id)).toEqual({ account_id: 'acc-other' });
    expect(counts(db)).toEqual([2, 2, 2]);
  });

  it.each(['author', 'subject'] as const)('refuses an unassociated other-account %s before any receipt is committed', async role => {
    const db = database();
    const payload = edition('foreign-reference', 'foreign-reference');
    if (role === 'author') payload.article.author_id = 'foreign-person';
    else payload.article.subject_ids = ['foreign-person'];
    const response = await send(db, payload);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'wordforge_contributor_scope' });
    expect(counts(db)).toEqual([0, 0, 0]);
  });

  it('accepts account-owned and explicitly associated contributors and retains exact source credits', async () => {
    const db = database();
    db.sqlite.exec("INSERT INTO contributor_accounts (contributor_id, account_id) VALUES ('foreign-person', 'acc-editorial')");
    const payload = edition('scoped-credits', 'scoped-credits');
    payload.article.author_id = 'local-author';
    payload.article.subject_ids = ['foreign-person'];
    payload.article.credits = ['Invented author — interview', 'Invented photographer — photographs'];
    const response = await send(db, payload);
    expect(response.status).toBe(201);
    const receipt = await response.json() as any;
    const candidate = db.sqlite.prepare('SELECT source_article_json FROM wordforge_article_revisions WHERE id = ?').get(receipt.candidate_id) as { source_article_json: string };
    expect(JSON.parse(candidate.source_article_json)).toEqual(payload.article);
  });

  it('refuses an invalid newer contributor reference without changing the existing draft or source revision', async () => {
    const db = database();
    const payload = edition('existing-output', 'existing-output');
    const first = await (await send(db, payload)).json() as any;
    const before = db.sqlite.prepare('SELECT * FROM articles WHERE id = ?').get(first.article_id);
    payload.source.revision = 2;
    payload.article.title = 'A refused revision';
    payload.article.author_id = 'foreign-person';
    expect((await send(db, payload)).status).toBe(400);
    expect(db.sqlite.prepare('SELECT * FROM articles WHERE id = ?').get(first.article_id)).toEqual(before);
    expect(db.sqlite.prepare('SELECT source_revision FROM article_external_sources WHERE article_id = ?').get(first.article_id)).toEqual({ source_revision: 1 });
    expect(counts(db)).toEqual([1, 1, 1]);
  });

  it('rechecks contributor association inside the first delivery transaction', async () => {
    const db = database();
    const payload = edition('first-delivery-race', 'first-delivery-race');
    payload.article.author_id = 'local-author';
    const batch = db.batch.bind(db);
    db.batch = statements => {
      db.sqlite.exec("UPDATE contributors SET account_id = 'acc-other' WHERE id = 'local-author'");
      return batch(statements);
    };
    const response = await send(db, payload);
    expect(response.status).toBe(409);
    expect(counts(db)).toEqual([0, 0, 0]);
  });

  it('refuses a newer revision when contributor scope changes at the transactional boundary', async () => {
    const db = database();
    const payload = edition('newer-delivery-race', 'newer-delivery-race');
    const first = await (await send(db, payload)).json() as any;
    const before = db.sqlite.prepare('SELECT * FROM articles WHERE id = ?').get(first.article_id);
    payload.source.revision = 2;
    payload.article.author_id = 'local-author';
    payload.article.title = 'A revision losing its contributor association';
    const batch = db.batch.bind(db);
    db.batch = statements => {
      db.sqlite.exec("UPDATE contributors SET account_id = 'acc-other' WHERE id = 'local-author'");
      return batch(statements);
    };
    expect((await send(db, payload)).status).toBe(409);
    expect(db.sqlite.prepare('SELECT * FROM articles WHERE id = ?').get(first.article_id)).toEqual(before);
    expect(counts(db)).toEqual([1, 1, 1]);
  });

  it('keeps an acknowledged receipt replayable after its contributor association is removed', async () => {
    const db = database();
    const payload = edition('acknowledged-output', 'acknowledged-output');
    payload.article.author_id = 'local-author';
    const first = await (await send(db, payload)).json() as any;
    db.sqlite.exec("UPDATE contributors SET account_id = 'acc-other' WHERE id = 'local-author'");
    const replay = await send(db, payload);
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({ article_id: first.article_id, candidate_id: first.candidate_id, unchanged: true });
    expect(counts(db)).toEqual([1, 1, 1]);
  });
});
