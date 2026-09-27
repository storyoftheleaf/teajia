import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

/**
 * Migration 0023 takes the year out of six tea names in the Bali shop.
 *
 * Run over worker/schema.sql with seeded row shapes: the six real names as the
 * live catalogue printed them on 2026-09-24, and every near miss the migration
 * must NOT touch (another shop, teaware, a name that only resembles one, a
 * rename that would collide with a product already on the shelf).
 */

const schema = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../migrations/0023_a_teas_year_lives_in_its_box.sql', import.meta.url), 'utf8');

const BALI = 'acc_teajia_bali';

interface Seed { id: string; account?: string; type?: string; ware?: string | null; given: string | null; product: string; year?: string | null }

function run(rows: Seed[]) {
  const db = new DatabaseSync(':memory:');
  db.exec(schema);
  const insert = db.prepare(
    `INSERT INTO products (id, account_id, type, teaware_category, given_name, product_name, year, slug)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const r of rows) {
    insert.run(r.id, r.account ?? BALI, r.type ?? 'Shou Puer', r.ware ?? null, r.given, r.product, r.year ?? null, `slug-${r.id}`);
  }
  db.exec(migration);
  const out = new Map<string, { given: string | null; product: string; year: string | null; slug: string }>();
  for (const row of db.prepare('SELECT id, given_name, product_name, year, slug FROM products').all() as any[]) {
    out.set(row.id, { given: row.given_name, product: row.product_name, year: row.year, slug: row.slug });
  }
  return out;
}

describe('0023: a tea’s year lives in its box', () => {
  it('renames the six teas in both name columns and keeps their year and slug', () => {
    const after = run([
      { id: 'bamboo', type: 'Dark', given: '1990 Bamboo Leaf Old Tea', product: '1990 Bamboo Leaf Old Tea', year: '1990' },
      { id: 'yiwu', type: 'Sheng Puer', given: '2004 Yiwu Raw Puerh', product: '2004 Yiwu Raw Puerh', year: '2004' },
      { id: 'brick', given: '1990 Ripe Puerh Brick', product: '1990 Ripe Puerh Brick', year: '1990' },
      { id: 'ginseng', given: '80s Ginseng Puer', product: '1980s Ginseng Puer', year: '1980s' },
      { id: 'tuo', given: '1998 Small Tuo', product: '1998 Small Tuo', year: '1998' },
      { id: 'y562', type: 'Shou', given: '1993 Y562', product: '1993 Y562 (Jixing) Black Box', year: '1993' },
    ]);
    expect(after.get('bamboo')).toMatchObject({ given: 'Bamboo Leaf Old Tea', product: 'Bamboo Leaf Old Tea', year: '1990', slug: 'slug-bamboo' });
    expect(after.get('yiwu')).toMatchObject({ given: 'Yiwu Raw Puerh', product: 'Yiwu Raw Puerh' });
    expect(after.get('brick')).toMatchObject({ given: 'Ripe Puerh Brick', product: 'Ripe Puerh Brick' });
    expect(after.get('ginseng')).toMatchObject({ given: 'Ginseng Puer', product: 'Ginseng Puer', year: '1980s' });
    expect(after.get('tuo')).toMatchObject({ given: 'Small Tuo', product: 'Small Tuo' });
    expect(after.get('y562')).toMatchObject({ given: 'Y562', product: 'Y562 (Jixing) Black Box', year: '1993' });
  });

  it('leaves another shop, teaware, look-alikes and a colliding rename alone', () => {
    const after = run([
      { id: 'other-shop', account: 'acc_someone_else', given: '1998 Small Tuo', product: '1998 Small Tuo', year: '1998' },
      { id: 'antique', type: 'Teaware', ware: 'decorative', given: null, product: '1970s Gold-Painted Porcelain Pieces' },
      { id: 'lookalike', given: '1990 Bamboo Leaf Old Tea Sample', product: '1990 Bamboo Leaf Old Tea Sample', year: '1990' },
      { id: 'plain', given: 'Naka Gushu', product: 'Naka Gushu' },
      { id: 'already-yiwu', given: 'Yiwu Raw Puerh', product: 'Yiwu Raw Puerh', year: '2010' },
      { id: 'yiwu-2004', type: 'Sheng Puer', given: '2004 Yiwu Raw Puerh', product: '2004 Yiwu Raw Puerh', year: '2004' },
    ]);
    expect(after.get('other-shop')).toMatchObject({ given: '1998 Small Tuo', product: '1998 Small Tuo' });
    expect(after.get('antique')).toMatchObject({ product: '1970s Gold-Painted Porcelain Pieces' });
    expect(after.get('lookalike')).toMatchObject({ given: '1990 Bamboo Leaf Old Tea Sample' });
    expect(after.get('plain')).toMatchObject({ given: 'Naka Gushu' });
    // Renaming would make two teas called "Yiwu Raw Puerh"; the 2004 stays as it was.
    expect(after.get('yiwu-2004')).toMatchObject({ given: '2004 Yiwu Raw Puerh', product: '2004 Yiwu Raw Puerh' });
    expect(after.get('already-yiwu')).toMatchObject({ given: 'Yiwu Raw Puerh', year: '2010' });
  });

  it('is safe to run twice', () => {
    const db = new DatabaseSync(':memory:');
    db.exec(schema);
    db.prepare(`INSERT INTO products (id, account_id, type, given_name, product_name, year, slug) VALUES ('t', ?, 'Shou Puer', '1998 Small Tuo', '1998 Small Tuo', '1998', 's')`).run(BALI);
    db.exec(migration);
    db.exec(migration);
    expect((db.prepare(`SELECT given_name FROM products WHERE id = 't'`).get() as any).given_name).toBe('Small Tuo');
  });
});
