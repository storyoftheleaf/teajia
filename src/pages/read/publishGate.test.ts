/**
 * Guards the one decision every /read/* article route makes: is this route
 * visible to whoever is looking at it now.
 *
 * Before publishGate.ts existed, the fourteen article page components had no
 * gate at all: an anonymous visitor with empty storage could read the full
 * Rock Remembers interview at its own URL, even though ReadIndex.tsx never
 * lists it for a visitor. JOBC-2, prime-time audit 2026-09.
 *
 * Run with: npx vitest run src/pages/read/publishGate.test.ts
 */
import { describe, expect, it } from 'vitest';
import { ARTICLE_LIVE, isArticleVisible } from './publishGate';

describe('isArticleVisible', () => {
  it('hides a draft route from a visitor', () => {
    // /read/rock-remembers is the reproduced case: not live, and this is
    // exactly what let an anonymous visitor read it in full.
    expect(ARTICLE_LIVE['/read/rock-remembers']).toBe(false);
    expect(isArticleVisible('/read/rock-remembers', false)).toBe(false);
  });

  it('shows a live route to a visitor', () => {
    expect(ARTICLE_LIVE['/read/ritual']).toBe(true);
    expect(isArticleVisible('/read/ritual', false)).toBe(true);
  });

  it('shows every route to an owner, live or draft', () => {
    expect(isArticleVisible('/read/rock-remembers', true)).toBe(true);
    expect(isArticleVisible('/read/ritual', true)).toBe(true);
  });

  it('fails closed for a route the map has never heard of, unless the caller is the owner', () => {
    expect(isArticleVisible('/read/some-future-piece', false)).toBe(false);
    expect(isArticleVisible('/read/some-future-piece', true)).toBe(true);
  });

  it('lists all fourteen gated article routes, matching the routes wired in App.tsx', () => {
    // One entry per gated page component under src/pages/read/. leaf-to-liquor
    // is deliberately not one of them: it predates this contents index and
    // was never gated, on the audit's own count of "the fourteen".
    expect(Object.keys(ARTICLE_LIVE).sort()).toEqual(
      [
        '/read/atlas',
        '/read/before-the-mist',
        '/read/craft',
        '/read/earth-water-fire',
        '/read/essay',
        '/read/field-notes',
        '/read/field-study',
        '/read/history',
        '/read/legend',
        '/read/porcelain-and-tea',
        '/read/ritual',
        '/read/rock-remembers',
        '/read/tasting',
        '/read/tea-house',
      ].sort(),
    );
  });
});
