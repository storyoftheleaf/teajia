import type { Section } from '../types';
import { homeBarOpen } from '../lib/homeBar';
import { teaTableOpen } from '../lib/teaTable';
import { teaHousesOpen } from '../lib/teaHouses';

/**
 * The site's four sections, read by the phone bar (BottomTabBar), the desktop
 * rail (LeftSidebar), keys 1 to 5 (useSectionKeys) and Home. The rail and the
 * bar both draw from here, so they cannot fall out of step. Manage's rooms are
 * not here: they come from manageNav.ts only.
 *
 * Behind HOME_BAR_OPEN (src/lib/homeBar.ts). Off, they are today's three: read,
 * advise, shop (Craft was removed, Adrian 2026-11-27). On, they are the four
 * words below.
 */

/** The four words with the new bar on. Change a word here, on this one line, and the bar, the rail and Home follow. */
export const BAR_WORDS = { read: 'Read', table: 'Tea table', houses: 'Tea house', shop: 'Shop' } as const;

/**
 * Read's three shelves, the row at the top of /read, /read/lessons and /wisdom
 * with the new bar on: Stories (the magazine), Lessons (what Craft became) and
 * Wisdom (Adrian, 2026-11-27, "Read: Stories, Lessons, Wisdom").
 */
export const READ_SHELVES = [
  { id: 'stories', label: 'Stories', path: '/read' },
  { id: 'lessons', label: 'Lessons', path: '/read/lessons' },
  { id: 'wisdom', label: 'Wisdom', path: '/wisdom' },
] as const;
export type ReadShelfId = (typeof READ_SHELVES)[number]['id'];

export type BarSectionId = 'read' | 'advise' | 'table' | 'houses' | 'shop';

export interface BarSection {
  id: BarSectionId;
  label: string;
  /** The section the word belongs to, for a word that routes by section. */
  section: Section;
  /** Where the word goes, for a word that routes by address. */
  path?: string;
  /** The addresses that light the word. Without it, a word with a path lights on that path, otherwise on its section. */
  lights?: readonly string[];
}

/** Today's words with the new bar off. Craft was removed (Adrian, 2026-11-27), so three until HOME_BAR_OPEN turns on. */
const TODAY: readonly BarSection[] = [
  { id: 'read', label: 'Read', section: 'MAGAZINE', path: '/read' },
  { id: 'advise', label: 'Advise', section: 'OFFERINGS' },
  { id: 'shop', label: 'Shop', section: 'SHOP' },
];

/**
 * Where "table" goes. The Tea Table while it is open; until then the
 * sessions, which belong to the same word, because /tea-table sends a visitor
 * Home while it is shut.
 */
export function tableDoor(): string {
  return teaTableOpen() ? '/tea-table' : '/events';
}

/**
 * Where "house" goes. The Tea Houses overview while the portfolio is open;
 * until then Advise, so the word never leads to a missing page.
 */
export function housesDoor(): string {
  // Adrian, 2026-11-27 (4.20): Advise until Tea Houses opens, so nobody lands on a missing page.
  return teaHousesOpen() ? '/tea-houses' : '/advise';
}

const READ_LIGHTS = ['/read', '/article', '/craft', '/learn', '/wisdom', '/magazine'] as const;
const TABLE_LIGHTS = ['/tea-table', '/tea-feed', '/events', '/event', '/people', '/sits', '/session'] as const;
const HOUSES_LIGHTS = ['/tea-houses', '/store', '/advise', '/consult', '/spaces', '/find-a-table', '/for-your-space'] as const;

function launchFour(): readonly BarSection[] {
  return [
    { id: 'read', label: BAR_WORDS.read, section: 'MAGAZINE', path: '/read', lights: READ_LIGHTS },
    { id: 'table', label: BAR_WORDS.table, section: 'EVENTS', path: tableDoor(), lights: TABLE_LIGHTS },
    { id: 'houses', label: BAR_WORDS.houses, section: 'OFFERINGS', path: housesDoor(), lights: HOUSES_LIGHTS },
    { id: 'shop', label: BAR_WORDS.shop, section: 'SHOP' },
  ];
}

/** The sections, in bar order. The first two sit left of the emblem, the rest right. */
export function barSections(open: boolean = homeBarOpen()): readonly BarSection[] {
  return open ? launchFour() : TODAY;
}

function under(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + '/');
}

/** Whether a word is lit at this address. */
export function barSectionActive(item: BarSection, pathname: string, activeSection: Section): boolean {
  if (item.lights) return item.lights.some(prefix => under(pathname, prefix));
  if (item.path) return pathname.startsWith(item.path);
  return activeSection === item.section;
}

/** What keys 1 to 5 open with the new bar on: Home, then the four words in bar order. */
export function sectionKeyPaths(): readonly string[] {
  return ['/', '/read', tableDoor(), housesDoor(), '/shop'];
}
