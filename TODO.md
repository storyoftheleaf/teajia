# Teajia Development TODO

## Soon

### MCP: Voice & Agent

- [ ] Verify the phone connection on a real iPhone — the mobile-login bug was root-caused (the in-app browser dropped the login parameters on redirect) and fixed by passing them in the URL path instead; desktop already works _(band: you-required)_ _(effort: quick)_ → Plan: [mobile-oauth.md](todo/plans/mobile-oauth.md)
- [ ] Add a Cloudflare rate-limiting rule in front of the public shop assistant (`/mcp/public`) — code has a basic limiter, but real protection is a dashboard/WAF rule _(band: you-required)_ _(effort: quick)_
- [x] The assistant can now look things up, not just change things — read invoices, customer histories, sales summaries, and account context _(done 2026-06-06, PR #192)_
- [x] Fix the assistant randomly forgetting a pending confirmation mid-conversation _(done 2026-06-06, PR #192: confirmations now stored in the database, not per-server memory)_
- [x] Let the public's own AI browse the catalogue and build a WhatsApp order link _(done 2026-06-06, PR #192: read-only `/mcp/public` server)_
- [x] Make Teajia legible to AI assistants — `llms.txt` guide + machine-readable tags on the site and articles _(done 2026-06-06, PR #192)_
- [x] Let owners choose what a connected app is allowed to do, instead of a fixed permission set _(done 2026-06-06, PR #192)_

### Feature guide (owner walk-throughs)

- [ ] Correct the walk-through steps and role descriptions in the owner feature guide — they're first-draft text I wrote from the code; the real procedures and the value each user type gets need your wording _(band: you-required)_ _(effort: moderate)_
- [ ] Eyeball the walk-with-me dock on a real device — it's build-verified but not screenshotted; confirm it stays pinned across pages and that logging a problem feels quick _(band: you-required)_ _(effort: quick)_
- [ ] Let walk-through steps be marked works/broken per user type, not just overall — tie the role layer to the testing layer so you can see "fine for Owner, confusing for Member" _(band: agent-runnable)_ _(effort: moderate)_
- [ ] Decide whether to build real PDF order import (AI extraction) — currently listed "not built yet" in the guide; CSV is the only bulk import _(band: you-required)_ _(effort: deep)_

### Admin usability

- [ ] Make adding products findable on the Stock screen, then template the fix across the admin — Import is buried in an overflow menu while New is a prominent button, the menu is duplicated and drifted, and the empty state never tells a new operator how to add their first product _(band: agent-runnable)_ _(effort: deep)_ → Plan: [stock-discoverability.md](todo/plans/stock-discoverability.md)

### Magazine / Journal Reader

- [ ] Check that articles read well on the shortest phones (iPhone SE) _(band: you-required)_ _(effort: moderate)_

### Product Card Redesign (in progress)

- [x] Always reserve subtitle (given name) line height on cards
- [x] Add 1-3 image gallery with adaptive layout
- [x] Add mood tags as keyword-style pills
- [x] Reorder card: images then tasting notes then mood tags then description
- [x] Image lightbox on tap
- [ ] Split product names into a title line and a subtitle line on cards _(band: you-required)_ _(effort: moderate)_
- [ ] Settle on one naming pattern (title, subtitle, year) that every tea follows _(band: you-required)_ _(effort: moderate)_

## Pre-launch

### Infrastructure Follow-Ups

- [x] Give the deploy's Cloudflare token D1 permission so migrations stop silently failing in CI _(done 2026-06-01: token has D1 write, verified via deploy run; tracker reconciled)_ → Plan: [archive/ci-cloudflare-token-d1.md](todo/plans/archive/ci-cloudflare-token-d1.md)
- [x] Let deploys apply database changes automatically _(done 2026-06-01: continue-on-error removed, migrations now auto-apply on deploy and fail loudly on error)_ → Plan: [deploy-db-migrations.md](todo/plans/deploy-db-migrations.md)
- [ ] Rename the Google sign-in consent screen from "lightcodes.workers.dev" to "Teajia" — the Google "Continue with Google" consent screen currently shows the API domain instead of the brand, which reads as untrustworthy to customers. Fix in Google Cloud Console → APIs & Services → OAuth consent screen → App name = "Teajia" (optionally set logo + home page = teajia.com); no code change. _(band: you-required)_ _(effort: quick)_

### Magazine Editor (April 2026 Sprint)

- [x] Run the one-time articles database setup so the magazine editor works _(done: articles table exists on prod, migration 031 tracked — verified 2026-06-01)_
- [ ] Replace the placeholder gift-set product IDs with real ones from the inventory panel _(band: you-required)_ _(effort: quick)_
- [ ] Replace the three hardcoded Spaces-page locations with real data _(band: agent-runnable)_ _(effort: moderate)_

### Brewing & QR Cards

- [ ] Write the brewing guides and build the pages the QR cards link to _(band: you-required)_ _(effort: deep)_ → Plan: [brewing-guides.md](todo/plans/brewing-guides.md)

### Compass tasting journal (Phases 2-3)

- [ ] Add per-section voice capture so notes tag which part of the tasting they came from _(band: agent-runnable)_ _(effort: moderate)_ → Plan: [docs/TODO.md](docs/TODO.md)
- [ ] Let customers star their own journal notes as candidates for Adrian's review _(band: agent-runnable)_ _(effort: moderate)_ → Plan: [docs/TODO.md](docs/TODO.md)
- [ ] Build the admin queue to promote customer-starred notes onto product tastings _(band: agent-runnable)_ _(effort: deep)_ → Plan: [docs/TODO.md](docs/TODO.md)

### Loose ends from the development log

- [ ] Add a static Google map preview on the event landing page (blocked on Adrian getting a Maps API key) _(band: you-required)_ _(effort: moderate)_ → Plan: [docs/TODO.md](docs/TODO.md)
- [ ] Decide what to do with the 3 Bali draft products stamped as common-data (promote to active or keep as personal) _(band: you-required)_ _(effort: quick)_
- [ ] Split the admin "Untasted" filter into never-reviewed versus on-community-data _(band: agent-runnable)_ _(effort: quick)_
- [ ] Drop and recreate the local development database so old migrations can re-run and the inquiries table exists _(band: you-required)_ _(effort: moderate)_
- [ ] Add real hero and gallery images to the 10 Advise projects once photos are ready _(band: you-required)_ _(effort: quick)_

## Future

### Mood & Flavor Taxonomy System

- [ ] Build a connected mood and flavor tagging system for every tea _(band: agent-runnable)_ _(effort: deep)_ → Plan: [mood-flavor-taxonomy.md](todo/plans/mood-flavor-taxonomy.md)
- [ ] Seed mood and flavor tags on Adrian's teas and walk the filter loop end-to-end before tagging all 139 _(band: you-required)_ _(effort: moderate)_ → Plan: [docs/TODO.md](docs/TODO.md)

### Pending from Development Sprint (April 2026)

- [ ] Pick 1-3 magazine references whose quality is the target, then run the template overhaul _(band: you-required)_ _(effort: deep)_ → Plan: [PLAN.md](PLAN.md)
- [ ] Publish the first contributor profile (Barry): full name, bio, photo, content _(band: you-required)_ _(effort: moderate)_

### Your Table home for operators

- [ ] Make Your Table the role-adaptive home with a readiness-based first-door for new operators _(band: agent-runnable)_ _(effort: deep)_ → Plan: [docs/plan/your-table-completion-plan.md](docs/plan/your-table-completion-plan.md)
- [ ] Give the Platform tier its own governance surface in Your Table instead of the Owner launchpad with extra tiles _(band: agent-runnable)_ _(effort: moderate)_ → Plan: [docs/_audit/05_your_table_member_level_links.md](docs/_audit/05_your_table_member_level_links.md) §5.7

### Platform coherence (post-audit Body B)

- [ ] Add cross-section links so Magazine, Learn, Consult, and Glossary point at the teas they mention _(band: agent-runnable)_ _(effort: deep)_ → Plan: [docs/POST_AUDIT_ROADMAP.md](docs/POST_AUDIT_ROADMAP.md)
- [ ] Build the "My Tea Life" personal timeline that unifies tastings, favorites, orders, and reading history _(band: agent-runnable)_ _(effort: deep)_ → Plan: [docs/POST_AUDIT_ROADMAP.md](docs/POST_AUDIT_ROADMAP.md)
- [ ] Build the post-session editor that turns event records into Magazine photo essays _(band: agent-runnable)_ _(effort: moderate)_ → Plan: [docs/POST_AUDIT_ROADMAP.md](docs/POST_AUDIT_ROADMAP.md)

### Collection recommendations (Phase 2)

- [x] When someone changes the amount on a sent collection, update the price to match the per-gram/per-unit rate instead of keeping the fixed quote _(shipped: worker handleConfirmCollectionPicks + PublicCollectionPage.tsx — quoted price now scales by amount)_

### Multi-account platform (the business model)

- [ ] Onboard the first trusted users: Compass access for tea friends and real guests at events _(band: you-required)_ _(effort: moderate)_ → Plan: [docs/ROADMAP.md](docs/ROADMAP.md)
- [ ] Build the multi-account data foundation (accounts table, account scoping, role expansion) _(band: agent-runnable)_ _(effort: deep)_ → Plan: [docs/ROADMAP.md](docs/ROADMAP.md)
- [ ] Build the wholesale catalog and sourcing-to-shelf pipeline for network operators _(band: agent-runnable)_ _(effort: deep)_ → Plan: [docs/ROADMAP.md](docs/ROADMAP.md)
- [ ] Build operator onboarding, operator public pages, and the network directory _(band: agent-runnable)_ _(effort: deep)_ → Plan: [docs/ROADMAP.md](docs/ROADMAP.md)

## Operational notes (not TODOs: context for future-you)

- The MCP voice/agent server is live at the worker `/mcp` endpoint; all seven Phase 1 tools ship and `record_sale` runs the full fulfillment path. PDFs + email delivery are Phase 2. See CLAUDE.md "Voice & agent control" for the tool list and implementation pointers.
