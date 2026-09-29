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

## Step 2: the seven-room column (shipped 2026-09-29)

- Column: Curate, Stock, Sales, People, Sessions, Publish, Settings. Today behind the Manage heading; its row goes.
- Curate becomes the first room (it is already the phone bar's first word for every role).
- Publish is a parent over Magazine, Collections, Tasting Notes (to be "Guest notes"), Wisdom, Tea Masters.
- Network, Members and Tea Atlas leave the column: Network's tabs are reached from Curate and Sales until step 4; Members is a Settings door; the Atlas stays in Your Table and the site menu.
- Phone bar: shop owner curate, stock, sales, sessions; staff curate, sales, sessions, people; member curate, samples, sessions, publish.
- Rooms still point at the existing screens; nothing merges yet.
- Gates: a room shows when any of its tabs would show. Settings must show for the members bundle alone, or an access manager loses their only screen.
- Tests that pin words or placement change in the same commit: `manageNav.oneWord.test.ts`, the Atlas placement test, `LeftSidebar.access.test.ts`, the navigation gates test, `tests/site-menu.spec.ts`. PILLAR.md and the CLAUDE.md layout section change in the same commit.

## Step 3: Your Table tiles (shipped 2026-09-29)

- remember takes in "shared with you" collections as a second section; the collections tile goes.
- samples moves into orders as "samples sent to you".
- account folds into profile: the tile opens name, sign-in and appearance (retitled Profile), which links to the public Tea Master profile only for someone who has one or may start one, so a customer is never sent to a page that refuses them.
- walk-throughs becomes a link inside library (platform owner only).
- "What needs you" is one line under the day sentence, opening Today (or Sales for someone whose Manage does not open on Today).
- Kept, deliberately: discover stays a tile. The plan cut it for members as living in the site panel, but the site panel has no discover row, so cutting it would have removed its only door.

## Step 4: merge the doubles (built 2026-09-29)

What shipped: Sales is Waiting, Orders, Wholesale, Ledger; People is Customers, Suppliers, Tags; People's Team tab and the deprecated TeamView are gone (Members does it); Audit is a Settings screen at /admin/audit; Purchases is a Curate screen at /admin/purchase-orders; Capture is Stock's Drafts; Network lost its essay and its Wholesale tab; Settings has an Adoptions door for platform staff. Every old address forwards, held by tests/manage-regroup.spec.ts.

Moved to step 5, deliberately: Samples becoming a real Curate tab rather than the full-screen workspace it opens today, and the Library filter and Ledger split inside Curate, because both rework the Curate header that step 5 folds anyway. Tags stay a People tab rather than inline in Customers until inline tag editing exists.

The original plan for this step:

- People's Team tab merges into Members; People's Audit moves to Settings as Record.
- Sales: Pending and Inquiries become Waiting; Ledger and Log become one Ledger with a filter; Wholesale moves in from Network.
- Curate gains Samples (the full-screen pop-up becomes a tab, batches a view inside it), Purchases (from People's Purchase Orders and Curate's Ledger), and Network (Catalog, Suggestions, Carry from network).
- Capture becomes Stock's Drafts view, keeping "Activate". Tea Glossary becomes Stock's Glossary view.
- Network's Adoptions and the platform screens move under Settings > Platform. Network's intro essay goes.
- Sources becomes Suppliers. Do not merge the suppliers table with contacts tagged "vendor"; show them side by side and decide later.
- Every retired address keeps forwarding; old `?tab=` names stay as aliases (the dashboard, Your Table rows, the briefing page and the stale-rates banner link with them).

## Step 5: fold the heavy screens (built 2026-09-29)

What shipped: Stock's selection rail shows Edit, Publish, Invoice, Archive and a More that opens the other eight in place; Stock's top row lost Glossary, Vendor and Edit to the More menu (Edit table, Glossary view; a vendor is found through search, which already suggests sources); Curate's Samples button reads as the fourth screen beside Source, Library and Ledger.

Kept, deliberately, and why:
- Stock's views stay All, Working, Samples, Personal with Flagged for the rest. Those four are the purpose views the page is built and tested around; swapping them for All, Drafts, Low stock, Incoming would change what Stock is for, which is a taste call, not a fold. Drafts already has its own door under Stock.
- Sort, Group, Columns and Price stay four short words on a laptop (the phone already folds them into one Adjust sheet). They are the table's working controls; one more click on each costs more than four words.
- The currency stays in the top row: it says which currency every price on the page is in.
- Curate's Source keeps Tea, Teaware, Import as its three small tabs.
- The Library filter panel keeps every group open. A test holds that every filter is visible when it opens, a decision made earlier; collapsing groups would reverse it.

The original plan for this step:

- Stock: toolbar is search, Tea/Wares and Add (menu: new tea, import file, bulk intake); the rest in one More menu. Views: All, Drafts, Low stock, Incoming, with the other eleven behind a Views menu. Sort, group, columns and price behind one View control. Selected tea: Edit, Publish, Invoice, Archive, More.
- Curate: Source is one form with a Tea/Teaware switch and a "from file" link; the Library filter sheet opens with its first group, the rest folded.
- Keep the InventoryView height chain intact (CLAUDE.md) and browser-test the Stock scroll at both widths.

Curate stays separate from Stock: the pillar keeps Journal, Favourites, Cellar and Curate apart.
