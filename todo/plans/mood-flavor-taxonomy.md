# Build a connected mood and flavor tagging system

Goal: a canonical, interconnected set of mood and flavor tags that every tea pulls from, replacing today's freeform values. Build the lists first, then map teas to them, then surface them on the site.

## Phase 1: Define the lists

Audit every existing mood value and tasting note across the 139+ teas (extract every unique value in the database), then draft a canonical mood vocabulary and flavor vocabulary. Adrian approves the finalized lists.

## Phase 2: Define connections

Map mood-to-mood relationships, flavor-to-flavor relationships, and mood-to-flavor cross-connections. Decide the storage structure (graph, categorized tags, etc.).

## Phase 3: Store the taxonomy

Create taxonomy tables or files for mood and flavor tags, store the interconnections, and add API endpoints to fetch the lists.

## Phase 4: Connect to products

Update the add-product form to use taxonomy dropdowns or autocomplete instead of freeform entry. Migrate existing freeform moods and tasting notes to the canonical tags. Update the sync script to validate against the taxonomy.

## Phase 5: Frontend features

Browse and filter the shop by mood and flavor tags. Add "Related by mood" and "Related by flavor" on product pages. Build a mood and flavor exploration page where clicking a mood shows all teas that share it.
