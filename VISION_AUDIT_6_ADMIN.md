# Teajia Vision Audit — Part 6: Admin & Operations

## Current State

The admin is a beast — 42 components, a 197KB InventoryView, full order pipeline, CRM, CSV import, invoice builder with QR codes, stock ledger, activity logs, command palette, analytics dashboard. This is genuinely professional-grade inventory management.

But it's built for power, not for flow. Adrian's daily workflow — checking stock, fulfilling orders, adding new products, tracking vendors — requires too many clicks and too much context-switching.

---

## Transformation 1: The Morning Dashboard

### "Today" View

When Adrian opens the admin, the first thing he should see is not the full inventory table. It should be a **daily briefing**:

**Needs Attention (Red)**
- Orders pending fulfillment (count + oldest age)
- Low stock alerts (products below threshold)
- Unverified stock items (flagged for recount)
- Incoming shipments expected today

**Today's Numbers (Gold)**
- Orders fulfilled today
- Revenue today (or this week)
- New customers
- Sessions logged by users (community health metric)

**Quick Actions**
- "Fulfill next order" → opens the oldest pending order
- "Add new product" → opens AddProductModal
- "Check stock" → opens inventory filtered to "Alerts" view
- "View today's event" → if there's an event today, jump to it

This is a single component that queries existing endpoints. All the data exists — it just needs aggregation.

### Smart Notifications

Replace the current toast system with a persistent notification center:
- Badge on admin sidebar showing unread count
- Categories: Orders, Stock, Events, System
- Actionable: "Low stock on Da Hong Pao (12g remaining)" → tap → opens product → "Reorder from [vendor]" button
- Daily digest email option: same info, sent at 8am

---

## Transformation 2: Streamlined Daily Operations

### One-Click Fulfillment

The order pipeline has Pending → Filled → Void. Make fulfillment faster:
1. Order list shows fulfillment preview (what needs to be packed)
2. "Fill" button → auto-decrements stock, generates packing slip, moves to Filled
3. "Fill + Invoice" → same but also generates PDF invoice
4. "Fill + Notify" → same but also sends WhatsApp/email confirmation to customer
5. Batch fulfillment: select multiple orders → "Fill All"

### Inventory Quick Actions

The inventory table is powerful but dense. Add contextual quick actions:
- **Right-click / long-press** on any product → context menu:
  - Edit price
  - Adjust stock (+/- grams)
  - Toggle public/draft
  - View sales history
  - Reorder from vendor
  - Generate wisdom (AI)
- **Bulk actions toolbar** — Select multiple items → batch update status, visibility, prices

### Receipt-to-Shelf Pipeline

The CLAUDE.md documents a receipt → CSV → import workflow. Streamline it:

**Current flow (6+ steps):**
1. Adrian sends receipt to Claude
2. Claude generates CSV
3. Adrian saves CSV file
4. Adrian opens admin → inventory → menu → import
5. Admin validates + previews
6. Admin uploads

**Ideal flow (3 steps):**
1. Adrian photographs receipt in admin → Quick Capture (already exists!)
2. AI extracts products, Claude generates wisdom content (backend enrichment)
3. Adrian reviews, edits, confirms → products are live

The Quick Capture component (569 lines) already does camera/file upload with AI extraction. The `generateWisdom` endpoint exists. The `bulkCreate` endpoint exists. The pipeline just needs to be connected end-to-end with a review step in the middle.

### Vendor Reorder Workflow

AUDIT.md #18. When stock is low:
1. Admin clicks "Reorder" on a product
2. System pre-fills a purchase order with:
   - Vendor name (from product record)
   - Last purchase price and quantity
   - Suggested quantity based on sales velocity
3. Admin adjusts and sends (via WhatsApp template or email)
4. Purchase order tracked in the PO system (already exists)
5. When shipment arrives → "Receive" button → stock incremented

---

## Transformation 3: Analytics That Drive Decisions

### Sales Velocity Dashboard

The current dashboard shows KPIs (total cost, retail value, profit margin) and distribution charts. Add:

- **Sales velocity per product** — grams sold per week, trending up/down
- **Conversion funnel** — views → cart adds → orders (requires basic analytics tracking)
- **Seasonal trends** — "Sheng puerh sells 3x more in spring" (from historical data)
- **Customer cohort analysis** — repeat purchase rate, time between purchases
- **Revenue forecast** — Simple projection based on trailing 30-day average

### Inventory Health Score

A single number (0-100) that answers "how healthy is my inventory right now?"
- Penalized for: excess aged stock, too many drafts, low stock on popular items, unverified counts
- Boosted by: diverse type distribution, healthy margins, recent stock verification
- Shown prominently on dashboard
- Drill-down: click the score to see contributing factors

### Vendor Intelligence

The SourcesView is 1,465 lines. Enhance with:
- **Vendor scorecard** — quality rating (from tasting notes), reliability (delivery times), pricing trends
- **Cost comparison** — same tea type across vendors, which vendor offers better value
- **Reorder suggestions** — "You usually order from [vendor] every 60 days. It's been 55 days."

---

## Transformation 4: Content Management Integration

### Product Page Richness Score

Each product has potential for: lore, tasting notes, processing notes, terroir, mood, experience, liquor color, photos, brewing guide. Score completeness:
- "Da Hong Pao: 9/10 fields complete" ✓
- "New Oolong Sample: 3/10 fields complete" — needs enrichment
- Batch view: show all products sorted by completeness
- One-click "Generate Wisdom" for incomplete products (AI endpoint exists)

### Admin → Magazine Pipeline

When Adrian writes a product description that's particularly good, or when an event produces great content:
- "Promote to Magazine" button → creates a draft article pre-filled with product/event data
- Adrian edits in a simple rich text editor
- Publishes to the Magazine section
- Currently all magazine content is hardcoded in data files. A CMS layer (even a simple one) would unlock this.

### Photo Management

AUDIT.md #20 suggests batch photo upload. Essential:
- **Drag-and-drop zone** — Drop 20 photos, auto-match to products by filename or AI recognition
- **Photo quality check** — Flag blurry or poorly lit images
- **Multiple photos per product** — `additionalImages` field exists but UI for managing it is basic
- **Lifestyle photos** — Tag photos as "product shot" vs "lifestyle" vs "detail" for different display contexts

---

## Transformation 5: Mobile Admin

### Admin on the Go

Adrian should be able to do critical tasks from his phone:
- **Fulfill orders** — swipe to fill, tap to invoice
- **Check stock** — scan a QR code (already generated) to see product details
- **Quick capture** — photograph new products, receipts, inventory
- **Respond to inquiries** — see new messages, reply inline

The admin is currently desktop-optimized (sidebar layout, dense tables). A mobile admin view with:
- Bottom tab bar (like the public app)
- Cards instead of tables
- Swipe gestures for common actions
- Same auth, same data, just different layout

---

## Quick Wins (< 1 day each)

1. **Dashboard "Today" section** — Aggregate pending orders + low stock + recent activity into a single card
2. **Quick stock adjustment** — +/- buttons directly in the inventory table without opening edit modal
3. **Copy product** — Duplicate a product with "Copy of..." prefix for similar teas from same vendor
4. **Keyboard shortcut cheat sheet** — Cmd+K already exists. Add overlay showing all shortcuts.
5. **Export current view** — Whatever the current filter/sort in inventory, export as CSV with one click
6. **Activity log search** — Filter activity logs by product name, date range, action type (data exists, UI needs filters)
