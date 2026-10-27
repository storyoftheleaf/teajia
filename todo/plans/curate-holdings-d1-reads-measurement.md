# The holdings read, measured: 87,057 rows to 1,600

2026-10-25. Branch `fix/curate-holdings-d1-reads`.

On 2026-10-24 D1's free-tier allowance of 5,000,000 row reads a day was exhausted at
about 5.54M and the whole API stopped answering. The cause was one reading,
`readCurateHoldings` in [the holdings query](../../worker/src/curateHoldings.ts), sitting
behind the `search_tea` MCP tool and `GET /api/curate/holdings`, reported at about 93,817
rows read per call: roughly sixty ordinary agent turns to spend a day.

Everything below is **measured**, not estimated. The harness is
[the measurement script](../../worker/scripts/measure-holdings-rows.mjs), which boots
Miniflare's D1 — the same workerd implementation `wrangler dev` runs — and reads
`meta.rows_read`, which is D1's own count and the number Cloudflare bills. Nothing touches
the live database or the network.

```
node worker/scripts/measure-holdings-rows.mjs 100 150 300 1000
```

## The headline

At the size that reproduces production's figure — **150 canonical teas, 208 rows in
`tea_compass_entries`**:

| | rows read | statements | teas returned |
|---|---|---|---|
| Before (`main` 6b0965ea) | **87,057** | 151 | 150 |
| After, no index applied | 4,124 | 2 | 150 |
| After, with migration `0050` | **3,108** | 2 | 150 |
| After, the default 50-tea page | **1,600** | 2 | 51 |

**28× fewer rows for the same answer, 54× fewer for the page the code now asks for by
default.** At the 5M daily allowance that moves one listing from 1/57th of a day's budget
to 1/3,125th of it.

## Every size, every state

| canonical teas | rows in table | BEFORE | BEFORE + first-try index | AFTER unpinned | AFTER, no index | AFTER + `0050` | AFTER, default page (51 teas) |
|---|---|---|---|---|---|---|---|
| 100 | 139 | 39,022 (101 stmts) | 39,012 | 24,511 | 2,747 | **2,069** | 1,354 |
| 150 | 208 | 87,057 (151 stmts) | 87,041 | 53,622 | 4,124 | **3,108** | 1,600 |
| 300 | 415 | 342,958 (301 stmts) | 342,928 | 142,009 | 6,787 | **4,755** | 2,446 |
| 1000 | 1,384 | 3,781,687 (1001 stmts) | 3,781,587 | 487,301 | 15,519 | **8,699** | 6,356 |

A single listing on a 1,000-tea shelf used to read **3.78 million rows** — three quarters
of a day's entire allowance in one request.

### The dataset

Seeded to the shop's own proportions, with a second shop alongside so every query is also
proving its account scoping:

| | at 150 canonical | ratio |
|---|---|---|
| `tea_compass_entries`, total | 208 | — |
| … this account | 158 | |
| … canonical (`merged_into_id IS NULL`) | 150 | |
| … merged duplicates | 8 | one per 20 teas |
| … the other shop | 50 | a third again |
| `products` | 30 | one per 5 teas |
| `tea_samples` | 50 | one per 3 teas |

The four tables carry their real column counts and **their real indexes from
`worker/schema.sql`**, because the plan a query gets depends on which indexes exist and a
four-column stand-in flatters it. That detail mattered: see "the first-try index", below.

### A note on the brief's "~93k rows"

The brief asked for a table of about 93,000 rows, on the reading that 93,817 rows read
meant 93,817 rows present. It does not. **93,817 was a quadratic reading a table of about
two hundred rows** — the old query ran one query per canonical tea and each of those
re-read every row in the account. 150 canonical teas reproduces it (87,057); 160 lands
almost exactly on it. A 93,000-row table under the old query would have read roughly
thirty billion rows, which is six thousand days of allowance in one request. The sizes
above are the honest reproduction.

## Why the numbers are what they are

**Before: two multiplications, one on top of the other.** The listing query carried a
correlated `SUM(products.stock_grams)` evaluated once per row, and then JavaScript ran a
SECOND query per row for that row's sample portions. So statements were `1 + N`, and each
of those N re-walked the merge family, which itself re-read the account. The 1,001
statements at 1,000 teas are the N+1 showing through; the 3.78M rows are the N² underneath
it.

**After: two statements, and the cost follows the page.** The merge families, the stock
behind each family and every sample portion are each read ONCE, set-based, and the
per-entry assembly happens in JavaScript. Statements are 2 at every size. And the answer
itself is now bounded: one call reads at most `MAX_CURATE_HOLDINGS_PAGE` (200) canonical
teas, keyset-paged, so the cost follows the page rather than the shelf.

**The one character that did most of the work.** Collapsing the N+1 to two statements was
only worth 1.6× on its own — 142,009 rows at 300 teas, against 342,958. That is the
"AFTER unpinned" column, and it is where this branch stood before measurement. The reason
is the recursive step. Written as

```sql
FROM tea_compass_entries e JOIN family f ON e.merged_into_id=f.id WHERE e.account_id=?
```

SQLite sees `account_id` as an indexable prefix, makes `tea_compass_entries` the **outer**
loop and scans the merge queue inside it, so every step re-reads every row in the account.
Rewriting it as

```sql
FROM family f JOIN tea_compass_entries e ON e.merged_into_id=f.id WHERE +e.account_id=?
```

— the unary `+` tells SQLite not to use an index for that term — leaves the join key as
the only indexable term, so the queue drives and each step is a `merged_into_id` lookup.
**142,009 rows to 6,787, a 21× reduction, with no schema change at all.** Reordering the
`FROM` clause alone did nothing; the `+` is what moves it. Because that line reads exactly
like a typo, it is guarded by a labelled source scan in
[the holdings test](../../worker/tests/curate-holdings.test.ts).

**The first-try index saved 30 rows of 142,009.** This branch originally proposed
`tea_compass_entries(account_id, merged_into_id)` on the stated grounds that the recursion
was building "AUTOMATIC PARTIAL COVERING INDEX" per step. Measured, it was not: the live
schema already carries five other `(account_id, …)` indexes — on `decision`,
`sample_state`, `sample_set_id`, `journey_id` and `visit_id` — and the planner was already
range-scanning one of those by `account_id`. A sixth index with `account_id` leading was
therefore interchangeable with what SQLite was already using. That is also why the
measurement had to carry the real index list: on a stripped schema the claim would have
appeared to hold.

**`0050` now indexes the lookup key, leading.** `tea_compass_entries(merged_into_id,
account_id)` — the recursion looks a tea up BY its parent, so `merged_into_id` has to lead
or the index cannot serve the lookup at all. 6,787 → 5,525 at 300 teas. The second index,
`(account_id, COALESCE(vendor_name,''), COALESCE(name,''), id)`, serves the shelf page's
own `ORDER BY`; it indexes the *expressions* because an index on the raw columns cannot
serve a sort over `COALESCE`, which is how the first attempt at it failed. 5,525 → 4,755
at 300 teas, and more as the shelf grows: 31,453 → 20,003 at 3,000.

**What is left, and why it is being left.** With everything applied, a 201-tea page still
grows slowly with shelf size (4,755 at 300 teas, 8,699 at 1,000). The remaining term is
the `roots` filter walking past merged and archived rows to fill its page. At the shop's
actual size it is a few thousand rows per call against a 5,000,000 daily allowance, and
chasing it would mean a partial index over three `IS NULL` predicates SQLite cannot prove
static. Recorded here rather than fixed.

## Query plans

At 300 canonical teas. Trimmed to the lines that differ; the full output is what the
script prints.

### The recursive step, which is the whole story

| state | plan |
|---|---|
| before, no index | `SEARCH e USING INDEX idx_compass_entries_visit (account_id=?)` then `SCAN f` |
| before, with `0050` | `SEARCH e USING INDEX idx_compass_account_shelf_order (account_id=?)` then `SCAN f` |
| after unpinned, no index | `SEARCH e USING INDEX idx_compass_entries_visit (account_id=?)` then `SCAN f` |
| after unpinned, with `0050` | `SEARCH e USING INDEX idx_compass_account_shelf_order (account_id=?)` then `SCAN f` |
| **after, no index** | `SCAN f` then `SEARCH e USING AUTOMATIC PARTIAL COVERING INDEX (merged_into_id=?)` |
| **after, with `0050`** | `SCAN f` then `SEARCH e USING INDEX idx_compass_merged_into (merged_into_id=?)` |

`SEARCH e … (account_id=?)` first means `e` is the outer loop over the whole account and
the queue is scanned inside it. `SCAN f` first means the queue drives and each step is one
indexed lookup. Note the third and fourth rows: the index does not fix an unpinned query,
it only swaps which `(account_id, …)` index is range-scanned. And the fifth row is why the
code is safe with no migration applied at all — SQLite builds a throwaway index per
statement instead of per step, which costs about 40% more rows and nothing else.

### The shelf page

| state | plan |
|---|---|
| no index | `SEARCH tea_compass_entries USING INDEX idx_compass_entries_visit (account_id=?)` + `USE TEMP B-TREE FOR ORDER BY` |
| with `0050` | `SEARCH tea_compass_entries USING INDEX idx_compass_account_shelf_order (account_id=?)` — the temp b-tree is gone |

### Before, in full, and what it cost

```
SEARCH e USING INDEX idx_compass_entries_visit (account_id=?)
CORRELATED SCALAR SUBQUERY 5          <- once per row, the stock SUM
  SEARCH p USING INDEX idx_products_account_shown (account_id=?)
  CORRELATED LIST SUBQUERY 3
    MATERIALIZE family
      RECURSIVE STEP
        SEARCH e USING INDEX idx_compass_entries_visit (account_id=?)
        SCAN f                        <- the account, re-read per step
  SEARCH family USING AUTOMATIC COVERING INDEX (root=?)
  CORRELATED LIST SUBQUERY 4          <- a second correlated subquery per row
USE TEMP B-TREE FOR ORDER BY
```

Two `CORRELATED` subqueries per row, each with the family walk inside them, and then one
more statement per row for the portions. The old portions query also has `SCAN s` at the
top: every sample row in the shop, read once per tea.

### After, in full

```
MATERIALIZE roots
  SEARCH tea_compass_entries USING INDEX idx_compass_account_shelf_order (account_id=?)
MATERIALIZE stock
  CO-ROUTINE links
    MATERIALIZE family
      SCAN roots
      RECURSIVE STEP
        SCAN f
        SEARCH e USING INDEX idx_compass_merged_into (merged_into_id=?)
    SEARCH t USING COVERING INDEX idx_compass_account_shelf_order (account_id=?)
    SEARCH p USING INDEX idx_products_account_compass_identity (account_id=? AND source_compass_entry_id=?)
  UNION USING TEMP B-TREE
SCAN r
SEARCH e USING INDEX sqlite_autoindex_tea_compass_entries_1 (id=?)
SEARCH s USING AUTOMATIC COVERING INDEX (root=?) LEFT-JOIN
```

No `CORRELATED` anything. `roots` is bounded by `LIMIT`, the family walk is one indexed
lookup per queue row, and the stock is one indexed product lookup per family member.

## Is the code safe without migration `0050`?

**Yes, and that is measured, not assumed.** The "AFTER, no index" column above is the code
running on a database with neither index: 4,124 rows at 150 teas against 3,108 with them,
about 40% more and correct either way. SQLite answers the recursion with an
`AUTOMATIC PARTIAL COVERING INDEX` and the page with a temp b-tree.

Nothing in the code names either index, consults `sqlite_master`, or carries an
`INDEXED BY` clause. The whole worker test suite — 2,581 tests — runs against databases
built from `worker/schema.sql` and from the migration ledger, and the holdings tests build
their own tables with no indexes at all. `0050` is schema only: no `UPDATE`, no `DELETE`,
no `INSERT`, no row read, written or moved, so it needs no before-and-after page under
the migration rule in `CLAUDE.md`.

## The guardrails measured here

Reducing the read was necessary and is not sufficient — the next unmeasured query will do
the same thing. Two bounds now sit above it, covered by
[the budget test](../../worker/tests/one-request-one-read-budget.test.ts):

- **One call** reads at most 200 canonical teas (`MAX_CURATE_HOLDINGS_PAGE`), and
  `search_tea` bounds both candidate scans at `SEARCH_CANDIDATE_CEILING` (5,000), saying
  `candidates_truncated` rather than quietly ranking part of the shelf.
- **One request** may bill `D1_ROWS_READ_BUDGET` rows (default 50,000) over
  `D1_STATEMENT_BUDGET` statements (default 2,000), summed from D1's own `meta.rows_read`
  at the single point `env.DB` enters a request. Over it, the request is refused with 503
  and the figures. `off` disables it. Against this table, every "AFTER" reading is well
  inside 50,000 and every "BEFORE" reading past 300 teas would have been refused.
