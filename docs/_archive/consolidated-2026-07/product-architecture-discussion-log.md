# Product Architecture Discussion Log

*Persistent record of the thread that produced the Product Architecture Initiative.*

Last updated: 2026-05-09

---

## Why This Exists

This document captures the discussion that led to the product architecture planning packet. It is intentionally broader than a normal feature brief because the thread was about correcting the framing of Teajia itself.

The central correction: Teajia cannot be assessed only as a transactional software system. It is equally art and science. Architecture decisions must preserve taste, intention, curation, memory, and lineage alongside robustness, security, and implementation quality.

## Thread Playback

### 1. Initial request: rigorous codebase assessment

The first request was for a comprehensive, meticulous, in-depth assessment of the codebase and the highest-reward refactor, extension, or deep-work actions.

The useful direction from that request remains:

- Identify work with high leverage, not cosmetic cleanup.
- Explain why the work matters.
- Connect architecture choices to future product capability.
- Avoid generic refactor advice detached from Teajia's actual strategy.

### 2. Founder explanation request

The next request was to explain the recommendations to an intelligent non-technical founder: why the work is important, valuable, and enabling.

The durable lesson:

- Technical work should be framed in terms of what it unlocks for the business, the product, and the community.
- Architecture matters when it protects trust, enables growth, reduces future confusion, or preserves the product's point of view.

### 3. Product nuance correction

The most important correction was that the earlier framing did not capture Teajia as equally art and science.

The user clarified that the product has a subtle dimension of taste and intention that purely mechanical engineering recommendations miss.

This changed the assessment criteria:

- Architecture is not only about clean code.
- UI is not only about usability.
- Content is not only CMS data.
- Commerce is not only checkout.
- Personal records are not only retention mechanics.
- Network growth is not only multi-tenancy.

The product must preserve the feeling of a curated tea practice.

### 4. Deeper code and documentation pass

A broader review of docs and code produced the following understanding:

- Teajia is infrastructure for the global tea community.
- It is not SaaS, franchise, wellness app, social network, or commodity commerce.
- Adrian's curation is the engine.
- WhatsApp checkout is intentional because every order is a personal conversation.
- The app works before and after tea sessions, never during them.
- The long-term trajectory is a foundation and a tea lineage network.
- The strongest product pillars are tools, sourcing, education, scaffolding, and community.

### 5. Current request: persistent planning documents

The current request was to play back the purpose, how the product is being built, and where attention should go next, then document the whole thread in structured planning docs with product requirements and implementation details.

This packet is the result:

- `product-architecture-initiative.md`
- `product-architecture-prd.md`
- `product-architecture-implementation.md`
- `product-architecture-discussion-log.md`

## Product Understanding Captured

### Teajia's purpose

Teajia turns tea practice into infrastructure without losing the human center of tea.

It helps people source, prepare, learn, host, buy, remember, and eventually belong to a trusted network of tea spaces. It should make the practical work easier while protecting the presence, slowness, and care that make tea meaningful.

### How Teajia is being built

The build strategy is:

1. Make the app excellent for Adrian's daily workflow.
2. Onboard trusted users and tea friends.
3. Turn real editorial content into public authority.
4. Harden multi-account and network infrastructure.
5. Open sourcing, wholesale, and operator tools to trusted partners.
6. Let guest portability, contributor recognition, and network discovery grow from real use.

### Where attention belongs

Attention should go to the places where product meaning can drift:

- Tea identity versus tasting experience.
- Editorial publication versus generic CMS.
- Personal memory versus engagement mechanics.
- Inquiry commerce versus checkout optimization.
- Network lineage versus marketplace or franchise.
- Admin curation studio versus generic SaaS dashboard.
- Trust-gated wholesale versus open catalog.

## Codebase Findings Discussed

### Strong foundations

- `docs/VISION.md` clearly defines the product philosophy.
- `docs/NETWORK_UI_BRIEF.md` contains unusually specific interface and product rules for network surfaces.
- `docs/TASTING_JOURNAL_BRIEF.md` protects personal tea memory from becoming quantified self.
- `docs/MAGAZINE_PLAN.md` defines a distinct magazine experience instead of a blog.
- `src/designTokens.ts` contains real design-system intent, including editorial calm and typography roles.
- `worker/src/index.ts` already has `getActiveAccount` and `requireBundle`.
- Network tables and routes exist for tea profiles, product listings, adoption, wholesale, and account relationships.
- Existing Playwright tests cover important UI health and mobile regressions.

### Documentation drift

Several docs describe earlier states of the code:

- Some roadmap items describe multi-account as future even though account and bundle infrastructure is partly present.
- Some design-system debt described in older docs has been addressed and `lint:colors` passes.
- Some admin and worker indexes appear stale relative to current route/auth code.
- Some active brief references point to moved or archived documents.

Conclusion: docs are a strength, but they need a current initiative layer that connects philosophy, product requirements, and implementation.

### Worker and backend risks

The Worker is powerful but too concentrated:

- `worker/src/index.ts` is 15,776 lines.
- Routing, authorization, SQL, network logic, audit logging, events, articles, and account logic share one large file.
- Authorization exists, but route requirements are not declarative.
- Some SQL filters are interpolated from request parameters and should be parameterized or strictly whitelisted.
- Migration history contains duplicate numbering and recovery migrations, which increases fresh-environment risk.

### Frontend state risks

Account and user state need stronger boundaries:

- React Query cache is persisted globally under `teajia-query-cache`.
- Admin query keys such as `['products']` are not account-scoped.
- Zustand persists global, account, and personal state together under `teajia-storage`.
- Account switching updates active account state optimistically and should be paired with cache invalidation or namespacing.

### Editorial risks

The magazine ambition is real, but contracts are split:

- Public article types and admin article types diverge.
- Reader/rendering supports richer article forms than the editor exposes.
- The editor can become a bottleneck on editorial quality if it cannot represent the magazine's intended range.

### Personal memory risks

The tasting journal needs a consistent product posture:

- AccountPanel journal behavior is closer to a calm personal record.
- Other tasting surfaces include filters, sorting, stats, archive, and sharing patterns that may be useful but can drift toward dashboard/productivity language.
- The product should define which richer controls belong in power-user contexts and which should stay out of the core personal memory experience.

### Network risks

The network direction is strong but sensitive:

- Canonical tea profiles and per-account listings are the right model.
- The legacy `products` model still coexists with the new model.
- Attribution, trust tiers, bundle access, and wholesale access must remain visible and enforceable.
- Network UI must not look like a marketplace.

## Decisions Captured

| Decision | Rationale |
|---|---|
| Preserve WhatsApp/inquiry commerce | Personal confirmation is part of the brand and service model |
| Keep app away from the tea table | Presence is the product during practice |
| Treat magazine as publication, not blog | Editorial authority is a primary trust engine |
| Separate tea identity from tasting experience | Protects canonical truth and personal memory from corrupting each other |
| Keep personal tea memory private and calm | Retention should come from accumulated meaning, not engagement pressure |
| Harden account and bundle boundaries before network growth | Trust fails quickly if partner data or privileges leak |
| Use human curation before algorithmic recommendation | At current scale, Adrian's taste is more valuable than computed suggestions |
| Treat partners as autonomous houses, not franchisees | Lineage model preserves identity and makes Teajia a quality signal |

## Open Questions

1. Where should the canonical product ontology live: ARCHITECTURE.md, a new domain model doc, TypeScript comments, or all three?
2. Which article templates are keepers for launch-quality magazine publishing?
3. Should the richer tasting journal controls remain in a separate advanced view, or be redesigned to match the quieter journal brief?
4. What is the exact migration path from legacy `products` to `tea_profiles` plus `product_listings`?
5. Which admin route should own `/admin/activity`?
6. How should guest-local memory become authenticated member memory without making sign-up feel required?
7. What is the first public network surface that should ship: directory, partner listings, wholesale catalog, or contributor profiles?
8. Which docs should be archived after this initiative becomes the current source of truth?

## Action Inventory

Immediate:

- Review and accept or revise this planning packet.
- Create a domain glossary.
- Inventory route authorization and client state scopes.
- Fix unsafe SQL filters.
- Add account-scoped query key helpers.

Next:

- Unify article block contracts.
- Curate magazine templates.
- Harmonize personal tea memory surfaces.
- Add route/bundle authorization tests.
- Verify migration replay strategy.

Later:

- Contributor workflow.
- Guest portability.
- Network directory.
- Wholesale-to-listing import polish.
- Foundation reporting model.
