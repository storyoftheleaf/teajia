/**
 * Read's Lessons shelf (once the Craft landing), checked the way LearnOverview.test.tsx and the Read
 * section's own tests checked their pages: render the real component through
 * the real gate, read the markup a visitor or the owner actually receives.
 *
 * Storage is stubbed rather than mocked out, same as
 * src/pages/read/readOwner.test.tsx: `useIsReadOwner` reads the stored JWT's
 * claims, and stubbing the two Storage globals with a plain map lets the real
 * hook run unchanged.
 *
 * Run with: npx vitest run src/pages/lessons/LessonsIndex.test.tsx
 */
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import LessonsIndex, { LESSON_ROW_KEYS } from './LessonsIndex';
import { LESSON_STATE } from './lessonsLive';

// Layout-only fixtures model the verified hook. Real JWT/session decisions
// are covered by readOwner/readEditorState and Worker delivery tests.
const verified = vi.hoisted(() => ({ editor: false }));
vi.mock('../read/publishGate', async importOriginal => ({
  ...await importOriginal<typeof import('../read/publishGate')>(),
  useIsReadOwner: () => verified.editor,
}));

const store = vi.hoisted(() => {
  const map = new Map<string, string>();
  const storage = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  };
  (globalThis as Record<string, unknown>).localStorage = storage;
  (globalThis as Record<string, unknown>).sessionStorage = storage;
  return map;
});

const TEAJIA_OWNER = { sub: 'u', memberships: [{ account_id: 'acc_teajia_bali', account_kind: 'platform', role: 'owner' }] };

function signInAsOwner() {
  verified.editor = true;
  const body = Buffer.from(JSON.stringify(TEAJIA_OWNER), 'utf8').toString('base64url');
  store.set('teajia_token', `header.${body}.signature`);
}
function signOut() {
  verified.editor = false;
  store.delete('teajia_token');
}

function render(): string {
  return renderToStaticMarkup(
    <HelmetProvider>
      <MemoryRouter>
        <LessonsIndex />
      </MemoryRouter>
    </HelmetProvider>,
  );
}

// Adrian's rule, 2026-09-22: a visitor gets three tiers. LIVE_TITLES are real
// pieces, real links. SOON_TITLES are a photograph and a title with no way
// in. DRAFT_TITLES are the owner's own workshop, invisible to a visitor.
// When a row's state changes in lessonsLive.ts, move its title between these
// lists here, on purpose. Craft's essays now sit only on Stories, and the
// reference and glossary only on Wisdom, so none of them shows here.
const LIVE_TITLES = ['Discover Your Tea'];
const SOON_TITLES = ['Six Foundations', 'Brewing by Tea Type', 'Three Journeys', 'Reading and Listening'];
const DRAFT_TITLES: string[] = [];
const MOVED_TITLES = ['Seven Steeps', 'Porcelain and Tea', 'The Vocabulary of Taste', 'The Tea Reference', 'The Glossary', 'Water Before Leaf', 'The Pot That Remembers', 'Playlists', 'Six Tea Spaces', 'Shared Wisdom'];

const LIVE_HREFS = ['/discover'];
const SOON_HREFS = ['/read/lessons?v=course', '/read/lessons?v=journeys', '/read/lessons?v=reading'];

describe('LessonsIndex, visitor', () => {
  const html = (() => { signOut(); return render(); })();

  it('shows the live lesson, as a link', () => {
    for (const title of LIVE_TITLES) {
      expect(html, `expected to find "${title}"`).toContain(title);
    }
    for (const href of LIVE_HREFS) {
      expect(html, `expected a link to "${href}"`).toContain(`href="${href}"`);
    }
  });

  it('shows the coming-soon lessons, but links none of them', () => {
    for (const title of SOON_TITLES) {
      expect(html, `expected to find "${title}"`).toContain(title);
    }
    for (const href of SOON_HREFS) {
      expect(html, `did not expect a link to "${href}" for a visitor`).not.toContain(`href="${href}"`);
    }
  });

  it('never shows the owner draft titles', () => {
    for (const title of DRAFT_TITLES) {
      expect(html, `did not expect to find "${title}"`).not.toContain(title);
    }
  });

  it('carries nothing that moved to Stories, Wisdom, Tea house or Tea table', () => {
    for (const title of MOVED_TITLES) expect(html, `did not expect "${title}"`).not.toContain(title);
  });

  it('keeps the piece count, coming labels, and publish visibility', () => {
    expect(html).toContain('one piece');
    expect(html).toContain('four coming');
    expect(html).toContain('coming soon');
    expect(html).not.toContain('N°');
    expect(html).toContain('class="tj-craft-row"');
  });

  it('renders the two Coming soon panels', () => {
    expect(html).toContain('Brewing by Tea Type, coming soon');
    expect(html).toContain('Three Journeys');
  });
});

describe('LessonsIndex, the owner', () => {
  const html = (() => { signInAsOwner(); return render(); })();

  it('sees every row: live and soon', () => {
    for (const title of [...LIVE_TITLES, ...SOON_TITLES, ...DRAFT_TITLES]) {
      expect(html, `expected to find "${title}"`).toContain(title);
    }
  });

  it('can reach a soon row that carries an href', () => {
    for (const href of SOON_HREFS) {
      expect(html, `expected the owner to have a link to "${href}"`).toContain(`href="${href}"`);
    }
  });

  it('tags no drafts, since none of the lessons is one', () => {
    expect(html.split('>Draft<').length - 1).toBe(DRAFT_TITLES.length);
  });

  signOut();
});

describe('LessonsIndex, the state map names exactly the rows the index carries', () => {
  it('has no orphan key and no unlisted row', () => {
    for (const key of Object.keys(LESSON_STATE)) {
      expect(LESSON_ROW_KEYS.includes(key), `lessonsLive.ts lists "${key}", which no row in the index carries`).toBe(true);
    }
    for (const key of LESSON_ROW_KEYS) {
      expect(key in LESSON_STATE, `row "${key}" carries no entry in lessonsLive.ts, so it can never go live`).toBe(true);
    }
  });
});

describe('LessonsIndex, copy discipline', () => {
  it('uses no em dash in any row title or dek', () => {
    signInAsOwner();
    const html = render();
    signOut();
    // U+2014, built with fromCharCode rather than typed so this file's own
    // source does not itself trip a project-wide em-dash scan.
    const emDash = String.fromCharCode(0x2014);
    expect(html.includes(emDash), 'LessonsIndex rendered an em dash').toBe(false);
  });
});

describe('LessonsIndex, every href resolves somewhere real', () => {
  const APP_TSX = fs.readFileSync(path.resolve(__dirname, '../../App.tsx'), 'utf8');
  const LEARN_HUB = fs.readFileSync(path.resolve(__dirname, './LessonsHub.tsx'), 'utf8');

  /** Every static <Route path="..."> in App.tsx, read rather than typed. */
  function appRoutePaths(): Set<string> {
    const paths = new Set<string>();
    for (const m of APP_TSX.matchAll(/<Route\s+path="([^"]+)"/g)) paths.add(m[1]);
    return paths;
  }

  /** Every ?v= value LessonsHub's sub-view switch actually renders. */
  function knownSubViews(): Set<string> {
    const views = new Set<string>();
    const switchBlock = LEARN_HUB.match(/renderSubView = \(\) => \{[\s\S]*?\n  \};/);
    const source = switchBlock ? switchBlock[0] : LEARN_HUB;
    for (const m of source.matchAll(/case '([a-z-]+)':/g)) views.add(m[1]);
    return views;
  }

  /**
   * Every relative href on an actual link in the rendered markup, owner
   * render so every reachable row counts too. Matched on `<a href>`
   * specifically: React 19 auto-emits `<link rel="preload" as="image"
   * href="...">` resource hints for the page's `<img>` tags (the cover and
   * "coming soon" photographs), and those are not navigable routes.
   */
  function renderedHrefs(): string[] {
    signInAsOwner();
    const html = render();
    signOut();
    const hrefs = [...html.matchAll(/<a\s[^>]*href="(\/[^"]*)"/g)].map((m) => m[1]);
    return [...new Set(hrefs)];
  }

  it('found real routes to check against, so the assertions below are not vacuous', () => {
    expect(appRoutePaths().size).toBeGreaterThan(20);
    expect(knownSubViews().size).toBeGreaterThan(0);
  });

  it.each(renderedHrefs())('%s resolves to an App.tsx route or a known ?v= sub-view', (href) => {
    const [pathname, query] = href.split('?');
    if (!query) {
      expect(appRoutePaths().has(pathname), `${pathname} is not a route in App.tsx`).toBe(true);
      return;
    }
    expect(appRoutePaths().has(pathname), `${pathname} is not a route in App.tsx`).toBe(true);
    const view = new URLSearchParams(query).get('v');
    expect(view, `${href} carries no ?v=`).not.toBeNull();
    expect(knownSubViews().has(view as string), `${href}'s view "${view}" is not handled by LessonsHub`).toBe(true);
  });
});
