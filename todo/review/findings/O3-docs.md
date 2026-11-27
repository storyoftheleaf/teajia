Done by Sonnet 5.5 (cloud).

Checked: docs/PILLAR.md, docs/SECTIONS.md, docs/STATE_OF_THE_SITE.md and docs/CHANGELOG.md against build/review (6e67b62): all 16 switch constants and their gate functions in src/lib, worker/src/launch4Closed.ts, the route tables (worker/src/index.ts, worker/src/knowThisTea.ts, worker/src/teaHouses.ts), src/App.tsx, src/admin/AdminApp.tsx, src/pages/teaHouses/teaHouseRoutes.tsx and src/components/navSections.ts. docs/SITE_MAP.md was read only as a cross-check; it is already correct on Visit and the bar.
Holds: every switch name, its default and what it needs is right where the docs name it: FIRST_TABLE_OPEN is true; the other fifteen are false; ANYONE_HOSTS, CIRCLES, HOST_TOKENS, YOUR_TABLE_PLACE and the launch 3 tools stand on FEW_HOSTS_OPEN; KNOW_THIS_TEA stands on TEA_TABLE_OPEN; Launch 4 closed routes answer as absent. The Launch 1, 2 and 3 paragraphs are true, apart from one sentence.
Findings: 22 (PILLAR 8, SECTIONS 8, STATE_OF_THE_SITE 3, CHANGELOG 3). Three of them are about the same thing in more than one file and are marked "same fault".

The switches, as the code has them (the proof used by every finding below)

| Switch | Default | Constant | Also needs | Gate in the worker |
|---|---|---|---|---|
| FIRST_TABLE_OPEN | true | src/lib/firstTable.ts:12 | nothing | worker reads FIRST_TABLE_OPEN |
| FEW_HOSTS_OPEN | false | src/lib/fewHosts.ts:13 | host approval | every host route 404 |
| ANYONE_HOSTS_OPEN | false | src/lib/anyoneHosts.ts:10 | FEW_HOSTS_OPEN (mcpTools/launch3.ts:149) | launch 3 reads and tools |
| TEA_TABLE_OPEN | false | src/lib/teaTable.ts:15 | nothing | launch4Closed.ts:30; also photograph credit (photographCredit.ts:9) |
| FAVOURITES_OPEN | false | src/lib/favouritesOpen.ts:12 | nothing | launch4Closed.ts:32-33 |
| YOUR_TABLE_PAGE_OPEN | false | src/lib/yourTablePage.ts:17 | nothing | launch4Closed.ts:37 (tasting-shares) |
| HOST_ARTICLES_OPEN | false | src/lib/hostArticles.ts:2 | nothing | launch4Closed.ts:35 |
| TOP_TEAS_OPEN | false | src/lib/topTeas.ts:3 | nothing | launch4Closed.ts:36 |
| TEA_HOUSES_OPEN | false | src/lib/teaHouses.ts:17 | nothing | launch4Closed.ts:34; site routes in teaHouseRoutes.tsx:25, including Visit |
| YOUR_TABLE_PLACE_OPEN | false | src/lib/yourTablePlace.ts:15 | FEW_HOSTS_OPEN | launch4Closed.ts:38 |
| HOME_BAR_OPEN | false | src/lib/homeBar.ts:17 | nothing (site only, no worker route) | none; navSections.ts, HomeV2Page.tsx:138 |
| HOST_CREDIT_OPEN | false | src/lib/hostCredit.ts:19 | nothing (it does not read FEW_HOSTS_OPEN: hostCredit.ts:37, no import in worker/src/hostCredit*.ts) | worker/src/index.ts:33713-33718 |
| CIRCLES_OPEN | false | src/lib/circles.ts:15 | FEW_HOSTS_OPEN (circles.ts:34-36) | circles routes |
| HOST_TOKENS_OPEN | false | src/lib/hostTokens.ts:20 | FEW_HOSTS_OPEN (hostTokens.ts:39-41) | /mcp host key |
| TABLE_CARD_OPEN | false | src/lib/tableCard.ts:10 | nothing | AdminApp.tsx:587; the tea menu's year and place, index.ts:15125 |
| KNOW_THIS_TEA_OPEN | false | src/lib/knowThisTea.ts:22 | TEA_TABLE_OPEN (worker/src/knowThisTea.ts:62) | routes at worker/src/knowThisTea.ts:457-470 |

---------------------------------------------------------------------
docs/PILLAR.md
---------------------------------------------------------------------

P1. Line 5 (Launch 4 status), the switch list and the last sentence.
Current: "The Tea Table, Favourites, Your Table page and place, host articles, top teas and Tea Houses (Visit included) default to off. ... The proposed Home and navigation changes are in [SECTIONS.md](SECTIONS.md)."
True now: Home in full, the four new bar words, keys 1 to 5, the shorter phone menu and rail foot and Read's row of three shelves are built, behind HOME_BAR_OPEN (src/lib/homeBar.ts:17, off); they are not proposals. The list names no constants for host articles, top teas or Your Table place, and leaves HOME_BAR_OPEN out. Proof: src/components/navSections.ts:9-17 and 61-63, src/pages/HomeV2Page.tsx:138, src/pages/home/HomeLaunchFour.tsx.
Replace with: "The Tea Table (`TEA_TABLE_OPEN`), Favourites (`FAVOURITES_OPEN`), Your Table page (`YOUR_TABLE_PAGE_OPEN`) and place (`YOUR_TABLE_PLACE_OPEN`), host articles (`HOST_ARTICLES_OPEN`), top teas (`TOP_TEAS_OPEN`), Tea Houses with Visit (`TEA_HOUSES_OPEN`) and the new bar with Home in full (`HOME_BAR_OPEN`) all default to off. ... The new bar and Home are built behind `HOME_BAR_OPEN`; the section map is in [SECTIONS.md](SECTIONS.md)."

P2. Line 7 (Launch 5 status), credit screens. Same fault in STATE_OF_THE_SITE (S1) and CHANGELOG (C1).
Current: "...with a per-order ceiling; its screens are a separate build."
True now: the screens are built. The host's page is `/account/tea-credit` (src/App.tsx:1287, src/pages/TeaCreditPage.tsx, linked from the Your Table tile in src/components/AccountPanel/LaunchpadView.tsx:5 and index.tsx:137-138); the owner's section is `TeaCreditSection` in Manage, Sales, Waiting (src/admin/components/PendingView.tsx:57, TeaCreditSection.tsx:40); and the checkout has a "use my tea credit" tile (src/components/shared/PublicCart.tsx:373). All three read `HOST_CREDIT_OPEN`. Also, the same sentence says the ceiling is per order; the default is no ceiling (src/lib/hostCredit.ts:30-31) and the credit share defaults to 10 percent (hostCredit.ts:29).
Replace with: "...in an append-only ledger; the shop may set a per-order ceiling (none by default). The host reads it at `/account/tea-credit`, the owner approves in Manage, Sales, Waiting, and the checkout offers it on the host's own order, all behind `HOST_CREDIT_OPEN`."

P3. Line 7, which parts need Launch 2's switch.
Current: "Each of the first three also needs Launch 2's `FEW_HOSTS_OPEN`."
True now: the first three are credit, circles and the key. Only circles (src/lib/circles.ts:34-36) and the key (src/lib/hostTokens.ts:39-41) need it. Credit does not (src/lib/hostCredit.ts:37; no fewHosts import in worker/src/hostCredit*.ts). Same fault in STATE_OF_THE_SITE (S1).
Replace with: "Circles and the host's key also need Launch 2's `FEW_HOSTS_OPEN`; tea credit and the card for the table do not."

P4. Line 7, missing: "Does anyone know this tea?".
Current: missing. Launch 5's eighth part (`KNOW_THIS_TEA_OPEN`) is named nowhere in the four documents (zero hits in all of them).
True now: a signed-in person puts a photograph of a tea they cannot name on the Tea Table with a line on where they got it; others tell the asker privately; the asker may mark it named and thank one person; nothing is counted or sent; no public replies; the owner can hide it in Manage. Routes under `/api/tea-table/questions` and `/api/admin/tea-table/questions` (worker/src/knowThisTea.ts:457-470); needs `TEA_TABLE_OPEN` too (worker/src/knowThisTea.ts:62); migration 0147_know_this_tea.sql; limits at src/lib/knowThisTea.ts:44-47 (six open, three a day).
Replace with (add to the Launch 5 note): "Does anyone know this tea (`KNOW_THIS_TEA_OPEN`, also needs `TEA_TABLE_OPEN`): a signed-in person puts a photograph of a tea they cannot name on the Tea Table with where they got it. Others tell them privately; the asker may mark it named and thank one person. There is no public reply thread, nothing is counted or sent, and the owner can hide a question in Manage."

P5. Line 69 (Launch 1), "Nothing reads that table yet: it is not shown, paid or ranked."
True now: the credit ledger reads `order_session_sources` to earn credit (worker/src/hostCreditLedger.ts:27, 197, 323), when `HOST_CREDIT_OPEN` is on. It is still not shown to guests and not ranked.
Replace with: "Nothing shows it to a guest or ranks by it. With `HOST_CREDIT_OPEN` on, the credit ledger reads it to earn tea credit for the host once the shop fills the order."

P6. Line 133, Visit and Tea Houses.
Current: "**Visit** at `/tea-houses/visit` has no switch on this branch. ... Build and Work remain proposals."
True now: Visit is behind `TEA_HOUSES_OPEN` with the rest of Tea Houses; closed, its route is not registered (src/pages/teaHouses/teaHouseRoutes.tsx:12-16, 25-27) and the public answer carries no photograph or next session (docs/SITE_MAP.md:130, 255-257 already says so; docs/SECTIONS.md:109 too; this line contradicts line 5 of the same file). Overview, Build, Work and each house's page are built and behind the same switch (teaHouseRoutes.tsx:28-31), with Adrian's part in each house entered in Manage, Settings (src/admin/components/settings/TeaHousePortfolioSection.tsx).
Replace with: "**Tea Houses** (`TEA_HOUSES_OPEN`, off): the Overview at `/tea-houses`, Build, Work and each house's page, and Visit at `/tea-houses/visit`, which lists active public accounts with an active public product from the existing directory, with a link to each storefront, its photograph and next public session. Private saved tables and arrival details stay out. Closed, none of these addresses exists."

P7. Lines 15 and 28 (the four sections and the bar), and missing "Host a table".
Current: "The whole public site hangs off four sections ... Read, Craft, Advise, Shop"; and line 28 on the bottom bar and site panel.
True now: right while `HOME_BAR_OPEN` is closed, and silent on the open form: the four words become Read, Tea table, Tea house, Shop (src/components/navSections.ts:17), Craft becomes Read's second shelf, "Tea table" opens `/tea-table` when open and otherwise `/events` (navSections.ts:42-44), "Tea house" opens `/tea-houses` when open and otherwise `/tea-houses/visit` (navSections.ts:61-63).
Replace with (add after line 28): "With `HOME_BAR_OPEN` on, the four words are Read, Tea table, Tea house and Shop; Craft and Wisdom become Read's second and third shelves (a row of three at the top of `/read`, `/craft` and `/wisdom`); keys 1 to 5 follow the words. Adrian doubts the two middle words, so the switch is off."
Code note for the owner of navSections.ts: `housesDoor()` returns `/tea-houses/visit` while `TEA_HOUSES_OPEN` is off, but that route is not registered then (teaHouseRoutes.tsx:25), and the comment at navSections.ts:57-60 calls Visit "always there". The opening order puts TEA_HOUSES before HOME_BAR so it does not bite, but the comment and the fallback are wrong.

P8. Line 32 and the host-offers sentence on line 21, missing constants; missing "Add your table".
Current: "Behind the top teas flag, a host can choose ..." (flag unnamed). Nothing says a host can name one of their saved places as their table.
True now: the flag is `TOP_TEAS_OPEN` (src/lib/topTeas.ts:3; src/pages/ContributorProfilePage.tsx:289). "Add your table" is `YOUR_TABLE_PLACE_OPEN` (src/lib/yourTablePlace.ts:15; needs `FEW_HOSTS_OPEN`, launch4Closed.ts:38): a host names a saved place as their table and the area people see; the public page says "Ana's table, Ubud, near the market", never the address (docs/CHANGELOG.md:13).
Replace line 32 start with: "Behind `TOP_TEAS_OPEN`, a host can choose ...". Add: "**Add your table** (`YOUR_TABLE_PLACE_OPEN`, also needs `FEW_HOSTS_OPEN`): on `/account/host` a host names one of their saved places as their table and writes the area people see; their sessions there are described by area only."

---------------------------------------------------------------------
docs/SECTIONS.md
---------------------------------------------------------------------

M1. Line 1, the title: "Teajia sections: the proposed overhaul". Half the overhaul is built behind switches. Replace with "Teajia sections: the overhaul, what is built and what is proposed".

M2. Line 3, first banner.
Current: "The section diagram, new bar words, Home and the full Tea Houses offering are proposals. The current bar reads **read, craft, advise, shop**." and then, in the same paragraph, "The bar change, Home in full and Read's row of three shelves are built behind `HOME_BAR_OPEN`".
True now: the second half is right and the first half contradicts it. Bar words, Home, Read's shelves (HOME_BAR_OPEN, src/lib/homeBar.ts:17) and Overview, Build, Work and Visit (TEA_HOUSES_OPEN, src/lib/teaHouses.ts:17) are built and off. What is still a proposal is whether Adrian keeps the words.
Replace with: "Built and off: the bar words, Home in full and Read's three shelves (`HOME_BAR_OPEN`), and Tea Houses with Visit, Build and Work (`TEA_HOUSES_OPEN`). The bar reads read, craft, advise, shop until `HOME_BAR_OPEN` opens. Adrian has not settled the words 'Tea table' and 'Tea house'."

M3. Line 22.
Current: "The bar and the rail stay four words ... **read, table, (emblem), houses, shop**."
True now: the words in the code are "Read", "Tea table", "Tea house", "Shop" (src/components/navSections.ts:17), one line.
Replace with: "...**Read, Tea table, (emblem), Tea house, Shop**, set on one line in `src/components/navSections.ts`."

M4. Line 45, loop step 6.
Current: "Host | A guest opens their own session and becomes its host | Proposed doors in Home and Your Table".
True now: built. "Host a table" is on Home (src/pages/HomeV2Page.tsx:231, 344-356), on the Your Table panel (src/components/AccountPanel/LaunchpadView.tsx:158) and in Your Table's sits (src/components/account/MemberSitsJourney.tsx:45-49), shown only while hosting is open (src/hooks/useMayHost.ts:17-32).
Replace with: "Home and Your Table, behind `FEW_HOSTS_OPEN`".

M5. Lines 96-122, Tea Houses.
Current: "**The full offering is proposed.**" and the table calling Overview, Build and Work "proposed"; line 195 row "`/tea-houses`, `/tea-houses/build`, `/tea-houses/work`, `/tea-houses/work/:slug` | proposed".
True now: built, behind `TEA_HOUSES_OPEN` (teaHouseRoutes.tsx:28-31), with the worker reads at worker/src/teaHouses.ts:334-336 and Adrian's Manage form (TeaHousePortfolioSection.tsx). Line 98 also says a host's own table "belongs in Your Table"; that is right.
Replace line 98 start with: "**Built behind `TEA_HOUSES_OPEN` (off).** Overview, Build, Work and each house's page, with Visit." and line 195 status with "`TEA_HOUSES_OPEN`".

M6. Line 194, route table.
Current: "(none) | `/tea-houses/visit` | built, no flag".
True now: behind `TEA_HOUSES_OPEN` (teaHouseRoutes.tsx:27). Line 109 of this file says so; this row contradicts it.
Replace with: "`TEA_HOUSES_OPEN`".

M7. Line 164 (Home) and 168 (phone menu), 206, 226-227.
Current: line 164 "Read from the code, it shows no people, no sessions and no shared tastings, and its four links still name the old sections. Proposed order: ..."; line 168 "Phone menu shrinks to ..."; line 206 "Changing keyboard destinations, section highlighting and navigation labels is still proposed."; lines 226-227 recommend "read, table, houses, shop" and "table" and "houses".
True now: with `HOME_BAR_OPEN` on, Home has the new opening lines (src/pages/home/HomeLaunchFour.tsx:34-40), the "Come to a table" door (HomeLaunchFour.tsx:54), "Host a table" (HomeV2Page.tsx:354), the latest-three strip from the Tea Table and a next-session strip, and the consult plate leading to Tea Houses (HomeLaunchFour.tsx:44-47). The phone menu, rail foot and keys 1 to 5 follow the words (SiteMenu.tsx, LeftSidebar.tsx, hooks/useSectionKeys.ts, all read `homeBarOpen`). Adrian answered on 2026-11-26; he then said he doubts "Tea table" and "Tea house" (src/lib/homeBar.ts:8-12).
Replace line 164 with "Built behind `HOME_BAR_OPEN` (off). With it on, Home says what this is and carries ..." and list the above; replace line 206 with "Built behind `HOME_BAR_OPEN`; the words are Adrian's to confirm."; replace lines 226-227 with the answer and the doubt.

M8. Lines 43 and 156, Favourites, and missing switches in the section map.
Current: nothing says that Know this tea, top teas, host articles, circles, tea credit, host key and the card for the table exist. SECTIONS describes only Launch 4's Tea Table, Houses, Your Table, Manage.
True now: Launch 5's parts sit in these sections: "Does anyone know this tea?" on the Tea Table (KNOW_THIS_TEA_OPEN); tea credit under Your Table, `/account/tea-credit`, and Manage, Sales, Waiting (HOST_CREDIT_OPEN); circles and the host's key on `/account/host` (CIRCLES_OPEN, HOST_TOKENS_OPEN); the printed card at `/admin/events/:slug/card` (TABLE_CARD_OPEN, src/admin/AdminApp.tsx:587); top teas on a host's page (TOP_TEAS_OPEN); article offers in Publish (HOST_ARTICLES_OPEN, src/admin/views/MagazineView.tsx:47).
Missing. Add a short "Launch 5 and the rest" section, one line per switch, with the opening order from todo/plans/guests-and-tea-masters-review-run.md, and add `/account/tea-credit`, `/account/host` and `/admin/events/:slug/card` rows to the route table at lines 175-204.

---------------------------------------------------------------------
docs/STATE_OF_THE_SITE.md
---------------------------------------------------------------------

S1. Lines 9-11, the Launch 5 paragraph. Same faults as P2 and P3.
Current: "it has worker routes and no screens yet (a separate build)" and "The first three also need `FEW_HOSTS_OPEN`."
True now: the credit screens exist (see P2) and only circles and the key need `FEW_HOSTS_OPEN` (see P3). `KNOW_THIS_TEA_OPEN` is missing (see P4).
Replace with the P2, P3 and P4 sentences.

S2. Missing: Launch 1 and Launch 4.
Current: the page has "Launch 5", "Launch 3" and "Launch 2" updates and nothing for Launch 1 (`FIRST_TABLE_OPEN`, on, live) or Launch 4.
True now: Launch 1 is live (src/lib/firstTable.ts:12): thank-you page with teas, playlist and the one reading, "Keep this tea", bought tea into the Tea Chest, and where a thank-you's order began. Launch 4 holds eight switches, all off: `TEA_TABLE_OPEN`, `FAVOURITES_OPEN`, `YOUR_TABLE_PAGE_OPEN`, `YOUR_TABLE_PLACE_OPEN`, `HOST_ARTICLES_OPEN`, `TOP_TEAS_OPEN`, `TEA_HOUSES_OPEN`, `HOME_BAR_OPEN`; with all of them closed each address answers as absent (worker/src/launch4Closed.ts:1-10).
Missing. Add a "Launch 1 and Launch 4 update, 2026-11-26" section with one line per switch and what it holds.

S3. Lines 1-5 and the scorecard (lines 53-65).
Current: banner "Marked 2026-11-25: stale. Verified 2026-08-10"; scorecard has no row for hosts, guests, the Tea Table or tea credit; the "Product boundary" list says "No social feed" with no word on the Tea Table exception.
True now: the banner is honest about the body. The scorecard row "Tea Masters" and the product boundary do not mention hosts, the Tea Table (Adrian confirmed the exception on 2026-11-26, per src/lib/knowThisTea.ts:13 and the Launch 4 run sheet) or the switches.
Replace with: add scorecard rows "Hosting: approved hosts, anyone, circles, key, card (Launches 2, 3, 5), all behind switches, closed", "Tea Table: built, closed (`TEA_TABLE_OPEN`)", "Tea credit: ledger and screens built, closed (`HOST_CREDIT_OPEN`)" and add to the boundary: "The Tea Table is the one public page that lists what people chose to put there, newest first; see CLAUDE.md."

---------------------------------------------------------------------
docs/CHANGELOG.md
---------------------------------------------------------------------

C1. Line 5 (Launch 5 entry, credit), and lines 6-9.
Current: "The host's and the owner's screens are a separate build." The entry does not name `CIRCLES_OPEN` (zero hits in the file for the constant), has no line for circles and series (migration 0146_session_series.sql) and none for "Does anyone know this tea?" (`KNOW_THIS_TEA_OPEN`, migration 0147_know_this_tea.sql).
True now: screens built (P2); circles and series, and Know this tea, are built and closed; line 8 says the journey walks "circles and series" without ever having said what they are.
Replace the sentence with: "The host's page (`/account/tea-credit`), the owner's section in Manage, Sales, Waiting and the checkout's use-credit tile read the same switch." Add a bullet: "**Circles and series** (`CIRCLES_OPEN`, migration 0146, also needs `FEW_HOSTS_OPEN`): a host names a table that meets again, or several sessions, and asks a guest of an earlier table back." Add a bullet: "**Does anyone know this tea?** (`KNOW_THIS_TEA_OPEN`, migration 0147, also needs `TEA_TABLE_OPEN`): ..." as in P4.

C2. Line 26 (Launch 4 branch, Visit).
Current: "**Visit (K5).** `/tea-houses/visit` has no dedicated flag."
True now: Visit is behind `TEA_HOUSES_OPEN` (src/pages/teaHouses/teaHouseRoutes.tsx:25-27). The entry at line 21 of the same file already says "Visit, behind `TEA_HOUSES_OPEN`", and the entry at line 15 says the switch covers the Visit list.
Replace with: "**Visit (K5).** `/tea-houses/visit` is behind `TEA_HOUSES_OPEN` with the rest of Tea Houses."

C3. Lines 19-30, missing Launch 4 parts.
Current: missing. No entry says the new bar, Home in full and Read's three shelves were built (`HOME_BAR_OPEN`, K7 and K10), none says a host can offer an article (`HOST_ARTICLES_OPEN`, migration 0139_host_article_offers.sql) or choose top teas (`TOP_TEAS_OPEN`, migration 0140_contributor_top_teas.sql). The constant names appear nowhere in the file.
True now: all three are built and off (src/lib/homeBar.ts:17, src/lib/hostArticles.ts:2, src/lib/topTeas.ts:3). docs/SITE_MAP.md:9 already has the `HOME_BAR_OPEN` paragraph to copy from.
Replace with: add three bullets under "Launch 4 branch" naming each switch, what it opens and its migration, copied from docs/SITE_MAP.md:9 and the run sheet.

---------------------------------------------------------------------
Side notes, not findings in these four files
---------------------------------------------------------------------
- CLAUDE.md line 146 still says the Tea Table exception is "not in force until he confirms the wording", while docs/SECTIONS.md:212 notes the run sheet records his yes and src/lib/knowThisTea.ts:13 says he confirmed it on 2026-11-26. The documents are consistent with each other; CLAUDE.md is the one to change, with Adrian's word.
- src/components/navSections.ts:57-60 says Visit is "the one Tea Houses page that is always there"; it is not (see P7).
