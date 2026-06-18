# Stock spine — handoff for steps 2–5

This is the build plan for the Teajia movement/locations/sellers/collections model. **Step 1 is shipped** (branch `feat/stock-spine-step1-ownership`, commit `7fc398d3`); steps 2–5 are queued here in order. Each step sits on the one before it — do not reorder.

The full conceptual spec lives in [docs/MULTI_STORE_PLAN.md](../../docs/MULTI_STORE_PLAN.md), sections "Movement / Locations / Sellers / Personal Collections" and "The standalone seller — a public personal shelf". **Read that first.** This file is the execution plan; that doc is the why.

---

## The locked model (one paragraph)

Everything is **one stock spine**: every piece of tea is a row owned by a person, and four switches vary — tied to a location or not, shown by the location owner or not, for sale or not, who can see it. From that one spine come five views: the **movement** (Adrian's read-only master lens over all locations, sells nothing), a **location** (Bali/Australia/future warehouse — sells in person and online, fulfills its own orders), a **seller inside a location** (owns rows the location owner curates into the shop), a **personal collection** (the private, location-less, not-for-sale floor), and a **standalone public shelf** (a personal collection flipped public at its own link, buyer deals with the seller directly, Teajia never holds the money, permission granted by Adrian).

**Load-bearing rules (do not break):** one order belongs to one location that fills it (no cross-location fulfillment until built as its own project); the movement holds no stock and no storefront; stock-exists and stock-shown are separate switches; private by default; cross-border shipping and per-seller payouts are explicitly deferred.

---

## What step 1 already gave you (the foundation)

- `owner_user_id` column on **both** `products` and `product_listings` (migration `090_stock_owner.sql`). NULL = owned by the location (existing default, nothing changed visibly); set = owned by a specific person.
- New products record their creator (`ctx.userId`) as owner automatically.
- The owner flows through the listing mirror (`LISTING_MIRROR_COLUMNS` in `worker/src/index.ts`).
- Index on `(account_id, owner_user_id)` on both tables for cheap per-owner filtering.
- **Migration discipline note:** step 1 added the listings column via the new migration 090 only — do NOT edit old applied migrations (048 etc.) to add columns. A fresh-DB `CREATE TABLE` that already has the column will collide with 090's `ALTER ... ADD COLUMN` (SQLite has no `IF NOT EXISTS` on ADD COLUMN). 090 is the single source of truth for `owner_user_id`. Follow this pattern for every step below.

So: "whose tea is this" is now a real fact on every row. Steps 2–5 read and act on it.

---

## Step 2 — Location owner curates which sellers' tea shows  _(agent-runnable · deep)_

**Goal:** several people can hold their own tea in one location; the location owner chooses which of it appears in that location's shop. Being in stock and being shown become two separate switches.

**Build:**
1. New migration: add a per-row show/hide flag that the **location owner** controls, distinct from the existing `is_public`. Suggest `owner_approved INTEGER` (or `shown_in_shop`) on `product_listings` — default so existing rows stay visible (1), so no current shop changes. A seller's freshly-added row could default to 0 (held until the owner approves) — decide and document.
2. Worker: gate the public storefront query (`fetchPublicProductsForAccount` in `worker/src/index.ts`, the `WHERE is_public = 1 AND status = 'Active' AND account_id = ?` clause) to ALSO require the owner-approved switch. A seller's own row that the owner hasn't shown must not appear.
3. Admin: in `InventoryView.tsx`, let the operator filter/group stock by owner (using `owner_user_id` from step 1) and toggle each row's show/hide. Reuse the existing in-shop Eye toggle pattern (`ProductEditPanel.tsx` ~line 1283) — this is a sibling switch, not a replacement.
4. Permissions: only `owner`/`manager` of the location may flip the show/hide. A `staff` seller can add their own stock but not self-approve into the shop.

**Done when:** a second person's tea can exist in Bali, and the Bali owner can show or hide each of their teas in the shop. One storefront, no marketplace, no per-seller checkout split.

**Stay in scope:** still one shop per location; customers see one curated catalog, not a vendor list. No payouts.

---

## Step 3 — All-locations master view  _(agent-runnable · moderate)_

**Goal:** Adrian sees every location's stock at once, each tea labelled by where it lives. The movement as a lens.

**Build:**
1. Worker: a NEW platform-owner-only endpoint that aggregates `products`/`product_listings` across all accounts (no `account_id` filter — instead JOIN account name per row). Today every product read is single-account (`WHERE account_id = ?`); this is the one query that spans them. Guard it hard: only `platform_owner`/`platform_admin` (see the existing platform-role checks in `worker/src/index.ts`).
2. Frontend: a read-only admin view listing all stock with a **location column** and an **owner column** (from step 1). Read-only is the rule — to change stock, Adrian steps into that location (the existing AccountSwitcher already does this).
3. Never customer-facing. No cart, no buy button. This is a mirror, not a counter.

**Done when:** Adrian sees a single list spanning all locations with a location note per row, and steps into a location to actually change anything.

**Stay in scope:** read-only, operator-only, no aggregate checkout (that's the deferred cross-location fulfillment).

---

## Step 4 — Personal collections for regular users  _(agent-runnable · deep)_

**Goal:** a logged-in regular user records tea they personally own — private by default, tied to no location.

**Current state (verified):** users can favorite shop products (`favoriteTeas`, localStorage-only) and journal tastings (`customer_tasting_journal`, server-synced). Neither records **owned stock with a quantity**. There is no personal-inventory primitive today.

**Build:**
1. Decide the storage shape. Two honest options — pick and document:
   - **(a) Reuse the spine:** a personal collection is `product_listings`-style rows with `owner_user_id` = the user, no `account_id` (or a sentinel personal scope), private flag on, not for sale. Maximises "one spine" but means the listings/products tables must tolerate location-less rows — check every query that assumes `account_id NOT NULL`.
   - **(b) A dedicated `personal_inventory` table** owned by `user_id` that can later be "promoted" into a location listing. Cleaner isolation, but a second store to bridge in step 5.
   - Recommendation leans (a) to honour "one spine", but (b) may be safer given how many queries assume account-scoped products. Survey before committing.
2. Customer UI: in `AccountPanel`, a "my collection" surface where a user adds tea they own with a quantity (grams), kept private, synced to their account (not localStorage — favorites' localStorage-only limitation is a known gap).
3. Private by default: nothing here appears in any shop or any location until step 5's permission flips it.

**Done when:** a logged-in user can add tea they own with a quantity, kept private and synced to their account, visible to no one else.

**Stay in scope:** no selling here. Selling is step 5.

---

## Step 5 — Standalone public shelf  _(agent-runnable · deep)_

**Goal:** a person NOT on any location's team makes their own collection public at their own link (e.g. `/t/<slug>`), with Adrian's permission. The top of the spine.

**Build:**
1. Permission: a platform-owner-granted flag that lets a specific user publish their personal collection (from step 4) as a public page. Private-by-default still holds — public requires this grant.
2. A public route + page rendering that user's shown personal-collection items. Model it on the existing per-location storefront (`/store/:slug`, `Storefront.tsx`) but scoped to a user, not an account.
3. Checkout = the same WhatsApp direct-order model every Teajia order uses. The buyer deals with the seller directly. **Teajia does not take the order or hold the money** — no platform checkout, no payout, no split. This is the rule that keeps it out of marketplace territory.
4. The seller fulfills and is paid themselves. No location owner stands behind the order, by design.

**Done when:** Adrian can grant a user permission to publish their collection at their own page, and a visitor can reach it and start a direct (WhatsApp) order with that seller.

**Stay in scope:** no Teajia-held payments, no payout engine, no marketplace order pipeline. If that's ever wanted it's a separate, deliberate project (the deferred marketplace).

---

## Order of operations & seams

- **2 → 3 → 4 → 5.** Each depends on the prior. 2 and 3 both lean on step 1's owner column. 4 establishes the private floor that 5 publishes. Don't start 5 before 4.
- Each step is its own branch + PR, lint clean (`npm run lint` root + `cd worker && npx tsc --noEmit`, both must hit exit 0), `npm run lint:colors` before commit, no new TS errors over the ~92 pre-existing ones.
- Run `npm run test:mobile` for any step that touches `AccountPanel`, `src/pages`, or routing (steps 4 and 5 will).
- Every new migration is the single source of its columns — never edit an applied migration to add a column (see the step-1 discipline note above).
- When a step ships, move its TODO line to `todo/archive.md` and update this file's status.

## Open decisions a builder will hit (flag to Adrian, don't guess)

- **Step 2:** does a seller's freshly-added stock default to hidden (owner must approve) or visible (owner must hide)? Hidden-by-default is safer for "owner curates" but adds friction.
- **Step 4:** storage shape (a) reuse the spine vs (b) dedicated table — survey the account-scoping assumptions before deciding.
- **Step 5:** what the public slug looks like (`/t/<name>`?) and whether a standalone seller needs any profile page beyond the shelf.
