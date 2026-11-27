# Teajia controller handoff

**Start here when taking over the whole-site redesign, delegation, integration or release readiness.** Adrian wants to walk the site as connected journeys, reshape the structures that block those journeys, and work out the details before implementation agents take ownership. The magazine is one journey within that scope.

Open the [system flowchart](flowchart.html), then the [whole-site completion checklist](CHECKLIST.md). Use the [delivery register](DELIVERY.md) for decisions and proof, and the [working plan](../../WORKING_PLAN.md) for product intent and release rules. The [blueprint index](README.md) routes to screen, content and file evidence. Follow [repository instructions](../../AGENTS.md), including current authorization and existing approvals.

The [whole-site build list](BUILD_LIST.md) groups register items into builder assignments. Use it for sequencing, scope, reviewers and acceptance. Maintain decisions and closure evidence in the register.

**Adrian’s first walkthrough** · [Tea in hand to Shop](flowchart.html#tea-to-shop). Use the [phone completion path](tea-to-shop.md) and the [description handoff](tea-description.md). This spans tasting, existing or new tea identity, photo, supplier and quote or import, buying, logistics, counted receipt, private Stock and approved Shop publication. Coordinate the whole journey across builder scopes.

## Start a controller session

1. **Establish the baseline.** Inspect the current checkout, dirty files, active worktrees and the latest relevant test or release receipt. Distinguish current facts from November 17 observations, previews and proposals. Finish with the reference revision and write scope for the next slice.
2. **Work through the system with Adrian.** Open one journey at its breaking arrow. Show the observed path and its gap, the proposed structure, and the specific decision it changes. Record accepted choices and unresolved details in the [delivery register](DELIVERY.md). Start with the owner’s chosen journey. The magazine discussion left the first issue, keeper story and final approval role pending. Finish each discussion with a decided or explicitly open item, its next evidence, and what remains dependent on it.
3. **Turn decisions into bounded work.** For each slice, identify its normal entry, role, account and record identities, expected state transitions, neighboring handoffs, and proof. Apply approved behavior first. Split genuine independent domains. Finish with an owned work packet for each authorized slice. Keep speculative features and later expansion parked under their dependencies.
4. **Delegate and integrate.** Assign one owner per write scope, and one integration owner for shared routes, schemas, data and permissions. Give agents the task packet and the specific evidence chapter. Use a fast model for bounded inspection and a workhorse for implementation. Escalate reasoning when a cross-domain choice, privacy model or conflicting evidence can materially change the result. Integrate in dependency order and test the normal journey on the exact resulting candidate. Review accepted UI decisions at the matching phone and desktop state.
5. **Record proof and handle releases.** Update the register after integration or a meaningful blocker. External acceptance stays in [Launch Validation](../../docs/LAUNCH_VALIDATION.md). For an authorized release, use the [exact-revision handoff](../../docs/VERIFIED_RELEASES.md). Report persisted background publication and its resumption path, or an exact live build and its proof. Keep work moving independently of publication.

## Structures to review

| System | Preserve and clarify | First proof |
|---|---|---|
| Sourcing, purchases and physical stock | Keep the encounter, supplier, order and receipt lines, holding and movements linked under their existing owners. Make expected, in transit and counted visible as distinct states. | One actual phone capture and partial studio receipt, with the same draft and exactly one movement on retry. [Register](DELIVERY.md#operating-the-shop) |
| Stock, storefront and sales | Put the approved first-publication rule at every relevant write path. Carry one saved inquiry into the right account’s payment/dispatch and buyer view. | A controlled sale with correct units, payment, stock, fulfillment and customer visibility. |
| Source material, Magazine and Read | Keep source family, stable output, exact revision, public address and issue placement distinct. Bind approval to the reviewed revision. Preserve the current public edition when another arrives. | Synthetic A/B import, deliberate issue placement, rejected stale approval, replacement and resource-by-resource withdrawal. [Register](DELIVERY.md#editorial-and-knowledge) |
| Tea knowledge and public discovery | Keep private evidence, approved public wording, Wisdom/Craft relations and licensed Atlas access distinct. Let approved person/venue and content links reach their intended destination. | One authorized excerpt to an eligible public reference and a signed-in/signed-out Atlas check. |
| Host, guests and personal memory | Connect ordinary close-out, structured tasting, recap and private Journal or explicit Cellar paths. Keep event billing an independent product decision. | One ordinary and one structured session. Prove guest/share ownership and the actual save destination. [Register](DELIVERY.md#hosting-members-and-the-network) |
| Membership, network and trust | Keep person identity, membership and current store explicit. Validate access in UI, Worker and MCP. Preserve independent incident/recovery and release proof. | Verify denied/authorized cases, actual identity delivery and first operator. Rehearse second-shop and wholesale after first-operator readiness. [Register](DELIVERY.md#trust-and-release-evidence) |
| Files and history | Identify one owner per source or generated output. Trace current consumers before moving or removing anything. Keep private source records and reproducible release/migration inputs protected. | A bounded candidate with path list, consumer evidence, appropriate test/build and rollback. [Register](DELIVERY.md#file-and-system-consolidation) |

Start the operating lane with the source CI check, receipt proof and publication parity before a real paid sale. The editorial lane can design its revision/placement contract and run synthetic tests independently. Serialize edits that overlap the Worker entry point, schema or release files. Carry forward the approved Curate and Library baseline and existing navigation, money, migration-preview and visual review decisions.

## Ownership at dispatch

- **Operations lead** takes M1–M5 and C1. **Editorial lead** takes K1–K2. **Knowledge and discovery lead** takes K3–K5 and E1 with editorial review where content crosses surfaces.
- **Sessions and membership lead** takes E2, P1 and the operator experience for N1. **Platform and release lead** takes R1–R3 and signs off the account and Worker boundaries affected by other lanes.
- **Consolidation lead** inventories F1–F11 and hands any product-dependent cleanup to the owner of its runtime consumers. **Controller** owns the register, cross-lane integration, release authorization checks and evidence handoff. Adrian owns the choices listed under [decisions](DELIVERY.md#decisions-to-bring-to-adrian).

These are work scopes for assignment. Pick the fewest agents needed for the current slices. Assign a person or agent to an ID when dispatching it and record their candidate and proof in the delivery register.

## Work packet for a delegated agent

Give each agent only the applicable details.

- **Register ID and outcome.** What a person can do through the normal route, and which adjacent behavior stays protected.
- **Baseline and writes.** Candidate revision, assigned files or module, expected dependencies, integration owner.
- **Inputs and edge cases.** Fixture and existing record shape, role and tenant, old data, retry, partial completion or denied access.
- **Decision and evidence.** The accepted decision or unresolved question. Exact check that demonstrates completion and where its result goes.
- **Return.** Candidate/commit, files, checks and outcomes, concrete blockers, and remaining proof. UI changes include the applicable screenshots.

## Fresh controller prompt

> Take over Teajia as the whole-site controller. Read `planning/blueprint/CONTROLLER.md` and the linked delivery register first. Reconcile the exact current baseline. Use the flowchart to work with Adrian on structural decisions across operating work, publishing, members, sessions, access, release and cleanup. Record each decision and proof in the linked authority. For authorized implementation, delegate independent packets with explicit ownership and integrate against the actual journey. Report remaining verification and approval gates with evidence. Apply existing release authorization and exact proof procedure. Begin by stating the current baseline and opening the next journey for review.
