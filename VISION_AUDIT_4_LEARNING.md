# Teajia Vision Audit — Part 4: Learning & Content

## Current State

The Learn Hub has 6 modules across 3 tracks (Beginner, Brewing Mastery, Community & Culture), plus a curriculum structure, explore mode, library, and reading lists. The Magazine has 150+ layout variants and a gorgeous Reader. There's a glossary, inspiration gallery, community wisdom collection, and contributor directory.

The content quality is exceptional. The delivery system is exceptional. But learning and doing are separate worlds. You read about gongfu brewing... then close the article and open Tea Compass to log a session, with zero connection between the two.

---

## Transformation 1: Learning That Responds to Practice

### Contextual Content Surfacing

The knowledge graph concept from Part 1. Concrete implementation:

**In Tea Compass:**
- User logs a session with a Tieguanyin → sidebar suggestion: "The Art of Oolong" article, "Roasting Levels" learn module
- User notes "astringent" in tasting → tooltip: "Astringency in tea comes from catechins. Learn more in Flavor Foundations."
- User tries a new tea type for the first time → "New to white tea? Here's a 3-minute primer."

**In the Shop:**
- Viewing a Sheng puerh cake → "Understanding Puerh Aging" module linked
- Product has "gongfu recommended" → "Gongfu Basics" module linked
- Product origin is Wuyi → "Wuyi Rock Teas" article linked

**Implementation:** A mapping table — `{ teaType → [articleIds, moduleIds], tastingTerm → [articleIds], region → [articleIds] }`. Maybe 100 entries total. Hardcoded is fine. No ML needed.

### Practice Challenges

Turn passive learning into active practice:

- **"Brew Along" sessions** — Article describes a specific brewing method → "Try this now" button → opens Tea Compass pre-filled with the method's parameters
- **Weekly challenges** — "This week: try the same tea at three different temperatures. Log each session."
- **Skill badges** — "You've logged 10 gongfu sessions" → "Gongfu Practitioner" badge on profile
- **Module completion quizzes** — Not tests, but reflection: "After reading about oxidation, describe the most oxidized tea you've tried." Answer saved to journal.

### The Learning Path That Adapts

Current tracks are static: Beginner, Brewing Mastery, Community & Culture. Make them responsive:

- If someone has logged 50+ sessions → skip "Getting Started" and suggest intermediate content
- If someone only drinks green tea → prioritize content about green tea processing, Japanese tea culture
- If someone just attended an oolong tasting event → suggest the oolong deep dive
- Track which modules have been read (localStorage progress, already suggested in AUDIT.md #15)

---

## Transformation 2: The Living Magazine

### Editorial Calendar Tied to the Catalog

AUDIT.md #35 suggests seasonal content. Go deeper:

- **Spring (March-May):** Feature new harvest teas, articles on first flush, spring picking
- **Summer (June-Aug):** Cold brew guides, light teas, iced tea techniques
- **Autumn (Sept-Nov):** Roasted oolongs, aged tea features, warming preparations
- **Winter (Dec-Feb):** Dark teas, puerh storage, gongfu deep dives, gift guides

Auto-surface these based on `new Date().getMonth()`. Tag articles with seasons in the data layer.

### Reader → Shop Pipeline

When an article mentions a specific tea that exists in the catalog, make it shoppable:
- Inline product cards within articles: "The Aged Bai Mu Dan described in this article is available in our shop"
- Not aggressive. Not pop-ups. Just a subtle card at the relevant paragraph.
- Uses product name matching against catalog — simple string matching or manual annotation

### Audio Content Layer

AUDIT.md #36 suggests audio guides. This is high-impact for the tea context:

- **Tea stories as audio** — 3-5 minute narrated versions of key articles, playable while brewing
- **Guided tasting audio** — "Take your first sip. Let it sit on your tongue. What do you notice first?"
- **Background soundscapes** — Forest, rain on a tea house roof, fire crackling (ambient tracks for tea sessions)

Audio files hosted on R2 (already set up for image hosting). Simple HTML5 audio player. The infrastructure exists.

### User-Generated Content Pipeline

Currently all content is editorial (hardcoded in data files). Open a path for community content:

- **"My Tea Story" submissions** — Users write about a meaningful tea experience
- **Curated by Adrian** — Not a free-for-all. Submissions reviewed, best ones published in the magazine
- **Credit system** — Published contributors get store credit or featured status
- **Tasting note contributions** — Already discussed in Part 3. Feed into product pages.

---

## Transformation 3: The Glossary as a Living Reference

### Contextual Glossary

The TeaGlossary exists as a standalone page. Make it contextual:

- **Hover definitions** everywhere — any tea term in any article, product page, or tasting form shows a glossary tooltip
- **Progressive disclosure** — short definition on hover, full entry on click
- **"Terms you've encountered"** — track which glossary terms the user has seen, build a personal vocabulary list
- **Spaced repetition** (ambitious) — periodically surface "remember this term?" for terms encountered weeks ago

### Visual Glossary

Some tea concepts are inherently visual:
- **Oxidation levels** → color gradient strip from green to black
- **Leaf shapes** → illustrated guide (rolled, twisted, needle, cake, etc.)
- **Liquor colors** → actual color swatches matching the `liquorColor` field on products
- **Processing flowcharts** → visual diagram of how each tea type is made

These could be simple SVG illustrations or curated photos. They make the glossary a destination, not just a reference.

---

## Transformation 4: The Library as a Curated Collection

### Reading Lists That Connect to Practice

Current reading lists exist but are static. Make them dynamic:

- **"Based on your collection"** — If you own mostly oolongs, surface oolong-related reading
- **"Before your next event"** — If registered for a puerh tasting, suggest puerh articles
- **"Deepen your understanding"** — If you rated a tea highly, suggest content about its origin/type
- **"Seasonal reading"** — Auto-curated by month

### Video Integration

The library has video/playlist components. Expand:
- **Brewing technique videos** — Short (1-2 min) clips demonstrating specific techniques
- **Origin documentaries** — Longer content about tea regions, farmers, processing
- **Embedded in product pages** — "Watch how this tea is processed" for products with processing notes

### Contributor-Led Collections

AUDIT.md #37. The contributors directory exists. Let contributors curate:
- Each contributor picks 5-10 favorite teas from the catalog with personal commentary
- "Sarah's Picks" → a collection page with her photo, bio, and curated teas
- This adds social proof and diverse perspectives to the catalog

---

## Quick Wins (< 1 day each)

1. **Reading progress tracking** — Mark articles as read/unread in localStorage, show progress bar on Learn tracks
2. **"Related reading" on product pages** — Manual mapping of 2-3 articles per tea type (15 mappings covers the catalog)
3. **Glossary tooltips** — Wrap known terms in `<Tooltip>` components. Start with product pages.
4. **Seasonal banner** — Simple month-based logic to feature seasonal content at the top of Magazine
5. **"Read time" estimate** — Word count / 200 = minutes. Show on article cards.
6. **Bookmark articles** — Add to existing favorites system. "Saved articles" tab in account.
