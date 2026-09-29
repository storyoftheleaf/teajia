import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

/**
 * Migration 0029 moves the porcelain restorer's profile from shangyin-qiwu to
 * yan-jinwen and gives it his own name.
 *
 * Run over worker/schema.sql with foreign keys ON, inside one transaction, the
 * way D1 applies a migration. The seed puts his id in every column that points
 * at a profile, beside a second person the migration must not touch, so the
 * test proves both halves: everything of his moves, nothing of anyone else's.
 */

const schema = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../migrations/0029_yan_jinwen_takes_his_own_name.sql', import.meta.url), 'utf8');

function seeded(opts: { alreadyTaken?: boolean } = {}) {
  const db = new DatabaseSync(':memory:');
  db.exec(schema);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(`
    INSERT INTO accounts (id, slug, name) VALUES ('acc', 'acc', 'Teajia');
    INSERT INTO contributors (id, account_id, display_name, chinese_name, role, beginnings, is_published, links)
      VALUES ('shangyin-qiwu', 'acc', 'Shangyin Qiwu', '上隐器物', 'Porcelain restorer', 'First of all, I quite like collecting things.', 1, '[]');
    INSERT INTO contributors (id, account_id, display_name, is_published, links) VALUES ('mei', 'acc', 'Mei Lin', 1, '[]');
    UPDATE accounts SET host_contributor_id = 'shangyin-qiwu' WHERE id = 'acc';
    INSERT INTO contributor_accounts (contributor_id, account_id) VALUES ('shangyin-qiwu', 'acc'), ('mei', 'acc');
    INSERT INTO events (id, account_id, slug, title, event_date) VALUES ('ev', 'acc', 'ev', 'A tea session', '2026-10-01');
    INSERT INTO event_contributors (id, account_id, event_id, contributor_id, role) VALUES ('ec1', 'acc', 'ev', 'shangyin-qiwu', 'lead_host'), ('ec2', 'acc', 'ev', 'mei', 'co_host');
    INSERT INTO contributor_gallery_images (id, contributor_id, image_url) VALUES ('g1', 'shangyin-qiwu', 'https://x/1.jpg'), ('g2', 'mei', 'https://x/2.jpg');
    INSERT INTO payment_share_links (id, account_id, contributor_id, token) VALUES ('l1', 'acc', 'shangyin-qiwu', 'tok1');
    INSERT INTO collections (id, account_id, title) VALUES ('col', 'acc', 'Favourites');
    INSERT INTO collection_publications (id, collection_id, target_type, target_id, slug) VALUES ('cp1', 'col', 'person', 'shangyin-qiwu', 'cp1'), ('cp2', 'col', 'store', 'shangyin-qiwu', 'cp2');
    INSERT INTO articles (id, account_id, title, slug, status, author_id, blocks, subject_ids, pull_quote_subject)
      VALUES ('a1', 'acc', 'Mending', 'mending', 'published', 'shangyin-qiwu', '[]', '["mei","shangyin-qiwu"]', 'shangyin-qiwu'),
             ('a2', 'acc', 'Other', 'other', 'published', 'mei', '[]', '["mei"]', 'mei');
  `);
  if (opts.alreadyTaken) {
    db.exec(`INSERT INTO contributors (id, account_id, display_name, is_published, links) VALUES ('yan-jinwen', 'acc', 'Someone else', 0, '[]')`);
  }
  return db;
}

function migrate(db: DatabaseSync) {
  db.exec('BEGIN');
  db.exec(migration);
  db.exec('COMMIT');
}

const one = (db: DatabaseSync, sql: string) => db.prepare(sql).get() as Record<string, unknown>;
const col = (db: DatabaseSync, sql: string) => (db.prepare(sql).all() as Array<Record<string, unknown>>).map(r => Object.values(r)[0]);

describe('0029: Yan Jinwen takes his own name', () => {
  it('moves his profile, under his name, and every row that points at it', () => {
    const db = seeded();
    migrate(db);

    expect(one(db, `SELECT id, display_name, chinese_name, role, beginnings FROM contributors WHERE id = 'yan-jinwen'`)).toEqual({
      id: 'yan-jinwen', display_name: 'Yan Jinwen', chinese_name: '严金文', role: 'Porcelain restorer', beginnings: 'First of all, I quite like collecting things.',
    });
    expect(col(db, `SELECT id FROM contributors WHERE id = 'shangyin-qiwu'`)).toEqual([]);
    expect(col(db, `SELECT host_contributor_id FROM accounts`)).toEqual(['yan-jinwen']);
    expect(col(db, `SELECT contributor_id FROM contributor_accounts ORDER BY contributor_id`)).toEqual(['mei', 'yan-jinwen']);
    expect(col(db, `SELECT contributor_id FROM event_contributors ORDER BY id`)).toEqual(['yan-jinwen', 'mei']);
    expect(col(db, `SELECT contributor_id FROM contributor_gallery_images ORDER BY id`)).toEqual(['yan-jinwen', 'mei']);
    expect(col(db, `SELECT contributor_id FROM payment_share_links`)).toEqual(['yan-jinwen']);
    // A person-publication follows him; a store publication that only shares the text is left alone.
    expect(col(db, `SELECT target_id FROM collection_publications ORDER BY id`)).toEqual(['yan-jinwen', 'shangyin-qiwu']);
    expect(one(db, `SELECT author_id, subject_ids, pull_quote_subject FROM articles WHERE id = 'a1'`)).toEqual({
      author_id: 'yan-jinwen', subject_ids: '["mei","yan-jinwen"]', pull_quote_subject: 'yan-jinwen',
    });
    expect(one(db, `SELECT author_id, subject_ids, pull_quote_subject FROM articles WHERE id = 'a2'`)).toEqual({
      author_id: 'mei', subject_ids: '["mei"]', pull_quote_subject: 'mei',
    });
    expect(col(db, 'PRAGMA foreign_key_check')).toEqual([]);
  });

  it('changes nothing on a second run', () => {
    const db = seeded();
    migrate(db);
    const before = JSON.stringify(db.prepare('SELECT id, display_name FROM contributors ORDER BY id').all());
    migrate(db);
    expect(JSON.stringify(db.prepare('SELECT id, display_name FROM contributors ORDER BY id').all())).toBe(before);
  });

  it('touches nothing if the new address is already somebody’s', () => {
    const db = seeded({ alreadyTaken: true });
    migrate(db);
    expect(one(db, `SELECT display_name FROM contributors WHERE id = 'shangyin-qiwu'`)).toEqual({ display_name: 'Shangyin Qiwu' });
    expect(one(db, `SELECT display_name FROM contributors WHERE id = 'yan-jinwen'`)).toEqual({ display_name: 'Someone else' });
    expect(col(db, `SELECT contributor_id FROM contributor_gallery_images ORDER BY id`)).toEqual(['shangyin-qiwu', 'mei']);
  });
});
