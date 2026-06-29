# Teajia Development TODO

## Soon

### Advise

- [ ] Build the Advise portfolio (the "Selected projects" preview + full Projects grid + project detail pages) before showing it _(band: you-required)_ _(effort: deep)_
  Hidden on the Advise main page as of 2026-06-24 — the projects data is placeholder, not real work yet. Restore by flipping `portfolioEnabled` to `true` and un-commenting the `<ProjectsPreview />` block in [AdvisePage.tsx](src/components/AdvisePage.tsx). Real project content lives in [adviseProjects.ts](src/data/adviseProjects.ts). Done when the projects are real and Adrian wants them shown.

### Session cleanup follow-ups (rescued from a parked snapshot, 2026-06-17)

- [ ] Ship verification-code delivery so sign-in verification actually works — it's effectively off until codes can be sent _(band: agent-runnable)_ _(effort: moderate)_
- [ ] Build the per-order detail page (order history links to it but the page is still missing) _(band: agent-runnable)_ _(effort: moderate)_
- [ ] Extend tenant-isolation coverage beyond the customers read path _(band: agent-runnable)_ _(effort: moderate)_
- [ ] Confirm which of the two duplicate database setup files is live in production and delete the loser (needs a logged-in check against the live database) _(band: you-required)_ _(effort: quick)_
- [ ] Turn on the inventory-integrity safeguards (written but not yet switched on — review first), and run the read-only reconciliation check against production (last attempt failed on a stale commit, so pull latest first) _(band: you-required)_ _(effort: moderate)_
- [ ] Decide the open home-button fix request — merge or close it _(band: you-required)_ _(effort: quick)_
- [x] Australia shop (au.teajia.com plus the account switcher) — already shipped to main via PR #235; the parked note thought it was unsubmitted _(done, verified 2026-06-18)_

### Curate

- [ ] Restyle the Curate capture screen into the Teajia editorial language (structure stays, skin changes) _(band: agent-runnable)_ _(effort: deep)_ → Plan: [curate-capture-restyle.md](todo/plans/curate-capture-restyle.md)
- [ ] Unify the currency symbol/label maps — there are ~9 separate copies across Curate (CaptureCard, BrowseCard, Ledger views, PricingRow, etc.) plus src/utils/currency.ts; collapse to one shared source so a fix lands once, not nine times _(band: agent-runnable)_ _(effort: moderate)_
- [ ] After api.teajia.com is live, confirm voice transcription works from China — the browser→worker leg is fixed by the domain, but the worker→Groq leg is untested from there; add a fallback or save raw audio if Groq is unreachable _(band: you-required)_ _(effort: quick)_

### MCP: Voice & Agent

- [ ] **Verify iPhone login** — confirm the OAuth sign-in works on a real iPhone _(you · quick)_
  The mobile-login bug (in-app browser dropping login params on redirect) was root-caused and fixed by passing them in the URL path; desktop already works. Done when a real iPhone completes Google sign-in end-to-end. → Plan: [mobile-oauth.md](todo/plans/mobile-oauth.md)
- [ ] **Rate-limit public MCP** — add a Cloudflare WAF rule in front of the public shop assistant (`/mcp/public`) _(you · quick)_
  The code has a basic limiter, but real protection is a dashboard/WAF rule. Done when a rate-limiting rule is live on `/mcp/public` in the Cloudflare dashboard.
- [x] The assistant can now look things up, not just change things — read invoices, customer histories, sales summaries, and account context _(done 2026-06-06, PR #192)_
- [x] Fix the assistant randomly forgetting a pending confirmation mid-conversation _(done 2026-06-06, PR #192: confirmations now stored in the database, not per-server memory)_
- [x] Let the public's own AI browse the catalogue and build a WhatsApp order link _(done 2026-06-06, PR #192: read-only `/mcp/public` server)_
- [x] Make Teajia legible to AI assistants — `llms.txt` guide + machine-readable tags on the site and articles _(done 2026-06-06, PR #192)_
- [x] Let owners choose what a connected app is allowed to do, instead of a fixed permission set _(done 2026-06-06, PR #192)_

### Feature guide (owner walk-throughs)

- [ ] **Rewrite guide copy** — replace the first-draft walk-through steps and role descriptions in the owner feature guide _(you · moderate)_
  The current text was drafted from the code; the real procedures and the value each user type gets need Adrian's own wording. Done when each walk-through and role description reads in Adrian's voice and matches the actual flow.
- [x] **Test walk dock** — eyeballed the walk-with-me dock on a real device _(done 2026-06-14)_
- [ ] **Per-role test marks** — let walk-through steps be marked works/broken per user type, not just overall _(agent · moderate)_
  Tie the role layer to the testing layer so the guide can show "fine for Owner, confusing for Member." Done when a step's status can be recorded separately for each user type.
- [ ] **PDF import decision** — decide whether to build real PDF order import via AI extraction _(you · deep)_
  The guide currently lists PDF import as "not built yet"; CSV is the only bulk import today. Done when Adrian decides to build it (and it ships) or to drop it.

### Admin usability

- [ ] **Findable add-product** — make adding products discoverable on the Stock screen, then template the fix across admin _(agent · deep)_
  Import is buried in an overflow menu while New is prominent, the menu is duplicated and drifted, and the empty state never tells a new operator how to add their first product. Done when both add paths are clearly surfaced, the menu is de-duplicated, and the empty state guides a first product. → Plan: [stock-discoverability.md](todo/plans/stock-discoverability.md)
- [ ] **Currency near the price columns** — decide whether to move the inventory currency selector (USD) next to the Retail/Cost columns _(you · moderate)_
  Today the currency lives in the global admin header, far from the price it governs. Moving it closer reads more clearly, but it's a shared control used by ~20 admin views, so relocating it into the inventory chrome is a layout call with blast radius. Done when Adrian decides to move it (and it ships) or to leave it global.
- [ ] **Inventory view glyphs** — reconsider the Selling-globe and Alerts-triangle icons on the inventory view tabs _(you · quick)_
  The Alerts triangle reads as an error state even when it's just a low-stock filter, and the globe doesn't obviously mean "selling." Done when Adrian picks clearer glyphs or drops them to text labels.

### Magazine / Journal Reader

- [ ] **iPhone SE check** — confirm magazine articles read well on the shortest phones _(you · moderate)_
  Article pages use fixed-size, no-scroll layouts, so the smallest viewport is the tightest constraint. Done when articles paginate cleanly with no clipped or overflowing content on an iPhone SE.

### Product Card Redesign (in progress)

- [x] Always reserve subtitle (given name) line height on cards
- [x] Add 1-3 image gallery with adaptive layout
- [x] Add mood tags as keyword-style pills
- [x] Reorder card: images then tasting notes then mood tags then description
- [x] Image lightbox on tap
- [ ] **Split card names** — render product names as a separate title line and subtitle line on cards _(you · moderate)_
  Part of the in-progress product card redesign, where the subtitle line is already reserved. Done when product names display as distinct title and subtitle lines on the card.
- [ ] **One naming pattern** — settle on a single naming convention (title, subtitle, year) every tea follows _(you · moderate)_
  Card names are inconsistent across teas, so a uniform pattern is needed before splitting them cleanly. Done when one title/subtitle/year pattern is decided and documented for all teas.

## Pre-launch

### Infrastructure Follow-Ups

- [x] Give the deploy's Cloudflare token D1 permission so migrations stop silently failing in CI _(done 2026-06-01: token has D1 write, verified via deploy run; tracker reconciled)_ → Plan: [archive/ci-cloudflare-token-d1.md](todo/plans/archive/ci-cloudflare-token-d1.md)
- [x] Let deploys apply database changes automatically _(done 2026-06-01: continue-on-error removed, migrations now auto-apply on deploy and fail loudly on error)_ → Plan: [deploy-db-migrations.md](todo/plans/deploy-db-migrations.md)
- [ ] **Brand consent screen** — rename the Google sign-in consent screen from "lightcodes.workers.dev" to "Teajia" _(you · quick)_
  The "Continue with Google" screen shows the API domain instead of the brand, which reads as untrustworthy to customers; fix in Google Cloud Console → APIs & Services → OAuth consent screen (App name = "Teajia", optionally logo + home page = teajia.com), no code change. Done when the consent screen shows "Teajia."

### Magazine Editor (April 2026 Sprint)

- [x] Run the one-time articles database setup so the magazine editor works _(done: articles table exists on prod, migration 031 tracked — verified 2026-06-01)_
- [ ] **Real gift-set IDs** — swap the placeholder gift-set product IDs for real ones from the inventory panel _(you · quick)_
  The gift sets currently point at placeholder product IDs, so they don't resolve to actual inventory. Done when each gift set references a real product ID from the inventory panel.
- [ ] **Real Spaces data** — replace the three hardcoded Spaces-page locations with real data _(agent · moderate)_
  The Spaces page ships three placeholder locations instead of pulling real ones. Done when the page renders three real locations from data rather than hardcoded values.

### Brewing & QR Cards

- [ ] **Brewing guide pages** — write the brewing guides and build the pages the QR cards link to _(you · deep)_
  Physical QR cards point at brewing-guide pages that don't exist yet. Done when each QR card resolves to a live brewing guide page. → Plan: [brewing-guides.md](todo/plans/brewing-guides.md)

### Compass tasting journal (Phases 2-3)

- [ ] **Per-section voice** — add per-section voice capture to the Compass tasting journal _(agent · moderate)_
  Notes should tag which part of the tasting they came from rather than landing as one undifferentiated blob. Done when a captured voice note is tagged to its tasting section. → Plan: [docs/TODO.md](docs/TODO.md)
- [ ] **Star own notes** — let customers star their own journal notes as candidates for Adrian's review _(agent · moderate)_
  This is the customer-facing half of the loop that feeds notes into Adrian's review queue. Done when a customer can star a journal note and it's flagged as a review candidate. → Plan: [docs/TODO.md](docs/TODO.md)
- [ ] **Promote-notes queue** — build the admin queue to promote customer-starred notes onto product tastings _(agent · deep)_
  This is the admin-facing half: a queue where Adrian reviews starred notes and publishes them to product tastings. Done when an admin can take a starred note and attach it to a product's tasting notes. → Plan: [docs/TODO.md](docs/TODO.md)

### Loose ends from the development log

- [ ] **Event map preview** — add a static Google map preview on the event landing page _(you · moderate)_
  Blocked on Adrian getting a Maps API key before the preview can render. Done when the event landing page shows a static map of the venue. → Plan: [docs/TODO.md](docs/TODO.md)
- [ ] **Bali drafts call** — decide the fate of the 3 Bali draft products stamped as common-data _(you · quick)_
  They sit in limbo between shared catalog data and Adrian's personal products. Done when each of the 3 is either promoted to active or confirmed kept as personal.
- [ ] **Split Untasted filter** — split the admin "Untasted" filter into never-reviewed versus on-community-data _(agent · quick)_
  The single filter conflates teas Adrian has never reviewed with teas riding on community/common data. Done when the filter offers the two states as distinct options.
- [ ] **Reset local DB** — drop and recreate the local dev database so old migrations re-run and the inquiries table exists _(you · moderate)_
  The local DB is missing the inquiries table because old migrations never ran against it. Done when the local database is rebuilt and the inquiries table is present.
- [ ] **Advise project images** — add real hero and gallery images to the 10 Advise projects _(you · quick)_
  The projects currently ship without their real imagery, pending photos. Done when all 10 Advise projects have real hero and gallery images.

## Future

### Cross-network tea curation (inter-exchangeability)

- [ ] **Curate across networks** — let an operator curate teas drawn from multiple networks/accounts together in one Compass view, with the right visibility and ownership rules _(you · deep)_
  Today a Compass entry belongs to the single account you're operating as. The ask is to mix teas sourced from different networks into one curated set, which is a data + permissions question (whose catalog, whose ledger, who can see the shared set, how an entry references a tea owned by another account) — not a UI tweak. Done when the ownership/visibility model is decided and an operator can assemble and view a set spanning more than one network. Deferred from the 2026-06-18 Compass action-button redesign session.

### Mood & Flavor Taxonomy System

- [ ] **Mood/flavor system** — build a connected mood and flavor tagging system for every tea _(agent · deep)_
  A shared taxonomy lets teas be tagged and then filtered by mood and flavor across the catalog. Done when the tagging schema and filter UI are built and a tea can be tagged and found by mood/flavor. → Plan: [mood-flavor-taxonomy.md](todo/plans/mood-flavor-taxonomy.md)
- [ ] **Seed + test tags** — seed mood/flavor tags on Adrian's teas and walk the filter loop end-to-end before tagging all 139 _(you · moderate)_ _(status: in-flight)_
  A pilot pass validates the taxonomy and filter before the full 139-product effort. Done when a sample of teas is tagged and the filter loop is verified working end-to-end. → Plan: [docs/TODO.md](docs/TODO.md)

### Pending from Development Sprint (April 2026)

- [ ] **Magazine references** — pick 1-3 reference magazines as the quality target, then run the template overhaul _(you · deep)_
  The magazine template overhaul needs concrete quality exemplars to aim at before redesigning. Done when 1-3 references are chosen and the magazine template is reworked toward them. → Plan: [PLAN.md](PLAN.md)
- [ ] **First contributor** — publish the first contributor profile for Barry _(you · moderate)_
  The contributor profile feature needs a real first entry with full name, bio, photo, and content. Done when Barry's complete profile is live on the site.

### Your Table home for operators

- [ ] **Role-adaptive home** — make Your Table a role-adaptive home with a readiness-based first door for new operators _(agent · deep)_
  Your Table should adapt what it shows to each role and guide brand-new operators through a sensible first step. Done when Your Table renders per-role content and presents a readiness-based first door to new operators. → Plan: [docs/plan/your-table-completion-plan.md](docs/plan/your-table-completion-plan.md)
- [ ] **Platform governance** — give the Platform tier its own governance surface in Your Table _(agent · moderate)_
  Platform-tier currently reuses the Owner launchpad with extra tiles instead of a purpose-built surface. Done when the Platform tier has a dedicated governance view rather than bolted-on Owner tiles. → Plan: [docs/_audit/05_your_table_member_level_links.md](docs/_audit/05_your_table_member_level_links.md) §5.7

### Platform coherence (post-audit Body B)

- [ ] **Cross-section links** — link Magazine, Learn, Consult, and Glossary to the teas they mention _(agent · deep)_
  Content sections name teas without linking to their product pages, leaving the catalog disconnected from the editorial. Done when references to a tea across those sections link to that tea's product page. → Plan: [docs/POST_AUDIT_ROADMAP.md](docs/POST_AUDIT_ROADMAP.md)
- [ ] **My Tea Life timeline** — build a personal timeline unifying tastings, favorites, orders, and reading history _(agent · deep)_
  A customer's activity is scattered across features with no single chronological view. Done when "My Tea Life" shows one timeline merging tastings, favorites, orders, and reading history. → Plan: [docs/POST_AUDIT_ROADMAP.md](docs/POST_AUDIT_ROADMAP.md)
- [ ] **Post-session editor** — build the editor that turns event records into Magazine photo essays _(agent · moderate)_
  Events leave records that could become published photo essays but there's no tool to compose them. Done when an event record can be turned into a Magazine photo essay through the editor. → Plan: [docs/POST_AUDIT_ROADMAP.md](docs/POST_AUDIT_ROADMAP.md)

### Collection recommendations (Phase 2)

- [x] When someone changes the amount on a sent collection, update the price to match the per-gram/per-unit rate instead of keeping the fixed quote _(shipped: worker handleConfirmCollectionPicks + PublicCollectionPage.tsx — quoted price now scales by amount)_

### Multi-account platform (the business model)

- [ ] **Onboard first users** — give Compass access to trusted tea friends and real event guests _(you · moderate)_
  The first real users validate Compass before the multi-account platform expands. Done when a set of trusted friends and event guests are using Compass with real access. → Plan: [docs/ROADMAP.md](docs/ROADMAP.md)
- [ ] **Multi-account foundation** — build the accounts table, account scoping, and role expansion _(agent · deep)_
  This is the data layer the whole multi-tenant business model sits on. Done when entities are scoped per account and the expanded role set is enforced across the API. → Plan: [docs/ROADMAP.md](docs/ROADMAP.md)
- [ ] **Wholesale pipeline** — build the wholesale catalog and sourcing-to-shelf pipeline for network operators _(agent · deep)_
  Network operators need a path from sourced stock to their own shelves with wholesale pricing. Done when an operator can move a product from sourcing through to a listed shelf item via the pipeline. → Plan: [docs/ROADMAP.md](docs/ROADMAP.md)
- [ ] **Operator onboarding** — build operator onboarding, operator public pages, and the network directory _(agent · deep)_
  New operators need a way to join, present a public storefront, and be discoverable in the network. Done when an operator can onboard, publish a public page, and appear in the directory. → Plan: [docs/ROADMAP.md](docs/ROADMAP.md)

### The stock spine — movement, locations, sellers, personal collections (locked 2026-06-18)

Build in order; each step sits on the one before it. The whole model is specced in [docs/MULTI_STORE_PLAN.md](docs/MULTI_STORE_PLAN.md) (the "Movement / Locations / Sellers / Personal Collections" section). The locations layer and Adrian-as-master switching already work.

**All five steps shipped.** Steps 2–5 landed on branch `claude/affectionate-clarke-mpx6t8` (migrations 092–094); step 1 shipped earlier (migration 090). See [stock-spine.md](todo/plans/stock-spine.md) for the execution record.

- [x] **1. Give every piece of stock an owner** — record which person a stock row belongs to, defaulting to the location itself so nothing changes on screen yet _(band: agent-runnable)_ _(effort: deep)_ → Plan: [stock-spine.md](todo/plans/stock-spine.md)
  The foundation the other three sit on. Today a tea belongs to a location but not to a person; this makes "whose tea is this" a real fact on every row. Done when every stock row carries an owner and existing teas all read as owned by their location with no visible change.
- [x] **2. Let a location owner curate which sellers' tea shows** — several people can hold their own tea in one location, and the owner chooses which of it appears in that location's shop _(band: agent-runnable)_ _(effort: deep)_ → Plan: [stock-spine.md](todo/plans/stock-spine.md)
  Being in stock and being shown become two separate switches, with the location owner controlling "show / don't show". Done when a second person's tea can exist in Bali and the Bali owner can show or hide each of their teas in the shop, one storefront, no marketplace.
- [x] **3. Build the all-locations master view** — one overview where Adrian sees every location's stock at once, each tea labelled by where it lives _(band: agent-runnable)_ _(effort: moderate)_ → Plan: [stock-spine.md](todo/plans/stock-spine.md)
  The movement as a lens: read-only, operator-only, never a counter a customer buys from. Done when Adrian sees a single list spanning all locations with a location note per row, and steps into a location to actually change stock.
- [x] **4. Let regular app users keep their own collection** — a home user records the tea they personally own, private by default and tied to no location _(band: agent-runnable)_ _(effort: deep)_ → Plan: [stock-spine.md](todo/plans/stock-spine.md)
  The private floor of the same stock spine: same row-ownership as a seller, with selling switched off. Becomes sellable only if the user joins a location and that owner shows it, so a collector can grow into a seller without starting over. Done when a logged-in user can add tea they own with a quantity, kept private and synced to their account.
- [x] **5. Let a standalone seller open their own public tea link** — a person not on any location's team can make their own collection public at their own page, with Adrian's permission _(band: agent-runnable)_ _(effort: deep)_ → Plan: [stock-spine.md](todo/plans/stock-spine.md)
  The top of the spine: a personal shelf with selling switched on, reachable at its own link, without joining Bali. The buyer deals with that seller directly (WhatsApp, like every Teajia order) so Teajia never holds the money. Done when Adrian can grant a user permission to publish their collection at their own page and a visitor can reach it and start a direct order.

## Operational notes (not TODOs: context for future-you)

- The MCP voice/agent server is live at the worker `/mcp` endpoint; all seven Phase 1 tools ship and `record_sale` runs the full fulfillment path. PDFs + email delivery are Phase 2. See CLAUDE.md "Voice & agent control" for the tool list and implementation pointers.
