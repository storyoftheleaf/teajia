# Network Rollout Plan

*Single source of truth for the next major Teajia phase. Combines Members & Access (formerly its own brief) with the catalog/wholesale/cross-pollination work (formerly Phase 1B). Read VISION.md and MULTI_STORE_PLAN.md first.*

*Supersedes: docs/_archive/MEMBERS_AND_ACCESS_BRIEF.md and docs/_archive/PHASE_1B_PLAN.md.*

---

## What this rollout delivers

The shift from "Adrian's solo Bali shop with a placeholder Australia account" to "a coherent network of tea houses and Tea Masters, with shared canonical tea content, editorial governance, real wholesale flow between accounts, and a clean access model that makes who-can-do-what obvious."

After this rollout:

- Adrian holds Platform tier (Owner). Other people are Location Owners, Tea Masters, or Members under a Location.
- Capabilities are granted via six named bundles (Catalog, Stock, Publish, Gather, Sell, Members). Bundles are the only authorization unit. The hardcoded `ai_wisdom` permission is gone.
- Tea content is canonical (one `tea_profile` per tea), with lineage (originator) and stewardship (curator) tracked separately. Listings are per-account references to a profile.
- Partners (Locations and Tea Masters) carry teas from the network catalog. They sell in their own currency, with their own retail price, store note, and photos.
- Partners propose canonical edits to Adrian as suggestion bundles with per-field review.
- Wholesale orders are real cross-account transactions: stock decrements on supplier, increments on buyer, invoices on both, cost basis set automatically.
- Cross-pollination (a partner finds a tea worth network-wide) routes through Adrian's adoption queue. Network-wide canonicality stays gated.
- Customers searching a storefront for a tea it doesn't carry are pointed to the nearest network store that does.
- Jesse (Australia) onboards onto the finished system as the first non-Adrian Location Owner.

## Mental model

Three layers, cleanly separated:

```
TEA PROFILE  (canonical content; originated_by + curated_by; usually Adrian-curated)
    ↓ referenced by
LISTING       (per-account: stock, price, currency, store note, listing photos, soft-deletable)
    ↓ tasted via
TASTING JOURNAL  (per-user-per-account; never crosses accounts)
```

Plus three cross-cutting flows:

- **Edit suggestions** — partners propose canonical changes; curator ratifies per-field
- **Wholesale orders** — supplier ships stock to buyer; real bilateral invoicing
- **Cross-pollination adoption** — partner flags a profile for network adoption; Adrian decides; on adoption, `curated_by` transfers to Teajia, `originated_by` stays permanent

Authorization for every action above is bundle-checked. The bundles are defined in Step 0 (Members & Access) and used by every step thereafter.

---

## Locked decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | Catalog browse shows retail + buyer's effective wholesale price; never sourcing/vendor/contacts | Transparency without leaking IP |
| 2 | Archiving a profile keeps partner listings working; partner gets a notification | Stock is real even if curator's is gone |
| 3 | Suggestions are bundles with per-field accept/reject | Coherent writing, surgical review |
| 4 | Carrying copies canonical photos to listing; partner adds her own (shown first), removes canonical individually | Real shops have their own packaging shots |
| 5 | Profiles are tea-only. Teaware/samples/events stay account-scoped. | Scope discipline |
| 6 | Partner creates own profiles for unique teas; cross-pollination adoption queue handles network promotion | Avoids ad-hoc "propose new profile" workflow |
| 7 | Wholesale pricing = percentages only. Resolution: per-partner override → per-profile margin → trust-tier default → global default. Profile-level can be overridden per-partner. | Pegging to retail means one re-price cascades; tier defaults make onboarding new partners zero-config |
| 8 | Jesse's onboarding waits until rollout ships | No throwaway data entry |
| 9 | URL structure stays `teajia.com/store/:slug` | `teajia.com/:slug` deferred (small follow-up, needs reserved-word list) |
| 10 | Profile ownership = `originated_by_account_id` (immutable lineage) + `curated_by_account_id` (transferable stewardship). Originator can resume curation at any time. | Matches VISION.md lineage principle; permanent IP attribution |
| 11 | Carry-from-network and add-own-tea are coequal entry points | Sourcing mix per partner is unknown; cross-pollination is bidirectional |
| 12 | Cross-pollination always routes through Teajia. Partner A → Teajia → Partner B, never A → B direct. | Adrian remains canonical gate; consistent editorial standards |
| 13 | Listings have soft-delete (stop carrying), independent of profile archive | Carrying is a relationship, not a permanent attachment |
| 14 | `tea_reviews.profile_id` migration is a named sub-step of Step 1 | Load-bearing for cross-store reviews |
| 23 | Tea profiles do NOT hold brewing parameters (temperature, leaf ratio, infusion count, vessel, time). Brewing instruction lives in the Learn / training content, not on the tea card. | Brewing is contextual (drinker, water, vessel) — not canonical. Removing it from profiles also keeps suggestions focused on real canonical content (name, description, flavor, origin) rather than ratifying contextual brewing tweaks network-wide. |
| 15 | Tea Master = `accounts.kind`. Operationally identical to Location Owner (carry, sell, gather, hold stock, place wholesale orders). Differs only in: no physical address required, distinct trust-tier default margin, distinct storefront presentation (more practitioner, less commercial). | "Tea Master works like a Location" per Adrian. Avoids parallel code paths. |
| 16 | Tea Master defaults match Location Owner bundles (Catalog · Stock · Publish · Gather · Sell · Members on own account). Adrian can tighten per Tea Master. | Coequal capability with Location, gated by trust |
| 17 | Trust tier visible to its holder in their own settings (not just Adrian's view). E.g. "Trust tier: verified · 45% wholesale." | Honest pricing; avoids "why did my margin change" mystery |
| 18 | Member-tier authorization for new actions: carry / suggest = Catalog bundle; place wholesale order = Sell; configure margin override = Owner-only by default, Owner can grant a "Pricing" sub-permission to a Member if needed (deferred to Future Considerations) | Owner controls financial relationships; staff handle catalog mechanics |
| 19 | Tea Master economics = Scenario A (holds own stock, resells to followers, fulfills locally). Affiliate model (Scenario B) deferred to future phase. | A is supported by existing data model; B requires new fulfillment infra |
| 20 | Pricing-discipline UI: when a partner sets retail below Teajia canonical retail (after FX), admin shows a soft warning. Not blocked. | Mitigates double-listing customer confusion without removing partner autonomy |
| 21 | Two destinations, not one merged: `/admin/access` (Members & Access) and `/admin/network` (catalog, suggestions, wholesale, adoption) | Different mental models; merging into tabs would be worse |
| 22 | UI design pass front-loaded as Step 0.5, before any 1B build steps | Front-loads creative decisions; produces shared design vocabulary across all new screens |

## Out of scope for this rollout

- Custom domains per store
- Magazine contributor workflow
- Guest portability across the network
- Geo map UI on `/find-a-table`
- Bare-slug URLs (`teajia.com/bali`)
- Affiliate fulfillment model for Tea Masters (Scenario B above)
- Member-level "Pricing" sub-permission (Owner-only for now)

---

## Build sequence

Eight steps, each independently shippable. Sequence matters: bundles must exist before steps that use them; profiles must exist before steps that reference them.

### Step 0 — Members & Access

**Goal:** install the tier model, the bundle system, the application queue, the audit log, and the two-register destination at `/admin/access`. Replace today's scattered surfaces (Team tab, Platform Admin under Teach, hardcoded `ai_wisdom`).

**Tier model.** Five tiers + Guest:

| Tier | Has location? | Scope |
|---|---|---|
| Platform Owner | Adrian | Everything, every account |
| Platform Admin | Optional | Everything except revoke Platform Owner |
| Location Owner | Yes | One account |
| Tea Master | Yes (their own home) | One account, no physical address required |
| Member | Inherits location | Subset of Location bundles |
| Guest | No | Read-only public + own orders/tastings |

**Bundles.** Catalog · Stock · Publish · Gather · Sell · Members. Granted per Member by their Location/Master Owner.

**Defaults:**
- Platform Owner / Admin: all bundles on every account + meta "Platform" bundle
- Location Owner / Tea Master: all six bundles on own account; Members bundle locked-on
- Member: empty; Owner grants per person
- Guest: none

**Schema migrations (`worker/migrations/050_members_access.sql`):**

```sql
ALTER TABLE accounts ADD COLUMN kind TEXT NOT NULL DEFAULT 'location';
-- 'platform' | 'location' | 'master'
ALTER TABLE accounts ADD COLUMN trust_tier TEXT NOT NULL DEFAULT 'basic';
-- 'basic' | 'verified' | 'partner' (renaming deferred per brief §13.7)
ALTER TABLE accounts ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
-- 'active' | 'suspended'

UPDATE accounts SET kind = 'platform' WHERE id = 'acc_teajia_bali';
UPDATE accounts SET kind = 'location' WHERE id = 'acc_teajia_australia';

ALTER TABLE account_members ADD COLUMN permissions TEXT;
-- JSON: { bundles: ['catalog','stock',...] }
-- Backfill: owner role → all six bundles; manager → all except 'members'; staff → catalog+stock+sell; viewer → empty

CREATE TABLE account_applications (
  id TEXT PRIMARY KEY,
  applicant_email TEXT NOT NULL,
  applicant_name TEXT,
  proposed_account_kind TEXT NOT NULL, -- 'location' | 'master'
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending|approved|declined|withdrawn
  decided_by_user_id TEXT,
  decided_at TEXT,
  decision_note TEXT,
  created_at TEXT
);

-- Audit log already exists as platform_audit_log; extend events:
-- 'member.bundle_granted', 'member.bundle_revoked', 'platform.acted_in_account',
-- 'application.approved', 'application.declined', 'tea_master.invited',
-- 'account.suspended', 'account.reactivated'
```

**Endpoints:**

- `GET /api/accounts/:id/access` — roster + bundles per member (Owner + above)
- `PUT /api/accounts/:id/members/:userId/bundles` — `{ bundles: string[] }` (Owner)
- `POST /api/accounts/:id/members` — invite (Owner)
- `DELETE /api/accounts/:id/members/:userId` — remove (Owner)
- `POST /api/accounts/:id/transfer-ownership` — `{ to_user_id }` (Owner)
- `GET /api/platform/applications` — pending queue (Platform tier)
- `POST /api/platform/applications/:id/decide` — `{ decision, trust_tier?, note? }` (Platform tier)
- `POST /api/platform/tea-masters/invite` — `{ email, name?, note? }` (Platform tier)
- `POST /api/platform/accounts/:id/upgrade-to-location` — Tea Master → Location (Platform tier)
- `POST /api/platform/accounts/:id/suspend` / `reactivate` (Platform tier)
- `GET /api/platform/audit-log?account_id=...` — filtered audit (Platform tier)

**Authorization layer:** introduce `requireBundle(bundle: string)` middleware in `worker/src/index.ts`. Every existing handler that today checks `role === 'owner'` or similar gets refactored to `requireBundle('members')` etc. This is the foundation every later step builds on.

**Admin views:**

- `/admin/access` — Location Owner view (roster grouped by tier, editor sheet per member, footer text-link "Add a member")
- `/admin/access/platform` — Platform tier view (counts at top: Locations · Masters · Pending; roster by kind; tap account → sub-frame with that account's roster; hidden Platform tab)
- Bench tile rename: "Team" → "Team & Access" (Owners) / "Platform & Access" (Platform tier)

**Design direction.** Per existing brief §6: pro register, dense, editorial. Bundles as comma-separated capability words underneath name. Wine-list rhythm. No avatars-in-circles, no role-as-pill. Tier conveyed by typography and grouping. Editor sheet is right-side drawer (desktop) / full sheet (mobile). Bronze tone for active bundles. Audit log entries read like diary entries.

**Acceptance:**
- All current authorization checks pass through bundle middleware
- Adrian can invite Jesse as Tea Master via Platform tab; Jesse claims invite; appears in Masters section
- Jesse can grant a Member bundles, edit them, remove them
- Suspending an account blocks all writes from members of that account
- Audit log captures every grant, revoke, invite, approval, suspension
- Hardcoded `ai_wisdom` permission removed everywhere

### Step 0.5 — UI Design Pass for Network Surfaces

**Goal:** produce `docs/NETWORK_UI_BRIEF.md` covering every new screen Steps 1–6 will introduce, anchored in the M&A brief's design direction so all new surfaces share a vocabulary.

**Surfaces to design:**

1. **Catalog browse** ("Carry from network") — grid of profiles, each card showing canonical photo, name, origin, brewing preview, retail (in curator's currency), buyer's effective wholesale (in buyer's currency), trust-tier-aware margin %, "Carry this tea" CTA. Filterable by origin, type, harvest year. Excludes already-carried.
2. **Listing edit page** — split-view of canonical content (read-only with "Sourced from Teajia" line) + override panel (store note, listing photos, hide-canonical-photos toggle). Listing-specific: stock, price, currency.
3. **Suggestion compose** — rationale field at top, then field-picker that shows current canonical value + proposed value side-by-side. Add up to N field changes per bundle. Submit creates the bundle.
4. **Suggestion review (curator side)** — bundle header with rationale + suggester attribution; per-field accept/reject with diff view; per-field review note; "Apply accepted fields" commits.
5. **Wholesale order draft** — cart-style builder. Per-line: profile from supplier's catalog, grams, unit price snapshot (computed from buyer's effective margin), line total. Shipping address, supplier-side notes. Submit locks pricing snapshot.
6. **Wholesale order timeline** — both supplier and buyer views. Status chevron: draft → submitted → confirmed → shipped → received. Tracking number, carrier, supplier notes. Invoice references.
7. **Adoption queue (Adrian)** — partner-flagged profiles awaiting network adoption. Per-row: profile preview, originator attribution, partner's note, "Adopt to network" / "Decline" actions. Adopt transfers `curated_by` to Teajia.
8. **Discovery fallback empty state** — storefront search with zero local results. "Not in stock at Teajia Australia. Available at Teajia Bali →" single-line referral.
9. **Tea Master storefront** — distinct presentation from Location storefront. More practitioner / less commercial. Personal tasting notes featured. (Detailed direction comes from this step.)
10. **Trust tier display** — partner's settings show their tier + effective margin discreetly. Single line, not a badge.
11. **Pricing-discipline warning** — soft warning shown when partner sets retail below canonical (after FX). Body type, no red alert box.

**Process.** Run `/impeccable craft` per surface, batched in 2-3 sessions to maintain coherence. Each session produces design notes + a reference component or two. Outputs accumulate in `docs/NETWORK_UI_BRIEF.md`.

**Acceptance.** Every surface above has: (a) design direction prose, (b) layout strategy, (c) key states, (d) interaction model, (e) content requirements, in the same depth as the M&A brief. Steps 1–6 build against this doc; no later step needs to reinvent visual approach.

### Step 1 — Profiles migration + tea_reviews backfill

**Goal:** introduce `tea_profiles` and `product_listings`; migrate existing `products` into them; migrate `tea_reviews.tea_key` to `tea_reviews.profile_id`. Preserve all current behavior.

**Migration `worker/migrations/051_tea_profiles.sql`:**

```sql
CREATE TABLE tea_profiles (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  originated_by_account_id TEXT NOT NULL REFERENCES accounts(id), -- immutable
  curated_by_account_id TEXT NOT NULL REFERENCES accounts(id),    -- transferable
  name TEXT NOT NULL,
  description TEXT,
  origin TEXT, varietal TEXT, harvest_year INTEGER,
  flavor_tags TEXT,             -- JSON
  mood_tags TEXT,               -- JSON
  canonical_photos TEXT,        -- JSON
  wholesale_margin_pct INTEGER, -- profile-level override
  network_visible INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'published', -- draft|published|archived
  created_at TEXT, updated_at TEXT
);

CREATE TABLE product_listings (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  profile_id TEXT NOT NULL REFERENCES tea_profiles(id),
  stock_grams REAL, price_amount REAL, price_currency TEXT,
  vendor TEXT, vendor_id TEXT,
  cost_amount REAL, cost_currency TEXT,
  source_compass_entry_id TEXT,
  store_note TEXT,
  listing_photos TEXT,          -- JSON, shown first if present
  hide_canonical_photos INTEGER NOT NULL DEFAULT 0,
  is_personal INTEGER, is_public INTEGER, sample_available INTEGER,
  status TEXT NOT NULL DEFAULT 'active', -- active|archived
  archived_at TEXT, archived_reason TEXT,
  created_at TEXT, updated_at TEXT,
  UNIQUE(account_id, profile_id)
);

CREATE TABLE wholesale_margin_defaults (
  trust_tier TEXT PRIMARY KEY, -- 'basic' | 'verified' | 'partner' | 'tea_master'
  default_margin_pct INTEGER NOT NULL,
  updated_at TEXT
);
INSERT INTO wholesale_margin_defaults VALUES
  ('basic', 50, datetime('now')),
  ('verified', 45, datetime('now')),
  ('partner', 40, datetime('now')),
  ('tea_master', 48, datetime('now'));

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

**Backfill (in same migration):**
- For every existing `products` row: create `tea_profiles` with `originated_by_account_id = curated_by_account_id = acc_teajia_bali`, slug from `tea_key` (or generated).
- Create `product_listings` row pointing at the new profile.
- Old `products` table kept read-only for one release.

**Sub-step 1b — `tea_reviews.profile_id`:**
- Add `profile_id` column.
- Backfill: match `tea_reviews.tea_key` → `tea_profiles.slug`.
- Verify zero unmatched; manually patch orphans.
- Update review query handlers to filter by `profile_id`; keep `tea_key` as fallback for one release.

**Authorization:** profile edits require `Catalog` bundle on the curator account.

**Acceptance:** all existing admin views and storefronts render identical data. Lint clean. `npm run test:mobile` clean. Backfill verified by row-count diff before/after.

### Step 2 — Carry-from-network

**Goal:** partner browses Adrian's network-visible profiles and creates her own listings.

**Pricing resolution helper:**

```
effectiveMargin(profile, buyer) =
    account_wholesale_overrides[profile.id, buyer.id]
 ?? profile.wholesale_margin_pct
 ?? wholesale_margin_defaults[buyer.trust_tier]
 ?? 50
```

**Endpoints:**

- `GET /api/network/catalog` — profiles where `network_visible=1` AND `status='published'` AND `curated_by != caller_account` AND caller has no listing yet. Returns canonical fields + computed buyer's wholesale (in buyer's currency via existing exchange rates) + tier-aware margin %. Requires `Catalog` bundle on caller account.
- `POST /api/listings/carry` — `{ profile_id, initial_price_amount, initial_price_currency, initial_stock_grams }`. Creates listing, copies `canonical_photos` into `listing_photos`. Requires `Catalog`.
- `PUT /api/listings/:id` — edit listing (price, stock, store note, photos). `Catalog` for content; `Stock` for stock; `Sell` for price.
- `POST /api/listings/:id/archive` — `{ reason? }`. Soft-delete (stop carrying). `Catalog`.

**Admin views (built per Step 0.5 brief):** "Carry from network" button in Inventory toolbar. Catalog browse panel. Post-carry focused edit view for stock + price.

**Acceptance:** partner carries a tea, sets stock + price, sees it on her storefront with canonical content + her photos.

### Step 3 — Store notes + suggestions

**Goal:** partner overrides canonical with a store note; partner proposes canonical edits with per-field review.

**Schema (`worker/migrations/052_suggestions.sql`):**

```sql
CREATE TABLE profile_edit_suggestions (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES tea_profiles(id),
  suggested_by_account_id TEXT NOT NULL,
  suggested_by_user_id TEXT NOT NULL,
  rationale TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  -- pending | fully_accepted | partially_accepted | rejected | withdrawn
  reviewed_by_user_id TEXT, reviewed_at TEXT,
  created_at TEXT
);

CREATE TABLE profile_edit_suggestion_fields (
  id TEXT PRIMARY KEY,
  suggestion_id TEXT NOT NULL REFERENCES profile_edit_suggestions(id),
  field TEXT NOT NULL, -- e.g. 'description', 'brewing_notes.temperature_c'
  current_value TEXT,
  proposed_value TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending|accepted|rejected
  review_note TEXT
);

CREATE TABLE listing_notifications (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES product_listings(id),
  account_id TEXT NOT NULL,
  kind TEXT NOT NULL, -- 'canonical_updated' | 'profile_archived' | 'suggestion_accepted'
  payload TEXT,
  read_at TEXT, created_at TEXT
);
```

**Endpoints:**

- `POST /api/profiles/:id/suggestions` — partner creates bundle (`Catalog` on suggester)
- `GET /api/profiles/suggestions/incoming` — curator's queue (`Catalog` on curator)
- `POST /api/suggestions/:id/review` — `{ field_decisions: [{field_id, status, review_note}] }`. Applies accepted fields to canonical; updates bundle status; creates listing notifications for any listing whose store_note overrode an accepted field.
- `PUT /api/listings/:id/store-note` — partner sets/clears override (`Catalog`)

**Admin views (per UI brief):** profile detail page gets "Suggest an edit"; new "Suggestions" tab in `/admin/network` for curators; notification badge on network nav item.

**Acceptance:** partner submits 3-field bundle; curator accepts 2, rejects 1 with note; canonical updates; partners with stale store_note overrides on accepted fields get notification.

### Step 4 — Wholesale orders

**Goal:** partner orders stock from supplier (typically Adrian); transaction debits supplier listing, credits buyer listing, sets cost basis, generates bilateral invoices.

**Schema (`worker/migrations/053_wholesale.sql`):**

```sql
CREATE TABLE wholesale_orders (
  id TEXT PRIMARY KEY,
  supplier_account_id TEXT NOT NULL REFERENCES accounts(id),
  buyer_account_id TEXT NOT NULL REFERENCES accounts(id),
  status TEXT NOT NULL DEFAULT 'draft',
  -- draft|submitted|confirmed|shipped|received|cancelled
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
  buyer_listing_id TEXT REFERENCES product_listings(id), -- null until received
  profile_id TEXT NOT NULL REFERENCES tea_profiles(id),
  grams REAL NOT NULL,
  unit_price_amount REAL NOT NULL, -- snapshot at order time
  unit_price_currency TEXT NOT NULL,
  line_total REAL NOT NULL
);
```

**Endpoints:**

- `POST /api/wholesale/orders` — buyer creates draft (`Sell`)
- `PUT /api/wholesale/orders/:id` — edit draft
- `POST /api/wholesale/orders/:id/submit` — locks pricing snapshot
- `POST /api/wholesale/orders/:id/transition` — `{ to, tracking?, carrier? }`. On `received`: decrement supplier stock, increment buyer stock, set buyer listing cost basis (unit price × grams + allocated shipping), generate invoices on both accounts.

**Pricing-discipline check (Decision 20):** when listing edit `PUT` arrives with `price_amount`, server compares against canonical retail (after FX). If lower, includes a `warnings: ['below_canonical_retail']` field in the response. UI surfaces as soft warning.

**Acceptance:** partner drafts 200g order; supplier confirms, ships with tracking, marks received; buyer stock goes up, cost basis set in buyer's currency, both accounts have matching invoices.

### Step 5 — Discovery fallback

**Goal:** customer search with zero local results surfaces nearest network store carrying it.

**Endpoint:** `GET /api/storefront/:slug/search-fallback?q=...` — returns network listings (only `is_public=1`, profile `network_visible=1`) where local store has none.

**UI:** storefront empty state per UI brief. Single-line referral.

**Acceptance:** searching "shou puerh" on Australia storefront with zero local results shows referral to Bali.

### Step 6 — Cross-pollination adoption queue

**Goal:** partner flags a profile they originated for Adrian to consider adopting network-wide.

**Endpoint:** `POST /api/network/profiles/:id/suggest-for-network` — partner flags own profile (`Catalog`). Adrian sees in `/admin/network` → "Adoption queue" tab.

**Adoption action:** `POST /api/network/profiles/:id/adopt` — Platform tier only. Transfers `curated_by_account_id` to `acc_teajia_bali`. Writes audit log entry. `originated_by_account_id` unchanged.

**Acceptance:** Tea Master flags her tea; Adrian adopts; profile appears in Jesse's catalog browse with Tea Master's name as originator.

---

## Authorization matrix

Every action below is bundle-checked. Owner-only means the action requires the actor to be tier `owner` (not just have a bundle).

| Action | Required bundle | Notes |
|---|---|---|
| Carry a tea from network | Catalog | On carrying account |
| Edit listing content (store note, photos, hide canonical) | Catalog | On listing's account |
| Edit listing stock | Stock | On listing's account |
| Edit listing price | Sell | On listing's account |
| Archive a listing (stop carrying) | Catalog | On listing's account |
| Edit canonical profile (curator) | Catalog | On curator account |
| Submit edit suggestion | Catalog | On suggester account |
| Review incoming suggestion | Catalog | On curator account |
| Place wholesale order (buyer) | Sell | On buyer account |
| Confirm/ship/receive wholesale order | Sell | On respective account |
| Set per-partner margin override | Owner-only | Configures financial relationship |
| Flag profile for network adoption | Catalog | On originator account |
| Adopt profile to network | Platform tier | Only Adrian / Platform Admin |
| Transfer curation | Platform tier | Only Adrian / Platform Admin |
| Set tier-default wholesale margins | Platform tier | Only Adrian / Platform Admin |
| Suspend / reactivate account | Platform tier | Only Adrian / Platform Admin |
| Grant Platform Admin | Platform Owner only | Only Adrian |

---

## Cross-pollination through Teajia (the hub model, expanded)

Decision 12: tea discovery flows through Adrian, never partner-to-partner.

**Concrete example.** Jesse (Australia, Location) finds an excellent oolong from Rayi (a future partner, Location). Jesse wants to carry it.

1. Rayi's profile for that oolong has `network_visible=1`, `originated_by = curated_by = acc_rayi`
2. Jesse's "Carry from network" catalog filters to `curated_by = acc_teajia_bali` only. Rayi's profile is NOT visible in Jesse's catalog.
3. Jesse can flag Rayi's profile via `POST /api/network/profiles/:id/suggest-for-network` (only works on profiles where caller is originator OR profile is in caller's network-visible view via storefront discovery)
4. Adrian sees in adoption queue. Reviews, optionally tastes, decides:
   - **Adopt:** transfers `curated_by` to `acc_teajia_bali`. Lineage (`originated_by = acc_rayi`) preserved. Profile now appears in everyone's catalog.
   - **Decline:** profile stays Rayi-curated. Only Rayi sells it.
5. Once adopted, Jesse carries it through normal flow. Rayi keeps her listing as originator.

**Why through Adrian:** preserves canonical curation gate; prevents network from fragmenting into partner micro-supply-chains; consistent editorial standards.

---

## Tea Master economics (confirmed Scenario A)

Tea Master operates as a Location-without-physical-store:

- Has all six bundles by default on own account
- Can carry from network catalog (same flow as Locations)
- Can place wholesale orders with Adrian (or other suppliers eventually)
- Holds physical stock at home, fulfills locally to followers
- Has own storefront (more practitioner-presentation per UI brief)
- Trust-tier default margin: 48% (mid-range, tunable per Adrian's matrix)
- Affiliate model (no stock, you fulfill) deferred to future phase

**Pricing discipline:** Tea Masters subject to same below-canonical-retail soft warning as Locations (Decision 20).

**Mitigation for double-listing concern:** at small network scale (5-15 Tea Masters, 1-50 Locations) customer overlap is small. Where overlap exists, use per-partner margin override to make their effective wholesale (and thus their floor retail) match or exceed Adrian's retail. They compete on relationship + curation, not price.

---

## Australia onboarding checklist (Jesse)

After Step 6 ships:

- [ ] Adrian provisions Jesse via Members & Access: invite as Tea Master OR Location Owner of `acc_teajia_australia`. (Decide which based on whether she has a physical address.)
- [ ] Jesse claims invite, lands on AccountPanel with empty inventory
- [ ] Jesse updates account profile (logo, tagline, WhatsApp, contact, cover)
- [ ] Jesse opens "Carry from network" — carries initial set from Adrian's catalog
- [ ] Jesse adds at least one own tea (testing originate path)
- [ ] Jesse places first wholesale order with Adrian; receives stock; verifies cost basis in AUD
- [ ] Jesse adds her own packaging photos to 2-3 listings
- [ ] Jesse submits first edit suggestion (likely brewing tweak); Adrian reviews
- [ ] Jesse invites first staff Member via Members & Access; grants bundles
- [ ] Jesse creates first event
- [ ] Storefront verified at `teajia.com/store/teajia-australia`
- [ ] First end-to-end customer sale

---

## Future considerations (deferred from this rollout)

- **Affiliate fulfillment for Tea Masters (Scenario B)** — Tea Masters sell, Adrian fulfills, attribution + payout system.
- **Member-level Pricing sub-permission** — Owner can grant a Member ability to set per-partner margins.
- **Conditional wholesale margin overrides** — "Jesse pays 40% but only on teas under $X retail."
- **Suggestion review SLA + batching** — when 5+ partners actively suggesting, Adrian needs digest mode + per-partner trust scoring.
- **Profile un-adoption** — Adrian un-adopts a previously-adopted profile; existing carriers keep listings but profile leaves the catalog.
- **Bare-slug URLs** (`teajia.com/bali`) — needs reserved-word list.
- **Drop legacy `products` table** — after one release of read-only fallback.
- **Drop `tea_reviews.tea_key`** — after `profile_id` verified live for one release.
- **Adoption queue UI polish** — filters by suggesting partner, region, varietal as volume grows.
- **Wholesale repeat orders / partial fulfillment / cross-store sample swaps**.
- **Trust tier renaming** — current `basic / verified / partner` → potentially `trusted / featured / spotlight` pre-launch.

---

## Risks

- **Backfill correctness (Step 1).** Highest-risk migration in the codebase. Plan: snapshot D1; clone; backfill on clone; row-count diff every product; manually inspect 10 random profiles; only then prod.
- **Bundle authorization regressions (Step 0).** Refactoring every existing handler to bundle middleware risks breaking subtle privilege paths. Plan: comprehensive auth test sweep before merge; canary deploy to Adrian's account only first.
- **Photo storage.** Carrying duplicates R2 references, not bytes. Cheap. Revisit if storage costs spike.
- **Curation transfer audit.** Every `curated_by_account_id` change writes audit log entry with prior + new curator + reason.
- **Adoption queue volume.** If many partners flag many profiles, Adrian's queue could swamp him. Queue is review-on-his-time, not blocking; partners sell to own customers immediately, only network-wide canonicality waits on adoption.
- **Pricing-discipline warning false positives.** FX rates fluctuate; warning could fire on currency drift, not actual undercut. Plan: 5% tolerance band before warning fires.

---

## Key files (reference during build)

| File | Role |
|---|---|
| `worker/migrations/050_members_access.sql` | Step 0 schema |
| `worker/migrations/051_tea_profiles.sql` | Step 1 schema + backfill |
| `worker/migrations/052_suggestions.sql` | Step 3 schema |
| `worker/migrations/053_wholesale.sql` | Step 4 schema |
| `worker/src/index.ts` | Bundle middleware; all new endpoints; existing handlers refactored to bundle auth |
| `src/lib/api.ts` | New `api.access.*`, `api.network.*`, `api.wholesale.*`, `api.suggestions.*` |
| `src/types.ts` | `AccountKind`, `TrustTier`, `Bundle`, `TeaProfile`, `ProductListing`, `EditSuggestion`, `WholesaleOrder` |
| `src/admin/views/AccessView.tsx` (new) | `/admin/access` Location Owner view |
| `src/admin/views/PlatformAccessView.tsx` (new) | `/admin/access/platform` |
| `src/admin/views/NetworkView.tsx` (new) | `/admin/network` with Catalog / Suggestions / Wholesale / Adoption tabs |
| `src/admin/views/InventoryView.tsx` | "Carry from network" entry point |
| `src/admin/views/ProfileEditPanel.tsx` (new) | Canonical content editor (curator only) |
| `src/components/storefront/Storefront.tsx` | Discovery fallback empty state |
| `docs/NETWORK_UI_BRIEF.md` (Step 0.5 output) | Design direction for all new screens |
