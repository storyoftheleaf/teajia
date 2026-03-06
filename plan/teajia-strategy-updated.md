# Teajia - Updated Strategy & Technical Decisions

## Master Reference Document

**Domain:** Teajia.com
**Purpose:** A living space for tea culture - community, education, curation, and space design
**Position:** Community leader and pillar of the tea world
**Last Updated:** February 2025
**Version:** 2.0 - Incorporates all decisions from strategy refinement sessions

---

# 1. Brand Foundation

## Identity

**Name:** Teajia

**Tagline:** "A Living Space for Tea Culture"

**Core Promise:** Stories, wisdom, and community - wherever you are on the path

**Philosophy:** Tea as a way of being, not a commodity. Ancient wisdom meets modern accessibility.

**Tone:** Elevated but welcoming. Not pretentious. Grounded depth.

**Brand Voice:** To be developed through a recording exercise - Adrian speaks naturally about Teajia, the transcription is analyzed for natural patterns, and guidelines are extracted. The voice guide will inform all site copy, product descriptions, magazine editorial, email, and the AI editorial system prompt.

**Positioning:** Teajia is a Bali-rooted brand with international reach and relevance. Not "the Bali tea guy." A global tea culture figure who happens to live and practice in one of the most beautiful places on earth, with 20+ years of deep connection to tea origins across Asia.

---

## Audience

| Audience | What They Seek |
|----------|----------------|
| Newcomers | Guidance entering tea |
| Experienced practitioners | Depth, community, connection |
| Collectors | Rare tea, antiques, quality |
| Space creators | Complete tea house design and curation |
| Businesses/Organizations | Tea integration, sourcing, events |
| Transformational travelers | Access to tea origins with a guide |

---

## Business Model

**Primary Revenue:**
- Tea House Design & Curation (highest value)
- Shop
- Tea Sourcing (B2B and collectors)

**Secondary Revenue:**
- Sessions & Guidance
- Sourcing Journeys (on request)

**Audience Building (leads to revenue):**
- Magazine (Read)
- Learn (courses)
- Library (resources)

---

## Connection to Art Site

Teajia and the Art site are two wings of Adrian's practice. They share a single Shopify Starter backend. Products are tagged for which site(s) they appear on.

**Shared Products (appear on both, different framing):**
- Tea Tables
- Art (tea-relevant)
- Incense
- Oracle Cards (tea ceremony deck)

**Teajia Only:**
- Tea, Teaware, Antiques, Sets

**Art Site Only:**
- Visual art (non-tea), Jewelry, Other oracle decks

**Cross-links:**
- On Teajia: "More from Adrian" link in Shop and footer
- On Art Site: "Adrian also runs Teajia" link

---

# 2. Technical Stack

## Confirmed Decisions

| Component | Choice | Notes |
|-----------|--------|-------|
| Build approach | Fully custom with Claude Code | Maximum control, no platform constraints |
| CMS | Sanity (free tier) | Headless, custom content models, visual editing |
| Commerce backend | Shopify Starter ($5/month) | Shared with art site, Storefront API, headless |
| Image hosting | Cloudflare R2 + Cloudflare Images ($5/month) | No egress fees, automatic optimization |
| Video hosting | YouTube (embedded) | Free, discovery channel, clean embed parameters |
| Email platform | Kit (ConvertKit) free tier | 10,000 subscribers, tagging, no automations on free |
| Payment processing | Shopify Payments (Stripe underneath) | No extra transaction fees |

## YouTube Embed Parameters

```
modestbranding=1    (reduces YouTube logo)
rel=0               (no related videos from other channels)
controls=1          (show player controls)
color=white         (white progress bar instead of red)
```

## Cloudflare Cost Reality

- R2 storage: $0.015 per GB/month (minimal at launch)
- Cloudflare Images: $5/month for optimization and responsive delivery
- Images is a subscription (optimization happens on the fly, cannot optimize once and cancel)
- YouTube for video: free

---

# 3. Site Architecture

## Navigation

**Mobile (bottom bar, app-style):**
```
Read | Learn | teajia (home) | Consult | Shop
```

**Top bar (mobile):**
- Library link (persistent, subtle)
- Search icon
- Cart
- Account

**Desktop (top navigation):**
```
Teajia (logo/home)    Read    Learn    Library    Consult    Shop    [Search] [Cart] [Account]
```

Library joins the main nav on desktop where there's room. On mobile it lives in the top bar.

About is accessible from: homepage section, footer, subtle top bar link. Not in main nav.

---

## URL Structure

```
teajia.com/                              (homepage)
teajia.com/read                          (magazine landing)
teajia.com/read/[article-slug]           (individual article)
teajia.com/learn                         (courses landing)
teajia.com/learn/[course-slug]           (individual course)
teajia.com/library                       (library landing)
teajia.com/library/glossary
teajia.com/library/tea-map
teajia.com/library/playlists
teajia.com/library/videos
teajia.com/library/visual-guides
teajia.com/library/reading
teajia.com/consult                       (services landing)
teajia.com/consult/tea-house-design
teajia.com/consult/sourcing-journeys
teajia.com/consult/sessions
teajia.com/consult/tea-sourcing
teajia.com/consult/projects              (projects landing)
teajia.com/consult/projects/[project-slug]
teajia.com/shop                          (shop landing)
teajia.com/shop/tea
teajia.com/shop/teaware
teajia.com/shop/tables
teajia.com/shop/art
teajia.com/shop/sets
teajia.com/shop/incense
teajia.com/shop/oracle-cards
teajia.com/shop/[product-slug]           (individual product)
teajia.com/about
teajia.com/inquire
teajia.com/contact
```

---

## Complete Site Map

```
teajia (Home)
|
|-- Read (Magazine)
|   |-- Featured Story
|   |-- New To You
|   |-- Start Here (4 foundational)
|   |-- All Articles (filterable by tags)
|
|-- Learn
|   |-- Fundamentals (course)
|   |-- [Future courses]
|
|-- Library
|   |-- Glossary
|   |-- Tea Map
|   |-- Playlists
|   |-- Videos
|   |-- Visual Guides
|   |-- Reading
|
|-- Consult
|   |-- Tea House Design & Curation
|   |-- Sourcing Journeys
|   |-- Sessions & Guidance
|   |-- Tea Sourcing
|   |-- Projects
|       |-- Spaces
|       |-- Events
|       |-- Journeys
|
|-- Shop
|   |-- Featured pieces (editorial, top of page)
|   |-- Tea (White, Green, Yellow, Oolong, Black, Sheng, Shou, Dark, Herbal)
|   |-- Teaware (Pots, Gaiwans, Cups, Cha Hai, Kettles, For the Table, Tools)
|   |-- Tables
|   |-- Art
|   |-- Sets
|   |-- Incense
|   |-- Oracle Cards
|
|-- About (standalone page)
|-- Inquire (standalone page)
|-- Contact (footer)
```

---

# 4. The Shop

## Key Decision: One Unified Shop

No separate "Collection" section. Everything lives in one shop. Exceptional pieces (antiques, rare aged teas, significant art, handmade tables) live in their natural categories alongside everyday items. They stand out through their product pages (story-driven editorial template) and through featured placement on the shop landing page.

## Shop Landing Page Structure

Categories appear immediately at the top. No scrolling required to find what you want. Below the categories, editorial features spotlight exceptional pieces.

```
The Shop

[Tea] [Teaware] [Tables] [Art] [Sets] [Incense] [Oracle Cards]
(category images as visual entry points, immediately visible)

---

"Every piece here was chosen for a reason."

[Featured exceptional piece - large image, one line, price or Inquire]
[Featured exceptional piece - large image, one line, price or Inquire]
[Featured exceptional piece - large image, one line, price or Inquire]

(Rotates as inventory changes. Spotlights the most remarkable current items.)
```

## Shop Categories and Filters

### Tea
**Filters (elegant text row, no pills):**
All, White, Green, Yellow, Oolong, Black, Sheng Pu'erh, Shou Pu'erh, Dark (Hei Cha), Herbal

No secondary origin filter. Origin is communicated through product names and descriptions.

Aged teas live within their type category (an aged sheng is in Sheng Pu'erh). Truly exceptional aged teas also appear in the shop landing page featured section.

### Teaware
**Filters:**
All, Pots, Gaiwans, Cups, Cha Hai, Kettles, For the Table, Tools

**For the Table** includes: tea boats, pot rests, pot supports, display bowls, crystals, decorative elements that compose the table arrangement, wooden incense holders for the table.

**Tools** includes: scoops, picks, strainers, tongs, brushes, tea cloths.

Antique teaware lives in its natural sub-category (an antique pot is in Pots) with a story-driven product page.

### Tables
No sub-filters. Browse all tables. Range from small personal tables to large ceremony tables. Priced items show prices with "Shipping quoted separately" note. Custom commissions show "Inquire."

### Art
No sub-filters. Priced pieces show prices. Custom work shows "Inquire" or "Commission."

### Sets
No sub-filters at launch.

### Incense
No sub-filters at launch.

### Oracle Cards
No sub-filters.

## Category Display

On the shop landing page, categories are visual entry points with single representative images. Not pills or text links. Each image is a doorway into that world.

Within a category, the filter row uses elegant text links with generous spacing. Active filter shown by subtle underline or weight change. Feels like magazine navigation, not shopping filters.

Exceptional pieces within a category get a subtle visual distinction in the browse grid (slightly larger card, more breathing room, or different treatment) to signal "this one has a story."

## Product Page Templates

### Product Page (most items)
Beautiful photography (3-6 images), name, price, brief confident description, materials/dimensions where relevant, add to cart or inquiry button. Elevated but efficient.

### Story Page (exceptional pieces)
Large images, provenance, the journey of acquisition, tasting notes for teas, maker context. Price may not appear until after the story. The piece sells on narrative and trust. Used for: antiques, rare aged teas, significant art, handmade tables, maker-featured teaware.

### Set Page
Shows the complete set beautifully. Breaks down what's included. Each item links to its individual product page.

## Cross-Links Within Shop

Within Tea section, after the grid: "Looking for something rare?" with image linking to featured exceptional teas.

Within Teaware section: "Antique and heirloom pieces" with image linking to featured exceptional teaware.

Individual product pages can link to: related magazine article (maker's story, origin story), glossary terms, related products.

Tables and art product pages link to: Consult - Tea House Design.

---

# 5. Location and Checkout

## Location Preference System

IP geolocation detects likely location on first visit but never locks anyone out. A clear prompt: "It looks like you're browsing from [country]. Shopping from Bali?" with a toggle. Customer sets their preference and it persists in localStorage. When they create an account, it migrates to their profile.

All products are visible to everyone regardless of location. Only the checkout options change.

### VPN Handling
Location is always a customer-set preference, not system-imposed. VPN users (common in Bali's expat community) can switch with one tap.

### Currency
International: USD. Bali: IDR. Location toggle switches currency display.

## Checkout Flows

### For items with straightforward shipping (teaware, incense, oracle cards, small items):
- **Bali:** Add to Cart (standard checkout) or Order via WhatsApp
- **International:** Add to Cart (standard checkout with flat shipping rate)

### For items with complex/heavy shipping (tables, large antiques, art):
- **Bali:** Order via WhatsApp
- **International:** Inquire via WhatsApp

### For tea:
- **Bali:** Add to Cart or Order via WhatsApp
- **International:** "Available in our Bali studio. Inquire about sourcing." Links to WhatsApp or inquiry form

### For exceptional pieces (significant antiques, one-of-a-kind items):
- **Both:** Inquire via WhatsApp or inquiry form

### For custom commissions:
- **Both:** "Start a conversation" linking to inquiry form

## Bali Checkout (Two Options)
1. **Add to Cart** - Standard online checkout with card payment, delivery arranged
2. **Order via WhatsApp** - Pre-formatted message, everything handled conversationally (payment method, delivery or pickup)

No separate pickup option on the site. Pickup is arranged through WhatsApp conversation.

## International Checkout (Two Options)
1. **Add to Cart** - Standard checkout for straightforward shippable items
2. **Inquire via WhatsApp** - For freight items, custom shipping, or items needing conversation

## WhatsApp Integration
One WhatsApp Business number for everything. Pre-formatted messages vary by context:
- Shop order: "Hi, I'd like to order: [product name, quantity]. My name is [blank]."
- Consult inquiry: "Hi, I'm interested in [service type]. I'd love to start a conversation."
- Shipping inquiry: "Hi, I'm interested in [product name]. Could we discuss shipping to [location]?"
- General: "Hi, I found Teajia and wanted to reach out."

## Shipping Notes on Product Pages
- Tables/large items: "Shipping quoted separately. Contact us for an estimate."
- Tea (international view): "Available in our Bali studio" with sourcing inquiry link
- Standard international items: flat rate or calculated shipping at checkout

## Shopify Product Attributes

Each product in Shopify carries these custom attributes:

- Shop categories (Tea, Teaware, Tables, Art, Sets, Incense, Oracle Cards)
- Sub-category (for Tea: type; for Teaware: sub-type)
- Product page type (product or story)
- Ships internationally (boolean)
- Available in Bali (boolean, always yes)
- Checkout type (cart, inquiry, or both)
- Freight required (boolean)
- Featured (boolean, for shop landing page spotlight)
- One of a kind (boolean)
- Related magazine article URL (optional)
- Related glossary term (optional)
- Maker name (optional)
- Origin location (optional)
- Appears on art site (boolean)

---

# 6. The Magazine (Read)

## Purpose
- Front door to Teajia
- Community service - shares wisdom of the tea world
- Audience acquisition - featured guests bring their audiences
- Authority building - positions Adrian as curator and hub

## Format
- 3:4 aspect ratio (portrait, print-friendly)
- Paginated, swipeable on mobile (single page at a time)
- Two-page spread on desktop
- 20+ pages per article
- Video pages: thumbnail image with play button, video loads on tap
- Designed so every page is a standalone visual composition (Instagram-shareable)

### Video Behavior
- Thumbnail with play indicator (not autoplay)
- Video loads only when play is tapped (performance)
- Short clips play in place within the page layout
- Longer videos (3+ minutes) offer fullscreen option
- When video ends, returns to thumbnail
- Videos hosted on YouTube, embedded with clean parameters

### Desktop Two-Page Spread
- Pages pair naturally side by side
- Not every spread needs to be a composed pair
- Avoid awkward pairings (two video thumbnails, very sparse next to very dense)
- Odd page counts: final page (closing/CTA) sits alone on the right

### Instagram Integration
- Individual pages exported as images for Instagram posts
- You share pages, not readers (no "share this page" button in the UI)
- Article links shared by readers lead to full article on Teajia.com
- Open Graph previews must be beautiful (hero image, title, one-line description)

### Print Potential
- 3:4 ratio maps to standard print sizes
- Design templates with eventual print adaptation in mind

## Page Templates (8 types, to be designed)

1. **Opening page** - Article title, hero image, subtitle, guest name
2. **Text page** - Clean typography, generous margins, ~150-200 words
3. **Full-bleed image page** - Image fills entire page, optional small caption
4. **Image with text page** - Image top half or two-thirds, text below
5. **Pull quote page** - Single short quote, large typography, centered (Instagram-ready)
6. **Video page** - Thumbnail image with play indicator, brief caption
7. **Section break page** - Divider between major sections, image or design element
8. **Closing page** - Guest photo, name, bio, links, continue reading, subtle CTA

## Article Structure

### End of Article
- Guest photo, name, bio, link to their site/social
- Continue Reading: two article suggestions (prioritize unread, tag-matched)
- Subtle CTA (one per article): "This tea is in our shop" or "We teach this in our courses" or "Adrian designs spaces like this"
- For visitors who arrived via shared link: brief Teajia orientation ("This is Teajia. A living space for tea culture." with pathways)

### Start Here (4 Foundational Articles)

| Article | Purpose |
|---------|---------|
| The Creation of Teajia | Origin story, manifesto, why this exists |
| Beginning Into Tea | Entry point for newcomers |
| The History of Tea and Its Relevance | Context, depth, why tea matters |
| The Importance and Beauty of Creating a Tea Space | Seeds design services |

### Editorial Approach
- Every piece carries Adrian's editor's voice
- AI structures interviews from real recorded conversations
- ~60% guest features / ~40% Adrian's own pieces
- Each piece delivers tangible value

### Publishing Cadence
- At least one article per month
- Can release multiple when ready
- Monthly email announces new content

## Read Tracking
- Device-based by default (localStorage, no friction)
- Account-based when logged in (syncs across devices)
- Gentle account creation prompts after reading 3+ pieces
- Applies to: magazine articles (read/unread), course progress, lightly to library resources

## AI Editorial Production Pipeline (To Be Developed)

**Workflow:**
1. Record conversation with guest (quality audio, lapel mic or portable recorder)
2. AI transcription and structuring (Claude structures into article with page suggestions)
3. Adrian's editorial pass (reshape, add voice, framing, connective tissue)
4. Page layout assembly using template system
5. Export and publish (site, Instagram page exports, YouTube video, email)

**Content leverage:** One recorded conversation becomes a YouTube video, a magazine article, 5-10 Instagram posts, and a newsletter feature.

---

# 7. Tag System

## Scope
Tags are global across all content types: magazine articles, products, courses, library resources, project pages. Shared tags power automatic cross-linking.

## Tag Categories

### Tea Types (9)
White, Green, Yellow, Oolong, Black, Sheng Pu'erh, Shou Pu'erh, Dark (Hei Cha), Herbal

### Subjects (17)
Teaware, Ceremony, Philosophy, History, Calligraphy, Brewing, Water, Sourcing, Storage, Seasons, Health, Culture, Teaching, Business, Origins, Tasting, Events & Celebrations

### Arts & Design (8)
Pottery, Metalwork, Woodwork, Textiles, Bamboo, Space Design, Architecture, Materials

### Places (8)
China, Yunnan, Fujian, Taiwan, Japan, Bali, United States, Global

### Rules
- Items can carry multiple tags
- No new tag unless it applies to at least 3 pieces
- Tags power cross-linking and "Continue Reading" suggestions
- A product tagged "Pottery" and "Fujian" automatically connects to magazine articles sharing those tags

---

# 8. Accounts

## Philosophy
Accounts are a relationship tool, not a login gate. People have a reason to create one: synced reading progress, purchase history, taste profile, course progress.

## Account Tiers (Internal, Not Displayed)

**General account:** Created through the site. Reading progress, purchase history, course progress, favorites.

**Studio visitor:** Created during or after an in-person session. Everything in general plus: taste profile built by Adrian, personal recommendations, early access to relevant new arrivals, invitations to group sessions and events before public announcement.

**Contributor:** For magazine guests and collaborators. Profile page within the magazine (bio, features, links). Not a CMS role.

## Taste Profile (Studio Visitors)

### In-Person Session Workflow
1. During the session, Adrian uses a printed Teajia session sheet (beautiful, on-brand, designed once, printed in batches)
2. Sheet has sections for: name, date, teas tasted, preferences, teaware chosen, journey notes, email
3. Filled out by hand during the session - no phones, keeps the warmth
4. After the session (within 24 hours): photograph the sheet, AI extracts and structures the data into a Sanity client profile
5. Adrian reviews, adjusts, publishes to their account
6. Welcome email sent with link to create password and view their profile

### What the Taste Profile Contains
- Teas they responded to (flavors, energy, specific teas)
- Teaware they chose
- Notes about their journey and what they're building
- Adrian's personal observations
- Updated over time with additional sessions and purchases

### How It's Used
- When new inventory arrives matching their profile, Adrian reaches out personally
- Kit (ConvertKit) tags mirror taste preferences for targeted email
- Purchase history combined with taste notes enables personalized recommendations
- Reordering teas they loved is easy through their account

## The 50-100 Person Inner Circle

Not a formal membership. A relationship. Studio visitors whose taste profiles Adrian knows, who trust his palate, who he reaches out to when he finds something exceptional. Technology (profiles, tags, Kit segmentation) makes maintaining these relationships sustainable at scale. This is the model of every great tea master - a layer of technology to keep it running.

## Account Creation Prompts (Gentle)
- After reading 3+ articles: "Save your reading progress"
- When favoriting: "Create an account to save favorites"
- When starting a course: account required
- After purchasing: "Track your orders and get early access"
- During Guided Practice Setup: created together or card with activation link

## Technical Implementation
- Simple auth (email + password, or magic link)
- Profile stores: name, email, location preference, reading history, purchase history, taste profile, account type, notes
- Expand capabilities as needed post-launch

---

# 9. Learn

## Purpose
- Structured tea education
- Adrian's unique teaching methodology ("brew first, understand later")
- Establishes expertise and authority

## Model
- Freemium: Fundamentals free, advanced courses paid later
- Primarily free at launch

## Connections
- Links to Magazine for deeper stories
- Links to Library for reference materials
- Links to Shop for teas and teaware mentioned
- Course progress tracked for account holders

---

# 10. Library

## Purpose
- Treasure chest for the tea journey
- Curated tools and resources
- Reference materials people return to
- Connective tissue for the ecosystem
- Fully free, community service

## Sections
- Glossary (terms, characters, meanings)
- Tea Map (Google Maps with curated pins - tea houses, shops, farms)
- Playlists (music for tea moments)
- Videos (curated watching)
- Visual Guides (infographics, printables)
- Reading (articles from around the web)

## Tracking
- Light tracking where relevant (course-related)
- Playlists and simple reference pages: no tracking needed

---

# 11. Consult

## Services

### Tea House Design & Curation (Flagship)
Complete tea space creation: design, curation, tea selection, training, operations.
For: hotels, resorts, retreat centers, private residences, restaurants, new tea house owners.

### Sourcing Journeys
Travel to tea origins with Adrian. Available on request, customized. Taiwan, China, and beyond.

### Sessions & Guidance
Tea experiences and learning - in Bali or digitally. Sessions (in-person, immersive) and Guidance (digital-friendly, practice support).

### Tea Sourcing
Quality tea for collectors, spaces, and businesses. Direct sourcing from Taiwan, China, and trusted origins.

### Projects
Portfolio of completed work: Spaces, Events, Journeys. Proof of work, credibility, leads to inquiries.

## Inquiry Form
One form for all inquiries. Beautiful, minimal. Fields: name, email, WhatsApp (optional), checkboxes for interest area, open text for vision, optional "how did you find Teajia."

All "Start a conversation" and "Inquire" buttons across the site point to the same form (teajia.com/inquire) or a consistent overlay.

---

# 12. Homepage

## Purpose
1. Orient first-time visitors
2. Route returning visitors quickly
3. Preview the ecosystem
4. Establish credibility
5. Capture email

## Structure
- Hero (tagline, core promise, explore button)
- Quick access (Read, Learn, Shop)
- Latest from the Magazine (swipeable article cards)
- Learn preview (featured course)
- Shop preview (featured items)
- Tea House Design & Curation highlight
- Library preview
- About preview (photo, brief intro, link to full page)
- Stay Connected (email capture)
- Footer (all section links, art site link, contact)

---

# 13. Email Strategy

## Platform: Kit (ConvertKit)

**Free tier:** Up to 10,000 subscribers, tagging, broadcast emails. No automated sequences.

**Paid tier ($29/month):** Adds automated sequences, visual automations, advanced segmentation. Upgrade when automations justify the cost (probably at 200-300+ active subscribers).

## Tagging from Day One
- source:magazine (signed up from article)
- source:shop (signed up from shop)
- source:homepage (signed up from homepage)
- source:studio (signed up during in-person session)
- customer (has purchased)
- studio:visitor (has sat in person)
- Taste preference tags mirroring the tea type categories

## Welcome Sequence (3 emails, manual at first, automated later)

**Email 1 (immediately):** Personal welcome from Adrian. What Teajia is (2-3 sentences). What to expect from the list. One link: "The Creation of Teajia" article.

**Email 2 (3 days later):** Orientation. Three paths: new to tea (link to "Beginning Into Tea"), already on the path (link to magazine), building a space or deepening practice (link to inquiry form).

**Email 3 (7 days later):** Something personal. A tea Adrian is drinking, a piece of teaware he's reaching for, why it matters. Casual mention it's in the shop. Teaches subscribers that emails are always worth opening.

## Monthly Newsletter
- Short personal note from Adrian
- What's new (articles, products, events)
- One invitation (read, try, come, reach out)
- Skip months with nothing meaningful to share

## Email Capture Points
- Homepage ("Stay connected")
- End of magazine articles ("Want more? Join the community")
- Learn page ("Be first to know when courses launch")
- Shop ("Early access to new arrivals")

---

# 14. Client Tiers and Sessions

*(Carried forward from strategy expansion document - unchanged)*

## Tier 1: Personal Practice
$100 to $1,000+ range. Individuals discovering or deepening tea. Entry via studio/shop, sessions, Guided Practice Setup.

## Tier 2: Space Integration
$5,000 to $30,000. People with existing spaces wanting tea integration. Starts with Design Session.

## Tier 3: Full Tea House Design
$50,000 to $100,000+. Complete space creation from concept through opening. International reach.

## Tier: Events
$500 to $5,000+. Tea experiences brought to gatherings.

## Session Offerings

### Open Sit
Free. Someone visits the studio. You share tea. Products purchased naturally.

### Guided Practice Setup
$250-$300 session fee, includes $100-$150 product credit. 2-3 hours. Leaves fully equipped with personalized brewing guide, philosophy card, "what's next" card, and follow-up check-in.

### Private or Group Experience (Hireable)
Half-day from $500, full-day $800-$1,500. You bring everything to their gathering.

### Group Ceremonial Session
Community: $30-$50/person. Private booking: $500-$1,000. Up to 12 in the living room space.

---

# 15. The Three Spaces

*(Carried forward from strategy expansion document - unchanged)*

## Space 1: The Office / Podcast Studio
Social connection and discovery. 2-4 people. Podcast recording, business relationships, content creation.

## Space 2: The Living Room / Ceremonial Space
Deep connection, ceremony, transformation. Up to 12 people. Group sessions, the experiential proof for space design clients.

## Space 3: The Art Studio / Shop
Tangible experience and accessible entry. Working studio doubles as shop. Casual entry point, product showroom, where Tier 1 clients naturally emerge.

---

# 16. Inquiry and Intake Process

*(Carried forward from strategy expansion - unchanged)*

1. Inquiry form (on site)
2. Personal response (24-48 hours)
3. Conversation (in person or video)
4. Vision Guide (for space design, PDF)
5. Design Session (paid, $750-$1,500, credits toward project)
6. Proposal (for full projects)
7. Ongoing relationship

---

# 17. Magazine Guest Feature Strategy

*(Carried forward from strategy expansion - unchanged)*

## Guest Categories (for first 10 features)
- Audience Builders (2-3): people with followings who share the feature
- Credibility Anchors (1-2): respected tea masters, scholars, artisans
- Potential Clients and Collaborators (2): retreat/space owners
- Makers and Artisans (2-3): potters, woodworkers, craftspeople
- Cross-World Connectors (1-2): people bringing tea into unexpected contexts

## Production Process
1. Personal outreach
2. Recorded conversation (in person over tea when possible)
3. AI structures the interview with Adrian's editorial voice
4. Draft shared with guest for approval
5. Photography (theirs, yours, or combination)
6. Published with attribution, links, photo
7. Both share with their audiences

---

# 18. International Tea Sourcing

Direct shipping from China and Taiwan opens recurring revenue through space design work.

**For Tier 2 and 3 clients:** Ongoing tea supply built into service packages. Quarterly or seasonal deliveries. Seasonal rotations curated by Adrian. Turns one-time projects into recurring relationships.

**Framing:** "We don't just design your space. We keep it alive."

---

# 19. Printed Materials

## For Guided Practice Setup Clients
- Brewing Guide (card, specific to purchased teas)
- Practice Philosophy Card (a few lines of teaching)
- "What's Next" Card (links to magazine, courses, shop, contact)
- Practice Booklet (future, 12-16 pages, designed once, printed in batches)

## For Space Design Clients
- Vision Guide (1-2 page PDF)
- Design Concept (2-4 page PDF)
- Proposal (2-4 page PDF)
- Training Materials (custom per project)

## In-Person Session Sheet
Printed, on-brand sheet for Guided Practice Setup and other sessions. Sections for name, date, teas tasted, preferences, teaware chosen, notes, email. Designed once, printed in batches. Photographed after session and processed by AI into client profile.

---

# 20. Cross-Linking Strategy

Tags are global. Cross-links are automatic based on shared tags with manual override.

## Magazine Links To
- Tea mentioned -> Shop (that tea)
- Teaware mentioned -> Shop (that teaware)
- Maker featured -> Shop (their pieces if carried)
- Brewing technique -> Learn (relevant course)
- Ceremony -> Library (playlist)
- Term (gongfu, cha qi) -> Library (glossary)
- Place -> Library (Tea Map pin)
- Space design -> Consult (Tea House Design)
- Project featured -> Consult (Projects)
- End of article -> Continue Reading + subtle CTA

## Shop Links To
- Maker's pieces -> Magazine (feature article)
- Product with origin story -> Magazine (related article)
- Tables and art -> Consult (Tea House Design)
- Within Tea section -> "Looking for something rare?" featured pieces
- Within Teaware -> "Antique and heirloom pieces" featured pieces

## Learn Links To
- Tea type mentioned -> Shop
- Teaware mentioned -> Shop
- Term referenced -> Library (glossary)
- Music suggested -> Library (playlist)
- Deeper topic -> Magazine
- Course completion -> Shop ("Ready to stock your practice?")

## Consult Links To
- Tea House Design -> Shop, Projects (Spaces)
- Sourcing Journeys -> Projects (Journeys)
- Sessions -> Magazine (tea experience articles)
- Tea Sourcing -> Shop (Tea)
- Projects -> Related services

---

# 21. Sanity Content Models

## Article
- Title, subtitle, slug
- Hero image
- Guest (name, photo, bio, links) - optional
- Tags (global tag reference)
- Pages array (ordered list of page objects):
  - Page type (opening, text, full-bleed-image, image-with-text, pull-quote, video, section-break, closing)
  - Content fields per type (text, image, video URL, quote text, caption, etc.)
- Featured (boolean)
- Foundational (boolean, for Start Here)
- Related CTA (text + link)
- Published date

## Product Editorial Content
- Linked Shopify product ID
- Story text (rich text)
- Provenance/origin narrative
- Maker reference (optional)
- Related article references
- Related glossary terms

## Service Page
- Title, slug
- Hero image
- Body content (rich text)
- CTA text and link

## Project
- Title, slug
- Type (space, event, journey)
- Hero image
- Location
- Client description
- Work description
- Image gallery
- Result/quote
- CTA

## Client Profile
- Name, email
- Account type (general, studio-visitor, contributor)
- Session date(s)
- Tasting notes
- Preferences (flavors, energy, tea types)
- Teaware chosen
- Journey notes
- Adrian's personal notes
- Linked purchases (Shopify order IDs)

## Contributor Profile
- Name, photo, bio
- External links
- Featured articles (references)

## Glossary Term
- Term, definition
- Chinese characters (optional)
- Related tags
- Related articles

## Tea Map Location
- Name, coordinates
- Adrian's note
- Related articles

## Site Settings
- Taglines, footer text
- WhatsApp number
- Social links
- Featured article (homepage)
- Featured products (homepage)

---

# 22. Build Phases

## Phase 0: Foundation
1. Brand voice exercise and guide
2. Visual identity (logo, typography, color)
3. Sanity setup with content models
4. Shopify Starter setup with product attributes

## Phase 1: Magazine and Reading Experience
5. Design magazine page templates (8 types)
6. Build paginated reading engine (mobile swipe, desktop spread)
7. Write "The Creation of Teajia"
8. Write remaining foundational articles
9. Write 2+ additional articles
10. Build page export tool for Instagram

## Phase 2: Services and Credibility
11. Write all Consult service page copy
12. Write project case studies
13. Write About page
14. Build Consult section pages
15. Build inquiry form

## Phase 3: Shop
16. Build shop frontend with Shopify Storefront API
17. Write product descriptions
18. Product photography
19. Build checkout flows (cart, WhatsApp, inquiry)
20. Build location preference and currency system
21. Build filter system

## Phase 4: Site Assembly
22. Build homepage
23. Build navigation and routing
24. Build footer and standalone pages
25. Cross-linking system
26. Email capture integration (Kit)
27. Read tracking system

## Phase 5: Launch Preparation
28. Email welcome sequence
29. Open Graph and sharing optimization
30. Performance testing
31. Soft launch

## Phase 6: Post-Launch
32. AI editorial pipeline refinement
33. Fundamentals course
34. Library sections
35. Account system expansion
36. Printed materials design
37. Guest feature outreach

---

# 23. Content To Create

## For Launch
- "The Creation of Teajia" (highest priority, foundational)
- "Beginning Into Tea" (foundational)
- "The History of Tea and Its Relevance" (foundational)
- "The Importance and Beauty of Creating a Tea Space" (foundational)
- 2+ additional magazine pieces (guest features or topic pieces)
- About page (narrative, not resume)
- All Consult service page copy
- Project case studies (Intaaya Resort, private client, 3 studio spaces, events, journeys)
- Product descriptions
- Inquiry form copy
- Email welcome sequence (3 emails)
- Brand voice guide

## Ongoing
- Monthly magazine articles (minimum)
- Product descriptions as inventory changes
- Project pages as work is completed
- Course content as developed
- Library resources as created

---

# 24. Assets Needed

## Photography
- Three studio spaces
- Intaaya Resort project
- Private client project
- Events documentation
- Sourcing journey archives (Taiwan, Yunnan, Fujian)
- All products
- Professional portrait and working shots
- Atmospheric tea imagery for hero sections

## Video
- Three spaces as filming locations
- Course content
- Podcast conversations (Space 1)
- Process documentation

## Design
- Magazine page templates
- Session sheet for in-person sessions
- Printed materials (brewing guide, philosophy card, what's next card)
- Client documents (vision guide, design concept, proposal templates)

---

# 25. File Structure

```
teajia/
|
|-- strategy/
|   |-- teajia-strategy-updated.md (this document)
|   |-- brand-voice-guide.md
|   |-- pricing-reference.md
|   |-- guest-feature-strategy.md
|
|-- content/
|   |-- magazine/
|   |   |-- foundational/
|   |   |-- features/
|   |   |-- drafts/
|   |
|   |-- pages/
|   |   |-- about.md
|   |   |-- contact.md
|   |   |-- inquiry-form.md
|   |
|   |-- consult/
|   |   |-- tea-house-design.md
|   |   |-- sourcing-journeys.md
|   |   |-- sessions-and-guidance.md
|   |   |-- tea-sourcing.md
|   |   |-- projects/
|   |
|   |-- shop/
|   |   |-- product-descriptions/
|   |   |-- collection-stories/
|   |
|   |-- learn/
|   |   |-- fundamentals/
|   |
|   |-- library/
|   |
|   |-- email/
|       |-- welcome-sequence.md
|
|-- assets/
|   |-- photography/
|   |   |-- spaces/
|   |   |-- products/
|   |   |-- journeys/
|   |   |-- events/
|   |   |-- portraits/
|   |   |-- atmosphere/
|   |
|   |-- video/
|   |
|   |-- design/
|       |-- magazine-templates/
|       |-- printed-materials/
|       |-- client-documents/
|
|-- ai-pipeline/
|   |-- editorial-system-prompt.md
|
|-- site/
    |-- [Claude Code project files]
```

---

# Document History

- **v1.0:** Original teajia-complete-strategy.md and teajia-strategy-expansion.md
- **v2.0:** February 2025 - Consolidated and updated with all decisions from strategy refinement session. Major changes: unified shop model (no separate Collection), revised tea categories (9 including Sheng/Shou/Dark), revised teaware categories (7), confirmed technical stack (Sanity, Shopify Starter, Cloudflare, YouTube, Kit), account system with taste profiles, checkout flow simplification, magazine format specifications (3:4, paginated, spread desktop).

---

*This document is the single source of truth for Teajia development. Use it as context for all build conversations.*
