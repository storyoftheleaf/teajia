# Visual Review — Pre-Launch Fix Run

> Click each link, look at the page, judge it with your eyes. No code reading. The dev server on the `prelaunch/autofix` branch is live at **http://localhost:7777**.

**Created:** 2026-05-16
**Branch under review:** `prelaunch/autofix` (24 fixes)
**How to use:** open each link, do the "look at / check" step, mark it 👍 or ✏️ (needs work). Tell Claude the ✏️ ones and they get fixed on the branch.

---

## 🔴 The 3 big ones — look closely

### 1. Add-a-tea form  (fix O-P0-1)
**Link:** http://localhost:7777/admin/inventory → click the **"Add"** button (top of the page)
**What changed:** the 45-field wall is now one form with 6 essentials on top + 3 collapsed sections.
**Look at / check:**
- Does it open showing ~6 fields (Photo, Name, Type, Cost, Stock, Price) and 3 closed sections below?
- Click each section open: "Naming & origin", "Story & lore", "Stock details & flags" — do all the old fields appear somewhere?
- Does it feel easier than a wall of 45 fields?

### 2. Delete confirmations  (fix O-P0-3)
**Links — try deleting in each:**
- Collection item → http://localhost:7777/admin/collections → open a collection → remove an item
- Article → http://localhost:7777/admin/magazine → delete an article
- Event → http://localhost:7777/admin/events → delete an event
- Customer → http://localhost:7777/admin/people → delete a contact
**Check:** every one should now pop a confirmation dialog before deleting. None should delete on a single click.

### 3. Corner radius consistency  (fix CON-2)
**Link:** browse anywhere — http://localhost:7777 , the shop, the admin
**Look at:** do buttons, cards, inputs, and panels have *consistent* rounded corners now? Nothing should look mismatched (a sharp box next to a very round one). This was 6 different corner styles collapsed to 3.

---

## 🟡 Quick look — moderate changes

### Checkout confirmation  (C-P0-1)
**Link:** http://localhost:7777/shop → add a tea to cart → open cart → go through checkout → send
**Check:** after sending, does the confirmation clearly show an **order reference number** and reassuring "we'll reply on WhatsApp" wording?

### Order tracking page  (C-P0-2)
**Link:** http://localhost:7777/shop → complete a checkout → the confirmation links to an order page
**Check:** the order page loads and shows status + items (it should — this fix only verified the wiring).

### Inventory view tabs  (O-P1-3)
**Link:** http://localhost:7777/admin/inventory
**Check:** the 8 views (All, Selling, Low Stock, etc.) — are they now visible tabs instead of hidden in a menu? Switch between them: does your row selection stay?

### Store launch progress  (O-P1-1)
**Link:** http://localhost:7777/admin/store-playbook (or via admin → Store Playbook)
**Check:** is there a "step N of 6" progress indicator with completion ticks?

### Invoice product autocomplete  (O-P1-4) + repeat-last-order  (O-P1-5)
**Link:** http://localhost:7777/admin/activity → create an invoice
**Check:** typing a product name in a line item — does it autocomplete? For a known customer, is there a "repeat last order" option?

### Order row inline actions  (O-P1-6)
**Link:** http://localhost:7777/admin/activity
**Check:** can you change an order's status directly on the row, without opening a `⋮` menu?

### Article editor preview  (O-P1-7)
**Link:** http://localhost:7777/admin/magazine → edit an article
**Check:** is there a preview pane? Does a bad paste show an error instead of silently failing?

### Error messages  (O-P1-9)
**Anywhere an action fails** — check the message is specific (names what failed), not just "Action failed".

---

## 🟢 Glance — small shop/checkout polish

| Fix | Link | Check |
|---|---|---|
| C-P1-2 | http://localhost:7777/shop | A result count ("14 teas") shows above the grid |
| C-P1-3 | http://localhost:7777/shop → open a product | Quantity can't exceed available stock |
| C-P1-4 | http://localhost:7777/shop → checkout | Wording says "order" not "inquiry" |
| C-P1-5 | http://localhost:7777/shop → checkout | Bad/empty shipping location is rejected |
| C-P2-2 | http://localhost:7777/shop | Filter groups have helper text |
| C-P2-4 | http://localhost:7777/shop → checkout | Currency selector shows the rate/converted total |
| C-P2-6 | http://localhost:7777/signup | Contact-platform + username fields have helper text |
| C-P3-3 | http://localhost:7777/shop → add to cart → remove an item | Undo window lasts ~10s |
| O-P1-2 | /admin/inventory → Add → type a new vendor name | A "create new vendor?" confirm appears |
| O-P2-4 | /admin/activity → an order's WhatsApp message | Includes a prefill link |

---

## ⚠️ One thing to check yourself

**C-P2-1 — store picker.** This fix didn't run (the agent said it's "already implemented"). Go to http://localhost:7777/shop — if there's only one store, the store-picker dropdown should be hidden. If you see a pointless one-option dropdown, it needs fixing.

---

## Not done — these need your decision (never automated)

These are design judgment calls, deliberately left for you:
- Homepage CTA placement (buried behind the scroll animation)
- Homepage value-proposition copy
- Collection-building flow reflow (9 steps → fewer)
- Vendor/customer merge tool

---

## When you're done

Tell Claude which items are ✏️ (need work). Each fix is its own commit on `prelaunch/autofix` — they can be fixed, or dropped, individually. Merge the branch when you're happy.
