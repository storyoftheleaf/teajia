# TODO 06: Remediate 328 Hardcoded rgba() Values

**Priority:** P1 — HIGH
**Impact:** Theme consistency, light/dark mode reliability
**Effort:** High (1–2 weeks for full cleanup)
**Category:** Design System

---

## Problem

COLOR_RULES.md explicitly bans hardcoded `rgba()` in inline styles because they don't adapt to theme changes. Yet 328 instances exist across the codebase. The light/dark mode toggle produces visual artifacts — invisible borders, wrong contrasts, and broken shadows — on nearly every page.

## Common Patterns to Replace

| Hardcoded Pattern | Replace With |
|---|---|
| `rgba(200,170,120,0.08)` — gold border | `border-tea-border` |
| `rgba(200,170,120,0.10)` — gold accent bg | `bg-tea-accent-sub` |
| `rgba(200,170,120,0.12-0.20)` — gold divider | `bg-tea-border` or `divide-tea-border` |
| `rgba(0,0,0,0.2-0.4)` — dark shadow | Tailwind `shadow-*` classes |
| `rgba(0,0,0,0.25)` — overlay | `bg-black/25` (Tailwind opacity) |
| `rgba(196,184,154,0.7)` — muted text | `text-tea-text-sec` |
| `style={{ boxShadow: '...' }}` — custom shadows | Use shadow tokens from `designTokens.ts` |

## Approach

### Phase 1: Automated Discovery
```bash
# Find all rgba in TSX files
grep -rn "rgba(" src/ --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v designTokens
```

### Phase 2: High-Traffic Components First
1. `src/components/HomePage.tsx` — boxShadow rgba (line 303, 336)
2. `src/components/shared/CartPanel.tsx` — background rgba
3. `src/components/shared/PopupModal.tsx` — background + shadow (line 188)
4. `src/components/shop/AlcoveCard.tsx` — divider (line 538)
5. `src/components/shop/TeawareAlcoveCard.tsx` — divider (line 479)
6. `src/components/BottomTabBar.tsx` — logo emblem (lines 122-123)
7. `src/components/LeftSidebar.tsx` — gradient + shadow (line 148)

### Phase 3: Admin Components
8. `src/admin/components/TeaDetailsModal.tsx` — divider (line 522)
9. Remaining admin files

### Phase 4: CSS Files
10. `src/styles/card-utilities.css` — 11 inline opacity values

## Also Fix: 65 Hardcoded Hex Colors

Search for `bg-[#`, `text-[#`, `border-[#` and replace with semantic tokens:
- `bg-[#0f0f0f]` → `bg-tea-bg`
- `text-[#...]` → `text-tea-text` or `text-tea-text-sec`

## Verification

- Toggle dark/light mode on every page — no visual artifacts
- No `rgba(` in any TSX `style={{ }}` props (except in designTokens.ts)
- Grep for `rgba(` returns 0 results in component files

## Related Issues

- #10 (banned token migration — overlapping scope)
