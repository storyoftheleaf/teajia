import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1 } from './helpers/sqliteD1';
import { mentionNeedles } from '../src/peopleMentions';

// A magazine article that names a person reaches their page without anyone
// ticking them as its subject (Adrian, 2026-09-29: "should be automatic").
// Driven against a real database through the public page's own route.

const databases: SqliteD1[] = [];
function database() { const db = new SqliteD1(); databases.push(db); return db; }
afterEach(() => { while (databases.length) databases.pop()!.close(); });

async function page(db: SqliteD1, slug: string) {
  const response = await worker.fetch(new Request(`https://worker.test/api/people/${slug}`), { DB: db as any, JWT_SECRET: 'named-in-articles' } as any);
  expect(response.status).toBe(200);
  return response.json() as Promise<{ featured_in: Array<{ slug: string }> }>;
}

function seed(db: SqliteD1) {
  db.sqlite.prepare(`INSERT INTO accounts (id, slug, name, status, public_enabled) VALUES ('acc-one', 'acc-one', 'Teajia', 'active', 1)`).run();
  db.sqlite.prepare(`INSERT INTO contributors (id, account_id, display_name, chinese_name, is_published, links) VALUES ('shangyin-qiwu', 'acc-one', 'Shangyin Qiwu', '上隐器物', 1, '[]')`).run();
  db.sqlite.prepare(`INSERT INTO contributors (id, account_id, display_name, is_published, links) VALUES ('mei', 'acc-one', 'Mei', 1, '[]')`).run();
  const article = db.sqlite.prepare(`INSERT INTO articles (id, account_id, title, subtitle, slug, status, author_id, blocks, subject_ids, published_at) VALUES (?, 'acc-one', ?, ?, ?, ?, ?, ?, '[]', ?)`);
  article.run('a1', 'Mending in Wuyi', null, 'mending-in-wuyi', 'published', 'adrian', JSON.stringify([{ type: 'paragraph', text: 'I took Shangyin Qiwu\'s class and went back.' }]), '2026-09-01');
  article.run('a2', 'A studio name', null, 'a-studio-name', 'published', 'adrian', JSON.stringify([{ type: 'paragraph', text: 'The sign over the door reads 上隐器物.' }]), '2026-09-02');
  article.run('a3', 'Unrelated', null, 'unrelated', 'published', 'adrian', JSON.stringify([{ type: 'paragraph', text: 'shangyin qiwu, lower case, is not the name.' }]), '2026-09-03');
  article.run('a4', 'Still a draft', null, 'still-a-draft', 'draft', 'adrian', JSON.stringify([{ type: 'paragraph', text: 'Shangyin Qiwu, not yet published.' }]), null);
  article.run('a5', 'Mei the word', null, 'mei-the-word', 'published', 'adrian', JSON.stringify([{ type: 'paragraph', text: 'Mei is a common word here.' }]), '2026-09-04');
}

describe('people named in magazine articles', () => {
  it('lists a published article that names the person or their Chinese name, untagged, and nothing else', async () => {
    const db = database();
    seed(db);
    const slugs = (await page(db, 'shangyin-qiwu')).featured_in.map(article => article.slug).sort();
    expect(slugs).toEqual(['a-studio-name', 'mending-in-wuyi']);
  });

  it('does not match a one-word name, which would pull in every article that uses the word', async () => {
    const db = database();
    seed(db);
    expect((await page(db, 'mei')).featured_in).toEqual([]);
  });

  it('trusts only names specific enough to be a person', () => {
    expect(mentionNeedles({ display_name: 'Shangyin  Qiwu', chinese_name: '上隐器物' })).toEqual(['Shangyin Qiwu', '上隐器物']);
    expect(mentionNeedles({ display_name: 'Mei', chinese_name: '美' })).toEqual(['', '']);
    expect(mentionNeedles({ display_name: 'Al Wu', chinese_name: 'AW' })).toEqual(['', '']);
    expect(mentionNeedles({})).toEqual(['', '']);
  });
});
