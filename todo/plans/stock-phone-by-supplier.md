# Stock on the phone, grouped by supplier ("2b")

Adrian checks stock on his phone in the field, and thinks in suppliers first: "I know who I bought it from, show me everything from them." This replaces the phone layout of `/admin/stock` with the design he chose on 2026-10-08 (canvas: [Stock Room](https://claude.ai/artifact/JcdBurLryUckrfNsc7mf6n), page "Three directions", boards 2b, T1, T2, X1 to X5).

**The rule for every stage: no function is lost.** The 46-function checklist (canvas page "Function checklist") is the acceptance list. The laptop layout is not touched.

## Shape

- A new phone screen, `src/admin/components/inventory/phone/`, rendered by `InventoryView` when `isMobile`. It reuses what exists: `useInventoryProducts`, the filter and facet logic in `inventory/domain.ts`, `ProductEditPanel`, `StockMovementPanel`, `InventorySourcePanel`, `IncomingReceiptsPanel`, the selection commands. `InventoryView.tsx` (3,200 lines) is only given the branch, never restructured.
- Group by Supplier (default on the phone), Kind, Status, Country, Owner or None. Sort inside each group.
- Each group line: teas, grams, value at retail, how many are low, how many are not checked.
- Each tea row: circle (select), name, year and kind and retail per gram, grams, "not checked", "+N g coming".
- Tap a tea: a panel underneath (supplier, kind, year, grams with Change, Checked, In transit, retail, flags-under, shop state, tasting and writing state) with Edit everything, Count it, Shown, More.
- Ticking circles swaps the bottom bar for actions: Collection, Publish, Invoice, Edit, More (Star, Samples, Share, Journal, Tasting profile, Writing, Move stock, Archive).

## Stages (one pull request each, in this order)

1. **The list and the panel.** Grouping, group lines, rows, tap panel, selection bar, the views sheet behind "All teas ▾" (every existing view, plus new "Not checked" and "In transit"), retail/cost and sort, the ··· tools sheet, Tea / Wares, search across supplier and tea. Done when the 46 checklist items that live on the list are all reachable at 390 px.
2. **The tea page.** `ProductEditPanel` on the phone gains: a stock block (grams of bought, flags-under, Checked with Count it, In transit), one row of single-tea actions, a jump row that sticks while scrolling, Wholesale and Reorder in Price, previous/next within the current group ("1 of 19 from Lidia"). Note: `sessionReserveGrams` is the public "nearly gone" warning line, not grams held back for sessions; label it that way.
3. **Supplier page and Incoming.** `InventorySourcePanel` gains totals and actions (Count these, Select all, Receive from them, Edit supplier); its tea rows open the tea. Incoming groups receipts by supplier with arrival date, payment state and how it travels. That needs one nullable column, `inventory_receipts.shipping_method` (air, sea cargo, courier, carried), schema only, no default.
4. **Field tools.** Count mode that walks whatever list is on screen (one supplier, one kind, or everything) one tea at a time with a number pad, saving each as a recount; scan a QR label to open the tea; return to the same group and scroll spot after leaving a tea; changes made with no signal are kept and saved when the connection returns.
5. **Data clean-up** (migration that moves rows, so a preview page goes to Adrian first, per CLAUDE.md): one spelling per kind (Sheng / Sheng Puer, Shou / Shou Puer, Pu-erh), HangJia's retail outlier ($142,102 at retail), teaware unit counts (all 117 pieces have none).

## Facts measured on the sandbox copy, 2026-10-08

223 teas, 60.5 kg, 37 low, 140 in stock with no checked date, nothing in transit, 28 suppliers, 117 teaware pieces with no unit counts.
