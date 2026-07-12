# Handoff to fresh chat — refine the Teajia collection build-and-send flow

Open a new chat in the teajia project and paste the block below. The copy button on the code fence grabs it cleanly.

```
Refine the Teajia collection build-and-send flow. The spec is at todo/plans/collection-flow-refinement.md — read it first; it has a dated 2026-06-01 audit-deltas section mapping the exact current code with file:line references.

This is UX refinement, not new capability. The recommendation feature (per-item amount + price, quantity-scaling, the draft-order reply loop) is already shipped and committed — do not rebuild or re-litigate it.

Before touching code, read in this order:
1. todo/plans/collection-flow-refinement.md (the spec + audit deltas).
2. The "Collections" and "Cancel / Back / Close button rules" and "MANDATORY styling rules" sections of teajia/CLAUDE.md.

You do not need to re-survey the flow — a previous chat mapped it on 2026-06-01. The two share UIs (AddPublicationSheet in CollectionEditView, CollectionShareSheet in InventoryView), the "Shared with" send trigger, and the Orders draft-reply landing are all documented in the spec with line numbers.

The core problems, in priority:
1. The owner cannot find where to send a collection — the trigger hides under a passive "Shared with" heading and there is no cue after building that says now send this. Make send discoverable and connected to the end of building.
2. The two share UIs diverge — reconcile them or at least their labels so sending feels like one consistent action from either entry point.
3. Building is tedious — consider defaulting the per-item price from the catalog price, and a sensible default amount, so most rows need no typing. Confirm with the user before changing what a blank price field means, since the worker already treats blank as use-catalog.

Walk the real flow before changing anything: build a collection, send it, watch the reply land as a draft in Orders. Then refine. Land small obvious wins directly; confirm direction with the user before large structural changes.

Success criteria: npm run lint, npm run lint:colors, and npm run test:mobile all pass. Verify on the live flow, not just types. Send a clickable dev-server URL (http://localhost:7777) when there is something to look at.

Hard rails:
- No popup questions — present every fork as plain numbered prose with a recommendation, and let the user answer freely.
- No em-dashes anywhere. No text-white or bg-white. No bright borders on pills or badges. Use tea-* tokens and the text-ui-N scale only.
- Never change nav links, tab labels, or routing without explicit confirmation.
- Run npm run lint:colors before any commit.

After the refinements land and verify, stop and report. Do not start follow-up work.
```

---

## Context for after (Adrian's reference only, not for the fresh chat)

This refinement is tracked in teajia/TODO.md territory; the plan lives at todo/plans/collection-flow-refinement.md. Once the flow is smooth, the natural next step is your first real send to an actual person. The price-scaling and draft-reply loop are already done and live (prod DB has the columns), so nothing blocks a real send once the build/send UX feels right.
