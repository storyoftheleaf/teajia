# Secondary admin reads — 26 October 2026

Three changes preserve the displayed data while removing broad or unused reads.

- Product story requests the existing authenticated single-product endpoint. Its mapped one-row cache retains the `products` invalidation prefix and optimistic-update array contract. Product, ledger, event, sourcing and tasting caches are scoped to account/user/session. Loading, retry and missing-product states remain distinct.
- Vendor products now include the pricing inputs and `cost_per_gram_usd` from the same server pricing helper used by inventory. Vendor totals use that response instead of fetching the entire inventory again. Raw stock values, currencies, missing costs, teaware and tenant boundaries are preserved.
- The admin-shell incoming-share count was unused: it was neither displayed nor passed to another component. Its polling query is removed. Both Compass screens retain their own incoming-share reads, 60-second polling and accept/decline invalidation. No count endpoint or new schedule is needed.

## Reproducible measurement

`worker/tests/vendor-priced-products.test.ts` calls the actual Worker routes against the same local SQLite fixture: 340 account products, eight belonging to the selected vendor, plus a foreign-account product. It compares returned content, serialized JSON and captured product SQL execution. Product detail must exactly equal its full-list row; all vendor economics must match the old two-response calculation.

| Metric | Before | After | Reduction |
|---|---:|---:|---:|
| Product story: returned product rows | 340 | 1 | 99.7% |
| Product story: product JSON bytes | 551,884 | 1,616 | 99.7% |
| Product story: product-query SQLite VM steps | 62,914 | 118 | 99.8% |
| Vendor: returned product rows | 348 | 8 | 97.7% |
| Vendor: product JSON bytes | 553,656 | 2,800 | 99.5% |
| Vendor: product-query SQLite VM steps | 64,867 | 2,025 | 96.9% |
| Unused incoming-share shell query | one initial read + 60-second polling | zero | 100% |

These are controlled local measurements, **not billed D1 row counts or whole-site percentage savings**. SQL metrics cover the product queries; authentication, rates and other page data still incur their normal work. Actual savings depend on product counts and how often these screens are used. The removed shell poll eliminates roughly 60 repeat requests per foreground hour outside the Compass screens, plus its initial read; browsers can throttle background timers.

## Verification

- Worker route parity includes aliases, missing exchange rates, explicit zero, missing cost/quantity, archived products, teaware, fractional/null stock and a foreign tenant.
- Product story browser behavior covers relationship sections, account/user changes, late responses, optimistic updates, invalidation, retry, missing products and back navigation.
- Full-screen browser contracts retain vendor cost, per-gram cost, stock value and purchase history on desktop/mobile and assert no full inventory request.
- Incoming-share browser checks advance time beyond the old polling interval, require zero unrelated-shell requests, and exercise both Compass implementations' polling and accept/decline updates.
- Existing worker typecheck diagnostic locations move by nine lines with the vendor handler; no additional diagnostics are allowed.

Verification covered 2,615 worker tests and 2,877 client tests (11 existing skips). The initial full runs exposed two stale fixtures/guards and a blocked benchmark subprocess; each was corrected and its affected tests rerun successfully. Six desktop/mobile contract cases, three product-story browser cases and three incoming-share browser cases passed. Production build, frontend type checking, the unchanged 37-diagnostic worker ratchet, and color lint passed.

Publication uses the worker-first immutable-revision runner; its recorded release result is the authority for live status.
