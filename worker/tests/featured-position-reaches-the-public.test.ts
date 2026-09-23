import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * The public products response is projected through PUBLIC_FIELDS, so a column
 * the query selects still never reaches the page unless it is named in that
 * list too. On 2026-09-23 `featured_position` was added to the query, shipped,
 * deployed, and arrived at the browser absent: the whole suite passed, because
 * nothing asserted on the projection.
 *
 * This is the pair that catches it. The home page picks the featured tea with
 * the lowest position, so without this field it silently falls back to whichever
 * the catalogue returns first, which is the bug the field exists to fix, and it
 * looks like working software.
 */
const source = readFileSync(fileURLToPath(new URL('../src/index.ts', import.meta.url)), 'utf8');

function publicFields(): string[] {
  const start = source.indexOf('const PUBLIC_FIELDS = [');
  const end = source.indexOf('];', start);
  expect(start, 'PUBLIC_FIELDS is gone or renamed').toBeGreaterThan(-1);
  return [...source.slice(start, end).matchAll(/'([a-z_]+)'/g)].map(m => m[1]);
}

describe('a column the public query selects also has to be published', () => {
  it('featured_position is projected, not just selected', () => {
    expect(source, 'the query no longer derives featured_position').toContain('AS featured_position');
    expect(publicFields()).toContain('featured_position');
  });

  it('it travels with is_featured, which is useless alone for picking ONE tea', () => {
    const fields = publicFields();
    expect(fields).toContain('is_featured');
    // Both or neither: is_featured says THAT a tea is featured, featured_position
    // says WHICH one comes first. A surface showing one tea needs the second.
    expect(fields.includes('is_featured') && fields.includes('featured_position')).toBe(true);
  });
});
