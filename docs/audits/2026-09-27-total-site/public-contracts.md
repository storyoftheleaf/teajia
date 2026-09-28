# Public journey contract audit — 2026-09-27

Source inspection only; no product files were changed and no browser was run from this audit. Route declarations are inventoried in [route-inventory.json](./route-inventory.json). The project’s current-state and direction documents describe inquiry-led WhatsApp commerce, account-backed personal tea surfaces, and the active engineering tracks; this audit treats those as product contracts rather than proposing new scope.

## Findings

### PUB-01 — Product links turn inventory outages into “Not Found”

**Severity:** P2 · **Confidence:** High from control flow; runtime reproduction remains for the parent browser pass.

On a cold visit to `/shop/product/:id`, `ProductPage` reads only `inventory`, `isLoading`, and `refetch` from `useInventory()` ([ProductPage.tsx](/Users/adrianrasmussen/Documents/Files/2%20Areas/Coding/teajia/src/pages/ProductPage.tsx:90)). It waits while the query is loading, then treats every absent item as removed or mistyped ([ProductPage.tsx](/Users/adrianrasmussen/Documents/Files/2%20Areas/Coding/teajia/src/pages/ProductPage.tsx:179)). When `/api/products/public` or a selected store’s products request fails, the query leaves loading with an empty inventory and this valid product URL shows a 404-style message.

**Impact:** a temporary API outage makes a valid shared product link appear permanently broken, and the page provides no retry path. The shop already distinguishes request failure and offers retry in [Shop.tsx](/Users/adrianrasmussen/Documents/Files/2%20Areas/Coding/teajia/src/components/Shop.tsx:537).

**Smallest remedy:** consume `isError`, `error`, and `refetch` from the inventory context. Preserve “Not Found” for a successful inventory response with no matching item; render a retryable load error when the query failed.

### PUB-02 — Storefront product failures are presented as a store with no stock

**Severity:** P2 · **Confidence:** High from control flow; runtime reproduction remains for the parent browser pass.

`Storefront`’s products query discards `isError`, `error`, and `refetch` ([Storefront.tsx](/Users/adrianrasmussen/Documents/Files/2%20Areas/Coding/teajia/src/components/storefront/Storefront.tsx:56)). It passes only `productsLoading` and the default empty product list to `StorefrontShopSection` ([Storefront.tsx](/Users/adrianrasmussen/Documents/Files/2%20Areas/Coding/teajia/src/components/storefront/Storefront.tsx:191)). Once a failed request is no longer loading, that section renders “Stock is being prepared” and says the store has not published inventory ([Storefront.tsx](/Users/adrianrasmussen/Documents/Files/2%20Areas/Coding/teajia/src/components/storefront/Storefront.tsx:256)).

**Impact:** customers are told the merchant has no products when the app could not retrieve them; the store gets no recovery action. Store profile loading already has a separate error state, which makes this product-query gap especially visible.

**Smallest remedy:** pass the products query’s error and refetch state through to the section, and distinguish request failure from a successful empty catalog.

### PUB-03 — Find-a-table’s review badge always falls back to “Verified”

**Severity:** P2 · **Confidence:** High; the parent browser pass observed the matching 400 response.

`FindATable` requests `api.teaReviews.list({ visibility: 'network' })` without any tea, product, or sample selector ([FindATable.tsx](/Users/adrianrasmussen/Documents/Files/2%20Areas%2FCoding/teajia/src/components/storefront/FindATable.tsx:28)). The worker rejects that request with 400 unless one of `tea_key`, `product_id`, or `source_sample_id` is present ([worker/src/index.ts](/Users/adrianrasmussen/Documents/Files/2%20Areas/Coding/teajia/worker/src/index.ts:16780)). The directory then reads `reviewsData?.reviews`, although the worker returns a raw array, and increments per review instead of using its computed tea key ([FindATable.tsx](/Users/adrianrasmussen/Documents/Files/2%20Areas/Coding/teajia/src/components/storefront/FindATable.tsx:34)). Its public badge maps a positive count to “Hosting” and everything else to “Verified” ([FindATable.tsx](/Users/adrianrasmussen/Documents/Files/2%20Areas/Coding/teajia/src/components/storefront/FindATable.tsx:219)).

**Impact:** the API call fails (matching the parent’s browser observation), and every directory row falls back to “Verified,” whether or not that table has network reviews. The status therefore makes a factual claim that the page cannot currently support.

**Smallest remedy:** decide what “Hosting” is meant to measure and provide a valid source for that aggregate. The existing review-list endpoint is keyed to one tea and returns review rows; it cannot directly answer a per-store distinct-tea count. If the badge is retained, consume an aggregate that is designed for the directory, and count distinct tea keys. Otherwise remove the unsupported status claim.

## Request observed on `/shop` that is not a public journey failure

The parent browser pass observed `/api/products` returning 401 while the public catalog still rendered. This is an unnecessary admin request, not a customer-visible catalog failure: [useAdminOverlay.ts](/Users/adrianrasmussen/Documents/Files/2%20Areas/Coding/teajia/src/hooks/useAdminOverlay.ts:17) computes an admin-only `enabled` flag for invoices and for consuming the product map, but calls `useProducts()` without passing that flag ([useAdminOverlay.ts](/Users/adrianrasmussen/Documents/Files/2%20Areas/Coding/teajia/src/hooks/useAdminOverlay.ts:21)). `useProducts` defaults to enabled ([useAdminData.ts](/Users/adrianrasmussen/Documents/Files/2%20Areas/Coding/teajia/src/admin/hooks/useAdminData.ts:23)); the public catalog comes from the distinct `/api/products/public` query through `InventoryContext` and `usePublicProducts`. The narrow fix is `useProducts({ enabled })`, while retaining its `refetchProducts` callback for admin actions.

## Journeys checked

- **Shop/search/filter/product:** the public inventory uses `/api/products/public` for the default store and the store-scoped endpoint for other shops. Shop has loading, retryable error, and empty-filter states; taste/origin/type links carry query parameters that both `Shop` and `TeaInventory` consume. Product grid links use background-location modal routing, while cold/shared links render `ProductPage`.
- **Cart/contact handoff:** the cart validates that its items belong to one store, resolves the checkout contact to that store, records the inquiry before opening WhatsApp/email, and keeps the customer’s order snapshot and tracking reference after clearing the cart. Empty-cart, unavailable-contact, popup-blocked, persistence-error, and delivery-success states are represented in code.
- **Sign-in/sign-up/account:** `returnTo` is constrained to a single-slash local path in both sign-in and sign-up pages. Account, order, journal, collection, cellar, profile, and settings surfaces are distinct routes; route presence alone does not imply all data loads successfully. No additional source-only defect met the threshold for a finding in this bounded pass.
- **Directory/storefront loading:** directory store-list loading/error/empty states are explicit. Store profile loading distinguishes an API error, but its product subquery has the failure-state defect in PUB-02. Directory review-status fetching has the failure in PUB-03.

## Route inventory

`route-inventory.json` records 160 route declarations from `src/App.tsx` and `src/admin/AdminApp.tsx`, including redirects, the admin shell, protected admin pages, parameterized routes, and wildcard handling. The three Tea Reference paths are resolved from `src/wisdom/reference/previewMode.ts`; `/` is listed with both conditional components (`Storefront | HomePage`) because the host-store setting selects between them. Each entry includes the declaration file and one-based source line.
