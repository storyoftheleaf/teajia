> CONSOLIDATED 2026-04-27 into docs/FLOWS.md sec 2.1.

# Teajia Vision Audit — Part 2: The Shop Experience

## Current State

The shop works. Products load from D1, filtering by tea type exists, AlcoveCards display rich product data (lore, tasting notes, mood, terroir), there's a compare view, a quick peek drawer, WhatsApp ordering, and starter sets. The product detail experience is already richer than 95% of tea shops online.

But it's still a catalog. You browse, you buy. The relationship ends at checkout.

---

## Transformation 1: Discovery Over Browsing

### The Flavor Map

Instead of filtering by tea type (Green, Oolong, Sheng...), offer a **sensory entry point**. The tasting taxonomy already has 50+ terms mapped to icons. Use them.

**"What are you in the mood for?"**
- Show a visual grid of flavor/mood clusters: *bright & floral*, *deep & earthy*, *smooth & creamy*, *bold & mineral*, *sweet & fruity*, *roasted & warm*
- Each cluster links to products whose tasting notes match
- This is trivially implementable — the tasting data is already structured JSON on every product

**Why it matters:** Most tea buyers don't know tea types. They know what they like. A beginner shouldn't need to know the difference between Sheng and Shou to find a tea they'll love.

### The "Taste Like This" Engine

When viewing a product, show: **"If you like this, you'll also like..."**
- Not collaborative filtering (you don't have enough users). Instead: **tasting note vector similarity**.
- Each product has `tastingNotes[]` and structured `tasting{}` data. Compute Jaccard similarity between products.
- Pre-compute at build time or cache in D1. No ML needed.
- Display as a horizontal scroll of 3-4 AlcoveCards at the bottom of each product modal.

### Guided Entry for Beginners

The Learn Hub has structured curricula, but none of it feeds into the shop. Create:

**"Start Your Practice" flow:**
1. Three questions: What do you usually drink? (coffee/green tea/herbal/nothing). Sweet or savory preference? Budget per month?
2. Returns 3-5 personalized product recommendations with explanations
3. "Why this tea for you" — one sentence connecting their answers to the product's character
4. Saves preferences to their account for future recommendations

This is a simple decision tree, not AI. Maybe 20 paths. Hardcoded logic is fine.

---

## Transformation 2: The Product Page as Teacher

### Brewing Guide on Every Product

AUDIT.md #34 suggests this. It's the single highest-impact addition to product pages. Every tea should show:
- Water temperature
- Leaf-to-water ratio (g per 100ml)
- Steep times (first steep, subsequent steeps)
- Recommended vessel type
- Number of expected infusions

**Where does this data come from?** A simple lookup table by tea type + form. A Sheng cake has different parameters than a loose-leaf green. Maybe 15-20 brewing profiles cover the entire catalog. Store as a `brewingGuides` JSON in the data layer.

### "From the Source" — Origin Stories on the Map

The codebase already has `teaMapPins.ts`. Every product has `originCountry` and `originRegion`. Connect them:
- Small interactive map on each product page showing where this tea comes from
- Click to see other teas from the same region
- Regional context paragraph (altitude, climate, soil — already in `terroir` field)

### Tasting Note Explainer

When a product lists tasting notes like "orchid, mineral, hui gan" — most buyers don't know what "hui gan" means. The app already has a `TeaGlossary`. Link them:
- Tap any tasting note term → tooltip with definition from glossary
- "Learn more about this flavor profile" → link to relevant Learn module

---

## Transformation 3: Post-Purchase Relationship

### The Purchase-to-Journal Bridge

When someone buys a tea, that tea should appear in their Tea Compass as a **suggested entry**. "You purchased Aged Bai Mu Dan 3 days ago. Ready to log your first session?"

Currently the shop cart and Tea Compass are completely disconnected stores. Bridging them:
- After order confirmation, write purchased product IDs to the user's account
- Tea Compass checks for "owned teas" and offers quick-start logging
- Over time, the user builds a personal collection that's different from favorites

### Reorder Intelligence

If someone bought 50g of a tea 45 days ago and typically logs 3-4 sessions per week with it (visible in Compass data), they're probably running low. A gentle nudge: "Running low on [tea name]? Your sessions suggest about 15g remaining."

This requires:
- Linking purchases to Compass sessions (by product ID or name matching)
- Estimating consumption rate (sessions × estimated grams per session)
- Threshold notification (email or in-app)

### The "How It's Evolving" Log

For aged teas (Sheng, Shou, some oolongs), flavor changes over time. If a customer logs tasting notes for the same tea months apart, surface the delta: "Your notes from January mentioned 'sharp, astringent.' Your March notes say 'smooth, sweet.' This tea is opening up."

This is just diffing tasting note arrays over time. Powerful storytelling from existing data.

---

## Transformation 4: Sample-First Commerce

### The Sample Economy

AUDIT.md #7 suggests sample sizes. Go further. Make samples the **primary conversion tool**:

- Every product page: "Try a sample (10g) — $X" alongside the full quantity
- **Sample flight builder**: Pick 3-5 teas by type/mood/region, auto-packaged as a discovery set
- **First-timer offer**: "Your first 3 samples ship free" (configurable in admin)
- **Sample-to-full conversion tracking**: Admin dashboard shows which samples convert to full purchases

The gram-based stock system already supports this. The cart already handles per-gram pricing. This is mostly UI work.

### WhatsApp as a Channel, Not a Button

WhatsApp ordering exists but it's a single send-message button. Make it a **conversation starter**:
- Pre-fill the message with the specific products and quantities
- Include a unique order reference that the admin can look up
- After the conversation, admin marks the WhatsApp order in the orders pipeline
- Order status updates push back to the customer via WhatsApp (or at minimum, the order status page)

---

## Quick Wins (< 1 day each)

1. **"Continue Where You Left Off"** — Show last 3 viewed products at shop top (data already in `recentlyViewed` store)
2. **Price per session estimate** — "~$0.80 per gongfu session" calculated from price-per-gram × typical session grams
3. **Stock urgency** — "Only 45g remaining" on low-stock items (threshold already exists in admin)
4. **New arrivals badge** — Flag products added in last 30 days using `created_at` timestamp
5. **Seasonal highlighting** — Auto-feature spring teas in spring, aged teas in winter (simple month-based logic)
