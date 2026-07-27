import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * No hook below an early return, on any shop surface.
 *
 * React identifies a hook by the order it is called in. A component that calls
 * `useState` after `if (!item) return` calls one fewer hook on the render where
 * the item is missing than on the render where it arrives, and the second of
 * those two renders throws "Rendered more hooks than during the previous
 * render" and takes the route down with it.
 *
 * That was live on the product page. `useProductTasting`, `useAuth`, a
 * `useState` and a `useMemo` all sat below the "Not found" return, and the
 * product page resolves to no item on the first paint of every cold load,
 * because `inventory` is still in flight. Every direct visit to
 * /shop/product/:id was one render away from a white screen. It never fired in
 * development, where the inventory is usually already warm in the query cache.
 *
 * A render test would not have caught it either, because it only shows up on
 * the *second* render. What catches it is reading the source, which is what
 * this does. There is no jsdom in this project, so this is also the only kind
 * of component test available here.
 *
 * The scan is deliberately structural rather than specific to one file: any
 * shop component that grows a guard clause is covered the moment it is added
 * to the list below.
 */

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

/** Comments and string bodies, removed, so prose about hooks is not read as a hook. */
function stripNoise(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, m => m.replace(/[^\n]/g, ' '))
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""');
}

/** Top-level `const X = …` / `function X(…)` declarations, and the text of each. */
function topLevelBlocks(text: string): Array<{ name: string; body: string }> {
  const header = /^(?:export\s+)?(?:const|function)\s+([A-Za-z_$][\w$]*)/gm;
  const starts: Array<{ name: string; index: number }> = [];
  for (const match of text.matchAll(header)) {
    starts.push({ name: match[1], index: match.index! });
  }
  return starts.map((start, i) => ({
    name: start.name,
    body: text.slice(start.index, starts[i + 1]?.index ?? text.length),
  }));
}

/**
 * A guard clause at the component's own indentation: `  if (…) {` or
 * `  if (…) return`. Two spaces, so a guard nested inside a callback or a
 * `useMemo` (which is not an early return from the component) is not counted.
 */
const GUARD = /^ {2}if \([^\n]*?\)\s*(?:\{|return)/m;

/** A hook call: `useThing(`, not preceded by a dot, so `x.useThing(` is not one. */
const HOOK_CALL = /(?:^|[^\w.$])(use[A-Z]\w*)\s*\(/;

const SURFACES = [
  '../../pages/ProductPage.tsx',
  './AlcoveCard.tsx',
  './AlcoveModal.tsx',
  './TeawareAlcoveCard.tsx',
  './TeawareAlcoveModal.tsx',
  './ProductReviews.tsx',
  './CompareView.tsx',
  './CollectionTab.tsx',
  './alcove/AlcoveCarouselShell.tsx',
  './alcove/AlcoveModals.tsx',
  './alcove/AlcoveSensoryGrid.tsx',
  './alcove/AlcoveCommerceFooter.tsx',
  '../tasting/TastingProfileStrip.tsx',
  '../tasting/ProductTastingEditorial.tsx',
  '../shared/PublicCart.tsx',
  '../shared/CartItem.tsx',
  '../shared/PopupModal.tsx',
];

describe('shop surfaces call every hook before they can return early', () => {
  it.each(SURFACES)('%s', (path) => {
    const text = stripNoise(source(path));
    const offenders: string[] = [];

    for (const block of topLevelBlocks(text)) {
      const guard = block.body.match(GUARD);
      if (!guard) continue;
      const afterGuard = block.body.slice(guard.index! + guard[0].length);
      const hook = afterGuard.match(HOOK_CALL);
      if (hook) offenders.push(`${block.name}: ${hook[1]} is called below \`${guard[0].trim()}\``);
    }

    expect(offenders).toEqual([]);
  });
});

describe('the product page regression this test was written for', () => {
  const text = stripNoise(source('../../pages/ProductPage.tsx'));
  const component = text.slice(text.indexOf('export const ProductPage'));
  const notFoundReturn = component.search(GUARD);

  it('has a guard clause to be wrong about', () => {
    expect(notFoundReturn).toBeGreaterThan(-1);
  });

  // `useQuery` was on this list until the impressions query moved into
  // `useProductImpressions`, which both this page and the quick view now read.
  // The hook being pinned is the one the page actually calls: pinning the
  // library call would have started failing the day the query was shared, which
  // is a refactor the rule has no opinion about.
  it.each(['useProductTasting', 'useAuth', 'useState', 'useMemo', 'useProductImpressions', 'useShopPrice'])(
    'calls %s above it',
    (hook) => {
      // A hook may carry a type argument (`useFocusTrap<HTMLDivElement>(…)`), so
      // the call parenthesis is not always the next character after the name.
      const first = component.search(new RegExp(`\\b${hook}\\s*(?:<[^>(]*>)?\\s*\\(`));
      expect(first).toBeGreaterThan(-1);
      expect(first).toBeLessThan(notFoundReturn);
    },
  );
});
