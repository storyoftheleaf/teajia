# Teajia — April To-Do List
*Generated 2026-04-19 via Playwright site audit + backend code scan + admin component review*

---

## 🔴 Bugs — Broken Functionality (Public Site)

### 1. "Explore the studio" link on About page goes nowhere
`src/AboutPage.tsx:145` — `href="#"`, clicks do nothing. Needs real destination (Adrian's art studio).

### ~~2. Homepage email capture is wired to a TODO — never submits~~ ✅ Fixed
`src/components/HomePage.tsx` — Wired to `api.newsletter.subscribe`. Loading, success ("You're in."), and error states added.

### 3. Cart panel doesn't open from Shop page
Playwright confirmed clicking the CartIndicator on `/shop` produced no panel. The `setIsCartOpen` event may not be firing correctly from that route.

### 4. Admin login modal doesn't auto-show on `/admin` when unauthenticated
The `setIsLoginOpen(true)` call in `AdminApp.tsx:279` may not be firing on initial `/admin` visits — likely a `useEffect` timing issue.

### 5. Dead share button on AlcoveCard
ROADMAP: non-functional button destroys trust. Connect to `ShareModal` or remove.

### 6. Product modals are not URL-backed
No way to share or bookmark a specific tea. ROADMAP calls for `/shop?product=tie-guan-yin` style params.

### 7. Instagram link in Contact modal is a placeholder
`src/App.tsx:741` — `@teajia.journal` has `href="#"`. Needs real Instagram URL.

---

## 🔴 Bugs — Broken Functionality (Backend)

### ~~8. Malformed route definitions~~ — Not an issue
Routes verified correct in `worker/src/index.ts:7187–7217`. All `:params` properly formatted.

### 9. Dev admin hard-coded credentials in production code
`worker/src/index.ts:563–592` — Hard-coded password hash for 'aaa'/'asdfghjkl' logins. If source leaks, this is an admin backdoor. Gate behind an env variable or remove before production.

### 10. `newsletter_subscribers` table missing from schema.sql
The table is created dynamically in the worker (`worker/src/index.ts:4129`) but has no `CREATE TABLE` statement in `worker/schema.sql`. New deployments or migrations won't create this table.

### 11. D1 batch operations lack try/catch — partial updates can occur
`handleFulfillInvoice`, `handleVoidInvoice`, `handleSplitInvoice` — multi-step DB operations with no rollback on failure. Stock can be deducted before invoice update confirms.

---

## 🟠 UX — Public Site Flows

### 12. Checkout should be "Send Inquiry"
The cart uses checkout language, but every order is a personal WhatsApp conversation. Rename CTA to "Send Inquiry" and show "We confirm every order personally" early in the flow.

### 13. No stock indicators on Shop
"In Stock / Low Stock / Limited" badges are missing from product cards. Adrian tracks thresholds in admin already.

### 14. No price-per-gram on product cards
Specialty buyers compare $/g. Show alongside total price on cards and product pages.

### 15. No brewing guide per product
~20 profiles cover the full catalog. Water temp, steep time, leaf ratio, vessel, infusion count — look up by tea type and form.

### 16. Silent API failures — no offline/error state
When the Worker is unreachable, pages fail silently. Add a toast or banner so users know it's temporary.

### 17. Magazine shows blank when API offline
No tabs, no cards, no empty state. Needs a polished fallback.

### 18. Journey page is thin — 204 chars of text
Either flesh it out or redirect it somewhere meaningful.

### 19. About page: only 1 image
If this is the brand's face for new visitors, it needs more visual weight.

---

## 🟠 UX — Events Page (`/admin/events`)

### 20. No search or filter on the events list
No way to search by title, date, location, or status. A basic text filter would help as the list grows.

### 21. Missing "gathering type" field in event creation
`src/admin/components/EventForm.tsx` — The form has "format" (private tasting, workshop, pop-up, etc.) but no distinct "gathering type" field. ROADMAP: guests need this context even in simple mode.

### 22. Event creation form has no simple mode
The form has 9+ fields in the basic section alone, plus Location, Venue Guide, and Session Flow sections. ROADMAP: simple mode = title, date, seats, gathering type, share link only. Everything else is optional.

### ~~23. Event edit form uses bare browser `prompt()` for slug editing~~ ✅ Fixed
`src/admin/components/EventsManager.tsx` — Replaced with a styled inline dialog. Pre-fills with `{slug}-copy`, supports Enter/Escape, matches admin surface styling.

### 24. EventDetail tab bar overflows on mobile
`src/admin/components/EventDetail.tsx:214–237` — 7 tabs (Requests, Attendees, Briefing, Reminders, Tea Menu, Notifications, Post-Session). Will overflow horizontally on 390px. No visible scroll hint.

### 25. Capacity bar doesn't differentiate "awaiting approval" from waitlist
`src/admin/components/EventDetail.tsx:175–196` — Confirmed and waitlist are shown visually but pending approval looks the same as waitlist.

### 26. Venue and space selection is confusing
`src/admin/components/EventForm.tsx:289–368` — User picks a venue, then must pick spaces inside it. No explanation of this relationship. If no spaces are selected, capacity silently defaults to 12. "Add spaces" link navigates away to `/admin/venues` without context.

---

## 🟠 UX — Tea Compass (`/admin/compass`)

### 27. Add-entry flow is indirect
`src/components/TeaCompass/index.tsx:404–483` — There's no "New Entry" button on the Tasting or Buying tabs. Users must switch to the Sourcing tab to capture. Should be a single prominent add button visible in all tabs.

### 28. Compass tab bar can overflow on mobile
`src/components/TeaCompass/index.tsx:361–395` — Three tabs (Sourcing, Tasting, Buying) with icons use `flex border-b` but no scroll handling. On 390px the third tab may be cut off with no scroll hint.

### 29. No search on Compass
No way to find past tasting entries as the journal grows. Should have at minimum a text filter.

### 30. No bulk accept/decline for incoming shares
`src/components/TeaCompass/index.tsx:494–549` — Incoming shared entries require individual accept/decline. No "accept all" or "decline all" for when multiple people share at once.

### 31. No preview before accepting a shared Compass entry
Shared entry metadata (name, type, year, photo) is shown but you can't see the full notes before accepting.

---

## 🟠 UX — Inventory Management (`/admin/inventory`)

### 32. Mood/tasting notes editing requires opening a separate modal
`src/admin/components/InventoryView.tsx:3557` — Moods and tasting notes ARE in the sidebar panel ("Tasting Profile" section), and description IS in "Story & Background → Introduction". However, clicking any tasting field opens the full `TastingEditorModal` rather than allowing quick inline edits. For frequent edits, inline mood text would be faster.

### 35. Inventory table overflows on mobile
`src/admin/components/InventoryView.tsx:63–73` — Column widths use fixed percentages (`w-[28%]`, `w-[10%]`, etc.) that become unreadably narrow on a 390px screen. The mobile UI bar exists but the table itself isn't responsive.

### 36. Group collapse/expand feature is unfinished
`src/admin/components/InventoryView.tsx:745` — `collapsedGroups` state exists but no UI toggle to expand/collapse groups is rendered. Feature appears partially implemented.

### 37. Edit mode is confusing
`src/admin/components/InventoryView.tsx:2117–2127` — The "Edit" button enables row checkboxes for bulk editing, but there's no explanation of this in the UI. The flow (select rows → choose field → choose value) is non-obvious.

### 38. Price mode resets when switching saved views
`src/admin/components/InventoryView.tsx:712` — Price mode (e.g., cost vs. retail) is local state and resets every time a view is switched. Should be remembered globally.

### 39. Stock column header should say "Stock (g)" not "Stock"
`src/admin/components/InventoryView.tsx:68` — Units are grams, but the header just says "Stock." Ambiguous for teaware which uses units instead.

### 40. Vendor filter has no UI entry point
`src/admin/components/InventoryView.tsx:1759–1783` — The vendor filter banner appears, but the only way to set it is via navigation from another view. There's no way to set or clear a vendor filter from within the inventory view itself.

### 41. Ghost inputs (inline edits) have no `<label>` elements
`src/admin/components/InventoryView.tsx:281–337` — Each GhostInput uses placeholder text instead of an associated label. Screen readers can't identify what field they're editing.

### 42. Desktop dropdown menus missing `role="menu"`
`src/admin/components/InventoryView.tsx:2170, 2202, 2231` — The column picker, group-by, and options dropdowns lack `role="menu"`. Mobile dropdowns have it (line 1887, 1914, 1964) — inconsistent.

---

## 🔵 Backend — Security & Integrity

### 43. CORS allows all origins via wildcard
`worker/src/index.ts:458–465` — CORS origin is set from the request header with a wildcard fallback. Should whitelist allowed origins explicitly.

### 44. `account_id` columns in key tables are nullable
`worker/schema.sql:77, 132, 171` — `products.account_id`, `customers.account_id`, and `invoices.account_id` are `TEXT` (nullable). These should be `TEXT NOT NULL` with a foreign key to `accounts(id)`. A null `account_id` bypasses multi-tenant isolation.

### 45. No input validation on product create
`worker/src/index.ts:1185` — `handleCreateProduct` doesn't validate that `product_name` is non-empty, `type` is a valid enum, `year` is a 4-digit number, or numeric fields are non-negative.

### 46. No size limit on bulk product creation
`worker/src/index.ts:1232` — `handleBulkCreateProducts` accepts unbounded arrays. A single request with 10k products could time out the worker or spike D1 write costs.

### 47. Dynamic column names in UPDATE not fully whitelisted
`worker/src/index.ts:1375` — `UPDATE products SET ${sets}` uses column names from the request body. The code removes `account_id` and `id`, but doesn't validate against a strict allowlist of updatable columns.

---

## 🔵 Design System — Technical Debt

### 48. 328 hardcoded `rgba()` values violating COLOR_RULES
`scripts/lint-colors.sh` — Now tracked as non-blocking notices in `lint:colors`. The count is visible on every run so it can be reduced progressively without blocking commits. Migrate to semantic tokens.

### 49. 49 files still using banned legacy tokens
`tea-ink`, `tea-paper`, `tea-seal`, `tea-charcoal` — replace with approved tokens per `COLOR_RULES.md`.

### 50. 65 hardcoded hex colors in bracket notation
Replace `text-[#4a3728]` style literals with semantic tokens.

### 51. Magazine template quality
The 150+ layout variants are not at the editorial standard required for launch. See `PLAN.md` for the 70-point overhaul spec.

---

## ⚪ Infrastructure

### 52. Font loading is blocking and heavy
8 Google Fonts in a single blocking request. Add `font-display: swap`, subset Chinese fonts with `unicode-range`, remove unused fonts.

### 53. Type scale not standardized
Define and enforce Display / Headline / Subhead / Body / Caption / Micro with proper leading and tracking across all components.

### 54. Missing DB indices for common query patterns
Add: `products(account_id, status)`, `invoices(account_id, status)`, `customers(account_id, name)`, `activity_logs(account_id, created_at)`, `account_members(user_id, status)`.

---

## ✅ Recently Fixed (for reference)
- Teaware pricing backend ✓
- Edit item modal full-screen ✓
- Settings removed from admin sidebar ✓
- Registry drawer closes on route change ✓
- Tag styling on cards (inline dot-separated) ✓
- Alcove card edit button placement ✓
