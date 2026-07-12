# UI Consistency Standard

> The visual contract. Buttons, corner radii, inputs, focus states — one set of rules so every interface feels like the same product. Modeled on `COLOR_RULES.md`, enforced the same way.

**Created:** 2026-05-16
**Companion docs:** `COLOR_RULES.md` (color contract) and `tracks/01-launch-integrity.md`. The shipped friction and fix queues are preserved in `_archive/consolidated-2026-07/`.

---

## Why this exists

The design system already exists — `src/designTokens.ts` exports `BORDER_RADIUS` and `SHADOWS`, `Button.tsx` is a shared component, `card-utilities.css` has a full `.pill-*` family. The problem is it is **not enforced**. Color rules block commits; shape and button rules don't. So usage has drifted.

This document defines the canonical rules and adds them to the lint gate so drift can't return after launch.

---

## The drift, measured

Counts from `grep` over `src/` (`*.tsx`), May 2026:

**Corner radii — six values in use:**

| Class | Occurrences |
|---|---|
| `rounded-full` | 505 |
| `rounded-lg` | 502 |
| `rounded-md` | 409 |
| `rounded-sm` | 342 |
| `rounded-xl` | 172 |
| `rounded-2xl` | 37 |

Six radii is not a system — it's whatever each component reached for. A card with `rounded-xl` next to one with `rounded-lg` next to a `rounded-2xl` panel reads as three different products.

**Buttons:** three coexisting patterns — the `<Button>` component, raw `.pill-*` classes used as buttons, and one-off Tailwind (`px-4 py-2 rounded-md bg-…`). No single rule for which to use when.

**Inputs:** `inputStyle` / `selectStyle` constants in `AddProductModal.tsx`, the `.input-warm` class, and ghost inputs — each its own look and focus behavior.

---

## The standard

### 1. Corner radius — 3-tier scale

Six values collapse to three tiers. Every `rounded-*` in the codebase maps to exactly one.

| Tier | Class | Use for |
|---|---|---|
| **Control** | `rounded-md` | Inputs, selects, buttons, small controls, badges |
| **Container** | `rounded-xl` | Cards, panels, modals, sheets, larger surfaces |
| **Pill** | `rounded-full` | Pills, chips, avatars, fully-round elements |

- `rounded-sm` and `rounded-lg` are **retired** — migrate to `rounded-md` (control) or `rounded-xl` (container) by context.
- `rounded-2xl` is **retired** — migrate to `rounded-xl`.
- `rounded-none` stays valid (explicit square — e.g. edge-to-edge media).
- Directional classes (`rounded-t`, `rounded-b`, `rounded-l`, `rounded-r`) stay valid but should use the tier radius for the value (`rounded-t-xl`, not `rounded-t-lg`).
- This aligns to `designTokens.ts` `BORDER_RADIUS` — that token set is the source of truth; the migration brings usage in line with it.

### 2. Buttons — `Button.tsx` is canonical

- **`<Button>`** is the only component for primary / secondary / ghost / destructive actions. All four variants live there.
- **`.pill-*`** classes are reserved for **toggle chips and filters** — selectable state, not actions. (Pill toggles in `AddProductModal`, shop filter chips: correct. A `.pill-primary` used as a form's Save button: wrong — use `<Button variant="primary">`.)
- One-off Tailwind button styling (`px-4 py-2 rounded-md bg-tea-gold …`) is **not allowed** for new code — use `<Button>`.

### 3. Inputs — one input, one label, one focus ring

- One shared input style, one shared label style, one focus ring treatment, used by every form field.
- The focus ring is the one already standard in the codebase: `focus-visible:ring-2 ring-tea-gold/50` with offset. No bespoke focus styles per form.
- The add-tea reorganization (historical `FRICTION_REVIEW.md` O-P0-1, now archived) was the first consumer of the unified input style.

### 4. Spacing & hover

- Interactive elements use the existing `tap-target` rule for the 44×44 floor (already in `card-utilities.css`).
- Hover/active on list and nav items: `hover:bg-tea-gold/5`, active `bg-tea-gold/8` (already the sidebar standard — apply everywhere).

---

## Enforcement — lint rule

Add to `scripts/lint-colors.sh` (the existing pre-commit gate). The script already has `check_pattern` / `check_pattern_ere` helpers and runs before every `npm run build`. Add two checks:

**Rule 8 — off-scale corner radius (BLOCKING).** Flags `rounded-sm`, `rounded-lg`, `rounded-2xl` (and their directional forms) so retired values can't return:

```bash
# 8. Off-scale corner radius — BLOCKING.
#    Canonical scale is rounded-md (control) / rounded-xl (container) / rounded-full (pill).
#    See UI_CONSISTENCY.md. rounded-sm / rounded-lg / rounded-2xl are retired.
check_pattern_ere 'rounded(-(t|b|l|r))?-(sm|lg|2xl)([[:space:]"'"'"'`]|$)' \
  "Off-scale corner radius — use rounded-md / rounded-xl / rounded-full. See UI_CONSISTENCY.md."
```

**Rule 9 — `.pill-*` used as an action button (NOTICE, then promote to blocking once migrated).** Starts as a non-blocking notice because the migration is progressive; flip to blocking once the codebase is clean:

```bash
# 9. .pill-primary / .pill-destructive used outside a toggle context — NOTICE.
#    Action buttons must use <Button>. .pill-* is for toggle chips/filters only.
check_pattern_notice 'pill-(primary|destructive)' \
  "pill-* action class — use the <Button> component for actions. See UI_CONSISTENCY.md. (non-blocking until migration completes)"
```

Both checks shipped with the archived consistency fix queue. Rule 8 remains part of the enforced contract.

---

## Migration order

1. Add the unified input/label/focus style (Rule 3).
2. Run the codebase-wide `rounded-*` consolidation (Rule 1) — mechanical, one PR.
3. Add lint Rule 8 (now safe — nothing off-scale remains).
4. Migrate `.pill-*` action buttons to `<Button>` (Rule 2) — progressive.
5. Add lint Rule 9 as a notice; promote to blocking when step 4 is done.

Steps 1–3 are queued for the autonomous run. Steps 4–5 are progressive and can finish post-launch.
