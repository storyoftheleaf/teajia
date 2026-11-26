# Launch 4, what happened becomes visible: the run sheet for Opus 5.5

**Status: ready to run where it is not waiting on Adrian, 2026-11-26.** Written by the Fable build thread from `main` at the Launch 1 ship (`234c312`) and from the three plans this launch rests on: [tea-table.md](tea-table.md), [tea-houses.md](tea-houses.md), [your-table.md](your-table.md), with the section map in [docs/SECTIONS.md](../../docs/SECTIONS.md). Those plans hold the detail; this sheet holds the order, the owners and the messages. It was read less deeply in the code than Launches 1 and 2, and each slice says what Opus should confirm before sending it.

**What a person can do when it launches.** They see what people chose to put on the Tea Table, newest first. They keep favourites of three kinds on one page. Their own table is a real page with an address. Tea houses have pages and a list to visit. Home says what this is and offers two doors. The bar reads read, table, houses, shop.

**Done when** the Tea Table has had something new on it each week for a month without Adrian writing it.

## This launch waits on Adrian more than any other. Say so plainly.

| His yes | Unlocks | Until then |
|---|---|---|
| **Q6, the Tea Table rule** | K1, K2, and Launch 5's "does anyone know this tea?" | **Answered yes on 2026-11-26.** The Tea Table is in force (see `CLAUDE.md`, "The Tea Table"), so every "after Q6" below now means "free to start". Further social parts (appreciation, replies, following a host) are not in these slices and wait for him to name them |
| **Q7, the four bar words** (read, table, houses, shop) | K7, and "table" and "houses" as words anywhere in navigation | Built on a branch only. No navigation component changes on `main` without his explicit yes |
| **Your Table as a page** (decision 1 in your-table.md) | K8 reaching people | Built on the branch behind its flag; his yes at the gate |
| **His facts about the tea house offering** (seven items in tea-houses.md, "What only Adrian can supply") | The Build and Work pages in K5 | Nothing is written for him. Visit is built; Build and Work wait |
| **Q11, may hosts offer articles** | K9 | Built on the branch; not switched on |
| **Three people for the first people articles** | K6's articles | Nobody's story is invented. Sonnet prepares questions, not prose |

## What can start today

| Slice | Why it is independent |
|---|---|
| K0, audit of sharing and taking back, read only | Reads `main`. Its findings decide how large K1's gates are |
| K3, favourites in three kinds, and the Tea Chest's three states | Own tables and one new page. Touches nothing hosting changes |
| K6, quiet acknowledgement lines and who pours on the people list | Wording on existing pages and one order rule in `worker/src/peopleList.ts` |
| K8, Your Table as a page | `src/components/AccountPanel/` and `/account` routes, Opus's own, behind a flag |
| K5 part one, the Visit list | A page over the network directory that `/spaces` and `/find-a-table` already read |

K1, K2, K4, K7, K9 wait as the table above says. K4 (tables and tea houses) also waits for Launch 2, which gives a host a saved place.

## The hard questions, settled

### 1. The Tea Table's first form is a rename, and its real work is the gates.

**Evidence.** `/tea-feed` (`src/pages/TeaFeedPage.tsx`) already lists published session recaps and public casual sits, newest first, through `src/components/sessions/SessionCards.tsx`, behind `BREWING_EXPERIENCES_OPEN = false`. tea-table.md stage 1 is that page under its name. Stage 2 is the hard part: consent of anyone pictured, deletion and export, limits, and withdrawal that clears every place a photograph is shown, including the file's own address.

**Recommendation.** Sol does stage 1 in a day once Q6 is a yes. Astra's K0 audit, started today, tells us which of the stage 2 gates already hold (Launch 1's guest book photographs are served through a revocable path, which suggests several do). Members' shared tastings join only after K0's findings are closed.

### 2. Hold at the top and the private keep are two small tables, and the counts are Adrian's alone.

Chosen by Adrian on 2026-11-26: a host, or Adrian for the whole table, may hold a piece at the top for a while by hand; anyone may keep a piece privately; the number of keeps is shown to nobody but Adrian in Manage. Recommend `tea_table_holds` (item, held by, until) and `tea_table_keeps` (user, item), with the count read only by one Manage route. A hold always has an end date, so nothing stays on top by being forgotten. Nothing rises by itself, and no keep count reaches any other browser. Opus builds; Astra proves the count cannot be read or inferred.

### 3. Favourites are three existing lists shown as one page, plus one new list for articles.

**Evidence.** `user_favorites` (a person's saved shop teas), `profile_favorites` (the teas shown on a person's public page, each with `is_public`), `saved_collections` (collections saved or received). Nothing holds a favourite article. The Tea Chest already has the three states under other names: a chest tea is private by default, `shelf_published` shows it, and a shelf offer puts it up for sale once Adrian has approved the person to sell (`worker/src/personalSellerApproval.ts`).

**Recommendation.** No merge of records, as your-table.md decision 5 says. One page, `/account/favourites`, with three headings: articles (new table `favourite_articles`), teas the shop has (`user_favorites`), and teas in your own chest (chest teas the person marked). Each private until shown. The chest's states get plain words, kept, shown, offered, on the existing controls. No counts anywhere.

### 4. A table is a saved place in the host's own account. A tea house is a public account. They never share a page.

Launch 2 gives each host saved places with a way in. "Add your table" names one of them as the host's table: private, shown to the public by area only (`area_hint`), never an address, never a pin. Tea houses are the public accounts of kind location that `/store/:slug`, `/spaces` and `/find-a-table` already list. Visit is one list of those. A table never appears in Visit. Astra proves it.

### 5. Home and the bar change in one commit, last.

SECTIONS.md stage 8: Home's full order, the bar, the rail, the phone menu and the keyboard keys in one change, `npm run test:mobile` before and after. It is Opus's, it is the only slice that edits navigation components, and it is built last so every door it adds leads somewhere finished.

## The contract (slice K-C)

Migration after Launch 3's. Columns and tables only, no existing row touched.

```sql
CREATE TABLE IF NOT EXISTS favourite_articles (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  article_id TEXT NOT NULL,
  is_public  INTEGER NOT NULL DEFAULT 0 CHECK (is_public IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, article_id)
);
ALTER TABLE personal_cellar_items ADD COLUMN favourite INTEGER NOT NULL DEFAULT 0 CHECK (favourite IN (0,1));

-- Only after Q6:
CREATE TABLE IF NOT EXISTS tea_table_holds (
  item_kind TEXT NOT NULL CHECK (item_kind IN ('recap','casual_sit','tasting')),
  item_id   TEXT NOT NULL,
  held_by   TEXT NOT NULL REFERENCES users(id),
  held_until TEXT NOT NULL,
  PRIMARY KEY (item_kind, item_id)
);
CREATE TABLE IF NOT EXISTS tea_table_keeps (
  user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_kind TEXT NOT NULL CHECK (item_kind IN ('recap','casual_sit','tasting')),
  item_id   TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, item_kind, item_id)
);
ALTER TABLE saved_locations ADD COLUMN is_host_table INTEGER NOT NULL DEFAULT 0 CHECK (is_host_table IN (0,1));
```

Flags, one per part so each can be switched on alone: `TEA_TABLE_OPEN` (replacing `BREWING_EXPERIENCES_OPEN`, which is renamed in the same commit as tea-table.md stage 1 says), `YOUR_TABLE_PAGE_OPEN`, `TEA_HOUSES_OPEN`, `FAVOURITES_OPEN`. Each in its own file under `src/lib/` in the style of `src/lib/firstTable.ts`. The favourites and Your Table parts of the contract can merge today; the Tea Table tables wait for Q6.

## The slices

| # | Slice | Owner | Starts | Needs |
|---|---|---|---|---|
| K0 | Audit: sharing and taking back, everywhere a shared thing can be seen | Astra, findings | **Today**, on `main` | |
| K-C | The contract, in two parts | Opus | Favourites part **today**; Tea Table part after Q6 | |
| K1 | The Tea Table under its name: `/tea-table`, three views, `/tea-feed` forwards; then shared tastings join | Sol; Opus for routes | After Q6 and K0 | Q6 |
| K2 | Hold at the top; the private keep; keep counts in Manage for Adrian only | Opus | After K1 | Q6 |
| K3 | Favourites in three kinds on one page; the chest's three states in plain words | Sol | **Today** | |
| K4 | "Add your table", private, shown by area only | Opus | After Launch 2 | |
| K5 | Tea houses: Visit (today), then Overview, Build and Work | Sol for pages, Opus for routes and forwards | Visit **today**; the rest after his facts | His seven facts; his yes to "Tea Houses" as the page title |
| K6 | Quiet acknowledgement ("photograph by", "poured with", the word Adrian grants); who pours on the people list; questions for the first three people articles | Sol; Sonnet for the questions | **Today** | Three people, named by him |
| K7 | Home in full, then the bar, rail, phone menu and keyboard keys in one change | Opus | Last | Q7, explicitly |
| K8 | Your Table as a page at `/account`; one copy of each view; share lines on journal tastings | Opus | **Today** | His yes at the gate |
| K9 | A host offers an article; Adrian edits and decides | Sol | After Launch 2 | Q11 |
| K10 | Read's three shelves: one row of three shelf names on `/read`, `/craft`, `/wisdom` | Sol | With K7 | Q7 |
| K11 | Agent tools | Sonnet | After K2, K3 | |
| K12 | Browser journey, by a helper that built none of it | Sonnet | Last | |
| A4 | Audit: keep counts unreadable, a private table never beyond its area, a withdrawn item gone from every place | Astra, findings | After K2, K4 | |
| K13 | Truth-up: the pillar's "no feed" and "not a social network" lines, `docs/SITE_MAP`, the rule wording in the files SECTIONS.md lists | Opus | Same commit as K1 and K7 ship | |
| K14 | Scores are personal, words are shared: an audit of every place a score, star count or average of a tea is shown to anyone but its giver, then those are taken off public pages; chosen words on a tea's page, placed by hand with the writer's yes (the existing tasting excerpts path); a tea master's top teas on their page, shape to be picked by Adrian | Astra audits read-only **today**; Sol builds after | Audit today | The shape of top teas |

### Tea Houses as a portfolio (Adrian, 2026-11-26)

"They are not just like tea house facts. They are portfolio in what I contributed in them." This reshapes K5's Overview, Build and Work.

- **A house's page leads with Adrian's part in it,** not with the place's particulars: what he did there (the room and its layout, the teaware, the tea menu, training the people who pour, the opening sessions, the sourcing since), in his words, with photographs. Each part is shown only where it is true for that house.
- **Work is the portfolio:** the houses in the order he chooses by hand, each opening to that page. No counts, no ranking.
- **Build is the same list of parts turned into an offer:** "this is what I can do for your room", each part pointing at a house where he did it.
- **Visit stays practical** (where you can sit down and who pours there) and links to the portfolio page when a house has one. A house he did not work on can be in Visit without a portfolio page.
- **Content:** nothing is invented. Per house the builder needs from him: which parts he did, one or two sentences on each, and photographs. A simple form in Manage, Settings or Publish, lets him say it by voice or type it, house by house. Until a house has his words it shows only in Visit.
- **Contract:** one table of contributions per house (house, kind of part, his words, photographs, order), owned by the account that is Adrian's, readable publicly only when he marks the house's page shown.

## The messages to send

Each ends with the standing rules block from the Launch 2 run sheet; paste it in full. Each worker branches from `build/launch-4` and opens its pull request into `build/launch-4`, never `main`. For every slice not written out here, Opus writes the message from this sheet and the named plan in the same seven-part shape, once its "Needs" is met.

### Astra, K0: sharing and taking back (findings, today)

```
Repository storyoftheleaf/teajia, branch main. Read only. Findings with a failing test or exact reproduction each. Do not fix.

Teajia is about to show, on one public page in time order, things people chose to share: tastings with their words and photographs, and published recaps of sessions. Before it does, prove or break each of these on what exists today.

1. Every place a shared tasting can be seen now (a person's page /people/:slug, a tea's page, Home's approved quotes, any agent tool, any public route), and for each, which stored field makes it visible (member_tasting_shares.share_state and others). List them all.
2. "Remove from my page": after it, is the item gone from every place in 1, including cached answers, and for how long can a cached copy still serve it.
3. Photographs: for each kind (family photographs, guest book photographs, private sit photographs, recap photographs), where the file lives, whether its address can be fetched directly by someone not allowed to see it, and whether withdrawal removes or revokes the file itself. worker/src/revocableSitPhotos.ts, worker/src/familyMedia.ts and worker/src/sessionGuestBookPhotos.ts are the starting points.
4. A person pictured in someone else's photograph who asked not to be (the RSVP's photo_consent, event_consents): does anything stop that photograph being shared or published.
5. Things shared before today, under the older wording "Share to my page": can they be told apart from things shared after a wording change, by a stored date or state, so that older shares are not shown on a new page without being shared again.
6. Account deletion: what remains visible of a deleted person's tastings, photographs, guest book notes and recaps.
7. The owner's one-tap hide and the report line (family_reports): do they cover every kind of item in 1, and does a hidden item stay hidden in every place.
8. The score on a tasting must never be public. Find any public answer that carries it.
9. /tea-feed today (src/pages/TeaFeedPage.tsx, src/components/sessions/SessionCards.tsx, src/lib/brewingExperiences.ts): exactly what it lists, from which routes, and what brewingConsent gates.

Return: numbered findings with severity (visible after withdrawal, visible without consent, or cosmetic), the evidence, and one line of proof for each item that holds.
```

### Sol, K3: favourites in three kinds

```
Repository storyoftheleaf/teajia. Branch from build/launch-4 as build/l4-k3-favourites; pull request into build/launch-4, never main.

Goal: a person finds everything they have marked in one place, under three headings: articles, teas the shop has, and teas in their own Tea Chest. Each is private until they choose to show it.

What exists: user_favorites (a person's saved shop teas; find its routes and the heart control that writes it), profile_favorites (teas shown on a person's public page, with is_public; src/pages/ProfileFavoritesPage.tsx), saved_collections (collections saved or received). New: table favourite_articles (user_id, article_id, is_public) and column personal_cellar_items.favourite (0 or 1). The routes for the two new ones are wired by the build owner: GET /api/me/favourites (all three kinds in one answer), PUT and DELETE /api/me/favourites/articles/:id, PUT /api/me/cellar/:id/favourite.

Approved behaviour:
- Page src/pages/FavouritesPage.tsx at /account/favourites. Three headings, each shown only when it has something: "Articles", "Teas at the shop", "Teas in my Tea Chest". Each item opens the thing itself. Each can be taken off with one tap. An empty page says one plain sentence and links to Read and the shop.
- On an article page, one quiet control "Keep" / "Kept", signed in only; signed out it leads to sign in and back.
- On a chest tea (src/components/AccountPanel/CellarView.tsx), one quiet control to mark it a favourite.
- The records stay separate. Do not copy rows between the lists and do not change what the existing heart control does.
- The Tea Chest's three states in plain words on the controls that already exist: "Kept" (private, the default), "Shown" (shelf_published), "Offered" (a shelf offer; only for a person approved to sell, exactly as today). Change words only; do not change what any control does or who may use it.
- No counts of any kind. Nobody learns how many people kept a thing.

You own: src/pages/FavouritesPage.tsx, the Keep control on the article page, the favourite control and the three words in CellarView.tsx, tests/favourites.spec.ts.
Do not touch: worker/, src/lib/api.ts, src/App.tsx, the account panel's tiles or labels, src/pages/ProfileFavoritesPage.tsx.

Acceptance check: tests/favourites.spec.ts at 390 by 844 with mocked routes: each heading appears only when it has items; an article is kept and taken off; a chest tea is marked; no counts anywhere on the page. npm run test:mobile, since CellarView is under src/components/AccountPanel/.

Then the standing rules. Report back: the branch, what you ran, the api.ts lines you need.
```

### Sol, K5 part one: places to visit

```
Repository storyoftheleaf/teajia. Branch from build/launch-4 as build/l4-k5-visit; pull request into build/launch-4, never main.

Goal: one list of tea houses a person can sit down at, each opening its own page, with who pours there.

What exists: two pages over the same network directory, /spaces and /find-a-table, and a house's own page at /store/:slug. Read both pages and the route they call before writing anything.

Approved behaviour:
- Page src/pages/TeaHousesVisitPage.tsx, to be served at /tea-houses/visit (the route and the forwards from /spaces and /find-a-table are added by the build owner; do not edit src/App.tsx).
- One list from the existing directory route: each house's name, where it is (city and country), one photograph when it has one, and its coming session when there is one. Each opens /store/:slug. Where the directory says "table", this page says "house".
- Only public accounts that chose to be listed, exactly as the directory decides today. A private table never appears here; do not add any other source.
- Empty: one plain sentence, and a link to the sessions list.
- No map with pins, no distance sorting, no "near you".

You own: src/pages/TeaHousesVisitPage.tsx, tests/tea-houses-visit.spec.ts.
Do not touch: worker/, src/App.tsx, src/lib/api.ts, the two existing pages, any navigation.

Acceptance check: the spec, with a mocked directory of three houses and of none, at 390 by 844; no horizontal overflow.

Then the standing rules. Report back: the branch, what you ran, and the exact directory route and fields you read.
```

### Sol, K6: quiet acknowledgement

```
Repository storyoftheleaf/teajia. Branch from build/launch-4 as build/l4-k6-acknowledge; pull request into build/launch-4, never main.

Goal: people who give to the tables are acknowledged only through things one person gives another, in words, where the thing itself is shown.

The rule, from CLAUDE.md: acknowledgement is a host's thank-you, being quoted by name, "photograph by", "poured with", and the word on a page that Adrian grants by hand. No numbers, no levels, no titles for volume, nothing automatic, nothing that nudges.

Approved behaviour:
- Wherever a shared photograph is shown large (find the shared Photographs component and the guest book and family photograph views), the line "photograph by <first name>" when the taker allowed their name. Nothing when they did not.
- On a published session recap (src/pages/EventRecapPage.tsx), "Poured with <name>, <name>" from the session's co-hosts and guest hosts, each linking their page when it is published.
- On a person's page, the word Adrian granted, where one exists, shown once beneath their name exactly as stored. Find where the family page's granted kind is stored and shown today (worker/src/familyPages.ts) and do not add a new way to grant it.
- The people list (worker/src/peopleList.ts decides its order; read its header comment): the build owner adds "who pours" as data. Show it as the plain words "Pours at tables" beneath a name. No count of sessions, no badge, no icon that scales with activity.
- Nothing in this slice writes to the database, sends anything, or computes a total.

You own: the three lines above in their existing components, the words on the people list item, tests/acknowledgement.spec.ts.
Do not touch: worker/, src/lib/api.ts, the order of the people list, any navigation.

Acceptance check: the spec proves each line appears only when its data is present, and that no number appears beside any person on the people list or a person's page.

Then the standing rules. Report back: the branch, what you ran, and every component you changed.
```

K8 is Opus's own: follow your-table.md "Build stages" 1 to 3 on the branch behind `YOUR_TABLE_PAGE_OPEN`, with `npm run test:mobile` before and after and a walk signed out, as a member, and as someone with a Manage room. Stage 4 (retiring the panel) waits until the page has been live for a week.

## The journey Opus runs last

1. **Signed out, on a phone,** open Home. One sentence, two doors, and only the strips that have something real.
2. **Open the Tea Table.** Recaps and shared tastings, newest first, grouped by day. No likes, counts or comments anywhere. "Earlier" is a step: back returns to where you were.
3. **As a member,** share a tasting "to my page and the Tea Table". It is on both. Take it off your page: it is off both, and its photograph's own address no longer opens.
4. **Keep a piece.** It is in your favourites. Nothing on the Tea Table changed for anyone else.
5. **As a host,** hold your session's recap at the top for three days. It is first. After the date it is back in time order by itself.
6. **As Adrian in Manage,** see keep counts. Signed in as anyone else, prove no route returns them.
7. **Favourites.** One page, three headings, each item opening the thing itself.
8. **Your Table** opens at `/account` as a page. Back leaves it. Every tile keeps its word.
9. **Tea houses.** Visit lists public houses only. The host's private table from Launch 2 is not there, and a search of every public answer for its address finds nothing.
10. **The bar** reads read, table, houses, shop on the phone and the rail, and keys 1 to 5 follow. `npm run test:mobile` passes.
11. **Each flag off, one at a time.** The site looks as it did after Launch 3 for that part.
