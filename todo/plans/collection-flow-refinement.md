# Collection build-and-send flow refinement

**Status:** spec ready for a fresh chat to execute.
**Scope:** Teajia admin. Refine the owner's experience of (1) building a collection and (2) sending it. The recommendation feature itself (per-item amount + price, quantity-scaling, draft-order reply loop) is already shipped and committed (`0732f1a`, `1bf92db`) — this is polish on the *flow around it*, not new capability.

---

## 2026-06-01 audit deltas (current code state — read before touching anything)

The flow was mapped from current code. Exact file:line references below. Two screens, two separate share UIs, and a discoverability gap are the core problems.

### Where things are now

- **Build screen:** `src/admin/views/CollectionEditView.tsx`
  - Per-item editor is `CollectionItemRow` (lines ~39–201). Amount input ~172–180, price input ~184–192, both save on blur (`saveQty` ~67–79, `savePrice` ~81–99). No defaults; placeholders only (100 for tea, 1 for teaware; catalog `fixed_retail_price_usd` for price if present).
  - Add teas: "Add products" button (~445–451) → `AddProductsSheet` modal (~551–558) → filter/select/submit. ~3 taps per add session.
  - **Send trigger lives here too:** the "Shared with" section (~495–546). Share button labeled just "Share" with `UserPlus` icon (~504–512), right side of that header. Empty-state CTA "Share with people" (~530). Both gated on `canPublish` (≥1 item). Opens `AddPublicationSheet` (defined ~911–1188; person/tag/store tabs).

- **Create entry:** `src/admin/views/CollectionsView.tsx`. `?new=1` auto-opens create form (~334–374) — title only, button "Create draft", then navigates to the edit screen (~66–80). This is the mobile "Send a Collection" landing.

- **Second, parallel share UI:** `CollectionShareSheet.tsx`, invoked ONLY from `InventoryView.tsx` (~705, ~3013–3026) when products are selected. Different modal, different labels, has a "new / existing / tea-house" mode switch. Does NOT come from the collection editor.

- **Replies land in Orders:** confirmed picks become Draft invoices in `OrdersView.tsx` (Draft filter + "Accept & Make Order" ~825–837). This is why the owner went hunting in invoices for "send" — the only collection-related thing in Orders is *inbound replies*, not sending.

### The confirmed friction points (owner's words: "building needs refining, and I can't even find where to send")

1. **Send is undiscoverable.** The trigger sits under a heading "Shared with" that reads as a passive list, the button is just "Share", and there's no cue after building that says "you're done — now send this." The owner looked in Orders/invoices and found only reply-drafts.
2. **Build → send is not linked.** No call-to-action connects finishing the build to the send step. They're the same screen but feel disconnected.
3. **Two share UIs diverge.** Editor uses `AddPublicationSheet`; inventory uses `CollectionShareSheet`. Different labels and flows for what the owner thinks of as one action.
4. **Building is tedious.** Teas added one-by-one via modal; amount + price set per-row with no defaults and no bulk/copy-from-catalog. Worth considering a sensible default (e.g. prefill price from catalog `fixed_retail_price_usd`) so most rows need no typing.

---

## What the fresh chat should do

This is a UX-refinement task, not a rebuild. Walk the real flow first (build a collection, send it, see the reply land), THEN refine. Likely moves, in rough priority — the executing chat should confirm direction with the user before large changes, but small obvious wins can land directly:

1. **Make send discoverable and connected to build.** The send action should be obvious at the moment the owner finishes building. Rename/reframe the "Shared with" trigger so "send this collection" is unmistakable, and/or add a clear primary CTA once the collection has items. Keep within the existing Cancel/Back/Close and color rules (no new bright borders, `tea-*` tokens, `text-ui-N` scale).
2. **Reconcile the two share UIs** (`AddPublicationSheet` vs `CollectionShareSheet`) so the owner meets one consistent send experience, or at least consistent labels/wording, regardless of entry point. Do not silently delete one without checking both call sites still work.
3. **Reduce build friction.** Strongly consider defaulting the per-item price from the catalog price so empty = use catalog, and making amount optional with a sensible default. Confirm with the user before changing the meaning of a blank field, since the worker already treats blank price as "use catalog".
4. **(Optional, confirm first)** Clarify in Orders that collection-reply drafts are *inbound replies*, distinct from drafts the owner created, since that mislabeling is part of why send felt lost.

Verify on the live flow, not just types. `npm run lint`, `npm run lint:colors`, and `npm run test:mobile` must pass. The recommendation/price-scaling logic is done — don't re-litigate it.
