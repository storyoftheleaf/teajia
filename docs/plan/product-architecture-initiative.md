# Product Architecture Initiative

*Planning packet. Read VISION.md, NETWORK_UI_BRIEF.md, TASTING_JOURNAL_BRIEF.md, MAGAZINE_PLAN.md, and ARCHITECTURE.md first.*

Last updated: 2026-05-09

---

## Purpose

This initiative exists to protect the full intention of Teajia as the codebase grows.

Teajia is not only an e-commerce site, a CMS, an admin tool, a journal, or a network marketplace. It is tea infrastructure shaped by taste: Adrian's curation becoming a system for sourcing, education, memory, events, wholesale, editorial authority, and eventually a lineage-based network of tea spaces.

The planning work in this packet turns the discussion from chat into persistent build guidance. It captures what we are building, how we are building it, where the current architecture is strong, where it can drift, and what implementation work should happen next.

## What We Are Building

Teajia is a living system for the global tea community.

It works in three moments:

- **Before tea:** sourcing, stock, pricing, invitation, preparation, education, and operational readiness.
- **During tea:** the app disappears. The host pours. The guest receives. Phones stay away from the table.
- **After tea:** the system remembers what happened, reconnects people with what they tasted, and prepares the next act of practice.

The product has six connected registers:

| Register | Purpose | Product expression |
|---|---|---|
| Editorial authority | Teajia earns trust through voice, knowledge, and cultural care | Magazine, Learn, contributor profiles, origin stories |
| Curatorial commerce | Buying tea is a relationship, not a checkout funnel | Shop, product pages, WhatsApp inquiry, post-session purchase bridge |
| Personal memory | A person's tea life accumulates quietly over time | Tasting journal, Compass history, collection, favorites, event attendance |
| Professional operations | Tea workers and hosts need tools that respect real work | Inventory, events, customers, orders, invoices, stock ledger |
| Network lineage | Teajia scales through trust and shared standards, not franchising | Tea profiles, listings, wholesale, partner spaces, trust tiers |
| Foundation trajectory | The long-term mission gives the business its ethical direction | Land preservation and giving back to tea-producing regions, announced later |

## How We Are Building It

The existing direction is correct: build real tools around Adrian's work first, then open the system to trusted people, then scale the network.

The architecture should continue to follow these principles:

1. **Curation before automation.** Adrian's taste is the recommendation engine until humans cannot keep up.
2. **Presence before engagement.** The app should make tea practice easier without occupying the table.
3. **Lineage before franchise.** Teajia is a quality signal and infrastructure layer, not a brand template every space must copy.
4. **Memory before metrics.** Personal records should feel like a private archive, not quantified self.
5. **Editorial before content volume.** A few excellent articles matter more than many generic ones.
6. **Relationship before transaction.** Inquiry, confirmation, and conversation are part of the brand.
7. **Trust before scale.** Wholesale, network visibility, and partner privileges must remain gated by relationship and role.

## The Architectural Problem

The codebase already contains much of the product's future. Multi-account infrastructure, bundles, tea profiles, listings, wholesale, events, magazine rendering, Compass, and tasting journal features are all present in some form.

The risk is that the product's taste and intention still live too much in documentation and individual components, not enough in enforceable architecture.

Without stronger domain boundaries, future work can accidentally collapse Teajia into familiar but wrong shapes:

- e-commerce instead of curatorial commerce
- CMS instead of editorial publication
- SaaS dashboard instead of curation studio
- social network instead of shared tea lineage
- analytics product instead of private tea memory
- franchise tooling instead of autonomous partner infrastructure

This initiative is about encoding the product's subtle rules into durable contracts, code structure, tests, and review checklists.

## What Needs Attention

### 1. Product ontology

Teajia needs a clear domain contract for what each object means.

The most important distinction is already stated in NETWORK_UI_BRIEF.md:

- **Card edits identity.** A tea card describes what the tea is: name, origin, varietal, harvest year, description, photos.
- **Tasting edits experience.** A tasting captures what someone experienced today: flavors, mood, body, observations, memory.

That distinction should become code, not just prose.

The same applies across the system:

- A canonical `tea_profile` is not the same as a per-account `product_listing`.
- A product description is not the same as a tasting note.
- A journal entry is not the same as a review.
- An article is not the same as a product page.
- A wholesale order is not the same as public checkout.
- A network partner is not the same as a franchisee.

### 2. Editorial system

The magazine is a major trust surface. It should be treated as a publishing engine, not a generic article editor.

The current reader and renderer contain serious ambition, but the admin editor, article block contracts, template curation, contributor workflow, and product references need to become one system.

### 3. Personal tea memory

The product needs a quiet personal memory spine across tasting journal, Compass, collection, events, orders, article reading, favorites, and post-session recaps.

This is not engagement machinery. It should feel like a private tea notebook that becomes more valuable through use.

### 4. Network and multi-account hardening

Network code is already underway. The next work should harden route authorization, account-scoped cache/state, migration discipline, and the transition from legacy `products` to `tea_profiles` plus `product_listings`.

This is required before the product can support more operators without eroding trust.

### 5. Interface grammar

Each surface needs a clear role:

- Public site: discovery, trust, reading, buying, attending.
- AccountPanel: personal tea room and lightweight member hub.
- `/me`: quiet command center for the person's relationship with tea.
- Compass: sourcing and capture instrument.
- Admin: curation studio and operational backend.
- Network views: stewardship of tea identity, listings, wholesale, and partner relationships.

The app should not feel like a collection of tools sharing a navigation shell. It should feel like one intentional system.

## Initiative Outcome

This initiative is complete when:

- The product ontology is documented, typed, and used in core flows.
- Editorial, memory, network, and admin surfaces each have clear boundaries.
- Critical backend risks are fixed or scheduled with acceptance criteria.
- Query and persisted state are account/user scoped where needed.
- Magazine editor and reader share one article contract.
- The network architecture has route-level authorization inventory and tests.
- Planning docs are kept current and used before implementation begins.

## Companion Documents

- `product-architecture-prd.md` - product requirements and acceptance criteria.
- `product-architecture-implementation.md` - engineering plan, phases, files, tests, and backlog.
- `product-architecture-discussion-log.md` - thread playback, findings, decisions, and open questions.
