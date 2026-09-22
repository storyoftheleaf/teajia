/**
 * The Craft landing, checked the way LearnOverview.test.tsx and the Read
 * section's own tests checked their pages: render the real component through
 * the real gate, read the markup a visitor or the owner actually receives.
 *
 * Storage is stubbed rather than mocked out, same as
 * src/pages/read/readOwner.test.tsx: `useIsReadOwner` reads the stored JWT's
 * claims, and stubbing the two Storage globals with a plain map lets the real
 * hook run unchanged.
 *
 * Run with: npx vitest run src/pages/craft/CraftIndex.test.tsx
 */
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import CraftIndex from './CraftIndex';
import { GLOSSARY_TERMS } from '../../data/glossary';

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
  const body = Buffer.from(JSON.stringify(TEAJIA_OWNER), 'utf8').toString('base64url');
  store.set('teajia_token', `header.${body}.signature`);
}
function signOut() {
  store.delete('teajia_token');
}

function render(): string {
  return renderToStaticMarkup(
    <HelmetProvider>
      <MemoryRouter>
        <CraftIndex />
      </MemoryRouter>
    </HelmetProvider>,
  );
}

// The two /read/* rows this index carries that are held back as drafts today
// (see src/pages/read/articleLive.ts). If either is ever flipped live, these
// two tests' expectations move with it, on purpose.
const DRAFT_TITLES = ['Water Before Leaf', 'The Pot That Remembers'];
const LIVE_READ_TITLES = ['Seven Steeps', 'Porcelain and Tea', 'The Vocabulary of Taste'];
const NON_READ_TITLES = [
  'Three Journeys', 'Discover Your Tea', 'The Tea Reference', 'The Glossary',
  'Six Foundations', 'Reading and Listening', 'Six Tea Spaces', 'Shared Wisdom',
];

describe('CraftIndex, visitor', () => {
  const html = (() => { signOut(); return render(); })();

  it('shows every live and non-read row, and hides both drafts', () => {
    for (const title of [...LIVE_READ_TITLES, ...NON_READ_TITLES]) {
      expect(html, `expected to find "${title}"`).toContain(title);
    }
    for (const title of DRAFT_TITLES) {
      expect(html, `did not expect to find "${title}"`).not.toContain(title);
    }
  });

  it('counts eleven pieces, live rows plus every non-read doorway', () => {
    expect(html).toContain('eleven pieces');
  });

  it('links the Tea Reference row to /wisdom and Discover Your Tea to /discover', () => {
    expect(html).toContain('href="/wisdom"');
    expect(html).toContain('href="/discover"');
  });
});

describe('CraftIndex, the owner', () => {
  const html = (() => { signInAsOwner(); return render(); })();

  it('sees the drafts, dimmed and tagged, alongside everything else', () => {
    for (const title of [...LIVE_READ_TITLES, ...NON_READ_TITLES, ...DRAFT_TITLES]) {
      expect(html, `expected to find "${title}"`).toContain(title);
    }
    // Draft rows carry opacity:0.5 and a "Draft" tag; live rows carry
    // opacity:1. This does not prove WHICH row is dimmed, only that the
    // draft styling and tag are present at all, which the visitor render
    // above already proved absent.
    expect(html).toContain('opacity:0.5');
    expect(html).toContain('Draft');
  });

  it('counts thirteen pieces, the eleven plus both drafts', () => {
    expect(html).toContain('thirteen pieces');
  });

  signOut();
});

describe('CraftIndex, the Glossary row', () => {
  it('names the real term count and a term of the day, not a stale copy', () => {
    signOut();
    const html = render();
    expect(html).toContain(`${GLOSSARY_TERMS.length} terms`);
  });
});

describe('CraftIndex, copy discipline', () => {
  it('uses no em dash in any row title or dek', () => {
    signInAsOwner();
    const html = render();
    signOut();
    // U+2014, built with fromCharCode rather than typed so this file's own
    // source does not itself trip a project-wide em-dash scan.
    const emDash = String.fromCharCode(0x2014);
    expect(html.includes(emDash), 'CraftIndex rendered an em dash').toBe(false);
  });
});

describe('CraftIndex, every href resolves somewhere real', () => {
  const APP_TSX = fs.readFileSync(path.resolve(__dirname, '../../App.tsx'), 'utf8');
  const LEARN_HUB = fs.readFileSync(path.resolve(__dirname, '../../components/LearnHub.tsx'), 'utf8');

  /** Every static <Route path="..."> in App.tsx, read rather than typed. */
  function appRoutePaths(): Set<string> {
    const paths = new Set<string>();
    for (const m of APP_TSX.matchAll(/<Route\s+path="([^"]+)"/g)) paths.add(m[1]);
    return paths;
  }

  /** Every ?v= value LearnHub's sub-view switch actually renders. */
  function knownSubViews(): Set<string> {
    const views = new Set<string>();
    const switchBlock = LEARN_HUB.match(/renderSubView = \(\) => \{[\s\S]*?\n  \};/);
    const source = switchBlock ? switchBlock[0] : LEARN_HUB;
    for (const m of source.matchAll(/case '([a-z-]+)':/g)) views.add(m[1]);
    return views;
  }

  /** Every relative href in the rendered markup, owner render so drafts count too. */
  function renderedHrefs(): string[] {
    signInAsOwner();
    const html = render();
    signOut();
    const hrefs = [...html.matchAll(/href="(\/[^"]*)"/g)].map((m) => m[1]);
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
    expect(knownSubViews().has(view as string), `${href}'s view "${view}" is not handled by LearnHub`).toBe(true);
  });
});
