import { readFileSync, mkdtempSync, readdirSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MIGRATIONS_DIR, seedFromMigrations, splitStatements } from './helpers/migratedSqlite';

const additions = [
  '0122_wordforge_article_revisions.sql',
  '0123_article_publication_generation.sql',
  '0124_editorial_pilot.sql',
  '0125_native_article_drafts.sql',
];
const existingLater = [
  '0061_attendee_recap_snapshots.sql',
  '0065_sessions_origin_and_claim_receipts.sql',
  '0066_checkout_fulfillment.sql',
  '0067_private_session_reflections.sql',
  '0068_curate_history_lookup_indexes.sql',
];
const expectedTables = ['wordforge_article_revisions', 'article_editorial_receipts', 'article_native_drafts'];

describe('editorial additions preserve the deployed migration ledger', () => {
  it('builds a fresh database with every existing and editorial migration exactly once', () => {
    const fresh = seedFromMigrations();
    try {
      expect(fresh.applied).toEqual(expect.arrayContaining([...additions, ...existingLater]));
      expect(fresh.skipped.filter(line => additions.some(file => line.startsWith(file)))).toEqual([]);
      for (const name of expectedTables) expect(fresh.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name)).toBeTruthy();
      expect(fresh.db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    } finally { fresh.db.close(); }
  });

  it('applies the missing DDL after already deployed later migrations without changing existing rows or indexes', () => {
    const directory = mkdtempSync(join(tmpdir(), 'teajia-editorial-upgrade-'));
    try {
      for (const file of readdirSync(MIGRATIONS_DIR).filter(file => file.endsWith('.sql') && !additions.includes(file))) copyFileSync(join(MIGRATIONS_DIR, file), join(directory, file));
      const live = seedFromMigrations({ dir: directory });
      try {
        expect(live.applied).toEqual(expect.arrayContaining(existingLater));
        live.db.exec("PRAGMA foreign_keys = ON; INSERT INTO accounts(id,slug,name,status) VALUES('ledger-owner','ledger-owner','Synthetic owner','active'); INSERT INTO articles(id,account_id,title,slug,status,blocks,published_at) VALUES('ledger-public-a','ledger-owner','Synthetic public A','stable-ledger-address','published','[]','2026-01-01');");
        const beforeRows = live.db.prepare('SELECT * FROM articles').all();
        const beforeIndexes = live.db.prepare("SELECT name,sql FROM sqlite_master WHERE type='index' ORDER BY name").all();
        for (const file of additions) {
          for (const statement of splitStatements(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'))) {
            const withoutComments = statement.replace(/--[^\n]*/g, '').trim();
            expect(withoutComments).toMatch(/^(CREATE (?:UNIQUE )?(?:TABLE|INDEX)|ALTER TABLE \w+ ADD COLUMN)\b/i);
            live.db.exec(statement);
          }
        }
        const after = live.db.prepare('SELECT * FROM articles').all() as Record<string, unknown>[];
        expect(after.map(row => Object.fromEntries(Object.keys(beforeRows[0]).map(key => [key, row[key]])))).toEqual(beforeRows);
        expect(live.db.prepare("SELECT name,sql FROM sqlite_master WHERE type='index' ORDER BY name").all()).toEqual(expect.arrayContaining(beforeIndexes));
        expect(after[0]).toMatchObject({ publication_generation: 0, approved_source_revision_id: null, read_issue_slot: null, editorial_receipt_id: null });
        for (const name of expectedTables) expect(live.db.prepare(`SELECT COUNT(*) AS count FROM ${name}`).get()).toMatchObject({ count: 0 });
        expect(live.db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
      } finally { live.db.close(); }
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
});
