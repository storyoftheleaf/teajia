import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const priorSchema = readFileSync(new URL('./fixtures/schema-through-112.sql', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../migrations/113_tasting_note_curation.sql', import.meta.url), 'utf8');
const canonical = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
const directories: string[] = [];

afterEach(() => directories.splice(0).forEach(path => rmSync(path, { recursive: true, force: true })));

function database(sql: string) {
  const directory = mkdtempSync(join(tmpdir(), 'teajia-note-curation-'));
  directories.push(directory);
  const path = join(directory, 'test.sqlite');
  execFileSync('sqlite3', [path], { input: `PRAGMA foreign_keys=ON;\n${sql}` });
  return path;
}

function query(path: string, sql: string): Array<Record<string, unknown>> {
  return JSON.parse(execFileSync('sqlite3', ['-json', path, sql], { encoding: 'utf8' }) || '[]');
}

describe('tasting-note curation migration 113', () => {
  it('upgrades schema-through-112 and can be safely replayed', () => {
    const db = database(priorSchema + migration + migration);
    expect(query(db, `SELECT name FROM sqlite_master WHERE type='table' AND name IN ('tasting_note_candidates','product_impressions') ORDER BY name`))
      .toEqual([{ name: 'product_impressions' }, { name: 'tasting_note_candidates' }]);
    expect(query(db, `PRAGMA integrity_check`)).toEqual([{ integrity_check: 'ok' }]);
    expect(query(db, `PRAGMA foreign_key_check`)).toEqual([]);
  });

  it('matches the canonical schema columns and indexes', () => {
    const upgraded = database(priorSchema + migration);
    const fresh = database(canonical);
    for (const table of ['tasting_note_candidates', 'product_impressions']) {
      expect(query(upgraded, `PRAGMA table_info('${table}')`).map(({ cid: _cid, ...row }) => row))
        .toEqual(query(fresh, `PRAGMA table_info('${table}')`).map(({ cid: _cid, ...row }) => row));
      expect(query(upgraded, `PRAGMA index_list('${table}')`).map(({ seq: _seq, ...row }) => row))
        .toEqual(query(fresh, `PRAGMA index_list('${table}')`).map(({ seq: _seq, ...row }) => row));
    }
  });

  it('enforces one candidate per member journal note and one impression per promotion', () => {
    const db = database(priorSchema + migration);
    execFileSync('sqlite3', [db], { input: `
      INSERT INTO accounts (id, slug, name) VALUES ('a','a','A');
      INSERT INTO users (id,email,name,password_hash) VALUES ('u','u@test','U','x');
      INSERT INTO products (id,account_id,type,product_name) VALUES ('p','a','Tea','P');
      INSERT INTO customer_tasting_journal (id,account_id,user_id,product_id) VALUES ('j','a','u@test','p');
      INSERT INTO tasting_note_candidates (id,account_id,journal_entry_id,note_key,product_id,author_user_id,source_text)
        VALUES ('c','a','j','aroma','p','u','orchid');
      INSERT INTO product_impressions (id,account_id,product_id,candidate_id,text,attribution_name,published_by)
        VALUES ('i','a','p','c','orchid','U','u');
    ` });
    expect(() => execFileSync('sqlite3', [db], { input: `INSERT INTO tasting_note_candidates (id,account_id,journal_entry_id,note_key,product_id,author_user_id,source_text) VALUES ('c2','a','j','aroma','p','u','x')` })).toThrow();
    expect(() => execFileSync('sqlite3', [db], { input: `INSERT INTO product_impressions (id,account_id,product_id,candidate_id,text,attribution_name,published_by) VALUES ('i2','a','p','c','x','U','u')` })).toThrow();
  });
});
