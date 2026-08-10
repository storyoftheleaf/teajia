# Advice Service Ledger Redesign

**Date:** 2026-08-10  
**Status:** Approved visual direction

## Objective

Improve the `/advise` page without changing Teajia's established visual language, Adrian's writing, the existing photograph, or the page's navigation and inquiry flow. The work should make the service section easier to understand, more contemporary, and more deliberately integrated with the rest of the page.

## Approved direction

The existing hero remains intact: page title, “Tea spaces, sourcing, guidance.” heading, photograph, biography, and conversation link. The testimonial and final conversation call to action also retain their current content and overall treatment.

The current narrow service list becomes a wider editorial ledger. It is not a card grid. Three numbered rows present the existing services:

1. Tea House Design & Curation
2. Tea Curation & Sourcing
3. Sessions & Guidance

Each row aligns its number, service name and price, and existing description within a consistent grid. The “Hotels, studios, and teams” route becomes a contextual link inside the Tea House Design & Curation row instead of sitting separately below the entire service list.

The four existing session offerings remain visible. On wider screens they use a quiet two-column subgrid divided by fine rules; on small screens they stack into one column. Their names, descriptions, and prices remain unchanged.

## Surface hierarchy

The page uses only the existing Teajia theme tokens and typography.

- Hero and biography: `tea-bg`.
- Service ledger: `tea-surface` composited at approximately 35% over `tea-bg`, with `tea-border` rules at the section and row boundaries.
- Testimonial: returns to `tea-bg`.
- Closing invitation: `tea-surface` composited at approximately 20% over `tea-bg`, quieter than the service ledger.

The tonal changes must remain subtle in both light and dark themes. They provide section separation without introducing a new palette, gradients, decorative cards, or a competing visual identity.

## Typography and content

- Preserve all current public-facing copy verbatim.
- Preserve the existing photograph and its responsive crop.
- Use `TYPOGRAPHY_CLASSES` from `src/designTokens.ts` for headings, body text, labels, and links wherever the presets fit.
- Use the existing named `text-ui-N` scale for UI-sized text.
- Prices retain tabular figures and the existing gold emphasis.
- New numbering and the “Services” label are structural presentation, not rewritten marketing copy.

## Responsive behavior

On desktop, each service row uses an editorial grid with three areas: number, title/price, and description/details. The ledger should use more of the available content width than the current `max-w-[600px]` block while remaining comfortably readable.

On mobile, each row becomes a compact two-column structure: a narrow number column and a content column. Description and offering details sit below the title and price in the content column. No horizontal scrolling is permitted.

All interactive elements retain at least a 44px target through their intrinsic size or the `tap-target` utility. Page content retains mobile bottom-navigation clearance.

## Interaction and motion

- Keep the existing inquiry modal and preselection behavior unchanged.
- Keep the current restrained fade/rise section reveals.
- Do not add parallax, accordions, carousels, or attention-seeking motion.
- Keep the floating inquiry action, but position it with the shared bottom-navigation utility rather than an inline safe-area calculation.
- Keep `/for-your-space` routing unchanged.

## Implementation boundaries

Primary implementation is limited to `src/components/AdvisePage.tsx` and reusable Advice-specific styles added to `src/styles/card-utilities.css` if necessary.

Do not change:

- Navigation labels or routes.
- `BottomTabBar` or other navigation components.
- Inquiry submission behavior or worker APIs.
- Portfolio enablement.
- Testimonial data.
- Service, offering, biography, or CTA wording.

## Verification

Verify the finished page in the real application at `/advise` in both dark and light themes at mobile and desktop widths. Confirm:

- No horizontal overflow.
- Clear but restrained tonal separation.
- Existing copy and image are unchanged.
- All prices and session offerings are visible and aligned.
- `/for-your-space` still opens from the Tea House Design row.
- Every inquiry trigger opens the existing form with the correct preselection.
- The floating inquiry control clears the mobile bottom navigation.
- Reduced-motion behavior remains valid.

Run `npm run lint`, `npm run lint:colors`, and the relevant mobile Playwright coverage before completion.
