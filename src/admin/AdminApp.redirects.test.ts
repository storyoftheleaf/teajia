import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./AdminApp.tsx', import.meta.url), 'utf8');

describe('legacy admin redirects keep the incoming query', () => {
  it('every <Navigate> in AdminApp carries location.search through a redirect helper', () => {
    const tags = source.match(/<Navigate\b[^>]*?\/>/g) ?? [];
    expect(tags.length).toBeGreaterThan(10);
    for (const tag of tags) {
      expect(tag, tag).toMatch(/(?:carryQuery|adminLandingRedirect)\([^)]*location\.search(?:, hasCatalogBundle)?\)/);
    }
  });
  it('seeds the Stock search from ?search=', () => {
    expect(source).toContain("get('search')");
    expect(source).toContain('setInventorySearchQuery(seeded)');
  });
});
