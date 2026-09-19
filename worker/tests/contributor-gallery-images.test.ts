import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

// Lane I of todo/plans/creator-profiles.md: contributor_gallery_images gets
// its own full-array-replace endpoint for both the admin editor and the
// self-serve profile editor, applied immediately (never routed through
// contributor_profile_drafts -- see the comment on parseGalleryImages in
// worker/src/index.ts for why a separate ordered table cannot go through
// the same review flow that diffs scalar columns on `contributors`).

const SECRET = 'gallery-images-secret';
const databases: SqliteD1[] = [];

function database() {
  const db = new SqliteD1();
  databases.push(db);
  return db;
}

afterEach(() => {
  while (databases.length) databases.pop()!.close();
});

async function call(db: SqliteD1, path: string, options: {
  method?: string; body?: unknown; userId?: string; accountId?: string;
} = {}) {
  const userId = options.userId ?? 'owner-one';
  const accountId = options.accountId ?? 'acc-one';
  const token = await signedToken(SECRET, {
    sub: userId, email: `${userId}@test.dev`, name: userId,
    active_account_id: accountId, platform_role: null,
  });
  const headers = new Headers({ Authorization: `Bearer ${token}`, 'X-Teajia-Account': accountId });
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  return worker.fetch(new Request(`https://worker.test${path}`, {
    method: options.method ?? 'GET', headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  }), { DB: db as any, JWT_SECRET: SECRET } as any);
}

function seedContributor(db: SqliteD1, options: { id: string; accountId?: string; userId?: string | null }) {
  const accountId = options.accountId ?? 'acc-one';
  db.sqlite.prepare(`INSERT OR IGNORE INTO accounts (id, slug, name, status, public_enabled)
    VALUES (?, ?, ?, 'active', 1)`).run(accountId, accountId, accountId);
  db.sqlite.prepare(`INSERT INTO contributors (id, account_id, display_name, user_id, is_published, links)
    VALUES (?, ?, ?, ?, 0, '[]')`).run(options.id, accountId, `Display ${options.id}`, options.userId ?? null);
}

describe('admin gallery images (PUT /api/admin/contributors/:id/gallery-images)', () => {
  it('replaces the whole ordered list, and an empty array clears it rather than leaving the last saved rows', async () => {
    const db = database();
    seedIdentity(db, { userId: 'owner-one', accountId: 'acc-one', role: 'owner' });
    seedContributor(db, { id: 'kenji-tanaka' });

    const first = await call(db, '/api/admin/contributors/kenji-tanaka/gallery-images', {
      method: 'PUT',
      body: {
        gallery_images: [
          { image_url: 'https://example.com/a.jpg', caption: 'First' },
          { image_url: 'https://example.com/b.jpg', caption: null },
        ],
      },
    });
    expect(first.status).toBe(200);
    const firstBody = await first.json() as any;
    expect(firstBody.gallery_images.map((g: any) => g.image_url)).toEqual([
      'https://example.com/a.jpg', 'https://example.com/b.jpg',
    ]);
    expect(firstBody.gallery_images.map((g: any) => g.caption)).toEqual(['First', null]);
    expect(firstBody.gallery_images.map((g: any) => g.position)).toEqual([0, 1]);

    // A second replace with fewer rows drops the earlier ones -- a replace,
    // not a merge.
    const second = await call(db, '/api/admin/contributors/kenji-tanaka/gallery-images', {
      method: 'PUT',
      body: { gallery_images: [{ image_url: 'https://example.com/c.jpg', caption: null }] },
    });
    expect(second.status).toBe(200);
    expect(((await second.json()) as any).gallery_images).toHaveLength(1);

    const cleared = await call(db, '/api/admin/contributors/kenji-tanaka/gallery-images', {
      method: 'PUT', body: { gallery_images: [] },
    });
    expect(cleared.status).toBe(200);
    expect(((await cleared.json()) as any).gallery_images).toEqual([]);
  });

  it('refuses a 9th photo, a non-http(s) image_url, and an over-long caption', async () => {
    const db = database();
    seedIdentity(db, { userId: 'owner-one', accountId: 'acc-one', role: 'owner' });
    seedContributor(db, { id: 'kenji-tanaka' });

    const tooMany = Array.from({ length: 9 }, (_, i) => ({ image_url: `https://example.com/${i}.jpg`, caption: null }));
    expect((await call(db, '/api/admin/contributors/kenji-tanaka/gallery-images', {
      method: 'PUT', body: { gallery_images: tooMany },
    })).status).toBe(400);

    expect((await call(db, '/api/admin/contributors/kenji-tanaka/gallery-images', {
      method: 'PUT', body: { gallery_images: [{ image_url: 'not-a-url', caption: null }] },
    })).status).toBe(400);

    expect((await call(db, '/api/admin/contributors/kenji-tanaka/gallery-images', {
      method: 'PUT', body: { gallery_images: [{ image_url: 'https://example.com/a.jpg', caption: 'x'.repeat(281) }] },
    })).status).toBe(400);

    // Nothing from any rejected call was written.
    const unchanged = await call(db, '/api/admin/contributors/kenji-tanaka/gallery-images', {
      method: 'PUT', body: { gallery_images: [] },
    });
    expect(((await unchanged.json()) as any).gallery_images).toEqual([]);
  });

  it('will not let one account edit another account\'s contributor gallery', async () => {
    const db = database();
    seedIdentity(db, { userId: 'owner-one', accountId: 'acc-one', role: 'owner' });
    seedIdentity(db, { userId: 'owner-two', accountId: 'acc-two', role: 'owner' });
    seedContributor(db, { id: 'kenji-tanaka', accountId: 'acc-one' });

    const response = await call(db, '/api/admin/contributors/kenji-tanaka/gallery-images', {
      method: 'PUT',
      body: { gallery_images: [{ image_url: 'https://example.com/a.jpg', caption: null }] },
      userId: 'owner-two', accountId: 'acc-two',
    });
    expect(response.status).toBe(404);
  });

  it('keeps gallery administration owner-tier only', async () => {
    const db = database();
    seedIdentity(db, { userId: 'staff-one', accountId: 'acc-one', role: 'staff', bundles: ['catalog'] });
    seedContributor(db, { id: 'kenji-tanaka' });
    const response = await call(db, '/api/admin/contributors/kenji-tanaka/gallery-images', {
      method: 'PUT', body: { gallery_images: [] }, userId: 'staff-one',
    });
    expect(response.status).toBe(403);
  });
});

describe('self-serve gallery images (PUT /api/me/public-profile/gallery-images)', () => {
  it('applies immediately -- not through the draft review queue -- and empty saves as empty', async () => {
    const db = database();
    seedIdentity(db, { userId: 'kenji', accountId: 'acc-one', role: 'owner' });
    seedContributor(db, { id: 'kenji-tanaka', accountId: 'acc-one', userId: 'kenji' });

    const saved = await call(db, '/api/me/public-profile/gallery-images', {
      method: 'PUT',
      body: { gallery_images: [{ image_url: 'https://example.com/a.jpg', caption: 'At the kiln' }] },
      userId: 'kenji', accountId: 'acc-one',
    });
    expect(saved.status).toBe(200);
    const savedBody = await saved.json() as any;
    expect(savedBody.gallery_images).toHaveLength(1);
    expect(savedBody.gallery_images[0].caption).toBe('At the kiln');

    // No pending draft was created -- the self-serve GET reflects it straight away.
    const profile = await call(db, '/api/me/public-profile', { userId: 'kenji', accountId: 'acc-one' });
    const profileBody = await profile.json() as any;
    expect(profileBody.contributor.has_pending_draft).toBe(false);
    expect(profileBody.contributor.gallery_images).toHaveLength(1);
    expect(profileBody.contributor.gallery_images[0].image_url).toBe('https://example.com/a.jpg');

    const cleared = await call(db, '/api/me/public-profile/gallery-images', {
      method: 'PUT', body: { gallery_images: [] }, userId: 'kenji', accountId: 'acc-one',
    });
    expect(((await cleared.json()) as any).gallery_images).toEqual([]);
  });

  it('refuses gallery edits before a profile exists', async () => {
    const db = database();
    seedIdentity(db, { userId: 'no-profile-yet', accountId: 'acc-one', role: 'owner' });
    const response = await call(db, '/api/me/public-profile/gallery-images', {
      method: 'PUT', body: { gallery_images: [] }, userId: 'no-profile-yet', accountId: 'acc-one',
    });
    expect(response.status).toBe(404);
  });

  it('rejects an unauthenticated request', async () => {
    const db = database();
    const response = await worker.fetch(new Request('https://worker.test/api/me/public-profile/gallery-images', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gallery_images: [] }),
    }), { DB: db as any, JWT_SECRET: SECRET } as any);
    expect(response.status).toBe(401);
  });
});
