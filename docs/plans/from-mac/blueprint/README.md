# Teajia screen and content blueprint

Start with the [interactive flowchart](flowchart.html) to see where work changes hands, and the [whole-site completion checklist](CHECKLIST.md) to see what is finished, assigned or still open. The [delivery register](DELIVERY.md) tracks the findings and their proof. The [controller handoff](CONTROLLER.md) is the entry point for coordinating the whole site. Select a journey and highlight gaps, then choose an arrow or an item in **Handoffs to check** for evidence and the next check.

The supporting [screen reference](wireframes.html) shows desktop and phone layouts. **Current** is traced from existing code or observed behavior. **Partial** has an existing screen with an incomplete handoff. **Reference** is a private, legacy or comparison surface. **Proposed** needs a product or implementation decision.

## Read the evidence by area

| Area | What to inspect |
|---|---|
| [Editorial and Read](editorial.md) | Public issue and story inventory, actual publication state, all reader formats, editorial surfaces, private delivery, contributor/media, D1 and Wordforge drafts. |
| [Magazine source and edition register](source-register.md) | Actual private story families, *Repair and Continuity*, draft and photo gaps, vault and AR Create ownership, editorial review, intake, and feedback. |
| [Public and member journeys](public.md) | Home, Craft/Wisdom, Advise, Shop, People/Places, events and tasting, Your Table, identity, share routes, Atlas, guest and permission states. |
| [Manage and platform](manage.md) | Curate and Library, purchase logistics, Stock, Sales, customers/suppliers, sessions and venues, account access, people/publishing entry points, tools, platform and fallback routes. |
| [Tea in hand to Shop](tea-to-shop.md) | Phone walkthrough and acceptance script for a new sample or saved tea through tasting, quote or invoice, order, freight, counted receipt, Stock and Shop. [Description handoff](tea-description.md) |
| [Consolidation](consolidation.md) | What is necessary, where canonical files live, what can be archived, proven duplicate bytes, cleanup prerequisites and a full tracked-file index. |

The shorter [working plan](../../WORKING_PLAN.md) owns priorities and release gates. This pack supplies the detailed visual and source evidence. The [route crosswalk](route-crosswalk.md) reconciles code route patterns with screen IDs. Read the [independent review](review.md) for the identity, revision and proof requirements that determine the first build slices.

## Connections that determine the build order

| Handoff | Identity that should survive | Existing attachment | Gap and proof |
|---|---|---|---|
| Trip → tea → purchase → physical stock | Account + Compass tea + supplier + purchase line + receipt line + movement + product | Confirmed orders connect expected receipts and private Stock drafts. Physical receipt records the movement. Exact-revision local tests cover receipt retry and supplier-sheet behavior. | Use the same physical phone and example through partial receipt, runtime voice retry, legacy-match handling and accurate remaining balance. Trace expected arrivals separately from counted stock. |
| Stock → Shop → payment and dispatch | Product + store + inquiry/order + invoice line + payment and stock movement | Tenant cart writes a pending inquiry/draft before optional WhatsApp. Payment and dispatch are distinct. | Enforce the approved name/type/price/count gate across first-publication entry points. Do one real sale in the intended store. Verify contact, paid allocation, shipment, buyer visibility, refund/cancellation and sold-out continuity. |
| Source → edition → editor → issue → feedback | Source family + stable output identity + exact revision + article/public address + issue slot + scoped correction | Curated publication and D1 article paths exist. The private issue index is separate. Wordforge can send D1 drafts by source/revision. | Fix renderer parity and validate contributor and media references. Compare revisions atomically on sync and exact-revision approval across publishing doors. Keep approved A live while incoming B waits for review. Verify scoped issue placement, resync, replacement and resource-specific withdrawal. |
| Tea source → knowledge and art direction | Reviewed private source → canonical tea or knowledge relation → approved public field | AR Create’s tape/passages connector and Build this tea share a reviewed private evidence path. Wisdom has typed relations. | Join one tea to one reviewed Craft or Read destination. Public copy, facts, media rights and private source evidence remain separately approved. Licensed Atlas stays independent. |
| Public event → host → guest memory or approved recap | Event + RSVP/attendee + optional structured tasting + recap or note | RSVP, host tools, recap, private tasting memory, and event-to-draft exist. | Reconcile host close-out state with participant experience and recap. Decide whether the chosen event bills anything. Avoid matching people by display name and avoid duplicate draft sales or stock effects under retry. |
| Guest → member → second operator | Global person ID + explicit selected account and membership + scoped records | Member and guest claims, private records and network tools exist. | Verify cross-device claims and their intended landing surfaces. Prove user and account boundaries on the first real second-shop lifecycle, including invited identity, bilateral invoice and receipt. |
| Candidate → public build → working reality | Immutable commit + Worker runtime + Pages build + bytes + independent usage evidence | Release receipt proves live build `1m0md3pmvx` at `94dc1a5e`. Focused browser fixtures passed. | General CI on that revision failed the Curate long-file limit in the source unit step. Restore it in a scoped follow-up with normal gates. Record actual launch validation separately. [Live proof](https://github.com/storyoftheleaf/teajia/actions/runs/44022566874) · [General CI](https://github.com/storyoftheleaf/teajia/actions/runs/44023062406/job/133841325571) |

## Delivery checkpoints

1. **Prove the existing operating spine.** Repair the existing Curate source CI gate. Using approved Curate and Library, verify a physical arrival and preserve phone density. Enforce first-publication parity before taking the controlled public sale through payment, movement, fulfillment and the buyer view.
2. **Prove one issue item end to end.** Reuse the existing vault workflow and assess the Wordforge sender and receiver. Use a synthetic item with two revisions, explicit placement and verified credits. Publish A, accept B as a draft, refuse stale approval of A, approve a deliberate replacement, then prove what withdrawal does to each public resource. Select an authorized real keeper after that technical pass. See the [proposed review wireframe](wireframes.html#ed-review).
3. **Complete connecting experiences.** Finish host close-out and ordinary vs structured tasting follow-up, linked reader/reference paths and deliberate member destinations. Favor openings, states and controls people need in real workflows.
4. **Trim after coverage.** Keep live assets, data, routes and approved design comparators until their consumers are known. Choose exact archive/removal candidates from the file register. Prove the transition with build, migrations, asset delivery, reference links and workflow tests as applicable.
5. **Expand after stable operation.** Use the real operator and two-account launch checks. The product can make scoped releases along the way under its existing authorization and proof process.

## Maintain the atlas

Edit the matching group JSON alongside its evidence document, then run `python3 planning/blueprint/build-atlas.py`. A layout row is one string, with ` | ` between side-by-side regions. The build validates identifiers, both device layouts, states and handoff IDs, and embeds the data in the offline HTML. It requires no API key, network source, or library install. Run `python3 planning/blueprint/index-files.py` to refresh the tracked-file register. File inventory reflects the Git index, so pending worktree and untracked files are accounted for separately in the consolidation notes.
