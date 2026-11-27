import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Section } from '../types';

// The new bar (HOME_BAR_OPEN) is a switch; each test sets it.
const flags = vi.hoisted(() => ({ bar: false, table: false, houses: false }));
vi.mock('../lib/homeBar', () => ({ homeBarOpen: () => flags.bar, HOME_BAR_OPEN: false }));
vi.mock('../lib/teaTable', () => ({ teaTableOpen: () => flags.table }));
vi.mock('../lib/teaHouses', () => ({ teaHousesOpen: () => flags.houses }));

const storeState = { activeAccount: null, upcomingEventsCount: 0, sidebarRoom: 'browse', setSidebarRoom: () => {}, sidebarCollapsed: false, toggleSidebarCollapsed: () => {} };
vi.mock('../lib/store', () => ({
  useAppStore: (select?: (state: typeof storeState) => unknown) => (select ? select(storeState) : storeState),
  selectHasBundle: () => false,
  selectIsOwnerTier: () => false,
}));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ isAdmin: false, isAuthenticated: false, user: null }) }));
vi.mock('../lib/useSiteIncidents', () => ({ useSiteProblemCount: () => 0 }));
vi.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: 'light' }) }));
vi.mock('../samples/sampleCartStore', () => ({ useSampleCartStore: (select: (s: { items: unknown[] }) => unknown) => select({ items: [] }) }));
vi.mock('./manageNav', () => ({
  useManageNav: () => ({ items: [], today: null, canCreateCollections: false, hasManageRoom: false }),
  isManagePathActive: () => false,
}));

import { BottomTabBar } from './BottomTabBar';
import { LeftSidebar } from './LeftSidebar';
import { SiteMenu } from './SiteMenu';
import { BAR_WORDS, barSectionActive, barSections, sectionKeyPaths } from './navSections';

function bar(path = '/', section: Section = 'HOME') {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <BottomTabBar activeSection={section} onNavigate={() => {}} />
    </MemoryRouter>,
  );
}

function rail(path = '/', section: Section = 'HOME') {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <LeftSidebar activeSection={section} onNavigate={() => {}} />
    </MemoryRouter>,
  );
}

/** The four words on the bar, in order: the labels of the section buttons, between the menu and Your Table. */
function barWords(html: string): string[] {
  return [...html.matchAll(/<span class="bottom-nav-label[^"]*"[^>]*>([^<]+)<\/span>/g)].map(m => m[1]);
}

/** The four words on the rail, in order. */
function railWords(html: string): string[] {
  const browse = html.slice(html.indexOf('aria-label="Browse"'), html.indexOf('</nav>', html.indexOf('aria-label="Browse"')));
  return [...browse.matchAll(/class="nav-rail-word[^"]*"[^>]*>([^<]+)</g)].map(m => m[1]);
}

/** The words lit on the bar. */
function litBar(html: string): string[] {
  return [...html.matchAll(/aria-current="page" aria-label="([^"]+)"/g)].map(m => m[1]);
}

beforeEach(() => {
  flags.bar = false;
  flags.table = false;
  flags.houses = false;
});

describe('with the new bar off, today less Craft', () => {
  it('the phone bar carries read, advise, shop, in that order, and no Craft', () => {
    const html = bar();
    expect(barWords(html)).toEqual(['read', 'advise', 'shop']);
    expect(html).not.toContain('data-bar-words');
    expect(html).toContain('aria-label="Read"');
    expect(html).not.toContain('aria-label="Craft"');
    expect(html).toContain('aria-label="Advise"');
    expect(html).toContain('aria-label="Shop"');
  });

  it('the rail carries Read, Advise, Shop, and People and Places in its foot', () => {
    const html = rail();
    expect(railWords(html)).toEqual(['Read', 'Advise', 'Shop']);
    expect(html).not.toContain('href="/craft"');
    expect(html).toContain('href="/read"');
    expect(html).toContain('href="/people"');
    expect(html).toContain('href="/spaces"');
  });

  it('lights the same words for the same places as before', () => {
    expect(litBar(bar('/read', 'MAGAZINE'))).toEqual(['Read']);
    expect(litBar(bar('/advise', 'OFFERINGS'))).toEqual(['Advise']);
    expect(litBar(bar('/shop', 'SHOP'))).toEqual(['Shop']);
    expect(litBar(bar('/events', 'EVENTS'))).toEqual([]);
  });

  it('the phone menu lists sessions, people, places and Tea Wisdom', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter><SiteMenu isOpen onClose={() => {}} onSearchClick={() => {}} onCartClick={() => {}} /></MemoryRouter>,
    );
    for (const href of ['/events', '/people', '/spaces', '/wisdom', '/about']) expect(html).toContain(`href="${href}"`);
    expect(html).not.toContain('Work with Adrian');
  });

  it('the definition is today, with Craft gone', () => {
    expect(barSections(false).map(s => [s.label, s.section, s.path ?? null])).toEqual([
      ['Read', 'MAGAZINE', '/read'],
      ['Advise', 'OFFERINGS', null],
      ['Shop', 'SHOP', null],
    ]);
  });
});

describe('with the new bar on', () => {
  beforeEach(() => { flags.bar = true; });

  it('the phone bar and the rail carry the same four words, from one place', () => {
    const words = [BAR_WORDS.read, BAR_WORDS.table, BAR_WORDS.houses, BAR_WORDS.shop];
    expect(barWords(bar())).toEqual(words.map(w => w.toLowerCase()));
    expect(railWords(rail())).toEqual(words);
    expect(words).toEqual(['Read', 'Tea table', 'Tea spaces', 'Shop']);
  });

  it('marks the bar so its words go one size smaller under 340px', () => {
    expect(bar()).toContain('data-bar-words="launch-4"');
  });

  it('every word leads to a page that exists, with or without the Tea Table and the portfolio', () => {
    const html = rail();
    expect(html).toContain('href="/read"');
    expect(html).toContain('href="/events"');
    expect(html).toContain('href="/advise"');
    flags.table = true;
    flags.houses = true;
    const open = rail();
    expect(open).toContain('href="/tea-table"');
    expect(open).toContain('href="/tea-houses"');
  });

  it('read lights on all three shelves; table on sessions and people; house on houses and the consult', () => {
    for (const path of ['/read', '/wisdom', '/wisdom/cultivars', '/wisdom/glossary', '/article/x']) expect(litBar(bar(path, 'MAGAZINE'))).toEqual(['Read']);
    for (const path of ['/tea-table', '/events', '/event/a', '/people/bo']) expect(litBar(bar(path, 'EVENTS'))).toEqual(['Tea table']);
    for (const path of ['/tea-houses/visit', '/store/a', '/advise']) expect(litBar(bar(path, 'OFFERINGS'))).toEqual(['Tea spaces']);
    expect(litBar(bar('/shop', 'SHOP'))).toEqual(['Shop']);
  });

  it('the rail foot is the three glyphs: People and Places live under the words', () => {
    const html = rail();
    expect(html).not.toContain('href="/people"');
    expect(html).not.toContain('href="/spaces"');
  });

  it('the phone menu shrinks to search, cart, about and working with Adrian', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter><SiteMenu isOpen onClose={() => {}} onSearchClick={() => {}} onCartClick={() => {}} /></MemoryRouter>,
    );
    expect(html).toContain('href="/advise"');
    expect(html).toContain('Work with Adrian');
    expect(html).toContain('href="/about"');
    for (const href of ['/events', '/people', '/spaces', '/wisdom']) expect(html).not.toContain(`href="${href}"`);
  });

  it('keys 1 to 5 follow the words', () => {
    expect(sectionKeyPaths()).toEqual(['/', '/read', '/events', '/advise', '/shop']);
    flags.table = true;
    flags.houses = true;
    expect(sectionKeyPaths()).toEqual(['/', '/read', '/tea-table', '/tea-houses', '/shop']);
  });

  it('a word never lights for a different word', () => {
    const [read, table, houses] = barSections(true);
    expect(barSectionActive(read, '/readers', 'HOME')).toBe(false);
    expect(barSectionActive(table, '/events-old', 'HOME')).toBe(false);
    expect(barSectionActive(houses, '/storefront', 'HOME')).toBe(false);
  });
});
