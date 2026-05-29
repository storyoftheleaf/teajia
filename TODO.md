# Teajia Development TODO

## Soon

### MCP: Voice & Agent

- [ ] **Claude mobile OAuth debug.** _(band: you-required)_ Finish the OAuth connector flow for Claude mobile. Desktop works via manually-minted tokens; mobile reaches the consent page on `teajia.pages.dev` but reports query params missing. One screenshot of the failing consent page's URL bar (from the phone) identifies which of three candidate causes applies.
- Full briefing + resume protocol: [docs/MCP_MOBILE_OAUTH_TODO.md](docs/MCP_MOBILE_OAUTH_TODO.md)

### Magazine / Journal Reader

- [ ] **Verify page overflow on short phones (iPhone SE / 667px).** _(band: you-required)_ The math fix landed (`MAX_CHARS_PER_PAGE` lowered 600 to 480, 438px needed vs 290px available on SE). Still needed: open a real article on the shortest phone you have and visually confirm the reading rhythm feels right.

### Product Card Redesign (in progress)

- [x] Always reserve subtitle (given name) line height on cards
- [x] Add 1-3 image gallery with adaptive layout
- [x] Add mood tags as keyword-style pills
- [x] Reorder card: images then tasting notes then mood tags then description
- [x] Image lightbox on tap
- [ ] **Split product names into title + subtitle.** _(band: you-required)_ Separate tea identity from tea type so cards render both lines cleanly.
- [ ] **Decide naming convention for all teas.** _(band: you-required)_ Settle the title / subtitle / year pattern that every product follows.

## Pre-launch

### Infrastructure Follow-Ups

- [ ] **Update the Cloudflare CI token for D1 migration permission.** _(band: you-required)_ The GitHub Actions `CLOUDFLARE_API_TOKEN` lacks D1 write access, so production migrations may need manual application from an authenticated local terminal. Worker deploys still go live. When ready: mint a token with Workers deploy + D1 write, save it as repo secret `CLOUDFLARE_API_TOKEN`, then remove `continue-on-error: true` from the `Apply D1 migrations` step.
- Affected workflow: [.github/workflows/deploy-worker.yml](.github/workflows/deploy-worker.yml)

### Magazine Editor (April 2026 Sprint)

- [ ] **Run the articles D1 migration before the magazine editor works.** _(band: you-required)_ Until this runs once after `wrangler login`, `/admin/magazine` fails silently. Command: `cd worker && npx wrangler login && npx wrangler d1 execute teajia-db --remote --file=migrations/031_articles.sql`.
- Migration file: [worker/migrations/031_articles.sql](worker/migrations/031_articles.sql)

- [ ] **Replace gift-set product ID placeholders in `src/constants.ts`.** _(band: you-required)_ Swap the placeholder IDs in the gift-sets section for real product IDs from the admin inventory panel: set-dark-tea-sampler, set-journey-of-flavor, set-tea-with-chi, set-starters-pack, set-entry-set. (Note: see TODO-STALENESS-REPORT.md, the `// GIFT SETS` section with these IDs no longer appears in `src/constants.ts`; confirm the section still exists before actioning.)

- [ ] **Replace hardcoded Spaces-page locations.** _(band: agent-runnable)_ `src/pages/SpacesPage.tsx` has 3 Bali locations hardcoded with TODO comments. Replace with real data or wire to DB when multi-account infrastructure ships.

### Brewing & QR Cards (#11 + QR card route)

- [ ] **Write ~20 brewing guide profiles covering the full catalog.** _(band: you-required)_ One profile per tea type/style (Gongfu Oolong, Grandpa-style Green, White, Raw/Ripe/Aged Puerh, Sheng, High-mountain Oolong, Roasted Oolong, Black gongfu, Black western, Yellow, Liu Bao, etc.) with water temp °C, steep seconds, leaf-to-water ratio g/ml, vessel type, infusion count. These power `/learn/brew/:teaType` pages and the QR sticker cards already built. Adrian provides or approves; can be drafted in conversation then loaded.

- [ ] **Build the `/learn/brew/:teaType` route and page.** _(band: agent-runnable)_ The `BrewingQRCard` component links here but the pages don't exist yet. Build once brewing profiles are written (see item above).

## Future

### Mood & Flavor Taxonomy System

Goal: a canonical, interconnected set of mood and flavor tags every tea pulls from. Build the lists first, then map teas to them.

- [ ] **Phase 1: define the lists.** _(band: agent-runnable)_ Audit all existing mood values and tasting notes across the 139+ teas (extract every unique value in the DB), then draft a canonical mood vocabulary and flavor vocabulary. Adrian approves the finalized lists.
- [ ] **Phase 2: define connections.** _(band: agent-runnable)_ Map mood-to-mood relationships, flavor-to-flavor relationships, and mood-to-flavor cross-connections. Decide the storage structure (graph, categorized tags, etc.).
- [ ] **Phase 3: store the taxonomy.** _(band: agent-runnable)_ Create taxonomy tables/files for mood and flavor tags, store the interconnections, add API endpoints to fetch the lists.
- [ ] **Phase 4: connect to products.** _(band: agent-runnable)_ Update AddProductModal to use taxonomy dropdowns/autocomplete (not freeform), migrate existing freeform moods + tasting notes to canonical tags, update the sync script to validate against the taxonomy.
- [ ] **Phase 5: frontend features.** _(band: agent-runnable)_ Browse/filter the shop by mood and flavor tags, "Related by mood" and "Related by flavor" on product pages, and a mood/flavor exploration page (click a mood, see all teas that share it).

### Pending from Development Sprint (April 2026)

- [ ] **#21: find a magazine template reference.** _(band: you-required)_ Provide 1-3 references (print: Kinfolk, Cereal, Monocle, Hole & Corner; or digital) whose quality is the target for Teajia's magazine templates. The 70-point template overhaul in PLAN.md is ready to execute once the reference is confirmed.
- Reference plan: [PLAN.md](PLAN.md)

- [ ] **#20: publish contributor profile: Barry.** _(band: you-required)_ Get Barry's full name, background/bio, photo, and content ready. The first contributor profile template is already built. Barry's profile is the first signal the magazine is a serious editorial home.

## Operational notes (not TODOs: context for future-you)

- The MCP voice/agent server is live at the worker `/mcp` endpoint; all seven Phase 1 tools ship and `record_sale` runs the full fulfillment path. PDFs + email delivery are Phase 2. See CLAUDE.md "Voice & agent control" for the tool list and implementation pointers.
