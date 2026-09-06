import { describe, expect, it } from 'vitest';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';
import { combineToolModules } from '../src/mcpTools/registry';
import { curationTools, __testables } from '../src/mcpTools/curation';

/*
 * The curation tools put two things an agent could not touch before behind a
 * voice command: what the shop shows, and what a tea looks like. Both are ways
 * to lose work without anything failing, which is what these cover.
 *
 * The recurring shapes in this repo, all of them here:
 *   - a read-modify-write that quietly drops what it could not parse,
 *   - an empty string accepted as a value,
 *   - a query that forgets account_id and lands in another shop,
 *   - a confirmation that can be spent twice.
 */

const ACCOUNT = 'acc-curation';
const OTHER_ACCOUNT = 'acc-other';
const TOKEN_ID = 'tok-one';

type AnyResult = Record<string, any>;

function makeDb() {
  const sqlite = new SqliteD1();
  seedIdentity(sqlite, { userId: 'user-one', accountId: ACCOUNT, role: 'owner' });
  seedIdentity(sqlite, { userId: 'user-two', accountId: OTHER_ACCOUNT, role: 'owner' });
  return sqlite;
}

function seedProduct(sqlite: SqliteD1, opts: { id: string; account?: string; name?: string; image?: string | null; additional?: string | null }) {
  sqlite.sqlite.prepare(
    `INSERT INTO products (id, account_id, type, product_name, given_name, image_url, additional_images)
     VALUES (?, ?, 'Tea', ?, ?, ?, ?)`
  ).run(opts.id, opts.account ?? ACCOUNT, opts.name ?? opts.id, opts.name ?? opts.id, opts.image ?? null, opts.additional ?? '[]');
}

const auth = (over: Partial<Record<string, string>> = {}) => ({
  accountId: ACCOUNT,
  userId: 'user-one',
  userEmail: 'user-one@test.dev',
  tokenId: TOKEN_ID,
  creatorTier: 'account_owner',
  ...over,
}) as any;

const call = (sqlite: SqliteD1, name: string, args: any, who = auth()): Promise<AnyResult> =>
  curationTools.handlers[name]({ DB: sqlite } as any, who, args) as Promise<AnyResult>;

/** Preview, then confirm with the token the preview handed back. */
async function runTwoStep(sqlite: SqliteD1, name: string, args: any, who = auth()) {
  const preview = await call(sqlite, name, args, who);
  if (!preview.confirmation_token) return { preview, committed: preview };
  const committed = await call(sqlite, name, { ...args, confirm: preview.confirmation_token }, who);
  return { preview, committed };
}

function readAdditional(sqlite: SqliteD1, productId: string): string | null {
  const row = sqlite.sqlite.prepare('SELECT additional_images FROM products WHERE id = ?').get(productId) as any;
  return row?.additional_images ?? null;
}

describe('module registration', () => {
  it('folds into the registry with every def answered by a handler', () => {
    const { defs, handlers } = combineToolModules([curationTools]);
    expect(defs.length).toBe(9);
    for (const def of defs) expect(typeof handlers[def.name]).toBe('function');
  });

  it('asks for read scope on the read and catalog:write on every mutation', () => {
    const byName = Object.fromEntries(curationTools.defs.map(d => [d.name, d.scope]));
    expect(byName.list_collections).toBe('inventory:read');
    for (const name of ['create_collection', 'add_tea_to_collection', 'remove_tea_from_collection',
      'publish_collection', 'unpublish_collection', 'set_tea_image', 'add_tea_images', 'remove_tea_image']) {
      expect(byName[name]).toBe('catalog:write');
    }
  });
});

describe('argument reading', () => {
  it('treats an empty string as nothing said, not as a value', () => {
    expect(__testables.optionalText('')).toBe(null);
    expect(__testables.optionalText('   ')).toBe(null);
    expect(__testables.optionalText(null)).toBe(null);
    expect(__testables.optionalText(' Yiwu ')).toBe('Yiwu');
  });

  it('refuses a URL the storefront could not render as a photo', () => {
    expect(__testables.readImageUrl('https://media.teajia.co/a.jpg')).toEqual({ url: 'https://media.teajia.co/a.jpg' });
    expect(__testables.readImageUrl('/media/a.jpg')).toEqual({ url: '/media/a.jpg' });
    expect('error' in __testables.readImageUrl('data:image/png;base64,AAAA')).toBe(true);
    expect('error' in __testables.readImageUrl('javascript:alert(1)')).toBe(true);
    expect('error' in __testables.readImageUrl('')).toBe(true);
  });

  it('matches a photo across the upload route\'s ?v= cache buster', () => {
    expect(__testables.sameImage('https://m/a.jpg?v=1', 'https://m/a.jpg?v=2')).toBe(true);
    expect(__testables.sameImage('https://m/a.jpg', 'https://m/b.jpg')).toBe(false);
  });
});

describe('additional_images is never rewritten from a guess', () => {
  it('reads an empty or absent column as no photos', () => {
    expect(__testables.parseImageArray(null)).toEqual({ list: [] });
    expect(__testables.parseImageArray('')).toEqual({ list: [] });
    expect(__testables.parseImageArray('["https://m/a.jpg"]')).toEqual({ list: ['https://m/a.jpg'] });
  });

  it('refuses an unreadable column instead of falling back to an empty list', () => {
    // The display paths do `catch { [] }` and that is right for a read. On a
    // write it means the photos in there are replaced by whatever this call
    // adds, with no error anywhere.
    expect('error' in __testables.parseImageArray('not json')).toBe(true);
    expect('error' in __testables.parseImageArray('{"a":1}')).toBe(true);
  });

  it('appends without dropping what the tea already had', async () => {
    const sqlite = makeDb();
    try {
      seedProduct(sqlite, { id: 'p1', additional: JSON.stringify(['https://m/one.jpg', 'https://m/two.jpg']) });
      const { committed } = await runTwoStep(sqlite, 'add_tea_images', { product_id: 'p1', image_urls: ['https://m/three.jpg'] });
      expect(committed.committed).toBe(true);
      expect(JSON.parse(readAdditional(sqlite, 'p1') as string)).toEqual([
        'https://m/one.jpg', 'https://m/two.jpg', 'https://m/three.jpg',
      ]);
    } finally { sqlite.close(); }
  });

  it('skips a photo the tea already has rather than listing it twice', async () => {
    const sqlite = makeDb();
    try {
      seedProduct(sqlite, { id: 'p1', additional: JSON.stringify(['https://m/one.jpg?v=1']) });
      const { committed } = await runTwoStep(sqlite, 'add_tea_images', { product_id: 'p1', image_url: 'https://m/one.jpg?v=9' });
      expect(committed.added_count).toBe(0);
      expect(JSON.parse(readAdditional(sqlite, 'p1') as string)).toEqual(['https://m/one.jpg?v=1']);
    } finally { sqlite.close(); }
  });

  it('leaves an unreadable column exactly as it found it', async () => {
    const sqlite = makeDb();
    try {
      seedProduct(sqlite, { id: 'p1', additional: 'this is not json' });
      const preview = await call(sqlite, 'add_tea_images', { product_id: 'p1', image_url: 'https://m/new.jpg' });
      expect(preview.error).toBe('additional_images_unreadable');
      expect(readAdditional(sqlite, 'p1')).toBe('this is not json');
    } finally { sqlite.close(); }
  });

  it('refuses to commit a stale list when the photos moved under it', async () => {
    const sqlite = makeDb();
    try {
      seedProduct(sqlite, { id: 'p1', additional: JSON.stringify(['https://m/one.jpg']) });
      const preview = await call(sqlite, 'add_tea_images', { product_id: 'p1', image_url: 'https://m/new.jpg' });
      // The admin adds a photo while the confirmation is pending. Committing
      // the list computed before it existed would delete that photo.
      sqlite.sqlite.prepare('UPDATE products SET additional_images = ? WHERE id = ?')
        .run(JSON.stringify(['https://m/one.jpg', 'https://m/from-admin.jpg']), 'p1');
      const committed = await call(sqlite, 'add_tea_images', { product_id: 'p1', image_url: 'https://m/new.jpg', confirm: preview.confirmation_token });
      expect(committed.error).toBe('additional_images_changed_since_preview');
      expect(JSON.parse(readAdditional(sqlite, 'p1') as string)).toContain('https://m/from-admin.jpg');
    } finally { sqlite.close(); }
  });

  it('removes one photo and keeps the rest', async () => {
    const sqlite = makeDb();
    try {
      seedProduct(sqlite, { id: 'p1', additional: JSON.stringify(['https://m/one.jpg?v=1', 'https://m/two.jpg']) });
      const { committed } = await runTwoStep(sqlite, 'remove_tea_image', { product_id: 'p1', image_url: 'https://m/one.jpg' });
      expect(committed.committed).toBe(true);
      expect(JSON.parse(readAdditional(sqlite, 'p1') as string)).toEqual(['https://m/two.jpg']);
    } finally { sqlite.close(); }
  });

  it('points at set_tea_image when the URL is the primary photo', async () => {
    const sqlite = makeDb();
    try {
      seedProduct(sqlite, { id: 'p1', image: 'https://m/main.jpg', additional: '[]' });
      const result = await call(sqlite, 'remove_tea_image', { product_id: 'p1', image_url: 'https://m/main.jpg' });
      expect(result.error).toBe('image_not_in_additional_images');
      expect(result.hint).toContain('set_tea_image');
    } finally { sqlite.close(); }
  });
});

describe('set_tea_image', () => {
  it('sets the primary photo and leaves the extras alone', async () => {
    const sqlite = makeDb();
    try {
      seedProduct(sqlite, { id: 'p1', image: null, additional: JSON.stringify(['https://m/extra.jpg']) });
      const { committed } = await runTwoStep(sqlite, 'set_tea_image', { product_id: 'p1', image_url: 'https://m/main.jpg' });
      expect(committed.committed).toBe(true);
      const row = sqlite.sqlite.prepare('SELECT image_url, additional_images FROM products WHERE id = ?').get('p1') as any;
      expect(row.image_url).toBe('https://m/main.jpg');
      expect(JSON.parse(row.additional_images)).toEqual(['https://m/extra.jpg']);
    } finally { sqlite.close(); }
  });

  it('clears the photo only when the caller names the field as null', async () => {
    const sqlite = makeDb();
    try {
      seedProduct(sqlite, { id: 'p1', image: 'https://m/main.jpg' });
      const missing = await call(sqlite, 'set_tea_image', { product_id: 'p1' });
      expect(missing.error).toBe('image_url_required');
      const { committed } = await runTwoStep(sqlite, 'set_tea_image', { product_id: 'p1', image_url: null });
      expect(committed.committed).toBe(true);
      const row = sqlite.sqlite.prepare('SELECT image_url FROM products WHERE id = ?').get('p1') as any;
      expect(row.image_url).toBe(null);
    } finally { sqlite.close(); }
  });
});

describe('account scoping', () => {
  it('cannot photograph a tea belonging to another shop', async () => {
    const sqlite = makeDb();
    try {
      seedProduct(sqlite, { id: 'foreign', account: OTHER_ACCOUNT, image: null });
      const result = await call(sqlite, 'set_tea_image', { product_id: 'foreign', image_url: 'https://m/a.jpg' });
      expect(result.error).toBe('product_not_found');
      const row = sqlite.sqlite.prepare('SELECT image_url FROM products WHERE id = ?').get('foreign') as any;
      expect(row.image_url).toBe(null);
    } finally { sqlite.close(); }
  });

  it('cannot put another shop\'s tea into this shop\'s collection', async () => {
    const sqlite = makeDb();
    try {
      seedProduct(sqlite, { id: 'foreign', account: OTHER_ACCOUNT });
      const created = await runTwoStep(sqlite, 'create_collection', { title: 'Spring' });
      const result = await call(sqlite, 'add_tea_to_collection', {
        collection_id: created.committed.collection_id, product_id: 'foreign',
      });
      expect(result.error).toBe('product_not_found');
    } finally { sqlite.close(); }
  });

  it('cannot see or publish another shop\'s collection', async () => {
    const sqlite = makeDb();
    try {
      sqlite.sqlite.prepare(
        `INSERT INTO collections (id, account_id, title, status) VALUES ('col_foreign', ?, 'Theirs', 'active')`
      ).run(OTHER_ACCOUNT);
      expect((await call(sqlite, 'publish_collection', { collection_id: 'col_foreign' })).error).toBe('collection_not_found');
      const listed = await call(sqlite, 'list_collections', {});
      expect(listed.collections).toEqual([]);
    } finally { sqlite.close(); }
  });
});

describe('confirmation tickets', () => {
  it('spends a ticket exactly once', async () => {
    const sqlite = makeDb();
    try {
      seedProduct(sqlite, { id: 'p1', image: null });
      const preview = await call(sqlite, 'set_tea_image', { product_id: 'p1', image_url: 'https://m/a.jpg' });
      const first = await call(sqlite, 'set_tea_image', { product_id: 'p1', image_url: 'https://m/a.jpg', confirm: preview.confirmation_token });
      expect(first.committed).toBe(true);
      const second = await call(sqlite, 'set_tea_image', { product_id: 'p1', image_url: 'https://m/a.jpg', confirm: preview.confirmation_token });
      expect(second.error).toBe('invalid_or_expired_confirmation_token');
    } finally { sqlite.close(); }
  });

  it('will not let a sibling token confirm a mutation it never previewed', async () => {
    const sqlite = makeDb();
    try {
      seedProduct(sqlite, { id: 'p1', image: null });
      const preview = await call(sqlite, 'set_tea_image', { product_id: 'p1', image_url: 'https://m/a.jpg' });
      const other = await call(
        sqlite, 'set_tea_image',
        { product_id: 'p1', image_url: 'https://m/a.jpg', confirm: preview.confirmation_token },
        auth({ tokenId: 'tok-two' }),
      );
      expect(other.error).toBe('invalid_or_expired_confirmation_token');
    } finally { sqlite.close(); }
  });

  it('stores only the hash of the ticket, never the token itself', async () => {
    const sqlite = makeDb();
    try {
      seedProduct(sqlite, { id: 'p1', image: null });
      const preview = await call(sqlite, 'set_tea_image', { product_id: 'p1', image_url: 'https://m/a.jpg' });
      const row = sqlite.sqlite.prepare('SELECT token_hash, kind, token_id FROM mcp_confirmation_tickets').get() as any;
      expect(row.token_hash).not.toBe(preview.confirmation_token);
      expect(row.token_hash).toHaveLength(64);
      // The prefix is what keeps mcp.ts's consumer and this one off each
      // other's rows: each checks its own kind and neither can commit the
      // other's pending mutation.
      expect(row.kind.startsWith('curation:')).toBe(true);
      expect(row.token_id).toBe(TOKEN_ID);
    } finally { sqlite.close(); }
  });
});

describe('collections and the shop', () => {
  it('refuses a collection with no title', async () => {
    const sqlite = makeDb();
    try {
      expect((await call(sqlite, 'create_collection', { title: '   ' })).error).toBe('title_required');
      expect((await call(sqlite, 'create_collection', {})).error).toBe('title_required');
    } finally { sqlite.close(); }
  });

  it('creates as a draft, invisible to the shop until published', async () => {
    const sqlite = makeDb();
    try {
      seedProduct(sqlite, { id: 'p1', name: 'Yiwu Gushu' });
      const { committed } = await runTwoStep(sqlite, 'create_collection', { title: 'Spring 2026', initial_product_ids: ['p1'] });
      expect(committed.status).toBe('draft');
      expect(committed.item_count).toBe(1);
      const listed = await call(sqlite, 'list_collections', { collection_id: committed.collection_id });
      expect(listed.collections[0].published_to_shop).toBe(false);
      expect(listed.items[0].product_id).toBe('p1');
    } finally { sqlite.close(); }
  });

  it('will not publish an empty collection to the storefront', async () => {
    const sqlite = makeDb();
    try {
      const created = await runTwoStep(sqlite, 'create_collection', { title: 'Empty' });
      const result = await call(sqlite, 'publish_collection', { collection_id: created.committed.collection_id });
      expect(result.error).toBe('collection_is_empty');
    } finally { sqlite.close(); }
  });

  it('publishes to target_type=shop, promotes the draft, and is idempotent', async () => {
    const sqlite = makeDb();
    try {
      seedProduct(sqlite, { id: 'p1' });
      const created = await runTwoStep(sqlite, 'create_collection', { title: 'Spring 2026', initial_product_ids: ['p1'] });
      const id = created.committed.collection_id;

      const first = await runTwoStep(sqlite, 'publish_collection', { collection_id: id });
      expect(first.committed.created).toBe(true);
      const pub = sqlite.sqlite.prepare(
        `SELECT target_type, target_id, unpublished_at FROM collection_publications WHERE collection_id = ?`
      ).get(id) as any;
      expect(pub.target_type).toBe('shop');
      expect(pub.target_id).toBe(null);
      expect(pub.unpublished_at).toBe(null);
      const status = sqlite.sqlite.prepare('SELECT status FROM collections WHERE id = ?').get(id) as any;
      expect(status.status).toBe('active');

      const second = await runTwoStep(sqlite, 'publish_collection', { collection_id: id });
      expect(second.committed.created).toBe(false);
      const count = sqlite.sqlite.prepare(
        `SELECT COUNT(*) AS n FROM collection_publications WHERE collection_id = ? AND unpublished_at IS NULL`
      ).get(id) as any;
      expect(Number(count.n)).toBe(1);
    } finally { sqlite.close(); }
  });

  it('unpublishing stamps a date rather than deleting the record', async () => {
    const sqlite = makeDb();
    try {
      seedProduct(sqlite, { id: 'p1' });
      const created = await runTwoStep(sqlite, 'create_collection', { title: 'Spring 2026', initial_product_ids: ['p1'] });
      const id = created.committed.collection_id;
      await runTwoStep(sqlite, 'publish_collection', { collection_id: id });
      const { committed } = await runTwoStep(sqlite, 'unpublish_collection', { collection_id: id });
      expect(committed.committed).toBe(true);
      const rows = sqlite.sqlite.prepare('SELECT unpublished_at FROM collection_publications WHERE collection_id = ?').all(id) as any[];
      expect(rows).toHaveLength(1);
      expect(rows[0].unpublished_at).not.toBe(null);
      expect((await call(sqlite, 'unpublish_collection', { collection_id: id })).error).toBe('not_published_to_shop');
    } finally { sqlite.close(); }
  });

  it('adds and removes teas without duplicating a membership', async () => {
    const sqlite = makeDb();
    try {
      seedProduct(sqlite, { id: 'p1' });
      seedProduct(sqlite, { id: 'p2' });
      const created = await runTwoStep(sqlite, 'create_collection', { title: 'Spring', initial_product_ids: ['p1'] });
      const id = created.committed.collection_id;

      const added = await runTwoStep(sqlite, 'add_tea_to_collection', { collection_id: id, product_ids: ['p1', 'p2'] });
      expect(added.committed.added).toEqual(['p2']);
      expect(added.preview.preview.already_present[0].id).toBe('p1');

      const removed = await runTwoStep(sqlite, 'remove_tea_from_collection', { collection_id: id, product_id: 'p1' });
      expect(removed.committed.removed).toEqual(['p1']);
      expect(removed.committed.items_remaining).toBe(1);

      const missing = await call(sqlite, 'remove_tea_from_collection', { collection_id: id, product_id: 'p1' });
      expect(missing.preview.not_in_collection).toEqual(['p1']);
    } finally { sqlite.close(); }
  });

  it('names the Featured strip for what it is', async () => {
    const sqlite = makeDb();
    try {
      seedProduct(sqlite, { id: 'p1' });
      sqlite.sqlite.prepare(
        `INSERT INTO collections (id, account_id, title, status, is_featured_collection) VALUES ('col_feat', ?, 'Featured', 'active', 1)`
      ).run(ACCOUNT);
      const preview = await call(sqlite, 'add_tea_to_collection', { collection_id: 'col_feat', product_id: 'p1' });
      expect(preview.preview.shop_effect).toContain('Featured');
      const listed = await call(sqlite, 'list_collections', { collection_id: 'col_feat' });
      expect(listed.collections[0].is_featured_collection).toBe(true);
    } finally { sqlite.close(); }
  });
});
