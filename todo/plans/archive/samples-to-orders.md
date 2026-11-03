# Samples to orders: taste, decide, buy, track

Locked with Adrian on 2026-10-10 after four rounds of mockups.
Canvas (all rounds, the bottom row is the locked flow):
https://claude.ai/artifact/LbMxLCMPyY7AT9W4mkdoXD

## What it is for

Samples are where Adrian tastes and decides. A sample is a row in the one Stock
list (Samples view), never its own screen. From a row he tastes, rejects, or
wants it. Wanting asks how much, then the tea goes into a buying basket that is
the shop's own basket turned around. Placing the order puts it in In process,
where a tracking number can be added by hand or by an agent, and Receive moves
it into Stock.

## Rules he set (do not re-litigate)

- One interface: samples are rows of the Stock list; the buying basket wears the
  customer basket's design ("Your order"), modified, not a new screen.
- Owner-only: customers never see the buying side.
- Two to three lines a row is fine; compact, no big circles, lining numerals.
- Row: line 1 name, year, kind (with a hairline under it); line 2 cost (amount,
  for how many grams, both tappable) and $/g; line 3 rating 1 to 5 as dots, then
  Taste / Reject / Want as one segmented control.
- Reject hides the row; a Rejected toggle shows them with Restore.
- Want asks how much (pieces or grams) before anything is added. Nothing is
  written to a supplier until he chooses to, from In process.
- Freight is never shown as route lines on the checkout. Routes, packing
  allowance and the carrier's billing step live once in Settings, and the
  basket estimates freight from them silently ("freight ≈ ¥340, packing included").
- Each tea can ship Air, Boat or Both; different routes can go to different
  addresses.

## Existing contracts to reuse (checked 2026-10-10)

- Reject / Restore: `tea_compass_entries.decision = 'passed_on'` / null
  (`CaptureCard.tsx` togglePass, `DecisionControl.tsx`, Library filter).
- Rating: `tasting.quality` 1 to 10 via Curate's correct door (`score`); five
  dots map to 2, 4, 6, 8, 10. Open question for Adrian: is "how much I like it"
  the same as quality? If not, it needs its own field.
- Want: Curate's Buy (`src/components/CurateV2/orderBuy.ts`, draft order per
  vendor and currency in the ledger). Owned by the Curate v2 session.
- Owner basket: `AdminCart` in `src/components/shared/AdminCart.tsx` already has
  `cartDirection: 'sale' | 'purchase'` and creates purchase orders. Purchase-order
  totals are owned by the v1 money session.
- Freight facts: `curate_freight_costs` (billed total, weight, mode per leg).
- Transport per receipt: `inventory_receipts.transport_mode` (migration 0036).

## Builds, one pull request each

1. Sample rows (E layout) on phone and laptop: rating, Taste, Reject with the
   Rejected toggle, editable cost and grams, Want asks how much and hands to
   Curate's Buy. No new storage.
2. Buying basket: the shop basket's layout for purchases, grouped by supplier,
   size tiles, Air / Boat / Both per tea, Receiving tiles, Place order.
   Coordinate with the Curate v2 and v1 money sessions before touching their files.
3. Shipping routes in Settings: carrier, address, packing %, billing step, with
   what past freight bills show. One new table (schema only, no data moved).
   The basket's freight estimate reads it.
4. In process: placed orders by supplier and route with steps (Placed, Sent,
   Shipped, Received), Send message, a tracking number field writable by an
   agent tool, Receive into Stock.
