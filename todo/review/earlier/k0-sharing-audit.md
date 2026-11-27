# K0 audit: sharing and taking back (Astra, at main 0bf5faf, 2026-11-26)

Live problems today (not only Tea Table preparation):
1. A share covers a whole journal row: a later sitting saved with "Keep private" still appears publicly (Keep private then Done writes nothing). Profile also shows a historical note marked only by sourceJournalEntryId.
2. "Remove from my page" removes one photo only; words, shop offer, file and excerpts survive; a removed offered photo can still be made the shop's lead. Share set private leaves approved quotes on Home and the tea listing. Copies in products.tasting.notes survive everything.
3. Shared family photo bare /api/media URL serves 200; removal keeps row and objects; signed URLs live 12h. Host recap gallery images removed from the gallery stay served for a year, immutable.
4. A pictured attendee's photo_consent=0 and event_consents.photography=0 do not stop a recap photo being published (no photographed-person link).
5. shared_at/updated_at cannot prove consent to a new page: old shares must be shared again for the Tea Table.
6. Account deletion fails with FOREIGN KEY for anyone with a page share (rolls back, share stays public). On success, network reviews (rating 8) and samples (rating 7) keep the author id and score publicly.
7. Family hide/report covers only pages, member photos and shared tastings; not impressions, recaps, guest book notes, reviews, samples, gallery. Hiding a tasting leaves its photo metadata, directory thumbnail and quotes.
8. Anonymous reads carry numeric scores: GET /api/samples/:id (tastings[].rating), GET /api/tea-reviews?product_id= (rating, r.*), store product detail tasting.quality (shop score).
9. /tea-feed is closed (BREWING_EXPERIENCES_OPEN false); recent-recaps API is public, formal recaps only, ordered by event date.
Full report with links: in the build thread (K0 message).
