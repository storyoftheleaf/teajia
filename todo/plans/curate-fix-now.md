# Curate: Adrian's fix-now picks (2026-10-06)

From the Curate review (https://claude.ai/artifact/XBF9uyeTKD8nxrok3xqm5u). Library decision: one shared Library for the shop.
Done marks say where; everything else is still open.

## Before inviting anyone
- [x] a1 Sample pages show supplier name, WeChat/phone and notes to anyone signed in (`handleGetSample`, `handleGetSamplesBySet`: authorise by account membership)
- [x] a2 View-only members can read vendor contacts and delete sourcing trips (require gather/catalog on sample reads and journey/visit writes)
- [ ] a3 People without catalog access land on a dead page (send each role to its first room, hide what they cannot open)
- [ ] a4 Purchase records (ledger) live only on the phone and are not separated by shop
## Wrong money
- [x] m1 (v2) Price-tag scan throws away the currency it reads; preview always says NT$
- [x] m2 (v2) Ledger lines multiply the per-100 g price by grams
- [ ] m3 Promotion copies a per-N-gram quote as the whole cost
- [ ] m4 A default currency can be sent as stated after a restart (touched fields lost on hydrate)
- [~] m5 NT$ fallbacks: Curate v2 new orders now start in the last currency used; the other fallbacks remain
## Lost work
- [x] l1 Edit typed during a save is marked saved, then lost (`teaCompassSync` marks synced without checking updatedAt)
- [ ] l2 Photos taken with no signal are lost; concurrent uploads overwrite each other
- [ ] l3 Deleting a sample batch can jam every later save
- [x] l4 (v2) One tap on × discards a capture with no undo
- [ ] l5 Purchase orders fail quietly; "Mark as Sent" PUTs a prefix id; receive shows blanks
- [ ] l6 Receipt flow makes a bare product and blocks the full promotion
- [x] l7 Re-tasting wipes the product's curated tasting (use `mergeProductTasting` in the compass PUT)
## Faster entry (v2 covers some)
- [ ] s1 Voice and typed notes fill the fields (v2: a typed line now fills price, unit and currency)
- [ ] s2 Voice button hidden from everyone but platform owners
- [ ] s3 Carry the last tea's details forward
- [~] s4 Currency follows the vendor (v2: the table's vendor carries to every new tea; currency per vendor still to do)
- [ ] s5 "Same tea as before?" can copy details
- [ ] s6 Focus the next tea's name after Done
- [ ] s7 Keep Done in reach
- [x] s8 Quick-add row reads the whole line (v2 Table: "Mengku 2018 ¥450/cake")
- [ ] s9 Scan fills the form directly
## Tasting
- [x] t1 One-tap tasting (v2 fast tasting, the full tasting's own words)
- [ ] t3 Notes from the vendor table reach the product
- [x] t4 "Tasted by the shop" only when terms are present
- [x] t5 Check tasting terms against the taxonomy on promotion
- [ ] t7 Start a re-taste from the last one
## New curators
- [ ] p1 First-run guide
- [~] p2 Plain words (v2: Teas, Orders, empty screens; "Graduate", "Compass" route still elsewhere)
- [ ] p3 More currencies from the refreshed rate list
- [ ] p4 Who captured what; merge duplicates
## Fixed on main 2026-10-07 (not on the review list)
- [x] A vendor's WeChat save failed and lost the whole vendor card (no wechat column; now contacts)
- [x] A vendor created from Curate broke the whole customer list (tags stored as a bare word)
- [x] Curate's shelf preview and spending summary use the shop's rates and freight
