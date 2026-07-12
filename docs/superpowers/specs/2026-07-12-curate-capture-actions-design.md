# Curate Capture Actions Cleanup

**Status:** Approved for implementation

## Problem

The capture sheet currently presents two overlapping decision systems. The canonical Sourcing Decision control offers Considering, Selected, and Passed on, while the footer repeats similar meanings through Want, Pass, and Bag it. The old Tasted action also obscures the intended Sample workflow.

## Design

The Sourcing Decision control remains the only place that records sourcing intent:

- Considering
- Selected
- Passed on

Remove the complete Tasted / Want / Pass / Bag it row from both mobile and desktop capture layouts.

Replace the bottom action area with one equal-width, three-column footer in this order:

1. Buy
2. Done
3. Sample

Done occupies the middle position and retains the gold primary-action treatment. Buy and Sample use the quieter secondary treatment. All three controls must retain the 44px tap-target minimum and remain equal width at supported capture breakpoints.

## Behavior

- Buy continues to open the acquisition/receipt workflow for the current tea.
- Done continues to commit the capture and advance or exit according to the existing capture flow.
- Sample replaces the old Tasted action and opens the existing tasting builder for the current tea. Opening it does not mark the entry as a physical sample and does not change its sourcing decision.
- Saving tasting information continues to attach that information to the exact current Compass entry.
- Considering, Selected, and Passed on remain independent of Buy, Done, and Sample.

No data fields or historical status values are removed. Existing `status` data remains readable for compatibility, but the capture sheet no longer offers the redundant Want/Pass controls.

## Responsive and Accessibility Requirements

- The three footer actions must fit without horizontal scrolling.
- The footer must retain mobile bottom-navigation clearance.
- Each action must have an unambiguous accessible name.
- Keyboard focus order follows the visible order: Buy, Done, Sample.

## Verification

- Browser tests assert the redundant four-action row is absent.
- Browser tests assert Buy, Done, and Sample are visible, equal width, and ordered correctly on desktop and mobile.
- A Sample interaction test asserts the tasting builder opens for the active entry without changing its sourcing decision.
- Existing acquisition and capture-completion tests continue to pass.
