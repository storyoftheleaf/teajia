# TODO 14: Create a Unified Button Component and Enforce It

**Priority:** P3 — MEDIUM-LOW
**Impact:** Visual consistency, maintainability, accessibility
**Effort:** Medium (2–3 days)
**Category:** Design System

---

## Problem

No unified button system exists. Every button is styled ad-hoc:

- Primary buttons: `px-4 py-3`, `px-6 py-3`, or `px-6 py-2.5`
- Icon buttons: `p-2`, `p-1.5`, `p-1`
- Border radius: `rounded-xl`, `rounded-lg`, `rounded-full` — mixed
- Focus states: some have `focus-visible:ring`, most don't
- The shared `Button.tsx` exists but isn't used consistently

## Proposed Button Variants

### `<Button variant="primary">`
- Background: `bg-tea-gold hover:bg-tea-gold-lt`
- Text: `text-tea-bg font-medium`
- Padding: `px-6 py-3`
- Border radius: `rounded-xl`
- Focus: `focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-2`
- Use: Primary CTAs, "Add to Cart", "Place Order"

### `<Button variant="secondary">`
- Background: `bg-tea-surface hover:bg-tea-elevated`
- Text: `text-tea-text`
- Border: `border border-tea-border`
- Padding: `px-5 py-2.5`
- Border radius: `rounded-lg`
- Use: Secondary actions, "Cancel", "Back"

### `<Button variant="ghost">`
- Background: `transparent hover:bg-tea-accent-sub`
- Text: `text-tea-text-sec hover:text-tea-text`
- Padding: `px-4 py-2`
- Border radius: `rounded-lg`
- Use: Tertiary actions, navigation links styled as buttons

### `<Button variant="icon">`
- Background: `transparent hover:bg-tea-accent-sub`
- Padding: `p-2` (ensures 44px min touch target with 24px icon)
- Border radius: `rounded-lg`
- Use: Icon-only buttons (close, menu, etc.)

## Additional Props

```typescript
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'ghost' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  as?: 'button' | 'a' | 'link'; // for router links
}
```

## Steps

1. Update `src/components/shared/Button.tsx` with the variant system above
2. Audit all `<button>` elements across the codebase (648+ instances)
3. Replace high-traffic buttons first:
   - Shop "Add to Cart" buttons
   - Cart panel action buttons
   - Navigation CTAs on HomePage
   - Modal action buttons
4. Add a lint rule or convention to discourage raw `<button>` elements

## Files to Modify

- `src/components/shared/Button.tsx` — Rewrite with variants
- 30+ component files with raw `<button>` elements

## Verification

- All buttons across the site have consistent padding, radius, and focus states
- Touch targets are at least 44px on mobile
- Keyboard focus is visible on all buttons
- Loading state shows spinner and disables interaction

## Related Issues

- #06 (rgba remediation — button shadows may use hardcoded values)
