# A4 part one: Launch 4 correctness review (Astra, build/launch-4 0a9dad75, read-only)

Launch 4 does not pass yet. Routing of fixes:
- Opus, build/l4-a4-withdrawal (from launch-4): findings 1, 2, 3, 4, 7.
- Codex Sol, build/l4-a4-flags (from launch-4): findings 10 to 16.
- Opus, build/fix-score-giver (from main, ships on Adrian's word like K14): findings 5, 6, 8 (live on main today).
- Question for Adrian: finding 9 (public article_count, collection item_count, view_count on existing pages).

1. Taking a tasting off the table leaves its words on the author's public profile (teaTable.ts:293, familyPersonTastings.ts:96, familyRoutes.ts:631; tea-table.test.ts:198 expects it).
2. Taking down or hiding a recap leaves its public detail, recap photos and contributor sit links live (teaTable.ts:333/:371, publicSitConnections.ts:12, publicSessions.ts:301, index.ts:12589).
3. An owner-hidden tasting can survive as a profile photo card or a promoted quote; an offered tasting made private keeps a placed/lead photo on the product page (familyPersonTastings.ts:103/:128, index.ts:20393, familyRoutes.ts:691, familyMedia.ts:65).
4. Revocable photos and pages can be shown from cache after withdrawal (public max-age 60s on tasting photos, 1h signed family photos, no Cache-Control on legacy recap/contributor JSON, client staleTime 5 min, kept-pieces no focus revalidation).
5. Shop access can reveal another person's score (effective role owner for platform admin; curator collection raw tasting_notes; authenticated MCP get_tea).
6. Some writes attach a score to the wrong giver (manager sample score on another's Compass tea, bulk import, legacy notes); deep legacy scores survive the scrubber's depth limit, including public MCP get_tea.
7. A shop publisher can hold a recap they did not host (teaTable.ts:405/:469).
8. Favourites responses expose counts and positions (PUT /api/user/favorites count, expected_count, public profile favourite position, journey sentence number).
9. People to collection path exposes article_count, collection.item_count, publication.view_count; public MCP browse_catalog count.
10. With all flags off: portfolio writes, photo-credit edits, and host article photo reads still work.
11. With all flags off: existing public responses gain cover_image_url, next_session, pours, poured_with, photograph_by.
12. Closed browser routes and MCP tools are distinguishable from absent ones.
13. A portfolio can display after it stops qualifying (client cache; server two-query race).
14. Hold overflow hides pieces; tied pagination loses records; a repeat share moves a tasting forward.
15. The two maker slots in top teas can hold the same product.
16. The Tea Table page shows "Next at a table" (what is coming), against the rule that it shows what has happened.

Holds: keep totals are owner-only; fresh table reads recheck visibility with no-store; hold 1 to 14 days and expiry on the database clock; Tea Table tasting projection omits scores; portfolio writes need the platform owner; top teas one per slot and hidden product fields protected.
