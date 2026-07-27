import type React from 'react';

/**
 * The shape every Wisdom holding shares.
 *
 * Cultivars, regions, varieties, producers, marks, styles and named teas are
 * seven holdings of the same kind, so they get one list engine and one column
 * config rather than seven hand-written browsers that drift apart.
 *
 * The inventory screen is the standard this follows: no page title block, a
 * labelled column header row with sort affordance, micro-caps utilities on the
 * right of the toolbar, and all chrome inside about 140px before the data.
 */

/**
 * FOUR TYPE ROLES. A browser may not use a fifth.
 *
 *   tab      the primary switcher, and the only serif on the screen
 *   rowName  the thing a row is
 *   fact     every secondary value, in a row or in a panel
 *   label    micro-caps
 *
 * MICRO-CAPS RULE: caps are a LABEL treatment, for labels of three words or
 * fewer. Never a sentence, never a note, never a count line. A sentence set in
 * caps is shouting, not labelling. Column headers, field labels and the panel
 * eyebrow qualify. Nothing else on this screen does.
 */
export const WISDOM_TYPE = {
  tab: 'font-display text-ui-16 font-medium leading-none',
  rowName: 'font-sans text-ui-12 font-medium text-tea-text',
  fact: 'font-sans text-ui-11 text-tea-text-sec',
  label: 'font-sans text-ui-10 font-medium uppercase tracking-[0.12em] text-tea-text-dim',
} as const;

/**
 * Utility buttons, copied from the inventory chrome so the two screens read as
 * one system. Actions never wear the serif; that is reserved for the switcher.
 */
export const WISDOM_CHROME_BTN =
  'tap-target font-mono text-ui-11 uppercase tracking-[0.08em] text-tea-text-sec hover:text-tea-text';

/**
 * Admin row density: tighter than a customer row, per the project rules.
 * No `tap-target` here. That utility forces `min-height: 44px`, which would
 * quietly overrule the 36px admin density on every row, and a full-width row is
 * already an easy target without it.
 */
export const WISDOM_ROW = 'w-full min-h-[36px] flex items-center gap-3 px-3 md:px-4 py-1.5 text-left';

/** The column header row. Its own string, so no min-height class fights another. */
export const WISDOM_HEADER_ROW = 'w-full flex items-end gap-3 px-3 md:px-4 py-1';

export type WisdomBreakpoint = 'always' | 'sm' | 'md';

/**
 * SHARED COLUMN SLOTS. Every holding lays its columns into the same five slots,
 * in the same order, at the same widths and the same breakpoints.
 *
 * Before this, switching from Cultivars to Producers moved every column: origin
 * sat at 30% where region sat at 24%, the year column was 10% against 12%, and
 * the eye had to re-find the axis on every tab press. A holding may leave a slot
 * empty (cultivars have no `kind`), but it may not invent a width.
 *
 *   name    what the row is. Always flex-1, always first.
 *   kind    the categorical word: Type, Kind, Country, Era. Always visible.
 *   place   where it is from: Region, Province, Producer. From sm.
 *   detail  the qualifier: Applies to, Provenance. From md.
 *   when    the number: Developed, Founded, Altitude. From md, right-aligned.
 */
export interface WisdomSlot {
  width: string;
  at: WisdomBreakpoint;
  align?: 'left' | 'right';
}

export const WISDOM_SLOT: Record<'kind' | 'place' | 'detail' | 'when', WisdomSlot> = {
  kind: { width: 'w-[18%]', at: 'always' },
  place: { width: 'w-[26%]', at: 'sm' },
  detail: { width: 'w-[18%]', at: 'md' },
  when: { width: 'w-[13%]', at: 'md', align: 'right' },
};

/**
 * When a column appears. 390px shows `always` columns only.
 *
 * Two maps, because the two rows need different display values: a header cell
 * is a flex box (label plus sort arrow), while a body cell must be a block for
 * `truncate` to do anything at all. Text-overflow does not apply to a flex
 * container, so a flex cell would overflow its column instead of ellipsing.
 */
export const AT_FLEX: Record<WisdomBreakpoint, string> = {
  always: 'flex',
  sm: 'hidden sm:flex',
  md: 'hidden md:flex',
};

export const AT_BLOCK: Record<WisdomBreakpoint, string> = {
  always: 'block',
  sm: 'hidden sm:block',
  md: 'hidden md:block',
};

/**
 * Where a cross-holding link points: which tab, and what to do on arrival.
 *
 * Either half is optional, and the two answer different questions. An entry
 * opens one record ("this mark's producer"). A query opens the holding narrowed
 * to a subject ("the forty varieties this place names"), which is what a count
 * standing in for a list has to be able to do; without it "and 30 more" is a
 * dead end that names a number and offers no way to reach it.
 */
export interface WisdomLink {
  holding: string;
  entry?: string;
  /** Seeds the find field on arrival. Plain text: it rides in the address. */
  query?: string;
}

/**
 * Passed to a cell or a detail panel so a held relation can be walked. A mark
 * names a producer we hold; a producer names marks we hold. Both directions are
 * navigable rather than printed as plain text.
 *
 * Optional everywhere, because the holdings are also read outside a browser (the
 * tests call `holding.detail(row)` with no context), and a link with nowhere to
 * go renders as the plain text it always was.
 */
export interface WisdomLinkCtx {
  jump: (link: WisdomLink) => void;
}

export interface WisdomColumn<T> {
  key: string;
  /** Micro-caps header. Three words or fewer, always. */
  label: string;
  /** The sortable value. Null and undefined always sink to the end. */
  value: (row: T) => string | number | null | undefined;
  /** Cell contents. Defaults to the value rendered as plain text. */
  render?: (row: T, ctx?: WisdomLinkCtx) => React.ReactNode;
  /**
   * Width class. The first column is the name column and is always
   * `flex-1 min-w-0`; the rest are percentages of the row.
   */
  width: string;
  align?: 'left' | 'right';
  at?: WisdomBreakpoint;
  /** Columns with no natural order (prose, lists) are not sortable. */
  sortable?: boolean;
}

export interface WisdomFact {
  /** Micro-caps. Three words or fewer. */
  label: string;
  value?: React.ReactNode;
}

/** What a detail panel shows. Facts lay out across the width, prose does not. */
export interface WisdomDetail {
  /** Micro-caps eyebrow: what kind of thing this is. One word where possible. */
  kind: string;
  name: string;
  chineseName?: string;
  altNames?: readonly string[];
  /**
   * What kind of entry this is, when a holding merges sources of unequal depth.
   * Regions are the case: a researched origin carries altitude and climate, a
   * working entry carries neither, and a panel that just comes up empty reads as
   * a bug. A plain sentence, never micro-caps.
   */
  note?: string;
  facts: WisdomFact[];
  /** The prose, set at a reading measure rather than the full panel width. */
  prose?: string;
  /** Anything the generic panel cannot express: lineage, story, mark lists. */
  extra?: React.ReactNode;
}

/**
 * A way to break a holding into sections. 115 regions read as one undifferentiated
 * scroll; the same 115 under twelve country headings read as a map.
 */
export interface WisdomGroup<T> {
  key: string;
  /** Micro-caps menu label. Three words or fewer. */
  label: string;
  /** The section a row belongs in. Empty string means the row has no answer. */
  of: (row: T) => string;
}

/** Rows with no answer for the current grouping collect here, always last. */
export const UNGROUPED = 'Not recorded';

/**
 * What a gap test may ask about the world outside the base.
 *
 * Regions are the case that needs it: a place is a hole when nothing names it,
 * and "nothing" includes the account's own products, which the base cannot see.
 * Absent while the products are still loading, so a gap that depends on them
 * falls back to what the base alone can answer rather than guessing.
 */
export interface WisdomGapCtx {
  /** How many products in this account resolve through the entry today. */
  used: (id: string) => number;
}

/**
 * A known hole in the data, counted rather than met one row at a time.
 *
 * Forty-five of the seventy-nine cultivars name an origin the base does not
 * hold. Discovered a row at a time that is an anecdote: a link that did not turn
 * gold. Counted and stated above the list, with the way to see exactly those
 * rows, it is a work queue. A holding whose gap is currently empty says nothing
 * at all, so the line only ever appears when there is something to do.
 */
export interface WisdomGap<T> {
  /** True when this row is missing the thing the gap is about. */
  test: (row: T, ctx?: WisdomGapCtx) => boolean;
  /** The whole statement, built from the counts. A sentence, never micro-caps. */
  sentence: (missing: number, total: number) => string;
  /**
   * The same statement when the count comes out at zero.
   *
   * A holding with no hole used to render nothing at all, which is exactly what
   * a holding that measures no hole renders. Two opposite facts, identical on
   * screen. A clean holding now says it is clean, and one that measures nothing
   * says that instead, in `WisdomHolding.unmeasured`.
   */
  whole: (total: number) => string;
  /**
   * True when this test cannot be answered by the base alone.
   *
   * Regions is the case: a place is a hole when nothing names it, and the
   * account's own products are part of "nothing". Until they are counted the
   * number is an over-count, and a number that falls a beat after arrival with
   * no word about it reads as a fault rather than as a narrowing.
   */
  needsAccount?: boolean;
  /**
   * The grouping that shows this same fact in the shape of the list.
   *
   * Marks said it twice and connected the two nowhere: the gap line counted the
   * marks naming no held producer, and grouping by producer piled those exact
   * rows under one heading. Naming the grouping here lets the gap toggle set it,
   * so the count and the shape are one gesture instead of two.
   */
  revealBy?: string;
}

/**
 * Where a holding is published for the public to read.
 *
 * An operator correcting a row usually wants to know how the correction reads
 * to a customer. Naming the address in prose made them retype it; holding it
 * here makes it somewhere to go, both for the holding and for one entry.
 * A holding with no public page simply omits this.
 */
export interface WisdomPublicRef<T> {
  /** The public index page for the whole holding. */
  index: string;
  /** The public page for one entry, where the holding publishes per entry. */
  entry?: (row: T) => string;
}

export interface WisdomHolding<T> {
  id: string;
  /** Tab label. Doubles as the heading, since the tab strip IS the heading. */
  label: string;
  /** Lowercase plural for the count line. */
  noun: string;
  rows: readonly T[];
  idOf: (row: T) => string;
  /** Everything a search should look inside, joined. */
  searchText: (row: T) => string;
  placeholder: string;
  columns: ReadonlyArray<WisdomColumn<T>>;
  groups?: ReadonlyArray<WisdomGroup<T>>;
  /** A counted hole in this holding's data, stated in aggregate above the list. */
  gap?: WisdomGap<T>;
  /**
   * Said instead, when this holding counts no hole at all.
   *
   * Silence used to carry two opposite meanings: a holding whose gap came out at
   * zero and a holding that never measured one both rendered nothing. One of
   * those is a clean record and the other is an unasked question, and a reader
   * had no way to tell them apart. Every holding now says which it is.
   */
  unmeasured?: string;
  /**
   * The wisdom base's own matcher for this holding, where it has one. When a
   * query resolves to a held entity, that entity is pinned to the top of the
   * results: typing a mark number lands on the mark rather than on whatever else
   * happens to mention it.
   */
  matchEntity?: (query: string) => T | null;
  /**
   * Where this holding is read outside this screen, said once and quietly. An
   * operator correcting a row should know what else moves with it. One sentence.
   */
  reach: string;
  /**
   * The public reference this holding backs. When set, the address named in
   * `reach` becomes a link, and an open entry gets one to its own public page.
   */
  publicRef?: WisdomPublicRef<T>;
  detail: (row: T, ctx?: WisdomLinkCtx) => WisdomDetail;
  /**
   * Replaces the generic panel when a holding needs more than facts and prose.
   * Cultivars are the only one: their lineage links jump the panel to another
   * entry without leaving the overlay, which needs the browser's selection.
   */
  renderDetail?: (row: T, ctx: WisdomPanelCtx) => React.ReactNode;
}

/** Everything a custom detail panel gets from the browser that opened it. */
export interface WisdomPanelCtx {
  onClose: () => void;
  /** Jumps the panel to another entry of the SAME holding (cultivar lineage). */
  onSelect: (id: string) => void;
  /** Walks a held relation into another holding (a cultivar's origin region). */
  jump: (link: WisdomLink) => void;
  nav?: React.ReactNode;
  /** Which grouped section the open entry sits in, when the list is grouped. */
  section?: WisdomSection;
  /** What run prev and next are walking, when it is narrower than the holding. */
  runNote?: string;
  /** The public page for this entry, when the holding publishes one. */
  publicHref?: string;
  /** How many products resolve through this entry right now. */
  usage?: WisdomEntryUsage;
}

/**
 * What changing this entry would move: the count of products in the account
 * that resolve through it today, against the number scanned.
 *
 * The reach line says a holding is read by the import editor and the shop.
 * That is the wiring. This is the load on it, and it is the number that decides
 * whether an operator edits a record confidently or carefully.
 */
export interface WisdomEntryUsage {
  count: number;
  total: number;
  /**
   * Which products they are, so the number is a list and not a errand.
   *
   * "Eleven products resolve through this entry" was true and unactionable: the
   * only way to see the eleven was to leave for the inventory and rebuild the
   * question there, which is exactly the moment an operator most needs them.
   */
  products: readonly WisdomUsageProduct[];
  /**
   * The inventory, filtered to exactly these products.
   *
   * Naming them in the panel answered "which ones" and left "and now work on
   * them" unanswered: sixty chips is a list to read, not a list to act on. The
   * inventory takes the entry as an address filter now, so the tail links out
   * to the real tool instead of growing the panel to sixty rows tall.
   */
  href: string;
}

/** One product riding on an entry, and the way back to it in the inventory. */
export interface WisdomUsageProduct {
  id: string;
  name: string;
}

/**
 * The heading the open entry sits under. Named by its grouping as well as its
 * value, because "Researched origin" alone does not say what it answers.
 */
export interface WisdomSection {
  group: string;
  name: string;
}

/**
 * What survives a tab change: how a holding was sorted and grouped.
 *
 * The find field deliberately resets, because a query for a cultivar means
 * nothing against the list of marks. Grouping does not: an operator who reads
 * regions by country reads them by country every visit, and re-choosing it on
 * every return is a tax on the one control that gives a long list its shape.
 */
export interface WisdomPrefs {
  sort: WisdomSort;
  groupKey: string;
  /**
   * Which section headings are folded. An array rather than a Set, because it
   * travels between renders and holdings as plain data, and because a folded
   * shape is exactly as much a standing choice as the grouping that produced it:
   * folding Regions to its sixteen countries, reading Marks, and coming back to
   * sixteen open sections undid the one press that gave the list its shape.
   *
   * Read it through `readFold` rather than as a plain set: the sentinel and its
   * exceptions are a small language, not a list of keys.
   */
  collapsed: readonly string[];
  /**
   * Showing only the rows that are missing the thing the gap line names.
   *
   * A preference rather than component state, and therefore in the address: the
   * one link an operator most wants to send is "the seven marks with no held
   * producer", and until this moved here that link arrived showing all fifteen.
   */
  gapOnly: boolean;
}

export const defaultPrefs = (holding: AnyWisdomHolding): WisdomPrefs => ({
  sort: { key: holding.columns[0].key, direction: 'asc' },
  groupKey: '',
  collapsed: [],
  gapOnly: false,
});

/**
 * Every section folded, in one token.
 *
 * Folding 182 regions to sixteen headings and then listing all sixteen in the
 * address would spend 120 characters saying "all of them". The sentinel says it
 * in one, and it is also more truthful: the reader pressed Collapse all, not
 * sixteen separate headings, and a section that appears later is folded too.
 */
export const ALL_FOLDED = '*';

/**
 * An exception to the sentinel: this one heading is open, everything else folded.
 *
 * The sentinel alone could say "all" and "none" and nothing in between, so
 * opening a single country out of a folded shape had to abandon it and spell out
 * the other fifteen instead. One press took the address from three characters to
 * about a hundred and twenty. "All but these" is the shape a reader actually
 * makes, so it gets a way to be written: `*~!China` is folded-all-except-China.
 *
 * Section keys are country, producer and type names, none of which begin with a
 * bang, so the mark can never be mistaken for a key.
 */
export const OPEN_MARK = '!';

/**
 * The folded shape, read out of its wire form.
 *
 * `all` is the sentinel. `keys` means the opposite thing in each mode, which is
 * the whole point: without the sentinel it is the set of folded headings, with
 * it the set of headings held open against it.
 */
export interface WisdomFoldShape {
  all: boolean;
  keys: ReadonlySet<string>;
}

export function readFold(collapsed: readonly string[]): WisdomFoldShape {
  const all = collapsed.includes(ALL_FOLDED);
  const keys = new Set<string>();
  for (const item of collapsed) {
    if (item === ALL_FOLDED) continue;
    const isException = item.startsWith(OPEN_MARK);
    if (all) {
      if (isException) keys.add(item.slice(OPEN_MARK.length));
    } else if (!isException) {
      keys.add(item);
    }
  }
  return { all, keys };
}

export const isSectionFolded = (shape: WisdomFoldShape, key: string): boolean =>
  shape.all ? !shape.keys.has(key) : shape.keys.has(key);

/**
 * One heading opened or folded, written back in whichever form is shorter.
 *
 * `every` is the current headings, used only to normalise: a shape whose
 * exceptions cover every section is simply "none folded", and one whose folded
 * keys cover every section is the sentinel. Without that the address would drift
 * to the long form as a reader worked through the list, which is the same
 * hundred and twenty characters arriving by a slower road.
 */
export function toggleFold(
  collapsed: readonly string[],
  key: string,
  every: readonly string[] = [],
): string[] {
  const shape = readFold(collapsed);
  const next = new Set(shape.keys);
  if (next.has(key)) next.delete(key);
  else next.add(key);

  // Only worth collapsing to a sentinel when there is genuinely a shape to
  // collapse. With one section on screen (a query has narrowed the list to a
  // single heading) "all of them" would quietly mean far more than the reader
  // just pressed, and would still mean it after the query was cleared.
  const coversAll = every.length > 1 && every.every(entry => next.has(entry));
  if (shape.all) {
    // Exceptions to "fold everything". All of them excepted is nothing folded.
    if (coversAll) return [];
    return [ALL_FOLDED, ...[...next].map(entry => `${OPEN_MARK}${entry}`)];
  }
  if (coversAll) return [ALL_FOLDED];
  return [...next];
}

/* ─────────────────────────────── the address ──────────────────────────────── */

/**
 * The keys the Wisdom address uses, in one place so the view, the browser and
 * the tests cannot disagree about them.
 */
export const WISDOM_PARAM = {
  tab: 'tab',
  entry: 'entry',
  query: 'q',
  group: 'group',
  sort: 'sort',
  fold: 'fold',
  gap: 'gap',
} as const;

/**
 * Where the inventory takes a wisdom entry as a filter, and the address that
 * says so. Held here rather than in the inventory because this screen is the one
 * that builds the link; the inventory only reads the key.
 */
export const INVENTORY_WISDOM_PARAM = 'wisdom';

export const wisdomInventoryHref = (holding: string, entry: string): string =>
  `/admin/inventory?${INVENTORY_WISDOM_PARAM}=${encodeURIComponent(`${holding}:${entry}`)}`;

/** Section keys are country and producer names, so the separator must not be one. */
const FOLD_SEPARATOR = '~';

/**
 * The shape of the list, written into the address.
 *
 * Only what differs from the default is written: an address that says nothing
 * means the holding as it comes, which is what a fresh link should mean. A
 * folded shape without a grouping is not a state that exists, so it is dropped
 * rather than carried as a lie.
 */
export function wisdomPrefsToParams(prefs: WisdomPrefs, holding: AnyWisdomHolding): Record<string, string> {
  const fallback = defaultPrefs(holding);
  const out: Record<string, string> = {};
  if (prefs.groupKey) out[WISDOM_PARAM.group] = prefs.groupKey;
  if (prefs.sort.key !== fallback.sort.key || prefs.sort.direction !== fallback.sort.direction) {
    out[WISDOM_PARAM.sort] = `${prefs.sort.direction === 'desc' ? '-' : ''}${prefs.sort.key}`;
  }
  if (prefs.groupKey && prefs.collapsed.length > 0) {
    out[WISDOM_PARAM.fold] = prefs.collapsed.join(FOLD_SEPARATOR);
  }
  // A gap filter on a holding that counts no gap is not a state that exists, so
  // the caller checks that before writing it, exactly as fold checks grouping.
  if (prefs.gapOnly && holding.gap) out[WISDOM_PARAM.gap] = '1';
  return out;
}

/**
 * And back again, checked against the holding rather than trusted.
 *
 * A hand-edited address, or one shared from a tab that has since changed its
 * columns, names a sort or a grouping this holding does not have. That falls
 * back to the default instead of leaving the list ordered by nothing.
 */
export function wisdomPrefsFromParams(
  read: (key: string) => string | null,
  holding: AnyWisdomHolding,
): WisdomPrefs {
  const fallback = defaultPrefs(holding);

  const askedGroup = read(WISDOM_PARAM.group) ?? '';
  const groupKey = holding.groups?.some(group => group.key === askedGroup) ? askedGroup : fallback.groupKey;

  const askedSort = read(WISDOM_PARAM.sort) ?? '';
  const direction: SortDirection = askedSort.startsWith('-') ? 'desc' : 'asc';
  const sortKey = askedSort.replace(/^-/, '');
  const sort = holding.columns.some(column => column.key === sortKey && column.sortable !== false)
    ? { key: sortKey, direction }
    : fallback.sort;

  const askedFold = read(WISDOM_PARAM.fold) ?? '';
  const collapsed = askedFold ? askedFold.split(FOLD_SEPARATOR).filter(Boolean) : fallback.collapsed;

  const gapOnly = Boolean(holding.gap) && read(WISDOM_PARAM.gap) === '1';

  return { sort, groupKey, collapsed: groupKey ? collapsed : [], gapOnly };
}

/**
 * Holdings are stored together and rendered one at a time, so the collection is
 * loosely typed while each definition stays checked at its own call site.
 */
export type AnyWisdomHolding = WisdomHolding<any>;

export const defineHolding = <T,>(holding: WisdomHolding<T>): AnyWisdomHolding => holding;

export type SortDirection = 'asc' | 'desc';

export interface WisdomSort {
  key: string;
  direction: SortDirection;
}

/** Missing values sink to the end in both directions; absence is not a rank. */
export function compareWisdom(
  left: string | number | null | undefined,
  right: string | number | null | undefined,
  direction: SortDirection,
): number {
  const leftEmpty = left === null || left === undefined || left === '';
  const rightEmpty = right === null || right === undefined || right === '';
  if (leftEmpty && rightEmpty) return 0;
  if (leftEmpty) return 1;
  if (rightEmpty) return -1;
  const order =
    typeof left === 'number' && typeof right === 'number'
      ? left - right
      : String(left).localeCompare(String(right));
  return direction === 'asc' ? order : -order;
}

/** The searchable haystack for one row, lowercased once per row. */
export const haystack = (...parts: Array<string | number | null | undefined>): string =>
  parts.filter(part => part !== null && part !== undefined && part !== '').join(' ').toLowerCase();

/* ────────────────────────────── search ────────────────────────────────────── */

/**
 * The wisdom base's own matching rule, applied to the browser's find field.
 *
 * `matchKey` folds away spacing, punctuation and case, so "dahongpao" and
 * "Da Hong Pao" are one key and an alias search behaves the way the import
 * editor and the capture card already behave.
 *
 * The shape is deliberately identical to `src/wisdom/producers.ts` and
 * `src/wisdom/cultivars.ts`, which is where it belongs; those modules keep it
 * private, and this screen may not edit them, so it is restated here rather than
 * approximated with `String.includes`.
 */
export const wisdomKey = (value: string): string =>
  value.normalize('NFKD').toLowerCase().replace(/[^a-z0-9㐀-鿿]+/g, '');

/**
 * Containment that will not cut a number in half, so "7572" never matches inside
 * "75720". A plain substring search reported the wrong recipe mark as a hit.
 */
export function containsWholeToken(candidate: string, key: string): boolean {
  const digit = /\d/;
  for (let from = 0; ; from += 1) {
    const at = candidate.indexOf(key, from);
    if (at < 0) return false;
    const before = at > 0 ? candidate[at - 1] : '';
    const after = candidate[at + key.length] ?? '';
    const cuts = (digit.test(key[0]) && digit.test(before)) || (digit.test(key[key.length - 1]) && digit.test(after));
    if (!cuts) return true;
    from = at;
  }
}

/** A query split into keys. Every one of them must be found: find is an AND. */
export const wisdomQueryTokens = (query: string): string[] =>
  query.trim().split(/\s+/).map(wisdomKey).filter(Boolean);

export const wisdomMatches = (searchText: string, tokens: readonly string[]): boolean => {
  if (tokens.length === 0) return true;
  const candidate = wisdomKey(searchText);
  return tokens.every(token => containsWholeToken(candidate, token));
};

/**
 * Type-ahead, folded the same way find is folded, so a list that answers to
 * "dahongpao" in the find field answers to "dah" from the keyboard.
 */
export const wisdomStartsWith = (name: string | number | null | undefined, typed: string): boolean => {
  const key = wisdomKey(typed);
  return key.length > 0 && wisdomKey(String(name ?? '')).startsWith(key);
};

/* ─────────────────────────────── recognition ──────────────────────────────── */

/**
 * What the base itself makes of the query, as opposed to what the substring
 * search makes of it.
 *
 * `own` is a recognition inside the open holding: the entry is pinned to the
 * top of the results. Anything else is a recognition somewhere ELSE in the base,
 * which is worth saying out loud rather than leaving as an empty result: typing
 * a recipe mark while reading varieties should not read as "not held".
 */
export interface WisdomRecognition {
  holding: AnyWisdomHolding;
  row: unknown;
  own: boolean;
}

export function recogniseQuery(
  query: string,
  holding: AnyWisdomHolding,
  siblings: readonly AnyWisdomHolding[] = [],
): WisdomRecognition | null {
  const asked = query.trim();
  if (!asked) return null;
  const here = holding.matchEntity?.(asked) ?? null;
  if (here) return { holding, row: here, own: true };
  for (const other of siblings) {
    if (other.id === holding.id) continue;
    const row = other.matchEntity?.(asked) ?? null;
    if (row) return { holding: other, row, own: false };
  }
  return null;
}

/* ─────────────────────────────── the near miss ────────────────────────────── */

/**
 * Edit distance, abandoned the moment it is certain to exceed `max`.
 *
 * Bounded because this runs over every name the base holds, and because a
 * distance of nine is not a near miss and there is nothing to learn from
 * computing it exactly. The band check on the outer loop is the usual one: a row
 * whose best remaining cell already exceeds the budget cannot recover.
 */
export function editDistance(left: string, right: string, max: number): number {
  if (Math.abs(left.length - right.length) > max) return max + 1;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    let best = row;
    for (let column = 1; column <= right.length; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      const value = Math.min(previous[column] + 1, current[column - 1] + 1, previous[column - 1] + cost);
      current.push(value);
      if (value < best) best = value;
    }
    if (best > max) return max + 1;
    previous = current;
  }
  const distance = previous[right.length];
  return distance > max ? max + 1 : distance;
}

/** The closest held entry to a query that found nothing, and where it is kept. */
export interface WisdomNearMiss {
  holding: AnyWisdomHolding;
  row: unknown;
  name: string;
  own: boolean;
}

/**
 * How many near misses are worth offering. Three is a choice the reader makes;
 * four is a list they have to read.
 */
export const NEAR_MISS_LIMIT = 3;

/**
 * The entries a query nearly asked for, nearest first.
 *
 * Exact recognition is the easy half. A query one character off a held entry is
 * precisely where holding a matcher should earn its keep, and until round two it
 * returned an empty list and said nothing, which reads as "the base does not
 * have this" when the base has it and the finger slipped.
 *
 * It used to answer with exactly one candidate, silently chosen, which is wrong
 * whenever a query sits two edits from several entries: "dahonpao" is one edit
 * from Da Hong Pao and two from three other things, and picking one of them for
 * the reader hides the fact that a choice was made at all. It now returns the
 * nearest few and lets the reader recognise their own word.
 *
 * The open holding is read first and wins ties, because a reader looking at
 * cultivars means a cultivar. Only ever called when the find field has emptied
 * the list, so the full scan is paid once, on the screen that would otherwise be
 * blank; `editDistance` abandons a row the moment it cannot come in under the
 * budget, so most of the base costs a length comparison.
 */
export function nearestWisdom(
  query: string,
  holding: AnyWisdomHolding,
  siblings: readonly AnyWisdomHolding[] = [],
): WisdomNearMiss[] {
  const key = wisdomKey(query);
  // Under four characters everything is one edit from everything else.
  if (key.length < 4) return [];
  const max = key.length <= 6 ? 1 : 2;

  const found: Array<WisdomNearMiss & { distance: number }> = [];

  const scan = (candidate: AnyWisdomHolding, own: boolean) => {
    const nameOf = candidate.columns[0].value;
    for (const row of candidate.rows) {
      const name = String(nameOf(row) ?? '');
      const distance = editDistance(key, wisdomKey(name), max);
      if (distance <= max) found.push({ holding: candidate, row, name, own, distance });
    }
  };

  scan(holding, true);
  for (const other of siblings) {
    if (other.id !== holding.id) scan(other, false);
  }

  found.sort(
    (left, right) =>
      left.distance - right.distance ||
      Number(right.own) - Number(left.own) ||
      left.name.localeCompare(right.name),
  );

  return found.slice(0, NEAR_MISS_LIMIT).map(({ holding: at, row, name, own }) => ({ holding: at, row, name, own }));
}
