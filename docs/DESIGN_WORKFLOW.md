# Design workflow — generate template, apply across site

Two-step playbook. Step 1 happens once in an AI design tool. Step 2 is the migration loop you run for every view.

**You start with these three artifacts already in the repo:**
- `docs/DESIGN_SYSTEM.md` — the rules (Part I generic + Part II domain components)
- `src/pages/DesignSystemShowcase.tsx` — the live exemplar at `/design/system`
- `src/admin/components/PeopleView.tsx` — the first worked example

---

## Step 1 — Generate the canonical template in Claude Design

You will produce **one master template page** that visually depicts every element, spacing rule, and component pattern in the system. This becomes your visual ground truth. You'll use it to design new pages and to spot drift in existing ones.

### 1.1 Open Claude Design (or any AI design tool)

Start a new project / canvas.

### 1.2 Paste the system prompt

Paste **the entire contents of `docs/DESIGN_SYSTEM.md`** as the system prompt or context. The doc is 1600+ lines and intentionally self-contained — paste all of it, do not summarize.

### 1.3 Paste the master prompt

```
You have been given the Teajia Design System (Parts I and II).

I want you to design ONE master template page that visually depicts
EVERY element, spacing rule, and component pattern in the system. This
will be my visual ground truth — I will compare every other page I
design or audit against this template.

CRITICAL: The template must include all of the following. Each section
must use the canonical class strings from §23 and the recipes from
Parts I + II. Do not omit any section.

PART I — GENERIC PRIMITIVES
  1. Color tokens (§2):  visual swatches of every token in both dark
     and light mode, with name + hex + role.
  2. Typography (§3):    every entry in the scale (h1, h2, h3, subtitle,
     body, bodyLight, label, nav, link, mono, navSidebar) rendered with
     real example copy. Below them, every step of the ui-N scale
     (8/9/10/11/12/13/14/15/16/17/20/26/28) rendered at its size.
  3. Letter-spacing (§3): show all 7 tracking steps side-by-side.
  4. Spacing scale (§4):  visual rhythm — gap-1 through gap-8 rendered
     as bronze bars beside their use-case label.
  5. Page chrome (§5):    both sticky-h-16 wide variant AND non-sticky
     narrow variant, with title + eyebrow subtitle and right-side
     action cluster (icon buttons + primary CTA).
  6. Tab strip (§6):      bottom-border underline tabs — show inactive,
     hover, and active states. Include the banned segmented-pill
     variant in an "avoid" frame for contrast.
  7. Buttons (§7):        primary, secondary, ghost, icon, destructive
     — each in resting + hover + active + disabled + loading states.
  8. Surfaces (§8):       card, list row (with divide-y), and data
     table (with sticky thead, font-serif column headers, hover row).
  9. Status pills (§8):   all 5 variants — draft, active, archived,
     success, error.
 10. Z-index (§9):        a layered demo showing each token (base,
     dropdown, sticky, overlay, drawer, modal, popover, toast)
     stacking correctly.
 11. Interaction states (§10): hover, active, focus, disabled, loading
     — shown for at least 3 element types.
 12. Elevation tiers (§11): flat / popover (shadow-lg) / modal
     (shadow-2xl) side-by-side.
 13. Forms (§12) + Inputs (§13): boxed input with focus + error
     states, underline input for toolbars, label + helper text,
     two-column form row, fieldset divider.
 14. Modals/drawers (§14): a centered modal AND a side drawer,
     both with cancel-left / primary-right footer (§15).
 15. Navigation (§16):     desktop sidebar (with gold left-bar active
     state) + mobile bottom tab bar (with glow active state).
 16. Icons (§17):          a Lucide icon grid + the size scale
     (14, 16, 18, 22).
 17. Animation (§18):      timing tokens (micro 150ms, standard 300ms,
     emphasis 500ms) with visual demos.
 18. Empty / loading / error states (§19): three cards side-by-side.
 19. Page-type templates (§20): a thumbnail wireframe of each of the
     5 templates — settings, data table, hub, list, reader.

PART II — DOMAIN COMPONENTS
 20. Hub page chrome (§25):  title + tab strip + content shell.
 21. Identity card (§26):    avatar + name + contact + meta + tags.
 22. Avatars (§27):          all 5 sizes (xs, sm, md, lg, xl), both
     photo and initials variants.
 23. Tags (§28):             display chips (all 4 variants) + tag
     input with × removable chips.
 24. Activity timeline (§29): vertical rail with 4 sample events,
     showing date headers and mono refs.
 25. Order/invoice lines (§30): line items + subtotal/shipping/tax/
     total block, all numerics in font-mono tabular-nums.
 26. Tea card (§31):         shop tile with photo + title + eyebrow
     + price.
 27. Alcove card (§32):      reference image only — note that this
     uses the texture system from designTokens §12.
 28. Magazine patterns (§33): drop cap + pull quote + section break
     ornament + sample body paragraph.
 29. Tasting card (§34):     header strip + sensory inputs + voice
     capture button + submit row.
 30. Tooltip (§35):          positioned above a sample button.
 31. Toast (§36):            success + error + info variants.
 32. Popover menu (§37):     anchored to a button, with regular item +
     destructive item + divider.
 33. Pagination (§38):       both load-more AND numbered variants.
 34. Breadcrumbs (§39).
 35. Date picker (§40):      themed boxed input.
 36. File upload zone (§41): drag-drop area with idle + drag-over +
     uploading + error states.
 37. Image gallery (§42):    thumbnail strip + active thumb ring.
 38. Rich text toolbar (§43): with bold/italic/link/quote/image/list
     buttons + active state on one.
 39. Multi-step wizard (§44): 4-step stepper with one completed, one
     current, two future.
 40. Inline editing (§45):   rest state + edit state side-by-side.
 41. Sticky bottom action bar (§46): cancel-left + primary-right.
 42. QR code display (§47):  with caption.
 43. Charts (§48):           one sparkline + one bar chart + one line
     chart, all using the muted gold palette.
 44. Anti-patterns (§22):    at least 6 side-by-side ✓ canonical vs
     ✗ avoid comparisons — uppercase tracking on buttons, segmented
     pill tabs, undersized titles, cancel-right footer, tea-text-dim
     on cancel buttons, color outside the palette.

OUTPUT FORMAT
- A single React component file (TSX) using Tailwind classes.
- Every element pulled from §23 canonical class strings — do not
  invent new patterns.
- Organize into sections with anchor links and a sticky underline
  tab nav at the top for jumping between sections.
- No inline pixel values. No text-[Npx]. No z-[N]. No fontFamily inline
  styles. All anti-patterns from §22 are banned.
- 1600+ lines is expected. This is meant to be exhaustive.

After the code, give me a one-section-per-line checklist confirming
each numbered item above is covered. If anything is missing, flag it.
```

### 1.4 Iterate

The first output usually misses 3-5 sections. Run this follow-up:

```
Check your output against the checklist. List any of the 44 numbered
items that are missing or only partially covered. Then regenerate
covering those gaps, keeping everything else.
```

Repeat until every numbered item is covered.

### 1.5 Visual grading pass

Once Claude Design has produced the full template, switch to *design mode* (or wire it into your own preview) and check it against the live exemplar at http://localhost:7777/design/system. The two should look like siblings. Where they don't match:

- Wrong color → wrong token used. Fix via §2.
- Wrong size → wrong type scale entry used. Fix via §3.
- Wrong feel → wrong padding/gap. Fix via §4.
- Wrong vibe → look at §22 anti-pattern list.

Iterate in the design tool. **You can tweak the template visually here** — change spacing, swap colors, try variants. Anything you change becomes the new canonical, but make sure to update `docs/DESIGN_SYSTEM.md` in the repo so the rules stay aligned.

### 1.6 Save the template

When the template matches your vision, save the TSX output. Two options:

**Option A — Replace the live exemplar (recommended).** Overwrite `src/pages/DesignSystemShowcase.tsx` with the new template. `/design/system` now shows your refined canonical version.

**Option B — Side-by-side.** Save as `src/pages/DesignSystemShowcaseV2.tsx`, wire a `/design/system-v2` route, compare against V1, then promote V2 to V1.

---

## Step 2 — Apply across the site

You now have the canonical template. Migrate the rest of the app to match.

### 2.1 The two reference surfaces

You're always working between three things:

| Reference | Use |
|---|---|
| `docs/DESIGN_SYSTEM.md` | The written rules. Search it when you need a class string or a recipe. |
| `/design/system` (the template) | The visual ground truth. Open it in one tab to compare. |
| `/admin/people` (the worked example) | A real production page that already follows the spec. Use it as the second visual ground truth — proves the rules work in a real view. |

### 2.2 Migration order — easiest first, hardest last

This order builds your muscle on simple views before you tackle the heavy ones:

| # | View | Type | Effort | Why this order |
|---|---|---|---|---|
| 1 | `AccessView` | Settings hub | Small | One sub-tab strip + form fields. Quick win. |
| 2 | `AccountSettingsView` | Settings | Small | Mostly form fields + identity card. |
| 3 | `MCPTokensView` | List + modal | Small | Table + one create modal. Tests the table pattern. |
| 4 | `CollectionsView` | List | Medium | Card list + create flow. Already partially good. |
| 5 | `MagazineView` | List | Medium | Similar to Collections. |
| 6 | `OrdersView` | Data table | Medium | The canonical table workout. |
| 7 | `CustomersView` | Data table (huge) | Large | 1986 lines. Break into phases — start with the chrome + tabs, leave the detail drawer for a later pass. |
| 8 | `InventoryView` | Hybrid | Large | The most complex. Sticky chrome + sticky thead + filter row + bulk toolbar + multiple modals. Save for last. |
| 9 | `MagazinePageReader` | Reader | Large | Domain-heavy. Requires §33 patterns. |
| 10 | Public pages (Storefront, Reader, etc.) | Various | Variable | After admin is consistent, public pages get the same treatment. |

For each view, run **the per-view loop** below.

### 2.3 The per-view loop (run for each migration)

```
┌─ A. Audit ───────────────────────────────────────┐
│  Open the view side-by-side with /design/system. │
│  Walk §22 anti-pattern checklist top to bottom.  │
│  List every violation with file:line.            │
└──────────────────────────────────────────────────┘
            ↓
┌─ B. Map ─────────────────────────────────────────┐
│  For each violation, look up the canonical       │
│  pattern in DESIGN_SYSTEM.md and copy the class  │
│  string from §23 or the relevant Part II section.│
└──────────────────────────────────────────────────┘
            ↓
┌─ C. Replace ─────────────────────────────────────┐
│  Edit in place. Replace banned classes with      │
│  canonical ones. Don't refactor logic — only     │
│  change className strings and tiny structural    │
│  swaps (e.g. icon position, tab shape).          │
└──────────────────────────────────────────────────┘
            ↓
┌─ D. Verify ──────────────────────────────────────┐
│  npm run lint:colors    ← must pass              │
│  npm run lint           ← TypeScript clean       │
│  Visit the page in browser. Confirm:             │
│    - matches /design/system in look/feel         │
│    - works at 390px (mobile) with no horizontal  │
│      scroll                                       │
│    - dark and light mode both work                │
└──────────────────────────────────────────────────┘
            ↓
┌─ E. Commit ──────────────────────────────────────┐
│  git commit with a message that lists what       │
│  patterns were applied (e.g. "MagazineView:      │
│  underline tabs §6, fix title typography §5,     │
│  status pills §8")                                │
└──────────────────────────────────────────────────┘
```

### 2.4 The per-view prompt (for AI assistance)

If you want an AI assistant to drive each migration, this is the prompt:

```
We are migrating <VIEW NAME> at <FILE PATH> to follow the Teajia
Design System (docs/DESIGN_SYSTEM.md).

DO:
1. Read the current file.
2. List every violation of §22 (anti-patterns) and any deviation
   from the canonical class strings in §23 or Part II recipes.
3. For each violation, propose the canonical replacement with
   file:line reference.
4. Apply the replacements via Edit. Do not refactor logic —
   only change className strings and minimal structural swaps.
5. Run `npm run lint:colors` and `npm run lint` after editing.
6. Verify the page still functions at /admin/<route> by checking
   for runtime errors in the dev server log.

DO NOT:
- Change data flow, state, hooks, API calls, or routing
- Introduce new dependencies
- "Improve" copy, add features, or change layout structure
- Use any class string not present in DESIGN_SYSTEM.md

Output: a diff summary listing every section of the spec that was
applied, with file:line citations.
```

### 2.5 Definition of done — per view

A view is "done" when:

- [ ] Every item in §22 anti-pattern checklist passes
- [ ] Page header uses `TYPOGRAPHY_CLASSES.h2` (not inline `fontFamily` or `text-2xl/3xl`)
- [ ] Tab strips (if any) use the bottom-border underline (§6) — no segmented pills
- [ ] Primary buttons are title case `font-semibold rounded-md` (§7) — no uppercase tracking
- [ ] Cancel/Back/Close placement follows §15
- [ ] Status pills use the shared variants (§8)
- [ ] No raw `z-50` / `z-[N]` / inline `style={{ zIndex }}` — only semantic tokens (§9)
- [ ] Modals use `rounded-xl shadow-2xl` (§14)
- [ ] Empty / loading / error states use the patterns from §19
- [ ] Hover state is color/background only — no scale/lift/shadow change (§10)
- [ ] `npm run lint:colors` passes
- [ ] `npm run lint` passes
- [ ] Works at 390px without horizontal scroll
- [ ] Dark and light mode both look correct

### 2.6 Definition of done — site-wide

The system migration is complete when:

- [ ] All views in §2.2's table reach per-view done
- [ ] `npm run test:mobile` passes (visual regressions in mobile chrome)
- [ ] A grep for the banned patterns in §22 returns zero hits across `src/admin/` and `src/pages/`:
  - `grep -rn "bg-tea-bg.*shadow-sm" src/` (segmented pill active state)
  - `grep -rn "bg-tea-gold.*uppercase.*tracking-\[0\." src/` (uppercase primary buttons)
  - `grep -rn "fontFamily:.*var(--font-display)" src/` (inline title font)
  - `grep -rn "z-\[" src/` (arbitrary z values)
  - `grep -rn "style={{.*zIndex" src/` (inline zIndex)
  - `grep -rn "style={{.*marginTop:\s*[0-9]" src/` (inline pixel margins)
- [ ] `src/constants/admin.ts` `ADMIN_Z_INDEX` is deleted (replaced by Tailwind z tokens — see §9)
- [ ] Every primary button across admin uses the canonical class string from §23

---

## Reference card — fast lookups

### Where each pattern lives

| You need… | Look at… |
|---|---|
| A color token | DESIGN_SYSTEM §2 |
| A type size | DESIGN_SYSTEM §3 + `TYPOGRAPHY_CLASSES` in `src/designTokens.ts` |
| Page padding | DESIGN_SYSTEM §4 |
| A button class string | DESIGN_SYSTEM §23 |
| A tab strip | DESIGN_SYSTEM §6 |
| A status pill | DESIGN_SYSTEM §8 + `STATUS_PILL_VARIANTS` in code |
| A z-index | DESIGN_SYSTEM §9 + `tailwind.config.ts` z tokens |
| A modal | DESIGN_SYSTEM §14 |
| A hub page | DESIGN_SYSTEM §25 |
| A timeline | DESIGN_SYSTEM §29 |
| Invoice line items | DESIGN_SYSTEM §30 |
| Magazine prose | DESIGN_SYSTEM §33 |
| Tooltip / toast / popover | DESIGN_SYSTEM §35/§36/§37 |

### Commands

```bash
npm run dev           # dev server at http://localhost:7777
npm run lint          # tsc --noEmit
npm run lint:colors   # mandatory pre-commit color check
npm run test:mobile   # Playwright mobile audit (~90s)
npm run build         # production build
```

### URLs to keep open while migrating

- http://localhost:7777/design/system — the live canonical template
- http://localhost:7777/admin/people — the worked example
- http://localhost:7777/admin/<view-you-are-migrating>

---

## Quick FAQ

**"What if the template I designed in Claude Design conflicts with the spec doc?"**
The template you tweak is the new visual truth. Edit `docs/DESIGN_SYSTEM.md` so the rules match. The doc and the showcase must stay aligned — they're two views of the same thing.

**"What if a real view has a legitimate need to break a rule?"**
Add it to the spec as an explicit exception (the way `ProductEditPanel` is exempted from the close-X-left rule in §15). Don't silently break the rule.

**"How do I know when a view's done?"**
Run through §2.5's per-view checklist. Every box must check.

**"Can I split a big view into phases?"**
Yes. Start with the chrome (header + tabs + outer layout), then move inward (filter row, table, modals). Each phase is a separate commit.

**"What if the AI design tool gives me something that doesn't fit?"**
Push back with §22 — paste the anti-pattern checklist and tell it which rule it broke. Iterate until it matches `/design/system`.

---

> Step 1: Design the template once. Step 2: apply it everywhere via the per-view loop. Don't skip the grading pass.
