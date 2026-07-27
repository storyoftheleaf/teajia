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

export interface WisdomColumn<T> {
  key: string;
  /** Micro-caps header. Three words or fewer, always. */
  label: string;
  /** The sortable value. Null and undefined always sink to the end. */
  value: (row: T) => string | number | null | undefined;
  /** Cell contents. Defaults to the value rendered as plain text. */
  render?: (row: T) => React.ReactNode;
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
  facts: WisdomFact[];
  /** The prose, set at a reading measure rather than the full panel width. */
  prose?: string;
  /** Anything the generic panel cannot express: lineage, story, mark lists. */
  extra?: React.ReactNode;
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
  detail: (row: T) => WisdomDetail;
  /**
   * Replaces the generic panel when a holding needs more than facts and prose.
   * Cultivars are the only one: their lineage links jump the panel to another
   * entry without leaving the overlay, which needs the browser's selection.
   */
  renderDetail?: (row: T, ctx: { onClose: () => void; onSelect: (id: string) => void }) => React.ReactNode;
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
