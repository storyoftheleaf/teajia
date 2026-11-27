/**
 * The switch states the review run walks (todo/plans/guests-and-tea-masters-review-run.md).
 *
 * Launch 1 (FIRST_TABLE_OPEN) is open on the live site, so it is open in every
 * set. The other fifteen are named here in the draft opening order; A10 and W4
 * confirm or correct it, and the change is made here, once.
 *
 * A set is one of:
 *   live            as the live site is now: only Launch 1 open
 *   all             everything open
 *   only:<SWITCH>   Launch 1 and that one switch
 *   upto:<SWITCH>   Launch 1 and every switch up to and including that one, in the opening order
 * A switch may be named with or without its _OPEN ending.
 */

export const OPENING_ORDER = [
  'FEW_HOSTS_OPEN',
  'ANYONE_HOSTS_OPEN',
  'FAVOURITES_OPEN',
  'YOUR_TABLE_PAGE_OPEN',
  'YOUR_TABLE_PLACE_OPEN',
  'TEA_TABLE_OPEN',
  'TOP_TEAS_OPEN',
  'HOST_ARTICLES_OPEN',
  'TEA_HOUSES_OPEN',
  'HOME_BAR_OPEN',
  'HOST_CREDIT_OPEN',
  'CIRCLES_OPEN',
  'HOST_TOKENS_OPEN',
  'TABLE_CARD_OPEN',
  'KNOW_THIS_TEA_OPEN',
] as const;

export type Switch = (typeof OPENING_ORDER)[number] | 'FIRST_TABLE_OPEN';

/** Always open: Launch 1 is open on the live site. */
export const ALWAYS_OPEN: readonly Switch[] = ['FIRST_TABLE_OPEN'];

/** Read only by the site; the worker has no such variable. */
export const SITE_ONLY: readonly Switch[] = ['HOME_BAR_OPEN'];

export const ALL_SWITCHES: readonly Switch[] = [...ALWAYS_OPEN, ...OPENING_ORDER];

function switchName(raw: string): (typeof OPENING_ORDER)[number] {
  const name = raw.toUpperCase().replace(/_OPEN$/, '') + '_OPEN';
  const found = OPENING_ORDER.find(s => s === name);
  if (!found) throw new Error(`Unknown switch "${raw}". Known: ${OPENING_ORDER.join(', ')}`);
  return found;
}

/** The switches open in a named set. */
export function openSwitches(set: string): Switch[] {
  if (set === 'live') return [...ALWAYS_OPEN];
  if (set === 'all') return [...ALL_SWITCHES];
  const [kind, raw] = set.split(':');
  if (kind === 'only' && raw) return [...ALWAYS_OPEN, switchName(raw)];
  if (kind === 'upto' && raw) {
    const last = OPENING_ORDER.indexOf(switchName(raw));
    return [...ALWAYS_OPEN, ...OPENING_ORDER.slice(0, last + 1)];
  }
  throw new Error(`Unknown switch set "${set}". Use live, all, only:<SWITCH> or upto:<SWITCH>.`);
}

/** Every set the crawl (W4) walks: live, all, each switch alone, each step of the opening order. */
export function everySet(): string[] {
  return [
    'live',
    'all',
    ...OPENING_ORDER.map(s => `only:${s}`),
    ...OPENING_ORDER.map(s => `upto:${s}`),
  ];
}

/** The site's environment for a set: every VITE_ switch named, 'true' or 'false'. */
export function siteEnv(set: string): Record<string, string> {
  const open = new Set(openSwitches(set));
  return Object.fromEntries(ALL_SWITCHES.map(s => [`VITE_${s}`, open.has(s) ? 'true' : 'false']));
}

/** The worker's environment for a set (offline-fixtures.mjs passes each 'true' as a --var). */
export function workerEnv(set: string): Record<string, string> {
  const open = new Set(openSwitches(set));
  return Object.fromEntries(ALL_SWITCHES.filter(s => !SITE_ONLY.includes(s)).map(s => [s, open.has(s) ? 'true' : 'false']));
}
