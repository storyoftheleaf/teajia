/**
 * One reading for the Samples-only inventory view and agent stock answers.
 *
 * Rows read scale with the ANSWER, not with the shelf. Until 2026-10-25 this
 * ran a correlated `SUM(products.stock_grams)` once per compass entry and then
 * a SECOND recursive query per entry for that entry's sample portions, so a
 * single listing read 93,817 rows; `search_tea` reached it on every call and a
 * day of ordinary use exhausted D1's free-tier daily row-read allowance, at
 * which point the whole API answers nothing. The merge families, the stock
 * behind each family and every sample portion are now each read ONCE, and the
 * per-entry assembly happens in JavaScript.
 *
 * **And the answer itself is bounded, because "scales with the answer" is only
 * half a guarantee.** A reading proportional to a shelf of 139 teas is cheap
 * and a reading proportional to a shelf of 139,000 is the same outage by a
 * slower road, so no single call reads more than one PAGE of canonical teas:
 * `MAX_CURATE_HOLDINGS_PAGE` of them, ever, whatever it is asked for. The page
 * is a keyset, not an offset — an offset re-reads every row it skips, which is
 * the bill this file exists to stop paying.
 *
 * Output is byte-for-byte what it was, which is the whole constraint here.
 * Three details carry that:
 *
 * - **A product may be reached BOTH ways and must still be counted once.** The
 *   old SUM had one `OR` between "a product whose `source_compass_entry_id` is
 *   a family member" and "a product a family member holds as its
 *   `draft_product_id`", so a product satisfying both was summed once. `links`
 *   is therefore a `UNION` of (family root, product id) PAIRS, deduplicated
 *   before anything is added up — two sums added together would double it.
 *   The grams ride along in that row so the total needs no second pass over
 *   `products`, and they cannot change the deduplication: one product id
 *   carries one `stock_grams`, so a duplicate pair is a duplicate triple.
 * - **A family with links but no recorded grams reads 0, not absent.** `SUM`
 *   skips NULLs and returns NULL for no rows; the old `COALESCE(...,0)` sat
 *   outside the scalar subquery, so the `LEFT JOIN` plus `COALESCE` here lands
 *   on the same answer whether the family has no products or no grams.
 * - **The `+` on `+e.account_id` in the recursive step is the whole fix, and
 *   it looks like a typo.** A unary plus tells SQLite not to use an index for
 *   that term. Without it the planner sees `account_id` as an indexable
 *   prefix, makes `tea_compass_entries` the OUTER loop of the recursive step
 *   and scans the queue inside it, so every step re-reads every row in the
 *   account: 142,009 rows read for a page of 201 teas on a 300-tea shelf,
 *   measured. With it the only indexable term left is the join key, the queue
 *   drives, and each step is a `merged_into_id` lookup: 5,525 rows for the
 *   same page, 26 times less. This is also why migration `0050` indexes
 *   `(merged_into_id, account_id)` and not the other way round — the leading
 *   column has to be the one being looked up. The numbers and the query plans
 *   are in `todo/plans/curate-holdings-d1-reads-measurement.md`.
 * - **The page's sort keys are `COALESCE`d and the order is unchanged.** The
 *   keyset compares `(vendor_name, name, id)` as a row value, and a NULL in a
 *   row-value comparison answers NULL rather than true or false, which would
 *   silently drop every tea with no vendor recorded. SQLite already sorts NULL
 *   before every string and `''` sorts before every non-empty string, so
 *   coalescing to `''` leaves the sequence identical except that a vendor
 *   stored as `''` now ties with one stored as NULL, broken by name then id.
 */

/** Canonical teas one call returns when nobody said how many. */
export const DEFAULT_CURATE_HOLDINGS_PAGE = 50;
/**
 * Canonical teas one call may read, whatever it asks for. The ceiling, not a
 * suggestion: a caller that wants the whole shelf follows `next_cursor`, which
 * costs it another request and costs the shop a bounded read either way.
 */
export const MAX_CURATE_HOLDINGS_PAGE = 200;

export type CurateHoldingsOptions = {
  teaId?: string;
  teaIds?: string[];
  samplesOnly?: boolean;
  /** Canonical teas to read. Clamped into 1..`MAX_CURATE_HOLDINGS_PAGE`. */
  limit?: number;
  /** An opaque `next_cursor` from a previous page. */
  cursor?: string | null;
};

export type CurateHolding = {
  entry: Record<string, any>;
  stock_grams: number;
  sample_grams: number | null;
  samples: Record<string, any>[];
};

export type CurateHoldingsPage = {
  holdings: CurateHolding[];
  /** More canonical teas follow this page. */
  has_more: boolean;
  /** Pass back as `cursor` to continue. Null at the end. */
  next_cursor: string | null;
  /** The page size actually used, after clamping. */
  limit: number;
  /**
   * Canonical teas this page looked at, before `samples_only` dropped any.
   * A page can come back empty with `has_more` true, because the samples-only
   * filter is applied to the page rather than inside the query, and a caller
   * that stops on an empty page stops early.
   */
  scanned: number;
};

const SAMPLE_HELD_STATES = ['received', 'untasted', 'tasted', 'favorite', 'ordering', 'ordered', 'passed'];

type HoldingsCursor = { v: string; n: string; i: string };

/**
 * Base64url of the three sort keys. Opaque on purpose: it is this query's
 * ordering, not a promise to the caller about what the next page starts at.
 */
function encodeCursor(entry: Record<string, any>): string {
  const payload: HoldingsCursor = {
    v: String(entry.vendor_name ?? ''),
    n: String(entry.name ?? ''),
    i: String(entry.id ?? ''),
  };
  return btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeCursor(cursor: string | null | undefined): HoldingsCursor | null {
  if (!cursor) return null;
  try {
    const padded = cursor.replace(/-/g, '+').replace(/_/g, '/');
    const parsed = JSON.parse(atob(padded + '='.repeat((4 - padded.length % 4) % 4)));
    if (!parsed || typeof parsed !== 'object') return null;
    const { v, n, i } = parsed as Partial<HoldingsCursor>;
    if (typeof i !== 'string' || !i) return null;
    return { v: typeof v === 'string' ? v : '', n: typeof n === 'string' ? n : '', i };
  } catch {
    // An unreadable cursor reads the first page rather than refusing. It is a
    // position in a list, not an authorisation: nothing is hidden by starting
    // over, and a 400 here would strand a caller whose only mistake was
    // holding a cursor from a deploy ago.
    return null;
  }
}

/**
 * One page of holdings, with the cursor to continue.
 *
 * `teaIds` short-circuits the page: `search_tea` and `get_tea` already know
 * which teas they are going to print, so the merge-family recursion starts
 * from those roots rather than from every tea in the shop. The id list is the
 * bound in that case, itself capped at `MAX_CURATE_HOLDINGS_PAGE`.
 */
export async function readCurateHoldingsPage(
  db: D1Database,
  accountId: string,
  options: CurateHoldingsOptions = {},
): Promise<CurateHoldingsPage> {
  const requested = Number(options.limit);
  const limit = Math.min(
    Math.max(Number.isFinite(requested) && requested > 0 ? Math.floor(requested) : DEFAULT_CURATE_HOLDINGS_PAGE, 1),
    MAX_CURATE_HOLDINGS_PAGE,
  );

  const askedIds = options.teaIds ?? (options.teaId !== undefined ? [options.teaId] : null);
  if (askedIds && askedIds.length === 0) {
    return { holdings: [], has_more: false, next_cursor: null, limit, scanned: 0 };
  }
  const ids = askedIds ? askedIds.slice(0, MAX_CURATE_HOLDINGS_PAGE) : null;
  const idsTruncated = !!askedIds && askedIds.length > MAX_CURATE_HOLDINGS_PAGE;

  // One more than the page, so the extra row is the answer to "is there more"
  // without a second COUNT over the same rows.
  const pageSize = ids ? ids.length : limit + 1;
  const cursor = ids ? null : decodeCursor(options.cursor);

  // `roots` is the PAGE of canonical teas, and it is the only place a bound is
  // needed: `family` walks down from those roots, and both reads below share
  // this head, so the stock and the portions describe exactly the teas on this
  // page and no others.
  const rootFilter = ids ? ` AND id IN (${ids.map(() => '?').join(',')})` : '';
  const cursorFilter = cursor ? ` AND (COALESCE(vendor_name,''),COALESCE(name,''),id) > (?,?,?)` : '';
  const familyCte = `WITH RECURSIVE roots(id,sort_vendor,sort_name) AS (
    SELECT id,COALESCE(vendor_name,''),COALESCE(name,'') FROM tea_compass_entries
     WHERE account_id=? AND deleted_at IS NULL AND merged_into_id IS NULL AND archived_at IS NULL${rootFilter}${cursorFilter}
     ORDER BY COALESCE(vendor_name,''),COALESCE(name,''),id
     LIMIT ?
  ), family(root,id,depth) AS (
    SELECT id,id,0 FROM roots
    UNION ALL SELECT f.root,e.id,f.depth+1 FROM family f JOIN tea_compass_entries e ON e.merged_into_id=f.id
      WHERE +e.account_id=? AND f.depth<20
  )`;
  const rootBinds: unknown[] = [
    accountId,
    ...(ids ?? []),
    ...(cursor ? [cursor.v, cursor.n, cursor.i] : []),
    pageSize,
  ];

  const rowsQuery = db.prepare(`${familyCte}, family_entries(root,id,draft_product_id) AS (
    SELECT f.root,t.id,t.draft_product_id FROM family f JOIN tea_compass_entries t ON t.id=f.id AND t.account_id=?
  ), links(root,product_id,grams) AS (
    SELECT fe.root,p.id,p.stock_grams FROM products p JOIN family_entries fe ON fe.id=p.source_compass_entry_id
      WHERE p.account_id=? AND (p.inventory_purpose IS NULL OR p.inventory_purpose!='sample')
    UNION
    SELECT fe.root,p.id,p.stock_grams FROM family_entries fe JOIN products p ON p.id=fe.draft_product_id
      WHERE p.account_id=? AND (p.inventory_purpose IS NULL OR p.inventory_purpose!='sample')
  ), stock(root,grams) AS (
    SELECT root,SUM(grams) FROM links GROUP BY root
  ) SELECT e.*,COALESCE(s.grams,0) AS stock_grams
    FROM roots r JOIN tea_compass_entries e ON e.id=r.id
    LEFT JOIN stock s ON s.root=e.id
    ORDER BY r.sort_vendor,r.sort_name,e.id`)
    .bind(...rootBinds, accountId, accountId, accountId)
    .all<Record<string, any>>();

  // Every portion for every family on this page in one read, tagged with the
  // family it belongs to. Ordered by root first so the per-tea order is still
  // created_at then id.
  const portionsQuery = db.prepare(`${familyCte}
    SELECT f.root AS holding_root,s.id,s.name,s.grams,s.grams_known,s.status,s.set_id,s.compass_entry_id FROM tea_samples s
      JOIN family f ON f.id=s.compass_entry_id
      JOIN tea_sample_sets st ON st.id=s.set_id AND st.account_id=s.account_id
      WHERE s.archived_at IS NULL AND s.account_id=? AND COALESCE(st.archived,0)=0 ORDER BY f.root,s.created_at,s.id`)
    .bind(...rootBinds, accountId, accountId)
    .all<Record<string, any>>();

  const [rows, portions] = await Promise.all([rowsQuery, portionsQuery]);
  const byRoot = new Map<string, Record<string, any>[]>();
  for (const { holding_root, ...sample } of portions.results) {
    const list = byRoot.get(String(holding_root)) ?? [];
    list.push({ ...sample, grams: sample.grams_known === 0 ? null : sample.grams });
    byRoot.set(String(holding_root), list);
  }

  // The extra root, if it came back, is the next page's first tea and is not
  // part of this answer.
  const scannedRows = rows.results;
  const overflowed = !ids && scannedRows.length > limit;
  const pageRows = overflowed ? scannedRows.slice(0, limit) : scannedRows;

  const holdings: CurateHolding[] = [];
  for (const entry of pageRows) {
    const samples: Record<string, any>[] = byRoot.get(String(entry.id)) ?? [];
    const receivedPortion = samples.some(sample => SAMPLE_HELD_STATES.includes(sample.status));
    if (options.samplesOnly && ((!['received', 'tasted'].includes(entry.sample_state) && !receivedPortion) || Number(entry.stock_grams) > 0)) continue;
    holdings.push({
      entry,
      stock_grams: Number(entry.stock_grams),
      sample_grams: samples.length && samples.every(sample => sample.grams !== null)
        ? samples.reduce((sum, s) => sum + Number(s.grams ?? 0), 0)
        : null,
      samples,
    });
  }

  const last = pageRows[pageRows.length - 1];
  return {
    holdings,
    has_more: overflowed || idsTruncated,
    next_cursor: overflowed && last ? encodeCursor(last) : null,
    limit,
    scanned: pageRows.length,
  };
}

/**
 * One page of holdings as a bare array, which is the shape five call sites and
 * the browser already read.
 *
 * It defaults to the CEILING rather than to `DEFAULT_CURATE_HOLDINGS_PAGE`,
 * deliberately: every caller of this door wants either one named tea or the
 * whole of a 139-tea shelf, and quietly handing back the first fifty of a list
 * somebody is about to count would be a wrong answer rather than a bounded
 * one. `MAX_CURATE_HOLDINGS_PAGE` keeps it bounded; a caller that needs more
 * than one page asks `readCurateHoldingsPage` and follows the cursor.
 */
export async function readCurateHoldings(
  db: D1Database,
  accountId: string,
  options: CurateHoldingsOptions = {},
): Promise<CurateHolding[]> {
  const page = await readCurateHoldingsPage(db, accountId, {
    ...options,
    limit: options.limit ?? MAX_CURATE_HOLDINGS_PAGE,
  });
  return page.holdings;
}
