# Tea Compass — Complete Design & Build Specification

> The tea master's sourcing instrument. Capture what you encounter, taste, and buy — from the tea table to your inventory.
>
> **Feature name: Tea Compass**

---

## Table of Contents

1. [Concept & Philosophy](#concept--philosophy)
2. [Where It Lives](#where-it-lives)
3. [Data Architecture](#data-architecture)
4. [The Capture Card — Tea](#the-capture-card--tea)
5. [The Capture Card — Teaware](#the-capture-card--teaware)
6. [Smart Input Parsing](#smart-input-parsing)
7. [Photo Extraction (Gemini)](#photo-extraction-gemini)
8. [Voice Notes (Groq Whisper)](#voice-notes-groq-whisper)
9. [Vendor Capture](#vendor-capture)
10. [Tasting Integration](#tasting-integration)
11. [Status Flow & Buying](#status-flow--buying)
12. [Order Summary](#order-summary)
13. [Vendor History & Reordering](#vendor-history--reordering)
14. [Browse & Review](#browse--review)
15. [Draft-to-Product Pipeline](#draft-to-product-pipeline)
16. [Duplicate Detection](#duplicate-detection)
17. [PWA & Offline Support](#pwa--offline-support)
18. [Image Handling](#image-handling)
19. [Cost & Limits](#cost--limits)
20. [Multi-User Architecture (Future)](#multi-user-architecture-future)
21. [UX Friction Audit](#ux-friction-audit)
22. [Build Phases](#build-phases)
23. [File Structure](#file-structure)
24. [Open Questions](#open-questions)

---

## Concept & Philosophy

Tea Compass is the universal entry point for "I'm acquiring tea." Whether you're tasting samples at a vendor's table, buying cakes at a shop, picking up teaware at an antique market, or ordering online from a source you've visited — it all goes through Tea Compass.

**Core principles:**
- **Taps over typing.** Every field that can be a button should be a button.
- **Nothing is required.** You can capture just a name and a price. Or just a photo. Or just a voice note. Everything else fills in later.
- **The app follows you.** It never makes you stop what you're doing to serve it. The vendor is talking — capture that. You're tasting — tap a few flavors. You're settling up — the order is already assembled.
- **Photos and voice are input methods, not attachments.** A photo of a bag label fills the card. A voice recording becomes notes. They're not extras — they're primary input channels alongside typing and tapping.
- **Field notes become products.** What you capture in the field flows seamlessly into your inventory as draft products, pre-filled with everything you noted. The field work and the editorial work are two phases of one pipeline.

**What Tea Compass replaces:**
- The Notes app on your phone
- WeChat messages to yourself
- Scraps of paper with prices
- Trying to remember what the vendor said about that tea
- Re-entering all the data when you get home

**What Tea Compass does NOT replace:**
- CSV import (batch/legacy operations at your desk)
- AddProductModal (for teas you add without tasting — though Tea Compass can handle these too)
- The Tasting Journal (public customer feature — Tea Compass is the sourcing tool that feeds it)

---

## Where It Lives

### AccountPanel — "Your Tea" section
Tea Compass is pinned to the top of the "Your Tea" section in the AccountPanel, alongside Favorites and Tasting Journal.

```
YOUR TEA
────────────────────
📋 Tea Compass          ← Pinned to top, prominent
♥  Favorites
🍵 Tasting Journal
```

Tapping "Tea Compass" opens as a sub-view of the AccountPanel (same pattern as My Collection and Tasting Journal). Full-screen within the modal on mobile.

### Admin — QuickCapture area
Tea Compass is also accessible from the admin QuickCapture section. Same data, different context. In admin, the emphasis shifts toward draft management and the promote-to-product workflow.

### Why this works
- Already accessible via existing navigation (no new bottom nav items)
- Personal space — this is YOUR tool, YOUR tea journey
- Natural neighbors: Tasting Journal (what you've tasted), Favorites (what you love), Tea Compass (what you've encountered and sourced)
- Admin links already in AccountPanel — smooth handoff from capture to inventory management

---

## Data Architecture

### New table: `tea_compass_entries`

```sql
CREATE TABLE tea_compass_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,                    -- Future multi-user support

  -- Identity
  name TEXT,                                -- English name (primary)
  chinese_name TEXT,                        -- Chinese name (from photo extraction or manual)
  type TEXT,                                -- ProductType (Green, Oolong, Sheng, etc.)
  form TEXT,                                -- TeaForm (Cake, Loose, Brick, etc.)
  year INTEGER,                             -- Harvest/production year
  season TEXT,                              -- Spring, Summer, Fall, Winter
  storage TEXT,                             -- Dry, Wet/Traditional, HK, Malaysian, Natural
  origin_region TEXT,                       -- Tea region

  -- Pricing
  price_amount REAL,                        -- Vendor's quoted price
  price_currency TEXT DEFAULT 'NT',         -- Currency code
  price_per_unit_grams REAL,               -- How many grams the price is for (e.g., 357 for a cake)

  -- Category
  category TEXT DEFAULT 'tea',             -- 'tea' or 'teaware'

  -- Teaware-specific
  teaware_category TEXT,                   -- Pot, Cup, Gaiwan, Fair Cup, etc.
  material TEXT,                           -- Zhuni, Zisha, Porcelain, etc.
  capacity_ml INTEGER,                     -- For pots, gaiwans, cups
  quantity INTEGER DEFAULT 1,              -- Usually 1, more for cup sets
  era TEXT,                                -- Modern, 90s, 80s, 70s, Pre-70s, Republic, Qing

  -- Vendor
  vendor_id TEXT,                          -- FK to customers table (nullable — can attach later)
  vendor_name TEXT,                        -- Denormalized for display when vendor_id not yet set

  -- Content
  notes TEXT,                              -- Accumulated notes (vendor stories, observations, multi-steep notes)
  tasting TEXT,                            -- JSON: TastingData object
  photos TEXT,                             -- JSON: array of R2 URLs
  audio_clips TEXT,                        -- JSON: array of {url, transcript, timestamp}

  -- Status & buying
  status TEXT DEFAULT 'logged',            -- logged, want, buying, bought, passed
  buy_quantity_grams REAL,                 -- How much they're purchasing (for tea)
  buy_quantity_units INTEGER,              -- How many units (for teaware)
  buy_total REAL,                          -- Calculated total cost

  -- Pipeline
  draft_product_id TEXT,                   -- FK to products table once promoted to draft

  -- Meta
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  synced INTEGER DEFAULT 0                 -- 0 = local only, 1 = synced to D1
);
```

### Vendor enhancements (customers table additions)

```sql
-- New columns on existing customers table
ALTER TABLE customers ADD COLUMN business_card_photo TEXT;  -- R2 URL
ALTER TABLE customers ADD COLUMN storefront_photo TEXT;      -- R2 URL
ALTER TABLE customers ADD COLUMN latitude REAL;              -- GPS pin
ALTER TABLE customers ADD COLUMN longitude REAL;             -- GPS pin
ALTER TABLE customers ADD COLUMN photos TEXT;                -- JSON: array of additional R2 URLs
```

### LocalStorage-first pattern

All captures save to Zustand store (localStorage) immediately. Synced to D1 when connectivity is available. The `synced` flag tracks which entries have been pushed to the server.

```typescript
interface TeaCompassStore {
  entries: TeaCompassEntry[];
  lastVendorId: string | null;
  lastVendorName: string | null;
  lastCurrency: Currency;

  addEntry: (entry: TeaCompassEntry) => void;
  updateEntry: (id: string, updates: Partial<TeaCompassEntry>) => void;
  syncToServer: () => Promise<void>;
}
```

---

## The Capture Card — Tea

### Layout (top to bottom on mobile)

**1. Vendor strip (persistent across captures)**
- Shows current vendor name. Tap to change.
- Remembers last used (Zustand persist).
- Can be empty — "No vendor" is valid. Attach later.
- "Add details" prompt for card photo/storefront/pin — accessible anytime.

**2. Smart input line**
- Large text input. English name is the expected primary input.
- Type naturally: "Lao Ban Zhang 2019 spring cake dry storage"
- Parser extracts structured data → tokens appear below (see Smart Input Parsing)
- Camera icon inside the field → snap bag/label → Gemini extracts everything
- Whatever is left after parsing = the tea name

**3. Parsed tokens / field buttons (synced with input line)**
- Each extracted field shows as a tappable token below the input
- Tapping a token opens its selector to change/correct
- If the input line auto-selected "Oolong" in the type grid, that button is lit up
- You can also tap buttons directly without typing — they stay in sync
- **Type grid** (always visible, 2×5):
  ```
  Green    White    Yellow    Oolong    Red
  Dark     Sheng    Shou      Herbal    Teaware
  ```
- **Form row** (visible, single row):
  ```
  Loose    Cake    Brick    Tuo    Ball    Bag
  ```
- **Details** (collapsible, one-tap expand):
  - Year (4-digit number input)
  - Season: `Spring  Summer  Fall  Winter`
  - Storage (conditional — shows for Sheng, Shou, Dark):
    `Dry  Wet/Traditional  HK  Malaysian  Natural`
  - Region: frequent regions as tappable chips (Alishan, Yiwu, Wuyi, Lugu, Jingmai, Anxi, etc.) + text input for new

**4. Price / Grams**
- Side by side: `[price amount]  [currency]  /  [grams]`
- Currency remembers last used. Tap to change.
- Grams shows **tappable presets based on selected form**:

  | Form | Presets |
  |------|---------|
  | Loose | 50g, 75g, 100g, 150g, 300g, 600g |
  | Cake | 100g, 200g, 357g, 400g |
  | Brick | 250g, 500g, 1000g |
  | Tuo | 100g, 250g, 500g |
  | Ball | 50g, 100g, 250g |
  | Bag | 50g, 100g, 150g, 300g |

- Tapping a form auto-fills the most common weight (Brick → 250g, Cake → 357g) but the field is always directly editable.
- Price label updates contextually: "Price per 357g cake" / "Price per 150g bag"

**5. Notes (always visible)**
- 3-line text area, expandable on focus.
- **Append-only behavior.** Each new input (typed or voice) adds below existing text with subtle spacing. Never overwrites.
- Multiple additions accumulate across the session:
  ```
  "farmer's personal garden, 300 year old trees, yiwu"

  "third steep opening up, more sweetness, first pick only"

  "thick mouthfeel, lasted 9 steeps, stored in bamboo baskets"
  ```
- Voice transcription appends with a small audio playback indicator next to the transcribed text.
- Audio clips preserved until manually dismissed (× button) or auto-cleaned on draft promotion.

**6. Tasting (expandable)**
- "Record tasting" button → opens full-screen TastingFlow (customer mode)
- **Opens to Flavor zone first** (not Impression) for fastest capture
- "Done" button always visible — don't need to visit all 5 zones
- On close, collapses to TastingProfileStrip showing selected terms
- Uses the same TastingFlow component, same taxonomy, same haptic feedback

**7. Status (Want / Buy)**
- Default is "Logged" — no tap needed.
- Two tappable actions: **Want** · **Buy**
- Tapping Buy just flags it — quantity entered later on order summary.
- Once any item is marked Buy, a persistent bottom bar appears: "N items · View Order"

### Floating elements
- **+ button** (bottom-right): auto-saves current card, opens fresh one. No confirmation, no required field validation.
- **Mic button** (floating, accessible from anywhere on card): tap to start recording, tap to stop. Transcription appends to notes regardless of which field is focused.
- **"From [Vendor]" strip** (top, when vendor is set): horizontal scroll of previous teas from this vendor. Tap to reorder (add to current buying list). Shows: name, type, status (In Stock / Want / Previously Bought). **Want items surface first.**

### Session stack
Previous captures from the current session visible as **collapsed cards above the current capture card**. One line each: name + key tokens. Tap to expand and edit. Current new card always at bottom.

---

## The Capture Card — Teaware

When "Teaware" is selected in the type grid, the card reshapes for object capture.

### Layout

**1. Photo(s) (prominent, first position)**
- Large photo area. Tap to open camera.
- **Multi-photo single camera session**: snap multiple shots without closing camera. All attach as a strip.
- Photos batch-compress and upload in background.
- Typical shots: the piece, bottom/stamp, lid fit, detail shot.

**2. Description**
- Short text: "Small zhuni teapot" or "Qinghua cup pair"
- Same smart parsing: "zhuni pot 80s 800NT" → material, category, era, price extracted

**3. Category** (tappable row):
```
Pot    Cup    Gaiwan    Fair Cup    Tray    Storage    Tool    Other
```

**4. Material** (tappable, contextual to category):
- Pots: `Zhuni  Zisha  Duanni  Hongni  Porcelain  Silver  Glass  Other`
- Cups: `Porcelain  Celadon  Wood-fired  Glass  Clay  Other`
- General: `Clay  Porcelain  Glass  Ceramic  Wood  Metal  Stone  Other`

**5. Price** — single number + currency (persists from last used)

**6. Quantity** — defaults to 1. Tap + / - for multiples (cup sets).

**7. Capacity** — optional, number input (ml). For pots, gaiwans, cups.

**8. Era/Period** (tappable):
```
Modern    90s    80s    70s    Pre-70s    Republic    Qing    Unknown
```
Or type a specific year.

**9. Notes** — same as tea card. Always visible. Append-only. Voice-enabled.
- "Seller says 1960s factory 1, no lid damage, slight patina. Asking 2800, might negotiate."

**10. Status** — same: Logged / Want / Buy

### What teaware DOESN'T have:
- No tasting flow
- No form/season/storage
- No gram presets
- No smart input parsing for tea-specific terms (but does parse material, category, era)

### Minimum viable teaware capture:
Photo + price + one-line description. Everything else is optional enrichment.

---

## Smart Input Parsing

Client-side pattern matching. No API call. Instant. Works offline.

### How it works
User types in the name field. On each keystroke (debounced ~300ms), the parser scans for known tokens:

| Token type | Detection method | Examples |
|-----------|-----------------|----------|
| Year | 4-digit number 1950-2026 | "2019" → year: 2019 |
| Season | Exact match | "spring", "fall", "winter", "summer" |
| Tea type | Exact match against ProductType | "oolong", "sheng", "shou", "red" |
| Form | Exact match against TeaForm | "cake", "brick", "tuo", "loose leaf", "loose" |
| Storage | Phrase match | "dry storage", "wet storage", "HK storage", "natural storage" |
| Region | Match against known regions from D1 data + hardcoded common list | "Alishan", "Yiwu", "Wuyi", "Lugu", "Jingmai", "Anxi", "Menghai" |
| Everything else | Remainder becomes the name | "Lao Ban Zhang" |

### Sync behavior
- Parser fills fields → buttons light up
- User taps buttons → fields fill (but input text unchanged)
- Tap wins over parse if there's a conflict (more intentional action)
- Parsed tokens appear below input as tappable chips for correction

### What the parser does NOT do
- No AI/LLM — pure pattern matching
- Doesn't try to interpret ambiguous terms ("Red" in "Red Robe" stays in the name)
- Doesn't rewrite the input text — tokens are derived, original preserved

### Region list
Bootstrapped from existing product data in D1 (all unique origin_region values) plus hardcoded common additions. Refreshed on app load and cached.

---

## Photo Extraction (Gemini)

Uses existing `/api/extract-from-image` endpoint with Gemini 2.0 Flash.

### Trigger
Camera icon inside the name input field. Tap → phone camera opens → snap → image sent to Gemini.

### What Gemini extracts from a tea bag/box:
- Chinese name (characters)
- English translation
- Tea type
- Origin region
- Year / season
- Weight
- Awards, certifications
- Roast level, elevation, farm name
- Price (if price sticker visible)
- Any other text (lot numbers, brewing instructions)

### How extraction maps to the card:
- **Name field**: English translation (or Chinese name if no English)
- **Chinese name field**: Chinese characters
- **Type/Form/Year/Season/Region buttons**: auto-selected
- **Price/Grams**: pre-filled if visible
- **Notes**: auto-appended with extracted details that don't have dedicated fields (awards, elevation, farm, lot number, etc.)

### Confirmation UX
While processing: photo thumbnail with shimmer/pulse animation.
When results arrive: **confirmation banner** above the card — one line summarizing what was found:
> "Found: 阿里山高山烏龍 · Alishan High Mountain Oolong · Oolong · 2024 Spring"

Fields are already filled below. If it looks right, move on. If wrong, tap to correct.

### Cost
~$0.0001 per image. Effectively free. 10,000 extractions ≈ $1.

---

## Voice Notes (Groq Whisper)

### Setup
- Service: Groq (free tier, runs OpenAI Whisper model)
- Model: whisper-large-v3
- Latency: ~1-2 seconds for 30 seconds of audio
- Cost: Free (Groq free tier: ~14,400 requests/day)

### UX
- **Floating mic button** — visible from anywhere on the capture card. Not inside the notes field.
- Tap to start recording (MediaRecorder API, works in Safari).
- Tap again to stop (or auto-stop after configurable silence threshold).
- Audio blob sent to Groq Whisper endpoint.
- Transcribed text **appends** to notes field (never replaces).
- Small audio playback indicator appears next to the transcribed text.
- Audio file preserved locally (and synced to R2) as backup.
- Delete audio clip via × button when you've confirmed the transcript is accurate.

### Voice is for notes only
- Name field: typed or photo-extracted (needs accuracy for structured parsing)
- Price/grams: typed/tapped (numbers)
- Notes: voice is the primary input (conversational, long-form, imperfection is fine)
- Type/form/etc: tapped (buttons)

### Offline behavior
- Mic button still works offline (MediaRecorder is client-side)
- Audio saves locally
- Transcription happens when connectivity returns
- "Audio attached — will transcribe when online" indicator shown

---

## Vendor Capture

### Setting the vendor
- Vendor strip at top of Tea Compass persists across captures.
- Shows last used vendor by default (Zustand persist).
- Tap to change → picker with:
  - Recent vendors (top)
  - All vendors (searchable list from customers table)
  - "New vendor" option → type a name
- **Can be empty.** "No vendor" is a valid state. Attach later.

### New vendor creation in the field
When creating a new vendor, three optional quick-capture actions:

1. **Snap business card** → Gemini extracts: name, phone, WeChat/LINE/WhatsApp, address, email. Auto-fills vendor record.
2. **Snap storefront** → saved as vendor's storefront photo.
3. **Drop map pin** → browser geolocation API → lat/long saved. Renders as Google Maps link in vendor detail.

None of these are required. You can type "Lin's Tea" and move on. The photo/pin options are available anytime via "Add details" on the vendor strip — capture the business card when you get it at the end of the visit, not when you first sit down.

### Vendor photos in Sources
All vendor photos (business card, storefront, any additional shots) display in the vendor's detail page in Sources. Rich visual profile of who this source is.

### Vendor record enhancements
New fields on customers table: `business_card_photo`, `storefront_photo`, `latitude`, `longitude`, `photos` (JSON array of additional photo URLs).

---

## Tasting Integration

### Component reuse
Uses the existing `TastingFlow` component in customer mode. Same taxonomy, same swipe navigation, same haptic feedback. No new tasting UI.

### Entry point
"Record tasting" button on the capture card. Tapping it opens TastingFlow as a **full-screen overlay** (not embedded in the card — avoids nesting/scroll conflicts).

### Optimized for field speed
- **Opens to Flavor zone first** (not Impression). Flavor is what you want to capture fastest — "honey, orchid, mineral, thick."
- **"Done" button always visible** — you don't have to visit all 5 zones. Tap 3-4 flavors, hit Done.
- Other zones (Color, Body, Feel, Experience) accessible by swiping but optional.

### On close
TastingFlow collapses. Card shows `TastingProfileStrip` — compact display of selected terms.

### Data storage
`TastingData` object stored as JSON on the tea_compass entry. Carries over to draft product on promotion.

---

## Status Flow & Buying

### Statuses

| Status | Meaning | Action |
|--------|---------|--------|
| **Logged** | Default. You encountered this tea/teaware. It's recorded. | No tap needed. |
| **Want** | You liked it. You'd buy it if circumstances allowed. | One tap. |
| **Buy** | You're purchasing it. | One tap to flag. Quantity entered on order summary. |
| **Bought** | Purchase confirmed. Draft product created. | Set by "Confirm Purchase" on order summary. |
| **Passed** | Tried it, not for you. Archived. | One tap (or just leave as Logged). |

### The "Buy" flag
Tapping "Buy" on a capture card does NOT open a quantity input. It just flags the item. This preserves tasting rhythm — you can mark 3 items as Buy between sips without interruption.

### Persistent order bar
As soon as one item is marked "Buy," a **persistent bar appears at the bottom** of the Tea Compass:
> "3 items to buy · View Order"

Always visible. One tap to open the order summary. You don't go looking for it.

---

## Order Summary

### When to use
When you're done tasting and ready to settle up with the vendor. Or when reviewing at the hotel.

### Layout
Single clean screen. One line per item:

```
Lao Ban Zhang 2018         [__] cakes  ×  ¥850/357g  =  ¥____
Aged Tieguanyin             [300g]      ×  ¥500/150g  =  ¥1,000
Small zhuni pot             [1] unit    ×  ¥2,800     =  ¥2,800

                                              Total:    ¥____
```

### Quantity entry
- For cakes/bricks/tuo: quantity in units (1 cake, 2 cakes). Grams auto-calculate.
- For loose tea: gram amount. Tappable presets based on form (150g, 300g, 600g) + custom input.
- For teaware: quantity in units (defaults to 1).
- **Default to 1 unit** when the buy unit is clear (1 cake, 1 pot). Only change if buying multiples.
- Price visible alongside quantity so the cost factors into the decision.

### Totals
Each line total auto-calculates. Grand total at bottom updates live. Currency consistent (all in the session currency).

### Large, readable text
The vendor can read it over your shoulder or you can hand them the phone. No tiny text, no scrolling for 3-4 items.

### Confirm Purchase
One button at the bottom: "Confirm Purchase"
- Creates draft products in D1 for each Buy item
- All captured data carries over: name, type, vendor, cost, grams, notes, tasting, photos
- Field log entries update to status: "bought" with draft_product_id link
- Session marked as completed

---

## Vendor History & Reordering

### "From [Vendor]" strip
When a vendor is set in Tea Compass, a horizontal scrollable strip appears showing all teas/teaware previously connected to this vendor — from inventory AND Tea Compass.

### Content
Each item in the strip shows:
- Name (English)
- Type
- Status indicator: **In Stock** / **Draft** / **Want** / **Logged** / **Bought**

### Ordering
**Want items surface first** — these are the teas you explicitly marked as "I'd come back for this." Then: Draft (bought but not listed), In Stock (active products), Logged (past tastings).

### Reorder action
Tap an item from the strip → "Buy again" → adds to current session's buying list. Appears on the order summary alongside new purchases.

### Sources integration
In Admin → Sources → [Vendor], the same unified list appears:
- All products sourced from this vendor (inventory)
- All Tea Compass entries for this vendor
- Status indicators, dates, field notes
- Filter by Want to see sourcing wishlist

---

## Browse & Review

### Entry point
Open Tea Compass without tapping "+ New" → you're in browse mode.

### Grouping toggles
**By Date** · **By Vendor** (top of browse view)

- **By Date**: "March 25, 2026 — Chen's Tea House (6 teas, 3 bought)" / "March 23 — Yingge Market (4 teaware, 2 bought)"
- **By Vendor**: "Chen's Tea House — 3 sessions, 14 teas tasted, 7 bought" / "Yingge Ceramics — 2 sessions, 8 pieces"

### Status filters
**All · Want · Bought** (filter row below grouping toggle)

"Show me everything I want, grouped by vendor" = two taps. That's your trip planning / sourcing wishlist view.

### Card display
Each entry shows: name, type, status badge, date, price. Bought items visually distinct.

### Inline editing
Tap any card to expand. Fields are editable directly in the list — no modal, no separate edit screen. Fix a name, add notes, change status, assign vendor.

### Incomplete entry indicators
Missing fields show as **ghost text** — the type area shows a faded "Type?" and vendor shows "No vendor." Not error states or red badges — just gentle visual cues for what could be filled in.

### Bulk vendor assignment
If multiple entries have no vendor, subtle prompt at top: "5 entries have no vendor. Assign?" → pick vendor → all update. One action instead of five.

---

## Draft-to-Product Pipeline

### What carries over
When a Tea Compass entry with status "bought" gets promoted to a draft product:

| Tea Compass | → | Product |
|-----------|---|---------|
| name | → | givenName / productName |
| chinese_name | → | chineseName |
| type | → | type |
| form | → | form |
| year | → | year |
| origin_region | → | originRegion |
| buy_quantity_grams | → | stockGrams |
| price_amount / price_per_unit_grams | → | costAmount / costPerGramUSD (converted) |
| price_currency | → | costCurrency |
| vendor_name / vendor_id | → | vendor / vendorId |
| notes | → | (preserved as reference — see below) |
| tasting | → | tasting |
| photos[0] | → | imageUrl |
| season, storage | → | description (appended) |

### Field notes as reference panel
When editing a draft product that was promoted from a Tea Compass, the original field notes are visible as a **reference panel** — not editable in the product form, but readable alongside it. This is the raw material for wisdom generation.

When Claude generates lore, processing notes, terroir, mood, and experience — the field notes are the source: "Adrian's field notes say: 300yr old trees, uncle's garden, Yiwu, spring only, sun-dried."

### Auto-promotion
"Confirm Purchase" on the order summary creates draft products automatically. No manual step needed. The entries go from Tea Compass → draft products in one action.

### Manual promotion
Individual entries can also be promoted manually from the Tea Compass browse view. Useful for entries you captured but didn't buy through the order flow.

---

## Duplicate Detection

### Trigger
Fuzzy match runs when the name field loses focus or on debounced keystroke. Matches against:
- Other Tea Compass entries (same vendor or all vendors)
- Existing products in inventory

### UX
If a match is found, an inline nudge appears below the name field:
> *You logged "High Mountain Oolong" from Chen's on Oct 12, 2025*
> **Same tea** · **Different tea**

### "Same tea"
Links to the existing entry. New tasting data gets added as an additional tasting on the same record. Over time, a tea accumulates tasting history across sessions.

### "Different tea"
Prompts quick differentiators (collapsible detail row expands):
- **Year** (harvest/production)
- **Season** (spring, fall, winter)
- **Storage** (dry, wet, HK, Malaysian, natural)
- **Age** (if different from year)

One or two taps → name becomes "High Mountain Oolong (2019, Spring)" — distinct from the existing entry.

### Implementation
Use `fuse.js` (already in the project) for fuzzy matching. Threshold tuned to catch "High Mountain Oolong" matching "high mt oolong" but not matching "Dong Ding Oolong."

---

## PWA & Offline Support

### What PWA gives you
- **Home screen icon** — tap "Add to Home Screen" in Safari → Teajia icon opens without browser chrome. Looks and feels like a native app.
- **Cached app shell** — HTML, JS, CSS, assets cached by service worker. App loads instantly even with no signal.
- **Offline captures** — saved to localStorage (Zustand persist). Sync to D1 when online.

### Implementation
`vite-plugin-pwa` with Workbox. Configure:
- **Precache**: App shell, Tea Compass page, tasting taxonomy, region lists, vendor list
- **Runtime cache**: Product images, vendor photos (cache-first strategy)
- **Network-first**: API calls for product data, sync operations

### Offline behavior by feature

| Feature | Offline | Notes |
|---------|---------|-------|
| Open Tea Compass | ✅ Works | Cached app shell |
| Create capture | ✅ Works | Saves to localStorage |
| Type/tap buttons | ✅ Works | All client-side |
| Smart input parsing | ✅ Works | Client-side pattern matching |
| Snap photo | ✅ Saves locally | Uploads when online |
| Photo extraction (Gemini) | ❌ Needs network | Photo saves, extraction queued |
| Voice recording | ✅ Records locally | Transcription when online |
| Voice transcription (Groq) | ❌ Needs network | Audio saves, transcribes later |
| Browse previous captures | ✅ Local entries | Server entries need initial fetch |
| Vendor history strip | ⚠️ Partial | Shows cached data only |
| Confirm Purchase (→ D1) | ❌ Needs network | Queued, syncs when online |
| Tasting flow | ✅ Works | All client-side |

### Sync indicator
Small, unobtrusive status icon. Green = synced. Amber = pending sync. No action needed from user — sync happens automatically in background.

### manifest.json enhancements
Already exists. Needs: `start_url`, `display: standalone`, correct icons, `theme_color`, `background_color` matching Teajia's palette.

---

## Image Handling

### Client-side compression (all images)
Before any upload, images are compressed via canvas API:
- Max dimension: 1600px (longest side)
- JPEG quality: 75%
- Result: 80-200KB per image (down from 3-8MB)

### Storage
- Images → Cloudflare R2 (`teajia-media` bucket)
- D1 stores only URL strings
- Public URL pattern: `https://media.teajia.co/tea-compasss/{uuid}.jpg`
- Vendor photos: `https://media.teajia.co/vendors/{uuid}.jpg`

### Capacity
- R2 free tier: 10GB
- At 200KB/image: ~50,000 images before hitting limit
- Well beyond practical usage for years

### Multi-photo for teaware
Single camera session → snap multiple → all attach. No individual upload between shots. Batch compress and upload in background.

---

## Cost & Limits

### Per-capture cost breakdown

| Resource | Cost per capture | Notes |
|----------|-----------------|-------|
| D1 write | ~free | One row insert, negligible |
| R2 photo storage | ~$0.000003/photo | 200KB at $0.015/GB/month |
| Gemini extraction | ~$0.0001/image | Only if using photo extraction |
| Groq transcription | Free | Free tier, ~14,400 req/day |
| Total per capture | < $0.001 | Effectively zero |

### Scaling estimate (future multi-user)

| Users | Captures/month | D1 storage | R2 storage/month | Gemini cost/month | Monthly total |
|-------|---------------|------------|-------------------|-------------------|---------------|
| 1 (Adrian) | ~50 | < 1MB | ~10MB | ~$0.005 | ~$0.01 |
| 100 | ~2,000 | ~5MB | ~400MB | ~$0.20 | ~$0.25 |
| 1,000 | ~20,000 | ~50MB | ~4GB | ~$2.00 | ~$2.50 |

---

## Multi-User Architecture (Future)

### Build for Adrian, architect for many

**What we build now with multi-user in mind:**
- `user_id` column on `tea_compass_entries` table (use Adrian's ID for now)
- API endpoints scoped by authenticated user
- No hardcoded user assumptions in the UI
- Vendor data is shared (vendors are public entities), Tea Compass entries are private

**What we DON'T build now:**
- User-facing vendor sharing/collaboration
- Social features (share tasting notes, follow collectors)
- Per-user settings beyond what Zustand already provides
- Onboarding flow for new users

### The split (when multi-user launches)

| Feature | Scope |
|---------|-------|
| Tea Compass capture | All authenticated users |
| Tasting flow | All authenticated users |
| Browse own entries | All authenticated users |
| Vendor photos/details | Shared (Adrian curates, users see) |
| Sources management | Admin only |
| Order summary / buying | Admin only (or power users) |
| Draft-to-product pipeline | Admin only |
| Inventory management | Admin only |

Regular users get a tea journal. Adrian gets the full sourcing pipeline.

---

## UX Friction Audit

### Identified friction points and their fixes

**1. Getting to Tea Compass (4-5 taps)**
- Fix: Tea Compass pinned to top of AccountPanel "Your Tea" section.
- Fix: AccountPanel remembers last sub-view. If you were in Tea Compass, it opens there.
- Fix: Floating + button always visible once in Tea Compass — no navigation between captures.

**2. Vendor setup blocks first capture**
- Fix: Vendor can be empty. Capture first, assign vendor later.
- Fix: Bulk vendor assignment for entries without a vendor.
- Fix: Vendor details (card photo, pin) addable anytime, not just during creation.

**3. Capturing vendor's words while in another field**
- Fix: Floating mic button. Works from anywhere on the card. One tap starts recording.
- Fix: Transcription always appends to notes regardless of current field focus.

**4. Notes are a single shot**
- Fix: Notes are append-only. Each mic recording or typed addition lands below previous text. Multiple notes per tea across steeps.

**5. Losing track of previous captures in sequence**
- Fix: Previous captures visible as collapsed cards above current card. Glanceable. Tap to expand/edit.

**6. TastingFlow too thorough for quick impression**
- Fix: Opens to Flavor zone first. "Done" button always visible. 3-4 taps and out.
- Fix: Full-screen overlay (not embedded) to avoid scroll conflicts.

**7. Photo extraction results hard to verify**
- Fix: One-line confirmation banner summarizing what was found. Fields pre-filled below.

**8. "Buy" interrupts tasting rhythm with quantity input**
- Fix: Buy is one tap. Quantity entered later on order summary. Decision and details separated.

**9. Finding the order summary**
- Fix: Persistent bottom bar appears on first "Buy" mark. "3 items · View Order" — always visible.

**10. Quantity entry during settlement**
- Fix: Default to 1 unit. Totals pre-calculated. Large text for vendor readability.
- Fix: Price visible alongside quantity so cost informs the decision.

**11. Missing fields during hotel review**
- Fix: Ghost text for empty fields ("Type?" / "No vendor"). Inline editing. Bulk vendor assign.

**12. Multiple teaware photos require multiple camera sessions**
- Fix: Single camera session. Snap snap snap. All batch-attach.

**13. Crowded vendor history on return visits**
- Fix: Want items surface first in the vendor strip.

**14. Typing on phone is slow (general)**
- Fix: Almost everything is tappable. Smart input parsing for the text you do type. Photo extraction for labels. Voice for notes.

**15. Chinese name entry requires keyboard switching**
- Fix: English name is primary. Chinese name comes from photo extraction or is added later. Not expected from keyboard input.

**16. Offline connectivity at remote tea shops**
- Fix: PWA with service worker. LocalStorage-first saves. Sync when online. Photos/audio queue for upload.

---

## Build Phases

### Phase 1: Foundation (Data + Core UI)

**Goal:** Create a Tea Compass entry, save it locally, view it in a list.

- [ ] Define `TeaCompassEntry` TypeScript type
- [ ] Create `tea_compass_entries` D1 table (migration SQL)
- [ ] Add Zustand slice: `teaCompassStore` with entries, lastVendor, lastCurrency
- [ ] Build the capture card component (tea mode):
  - Name input
  - Price / Grams with currency
  - Type grid (tappable)
  - Form row (tappable)
  - Gram presets (dynamic based on form)
  - Notes textarea (append-only)
  - Status toggles (Want / Buy)
- [ ] Build the browse view:
  - List of captures
  - By Date / By Vendor toggle
  - All / Want / Bought filter
  - Inline expand to edit
- [ ] Mount in AccountPanel as sub-view (pinned to "Your Tea" top)
- [ ] Floating + button (auto-save + new card)
- [ ] Session stack (collapsed previous captures above current)

### Phase 2: Smart Input + Tapping

**Goal:** Type naturally OR tap buttons — both paths fill the same data.

- [ ] Build client-side parser (regex/keyword extraction)
  - Year, season, type, form, storage, region detection
  - Token display below input
  - Bidirectional sync between input text and buttons
- [ ] Collapsible details row (year input, season buttons, storage buttons, region chips)
- [ ] Region chips populated from D1 product data + hardcoded common list
- [ ] Form → gram preset mapping with auto-fill (Cake → 357g, Brick → 250g)
- [ ] Price label contextual update ("Price per 357g cake")

### Phase 3: Teaware Mode

**Goal:** Tap Teaware in type grid → card reshapes for object capture.

- [ ] Build teaware card variant:
  - Photo-first layout (multi-photo)
  - Description text
  - Category row (Pot, Cup, Gaiwan, etc.)
  - Material row (contextual to category)
  - Quantity (+/- stepper)
  - Capacity (ml)
  - Era buttons
  - Notes + status
- [ ] Multi-photo camera session (single open → snap multiple → batch attach)
- [ ] Client-side image compression (canvas API, 1600px max, 75% JPEG)

### Phase 4: Photo Extraction

**Goal:** Snap a bag label → Gemini fills the card.

- [ ] Camera icon in name field
- [ ] Use existing `/api/extract-from-image` endpoint
- [ ] Map Gemini response to Tea Compass fields
- [ ] Confirmation banner UX (one-line summary of what was found)
- [ ] Shimmer/pulse animation during processing
- [ ] Auto-append non-field data to notes (awards, elevation, etc.)

### Phase 5: Voice Notes

**Goal:** Tap mic → speak → notes appear.

- [ ] Groq Whisper API integration (new endpoint or client-direct)
- [ ] Floating mic button component
- [ ] MediaRecorder API for audio capture (Safari-compatible)
- [ ] Append transcription to notes
- [ ] Audio clip playback indicator
- [ ] Audio preservation with × delete
- [ ] Offline audio recording (transcribe when online)

### Phase 6: Vendor Capture

**Goal:** Rich vendor profiles from the field.

- [ ] Add columns to customers table (business_card_photo, storefront_photo, latitude, longitude, photos)
- [ ] Vendor creation flow in Tea Compass:
  - Name input
  - Business card photo → Gemini extraction
  - Storefront photo
  - Map pin (geolocation API)
- [ ] Vendor photos display in Sources detail view
- [ ] Google Maps link from lat/long
- [ ] "Add details" accessible anytime from vendor strip

### Phase 7: Tasting Integration

**Goal:** Record tasting opens the existing TastingFlow, optimized for field speed.

- [ ] "Record tasting" button on capture card
- [ ] TastingFlow opens as full-screen overlay from Tea Compass
- [ ] Default to Flavor zone (not Impression)
- [ ] Always-visible Done button
- [ ] TastingProfileStrip display on card after close
- [ ] TastingData stored as JSON on tea_compass entry

### Phase 8: Order Summary & Buying

**Goal:** Mark items to buy → view order → confirm purchase → drafts created.

- [ ] Persistent bottom bar ("N items · View Order")
- [ ] Order summary screen:
  - Line items with quantity inputs
  - Gram presets inline for loose tea
  - Default quantity 1 for unit items (cakes, teaware)
  - Auto-calculated line totals + grand total
  - Large readable text
- [ ] "Confirm Purchase" action:
  - Create draft products in D1 for each Buy item
  - Map Tea Compass data to product fields
  - Update Tea Compass entries to status: bought
  - Link tea_compass.draft_product_id to new product
- [ ] API endpoints: POST /api/tea-compasss/confirm-purchase

### Phase 9: Vendor History & Reordering

**Goal:** See what you've bought from a vendor before. Reorder.

- [ ] "From [Vendor]" horizontal strip on capture view
- [ ] Data source: products + tea_compass_entries where vendor matches
- [ ] Want items surface first
- [ ] "Buy again" action → adds to current buying list
- [ ] Sources integration: unified vendor view with all products + Tea Compasss

### Phase 10: Duplicate Detection

**Goal:** Warn when logging a tea you've seen before.

- [ ] Fuzzy match on name field blur (fuse.js)
- [ ] Match against tea_compass_entries + products for same vendor
- [ ] Inline nudge: "Same tea" / "Different tea"
- [ ] "Same tea" → link entries
- [ ] "Different tea" → expand differentiator fields

### Phase 11: D1 Sync & API

**Goal:** LocalStorage entries sync reliably to the server.

- [ ] API endpoints:
  - POST /api/tea-compasss (create)
  - PUT /api/tea-compasss/:id (update)
  - GET /api/tea-compasss (list, with filters)
  - POST /api/tea-compasss/bulk-vendor (bulk vendor assignment)
  - POST /api/tea-compasss/confirm-purchase (order confirmation)
- [ ] Sync engine in Zustand store:
  - Track synced/unsynced entries
  - Background sync on connectivity
  - Conflict resolution (server wins for concurrent edits, last-write for single user)
- [ ] Sync status indicator (green = synced, amber = pending)

### Phase 12: PWA & Offline

**Goal:** App works without network. Syncs when online.

- [ ] Install `vite-plugin-pwa`
- [ ] Configure service worker:
  - Precache: app shell, Tea Compass assets, tasting taxonomy
  - Runtime cache: product images, vendor photos
  - Network-first: API calls
- [ ] Update manifest.json (start_url, display, icons, theme_color)
- [ ] Offline photo queue (save locally, upload when online)
- [ ] Offline audio queue (save locally, transcribe when online)
- [ ] Test: airplane mode → capture → reconnect → verify sync

### Phase 13: Polish & Refinement

**Goal:** Smooth out edges based on real usage.

- [ ] Ghost text for empty fields in browse view
- [ ] Bulk vendor assignment UX
- [ ] Confirmation banner animation
- [ ] Session stack scroll behavior
- [ ] Form-specific gram preset tuning
- [ ] Region chip list refinement
- [ ] Field notes reference panel on draft product editor
- [ ] Teaware multi-photo strip layout
- [ ] Order summary print/share formatting
- [ ] Performance: lazy load tasting taxonomy, debounce parser

---

## File Structure

```
src/
├── components/
│   ├── TeaCompass/
│   │   ├── index.tsx                    ← Main Tea Compass view (browse + capture)
│   │   ├── CompassIcon.tsx              ← Tea Compass icon/branding element
│   │   ├── CaptureCard.tsx              ← Tea capture card
│   │   ├── TeawareCaptureCard.tsx       ← Teaware capture card
│   │   ├── SmartInput.tsx               ← Name field with parser + camera icon
│   │   ├── InputParser.ts              ← Client-side token extraction logic
│   │   ├── TypeGrid.tsx                 ← Tea type tappable grid
│   │   ├── FormRow.tsx                  ← Form selection + gram presets
│   │   ├── PriceGrams.tsx               ← Price/grams input with currency
│   │   ├── DetailsRow.tsx               ← Year, season, storage, region
│   │   ├── NotesField.tsx               ← Append-only notes with mic button
│   │   ├── VoiceRecorder.tsx            ← Mic button + MediaRecorder + Groq
│   │   ├── PhotoCapture.tsx             ← Camera + compression + Gemini extraction
│   │   ├── StatusActions.tsx            ← Want / Buy toggles
│   │   ├── SessionStack.tsx             ← Collapsed previous captures
│   │   ├── VendorStrip.tsx              ← Persistent vendor selector
│   │   ├── VendorHistory.tsx            ← "From [Vendor]" horizontal strip
│   │   ├── VendorSetup.tsx              ← New vendor creation (card photo, pin)
│   │   ├── OrderSummary.tsx             ← Buy items + quantities + totals
│   │   ├── OrderBar.tsx                 ← Persistent "N items · View Order" bar
│   │   ├── BrowseView.tsx               ← List with grouping + filters
│   │   ├── BrowseCard.tsx               ← Expandable entry card with inline edit
│   │   ├── DuplicateNudge.tsx           ← Inline duplicate detection
│   │   ├── ConfirmationBanner.tsx       ← Photo extraction result summary
│   │   ├── SyncIndicator.tsx            ← Green/amber sync status
│   │   └── types.ts                     ← TeaCompassEntry type + related types
│   │
│   └── ... (existing components)
│
├── lib/
│   ├── teaCompassStore.ts                 ← Zustand slice for Tea Compass state
│   ├── teaCompassSync.ts                  ← D1 sync engine
│   ├── imageCompressor.ts              ← Client-side canvas compression
│   └── ... (existing lib files)
│
└── ... (existing structure)

worker/
├── src/
│   ├── index.ts                         ← Add tea-compass API routes
│   └── ...
├── schema.sql                           ← Add tea_compass_entries table
└── ...
```

---

## Open Questions

1. **Form as separate field or combined with type?** Currently the card has a type grid AND a form row. Should they be two distinct visual rows, or should form only appear after type is selected? (Recommendation: always visible — form is as important as type for the capture.)

2. **Should the parser extract vendor names?** If you type "Chen's Alishan Oolong 2019" and Chen's is a known vendor, should it auto-set the vendor? (Recommendation: yes, if there's a fuzzy match against existing vendors. But vendor-from-text is lower priority than vendor-from-strip.)

3. **Teaware in order summary** — teaware has unit pricing, tea has per-gram pricing. The order summary needs to handle both cleanly. (Recommendation: line items show the natural unit — "2 cakes × ¥850" vs "1 pot × ¥2,800" — no conversion needed.)

4. **Audio clip storage location** — R2 alongside photos? Or a separate bucket/prefix? (Recommendation: same R2 bucket, `tea-compasss/audio/{uuid}.webm` prefix.)

5. **Tasting history across retastings** — when you mark "Same tea" in duplicate detection, does the new tasting replace or accumulate? (Recommendation: accumulate. Show tasting history timeline. Each tasting dated.)

6. **Tea Compass access for non-admin users (future)** — do non-admin users see the vendor strip and buying flow, or just the tasting/journal features? (Recommendation: non-admin users get capture + tasting + browse. No buying, no order summary, no draft pipeline. Those are admin/sourcing features.)
