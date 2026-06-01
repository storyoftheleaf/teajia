# Teajia Development TODO

## Soon

### Inventory

- [ ] Apply the intake-batches DB migration to production so the batch feature goes live _(band: you-required)_ _(effort: quick)_ → Plan: [intake-batches.md](todo/plans/intake-batches.md)

### MCP: Voice & Agent

- [ ] Get the voice assistant connecting from a phone (works on desktop, fails on mobile) _(band: you-required)_ _(effort: deep)_ → Plan: [mobile-oauth.md](todo/plans/mobile-oauth.md)

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

- [ ] Let deploys apply database changes automatically _(band: you-required)_ _(effort: deep)_ → Plan: [deploy-db-migrations.md](todo/plans/deploy-db-migrations.md)

### Magazine Editor (April 2026 Sprint)

- [ ] Run the one-time articles database setup so the magazine editor works _(band: you-required)_ _(effort: deep)_ → Plan: [deploy-db-migrations.md](todo/plans/deploy-db-migrations.md)
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
