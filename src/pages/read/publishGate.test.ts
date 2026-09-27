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
import { ARTICLE_LIVE, isArticleVisible, isReadPathPublic, isUngatedReadPath } from './articleLive';
import { visibleMoreLinks, type MoreLink } from './immersive';

const APP_TSX_PATH = path.resolve(__dirname, '../../App.tsx');

/**
 * A /read route not wrapped by ArticleGate, and not one of the named
 * exceptions. The list itself is no longer typed here: it lives beside the
 * live map in articleLive.ts, where the middleware's fail-closed check and the
 * rail filter read the same two paths. A copy in this file was a third place
 * the same fact had to be remembered.
 *
 * `/read/leaf-to-liquor/:template` is the one entry this test adds, because a
 * route pattern is not a path: `isUngatedReadPath` answers for real URLs like
 * /read/leaf-to-liquor/classic, and the parameterised route is how App.tsx
 * spells the same exception.
 */
function isNamedRouteException(routePath: string): boolean {
  return routePath === '/read/leaf-to-liquor/:template' || isUngatedReadPath(routePath);
}

type ParsedReadRoute = {
  routePath: string;
  /** True when the route's element is wrapped in <ArticleGate href="...">. */
  gated: boolean;
  /** The href ArticleGate was given, if it was used. */
  gateHref: string | null;
};

/**
 * Reads src/App.tsx as text and finds every <Route path="/read..."> element.
 *
 * The parse runs over the JOINED source, not line by line. The previous
 * version required `<Route` and `path=` on one line, which is how every route
 * in App.tsx happens to be formatted today and is not a rule anything
 * enforces: an ungated route written across four lines,
 *
 *     <Route
 *       path="/read/probe-multiline"
 *       element={...}
 *     />
 *
 * compiled, served its page to a visitor, and left all 34 tests green and tsc
 * clean. A test that only sees the formatting its author happened to use is a
 * test of the formatting.
 *
 * Each match runs from `<Route` to the `>` or `/>` that closes that opening
 * tag, with quoted strings skipped so a `>` inside an attribute value cannot
 * end it early, and with nesting counted through the braces of a JSX
 * expression attribute so `element={<A />}` does not close the tag at the `/>`
 * of its own child.
 *
 * This is deliberately a text parse, not a JSX/AST parse: App.tsx is 1000+
 * lines of an app shell with dozens of unrelated imports, and a real parse
 * would need to resolve or mock most of them. Reading the routing table as
 * text is exactly what a search-and-read human review of this file would do to
 * answer "is every /read route gated", so a text parse checks the same thing a
 * person would.
 */
function parseReadRoutesFromAppTsx(): ParsedReadRoute[] {
  return parseReadRoutesFromSource(fs.readFileSync(APP_TSX_PATH, 'utf8'));
}

/** The parse itself, over any source text, so it can be tested on a fixture. */
function parseReadRoutesFromSource(source: string): ParsedReadRoute[] {
  const routes: ParsedReadRoute[] = [];

  for (let i = 0; i < source.length; i++) {
    if (!source.startsWith('<Route', i)) continue;
    const tag = readOpeningTag(source, i);
    if (!tag) continue;
    const pathMatch = tag.text.match(/\bpath\s*=\s*"(\/read(?:\/[^"]*)?)"/);
    if (pathMatch) {
      const gateMatch = tag.text.match(/<ArticleGate\s+href="([^"]+)"/);
      routes.push({
        routePath: pathMatch[1],
        gated: !!gateMatch,
        gateHref: gateMatch ? gateMatch[1] : null,
      });
    }
    i = tag.end;
  }

  return routes;
}

/**
 * From the `<` of an opening tag, returns its full text and the index of its
 * closing `>`. Strings and JSX expression braces are tracked so neither a `>`
 * inside an attribute value nor the `/>` of a nested element ends the tag early.
 */
function readOpeningTag(source: string, start: number): { text: string; end: number } | null {
  let depth = 0;
  let quote: string | null = null;
  for (let i = start + 1; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '{') { depth++; continue; }
    if (ch === '}') { depth--; continue; }
    if (ch === '>' && depth === 0) return { text: source.slice(start, i + 1), end: i };
  }
  return null;
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
      if (isNamedRouteException(route.routePath)) {
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

  it('accounted for every /read route App.tsx defines: no unexpected exceptions', () => {
    const unaccountedFor = parsed.filter(
      (r) => !r.gated && !isNamedRouteException(r.routePath),
    );
    expect(unaccountedFor.map((r) => r.routePath)).toEqual([]);
  });

  it('sees a route whose path sits on a different line from its <Route', () => {
    // The reproduction, pinned so the parser cannot quietly go back to reading
    // one line at a time. Nothing else in this file would notice: the fixture
    // below is the exact shape that compiled, served a page and left the whole
    // suite green.
    const multiline = [
      '                <Route',
      '                  path="/read/probe-multiline"',
      '                  element={',
      '                    <ErrorBoundary><Suspense fallback={<EmblemLoader />}><ReadIndex /></Suspense></ErrorBoundary>',
      '                  }',
      '                />',
    ].join('\n');
    expect(parseReadRoutesFromSource(multiline).map((r) => r.routePath)).toEqual(['/read/probe-multiline']);
    expect(parseReadRoutesFromSource(multiline)[0].gated).toBe(false);
  });

  it('does not end a route at a > inside an attribute value or a nested element', () => {
    // Both traps a naive scan falls into: the `/>` of the Suspense fallback,
    // and a `>` inside a quoted string. Getting either wrong truncates the
    // block and reports a gated route as ungated, which is a false alarm rather
    // than a leak, but a test that cries wolf gets switched off.
    const gated = [
      '<Route path="/read/history" element={',
      '  <ArticleGate href="/read/history">',
      '    <ErrorBoundary><Suspense fallback={<EmblemLoader label="a > b" />}><History /></Suspense></ErrorBoundary>',
      '  </ArticleGate>',
      '} />',
    ].join('\n');
    const parsed = parseReadRoutesFromSource(gated);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].gated).toBe(true);
    expect(parsed[0].gateHref).toBe('/read/history');
  });
});

describe('the "More from The Art of Tea" rail names only what a visitor can open', () => {
  // The blocker two rounds of this fix walked past. Every article page carries
  // its own hand-curated moreLinks array, written before ten of the fourteen
  // pieces were held back, and nothing filtered them: /read/porcelain-and-tea
  // offered Earth Water Fire, The Pot That Remembers and The Rock Remembers by
  // title and blurb, and /read/atlas and /read/tasting both offered Ten
  // Thousand Mornings. Each was also a dead link: clicking one landed the
  // reader on the not-found page the route gate had just started serving.
  const READ_DIR = path.resolve(__dirname);

  /** Every moreLinks array in the section, read out of the page sources. */
  function moreLinkArrays(): { file: string; links: MoreLink[] }[] {
    return fs
      .readdirSync(READ_DIR)
      .filter((f) => f.endsWith('.tsx'))
      .map((file) => {
        const source = fs.readFileSync(path.join(READ_DIR, file), 'utf8');
        const block = source.match(/const moreLinks[^=]*=\s*\[([\s\S]*?)\n\];/);
        if (!block) return null;
        const links = [...block[1].matchAll(/\{\s*to:\s*'([^']+)'[^}]*?title:\s*'([^']*)'/g)].map(
          ([, to, title]) => ({ to, kicker: '', title, blurb: '' }),
        );
        return { file, links };
      })
      .filter((x): x is { file: string; links: MoreLink[] } => x !== null);
  }

  it('found the rail on every article page, so the checks below are not vacuous', () => {
    const arrays = moreLinkArrays();
    expect(arrays.length).toBeGreaterThanOrEqual(14);
    for (const { file, links } of arrays) {
      expect(links.length, `${file} has a moreLinks array this test could not read`).toBeGreaterThan(0);
    }
  });

  it('leaves a visitor only links that are public: no draft named, no dead link offered', () => {
    for (const { file, links } of moreLinkArrays()) {
      for (const link of visibleMoreLinks(links, false)) {
        expect(
          isReadPathPublic(link.to),
          `${file} still offers a visitor ${link.to}, which is not public`,
        ).toBe(true);
      }
    }
  });

  it('drops exactly the drafts, and keeps every live companion', () => {
    // The pre-fix reading of /read/atlas's own rail, pinned. If a piece is
    // published later the expectation moves on purpose, and the test says so
    // rather than passing silently.
    const links: MoreLink[] = [
      { to: '/read/ritual', kicker: '', title: 'Seven Steeps', blurb: '' },
      { to: '/read/history', kicker: '', title: 'Ten Thousand Mornings', blurb: '' },
      { to: '/read/leaf-to-liquor', kicker: '', title: 'From Leaf to Liquor', blurb: '' },
    ];
    expect(visibleMoreLinks(links, false).map((l) => l.to)).toEqual([
      '/read/ritual',
      '/read/leaf-to-liquor',
    ]);
  });

  it('keeps the leaf-to-liquor flagship, which sits outside the curated map', () => {
    // A filter written against ARTICLE_LIVE alone would drop this: the map has
    // never carried an entry for it, and unlisted reads as draft everywhere
    // else on purpose. It is the exception isUngatedReadPath exists to name.
    expect(ARTICLE_LIVE['/read/leaf-to-liquor']).toBeUndefined();
    expect(isUngatedReadPath('/read/leaf-to-liquor')).toBe(true);
    expect(isArticleVisible('/read/leaf-to-liquor', false)).toBe(true);
  });

  it('shows the owner the whole curated rail, drafts included', () => {
    const links: MoreLink[] = [
      { to: '/read/history', kicker: '', title: 'Ten Thousand Mornings', blurb: '' },
      { to: '/read/rock-remembers', kicker: '', title: 'The Rock Remembers', blurb: '' },
    ];
    expect(visibleMoreLinks(links, true)).toHaveLength(2);
  });

  it('leaves no rail at all when every companion is a draft', () => {
    // /read/porcelain-and-tea's own three cards. MoreFooter renders nothing
    // rather than a heading over an empty grid.
    const links: MoreLink[] = [
      { to: '/read/earth-water-fire', kicker: '', title: 'Earth, Water, Fire', blurb: '' },
      { to: '/read/craft', kicker: '', title: 'The Pot That Remembers', blurb: '' },
      { to: '/read/rock-remembers', kicker: '', title: 'The Rock Remembers', blurb: '' },
    ];
    expect(visibleMoreLinks(links, false)).toEqual([]);
  });
});
