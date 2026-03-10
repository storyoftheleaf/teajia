# T3-31: Improve Quantity Selection with Presets

**Status:** [ ] Not started
**Priority:** Medium
**Group:** B (Shop UX)
**Files:** `src/components/shop/AlcoveCard.tsx`, `src/components/shop/QuickPeekDrawer.tsx`

## Problem
Changing quantity from 50g to 300g requires many taps of +10g. The gram slider helps but snap points are at 25g increments — no quick-jump to common quantities.

## Requirements
- Add preset quantity buttons: 25g, 50g, 100g, 250g (for tea)
- Keep the slider for fine-tuning
- Allow direct gram input (editable number field)
- Show per-gram price alongside total price in QuickPeekDrawer

## Implementation Notes
- AlcoveCard has magnetic snap slider — add preset buttons above it
- QuickPeekDrawer has HapticSlider — add preset chips below it
- Cart already allows direct numeric input — keep consistent
- Preset buttons should be pill-shaped: `25g | 50g | 100g | 250g`

## Acceptance Criteria
- [ ] Preset buttons visible on AlcoveCard
- [ ] Preset buttons visible on QuickPeekDrawer
- [ ] Direct gram input available
- [ ] Slider and presets stay in sync
