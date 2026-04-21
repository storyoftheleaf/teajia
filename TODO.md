# Teajia Development TODO

## Mood & Flavor Taxonomy System

The goal: create a canonical, interconnected set of mood and flavor tags that every tea pulls from. Build the lists first, then map teas to them.

### Phase 1: Define the Lists
- [ ] Audit all existing mood values across the 139+ teas — extract every unique mood currently in the DB
- [ ] Audit all existing tasting notes — extract every unique tag currently in the DB
- [ ] Draft a canonical **mood vocabulary** (curated list of allowed mood keywords)
- [ ] Draft a canonical **flavor vocabulary** (curated list of allowed tasting note keywords)
- [ ] Review and finalize both lists (Adrian approves)

### Phase 2: Define Connections
- [ ] Map relationships between mood tags (e.g., "grounding" relates to "contemplative")
- [ ] Map relationships between flavor tags (e.g., "camphor" relates to "sandalwood")
- [ ] Map cross-connections between moods and flavors (e.g., "earthy sweetness" flavor links to "grounding" mood)
- [ ] Decide on data structure for storing these relationships (graph, tags with categories, etc.)

### Phase 3: Store the Taxonomy
- [ ] Create a taxonomy data file or DB table for mood tags
- [ ] Create a taxonomy data file or DB table for flavor tags
- [ ] Store the interconnections/relationships
- [ ] Add API endpoints to fetch the taxonomy lists

### Phase 4: Connect to Products
- [ ] Update AddProductModal to use dropdowns/autocomplete from the taxonomy (not freeform text)
- [ ] Migrate existing freeform mood strings to canonical tags
- [ ] Migrate existing freeform tasting notes to canonical tags
- [ ] Update sync script to validate against taxonomy

### Phase 5: Frontend Features
- [ ] Allow browsing/filtering the shop by mood tags
- [ ] Allow browsing/filtering the shop by flavor tags
- [ ] "Related by mood" and "Related by flavor" connections on product pages
- [ ] Mood/flavor exploration page (click a mood, see all teas that share it)

---

## Product Card Redesign (In Progress)
- [x] Always reserve subtitle (given name) line height on cards
- [x] Add 1-3 image gallery with adaptive layout
- [x] Add mood tags as keyword-style pills
- [x] Reorder card: images → tasting notes → mood tags → description
- [x] Image lightbox on tap
- [ ] Split product names into title + subtitle (tea identity vs. tea type)
- [ ] Decide on naming convention for all teas (title/subtitle/year)

---

## Pending from Development Sprint (April 2026)

### #11 — Brewing Guide Profiles
Need ~20 brewing profiles written and stored, covering the full catalog:
- Water temp (°C), steep time (seconds), leaf-to-water ratio (g/ml), vessel type, infusion count
- One profile per tea type/style: Gongfu Oolong, Grandpa-style Green, White tea, Raw Puerh, Ripe Puerh, Aged Puerh, Sheng, High-mountain Oolong, Roasted Oolong, Black tea (gongfu), Black tea (western), Yellow tea, Liu Bao, etc.
- These will power the `/learn/brew/:teaType` pages AND the QR sticker cards already built
- Adrian to provide or approve profiles — can be drafted in a conversation and then loaded

### #21 — Magazine Template Reference
Find a magazine or editorial site whose quality and visual standard is the target for Teajia's magazine templates.
- Could be print (Kinfolk, Cereal, Monocle, Hole & Corner) or digital
- Provide 1–3 references so template overhaul has a clear target
- The 70-point template overhaul in PLAN.md is ready to execute once reference is confirmed

### #20 — Contributor Profile: Barry
- Get Barry's full name, background/bio, photo, and any content ready to publish
- First contributor profile template is already built (Phase 3, item 20 in DEVELOPMENT_PRIORITIES.md)
- Barry's profile will be the first signal that the magazine is a serious editorial home
