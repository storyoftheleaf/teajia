import { beforeEach, describe, expect, it } from 'vitest';
import { SqliteD1 } from './helpers/sqliteD1';
import { writingToolModule } from '../src/mcpTools/writing';

/*
 * The writing tools are the first agent path to Adrian's journal and his sample
 * shelf, and both sit on tables that predate multi-tenancy. `articles` carries
 * `account_id TEXT NOT NULL DEFAULT 'acc_teajia_bali'` and the sample tables let
 * `account_id` be NULL, so on those tables a scoping mistake does not fail — it
 * silently files a row in one particular shop, or reads another shop's shelf.
 * That is what most of this suite is watching.
 *
 * The rest is the shape of the preview/confirm ticket, which lives in D1 rather
 * than in memory because Cloudflare may route the two calls to different
 * isolates. A ticket has to be single-use, bound to the token that issued it,
 * bound to its account, and bound to the row it named.
 */

const ACCOUNT = 'acc_test_shop';
const OTHER_ACCOUNT = 'acc_other_shop';

const auth = {
  accountId: ACCOUNT, userId: 'usr_adrian', userEmail: 'adrian@example.com',
  tokenId: 'tok_first', creatorTier: 'owner',
};
const siblingToken = { ...auth, tokenId: 'tok_second' };
const otherShop = { ...auth, accountId: OTHER_ACCOUNT };

const tools = writingToolModule.handlers as Record<string, any>;

let db: SqliteD1;
let env: any;

/** Preview then confirm, the way a client actually drives these. */
async function run(tool: string, actor: any, args: Record<string, unknown>) {
  const preview = await tools[tool](env, actor, args);
  if (preview?.error || !preview?.confirmation_token) return preview;
  return tools[tool](env, actor, { ...args, confirm: preview.confirmation_token });
}

beforeEach(() => {
  db = new SqliteD1();
  env = { DB: db };
  db.exec(`INSERT INTO accounts (id, name, slug) VALUES
    ('${ACCOUNT}', 'Test Shop', 'test-shop'),
    ('${OTHER_ACCOUNT}', 'Other Shop', 'other-shop')`);
});

describe('the module contract', () => {
  it('gives every tool a handler and every handler a definition', () => {
    const defNames = writingToolModule.defs.map(d => d.name).sort();
    expect(Object.keys(writingToolModule.handlers).sort()).toEqual(defNames);
  });

  it('asks for read scope on reads and write scope on writes', () => {
    const scopeOf = (name: string) => writingToolModule.defs.find(d => d.name === name)!.scope;
    // No content scope exists in MCP_SCOPES and one cannot be added from a
    // module, so these borrow the nearest. If that list ever grows a
    // `content:*` scope this is the assertion that should be updated with it.
    for (const read of ['list_articles', 'get_article', 'list_sample_sets', 'list_samples', 'get_sample']) {
      expect(scopeOf(read)).toBe('inventory:read');
    }
    // Publishing happens under Adrian's byline, so it is owner-tier.
    for (const write of ['create_article_draft', 'update_article_draft', 'set_article_published', 'draft_article_from_event']) {
      expect(scopeOf(write)).toBe('catalog:write');
    }
    // Moving a sample along the shelf is operator work, like add_stock.
    expect(scopeOf('set_sample_status')).toBe('stock:write');
  });
});

describe('article writes name their account', () => {
  it('never lets the articles default choose the shop', async () => {
    const created = await run('create_article_draft', auth, {
      title: 'The Old Gardens Above Yiwu',
      body: [{ type: 'intro', text: 'It rained for three days.' }],
    });
    const row = db.prepare('SELECT account_id, status, author_id FROM articles WHERE id = ?')
      .bind(created.article.id).first() as any;
    // The whole point: acc_teajia_bali is what an unnamed account_id would give.
    expect(row.account_id).toBe(ACCOUNT);
    expect(row.status).toBe('draft');
    // Author is the acting user, as the admin event-draft route also stamps it.
    expect(row.author_id).toBe('usr_adrian');
  });

  it('composes a cover from the title so the piece has one everywhere', async () => {
    const created = await run('create_article_draft', auth, {
      title: 'A Week On The Mountain', subtitle: 'Notes from Yiwu',
      body: [{ type: 'paragraph', text: 'Then it stopped.' }],
    });
    const blocks = created.article.blocks;
    expect(blocks[0]).toEqual({ type: 'cover', title: 'A Week On The Mountain', subtitle: 'Notes from Yiwu' });
    expect(blocks[1]).toEqual({ type: 'paragraph', text: 'Then it stopped.' });
  });

  it('dodges the globally unique slug index instead of dying on it', async () => {
    // idx_articles_slug is UNIQUE over the whole table, not per account, so a
    // collision is cross-tenant and the caller can neither see nor fix it.
    db.exec(`INSERT INTO articles (id, account_id, title, slug, status)
             VALUES ('a_squatter', '${OTHER_ACCOUNT}', 'Squatter', 'taken-slug', 'draft')`);
    const created = await run('create_article_draft', auth, {
      title: 'Taken Slug', body: [{ type: 'paragraph', text: 'x' }],
    });
    expect(created.article.slug).toBe('taken-slug-2');
  });
});

describe('absence, emptiness and a real value stay three different answers', () => {
  it('refuses an empty string rather than reading it as a clear', async () => {
    await expect(tools.create_article_draft(env, auth, {
      title: 'T', subtitle: '', body: [{ type: 'paragraph', text: 'x' }],
    })).rejects.toThrow(/empty string/);
  });

  it('clears a nullable field only when null is passed, and leaves absent fields alone', async () => {
    const created = await run('create_article_draft', auth, {
      title: 'Kept', subtitle: 'Goes', category: 'Field Notes',
      body: [{ type: 'paragraph', text: 'x' }],
    });
    await run('update_article_draft', auth, { article_id: created.article.id, subtitle: null });
    const row = db.prepare('SELECT title, subtitle, category FROM articles WHERE id = ?')
      .bind(created.article.id).first() as any;
    expect(row.subtitle).toBeNull();
    expect(row.title).toBe('Kept');
    expect(row.category).toBe('Field Notes');
  });

  it('will not clear the title, which is the article\'s name everywhere it appears', async () => {
    const created = await run('create_article_draft', auth, {
      title: 'Named', body: [{ type: 'paragraph', text: 'x' }],
    });
    await expect(tools.update_article_draft(env, auth, { article_id: created.article.id, title: null }))
      .rejects.toThrow(/cannot be cleared/);
  });
});

describe('the body vocabulary is the renderer\'s, and it is narrow on purpose', () => {
  it('refuses a block type the small door does not carry', async () => {
    await expect(tools.create_article_draft(env, auth, {
      title: 'T', body: [{ type: 'image', text: 'x' }],
    })).rejects.toThrow(/body\[0\]\.type/);
  });

  it('refuses text past the page limit, because a journal page does not scroll', async () => {
    await expect(tools.create_article_draft(env, auth, {
      title: 'T', body: [{ type: 'paragraph', text: 'x'.repeat(601) }],
    })).rejects.toThrow(/600 characters/);
  });

  it('rewrites the cover when the body is rewritten under a new title', async () => {
    const created = await run('create_article_draft', auth, {
      title: 'Before', body: [{ type: 'paragraph', text: 'x' }],
    });
    const updated = await run('update_article_draft', auth, {
      article_id: created.article.id, title: 'After', body: [{ type: 'paragraph', text: 'y' }],
    });
    // A stale cover would print a different title from the article's own.
    expect(updated.article.blocks[0].title).toBe('After');
    expect(updated.article.blocks).toHaveLength(2);
  });
});

describe('WordForge owns the prose it syncs', () => {
  const manage = (articleId: string) => db.exec(
    `INSERT INTO article_external_sources (id, account_id, source_system, source_id, source_revision, content_hash, article_id)
     VALUES ('src1', '${ACCOUNT}', 'wordforge', 'wf-1', 1, '${'a'.repeat(64)}', '${articleId}')`,
  );

  it('refuses a prose edit that the next sync would silently overwrite', async () => {
    const created = await run('create_article_draft', auth, {
      title: 'Managed', body: [{ type: 'paragraph', text: 'x' }],
    });
    manage(created.article.id);
    const refused = await tools.update_article_draft(env, auth, { article_id: created.article.id, title: 'Mine now' });
    expect(refused.error).toBe('externally_managed_article');
  });

  it('still allows the fields WordForge does not write', async () => {
    const created = await run('create_article_draft', auth, {
      title: 'Managed', body: [{ type: 'paragraph', text: 'x' }],
    });
    manage(created.article.id);
    const updated = await run('update_article_draft', auth, {
      article_id: created.article.id, pull_quote: 'Slow to leave.',
    });
    expect(updated.committed).toBe(true);
  });
});

describe('publishing', () => {
  it('keeps the original date when a piece is corrected and re-published', async () => {
    const created = await run('create_article_draft', auth, {
      title: 'March Piece', body: [{ type: 'paragraph', text: 'x' }],
    });
    const id = created.article.id;
    await run('set_article_published', auth, { article_id: id, published: true });
    const first = (db.prepare('SELECT published_at FROM articles WHERE id = ?').bind(id).first() as any).published_at;
    expect(first).toBeTruthy();

    await run('set_article_published', auth, { article_id: id, published: false });
    expect((db.prepare('SELECT status FROM articles WHERE id = ?').bind(id).first() as any).status).toBe('draft');

    await run('set_article_published', auth, { article_id: id, published: true });
    // The journal orders by published_at. Moving the date would silently
    // reorder the archive every time an old piece was corrected.
    expect((db.prepare('SELECT published_at FROM articles WHERE id = ?').bind(id).first() as any).published_at).toBe(first);
  });
});

describe('event write-ups reuse the composer the admin button uses', () => {
  beforeEach(() => {
    db.exec(`INSERT INTO events (id, account_id, slug, title, subtitle, event_date)
             VALUES ('evt1', '${ACCOUNT}', 'spring-sitting', 'Spring Sitting', 'Six people, one kettle', '2026-03-04')`);
    db.exec(`INSERT INTO event_post_session (id, account_id, event_id, session_notes, host_notes)
             VALUES ('ps1', '${ACCOUNT}', 'evt1', 'The room went quiet on the fourth steep.', 'Nobody wanted to leave.')`);
  });

  it('builds the draft from the post-session record', async () => {
    const created = await run('draft_article_from_event', auth, { event_id: 'evt1' });
    expect(created.committed).toBe(true);
    const texts = created.article.blocks.map((b: any) => b.text).filter(Boolean);
    expect(texts).toContain('The room went quiet on the fourth steep.');
    expect(created.article.source_event_id).toBe('evt1');
    expect(created.article.account_id).toBe(ACCOUNT);
  });

  it('hands back the existing write-up rather than making a second', async () => {
    await run('draft_article_from_event', auth, { event_id: 'evt1' });
    const again = await tools.draft_article_from_event(env, auth, { event_id: 'evt1' });
    expect(again.existing).toBe(true);
  });

  it('cannot reach another shop\'s event', async () => {
    expect(await tools.draft_article_from_event(env, otherShop, { event_id: 'evt1' }))
      .toEqual({ error: 'event_not_found' });
  });
});

describe('confirmation tickets', () => {
  it('are single-use, so a confirm cannot be replayed', async () => {
    const preview = await tools.create_article_draft(env, auth, {
      title: 'Once', body: [{ type: 'paragraph', text: 'x' }],
    });
    const first = await tools.create_article_draft(env, auth, { title: 'Once', body: [{ type: 'paragraph', text: 'x' }], confirm: preview.confirmation_token });
    expect(first.committed).toBe(true);
    const replay = await tools.create_article_draft(env, auth, { title: 'Once', body: [{ type: 'paragraph', text: 'x' }], confirm: preview.confirmation_token });
    expect(replay).toEqual({ error: 'invalid_or_expired_confirmation_token' });
    expect(db.prepare('SELECT COUNT(*) AS n FROM articles').first()).toEqual({ n: 1 });
  });

  it('are bound to the token that issued them', async () => {
    const preview = await tools.create_article_draft(env, auth, {
      title: 'Mine', body: [{ type: 'paragraph', text: 'x' }],
    });
    const stolen = await tools.create_article_draft(env, siblingToken, { title: 'Mine', body: [{ type: 'paragraph', text: 'x' }], confirm: preview.confirmation_token });
    expect(stolen).toEqual({ error: 'invalid_or_expired_confirmation_token' });
    expect(db.prepare('SELECT COUNT(*) AS n FROM articles').first()).toEqual({ n: 0 });
  });

  it('cannot be redirected at a different row', async () => {
    const a = await run('create_article_draft', auth, { title: 'A', body: [{ type: 'paragraph', text: 'x' }] });
    const b = await run('create_article_draft', auth, { title: 'B', body: [{ type: 'paragraph', text: 'x' }] });
    const preview = await tools.set_article_published(env, auth, { article_id: a.article.id, published: true });
    const misdirected = await tools.set_article_published(env, auth, {
      article_id: b.article.id, published: true, confirm: preview.confirmation_token,
    });
    expect(misdirected).toEqual({ error: 'invalid_or_expired_confirmation_token' });
    expect((db.prepare('SELECT status FROM articles WHERE id = ?').bind(b.article.id).first() as any).status).toBe('draft');
  });

  it('are namespaced so mcp.ts\'s own confirm path cannot mistake one for its own', async () => {
    await tools.create_article_draft(env, auth, { title: 'K', body: [{ type: 'paragraph', text: 'x' }] });
    const kinds = (db.prepare('SELECT kind FROM mcp_confirmation_tickets').all() as any).results.map((r: any) => r.kind);
    expect(kinds.every((k: string) => k.startsWith('writing.'))).toBe(true);
  });
});

describe('reads stay inside the account', () => {
  beforeEach(async () => {
    await run('create_article_draft', auth, { title: 'Ours', body: [{ type: 'paragraph', text: 'x' }] });
    db.exec(`INSERT INTO articles (id, account_id, title, slug, status)
             VALUES ('a_theirs', '${OTHER_ACCOUNT}', 'Theirs', 'theirs', 'published')`);
  });

  it('lists only this shop\'s articles', async () => {
    expect((await tools.list_articles(env, auth, {})).count).toBe(1);
    expect((await tools.list_articles(env, otherShop, {})).count).toBe(1);
    expect((await tools.list_articles(env, auth, {})).articles[0].title).toBe('Ours');
  });

  it('will not fetch another shop\'s article by id', async () => {
    expect(await tools.get_article(env, auth, { article_id: 'a_theirs' })).toEqual({ error: 'not_found' });
  });
});

describe('the sample shelf', () => {
  beforeEach(() => {
    db.exec(`INSERT INTO tea_sample_sets (id, account_id, name, purpose)
             VALUES ('set_sourcing', '${ACCOUNT}', 'Spring 2026 sourcing', 'sourcing')`);
    db.exec(`INSERT INTO tea_sample_sets (id, account_id, name, purpose, notes)
             VALUES ('set_requests', '${ACCOUNT}', 'Requests', 'customer-request',
                     '{"kind":"customer-request","open":true,"requested_by_user_id":"usr_customer"}')`);
    db.exec(`INSERT INTO tea_samples (id, account_id, name, set_id, status, grams, notes, created_by)
             VALUES ('smp_yiwu', '${ACCOUNT}', 'Yiwu gushu', 'set_sourcing', 'received', 10,
                     'Thin on the third steep.', 'admin')`);
    db.exec(`INSERT INTO tea_samples (id, account_id, name, set_id, status, grams, notes, created_by, user_id)
             VALUES ('smp_request', '${ACCOUNT}', 'Requested tea', 'set_requests', 'requested', 8,
                     '{"quantity_grams":8,"note":"for my mother","requested_by_user_id":"usr_customer"}',
                     'customer', 'usr_customer')`);
    db.exec(`INSERT INTO tea_samples (id, account_id, name, set_id, status, grams)
             VALUES ('smp_theirs', '${OTHER_ACCOUNT}', 'Not mine', 'set_sourcing', 'untasted', 10)`);
    db.exec(`INSERT INTO tea_sample_tastings (id, account_id, sample_id, taster_id, taster_name, tasting, rating, verdict, would_buy, personal_note)
             VALUES ('tst_1', '${ACCOUNT}', 'smp_yiwu', 'customer@example.com', 'A customer', '{}', 8, 'love', 1, 'Reminded me of home.'),
                    ('tst_2', '${ACCOUNT}', 'smp_yiwu', 'guest_abc', 'Guest', '{}', 6, 'like', 0, NULL)`);
  });

  it('answers what is still waiting to be tasted, per set', async () => {
    const sets = await tools.list_sample_sets(env, auth, {});
    const sourcing = sets.sets.find((s: any) => s.id === 'set_sourcing');
    expect(sourcing.by_status).toEqual({ received: 1 });
    expect(sourcing.awaiting_tasting).toBe(1);
  });

  it('does not read another shop\'s shelf, even though account_id is nullable there', async () => {
    const samples = await tools.list_samples(env, auth, {});
    expect(samples.samples.map((s: any) => s.id).sort()).toEqual(['smp_request', 'smp_yiwu']);
    expect(await tools.get_sample(env, auth, { sample_id: 'smp_theirs' })).toEqual({ error: 'not_found' });
  });

  it('returns Adrian\'s own note as prose and the request envelope as fields', async () => {
    const samples = await tools.list_samples(env, auth, {});
    const owned = samples.samples.find((s: any) => s.id === 'smp_yiwu');
    const requested = samples.samples.find((s: any) => s.id === 'smp_request');
    // tea_samples.notes is the admin's private note space on an owner-created
    // sample, and a machine envelope on a customer-requested one. They are not
    // the same field's worth of trust and are not returned the same way.
    expect(owned.notes).toBe('Thin on the third steep.');
    expect(requested.notes).toBeNull();
    expect(requested.requested_grams).toBe(8);
    expect(requested.request_note).toBe('for my mother');
    // The requesting customer's id must not ride out on an inventory-scoped read.
    expect('user_id' in requested).toBe(false);
  });

  it('summarises tastings without naming who tasted', async () => {
    const one = await tools.get_sample(env, auth, { sample_id: 'smp_yiwu' });
    expect(one.tastings.count).toBe(2);
    expect(one.tastings.by_verdict).toEqual({ love: 1, like: 1 });
    expect(one.tastings.average_rating).toBe(7);
    expect(one.tastings.would_buy_count).toBe(1);
    // taster_id is the customer's EMAIL when they were signed in, and
    // personal_note is the taster's own words. Neither is inventory data.
    const serialised = JSON.stringify(one);
    expect(serialised).not.toContain('customer@example.com');
    expect(serialised).not.toContain('Reminded me of home.');
  });

  it('reports an unrated sample as unrated, not as rated zero', async () => {
    const one = await tools.get_sample(env, auth, { sample_id: 'smp_request' });
    expect(one.tastings.count).toBe(0);
    expect(one.tastings.average_rating).toBeNull();
  });

  it('moves a sample along the shelf and nothing else', async () => {
    const before = db.prepare('SELECT notes FROM tea_samples WHERE id = ?').bind('smp_yiwu').first() as any;
    const done = await run('set_sample_status', auth, { sample_id: 'smp_yiwu', status: 'tasted' });
    expect(done.previous_status).toBe('received');
    const after = db.prepare('SELECT status, notes FROM tea_samples WHERE id = ?').bind('smp_yiwu').first() as any;
    expect(after.status).toBe('tasted');
    // No tool in this module writes to a private note field.
    expect(after.notes).toBe(before.notes);
  });

  it('refuses a status the shelf does not have', async () => {
    await expect(tools.set_sample_status(env, auth, { sample_id: 'smp_yiwu', status: 'brewed' }))
      .rejects.toThrow(/status must be one of/);
  });

  it('will not move another shop\'s sample', async () => {
    expect(await tools.set_sample_status(env, auth, { sample_id: 'smp_theirs', status: 'tasted' }))
      .toEqual({ error: 'not_found' });
  });
});
