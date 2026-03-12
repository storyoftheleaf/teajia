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
