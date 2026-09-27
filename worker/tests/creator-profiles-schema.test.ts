import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { seedFromMigrations, tableInfo, schemaObjects } from './helpers/migratedSqlite';
import {
  normalizeContributorLinks,
  parseStoredContributorLinks,
  projectPublicGalleryImage,
} from '../src/profileDomain';

const schema = readFileSync(fileURLToPath(new URL('../schema.sql', import.meta.url)), 'utf8');

function canonicalDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(schema);
  return db;
}

describe('Lane A schema: business_name, contributor_gallery_images, typed links', () => {
  it('gives contributors a nullable business_name with no default', () => {
    const db = canonicalDb();
    try {
      const column = tableInfo(db, 'contributors').find(c => c.name === 'business_name');
      expect(column).toBeTruthy();
      expect(column?.notnull).toBe(0);
      expect(column?.dflt_value).toBeNull();
    } finally {
      db.close();
    }
  });

  it('creates contributor_gallery_images with the row-per-item shape payment_methods and profile_favorites already use', () => {
    const db = canonicalDb();
    try {
      const columns = tableInfo(db, 'contributor_gallery_images').map(c => c.name).sort();
      expect(columns).toEqual(
        ['caption', 'contributor_id', 'created_at', 'id', 'image_url', 'position', 'updated_at'].sort(),
      );
      const idColumn = tableInfo(db, 'contributor_gallery_images').find(c => c.name === 'id');
      expect(idColumn?.pk).toBe(1);
      const imageUrlColumn = tableInfo(db, 'contributor_gallery_images').find(c => c.name === 'image_url');
      expect(imageUrlColumn?.notnull).toBe(1);
      const fk = db.prepare(
        `SELECT "table", "from", "to", on_delete FROM pragma_foreign_key_list('contributor_gallery_images') WHERE "from"='contributor_id'`,
      ).get();
      expect(fk).toEqual({ table: 'contributors', from: 'contributor_id', to: 'id', on_delete: 'CASCADE' });
      expect(schemaObjects(db, 'contributor_gallery_images').some(o => o.name === 'idx_contributor_gallery_images_contributor')).toBe(true);
    } finally {
      db.close();
    }
  });

  it('enforces the caption length ceiling and a non-negative position, same as the sibling row-per-item tables', () => {
    const db = canonicalDb();
    try {
      db.exec(`
        INSERT INTO accounts (id, slug, name) VALUES ('acc-a', 'acc-a', 'Acc A');
        INSERT INTO contributors (id, account_id, display_name) VALUES ('person-a', 'acc-a', 'Person A');
      `);
      expect(() => db.exec(
        `INSERT INTO contributor_gallery_images (id, contributor_id, image_url, caption)
         VALUES ('img-1', 'person-a', 'https://example.com/a.jpg', '${'x'.repeat(281)}')`,
      )).toThrow(/CHECK/);
      expect(() => db.exec(
        `INSERT INTO contributor_gallery_images (id, contributor_id, image_url, position)
         VALUES ('img-2', 'person-a', 'https://example.com/a.jpg', -1)`,
      )).toThrow(/CHECK/);
      db.exec(
        `INSERT INTO contributor_gallery_images (id, contributor_id, image_url, caption, position)
         VALUES ('img-3', 'person-a', 'https://example.com/a.jpg', 'Pouring tea', 0)`,
      );
      expect(db.prepare(`SELECT id FROM contributor_gallery_images WHERE contributor_id='person-a'`).all())
        .toEqual([{ id: 'img-3' }]);
      db.exec(`DELETE FROM contributors WHERE id='person-a'`);
      expect(db.prepare(`SELECT COUNT(*) AS count FROM contributor_gallery_images`).get()).toEqual({ count: 0 });
    } finally {
      db.close();
    }
  });

  it('applies migrations 0019 through 0021 to build the same business_name and gallery shape schema.sql describes', () => {
    const canonical = canonicalDb();
    const { db: migrated } = seedFromMigrations();
    try {
      expect(migrated.prepare(`SELECT name FROM pragma_table_info('contributors') WHERE name='business_name'`).get())
        .toEqual({ name: 'business_name' });
      const canonicalColumns = tableInfo(canonical, 'contributor_gallery_images')
        .map(c => ({ name: c.name, type: c.type, notnull: c.notnull, dflt_value: c.dflt_value, pk: c.pk }));
      const migratedColumns = tableInfo(migrated, 'contributor_gallery_images')
        .map(c => ({ name: c.name, type: c.type, notnull: c.notnull, dflt_value: c.dflt_value, pk: c.pk }));
      expect(migratedColumns).toEqual(canonicalColumns);
    } finally {
      canonical.close();
      migrated.close();
    }
  });
});

describe('migration 0021: links learn their platform', () => {
  const migrationSql = readFileSync(
    fileURLToPath(new URL('../migrations/0021_links_learn_their_platform.sql', import.meta.url)),
    'utf8',
  );

  function seedLinksRow(links: unknown, runs = 1) {
    const db = new DatabaseSync(':memory:');
    db.exec(schema);
    db.exec(`
      INSERT INTO accounts (id, slug, name) VALUES ('acc-a', 'acc-a', 'Acc A');
      INSERT INTO contributors (id, account_id, display_name, links)
      VALUES ('person-a', 'acc-a', 'Person A', '${JSON.stringify(links).replace(/'/g, "''")}');
    `);
    for (let i = 0; i < runs; i += 1) db.exec(migrationSql);
    const row = db.prepare(`SELECT links FROM contributors WHERE id='person-a'`).get() as { links: string };
    db.close();
    return JSON.parse(row.links);
  }

  it('rewrites a generic https link to platform website, keeping the url as the value and dropping no label', () => {
    expect(seedLinksRow([{ label: 'Website', url: 'https://cloudmountaintea.com' }])).toEqual([
      { platform: 'website', value: 'https://cloudmountaintea.com' },
    ]);
  });

  it('rewrites a known-social-platform link to platform other, keeping the url as the value and the old label alongside it', () => {
    expect(seedLinksRow([{ label: 'Instagram', url: 'https://instagram.com/amarateas' }])).toEqual([
      { platform: 'other', value: 'https://instagram.com/amarateas', label: 'Instagram' },
    ]);
    expect(seedLinksRow([{ label: 'WeChat', url: 'https://wechat.com/qr/abc123' }])).toEqual([
      { platform: 'other', value: 'https://wechat.com/qr/abc123', label: 'WeChat' },
    ]);
  });

  it('never drops the address: a known-social-platform link with no label still keeps its url', () => {
    expect(seedLinksRow([{ label: '', url: 'https://instagram.com/nolabel' }])).toEqual([
      { platform: 'other', value: 'https://instagram.com/nolabel' },
    ]);
  });

  it('leaves an empty links array untouched', () => {
    expect(seedLinksRow([])).toEqual([]);
  });

  it('leaves a row already written in the new shape untouched (idempotent)', () => {
    expect(seedLinksRow([{ platform: 'instagram', value: '@already' }])).toEqual([
      { platform: 'instagram', value: '@already' },
    ]);
  });

  it('converts a mixed row entry by entry, each on its own rule, address intact on both', () => {
    expect(seedLinksRow([
      { label: 'Website', url: 'https://cloudmountaintea.com' },
      { label: 'WeChat', url: 'https://wechat.com/qr/abc123' },
    ])).toEqual([
      { platform: 'website', value: 'https://cloudmountaintea.com' },
      { platform: 'other', value: 'https://wechat.com/qr/abc123', label: 'WeChat' },
    ]);
  });

  it('is a true no-op the second time it runs, including on rows that now carry a label', () => {
    const links = [
      { label: 'Website', url: 'https://cloudmountaintea.com' },
      { label: 'Instagram', url: 'https://instagram.com/amarateas' },
    ];
    const oncePassed = seedLinksRow(links, 1);
    const twicePassed = seedLinksRow(links, 2);
    expect(twicePassed).toEqual(oncePassed);
    expect(twicePassed).toEqual([
      { platform: 'website', value: 'https://cloudmountaintea.com' },
      { platform: 'other', value: 'https://instagram.com/amarateas', label: 'Instagram' },
    ]);
  });
});

describe('profileDomain: typed contributor links', () => {
  it('normalizes a valid links write, one entry per platform', () => {
    const result = normalizeContributorLinks([
      { platform: 'wechat', value: 'tanaka_tea_kyoto', qr_image_url: 'https://images.unsplash.com/photo-1.jpg' },
      { platform: 'instagram', value: '@tanakateahouse' },
      { platform: 'website', value: 'https://example.com' },
    ]);
    expect(result.error).toBeUndefined();
    expect(result.value).toEqual([
      { platform: 'wechat', value: 'tanaka_tea_kyoto', qr_image_url: 'https://images.unsplash.com/photo-1.jpg' },
      { platform: 'instagram', value: '@tanakateahouse', qr_image_url: null },
      { platform: 'website', value: 'https://example.com', qr_image_url: null },
    ]);
  });

  it('refuses a platform outside the fixed vocabulary', () => {
    expect(normalizeContributorLinks([{ platform: 'facebook', value: 'someone' }]).error).toMatch(/platform/);
  });

  it('refuses a website link whose value is not a valid https url', () => {
    expect(normalizeContributorLinks([{ platform: 'website', value: 'not-a-url' }]).error).toMatch(/https URL/);
    expect(normalizeContributorLinks([{ platform: 'website', value: 'http://example.com' }]).error).toMatch(/https URL/);
  });

  it('accepts a non-website value with no url validation, since a handle is not a url', () => {
    const result = normalizeContributorLinks([{ platform: 'wechat', value: 'not-a-url-at-all' }]);
    expect(result.error).toBeUndefined();
    expect(result.value?.[0].value).toBe('not-a-url-at-all');
  });

  it('round-trips through parseStoredContributorLinks, dropping anything malformed rather than throwing', () => {
    const stored = JSON.stringify([
      { platform: 'instagram', value: '@amarateas' },
      { platform: 'not-a-real-platform', value: 'x' },
      { value: 'no platform at all' },
      'not even an object',
    ]);
    expect(parseStoredContributorLinks(stored)).toEqual([
      { platform: 'instagram', value: '@amarateas', qr_image_url: null },
    ]);
  });

  it('reads a missing or invalid links column as no links, never throwing', () => {
    expect(parseStoredContributorLinks(null)).toEqual([]);
    expect(parseStoredContributorLinks(undefined)).toEqual([]);
    expect(parseStoredContributorLinks('not json')).toEqual([]);
    expect(parseStoredContributorLinks('{}')).toEqual([]);
  });

  it('carries an optional label through both a write and a read', () => {
    const written = normalizeContributorLinks([
      { platform: 'other', value: 'https://instagram.com/amarateas', label: 'Instagram' },
    ]);
    expect(written.error).toBeUndefined();
    expect(written.value).toEqual([
      { platform: 'other', value: 'https://instagram.com/amarateas', label: 'Instagram', qr_image_url: null },
    ]);
    const roundTripped = parseStoredContributorLinks(JSON.stringify(written.value));
    expect(roundTripped).toEqual([
      { platform: 'other', value: 'https://instagram.com/amarateas', qr_image_url: null, label: 'Instagram' },
    ]);
  });

  it('omits label entirely rather than storing an empty one', () => {
    const result = normalizeContributorLinks([{ platform: 'other', value: 'https://instagram.com/amarateas', label: '  ' }]);
    expect(result.error).toBeUndefined();
    expect(result.value?.[0]).not.toHaveProperty('label');
    expect(parseStoredContributorLinks(JSON.stringify([{ platform: 'other', value: 'x', label: '' }]))[0]).not.toHaveProperty('label');
  });
});

describe('profileDomain: gallery image projection', () => {
  it('projects only the public-safe fields of a gallery row', () => {
    expect(projectPublicGalleryImage({
      id: 'img-1',
      contributor_id: 'person-a',
      image_url: 'https://example.com/a.jpg',
      caption: 'Pouring tea',
      position: 0,
    })).toEqual({
      id: 'img-1',
      image_url: 'https://example.com/a.jpg',
      caption: 'Pouring tea',
      position: 0,
    });
  });
});
