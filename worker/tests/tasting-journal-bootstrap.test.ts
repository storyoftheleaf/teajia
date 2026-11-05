import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { SqliteD1 } from './helpers/sqliteD1';
import { tableInfo } from './helpers/migratedSqlite';

// Prepare and exercise the two real handlers' statements, so this test cannot
// hide a missing bootstrap column behind a manually maintained query fixture.
const source = ts.createSourceFile('index.ts', readFileSync('worker/src/index.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const journalWrites: string[] = [];
function visit(node: ts.Node) {
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
    && node.expression.name.text === 'prepare') {
    const argument = node.arguments[0];
    if (argument && (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument))
      && /INSERT INTO customer_tasting_journal\s*\(/.test(argument.text)
      && /compass_entry_id/.test(argument.text)) journalWrites.push(argument.text);
  }
  ts.forEachChild(node, visit);
}
visit(source);

describe('tasting journal bootstrap preserves the migration 0012 source link', () => {
  it('matches the nullable TEXT contract and foreign keys in the current ledger', () => {
    const reference = new SqliteD1('schema');
    const ledger = new SqliteD1('migrations');
    try {
      const expected = tableInfo(ledger.sqlite, 'customer_tasting_journal').find(column => column.name === 'compass_entry_id');
      expect(expected).toMatchObject({ name: 'compass_entry_id', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 });
      expect(tableInfo(reference.sqlite, 'customer_tasting_journal').find(column => column.name === 'compass_entry_id'))
        .toMatchObject({ name: 'compass_entry_id', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 });
      expect(reference.sqlite.prepare('PRAGMA foreign_key_list(customer_tasting_journal)').all())
        .toEqual(ledger.sqlite.prepare('PRAGMA foreign_key_list(customer_tasting_journal)').all());
    } finally { reference.close(); ledger.close(); }
  });

  for (const source of ['schema', 'migrations'] as const) {
    it(`${source}: both real handler statements preserve provenance through an upsert`, () => {
      const db = new SqliteD1(source);
      try {
        expect(journalWrites).toHaveLength(2);
        journalWrites.forEach(sql => expect(() => db.sqlite.prepare(sql)).not.toThrow());
        journalWrites.forEach((sql, index) => db.sqlite.prepare(sql).run(
          `journal-${index}`, null, 'synthetic-user', 'synthetic-product', 'Synthetic tea', 'Puerh', null,
          `note-${index}`, '[]', `synthetic-compass-${index}`, 0, '2026-11-05T00:00:00Z',
        ));
        expect(db.sqlite.prepare(`SELECT id, account_id, note, compass_entry_id FROM customer_tasting_journal`).all())
          .toEqual([{ id: 'journal-0', account_id: null, note: 'note-1', compass_entry_id: 'synthetic-compass-1' }]);
        db.sqlite.prepare(`INSERT INTO customer_tasting_journal (id,user_id) VALUES ('unlinked','synthetic-user')`).run();
        expect(db.sqlite.prepare(`SELECT compass_entry_id FROM customer_tasting_journal WHERE id='unlinked'`).get())
          .toEqual({ compass_entry_id: null });
      } finally { db.close(); }
    });
  }
});
