# TODO 50: Replace Hardcoded Hex Colors with Semantic Tokens

**Priority:** High
**Impact:** Theme support, visual consistency
**Effort:** 2–3 hours
**Category:** UI Consistency / Color
**Related:** TODO 06 (rgba remediation — handles `rgba()` in inline styles; this handles hex literals in Tailwind classes)

---

## Problem

Several components use hardcoded hex color values (`#1a1a1a`, `#141210`, `#E8E3D9`) and `bg-black/25` in Tailwind classes. These don't respond to theme changes.

## Examples

- `src/components/shared/PopupModal.tsx:313,317` — `bg-[#1a1a1a]` for sheet background
- `src/components/shared/PopupModal.tsx:217` — `bg-black/25` for backdrop
- `src/admin/components/DashboardView.tsx:11-12` — Chart tooltip uses `#141210`, `#26221D`, `#E8E3D9`

## Distinction from TODO 06

TODO 06 targets `rgba()` in inline `style=` attributes. This task targets hardcoded hex values and `bg-black/N` in Tailwind class strings.

## Proposed Fix

Replace all hardcoded hex/black colors with semantic tokens:

| Current | Replacement |
|---|---|
| `bg-[#1a1a1a]` | `bg-tea-surface` or `bg-tea-bg` |
| `bg-black/25` | `bg-tea-text/25` (adapts to theme) |
| `#141210` (chart) | `var(--tea-bg)` CSS variable |
| `#E8E3D9` (chart) | `var(--tea-border)` CSS variable |

## Acceptance Criteria

- [ ] No hardcoded hex colors (`bg-[#...]`, `text-[#...]`, `border-[#...]`) in component files
- [ ] No `bg-black` or `bg-white` usage (use `bg-tea-bg`, `bg-tea-text` etc.)
- [ ] Chart tooltips use CSS variables that respond to theme
