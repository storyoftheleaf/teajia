/**
 * The Advise landing, checked the way CraftIndex.test.tsx checked Craft:
 * render the real component through the real gate, read the markup a
 * visitor or the owner actually receives.
 *
 * Storage is stubbed rather than mocked out, same as
 * src/pages/read/readOwner.test.tsx and src/pages/craft/CraftIndex.test.tsx:
 * `useIsReadOwner` reads the stored JWT's claims, and stubbing the two
 * Storage globals with a plain map lets the real hook run unchanged.
 *
 * Run with: npx vitest run src/pages/advise/AdviseIndex.test.tsx
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import AdviseIndex, { ADVISE_ROW_KEYS } from './AdviseIndex';
import { ADVISE_STATE } from './adviseLive';
import { adviseTestimonials } from '../../data/adviseTestimonials';

// InquiryForm reaches for `window.matchMedia` synchronously in its render
// body (useReducedMotion), which `renderToStaticMarkup` cannot supply: there
// is no window in this test's Node environment. AdviseIndex mounts it once,
// always, whether or not the dialog is open, so every render of the page
// trips it. Stubbed to a null component here, the same way a page under
// test stubs any hook that assumes a live DOM; the inquiry form itself is
// exercised end to end by tests/inquiry-delivery.spec.ts.
vi.mock('../../components/advise/InquiryForm', () => ({ InquiryForm: () => null }));

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
        <AdviseIndex />
      </MemoryRouter>
    </HelmetProvider>,
  );
}

// renderToStaticMarkup HTML-escapes text nodes, so a title carrying a plain
// "&" (three of ours do) lands in the markup as "&amp;". Titles are typed
// here the way Adrian reads them; this is where that gets translated.
function htmlText(s: string): string {
  return s.replace(/&/g, '&amp;');
}

// The page's own injected stylesheet (the CSS that draws the verb text via
// `content: attr(data-act)` and overrides it to "coming soon" for a soon
// row) necessarily carries that phrase once, in its source. A visitor never
// reads a stylesheet; what they see or hear is the row's own aria-label.
// Stripped here so the count below asks the question the row rendering
// actually answers, not "how many times does the word appear in the file".
function withoutInjectedStyle(html: string): string {
  return html.replace(/<style>[\s\S]*?<\/style>/, '');
}

const SERVICE_TITLES = ['Tea House Design & Curation', 'Tea Curation & Sourcing', 'Sessions & Guidance'];

const LEDGER_TITLES = [
  'For Your Space', 'Selected Projects',
  'For a Collection', 'For a Space', 'Sourcing Journeys',
  'Open Sit', 'Guided Practice Setup', 'Group Ceremonial', 'Private & Events', 'Upcoming Sessions',
];

describe('AdviseIndex, visitor', () => {
  const html = (() => { signOut(); return render(); })();

  it('shows the three service titles', () => {
    for (const title of SERVICE_TITLES) {
      expect(html, `expected to find "${title}"`).toContain(htmlText(title));
    }
  });

  it('shows all ten ledger titles', () => {
    for (const title of LEDGER_TITLES) {
      expect(html, `expected to find "${title}"`).toContain(htmlText(title));
    }
  });

  it('says "coming soon" exactly three times, once per soon row', () => {
    const visible = withoutInjectedStyle(html);
    expect(visible.split('coming soon').length - 1).toBe(3);
  });

  it('never links the owner-only soon destinations', () => {
    expect(html).not.toContain('href="/advise?v=projects"');
    expect(html).not.toContain('href="/events"');
  });

  it('links "For Your Space" to /for-your-space', () => {
    expect(html).toContain('href="/for-your-space"');
  });

  it('carries the fixed accessible name for the lead cover', () => {
    expect(html).toContain('aria-label="Start a conversation"');
  });

  it('shows the closing quote', () => {
    expect(html).toContain(adviseTestimonials[0].quote);
  });

  it('never shows a price', () => {
    expect(html.includes('$')).toBe(false);
  });
});

describe('AdviseIndex, the owner', () => {
  const html = (() => { signInAsOwner(); return render(); })();

  it('reaches both owner-only soon destinations', () => {
    expect(html).toContain('href="/advise?v=projects"');
    expect(html).toContain('href="/events"');
  });

  signOut();
});

describe('AdviseIndex, the state map names exactly the rows the ledger carries', () => {
  it('has no orphan key and no unlisted row', () => {
    for (const key of Object.keys(ADVISE_STATE)) {
      expect(ADVISE_ROW_KEYS.includes(key), `adviseLive.ts lists "${key}", which no row in the ledger carries`).toBe(true);
    }
    for (const key of ADVISE_ROW_KEYS) {
      expect(key in ADVISE_STATE, `row "${key}" carries no entry in adviseLive.ts, so it can never go live`).toBe(true);
    }
  });
});

describe('AdviseIndex, copy discipline', () => {
  it('uses no em dash anywhere in the markup', () => {
    signInAsOwner();
    const html = render();
    signOut();
    // U+2014, built with fromCharCode rather than typed so this file's own
    // source does not itself trip a project-wide em-dash scan.
    const emDash = String.fromCharCode(0x2014);
    expect(html.includes(emDash), 'AdviseIndex rendered an em dash').toBe(false);
  });
});
