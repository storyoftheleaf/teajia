/**
 * Guards the one decision every /read/* article route makes: is this route
 * visible to whoever is looking at it now.
 *
 * Before publishGate.ts existed, the fourteen article page components had no
 * gate at all: an anonymous visitor with empty storage could read the full
 * Rock Remembers interview at its own URL, even though ReadIndex.tsx never
 * lists it for a visitor. JOBC-2, prime-time audit 2026-09.
 *
 * The round-one fix left a hole in this file: the "lists all fourteen"
 * test below compared ARTICLE_LIVE against a list of paths typed by hand
 * into this test, not against the routes actually wired in App.tsx. Nothing
 * here would have caught a fifteenth /read/ route added to App.tsx without
 * an ArticleGate wrapper: tsc, this file's own assertions, and all three
 * browser specs stayed green with ArticleGate removed from /read/history.
 * The tests below parse src/App.tsx itself and check the real routes,
 * closing that hole.
 *
 * Run with: npx vitest run src/pages/read/publishGate.test.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ARTICLE_LIVE, isArticleVisible } from './publishGate';

const APP_TSX_PATH = path.resolve(__dirname, '../../App.tsx');

/**
 * A /read/ route not wrapped by ArticleGate, and not one of the two
 * leaf-to-liquor routes. Those two predate the curated index (see
 * publishGate.ts and articleLive.ts) and were deliberately never gated;
 * /read/leaf-to-liquor/:template also resolves to five layout names, not an
 * article, so it was never a candidate for ARTICLE_LIVE in the first place.
 * Nothing else belongs on this list: a new /read/ route earns its way onto
 * it only by being the same kind of pre-existing exception, not by being
 * forgotten.
 */
const UNGATED_READ_ROUTE_EXCEPTIONS = new Set<string>([
  '/read/leaf-to-liquor',
  '/read/leaf-to-liquor/:template',
]);

type ParsedReadRoute = {
  routePath: string;
  /** True when the route's element is wrapped in <ArticleGate href="...">. */
  gated: boolean;
  /** The href ArticleGate was given, if it was used. */
  gateHref: string | null;
};

/**
 * Reads src/App.tsx as text and finds every <Route path="/read/..."> block.
 * A block runs from the `<Route path="...">` line to the next line that is
 * only `} />` (with leading whitespace), which is how every route in this
 * file's JSX closes: `element={` opens on the Route's own line and nothing
 * inside a block (Suspense fallbacks, nested self-closing tags) ever puts a
 * bare `} />` on its own line the way the Route's own close does.
 *
 * This is deliberately a text parse, not a JSX/AST parse: App.tsx is 1000+
 * lines of an app shell with dozens of unrelated imports, and a real parse
 * would need to resolve or mock most of them. Reading the routing table as
 * text is exactly what a search-and-read human review of this file would
 * do to answer "is every /read/ route gated," so a text parse checks the
 * same thing a person would.
 */
function parseReadRoutesFromAppTsx(): ParsedReadRoute[] {
  const source = fs.readFileSync(APP_TSX_PATH, 'utf8');
  const lines = source.split('\n');
  const routes: ParsedReadRoute[] = [];

  for (let i = 0; i < lines.length; i++) {
    const routeMatch = lines[i].match(/^\s*<Route\s+path="(\/read\/[^"]*)"/);
    if (!routeMatch) continue;
    const routePath = routeMatch[1];

    let j = i + 1;
    const blockLines: string[] = [];
    while (j < lines.length && !/^\s*\}\s*\/>\s*$/.test(lines[j])) {
      blockLines.push(lines[j]);
      j++;
    }
    const block = blockLines.join('\n');

    const gateMatch = block.match(/<ArticleGate\s+href="([^"]+)"/);
    routes.push({
      routePath,
      gated: !!gateMatch,
      gateHref: gateMatch ? gateMatch[1] : null,
    });
    i = j; // resume scanning after this block's closing line
  }

  return routes;
}

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

  it('lists exactly the gated article routes actually wired in App.tsx', () => {
    // Was a hardcoded fourteen-item array typed into this test, comparing
    // ARTICLE_LIVE against itself in different clothing: it could not have
    // caught a route App.tsx stopped gating, only a typo in this file. Now
    // it reads App.tsx and compares ARTICLE_LIVE against the routes that
    // are actually wrapped in ArticleGate there.
    const parsed = parseReadRoutesFromAppTsx();
    const gatedRoutePaths = parsed.filter((r) => r.gated).map((r) => r.routePath);
    expect(gatedRoutePaths.sort()).toEqual(Object.keys(ARTICLE_LIVE).sort());
  });
});

describe('every /read/ route in App.tsx is gated or a named exception', () => {
  // Before this test existed, nothing caught a /read/ route App.tsx stopped
  // gating: an ArticleGate wrapper removed from one route left tsc, this
  // file's other assertions, and all three browser specs green. See the
  // failing run pasted into this round's commit message for the reproduction.
  const parsed = parseReadRoutesFromAppTsx();

  it('found at least the fourteen curated routes plus the two leaf-to-liquor routes', () => {
    // A parser that silently matched nothing would make every test below
    // vacuously pass. Pin a floor so a broken regex fails loudly instead.
    expect(parsed.length).toBeGreaterThanOrEqual(16);
  });

  it.each(parseReadRoutesFromAppTsx())(
    '$routePath is gated and listed in ARTICLE_LIVE, or is a named exception',
    (route) => {
      if (UNGATED_READ_ROUTE_EXCEPTIONS.has(route.routePath)) {
        expect(route.gated, `${route.routePath} is a named exception and should stay ungated`).toBe(false);
        return;
      }
      expect(route.gated, `${route.routePath} has no ArticleGate wrapper in App.tsx`).toBe(true);
      expect(route.gateHref, `${route.routePath}'s ArticleGate href does not match its own Route path`).toBe(route.routePath);
      expect(
        Object.prototype.hasOwnProperty.call(ARTICLE_LIVE, route.routePath),
        `${route.routePath} is gated in App.tsx but missing from ARTICLE_LIVE`,
      ).toBe(true);
    },
  );

  it('accounted for every /read/ route App.tsx defines: no unexpected exceptions', () => {
    const unaccountedFor = parsed.filter(
      (r) => !r.gated && !UNGATED_READ_ROUTE_EXCEPTIONS.has(r.routePath),
    );
    expect(unaccountedFor.map((r) => r.routePath)).toEqual([]);
  });
});
