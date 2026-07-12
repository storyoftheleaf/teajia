import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const migration = readFileSync(new URL('../migrations/114_event_article_source.sql', import.meta.url), 'utf8');
const canonical = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
const through114 = readFileSync(new URL('./fixtures/schema-through-114.sql', import.meta.url), 'utf8');
const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach(dir => rmSync(dir, { recursive: true, force: true })));

function db(sql: string) {
  const dir = mkdtempSync(join(tmpdir(), 'teajia-event-article-')); dirs.push(dir);
  const path = join(dir, 'db.sqlite'); execFileSync('sqlite3', [path], { input: sql }); return path;
}
function query(path: string, sql: string) {
  return JSON.parse(execFileSync('sqlite3', ['-json', path, sql], { encoding: 'utf8' }) || '[]');
}

const legacy = `
  CREATE TABLE articles (id TEXT PRIMARY KEY, account_id TEXT NOT NULL, title TEXT NOT NULL);
  CREATE TABLE event_post_session (id TEXT PRIMARY KEY, event_id TEXT NOT NULL, energy TEXT);
`;

describe('event article source migration 114', () => {
  it('adds source association and the previously phantom shared notes field', () => {
    const path = db(legacy + migration);
    expect(query(path, `PRAGMA table_info('articles')`).map((row: any) => row.name)).toContain('source_event_id');
    expect(query(path, `PRAGMA table_info('event_post_session')`).map((row: any) => row.name)).toContain('shared_tasting_notes');
  });

  it('enforces one source event per account while allowing the same event id across accounts', () => {
    const path = db(legacy + migration);
    execFileSync('sqlite3', [path], { input: `INSERT INTO articles(id,account_id,title,source_event_id) VALUES ('a1','a','A','event-1'),('b1','b','B','event-1');` });
    expect(() => execFileSync('sqlite3', [path], { input: `INSERT INTO articles(id,account_id,title,source_event_id) VALUES ('a2','a','Again','event-1');` })).toThrow();
  });

  it('keeps the canonical and through-114 schemas aligned with migration 114', () => {
    for (const sql of [canonical, through114]) {
      const path = db(sql);
      expect(query(path, `PRAGMA table_info('articles')`).map((row: any) => row.name)).toContain('source_event_id');
      const postSessionColumns = query(path, `PRAGMA table_info('event_post_session')`).map((row: any) => row.name);
      expect(postSessionColumns).toContain('shared_tasting_notes');
      expect(postSessionColumns).toContain('host_notes');
      expect(postSessionColumns).toContain('host_changes');
    }
  });
});
