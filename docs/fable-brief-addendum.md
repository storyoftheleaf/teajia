# Fable — Addendum: dual-path intake + in-flow chat for tea details

This builds on your previous review. Two new requirements from Adrian change the
architecture. Read your prior output if you have it, then address the delta.

## Existing state — FIRST look at the actual curate source-import screen

Adrian has ALREADY STARTED building this ingestion into the website. It lives in the
**curate section (TeaCompass)** and is the **source-import / Library Imports area**.
Concretely (verified in code):

- `src/components/TeaCompass/index.tsx` — the curate home. It lists **in-progress
  Imports** (batches) via `LibraryImportsSection`, each shown as an `ImportBatchChip`
  for an open import received from a source/receipt.
- `src/components/TeaCompass/import/ImportPanel.tsx` + `ImportInput.tsx` +
  `ImportBatchReview.tsx` — the import walkthrough that opens from a batch chip.
- `src/components/TeaCompass/LibraryImportsSection.tsx` — the "Imports" list of open
  batches (the entry point Adrian calls "curate source import").

So this is NOT greenfield. Extend THIS. The chat layer for dialing in tea details
should plug into this existing flow — most naturally at the point where a batch/item
needs detail resolved (the import review / per-item details), and/or surfaced from the
curate Imports list.

## New requirement A — the flow must work TWO ways, converging on one state

Adrian does intake in two modes, roughly half and half, and they must produce the
SAME result with no divergence:

1. **AI / agent path (Hermes, skill-driven).** Adrian talks to an agent (this Hermes
   host) — sends the receipt photo, and the agent drives the whole flow by calling the
   existing APIs and meaningful skills (e.g. the teajia-store-intake skill, the
   teajia-rich-descriptions skill). He reads it as a conversation, not a form.
2. **Web path (the curate section on the site).** The same flow as a UI — the
   four-screen walkthrough etc. He uses this when he's on the site.

The two paths must:
- Hit the **same backend endpoints / data model** (no divergent states).
- **Resume each other mid-flight.** Work started in chat must be finishable in the UI
  and vice versa — one draft, one source of truth, safe to switch.
- Reuse the **skills as the source of truth** for what the agent does; the UI is a
  reflection of the same operations.

Design this: how do the agent path and the UI path share a single draft/state (e.g.
server-persisted batch + draft that both operate on)? How do the skills map onto the
UI steps? What are the exact API contracts both call? How does a half-finished chat
intake appear when Adrian opens the website?

## New requirement B — in-flow chat for dialing in tea details

Inside the curate/ingestion flow, Adrian wants a **conversational layer** for pinning
down the details of a specific tea — not just a form. When the receipt line is vague
("Old puer"), a match is ambiguous, or region/age/character are unknown, the flow
should be able to **talk to Adrian** to resolve it, and this chat must itself be
available BOTH on the web and via the agent.

Design:
- When/how the chat triggers (only on genuinely unresolved details — the "do I have
  enough?" pass, elevated).
- How chat answers get written back into the item's parsed/canonical data (each answer
  -> a field with provenance, evidenceRefs-like lineage).
- How it works on the **web** (an inline chat pane/sheet in the walkthrough) vs the
  **agent** (the same conversation via the agent) — and how they share the transcript.
- Guardrails: chat can ask about vendor, country, shipping mode, pack/weight, and
  things Adrian knows — but it must NEVER fabricate region/cultivar/description (R9);
  "I don't know" is a valid terminal answer that leaves the field cleanly unknown.

## Deliverables
Extend the roadmap: how the dual-path architecture and the in-flow chat layer onto the
existing "Now / Next / Then / Later" plan. Reference the pieces that already exist
(the curate import screen, the draft-storage, the skills, the endpoints) rather than
rebuilding. Flag any structural choices that make a chat + web + agent triple harder
(e.g. draft persistence, transcript storage, idempotency), and how to avoid them.