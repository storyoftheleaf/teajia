# Curate v2: the journeys it must actually walk

**Goal (Adrian, 2026-10-08):** keep looping, build, walk, compare, fix, until
no undone thing or problem is left in Curate v2's design and the functions
behind it. Decide what is best without asking; stop only when a full pass
finds nothing.

The look is agreed ("A Day in Curate", dressed as the shop and Stock). This file
is how it must BEHAVE: what loads, what each tap does, where back goes. Every
loop is checked against it, on real-shaped data, step by step. A screen that
looks right and behaves otherwise is not done.

Survey of what was wrong (2026-10-08): two vendor pickers writing different
things; the Run and the Table rows disagreeing about which teas are on the
table; every tea opening as the TABLE tab; a one-step back; old v1 panels
showing through.

## The model (one of each)

- **A table is a run with a vendor.** "Run" is the old word; the UI says
  table. Starting a table asks whose table it is (the vendor picker below);
  every tea added while that table is open gets that vendor and that table's
  session id. A table stays open until a new table is started. A table may
  have no vendor yet; it can be named later, and naming it then fills every
  tea on it that has no vendor.
- **The rows on the Table tab are exactly the teas on the open table**: drafts
  and saved, tea and teaware, newest at the bottom (the order they were
  poured). The count in the header is the same number.
- **One vendor picker, the original one Adrian likes** (VendorStrip's
  dropdown): a search input; first row "New vendor…" (or `New vendor "x"` once
  typed); then recent vendors; then the shop's vendors. Picking a known vendor
  is one tap. A new one is created as a real vendor record (tags `['vendor']`)
  in one tap. Changing vendor is tapping the name, not clearing it first. The
  same picker is used for the table header and inside a tea.
- **A tea opens ON TOP of the tab you are on**, as its own screen. The tab
  highlight does not move. Back closes it and you are exactly where you were
  (Today, the vendor's card, the comparison, the order, the table rows). Back
  is a stack, not one slot. Opening the full form ("Edit all fields") stacks on
  the tea; back returns to the tea.
- **Tabs reset**: tapping a tab closes any open tea and shows that tab's own
  screen.
- **Chinese names are suggested, never typed.** Adrian does not read Chinese.
  A tea without one shows "suggest" (the existing /api/generate-chinese-name);
  the suggestion shows with ✓ keep and ✕; nothing is saved without the ✓.

## Journey 1: at the table

1. Table tab with no open table: one line "Start a table", nothing else.
2. Tap it: the vendor picker opens. Type "Wa", see Wang Laoshi, tap. Or tap
   "New vendor…", type a name, Add (a vendor record exists after).
3. The header reads `Wang Laoshi · 0 teas · ¥` with "new table" on the right.
4. Type `Yiwu Gushu 2019 ¥1200/cake`, Enter. A row appears: name, year,
   ¥1,200 cake, Taste frame, mic frame. Header says 1 tea. Repeat for four more.
5. Taste on a row: the fast tasting sheet; six answers; close; the row shows
   "8 · Clean"; Taste frame is gold.
6. Tap a row: the tea screen over the Table tab (TABLE stays lit). Back: the
   rows, scrolled where they were.
7. "New table": the picker again; after picking, rows are empty and the
   previous table's teas are in Teas and on Today.

## Journey 2: deciding (Today)

Today is sections, each a different kind of thing, each with its own heading
and count, and each line names its SUBJECT first:
- **From your agent** — a find: "GrokBot · Mengku Tea House · 4 teas" → Pick.
- **To do** — "XWT-LB1 有机六堡茶1 — confirm the year (about 2016)" → Done.
- **To decide** — tasted, no decision → opens the tea; Pass · Sample · Buy.
- **Needs a cost** — saved without a price → opens the tea on Cost.
- **Vendors to reach** — vendor with no WeChat/WhatsApp/phone → their card.
- **On the way** — ordered, not arrived, with days → Arrived.
- **To shelve** — arrived, not on the shelf → Shelf.
Empty sections are not shown. Tapping a line opens its thing ON TOP of Today;
back returns to Today with the list as it was, the line gone if it is done.

## Journey 3: ordering

1. On a tea: Buy. The tea is added to the open order for its vendor (one
   order per vendor; a new draft if none), the decision becomes Selected, and
   the ORDER opens on top (not the old form's buy panel).
2. The order: one shop row per tea (year frame, name, kind, "2 cakes ¥2,400",
   − +), freight at the shop rate, the rate today, landed in dollars.
3. Message: the sheet with Chinese then English, Copy for WeChat, WhatsApp.
4. Confirm: the order is confirmed (purchaseOrders.create as today), its teas
   move to "On the way".

## Journey 4: receiving

1. Today → On the way → Arrived on a tea (or the receipt row): it moves to
   To shelve.
2. Shelf: puts it on the shop shelf (the existing promote), it leaves Today.

## Looks still owed

- Separation and contrast, keeping the colours: each Today section on its own
  band (surface vs page), clearer row dividers, secondary text at least
  tea-text-sec where it carries meaning, the open tea on a raised surface.

## Status, 9 October 2026 (after ten passes)

All four journeys are built and live (main `a415c9cb`, served inside the
`162d218c` build). Held by `tests/curate-v2-journeys.spec.ts` (journeys, looks)
and `tests/curate-v2-requests.spec.ts` (every request body, every failure path,
orders from the shop). Pass 8 and 9 walked the real worker on a local
database; a tea bought in v2 shelves with its cost, currency (marked stated)
and stock.

Left open, deliberately:
- Light mode: the gold action words measure 4.21:1 on the Today band, under
  4.5. Fixing it darkens the site's gold token everywhere; Adrian's call.
- A local order confirmed before `purchaseOrderId` was kept cannot be matched
  to its shop record (the worker does not store `po_number`), so it can show
  twice on that one device.
- The full tasting is the shared journal component dressed by CSS inside
  Curate; its liquor-colour strip keeps rounded ends.
- Chinese characters outside the site's Noto Serif SC subset fall to the
  phone's system CJK serif; a phone without one uses its default.

## How each loop is checked

`tests/curate-v2-journeys.spec.ts` walks journeys 1-4 on the phone size with
the compass harness, asserting the tab highlight, what is on screen and where
back lands at every step. A loop is done when it passes AND the screenshots
match the drawing by eye. Then the live site, on Adrian's real data.
