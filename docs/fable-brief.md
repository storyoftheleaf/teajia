# Fable Brief — Teajia Receipt-to-Inventory: Flow + UX + "think bigger"

You are reviewing an end-to-end workflow for a specialty tea shop (Teajia). The full
working document is `docs/invoice-intake-flow.md` in this repo — read it first. That
doc describes the flow as-is and a draft UX vision. Your job is to go beyond it.

## The essence of the task
Adrian takes a photo of a tea receipt and wants the teas to land correctly in his
inventory (and, when he chooses, be publishable to the shop) with minimal friction,
no duplicates, and none of his money/quantity/description recorded wrong.

## What to deliver
Do THREE things:

### 1. Evaluate & fix the documented flow
Walk through `docs/invoice-intake-flow.md` step by step. Confirm it reflects the real
system (verify against the code it cites). Correct anything inaccurate. Identify
actual holes, races, or dead-ends in the process and propose concrete fixes.

### 2. Improve the UX — make it a genuinely good experience
The doc has a "UX — how it should FEEL" section with 8 principles. Take them further.
Design the ideal **walkthrough layout / interaction flow**: how to break the import
into digestible screens or sections, how to make per-item review fast, how to make the
existing-product matching a confident one-touch decision, and how to make finalize +
post-finalize (view on store) feel clean. Reuse what exists (the "Shop" preview button,
the batch-review model) rather than rebuilding.

### 3. "Think bigger" — propose things Adrian may not have thought of
Go beyond what the doc asks. Look for:
- **Ways to make the whole thing better that weren't asked for.** e.g. better visual
  confirmation, templates/presets for the common cases, keyboard-first or one-click
  paths, bulk actions, mobile-friendly intake (taking the photo on the phone), surcharge
  /fixed-cost amortisation, batch-vs-one pricing, "recent purchases from this vendor"
  quick-pick, smart default associations, a "everything is fine, just finalize" fast
  path, change-detection when a tea was already logged, etc.
- **Risk callouts** you see that nobody mentioned: duplicate creation, wrong
  currency/quantity math, shipping-rate drift by transport mode, the matching ambiguity
  ("Old puer" vs a specific tea), versioning, idempotency, audit trail, undo, and
  anything else that could silently cost money or create duplicates.
- **A prioritised roadmap:** how to phase any recommendations (quick wins first, then
  structural), and what's genuinely worth building vs diminishing returns.

## Constraints
- Adrian's real preferences (from the doc): store the purchase currency + actual paid
  amount; real-time conversion to viewer's currency; quantity flagged "needs
  verification" until he checks it off; new teas go to Draft (one step before publish),
  never straight to the shop; "unknown" is always an acceptable answer; never fabricate
  region/age/description; shipping method (boat vs air) can adjust the landed-cost rate.
- Be concrete and actionable — reference real files/components where you can. Do not
  just restate the doc; add value.
- Be honest about what should NOT be built.

## Output format
A written recommendation, organised as:
1. Flow corrections/holes (with file refs).
2. UX walkthrough design.
3. "Not asked for" improvements + risk callouts + a prioritised roadmap.