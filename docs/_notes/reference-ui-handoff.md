# Handoff: the public reference needs another design pass

Start a fresh session for this. Everything below is what you need.

## What the surface is
A public tea reference at `/wisdom`. Seven kinds of record: tea plants with breeding
lineage, growing regions, producers, recipe marks, styles of pressing, teas that arrived
already named, and tea varieties. Roughly 630 entries. Each holding has an index of rows
and a detail page. It is meant to read as a well-set reference work, not a shop.

All the code is under `src/pages/wisdom/`. Nothing else needs touching.

## What Adrian just said, verbatim
> "I do like some form of differentiation between lines. I also prefer things wider than
> a thin, you know, a thing on the left where you can't see much. Currently your UI
> screenshot called B named looks like crap."

Two clear instructions:

1. **Rows need visible separation from each other.** The current index has none: no rules
   between rows, no zebra, nothing. It was a deliberate choice, taken from fine bookwork,
   and he does not want it.
2. **The column is too narrow and pinned left.** The content currently holds against a
   left axis with the right side of a wide screen running empty, like a book's fore-edge.
   He wants the width used.

Both of these reverse decisions made in the last pass. Reverse them.

## How it got here, so you do not re-derive it
The reference was flat: one background colour, hairlines between sections. He said it read
"like a textbook", then "it feels overwhelming to read."

Then the measurement that shaped everything after: **page background to panel fill is
1.21 to 1 in dark mode, 1.15 in light.** A surface step is only perceptible from about 1.4.
So the rounded panels and one-pixel borders that had been added were physically invisible,
contributing padding and no structure.

He was offered a wider palette and declined: *"It's fine if things are similar color, but
let's be very classy."* The tones stay close. That constraint still holds.

A senior editorial designer then gave ten moves for holding a near-monochrome page
together, and all ten were built. The ones that worked, keep:

- **One headword per screen.** A detail page opens like a dictionary entry: the record's
  name very large, a small tracked label above naming the record type, nothing else near
  that scale. This fixed "overwhelming" directly.
- **Catalogue numbers.** Every record numbered, small, in bronze: PL 013, NT 001. Per
  holding, two letter code, ordered from a frozen ledger in `catalogue.ts` so a new entry
  never renumbers an old one. **That decision must not be re-taken.**
- **Two rules, and length signals rank.** A full hairline for major divisions, a short
  bronze rule that stops dead under a section head.
- **A strict spacing ratio.** Tight within a group, loose between, three times more air
  above a section head than below it.
- **Three type sizes**, differentiated by weight, case and tracking.
- **Tracked capitals** doing the work a second colour would.

The ones he has now rejected: **no row separation** and **the narrow left-pinned measure
with an empty fore-edge.** Fix those two without losing the six above.

## Also outstanding on this surface
- The running head that names the current group renders before the reader has scrolled
  past the heading it names, so the top of an index shows the group label twice.
- A group of eleven and a group of one still carry the same visual weight.
- The short record pages (mark, style, named tea, producer) stop at two tones because
  nothing on them honestly earns a third.

## House rules that block a commit
- `docs/COLOR_RULES.md` is mandatory and its checks block. Safe tokens only. Never
  `text-white` or `bg-white`. Never a visible border on a pill or tag.
- Micro-caps are for labels of three words or fewer, never sentences. A helper enforces
  this and its test must keep passing.
- No horizontal scroll at any width. Interactive rows and controls at or above 44px.
- Bronze is an accent for the active state, the brand and badges. Catalogue numbers spend
  it. If a page reads too gold the fix is less of it, never a different hex.
- The project bans em-dashes in all copy and comments, and a check blocks on this path.
- Run `npm run lint`, `npm run lint:colors`, `npx vitest run src`. All must pass.

## How to look at it
`npm run dev` then `/wisdom/named` and `/wisdom/cultivar/chin-hsin`. Kill any stale dev
servers first: a previous session left nineteen running and one of them served a stale
build that returned a not-found page for a route that works.
