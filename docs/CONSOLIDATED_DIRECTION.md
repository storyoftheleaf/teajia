# Teajia: consolidated direction

> The single directional list: every plan, filed under the section it belongs to, with its status and next step. Rewritten 2026-11-25 around the section overhaul proposed in [SECTIONS.md](SECTIONS.md). The sections named here are the proposed ones. The site as it runs today is in [PILLAR.md](PILLAR.md).

**Updated:** 2026-11-25. Statuses come from each file's own text and a read of the code on that day. Where a status could not be checked it says so.

## Which document owns what

| Question | The answer lives in | Note |
|---|---|---|
| What is the site and how does it work today | [PILLAR.md](PILLAR.md) | Kept true in the same commit that changes the site |
| What shape should the sections take | [SECTIONS.md](SECTIONS.md) | A proposal until Adrian says yes |
| Where is every plan and what is next for it | This file | An index, not a second roadmap |
| What is the priority and what gates a release | `WORKING_PLAN.md`, dated 2026-11-17 | On Adrian's Mac, not yet in the repo. See the last section |
| What has been proven in real use | [LAUNCH_VALIDATION.md](LAUNCH_VALIDATION.md) | The only launch checklist |
| What shipped | [CHANGELOG.md](CHANGELOG.md) | |
| What just came in | [TODO.md](../TODO.md) | Intake only |
| Why Teajia exists | [VISION.md](VISION.md) | Philosophy stands, details are from April |

## Current position

Per the working plan of 2026-11-17 and the closeout plan of 2026-11-24, the priority has not changed with this overhaul:

1. Finish one real shop loop for Adrian: a tea from a supplier's quote through purchase, partial arrival and stock, then a real sale through payment, shipment and the buyer's view (M1 to M4 in the working plan).
2. Prove one editorial item end to end (K1).
3. Qualify the connected sit, the Guest Book and the personal seller with one real sit and one real sale.
4. Only then a second operator and the wider network (N1).

The section overhaul sits beside that work and does not jump the queue. Its first two stages are pages and forwards with no new backend. The bar words change late, after the evidence from a real sit, as the closeout plan asks.

## The direction, section by section

### The whole site

| Plan or document | Status | Next step |
|---|---|---|
| [SECTIONS.md](SECTIONS.md) | Proposed 2026-11-25 | Adrian answers the seven open decisions, the first two before anything else |
| [PILLAR.md](PILLAR.md) | Live | Reword in the commit that ships each stage |
| [SITE_MAP.md](SITE_MAP.md) | Partly stale, marked | Regenerate the Manage and navigation parts from code |
| [VISION.md](VISION.md), [brief/PERSONAS.md](brief/PERSONAS.md) | Live as philosophy, April detail, marked | No rewrite needed for the overhaul |
| [TEAJIA_WORKING_BRIEF.md](TEAJIA_WORKING_BRIEF.md) | Live (August) | Add the Tea Table exception by name once confirmed |
| [STATE_OF_THE_SITE.md](STATE_OF_THE_SITE.md), [FLOWS.md](FLOWS.md) | Stale, marked | Leave as history |
| [LAUNCH_VALIDATION.md](LAUNCH_VALIDATION.md) | Live, launch incomplete | Record the real sale and real sit there |
| [todo/plans/launch-photo-upload.md](../todo/plans/launch-photo-upload.md), [OWNED_MEDIA_INVENTORY.md](OWNED_MEDIA_INVENTORY.md) | Live | Adrian's photographs. Tea Houses needs its share first |
| [AUDIT-2026-09.md](AUDIT-2026-09.md), [audits/](audits/), [todo/plans/prime-time-audit.md](../todo/plans/prime-time-audit.md), [prime-time-fixes.md](../todo/plans/prime-time-fixes.md) | Done | History |

### Read (stories, Craft, Wisdom)

| Plan or document | Status | Next step |
|---|---|---|
| [tracks/01-launch-integrity.md](tracks/01-launch-integrity.md) | Live | Close the saved-story question and the owner controls on cold load (K2) |
| Magazine lines in [TODO.md](../TODO.md) | Live, need Adrian | Names, photographs, the feedback message to each subject, the shared conversation template |
| [audits/2026-11-05-editorial-confidentiality.md](audits/2026-11-05-editorial-confidentiality.md) | Candidate, not deployed | Owner acceptance |
| [todo/plans/brewing-guides.md](../todo/plans/brewing-guides.md) | Live, not started | Choose the first guide (K4). Adrian writes the words |
| Craft lines in [TODO.md](../TODO.md) | Live, need Adrian | Which draft essays go live; playlists |
| [TEA_WISDOM_BASE.md](TEA_WISDOM_BASE.md), [tracks/09-tea-wisdom-base.md](tracks/09-tea-wisdom-base.md) | Live. The track was listed as retired in July and its file still carries open items | Confirm whether track 9 is open. The four plans below are the working queue |
| [todo/plans/tea-wisdom-publishing.md](../todo/plans/tea-wisdom-publishing.md), [tea-wisdom-composed-entry.md](../todo/plans/tea-wisdom-composed-entry.md), [tea-wisdom-all-teas.md](../todo/plans/tea-wisdom-all-teas.md) | Live. Eight teas live since 2026-11-24 | Settle the five held ripe teas, then corrections and intake |
| [todo/plans/tea-wisdom-pilot-action-plan.md](../todo/plans/tea-wisdom-pilot-action-plan.md) | Mostly superseded, marked | Read composed-entry first |
| [todo/plans/mood-flavor-taxonomy.md](../todo/plans/mood-flavor-taxonomy.md) | Live, not started | Waits on Wisdom |
| [TEA_ATLAS.md](TEA_ATLAS.md), [tea-atlas-plan.md](../tea-atlas-plan.md) | Shipped and private. The plan's header is stale, marked | The Atlas lines in TODO |
| [_notes/](_notes/) Wisdom notes | Mostly history. `tea-wisdom-claims.md` and `tea-wisdom-research-prompt.md` are live | None |
| **Overhaul work:** the shelf row across Read, Craft and Wisdom; renaming Craft's "Shared Wisdom" view | Proposed | Stage 6 of SECTIONS |

### Tea Table (the stream, Sessions, People)

| Plan or document | Status | Next step |
|---|---|---|
| [todo/plans/tea-table.md](../todo/plans/tea-table.md) | Proposed 2026-11-25 | Adrian's yes on the name, the address and the rule exception |
| [todo/plans/teajia-family.md](../todo/plans/teajia-family.md) | Built and merged to main (pull request 452, 2026-11-21). The file's own header still says "Not live" | One status line. Then the storage reading, the lawyer's read, Adrian's ship and live proof |
| [superpowers/specs/2026-08-10-events-platform-rebuild-design.md](superpowers/specs/2026-08-10-events-platform-rebuild-design.md) | Approved. Release 1 built | Host close-out and billing policy (E2) |
| [plan/event-system-v2.md](plan/event-system-v2.md) | Partly superseded by the spec above, marked | History and design tone |
| [todo/plans/tasting-tighten.md](../todo/plans/tasting-tighten.md), [manage-rebuild-decisions.md](../todo/plans/manage-rebuild-decisions.md) | Live | Tasting decisions of 2026-11-16 stand |
| [tasting-v2/](tasting-v2/) | A separate preview, on purpose not connected | Do not connect without new instruction |
| [todo/plans/creator-profiles.md](../todo/plans/creator-profiles.md) | Public page shipped 2026-09-21, tail open | Real portraits |
| [todo/plans/tea-master-onboarding.md](../todo/plans/tea-master-onboarding.md), [tea-master-editing-boards.md](../todo/plans/tea-master-editing-boards.md) | Invite built; boards parked ("too styled") | Decide the person-first invite (N1) |
| [CONTRIBUTOR_EDITOR.md](CONTRIBUTOR_EDITOR.md) | Live | None |
| creator-profiles design brief, fixtures, migration preview in `todo/plans/` | Done | History |
| Connected sit, Guest Book, sit recap | Released per the closeout plan; a real sit still owed | Choose one real sit, host and guest group |

### Tea Houses (build, work, visit, work with Adrian)

| Plan or document | Status | Next step |
|---|---|---|
| [todo/plans/tea-houses.md](../todo/plans/tea-houses.md) | Proposed 2026-11-25. The first plan for the offering | Adrian's facts about the offering, in one sitting |
| [superpowers/specs/2026-08-10-advise-service-ledger-design.md](superpowers/specs/2026-08-10-advise-service-ledger-design.md) | Built | Advise stays as "work with Adrian" |
| Advise lines in [TODO.md](../TODO.md) | Live, need Adrian | Photographs; the portfolio moves to Tea Houses, Work |
| [MULTI_STORE_PLAN.md](MULTI_STORE_PLAN.md) | Shipped. Reference | An account is a tea house. No change |
| [AUSTRALIA_LAUNCH_PLAYBOOK.md](AUSTRALIA_LAUNCH_PLAYBOOK.md), [OPENING_STOCK_CSV_GUIDE.md](OPENING_STOCK_CSV_GUIDE.md), [STORE_OPERATOR_DAILY_WORKFLOWS.md](STORE_OPERATOR_DAILY_WORKFLOWS.md), [MEMBERS_AND_ACCESS_GUIDE.md](MEMBERS_AND_ACCESS_GUIDE.md) | Live guides | The first real second house (N1) |
| [NETWORK_UI_BRIEF.md](NETWORK_UI_BRIEF.md), [PLAYBOOK_SURFACE_PATTERN.md](PLAYBOOK_SURFACE_PATTERN.md) | Built | Reference |
| [todo/plans/connections-page.md](../todo/plans/connections-page.md) | Superseded by SECTIONS if Adrian agrees, marked | People go under the Tea Table, places under Tea Houses |

### Shop

| Plan or document | Status | Next step |
|---|---|---|
| Shop lines in [TODO.md](../TODO.md) | Live, need Adrian | Placeholder stock counts, US shipping rate, Teaware and Sets tabs, sets that cannot be bought |
| [design/catalog-listing-hierarchy.md](design/catalog-listing-hierarchy.md), [catalog-listing-field-guide.md](design/catalog-listing-field-guide.md), [PRODUCT_DESCRIPTION_STYLE.md](PRODUCT_DESCRIPTION_STYLE.md) | Live, approved | None |
| [superpowers/specs/2026-08-10-shop-refinement-design.md](superpowers/specs/2026-08-10-shop-refinement-design.md) | Partly built | Check what is left against the live shop |
| [PAYPAL_LIVE.md](PAYPAL_LIVE.md), [US_SHIPPING.md](US_SHIPPING.md), [SHIPPING_PAYMENT_NOTIFICATIONS.md](SHIPPING_PAYMENT_NOTIFICATIONS.md), [WHATSAPP_ORDER_SETUP.md](WHATSAPP_ORDER_SETUP.md) | Live | The first real paid order (M3) |
| [todo/plans/collection-flow-refinement.md](../todo/plans/collection-flow-refinement.md) | Probably stale (June). Not checked | Compare with the live collections before reuse |
| **Overhaul work:** "ask Adrian to find a tea" in Shop; links to the Tea Table and Tea Houses | Proposed | Small, after stage 3 |

### Your Table

| Plan or document | Status | Next step |
|---|---|---|
| [todo/plans/your-table.md](../todo/plans/your-table.md) | Proposed 2026-11-25 | Adrian's yes on the page |
| [tracks/05-curate-tea-memory.md](tracks/05-curate-tea-memory.md) | Live | Member tea memory, share claims (P1) |
| [TEA_DISCOVERY.md](TEA_DISCOVERY.md) | Phases 1 and 2 shipped | None now |
| [superpowers/specs/2026-07-13-your-table-account-context-design.md](superpowers/specs/2026-07-13-your-table-account-context-design.md) | Done | History |
| Tea Chest and personal seller | Built per the closeout plan, in review | One real seller trial. Route stays until Adrian decides |

### Manage

| Room | Plans | Status | Next step |
|---|---|---|---|
| All rooms | [todo/plans/manage-rebuild.md](../todo/plans/manage-rebuild.md), [manage-rebuild-decisions.md](../todo/plans/manage-rebuild-decisions.md) | Live, wave 1 landed | The phone walk from quote to stock (M1) |
| Curate | [todo/plans/curate-next.md](../todo/plans/curate-next.md), [curate-one-home.md](../todo/plans/curate-one-home.md), [curate-v2-journeys.md](../todo/plans/curate-v2-journeys.md), [curate-fix-now.md](../todo/plans/curate-fix-now.md), [CURATE_WORKSPACE.md](CURATE_WORKSPACE.md), [CURATE_CONSUMER_CONTRACT.md](CURATE_CONSUMER_CONTRACT.md), [TEA_RECORD_CONNECTIONS.md](TEA_RECORD_CONNECTIONS.md), [agents/CURATE-AGENTS.md](agents/CURATE-AGENTS.md) | Live. Note: the working plan says current Curate is the working room and v2 is a reference, while curate-one-home plans the switch to v2 | Adrian settles which is the home |
| Curate, older | [todo/plans/curate-capture-restyle.md](../todo/plans/curate-capture-restyle.md), [curate-capture-amazing.md](../todo/plans/curate-capture-amazing.md) | Superseded, marked | History |
| Curate, purchases | [PURCHASE_LOGISTICS.md](PURCHASE_LOGISTICS.md), [LOGISTICS_TRACKING_UPDATES.md](LOGISTICS_TRACKING_UPDATES.md), [build-plan.md](build-plan.md), [invoice-intake-flow.md](invoice-intake-flow.md) | Live reference | Older unmatched purchases (M2) |
| Stock | [todo/plans/stock-phone-by-supplier.md](../todo/plans/stock-phone-by-supplier.md) | Live, five stages | Supplier grouping and scroll return (M5) |
| Stock, older | [todo/plans/stock-spine.md](../todo/plans/stock-spine.md) (done), [stock-discoverability.md](../todo/plans/stock-discoverability.md) and [intake-batches.md](../todo/plans/intake-batches.md) (June, not checked) | Done or old | History unless a gap shows |
| Sales | [todo/plans/sales-rebuild-salvage.md](../todo/plans/sales-rebuild-salvage.md) | Partly done | Reference for a shown gap only |
| People | [plan/customer-contact-taxonomy.md](plan/customer-contact-taxonomy.md) | Old (May) | None |
| Sessions | See Tea Table above | | |
| Publish | See Read above. **Overhaul work:** hide and restore for Tea Table items in Guest notes | Proposed | Tea Table stage 4 |
| Settings | [MEMBERS_AND_ACCESS_GUIDE.md](MEMBERS_AND_ACCESS_GUIDE.md), [todo/plans/mobile-oauth.md](../todo/plans/mobile-oauth.md) | Live; the second is blocked on one phone screenshot | The screenshot |

The seven rooms do not change in this overhaul.

### Platform (under every section)

| Plan or document | Status | Next step |
|---|---|---|
| [tracks/08-platform-hardening.md](tracks/08-platform-hardening.md) | Live, one item waits on Adrian | The Sources and Personal navigation approval |
| [ARCHITECTURE.md](ARCHITECTURE.md), [OPERATIONAL_NOTES.md](OPERATIONAL_NOTES.md), [VERIFIED_RELEASES.md](VERIFIED_RELEASES.md), [claude/](claude/) | Live reference | None |
| Money and schema lines in [TODO.md](../TODO.md) | Live | Cost currency per vendor first |
| [incidents/](incidents/), [todo/plans/curate-holdings-d1-reads-measurement.md](../todo/plans/curate-holdings-d1-reads-measurement.md), [todo/plans/deploy-db-migrations.md](../todo/plans/deploy-db-migrations.md) | Done | History |
| [superpowers/plans/](superpowers/plans/) and [superpowers/specs/](superpowers/specs/) not named above | Done, July and August | History |
| [plan/product-architecture-phase-0-inventory.md](plan/product-architecture-phase-0-inventory.md), [plan/product-architecture-route-auth-inventory.md](plan/product-architecture-route-auth-inventory.md), [INTAKE_BUILD_RESUME.md](INTAKE_BUILD_RESUME.md), [fable-brief.md](fable-brief.md), [fable-brief-addendum.md](fable-brief-addendum.md), [NETWORK_ERROR_REMOVAL_PLAN.md](NETWORK_ERROR_REMOVAL_PLAN.md) | Old or done | History |

## Engineering tracks

The July list named three active tracks and they still stand as files: [01 Launch Integrity](tracks/01-launch-integrity.md) under Read, [05 Product and Curate Integrity](tracks/05-curate-tea-memory.md) under Your Table and Manage, [08 Platform Hardening](tracks/08-platform-hardening.md) under Platform. Track 9 is filed under Read with its question open. The working plan's M, K, E, P, R and N items are the current delivery queue and take precedence over the tracks where they differ.

## Stale and superseded documents, marked on 2026-11-25

Each carries a one-line banner under its title. None was deleted.

| Document | Marked as | Read instead |
|---|---|---|
| [SITE_MAP.md](SITE_MAP.md) | Partly stale: Manage rooms, navigation, several routes | [PILLAR.md](PILLAR.md), [SECTIONS.md](SECTIONS.md) |
| [FLOWS.md](FLOWS.md) | Stale: the "Tea Practice OS" framing and its personal timeline | [PILLAR.md](PILLAR.md), [SECTIONS.md](SECTIONS.md) |
| [STATE_OF_THE_SITE.md](STATE_OF_THE_SITE.md) | Stale: verified 2026-08-10 | [PILLAR.md](PILLAR.md), this file |
| [VISION.md](VISION.md) | Philosophy stands; "what exists" lists are from April | [PILLAR.md](PILLAR.md) |
| [brief/PERSONAS.md](brief/PERSONAS.md) | April; persona 3 now has a plan | [tea-houses.md](../todo/plans/tea-houses.md) |
| [MULTI_STORE_PLAN.md](MULTI_STORE_PLAN.md) | Pointed at a track file that does not exist | [tea-houses.md](../todo/plans/tea-houses.md), this file |
| [plan/event-system-v2.md](plan/event-system-v2.md) | Partly superseded | The 2026-08-10 events spec |
| [tea-atlas-plan.md](../tea-atlas-plan.md) | Header said "nothing built"; the Atlas shipped | [TEA_ATLAS.md](TEA_ATLAS.md) |
| [HANDOFF-FRESH-CHAT.md](../HANDOFF-FRESH-CHAT.md) | Done; the slice shipped | [SECTIONS.md](SECTIONS.md) |
| [todo/plans/connections-page.md](../todo/plans/connections-page.md) | Superseded if Adrian agrees | [SECTIONS.md](SECTIONS.md) |
| [todo/plans/curate-capture-restyle.md](../todo/plans/curate-capture-restyle.md), [curate-capture-amazing.md](../todo/plans/curate-capture-amazing.md) | Superseded | [curate-next.md](../todo/plans/curate-next.md), [curate-one-home.md](../todo/plans/curate-one-home.md) |
| [todo/plans/tea-wisdom-pilot-action-plan.md](../todo/plans/tea-wisdom-pilot-action-plan.md) | Mostly superseded | [tea-wisdom-composed-entry.md](../todo/plans/tea-wisdom-composed-entry.md) |

Not marked, but known to lag: `README.md` (older route names), `docs/CAPABILITIES.md` (generated in September, regenerate), `src/components/AccountPanel/INDEX.md` (points at the stale site map).

## On Adrian's Mac, not yet in the repo

These were read for this rewrite from copies. None was copied into the repo. The standing rule is that a handoff is plain files on GitHub, so the recommendation for nearly all of them is to commit.

| File | What it is | Recommendation |
|---|---|---|
| `WORKING_PLAN.md` (2026-11-17) | Owns priorities and release gates: the system map, the journey table, the delivery queue M1 to N1 | **Commit.** Several repo documents defer to it and cannot link to it. Keep it at the root, outside the docs the app bundles |
| `planning/blueprint/README.md`, `public.md`, `manage.md`, `editorial.md`, `review.md` | The screen and content blueprint: every journey traced from code, with gaps | **Commit**, together, with their generator scripts and data files so they can be rebuilt |
| `planning/blueprint/route-crosswalk.md` | Generated map of every route to its screen | **Commit with the generator**, or not at all. A generated file with no generator goes stale silently |
| `planning/blueprint/consolidation.md` | What is canonical, what can be archived, cleanup order | **Commit.** It is the file-level partner of this document. Its claim that four overview docs "now route to the working plan" is not true in the repo yet |
| `planning/blueprint/CONTROLLER.md`, `BUILD_LIST.md`, `CHECKLIST.md` | Coordination between sessions: who owns what, what is next | **Commit after a read.** They hold links to one machine (localhost, a private network host, local chat threads) that mean nothing on GitHub; trim those or accept them as dead links |
| `planning/blueprint/DELIVERY.md`, `flowchart.html`, `wireframes.html`, `source-register.md`, `tea-to-shop.md`, `tea-description.md` | Referenced by the files above; copies were not supplied | **Commit with the rest of the pack**, after checking the source register holds nothing private about people in the magazine |
| `todo/plans/teajia-closeout-2026-11-24.md` | The current coordination record. Holds Adrian's "Let's not call it a T-Feed" and the note to decide on a Tea Table destination and on Craft | **Commit.** [tea-table.md](../todo/plans/tea-table.md) and SECTIONS rest on it |
| `todo/plans/teaware-photo-handoff.md` | Photo sorting and teaware intake results, 2026-11-23 | **Commit.** Files under Shop and Stock. It links to results kept in a local folder; say where those live |
| `outputs/sidebar-directions-2026-11-25/index.html` | The eleven rail directions; Adrian picked "Narrow B" | **Commit** as the record of the decision, and write the decision itself into [claude/layout.md](claude/layout.md) in one sentence |
| `todo/plans/tea-chest-tea-table/gaps-plan.md` and `buildout.md` | Linked from the closeout plan on two branches that are not on GitHub today | **Find and commit.** The Tea Table and Your Table plans should be reconciled with them before building |

## Guardrails

- Preserve inquiry-led commerce. No conventional automated checkout beyond what is live.
- Preserve human curation. No rankings, averaged reviews or recommendation engines.
- Journal, Favourites, Tea Chest and Curate stay separate records.
- No likes, follows, followers, comments, counts, streaks, badges, or engagement notifications. No phone-at-the-table modes.
- No feed, with one proposed exception: the Tea Table, a plain time-ordered page of what people chose to share, described in [SECTIONS.md](SECTIONS.md). It is not in force until Adrian confirms it.
- The people list keeps its one exception, order only (Adrian, 2026-11-21).
- No change to navigation words, tab labels or routes in the nav components without Adrian's explicit yes. SECTIONS is a proposal for exactly that reason.
- Local fixtures are not proof of real delivery, real data safety, mainland reach, operator ease, or a contributor's true voice.

## What counts as progress

One of four things: behaviour verified working; a real-world validation item completed; approved editorial material published through the real workflow; or a dead or contradictory surface retired. New roadmap prose does not count. This rewrite is filing, not progress, and the three new plans count only when Adrian has answered them.
