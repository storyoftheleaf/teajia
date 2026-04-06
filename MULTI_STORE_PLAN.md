# Multi-Store Architecture — Teajia

*Phase 1A shipped on branch `claude/multi-store-collaboration-4hjfW`. Read VISION.md and ROADMAP.md first — this doc is the implementation reference.*

---

## The Decision (Option C)

Teajia is a **network of independent tea houses**, not a unified catalog. Each store has its own shop URL, its own inventory, its own team, its own orders. Visitors arriving at one store never see another store's stock. A lightweight network home surfaces discovery without mixing catalogs.

This was chosen over:
- **Unified catalog with a filter** — risks showing tea a visitor can't buy, and reads as franchise-y (contradicts VISION.md's lineage principle).
- **Fully siloed with no discovery** — works, but loses the brand-as-network benefit.
- **Cross-store fulfillment** — correct eventually, but only after shipping is enabled. Phase 2.

## Mental Model

- **Account** = a tea house / operator / location (e.g. `acc_teajia_bali`, `acc_teajia_australia`)
- **User** can belong to multiple accounts with different roles per account
- **Per-account**: stock, orders, customers, events, vendors, costs, stock ledger, tea compass entries, activity logs, teaware collection
- **Network-level**: magazine, learn hub, exchange rates, the `tea_reviews` cross-account table
- **User-scoped within account**: tea compass entries (same user has separate compass books per store)

## How Visitors Experience It

| Arrival | URL | Sees |
|---|---|---|
| Direct share from Bali | `/store/teajia-bali` | Bali's shop only. Zero trace of Australia. |
| Direct share from Australia | `/store/teajia-australia` | Australia's shop only. |
| Google search "teajia" | `/` | Home + magazine + network directory strip |
| "Find a table" | `/find-a-table` | Grid of all public stores |
| Legacy `/shop` bookmark | `/shop` | Still works — aliased to Bali via `/api/products/public` |
| Sample QR | `/s/:sampleId` | Sample page (unchanged; that's why storefront lives at `/store/:slug`, not `/s/:slug`) |

A visitor on `/store/teajia-bali` will never see Australia stock. There is **no UI affordance** to switch stores from inside a shop. The data is row-scoped by `account_id` server-side and URL-scoped client-side.

## Data Model

**New tables** (`worker/migrations/017_multi_account.sql`):

- **`accounts`** — id, slug, name, tagline, description, logo_url, cover_image_url, location_city, location_country, timezone, currency_default, whatsapp_number, contact_email, public_enabled, invoice_prefix, owner_user_id, status, trust_tier, is_platform_owner, ships_to_countries, created_at, updated_at
- **`account_members`** — (account_id, user_id, role, invited_by_user_id, invited_at, joined_at, status); UNIQUE(account_id, user_id); role ∈ `owner | manager | staff | viewer`
- **`tea_reviews`** — id, tea_key, product_id, product_account_id, author_user_id, author_account_id, visibility, session_date, rating, notes, tasting, brew_params

**Column added to every scoped table:** `account_id TEXT`. Tables: `products`, `invoices`, `invoice_line_items`, `customers`, `activity_logs`, `stock_ledger`, `teaware_collection`, `teaware_photos`, `tea_compass_entries`, `events`, `event_attendees`, `event_notifications`, `event_post_session`, `event_tea_menu`, `event_tasting_notes`, `guest_invites`, `interest_signups`, `saved_locations`, `tea_samples`, `tea_sample_sets`, `tea_sample_tastings`, `customer_tasting_journal`, `stock_holds`, `newsletter_subscribers`, `user_favorites`. Indexed on high-read tables.

**`products.tea_key`** — free-text normalized tea identity (e.g. `silver-needle-fuding-2024`). Both stores can tag their own Silver Needle row with the same `tea_key` to share reviews. In Phase 1B this becomes a proper `tea_profiles` FK.

**Seeded accounts**: `acc_teajia_bali` (Adrian, `is_platform_owner=1`, slug `teajia-bali`, invoice prefix `TJB`) and `acc_teajia_australia` (slug `teajia-australia`, currency `AUD`, invoice prefix `TJA`). All existing rows backfilled to Bali. Every existing user gets an `account_members` row in Bali (owner → `owner`, admin → `manager`, user → `staff`).

## Roles

| Role | Inventory | Orders | Events | Customers | Team | Account settings |
|---|---|---|---|---|---|---|
| **owner** | full | full | full | full | full | full |
| **manager** | full | full | full | full | invite/remove staff | edit profile |
| **staff** | view + edit stock | create/fulfill | view + check-in | view + edit | — | — |
| **viewer** | view only | view only | view only | view only | — | — |

## Auth Flow

1. `POST /api/auth/login` returns JWT with claims: `{ sub, email, name, memberships: [{account_id, role, slug, name}], active_account_id, iat, exp }`
2. Client persists token, reads `memberships` + `active_account_id` via `hydrateAccountStateFromToken()` into Zustand
3. Every authenticated request sends header **`X-Teajia-Account: <account_id>`**
4. Worker validates the user has an active membership in that account; 403 `{ error: 'Account access denied' }` on mismatch
5. Switch accounts via `POST /api/accounts/switch { account_id }` → returns new JWT
6. New signups start with empty memberships → frontend shows **"Waiting for invite"** (`NoMembershipGate`)
7. Invite flow (`POST /api/accounts/:id/members { email, role }`) creates an inactive user + long-lived reset token as the claim link

## API Endpoint Catalog

**Account management (authenticated)**
- `GET /api/accounts/me` — { memberships, active_account_id }
- `POST /api/accounts/switch` — body `{ account_id }` → `{ token }`
- `GET /api/accounts/:id` — profile
- `PUT /api/accounts/:id` — update profile (owner/manager)
- `GET /api/accounts/:id/members` — list
- `POST /api/accounts/:id/members` — invite/add (owner/manager)
- `PUT /api/accounts/:id/members/:userId` — update role (owner)
- `DELETE /api/accounts/:id/members/:userId` — remove (owner)

**Public (no auth)**
- `GET /api/network/stores` — public account directory
- `GET /api/s/:slug` — account profile
- `GET /api/s/:slug/products` — scoped catalog (PUBLIC_FIELDS whitelist: no cost, no vendor, no compass references)
- `GET /api/s/:slug/events` — active events

**Legacy**
- `GET /api/products/public` — kept, aliased to `acc_teajia_bali` via shared `fetchPublicProductsForAccount` helper

**Infrastructure details**
- R2 media uploads partitioned under `accounts/<accountId>/...`
- Invoice numbers auto-prefixed with `account.invoice_prefix` (e.g., `TJB-00042`, `TJA-00001`)
- Event slugs stay globally unique (they're in public URLs)
- Customer journey/verification (`/api/journey/:phone`, `/api/verify/*`) intentionally spans accounts — a customer who visits two stores gets one journey

## Protected Data (What Partners Cannot See)

A user authenticated to `acc_teajia_australia` cannot access any row where `account_id != 'acc_teajia_australia'`, enforced server-side in every handler. Specifically protected from cross-account reads:

- `products.vendor`, `vendor_id`, `cost_amount`, `cost_currency`, `quantity_purchased`, `shipping_rate_per_kg`, `cost_per_gram_usd`, `source_compass_entry_id`, `stock_verified_at`, `recheck_stock`
- Other accounts' `customers` (CRM, vendor contacts, tags, phone numbers, WhatsApp, notes)
- Other accounts' `tea_compass_entries` (sourcing journal — arguably the most sensitive IP)
- Other accounts' `stock_ledger`, `activity_logs`, `invoices`, `invoice_line_items`, `stock_holds`
- Other accounts' `teaware_collection`, `teaware_photos`

**What partners CAN see:**
- Their own account's full data
- Network directory (public account fields only: name, slug, tagline, logo, location)
- Magazine + Learn (shared editorial)
- `tea_reviews` with `visibility='network'` — cross-account collaborative reviews

## Collaborative Tea Reviews (the `tea_key` model)

Seven people at Australia + Adrian's team in Bali can taste "the same tea" and contribute reviews visible across the network without sharing inventory:

1. Adrian sets `products.tea_key = 'silver-needle-fuding-2024'` on his Bali product
2. Sarah sets the same `tea_key` on her Melbourne product
3. Adrian posts a `tea_reviews` row: `author_user_id=adrian`, `author_account_id=acc_teajia_bali`, `tea_key='silver-needle-fuding-2024'`, `visibility='network'`
4. Sarah posts hers under her own name and account
5. Both reviews appear on **both** stores' product detail pages (filtered by `tea_key`), each attributed to the individual reviewer and their store
6. Inventory (stock, cost, vendor) stays private — only reviews cross over

Visibility levels: `private` (just the author) | `account` (that account's team) | `network` (everyone on the platform).

## Onboarding a New Store

1. Platform owner (Adrian) inserts an `accounts` row: id, slug, name, location, timezone, currency_default, invoice_prefix, whatsapp_number, contact_email, `public_enabled=1`
2. Platform owner creates the first user (signup or admin create) and adds them as owner: `POST /api/accounts/:id/members { email, role: 'owner' }`
3. New owner claims their invite, logs in, lands on their account, sees empty inventory
4. Owner updates account profile at `/admin/account-settings` (logo, tagline, WhatsApp, contact, description)
5. Owner imports opening stock via Admin → Inventory → ⋮ → Import CSV, OR (Phase 2) browses Adrian's wholesale catalog
6. Owner invites team at `/admin/team` (email + role picker)
7. Owner creates first event
8. Store is live at `teajia.app/store/:slug`

**Sample seed SQL for a new account:**
```sql
INSERT INTO accounts (id, slug, name, location_city, location_country, timezone, currency_default, invoice_prefix, public_enabled, tagline)
VALUES ('acc_<id>', '<slug>', '<Display Name>', '<City>', '<Country>', '<Timezone>', '<USD|AUD|...>', '<PREFIX>', 1, '<Tagline>');
```

## Australia Launch Checklist

- [x] Account provisioned (`acc_teajia_australia`, slug `teajia-australia`, invoice prefix `TJA`, currency `AUD`)
- [x] AUD added to exchange rates
- [x] Storefront route live at `/store/teajia-australia`
- [ ] Owner user created and added via `POST /api/accounts/acc_teajia_australia/members`
- [ ] Owner updates account profile (logo, tagline, WhatsApp number, contact email, description, cover image)
- [ ] Owner imports opening stock via CSV
- [ ] Owner invites staff (up to 7 team members)
- [ ] Owner creates first event
- [ ] Storefront verified visually at `teajia.app/store/teajia-australia`
- [ ] First end-to-end sale

## Rollout Phases

- **Phase 1A — shipped this branch.** Accounts, members, row-level scoping, Bali + Australia seed, per-store storefronts at `/store/:slug`, network directory at `/find-a-table`, team management, tea_reviews, invite flow.
- **Phase 1B — next.** Promote `tea_key` to a canonical `tea_profiles` table. Wholesale catalog flow from Adrian's account to partner accounts. Product content carried from profile with local override.
- **Phase 2.** Shipping-enabled cross-store visibility via `accounts.ships_to_countries` + opt-in toggle. Wholesale order pipeline. Cross-store fulfillment.
- **Phase 3.** Self-service operator onboarding. Network map UI with geo. Co-branding options.
- **Phase 4.** Guest portability (one guest identity across the network). Magazine contributor workflow. Verification badges.

## Known Limitations (Phase 1A)

- D1 (SQLite) has no row-level security; scoping is enforced in `worker/src/index.ts`. Every handler was audited and scoped in this branch.
- `tea_key` is free-text; typos silo a tea. Phase 1B fixes this with `tea_profiles`.
- No invite email delivery yet — the invite API returns a claim link that Adrian or the account owner must share manually.
- No custom domains per store (all stores under `teajia.app/store/:slug`).
- 92 pre-existing TypeScript errors on `main` (tasting flow, shop/ForYourPractice, magazine props) are **not introduced** by this branch but remain unfixed — tracked for a separate cleanup pass.
- Magazine articles and cross-reference tables (`article_products`, `module_products`, `project_products`) are not account-scoped yet; they inherit scoping via joined product rows. Phase 4 will add contributor workflows.

## Key Files

| File | Purpose |
|---|---|
| `worker/migrations/017_multi_account.sql` | Foundation migration: accounts, members, tea_reviews, backfill, seeds |
| `worker/schema.sql` | Canonical schema reference (updated) |
| `worker/src/index.ts` | JWT claims, `requireAccount`, scoped handlers, new account/network/storefront endpoints |
| `src/lib/api.ts` | `X-Teajia-Account` header injection, `api.accounts.*`, `hydrateAccountStateFromToken()` |
| `src/lib/store.ts` | Zustand: `memberships`, `activeAccountId`, `activeAccount` |
| `src/lib/storefrontApi.ts` | Public storefront fetchers (no auth) |
| `src/types.ts` | `Account`, `AccountRole`, `AccountMembership`, `AccountMember` |
| `src/admin/AdminApp.tsx` | Login → hydrate, `NoMembershipGate`, `/admin/team`, `/admin/account-settings` routes |
| `src/admin/components/AccountSwitcher.tsx` | Dropdown switcher in sidebar |
| `src/admin/views/TeamView.tsx` | Team management (invite, role edit, remove) |
| `src/admin/views/AccountSettingsView.tsx` | Account profile editor |
| `src/components/storefront/Storefront.tsx` | Per-store layout at `/store/:slug` |
| `src/components/storefront/FindATable.tsx` | Network directory at `/find-a-table` |
| `src/App.tsx` | Adds `/store/:slug` and `/find-a-table` routes, threads store WhatsApp into public cart |

## Protecting Adrian's Sources (explicit)

When a user authenticated to `acc_teajia_australia` calls `GET /api/customers`, the worker filters by `account_id = 'acc_teajia_australia'` and never returns rows from other accounts. The same enforcement applies to products, vendors (`customers` with the `vendor` tag), compass entries, stock ledger, invoices, and teaware. The only cross-account data flow is through `tea_reviews` (opt-in per-review via the `visibility` field) and the public network directory (`accounts` table, public fields only). Vendor protection is structural, not advisory.
