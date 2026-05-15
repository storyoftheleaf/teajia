# Friction Review — Customer & Operator Journeys

> Pre-launch walk of both journeys, end to end. Every place a real person hesitates, gets stuck, or loses confidence. Each item carries a severity and a recommended fix.

**Created:** 2026-05-16
**Companion docs:** `AUDIT_2026-05.md` (status), `UI_CONSISTENCY.md` (visual standard), `FIX_QUEUE.md` (work queue).

**Severity:** P0 = launch-blocker · P1 = high friction · P2 = medium · P3 = minor.
**Tag:** items marked **[needs Adrian]** are design judgment calls — they are NOT auto-fixed; they wait for a human decision.

---

## Part 1 — Customer journey

### Arrival — homepage (`src/components/HomePage.tsx`)

| ID | Sev | Friction | Recommended fix |
|---|---|---|---|
| C-P1-1 | P1 | CTAs ("Create account", "Sign in", browse) appear only ~90% through a 200dvh scroll animation. A cold visitor bounces before finding them. `HomePage.tsx:200-267` | Add a persistent, visible "Explore the shop" entry above the fold. **[needs Adrian]** — touches the homepage editorial reveal, which is brand-protected |
| C-P3-1 | P3 | No one-line value proposition above the fold — visitor can't tell what Teajia is | Copy-only; **[needs Adrian]** |

### Browsing — shop & filters (`src/components/Shop.tsx`, `TeaInventory.tsx`)

| ID | Sev | Friction | Recommended fix |
|---|---|---|---|
| C-P1-2 | P1 | No result count — searching "oolong" gives no "14 teas" confirmation `TeaInventory.tsx:83-150` | Add a result-count line above the grid |
| C-P2-1 | P2 | Store picker dropdown appears before inventory; single-location visitors are confused | Hide the picker when only one store is in scope |
| C-P2-2 | P2 | "Type" vs "Feeling" vs "Mood" filters have no help text — visitor can't tell what each does | Add short helper text / tooltip per filter group |

### Product detail (`src/components/shop/AlcoveCard.tsx`, `AlcoveModal.tsx`)

| ID | Sev | Friction | Recommended fix |
|---|---|---|---|
| C-P3-2 | P3 | Product overlays aren't URL-addressable — a customer can't share a tea link | Sync the open product to the URL (`/shop/product/:id` route already exists) |
| C-P2-3 | P2 | Quantity entry has slider + preset + custom-input modes at once — unclear which to use | Pick one primary mode; demote the others |
| C-P1-3 | P1 | Slider max can exceed real stock — customer can add 300g of an 85g tea | Cap the quantity control at available stock |

### Cart & checkout (`src/components/shared/PublicCart.tsx`, `CartPanel.tsx`, `src/lib/whatsapp.ts`)

| ID | Sev | Friction | Recommended fix |
|---|---|---|---|
| **C-P0-1** | **P0** | **No order confirmation after checkout.** Customer sends a WhatsApp message and gets only "WhatsApp opened" — no proof Teajia received it, no order record. `PublicCart.tsx:517-542` | Add a customer-facing confirmation screen with the order reference and clear "we'll reply on WhatsApp" copy. This is a missing *feedback state*, not a checkout replacement |
| **C-P0-2** | **P0** | **Order-tracking page is a dead stub.** Checkout links to `/order/:ref` but `OrderStatusPage` renders nothing | Build a minimal read-only status page, or remove the link until it exists |
| C-P1-4 | P1 | "Inquiry" wording throughout checkout makes customers doubt the order committed | Standardize wording to "order" / "order request" in customer-facing copy |
| C-P1-5 | P1 | Shipping-location field is free text — no validation; bad addresses fail downstream | Add basic validation / a shipping-zone check |
| C-P2-4 | P2 | Currency selector shows no exchange rate | Show the rate or converted total on selection |
| C-P2-5 | P2 | WhatsApp fails silently if the store number is invalid; email fallback is a tiny secondary link | Surface email/copy fallback prominently when WhatsApp is unavailable |
| C-P3-3 | P3 | Remove-from-cart undo lasts only 5s | Extend the undo window to ~10s |
| C-P3-4 | P3 | Closing the cart resets the checkout step to CART | Persist the step in the existing localStorage state |

### Account / post-purchase (`src/pages/SignUpPage.tsx`, account routes)

| ID | Sev | Friction | Recommended fix |
|---|---|---|---|
| C-P2-6 | P2 | Signup asks for contact platform / username with no explanation of why | Add one-line helper text on each field |
| C-P2-7 | P2 | `/account/orders` + `/account/samples` show empty stubs implying a feature that isn't wired | Relabel the empty states honestly, or build the feature (see `AUDIT_2026-05.md` B) |

---

## Part 2 — Operator journey

### First-run / onboarding (`StoreLaunchPlaybookView.tsx`, `OperatorView.tsx`)

| ID | Sev | Friction | Recommended fix |
|---|---|---|---|
| O-P1-1 | P1 | The launch playbook has no progress indicator, no step-to-step flow — operators skip steps | Add a "step N of 6" indicator + completion ticks |
| O-P2-1 | P2 | Admin home tabs use icons with no "start here" ordering for a first-time operator | Add a first-run checklist surfaced on the admin home |

### Daily inventory (`AddProductModal.tsx`, `InventoryView.tsx`)

| ID | Sev | Friction | Recommended fix |
|---|---|---|---|
| **O-P0-1** | **P0** | **Add-a-tea modal is ~45 fields with no hierarchy.** Only Product Name is truly required; a non-expert can't tell what's safe to skip. `AddProductModal.tsx` | **Reorganize into one form**: 6 essential fields visible at top, the rest in 3 collapsed expanders. Same fields, same API. Full spec below (§ Add-Tea Reorganization Spec) |
| O-P1-2 | P1 | Typing a new vendor name silently creates a contact — no confirmation | Add a "Create new vendor 'X'?" confirm before creation |
| O-P1-3 | P1 | The 8 inventory views are hidden behind a `⋮` menu; switching resets selection/scroll | Surface the views as visible tabs; preserve selection on switch |
| O-P2-2 | P2 | Bulk operations give no count feedback ("updated N rows") and no undo | Add a result count toast; add undo where feasible |
| O-P2-3 | P2 | Shipping rate entered manually per product, no store default | Pre-fill from a store-level default shipping rate |

### Selling (`QuickInvoiceModal.tsx`, `OrdersView.tsx`)

| ID | Sev | Friction | Recommended fix |
|---|---|---|---|
| O-P1-4 | P1 | Invoice line items: 4 fields each, no product autocomplete on the name field | Wire product autocomplete into the line-item name field |
| O-P1-5 | P1 | No "repeat last order" for known customers — full re-entry every time | Add a copy-from-previous-invoice action |
| O-P1-6 | P1 | Order status transitions buried in `⋮` menus; no inline "Mark filled" button | Add inline status actions on the order row |
| O-P2-4 | P2 | WhatsApp-order reconciliation is full manual re-entry | Add a `?draft=` prefill link in the outbound WhatsApp message — `OrdersView` already reads `?draft=` |

### Content (`ArticleEditorModal.tsx`, `CollectionEditView.tsx`)

| ID | Sev | Friction | Recommended fix |
|---|---|---|---|
| O-P1-7 | P1 | Article editor has no live preview; paste parser fails silently on bad format | Add a preview pane; show a parse error instead of silently dropping content |
| **O-P0-2** | **P0** | **Removing a product from a collection deletes on a single click, no confirm.** `CollectionEditView.tsx:340` | Add a confirmation (see cross-cutting fix below) |
| O-P2-5 | P2 | Collection flow is 9 steps with no guidance / progress | Add light step guidance; **[needs Adrian]** for the larger reflow |

### People / CRM (`PeopleView.tsx`)

| ID | Sev | Friction | Recommended fix |
|---|---|---|---|
| O-P1-8 | P1 | A vendor can exist twice (vendor contact + customer contact); no merge tool | Add a merge/dedupe action — **[needs Adrian]** for scope |

### Cross-cutting

| ID | Sev | Friction | Recommended fix |
|---|---|---|---|
| **O-P0-3** | **P0** | **Destructive actions are inconsistent** — some delete in one click (collection item, article, event, customer), some need a modal, none can be undone | Route every destructive action through one shared `ConfirmModal`. Standardize on the existing component |
| O-P1-9 | P1 | Error toasts are generic ("Save failed", "Action failed: {message}") with no recovery hint | Replace with specific, actionable messages per failure site |
| O-P2-6 | P2 | Search/filter state isn't persisted across navigation | Persist filter state (URL params or store) |

---

## Prioritized fix list

This is the master worklist. The autonomous run (`FIX_QUEUE.md`) consumes the auto-safe rows. **[needs Adrian]** rows are excluded from automation.

**P0 — launch-blockers (do first):**
1. O-P0-3 — one shared confirmation for all destructive actions
2. O-P0-1 — add-tea modal reorganization (spec below)
3. C-P0-1 — customer order-confirmation screen
4. C-P0-2 — order-tracking page (build minimal, or remove the dead link)
5. O-P0-2 — collection-item removal confirm (folded into O-P0-3)

**P1 — high friction:**
6. C-P1-2 · C-P1-3 · C-P1-4 · C-P1-5 · O-P1-1 · O-P1-2 · O-P1-3 · O-P1-4 · O-P1-5 · O-P1-6 · O-P1-7 · O-P1-9

**P2 — medium:**
7. C-P2-1 · C-P2-2 · C-P2-3 · C-P2-4 · C-P2-5 · C-P2-6 · C-P2-7 · O-P2-1 · O-P2-2 · O-P2-3 · O-P2-4 · O-P2-6

**P3 — minor:** C-P3-2 · C-P3-3 · C-P3-4

**Excluded from automation (need Adrian):** C-P1-1, C-P3-1, O-P2-5 (collection reflow), O-P1-8 (merge scope).

---

## Add-Tea Reorganization Spec (O-P0-1)

Single form, ~45 fields preserved, only layout/grouping/labels change. No wizard, no data-model or API change.

1. **Essentials block — always visible, top of the form.** Six fields that make a usable, sellable tea: Photo · Product Name * · Type * · Cost (amount + currency + weight) · Stock (grams) · Retail price/g. Keep the live "true cost" calc and the "Use 3×" button. Visually de-emphasize everything else so the eye lands on these six.
2. **Three collapsed expanders below**, collapsed by default on a new product, each showing a "has content" dot when filled:
   - **Naming & origin** — Given Name, Chinese Name, Form, Year, Origin Region, Source/vendor.
   - **Story & lore** — the existing 7-field Wisdom block (already collapsible — keep it).
   - **Stock details & flags** — alert threshold, session reserve, in-transit, the toggle chips (Personal, Restockable, Public, Curated).
3. **Hide non-applicable fields** rather than graying — platform-only (Wholesale, In-Catalog, Tea Key) and edit-only sections (Stock Ledger, Field Origin, Network Reviews) stay conditional (already are — keep).
4. **Label clarity:** shipping field → "Shipping (USD per kg)"; legacy tasting-notes field → "Legacy tasting notes (old format)", tucked behind an advanced sub-toggle so new users see only the Tasting Session button.
5. **Net effect:** form opens as 6 fields + 3 closed sections instead of a 45-field wall. Fast entry = fill 6, Save. Full editorial entry = expand the sections.

**File:** `src/admin/components/AddProductModal.tsx` (JSX/layout reorg only, no logic change). Possibly a small expander style in `src/styles/card-utilities.css`.
