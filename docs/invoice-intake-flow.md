# Teajia — From Receipt Photo to Inventory (Your Workflow)

How you experience taking a picture of a receipt, and what happens at each step —
what you touch, what runs itself, and where the tricky decisions (like "is this the
same tea I already own?") actually happen. Verified against the app's import UI
(`import/ImportInput.tsx`, `ImportMatchPicker.tsx`, `importReviewDomain.ts`) and the
worker routes.

---

## Step 1 — You bring in the receipt
**You:** open the **TeaCompass → Import** screen and either
- **take a photo** of the receipt (📷 camera button), or
- **upload a file** (PDF / photo / spreadsheet), or
- **paste** the WeChat/vendor text into the box.

**You don't:** type anything structured yet. Just get the image or text in.

---

## Step 2 — The app reads it (auto, nothing saved)
**You:** press continue/import.
**Runs itself:**
- The app runs **AI analysis** on the photo/text.
- It tries to pull out, per line: the item name, quantity, unit (7 cakes / 2 cakes /
  1kg), unit price, currency, and groups them under a **vendor**.
- It builds a **draft** of candidate items.
- **Nothing is written to inventory yet.** This is a proposal, in memory.

**You don't:** confirm anything here.

---

## Step 3 — The hard part: "is this the same tea I already own?" (YOU)
This is the step that needs your judgment most, because casual receipts don't match
your clean inventory names. "Old puer", "老普洱", "some sheng I got at the market" —
none of these name-matches cleanly.

**What the app does (auto):**
- For each item it ranks **candidate matches from your EXISTING inventory**, using
  token overlap across the English name, original name, and Chinese name.
- It **proposes** the single "Closest existing match" for each item.

**What you do (per item), in the match picker:**
- **Pick an existing tea** from your inventory — if this receipt line IS a tea you
  already carry. You can search your inventory by name, purchase date, price, vendor.
  → This AVOIDS a duplicate: it will ADD stock to the tea you already own.
- **Choose "new"** — if this is genuinely a tea you don't have yet.
- The app may also flag fields it **still needs confirmed** before it can finalize
  (the "blocking fields"): vendor, tea identity, inventory holding, pack count,
  weight/unit, price, currency, and destination (received / in transit / library).

### Your guidance, in practice
- **"Someone may just say Old puer"** → the name alone is ambiguous. You decide using
  *context you bring*: the date you bought it, the price, the vendor, where it's from —
  to tell whether it's the "2008 Yiwu Gushu" you already own or a brand-new thing.
- **"We wanna avoid double doing things"** → this is WHY this step shows your existing
  inventory. You match against what's already there so you ADD stock to an existing
  tea instead of creating a copy. The token-match helps, but only you know if a
  similar name is the same tea or a different lot.
- **"We might not know the mountain region"** → fine. Region is a **library/identity**
  detail, NOT a blocker for receiving it. Record what's known (vendor, date, price,
  pack) and leave the region for later research. Never invent a region.
- **"More mysterious things"** → accept partial info. An item is ready to finalize
  when the *blocking* fields are resolved (vendor, identity, holding, quantity/cost).
  Missing region/cultivar/producer/year are NOT blocking — leave them blank, flag
  them, don't guess.

---

## Step 4 — You confirm the key facts the receipt can't tell us (YOU, before finalize)

Before anything is written, the flow makes a **"do I have enough?"** pass. This is a
single judgment call, not a long quiz.

**The pass (how it decides):**
1. **Use what you already know / already have.** If the vendor, country, region, or
   character can be found from your existing inventory, the library, past purchases,
   or your earlier receipts — use that. Don't ask for what's already answerable.
2. **Ask only the small gaps you're likely to know.** If it genuinely can't be worked
   out, ask a **simple, contextual question** — e.g. *"Where did you buy it from?"*,
   *"Have you bought from this vendor before?"* — and combine the answer with what's
   already in your records to guess/detect the rest.
3. **Prompt-in-flow happens ONLY when there isn't ample information.** If the tea has
   enough known detail to write genuinely, do a normal write (you can add to it
   later). If it does NOT have enough, look for a little confirmation from you.

**What you may be asked (only the gaps):**
- **Which vendor** / who you bought it from (and whether you've bought from them before).
- **Which country / where** you purchased it.
- The **shipping method / how you brought it in** — because this matters for the
  **shipping rate**: if it came by sea (boat) vs air, the landed-cost shipping may need
  adjusting, not the default. Shipping is folded into cost (R7 default = 10 USD/kg).
- Anything you know about the tea (region/mountain, age, character, what you were told).

**Hard rule — partial knowledge is fine:**
- **I might not actually know much about it.** That's completely OK. You are never
  expected to have the full story.
- Whatever you don't know stays **blank / unverified** — it is NEVER invented.
- If there isn't enough to write a genuine "About this tea", we do NOT pad it: we
  leave it for later research or write only what is established.

**When this happens:** after Step 3's matching (we know *which* tea / *new*) **and after
the teas are grouped/organized** (so you can pinpoint exactly which tea we're talking
about), and **before** finalize + before any description is written. The "do you know
anything about this tea" questions come at this point — once you can see the tea it
applies to. The description (R1/R5/R8) is only written from the library + what you
verified — never from a bare receipt line.

## Step 5 — You confirm finalize (THE write happens here)
**You:** click the final action. The button labels what it'll do, e.g.:
- "Receive 3 teas and hold 1 in transit", or
- "Save 2 Library records".

**What happens on finalize (auto, atomically):**
- Item matched to an **existing tea** → **adds stock** to it. No duplicate created.
- Item matched as **new** → creates the product (as **Draft**).
- Item disposition **in_transit** → holds stock in transit, not added to available yet.
- Item disposition **library_only** → saves a Library record, no inventory.
- Records **stock movements** in the ledger.

**This is the confirmation point.** Before you click finalize, nothing is written.
After you click, it's written. There's no second "are you sure about each product?"
— finalizing IS the confirmation.

---

## Step 5 — After the receipt: what is NOT covered (you decide later)
- **On the shop?** New products from a receipt start as **Draft** — they do NOT appear
  on the store until published. (If your goal is "receipt → live on shop", there's a
  missing publish step — the skills conflict on this. DECISION NEEDED.)
- **Price/cost on the product?** The receipt line carries the price, but the product's
  `quantity_purchased` / per-gram pricing math and the "needs verification" flag are
  **not** auto-set by the receipt — that's a following step (the agent or an edit).
- **"About this tea"?** terroir/processing/lore is NOT auto-filled from the receipt —
  it's written separately from the library / research (R1/R5/R8).
- **Unknowns** (region, cultivar, year, producer) stay blank, never fabricated (R9).

---

## The simple mental model

| Step | You interact? | What happens | Risky? |
|---|---|---|---|
| 1. Photo / paste receipt | ✅ | — | low |
| 2. App parses it | ❌ auto | builds a draft of items; nothing saved | low (can mis-read) |
| 3. Match to existing vs new | ✅ **main step** | confirm/pick existing or "new" per item | **HIGH (duplicate risk)** |
| 4. Finalize | ✅ one confirm | auto: add stock / create Draft product + ledger | the write |
| 5. Price + publish + "About" | separate step | not covered by the receipt | depends |

---

## Confirmed decisions (from Adrian, 2026-08-30)
1. **New teas from a receipt go to DRAFT** — Draft is the one-step-before-publish state.
   Finalize puts the tea into inventory as Draft, NOT straight on the shop. Publishing
   (Draft → Active) is a separate deliberate step you do.
2. **Store the purchase currency + the real paid amount.** The product keeps
   `cost_currency` = the currency you actually paid (because that's what you'll need to
   repay), and `cost_amount` = what you paid. The storefront converts in real time to
   whatever currency the viewer is browsing in — so you always have the price you paid,
   and the customer sees their own currency.
3. **Inventory quantity is flagged "needs verification" unless finalized.** The
   needs-verification flag stays ON for the received quantity until you explicitly mark
   it finalized (checked it off). Flagging is the default; clearing it is your action.

## Draft preview — already solved (no build needed)
The admin inventory panel already has an **"👁 Shop" button** per product
(`ProductEditPanel.tsx:1264`, "Preview in shop") that opens a `TeaDetailsModal`
rendering the product through the **`AlcoveCard`** — the exact component the storefront
uses (`TeaDetailsModal.tsx` imports and renders `AlcoveCard`). So you can already view
**any product, including a Draft**, in exactly the same layout/card it will appear on
the store, straight from the admin panel. This works for Drafts because the preview is
rendered locally in admin, independent of the public store's `Active`/`shown_in_shop`
filter. Fable should NOT rebuild this; keep/refine the existing Shop-preview button.

## The two decisions that most shape the flow (resolved above)

---

# UX — how it should FEEL to move through the whole thing

The steps above are the *logic*. This section is the *experience* Adrian wants Fable to
optimize: a very good UX for getting through all of it from photo to published draft,
minimising friction, load and second-guessing.

## Current state of the UX (what's real today)
- The flow happens mostly in one **`ImportBatchReview`** screen: it shows the parsed
  items, grouped by vendor, each row with per-field **lookup pickers** for journey,
  vendor, identity (match to existing tea vs new), and holding (inventory target), plus
  blocking-field confirmations.
- There's a single **finalize** button, and an **`ImportCompletionSummary`** after.
- The "👁 Shop" preview (in admin) already shows a product exactly as on the store.

## UX principles to aim for (what Adrian wants)
1. **One clear path, not a wall of fields.** The user shouldn't face every field at
   once. Progressive disclosure: resolve what's blocking first, hide what's not needed.
2. **Confidence in one glance.** Each item should read "this is fine / this needs one
   thing" immediately — color/status, not paragraphs. A green item = ready; a flagged
   item = exactly one thing to confirm.
3. **The matching decision is the centerpiece.** "Is this the same tea I already own?"
   should be a clean, fast decision: show the top existing-match candidate (with date/
   price/vendor context), and let you confirm it, search, or choose new — in one motion.
   This is the step that most needs good UX because it's the riskiest (duplicates).
4. **Ask me only what I actually know, only when needed.** Per the "do I have enough?"
   pass: if the system can infer vendor/country/shipping from what's already stored, it
   does; it only asks the small gaps. And it asks them in a light, natural way
   ("Where did you buy it?"), not a form.
5. **Unknown is a fine answer.** "I don't know the region / age" must never block or
   shame. The item stays cleanly "received, region unknown," flagged for later — not
   red and stuck.
6. **One decisive final step, clearly labeled.** "Receive 3, hold 1 in transit" tells
   you what's about to happen before you commit. Finalize is one click; after it, a
   clear "what was created" summary (and a one-click "view it like on the store").
7. **Always-recoverable / no dead ends.** Re-upload of a cleaned invoice, undo a
   mistake, edit a draft — never a hard stop.
8. **The shipping thought is part of it** — how you brought it in (boat vs air) is a
   natural question that adjusts the landed-cost shipping rate; the UX should surface
   it only when it changes the number, not as a default form field.

## What Fable should deliver
A recommendation for the ideal **walkthrough layout / interaction flow** (not just the
process steps): how to break the import into digestible screens or sections, how to
make per-item review fast, how to make the existing-product matching a confident
one-touch decision, and how to make the finalize + post-finalize (view on store) feel
clean. Reuse what exists (the Shop-preview button, the batch-review model) rather than
rebuilding.