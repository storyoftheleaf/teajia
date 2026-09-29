# Manage regrouped: seven rooms named for the job

Adrian could not find his way around Manage and Your Table: about 80 destinations,
the same thing in two or three rooms, six screens with no door, and words that
meant one thing in Your Table and another in Manage. The audit and the proposal
are on one page: [Manage Regrouped](https://claude.ai/artifact/9bMA6ocRdeoNd7u5EkxM2M).

## Decided (2026-09-29, Adrian: "yes, go with all four names")

- The Manage room Orders is **Sales**. "orders" means only what a person bought, in Your Table.
- Events is **Sessions** everywhere.
- **Publish** is the room that will hold Magazine, Collections, Guest notes, Wisdom and Masters.
- Your Table's "steep" is **journal**.
- The seven rooms: Curate, Stock, Sales, People, Sessions, Publish, Settings, with Today
  (the current Dashboard) opened from the word Manage at the top of the column.

## Step 1: words and doors (shipped 2026-09-29)

Sales and Sessions in the column, the phone bar and their page headings; Settings has one
name and doors to Members, Agents, Rates and Platform; Sessions has doors to Tastings and
Venues on every width; the standalone tags page forwards to People's Tags tab; Your Table
says journal and "Switch table"; the switcher card's Shop / Sessions / Ops links are cut.

## Step 2: the seven-room column (about a day)

- Column: Curate, Stock, Sales, People, Sessions, Publish, Settings. Today behind the Manage heading; its row goes.
- Curate becomes the first room (it is already the phone bar's first word for every role).
- Publish is a parent over Magazine, Collections, Tasting Notes (to be "Guest notes"), Wisdom, Tea Masters.
- Network, Members and Tea Atlas leave the column: Network's tabs are reached from Curate and Sales until step 4; Members is a Settings door; the Atlas stays in Your Table and the site menu.
- Phone bar: shop owner curate, stock, sales, sessions; staff curate, sales, sessions, people; member curate, samples, sessions, publish.
- Rooms still point at the existing screens; nothing merges yet.
- Gates: a room shows when any of its tabs would show. Settings must show for the members bundle alone, or an access manager loses their only screen.
- Tests that pin words or placement change in the same commit: `manageNav.oneWord.test.ts`, the Atlas placement test, `LeftSidebar.access.test.ts`, the navigation gates test, `tests/site-menu.spec.ts`. PILLAR.md and the CLAUDE.md layout section change in the same commit.

## Step 3: Your Table tiles (about a day)

- remember takes in "shared with you" collections as a second section; the collections tile goes.
- samples moves into orders as "samples sent to you".
- account folds into profile (public profile, sign-in, appearance, payment access, delete).
- walk-throughs becomes a section of library (platform owner only).
- "What needs you" becomes one line linking to Today.

## Step 4: merge the doubles (2 to 3 days)

- People's Team tab merges into Members; People's Audit moves to Settings as Record.
- Sales: Pending and Inquiries become Waiting; Ledger and Log become one Ledger with a filter; Wholesale moves in from Network.
- Curate gains Samples (the full-screen pop-up becomes a tab, batches a view inside it), Purchases (from People's Purchase Orders and Curate's Ledger), and Network (Catalog, Suggestions, Carry from network).
- Capture becomes Stock's Drafts view, keeping "Activate". Tea Glossary becomes Stock's Glossary view.
- Network's Adoptions and the platform screens move under Settings > Platform. Network's intro essay goes.
- Sources becomes Suppliers. Do not merge the suppliers table with contacts tagged "vendor"; show them side by side and decide later.
- Every retired address keeps forwarding; old `?tab=` names stay as aliases (the dashboard, Your Table rows, the briefing page and the stale-rates banner link with them).

## Step 5: fold the heavy screens (2 to 3 days)

- Stock: toolbar is search, Tea/Wares and Add (menu: new tea, import file, bulk intake); the rest in one More menu. Views: All, Drafts, Low stock, Incoming, with the other eleven behind a Views menu. Sort, group, columns and price behind one View control. Selected tea: Edit, Publish, Invoice, Archive, More.
- Curate: Source is one form with a Tea/Teaware switch and a "from file" link; the Library filter sheet opens with its first group, the rest folded.
- Keep the InventoryView height chain intact (CLAUDE.md) and browser-test the Stock scroll at both widths.

Curate stays separate from Stock: the pillar keeps Journal, Favourites, Cellar and Curate apart.
