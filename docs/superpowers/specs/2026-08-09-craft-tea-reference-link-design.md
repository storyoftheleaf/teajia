# Craft Tea Reference link

## Goal

Make the existing Tea Wisdom reference discoverable from Craft without adding or renaming a primary navigation section.

## Approved experience

Add a full-width destination row to the opening Craft button list, directly after Glossary.

- Label: `Tea Reference`
- Description: `Plants, places, producers, styles and named teas`
- Destination: `/wisdom`

The row uses the same structure, spacing, typography, interaction states, divider treatment, and responsive behavior as the other Craft destination rows. The destination itself keeps its existing Tea Wisdom identity.

## Boundaries

- Do not change the main Craft navigation label or route.
- Do not replace or rename the existing Community Wisdom subview.
- Do not duplicate Wisdom data inside Craft.
- Do not add a new route, backend field, database record, or public dataset entry.

## Implementation shape

The Craft overview currently renders internal subviews as buttons. Tea Reference is a route destination, so its row will render as a React Router link while sharing the same row presentation. This preserves normal link behavior and sends the visitor directly to `/wisdom`.

## Verification

- Add a focused rendering test before implementation that requires the Tea Reference link, description, and `/wisdom` destination.
- Run the focused test through a red and green cycle.
- Run TypeScript lint, color lint, and the relevant test suite.
- Browser-check the Craft page at mobile and desktop widths for the new row, correct navigation, no console errors, and no horizontal overflow.
