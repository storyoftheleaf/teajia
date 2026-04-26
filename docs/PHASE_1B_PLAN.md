# Phase 1B — Tea Profiles, Carry-from-Network, Editorial Suggestions, Wholesale

> **SUPERSEDED 2026-04-26.** This plan has been merged with the Members & Access brief into a single source of truth at **[docs/NETWORK_ROLLOUT_PLAN.md](./NETWORK_ROLLOUT_PLAN.md)**. Read that instead. This document is preserved as historical reference for the design conversation that led to the merge.

*Reference: VISION.md (lineage principle), MULTI_STORE_PLAN.md (Phase 1A foundation). Read both first.*

---

## What this phase delivers

The shift from "every store keeps its own product rows in isolation" to "stores carry listings against shared canonical tea profiles, with editorial governance and wholesale flow." After this phase, the Australia owner can carry teas from Adrian's catalog, sell them in AUD with her own store notes, propose canonical edits, and order stock through a real wholesale transaction.

## The mental model

Three layers, cleanly separated:

```
TEA PROFILE (canonical content, owned by an account, usually Adrian)
    ↓ referenced by
LISTING (per-account: stock, price, currency, store note override, listing photos)
    ↓ tasted via
TASTING JOURNAL (per-user-per-account, never crosses)
```

Two cross-cutting flows on top:

- **Edit suggestions** — partners propose canonical changes; Adrian (or any profile owner) ratifies per field
- **Wholesale orders** — supplier account ships stock to buyer account, real invoice on both sides

## Locked decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | Catalog browse shows retail + her wholesale price; never sourcing/vendor/contacts | Transparency without leaking IP |
| 2 | Archiving a profile keeps partner listings working; partner gets a notification | Her stock is real even if yours is gone |
| 3 | Suggestions are bundles with per-field accept/reject (Option C) | Coherent writing, surgical review |
| 4 | Carrying copies canonical photos to listing; she adds her own (shown first), removes canonical individually | Real shops have their own packaging shots |
| 5 | Profiles are tea-only. Teaware/samples/events stay account-scoped. Cross-store discovery fallback added | Scope discipline |
| 6 | Partner creates own profiles for unique teas; Adrian can transfer ownership later to canonicalize | Avoids a "propose new profile" workflow |
| 7 | Wholesale pricing = profile-level `wholesale_margin_pct` default + optional per-partner `margin_pct_override`. Always percentages, never absolute prices. | Pegging to retail means one re-price cascades |
| 8 | Jesse's onboarding (Australia owner) waits until 1B ships | No throwaway data entry |
| 9 | URL structure stays `teajia.com/store/:slug` for now | `teajia.com/:slug` deferred (small follow-up, needs reserved-word list) |
| 10 | Profile ownership = `originated_by_account_id` (immutable lineage) + `curated_by_account_id` (transferable stewardship). Originator can resume curation at any time. | Matches VISION.md lineage principle; keeps IP attribution permanent even when active stewardship moves |
| 11 | Carry-from-network and add-own-tea are coequal entry points. UX gives neither pride of place; either can hold the inventory. | Jesse's mix is unknown; cross-pollination is bidirectional |
| 12 | Cross-pollination always routes through Teajia (Adrian's account) as the hub. Tea found by partner A flows A → Teajia → partner B, never A → B directly. | Adrian remains canonical curator and gate; preserves editorial control over the network catalog |
| 13 | Listings have a soft-delete path (Jesse can stop carrying a tea), independent of profile archive | Carrying is a relationship, not a permanent attachment |
| 14 | `tea_reviews.profile_id` migration is a named sub-step of Step 1, not a footnote | Load-bearing for cross-store reviews; can't be left to "later" |

## Out of scope for 1B

- Custom domains per store
- Magazine contributor workflow
- Guest portability across the network
- Geo map UI on `/find-a-table`
- Bare-slug URLs (`teajia.com/bali`)

---

## Build sequence

Five steps, each independently shippable. Sarah can start carrying teas after step 2.

### Step 1 — Profiles migration (foundation)

**Goal:** introduce `tea_profiles` and `product_listings` tables; migrate existing `products` into them; preserve all current behavior.

**Migration `worker/migrations/047_tea_profiles.sql`:**

```sql
CREATE TABLE tea_profiles (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  originated_by_account_id TEXT NOT NULL REFERENCES accounts(id),  -- immutable lineage
  curated_by_account_id TEXT NOT NULL REFERENCES accounts(id),     -- transferable stewardship
  name TEXT NOT NULL,
  description TEXT,
  origin TEXT, varietal TEXT, harvest_year INTEGER,
  brewing_notes TEXT,           -- JSON
  flavor_tags TEXT,             -- JSON
  mood_tags TEXT,               -- JSON
  canonical_photos TEXT,        -- JSON array of R2 URLs
  wholesale_margin_pct INTEGER, -- e.g. 40 for "partners pay 40% of retail"
  network_visible INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'published',  -- draft|published|archived
  created_at TEXT, updated_at TEXT
);

CREATE TABLE product_listings (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  profile_id TEXT NOT NULL REFERENCES tea_profiles(id),
  -- existing product fields move here:
  stock_grams REAL, price_amount REAL, price_currency TEXT,
  vendor TEXT, vendor_id TEXT,
  cost_amount REAL, cost_currency TEXT,
  source_compass_entry_id TEXT,
  store_note TEXT,              -- her override prose
  listing_photos TEXT,          -- JSON, shown first if present
  hide_canonical_photos INTEGER NOT NULL DEFAULT 0,
  is_personal INTEGER, is_public INTEGER, sample_available INTEGER,
  status TEXT NOT NULL DEFAULT 'active', -- active|archived (soft-delete: stopped carrying)
  archived_at TEXT, archived_reason TEXT,
  created_at TEXT, updated_at TEXT,
  UNIQUE(account_id, profile_id)
);

CREATE TABLE account_wholesale_overrides (
  profile_id TEXT NOT NULL REFERENCES tea_profiles(id),
  buyer_account_id TEXT NOT NULL REFERENCES accounts(id),
  margin_pct_override INTEGER NOT NULL,
  created_at TEXT,
  PRIMARY KEY (profile_id, buyer_account_id)
);

CREATE INDEX idx_listings_account ON product_listings(account_id);
CREATE INDEX idx_listings_profile ON product_listings(profile_id);
CREATE INDEX idx_profiles_originated ON tea_profiles(originated_by_account_id);
CREATE INDEX idx_profiles_curated ON tea_profiles(curated_by_account_id);
CREATE INDEX idx_profiles_network ON tea_profiles(network_visible, status);
```

**Backfill in same migration:**
- For every existing `products` row: create a `tea_profiles` row with `originated_by_account_id = curated_by_account_id = acc_teajia_bali`, slug derived from current `tea_key` (or generated), copy name/description/origin/etc. Set `wholesale_margin_pct = 40` default.
- Create a `product_listings` row pointing at the new profile, copy stock/price/vendor/cost.
- Keep the old `products` table for one release as a read-only fallback, then drop in a follow-up migration after verification.

**Sub-step 1b — `tea_reviews.profile_id` migration (named, not optional):**
- Add `profile_id` column to `tea_reviews`
- Backfill: for each review, look up the profile by matching `tea_reviews.tea_key` against `tea_profiles.slug` (since slugs were derived from tea_key)
- Verify zero unmatched reviews before proceeding; manually patch any orphans
- Update all review query handlers to filter by `profile_id`; keep `tea_key` column as fallback for one release

**API surface:** internal only this step. Existing endpoints keep working via a compatibility view or in-handler join. No frontend changes.

**Acceptance:** all existing admin views and storefronts render identical data. `npm run lint` clean. `npm run test:mobile` clean.

### Step 2 — Carry-from-network flow

**Goal:** Sarah can browse Adrian's network-visible profiles and create her own listings.

**Endpoints:**
- `GET /api/network/catalog` — returns profiles where `network_visible=1` AND `status='published'` AND owner ≠ caller's active account AND caller doesn't already have a listing. Includes computed `wholesale_price_amount` for the caller (using their override or the profile default), converted to caller's currency via existing exchange rates.
- `POST /api/listings/carry` — body `{ profile_id, initial_price_amount, initial_price_currency, initial_stock_grams }`. Creates listing, copies `canonical_photos` into `listing_photos`, returns the new listing.

**Admin views:**
- New "Carry from network" button in Inventory toolbar (operator+ role only)
- New panel: catalog browser with cards (canonical photo, name, origin, brewing preview, retail at owner's currency, *your* wholesale at your currency + percentage, "Carry this tea" CTA)
- After carry, drop into a focused edit view for stock + price, then return to inventory

**Storefront:** no change yet — listings already render the same way.

**Acceptance:** Sarah can carry a tea, set stock + price, see it on her storefront with canonical content + her photos.

### Step 3 — Store notes + suggestions

**Goal:** Sarah can override canonical with a store note; she can propose canonical edits Adrian reviews per field.

**Schema additions:**

```sql
CREATE TABLE profile_edit_suggestions (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES tea_profiles(id),
  suggested_by_account_id TEXT NOT NULL,
  suggested_by_user_id TEXT NOT NULL,
  rationale TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending|fully_accepted|partially_accepted|rejected|withdrawn
  reviewed_by_user_id TEXT, reviewed_at TEXT,
  created_at TEXT
);

CREATE TABLE profile_edit_suggestion_fields (
  id TEXT PRIMARY KEY,
  suggestion_id TEXT NOT NULL REFERENCES profile_edit_suggestions(id),
  field TEXT NOT NULL,           -- e.g. 'description', 'brewing_notes.temperature_c'
  current_value TEXT,
  proposed_value TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  review_note TEXT
);

CREATE TABLE listing_notifications (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES product_listings(id),
  account_id TEXT NOT NULL,
  kind TEXT NOT NULL,            -- 'canonical_updated' | 'profile_archived' | 'suggestion_accepted'
  payload TEXT,                  -- JSON
  read_at TEXT, created_at TEXT
);
```

**Endpoints:**
- `POST /api/profiles/:id/suggestions` — partner creates a bundle
- `GET /api/profiles/suggestions/incoming` — profile owner's queue
- `POST /api/suggestions/:id/review` — body `{ field_decisions: [{field_id, status, review_note}] }`. Applies accepted fields to canonical, marks bundle status, creates `listing_notifications` for any listing whose store_note overrode an accepted field
- `PUT /api/listings/:id/store-note` — partner sets/clears her override

**Admin views:**
- Sarah: profile detail page gets "Suggest an edit" action; opens modal with field picker + current/proposed + rationale
- Adrian: new `/admin/network` view, "Suggestions" tab, per-field accept/reject UI with diff view
- Notification badge on the network nav item when suggestions or wholesale orders are pending

**Acceptance:** Sarah submits a bundle of 3 field changes; Adrian accepts 2, rejects 1 with a note; canonical updates; Sarah sees the result; any listing with a store_note on an accepted field gets a "your override may now be redundant" notification.

### Step 4 — Wholesale orders

**Goal:** Sarah can order stock from Adrian; transaction debits his listing, credits hers, sets her cost basis.

**Schema:**

```sql
CREATE TABLE wholesale_orders (
  id TEXT PRIMARY KEY,
  supplier_account_id TEXT NOT NULL REFERENCES accounts(id),
  buyer_account_id TEXT NOT NULL REFERENCES accounts(id),
  status TEXT NOT NULL DEFAULT 'draft', -- draft|submitted|confirmed|shipped|received|cancelled
  currency TEXT NOT NULL,
  subtotal_amount REAL, shipping_amount REAL, total_amount REAL,
  shipping_address TEXT, tracking_number TEXT, carrier TEXT,
  notes TEXT,
  invoice_id_supplier TEXT, invoice_id_buyer TEXT,
  created_at TEXT, updated_at TEXT
);

CREATE TABLE wholesale_order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES wholesale_orders(id),
  supplier_listing_id TEXT NOT NULL REFERENCES product_listings(id),
  buyer_listing_id TEXT REFERENCES product_listings(id), -- null until received if she's not yet carrying
  profile_id TEXT NOT NULL REFERENCES tea_profiles(id),
  grams REAL NOT NULL,
  unit_price_amount REAL NOT NULL,    -- snapshot of her wholesale price at order time
  unit_price_currency TEXT NOT NULL,
  line_total REAL NOT NULL
);
```

**Endpoints:**
- `POST /api/wholesale/orders` — buyer creates draft
- `PUT /api/wholesale/orders/:id` — edit draft (items, address)
- `POST /api/wholesale/orders/:id/submit` — locks pricing snapshot, supplier sees it
- `POST /api/wholesale/orders/:id/transition` — body `{ to: 'confirmed'|'shipped'|'received'|'cancelled', tracking?, carrier? }`. On `received`: decrement supplier stock, increment buyer stock, set buyer listing's `cost_amount` to `unit_price × grams + allocated shipping`, generate invoices on both accounts.

**Admin views:**
- Sarah: "Order from supplier" CTA on any listing where the profile owner ≠ her account; cart-style draft builder; submit; status timeline
- Adrian: `/admin/network` "Wholesale" tab; incoming orders; confirm → shipped → mark received; full status history

**Acceptance:** Sarah drafts an order for 200g of Silver Needle, submits; Adrian confirms, ships with tracking, marks received; Sarah's stock goes up, cost basis is set in AUD, both accounts have matching invoices (TJB-XXXX and TJA-XXXX).

### Step 5 — Discovery fallback

**Goal:** when a customer searches Sarah's storefront and finds nothing, surface other stores that carry it.

**Endpoint:** `GET /api/storefront/:slug/search-fallback?q=...` — returns network listings (only `is_public=1`, profile `network_visible=1`) where the local store has none.

**UI:** empty state on storefront search reads "Not in stock at Teajia Australia. Available at Teajia Bali →" with link to that store's listing page. Clear that they're leaving this storefront.

**Acceptance:** searching "shou puerh" on Australia storefront, when Australia carries none, shows a single-line referral to Bali.

---

## Cross-pollination through Teajia (the hub model)

Decision 12: tea discovery flows through Adrian's account, never partner-to-partner directly.

**Concrete example.** Jesse (Australia) finds an excellent oolong from Rayi (a future partner account). Jesse wants to carry it. The flow:

1. Rayi's profile for that oolong has `network_visible=1` and is owned by Rayi (`originated_by = curated_by = acc_rayi`)
2. Jesse cannot carry it directly. The "Carry from network" catalog Jesse sees only surfaces profiles where `curated_by_account_id = acc_teajia_bali` (Adrian's account)
3. Jesse can flag the Rayi profile with "Suggest for Teajia network" — this notifies Adrian
4. Adrian reviews, optionally tastes, and either:
   - **Adopts:** transfers `curated_by_account_id` to `acc_teajia_bali`. Lineage (`originated_by_account_id = acc_rayi`) is preserved permanently. The profile now appears in everyone's catalog browse.
   - **Declines:** profile stays Rayi-curated, only Rayi can sell it.
5. Once adopted, Jesse can carry it through the normal flow. Rayi keeps her listing as the originator.

**Why route through Adrian:** preserves canonical curation gate, prevents network from fragmenting into partner-to-partner micro-supply chains, keeps editorial standards consistent. Costs Adrian a review step on every cross-pollination, but that's the job.

**Endpoint:** `POST /api/network/profiles/:id/suggest-for-network` — partner flags a profile for adoption. Adrian sees these in the `/admin/network` "Adoption queue" tab alongside suggestions and wholesale orders.

## Members & Access — sequenced first

Decision: the Members & Access brief (`docs/MEMBERS_AND_ACCESS_BRIEF.md`) and Phase 1B are one rollout, not two. Members & Access ships **before Step 1**.

**Why:** Phase 1B introduces new actions (carry, suggest, place wholesale order, transfer curation, adopt-to-network) that need bundle-aware authorization. Building 1B on the current ad-hoc role checks would mean rewriting every new endpoint when the bundle system arrives. Sequencing M&A first means every 1B endpoint authorizes against bundles natively.

**Order:**

```
Step 0 — Members & Access (per MEMBERS_AND_ACCESS_BRIEF.md)
Step 1 — Profiles migration + tea_reviews backfill
Step 2 — Carry-from-network
Step 3 — Store notes + suggestions (per-field accept/reject)
Step 4 — Wholesale orders
Step 5 — Discovery fallback
Step 6 — Cross-pollination adoption queue
```

**Bundle implications for 1B actions:**
- Carry a tea: requires `Catalog` bundle on the carrying account
- Set price / margin override: requires `Sell`
- Adjust listing stock: requires `Stock`
- Suggest a canonical edit: requires `Catalog` (on the suggesting account)
- Review incoming suggestions: requires `Catalog` on the curating account
- Place wholesale order: requires `Sell`
- Confirm/ship wholesale order: requires `Sell` on the supplier account
- Adopt a partner profile to network (Adrian only): Platform tier
- Transfer curation: Platform tier

## Australia onboarding checklist (refreshed)

Owner: Jesse. After Step 6 ships:

- [ ] Provision Jesse's user; add as Location Owner of `acc_teajia_australia` (granted via Members & Access); send claim link
- [ ] Jesse claims invite, logs in, lands on AccountPanel (Operator role) with empty inventory
- [ ] Jesse updates account profile: logo, tagline, WhatsApp, contact email, cover image
- [ ] Jesse opens "Carry from network" — carries an initial set of teas from Adrian's catalog
- [ ] Jesse adds at least one of her own teas (testing the originate-then-curate path)
- [ ] Jesse places her first wholesale order with Adrian; receives stock; verifies cost basis in AUD
- [ ] Jesse adds her own packaging photos to 2–3 listings; verifies storefront ordering
- [ ] Jesse submits her first edit suggestion (likely a brewing tweak from her tasting); Adrian reviews
- [ ] Jesse invites first staff member via Members & Access
- [ ] Jesse creates her first event
- [ ] Storefront verified visually at `teajia.com/store/teajia-australia`
- [ ] First end-to-end customer sale through Australia storefront

---

## Future considerations (deferred from 1B)

Captured here so they don't get lost. Revisit after 1B is in production.

- **Conditional wholesale margin overrides** — e.g. "Jesse pays 40% but only on teas under $X retail." Likely YAGNI, but flag if relationship pricing diverges.
- **Suggestion review SLA + batching** — when 5+ partners are sending suggestions, Adrian's queue becomes a job. Possible: per-partner trust scoring with auto-accept threshold; weekly digest review mode.
- **Bare-slug URLs** (`teajia.com/bali`) — small routing change but needs reserved-word list to prevent collision with `/shop`, `/learn`, `/admin` etc.
- **Drop the legacy `products` table** — after one release of read-only fallback, retire the table and its compatibility joins.
- **Drop `tea_reviews.tea_key`** — after `profile_id` is verified live for one release.
- **Adoption queue UI polish** — first version is a list. If volume grows, add filters by suggesting partner, by region, by varietal.
- **Wholesale repeat orders** — "reorder this same set" shortcut for partners restocking.
- **Wholesale partial fulfillment** — supplier ships 150g of a 200g order, marks the rest as backordered. Currently order is atomic.
- **Cross-store sample swaps** — Jesse sends Adrian a sample from her own profile; not a wholesale order, but tracked.

## Risks and open questions

- **Backfill correctness.** Step 1 migration is the highest-risk change in the codebase. Plan: snapshot D1, run on a clone first, diff every product before/after, only then run on prod.
- **Photo storage.** Carrying duplicates R2 references, not bytes (we copy the URL list, not re-upload). Confirmed cheap; revisit if storage costs spike.
- **Curation transfer audit.** Every transfer of `curated_by_account_id` (including originator resuming curation) writes to `platform_audit_log` with the prior curator, new curator, and reason. Lineage (`originated_by`) is immutable so doesn't need audit.
- **Adoption queue volume.** If many partners flag many profiles, Adrian's adoption queue could swamp him. Mitigation: queue is review-on-his-time, not blocking; partners can sell to their own customers immediately, only network-wide sale waits on adoption.

---

## Key files (for reference during build)

| File | Role in 1B |
|---|---|
| `worker/migrations/047_tea_profiles.sql` | Step 1 schema + backfill |
| `worker/migrations/048_suggestions.sql` | Step 3 schema |
| `worker/migrations/049_wholesale.sql` | Step 4 schema |
| `worker/src/index.ts` | All new endpoints; existing handlers refactored to join listing→profile |
| `src/lib/api.ts` | New `api.network.*`, `api.wholesale.*`, `api.suggestions.*` |
| `src/types.ts` | `TeaProfile`, `ProductListing`, `EditSuggestion`, `WholesaleOrder` |
| `src/admin/views/InventoryView.tsx` | "Carry from network" button + panel |
| `src/admin/views/NetworkView.tsx` (new) | Profiles / Suggestions / Wholesale tabs |
| `src/admin/views/ProfileEditPanel.tsx` (new) | Canonical content editor (owner only) |
| `src/components/storefront/Storefront.tsx` | Discovery fallback empty state |
