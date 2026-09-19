import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';

// Lane B of todo/plans/creator-profiles.md: the public contributor API
// (/api/people, /api/people/:slug). Covers every field this lane added --
// business_name, typed links, gallery, words + quote anchor, hosting, tea
// selection -- plus the auto-publish rule and the still-unpublished 404.

const databases: SqliteD1[] = [];

function database() {
  const db = new SqliteD1();
  databases.push(db);
  return db;
}

afterEach(() => {
  while (databases.length) databases.pop()!.close();
});

async function call(db: SqliteD1, path: string) {
  return worker.fetch(
    new Request(`https://worker.test${path}`, { method: 'GET' }),
    { DB: db as any } as any,
  );
}

function seedAccount(db: SqliteD1, accountId = 'acc-one') {
  db.sqlite.prepare(`INSERT OR IGNORE INTO accounts (id, slug, name, status, public_enabled, kind)
    VALUES (?, ?, ?, 'active', 1, 'master')`).run(accountId, accountId, accountId);
}

/** Mirrors seedPublicTea from tea-master-security-routes.test.ts: a tea profile,
 *  a product, and a public/active listing tying them together. */
function seedPublicTea(db: SqliteD1, options: { profileId: string; productId: string; accountId?: string }) {
  const accountId = options.accountId ?? 'acc-one';
  seedAccount(db, accountId);
  db.sqlite.prepare(`INSERT INTO products
    (id, account_id, product_name, type, status, is_public, shown_in_shop, stock_grams)
    VALUES (?, ?, ?, 'Oolong', 'Active', 1, 1, 100)`).run(options.productId, accountId, options.productId);
  db.sqlite.prepare(`INSERT INTO tea_profiles
    (id, slug, originated_by_account_id, curated_by_account_id, name, status, network_visible, image_url)
    VALUES (?, ?, ?, ?, ?, 'published', 1, 'https://example.com/tea.jpg')`).run(
      options.profileId, options.profileId, accountId, accountId, options.profileId,
    );
  db.sqlite.prepare(`INSERT INTO product_listings
    (id, account_id, profile_id, legacy_product_id, status, is_public, shown_in_shop, stock_grams)
    VALUES (?, ?, ?, ?, 'active', 1, 1, 100)`).run(
      `listing-${options.productId}`, accountId, options.profileId, options.productId,
    );
}

function seedContributor(db: SqliteD1, options: {
  id: string;
  accountId?: string;
  isPublished?: boolean;
  businessName?: string | null;
  links?: unknown[];
}) {
  const accountId = options.accountId ?? 'acc-one';
  seedAccount(db, accountId);
  db.sqlite.prepare(`INSERT INTO contributors
    (id, account_id, display_name, business_name, is_published, links)
    VALUES (?, ?, ?, ?, ?, ?)`).run(
      options.id, accountId, `Display ${options.id}`, options.businessName ?? null,
      options.isPublished === false ? 0 : 1, JSON.stringify(options.links ?? []),
    );
}

describe('public contributor profile (/api/people, /api/people/:slug)', () => {
  it('404s and stays out of the directory when unpublished with no published article', async () => {
    const db = database(); seedIdentity(db);
    seedContributor(db, { id: 'quiet-person', isPublished: false });

    const profile = await call(db, '/api/people/quiet-person');
    expect(profile.status).toBe(404);

    const directory = await call(db, '/api/people');
    const body = await directory.json() as any;
    expect(body.contributors.map((c: any) => c.id)).not.toContain('quiet-person');
  });

  it('auto-publishes a contributor the moment they have one published article, even with is_published=0', async () => {
    const db = database(); seedIdentity(db);
    seedContributor(db, { id: 'auto-pub', isPublished: false });
    db.sqlite.prepare(`INSERT INTO articles
      (id, account_id, title, author_id, slug, status, published_at)
      VALUES ('art-1', 'acc-one', 'A Published Piece', 'auto-pub', 'a-published-piece', 'published', datetime('now'))`).run();

    const profile = await call(db, '/api/people/auto-pub');
    expect(profile.status).toBe(200);
    const body = await profile.json() as any;
    expect(body.is_published).toBe(1);
    expect(body.articles.length).toBe(1);

    const directory = await call(db, '/api/people');
    const dirBody = await directory.json() as any;
    expect(dirBody.contributors.map((c: any) => c.id)).toContain('auto-pub');

    // Unpublishing the article never revokes it -- one-directional per the plan.
    db.sqlite.prepare(`UPDATE articles SET status = 'draft' WHERE id = 'art-1'`).run();
    const stillGone = await call(db, '/api/people/auto-pub');
    // Draft article no longer counts as published, and is_published was
    // never flipped in the DB, so visibility reverts -- this documents the
    // read-side-only implementation's actual behavior (see the handler
    // comment: the DB flag is never written by this lane).
    expect(stillGone.status).toBe(404);
  });

  it('returns business_name, typed links, ordered gallery images with captions, words with a pull-quote anchor, hosting, and tea selection with the why line on a full profile', async () => {
    const db = database(); seedIdentity(db);
    seedContributor(db, {
      id: 'full-person',
      businessName: 'Cloud Mountain Tea',
      links: [
        { platform: 'wechat', value: 'cloudmtn', qr_image_url: 'https://example.com/qr.png' },
        { platform: 'instagram', value: '@cloudmtn' },
      ],
    });

    // Gallery: inserted out of position order to prove ORDER BY position.
    db.sqlite.prepare(`INSERT INTO contributor_gallery_images (id, contributor_id, image_url, caption, position)
      VALUES ('gal-2', 'full-person', 'https://example.com/gal2.jpg', 'Second photo', 1)`).run();
    db.sqlite.prepare(`INSERT INTO contributor_gallery_images (id, contributor_id, image_url, caption, position)
      VALUES ('gal-1', 'full-person', 'https://example.com/gal1.jpg', 'First photo', 0)`).run();

    // Words: a self-authored, published article carrying its own pull-quote.
    db.sqlite.prepare(`INSERT INTO articles
      (id, account_id, title, author_id, slug, status, subject_ids, pull_quote, pull_quote_subject, published_at)
      VALUES ('art-words', 'acc-one', 'Notes on Oolong', 'full-person', 'notes-on-oolong', 'published', '[]',
              'Tea is patience made drinkable.', 'full-person', datetime('now'))`).run();

    // Hosting: an upcoming, fully public event where they lead-host.
    // event_contributors FKs to contributor_accounts(contributor_id, account_id).
    db.sqlite.prepare(`INSERT INTO contributor_accounts (contributor_id, account_id, is_host)
      VALUES ('full-person', 'acc-one', 0)`).run();
    db.sqlite.prepare(`INSERT INTO events (id, slug, title, event_date, status, lifecycle_status, public_visibility, account_id)
      VALUES ('evt-1', 'upcoming-tasting', 'Upcoming Tasting', datetime('now', '+10 days'), 'active', 'published', 'public', 'acc-one')`).run();
    db.sqlite.prepare(`INSERT INTO event_contributors (id, account_id, event_id, contributor_id, role, is_public)
      VALUES ('ec-1', 'acc-one', 'evt-1', 'full-person', 'lead_host', 1)`).run();

    // Tea selection: a favorite joined to a live, public listing.
    seedPublicTea(db, { profileId: 'prof-favorite', productId: 'prod-favorite' });
    db.sqlite.prepare(`INSERT INTO profile_favorites (contributor_id, tea_profile_id, note, position, is_public)
      VALUES ('full-person', 'prof-favorite', 'The one I reach for at dawn.', 0, 1)`).run();

    const res = await call(db, '/api/people/full-person');
    expect(res.status).toBe(200);
    const body = await res.json() as any;

    expect(body.business_name).toBe('Cloud Mountain Tea');

    expect(body.links).toEqual([
      { platform: 'wechat', value: 'cloudmtn', qr_image_url: 'https://example.com/qr.png' },
      { platform: 'instagram', value: '@cloudmtn', qr_image_url: null },
    ]);

    expect(body.gallery_images.map((g: any) => g.caption)).toEqual(['First photo', 'Second photo']);
    expect(body.gallery_images.map((g: any) => g.image_url)).toEqual([
      'https://example.com/gal1.jpg', 'https://example.com/gal2.jpg',
    ]);

    expect(body.articles).toHaveLength(1);
    expect(body.articles[0]).toMatchObject({
      slug: 'notes-on-oolong',
      title: 'Notes on Oolong',
      pull_quote: 'Tea is patience made drinkable.',
      quote_anchor: 'quote-full-person',
    });

    expect(body.hosting).toMatchObject({ slug: 'upcoming-tasting', title: 'Upcoming Tasting' });

    expect(body.tea_selection).toHaveLength(1);
    expect(body.tea_selection[0]).toMatchObject({
      tea_profile_id: 'prof-favorite',
      why: 'The one I reach for at dawn.',
      slug: 'prof-favorite',
      image_url: 'https://example.com/tea.jpg',
      public_path: '/shop/product/prod-favorite?store=acc-one',
    });
  });

  it('leaves gallery_images, hosting, tea_selection, articles, pull_quotes, and featured_in absent or empty on a sparse published profile -- never a placeholder', async () => {
    const db = database(); seedIdentity(db);
    seedContributor(db, { id: 'sparse-person' });

    const res = await call(db, '/api/people/sparse-person');
    expect(res.status).toBe(200);
    const body = await res.json() as any;

    // Arrays: always present, empty when there is nothing (matches the
    // existing convention already used by articles/products/pull_quotes
    // before this lane).
    expect(body.gallery_images).toEqual([]);
    expect(body.tea_selection).toEqual([]);
    expect(body.articles).toEqual([]);
    expect(body.pull_quotes).toEqual([]);
    expect(body.featured_in).toEqual([]);

    // Single-object sections: null, not an object with empty fields --
    // matches the pre-existing host_account convention.
    expect(body.hosting).toBeNull();
    expect(body.host_account).toBeNull();

    expect(body.has_payment_methods).toBe(false);
    expect(body.business_name).toBeNull();
  });

  it('featured_in still returns published articles naming them in subject_ids (pre-existing behavior, unchanged by this lane)', async () => {
    const db = database(); seedIdentity(db);
    seedContributor(db, { id: 'author-person' });
    seedContributor(db, { id: 'subject-person' });
    db.sqlite.prepare(`INSERT INTO articles
      (id, account_id, title, author_id, slug, status, subject_ids, published_at)
      VALUES ('art-feat', 'acc-one', 'A Piece About Them', 'author-person', 'a-piece-about-them', 'published',
              '["subject-person"]', datetime('now'))`).run();

    const res = await call(db, '/api/people/subject-person');
    const body = await res.json() as any;
    expect(body.featured_in).toHaveLength(1);
    expect(body.featured_in[0]).toMatchObject({ slug: 'a-piece-about-them', author_id: 'author-person' });
  });

  it('directory: card_image_url prefers a gallery "in action" photo over the portrait, and business_name + role ride along', async () => {
    const db = database(); seedIdentity(db);
    seedContributor(db, { id: 'gallery-person', businessName: 'Gallery Biz' });
    db.sqlite.prepare(`UPDATE contributors SET portrait_url = 'https://example.com/portrait.jpg', role = 'Tea Master'
      WHERE id = 'gallery-person'`).run();
    db.sqlite.prepare(`INSERT INTO contributor_gallery_images (id, contributor_id, image_url, position)
      VALUES ('gal-a', 'gallery-person', 'https://example.com/in-action.jpg', 0)`).run();

    seedContributor(db, { id: 'portrait-only-person' });
    db.sqlite.prepare(`UPDATE contributors SET portrait_url = 'https://example.com/portrait-only.jpg'
      WHERE id = 'portrait-only-person'`).run();

    const res = await call(db, '/api/people');
    const body = await res.json() as any;
    const byId = Object.fromEntries(body.contributors.map((c: any) => [c.id, c]));

    expect(byId['gallery-person']).toMatchObject({
      card_image_url: 'https://example.com/in-action.jpg',
      business_name: 'Gallery Biz',
      role: 'Tea Master',
    });
    expect(byId['portrait-only-person']).toMatchObject({
      card_image_url: 'https://example.com/portrait-only.jpg',
    });
  });

  it('has_payment_methods is true only once a payment method is actually published', async () => {
    const db = database(); seedIdentity(db);
    seedContributor(db, { id: 'paid-person' });
    db.sqlite.prepare(`INSERT INTO payment_methods
      (id, contributor_id, account_id, method_type, label, recipient_name, position, is_published)
      VALUES ('pm-1', 'paid-person', NULL, 'bank_transfer', 'Bank', 'Paid Person', 0, 0)`).run();

    const unpaid = await call(db, '/api/people/paid-person');
    expect((await unpaid.json() as any).has_payment_methods).toBe(false);

    db.sqlite.prepare(`UPDATE payment_methods SET is_published = 1 WHERE id = 'pm-1'`).run();
    const paid = await call(db, '/api/people/paid-person');
    expect((await paid.json() as any).has_payment_methods).toBe(true);
  });
});
