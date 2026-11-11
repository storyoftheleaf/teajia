# Manage rebuild: audit findings, rules, state and how to resume

> Written 2026-11-11 by the manager session so any later session can continue without the original conversation. The full report, with screenshots, diagrams and the owner's questions, is the doc **Teajia Manage: audit and rebuild plan**: https://claude.ai/artifact/YBTipCxwkRVTbKPiahXcrr. Read that doc before starting a wave. This file is the working state: what is decided, what landed, what is next, and how workers are run.

## The goal, in Adrian's words

Simpler, better-looking screens across Manage (Curate, Library, Stock, Purchases, Sales, People, Sessions, Publish, Today) that are finished and interconnected, **without losing any function**. "Ideally we are staying functional even if we are making things less complicated."

## Standing instructions from Adrian (2026-11-11)

1. **No function is removed.** Every one of the 35 at-risk functions has a home (see "Nothing lost" below and in the doc). A builder who cannot place a function says so before merging, and the old screen stays until it has a home.
2. **Anything that changes how a screen looks needs Adrian's approval**, shown as before and after pictures. Invisible fixes (access, money, broken links) may land on the working branch without him.
3. **Rebuilt rooms are new versions beside the old ones**, at their own address. Adrian switches when he is happy. The old room stays reachable ("classic") until he says retire. Nothing is deleted during clean-up.
4. **Recovery point:** commit `936bf53` (2026-11-09) is the code exactly as it was live before any of this work.
5. **The tasting interface is not to be stripped.** He likes how it works. Tighten only. A line-by-line pass comes before any builder touches it, and its only output is a tightening list for him to approve. That pass is done: [tasting-tighten.md](tasting-tighten.md) (40 items, 7 questions, and a list of what to leave exactly alone).
6. **Lists are grouped, never one long run.** Supplier by default, with State, Type, Date, Trip or None as choices. Group headers fold and show counts and what needs attention.
7. **What he does all day is one tap, on the card, without opening the tea:** name it, change the price, Photo, Voice note, Taste, Order with its quantity. The first line of a card is the name: his name if it has one (supplier's name beneath), otherwise the supplier's name, and tapping it lets him name it. No separate naming button.
8. **No second bar pinned to the bottom.** The site's bottom bar stays the only one. Opening a tea keeps its card at the top. Search, "+ Tea" and the job chips (To taste, To price, To name, In order) sit at the top of the list. Keep the job chips.
9. **Freight:** the 85 yuan shop rate covers air freight plus the Bali leg. A supplier invoice's shipping is the earlier leg (to the forwarder), so adding both is right. He will hand freight bills to an agent, which files them and corrects the rates. Open question 13 below: whether the shop rate itself may change without his yes.
10. **Sandbox:** he cannot refresh the sandbox database on request right now. Until he can, workers prove changes with tests only, and nobody has clicked through with real data.
11. **Work runs as a manager with scoped sub-threads on right-sized models** (see "How the work runs").
12. Never use em dashes in anything written for him.

## What the audit found (five root causes)

1. **One tea is two records.** `tea_compass_entries` and `products` are joined by two soft pointers (`draft_product_id`, `products.source_compass_entry_id`). Nine fields are copied between them; only the given name is kept in step (triggers, migration `0048`).
2. **Curate exists twice.** `src/components/TeaCompass/` (live at `/admin/compass`) and `src/components/CurateV2/` (at `/admin/compass/v2`) share one store and import each other. About 15,300 duplicated lines. `todo/plans/curate-one-home.md` has the right goal and the wrong mechanism (new mounts old; they are now a loop). Target: one Curate built as a new version in a neutral folder (`src/components/curate/`), new Curate's calm and units, old Curate's supplier sections and functions.
3. **No shared kit.** Eight tab styles, six page-title treatments, 2,844 raw buttons against 14 uses of the shared one. Target kit: `Modal`, `BottomSheet`, `ConfirmDialog`, `Toast`, `AdminPage` + header, `Tabs`, `Button`, `Field`, `SearchInput`, `AnchoredMenu`, `StatusPill`, `EmptyState`, `Money`, a date formatter, plus one tea card and one record panel.
4. **State in the wrong places.** Screen state not in the URL; purchase drafts device-local (`src/lib/ledgerStore.ts`, key `teajia-ledger`); Curate sync sends whole records, last write wins (`src/lib/teaCompassSync.ts`); "published" is three switches (`status='Active'`, `is_public`, `shown_in_shop`).
5. **Grown outward, never finished inward.** About 101 files with no importer; `InventoryView.tsx` 3,492 lines; `worker/src/index.ts` 30,783 lines.

**Buying, freight and logistics** (see the doc section of that name): an order placed in the browser has no receipt lines until matched by hand ("Needs attention: items need matching", `worker/src/purchaseTracking.ts:20`); two tracking systems on one order ("In process" vs Purchases); only Purchases knows where a tea is; the forwarder's real bill is split per line for display only and never reaches the tea's cost, the shop rate, or the routes; three different freight estimates for one order, none saved from the browser; the same forwarder's rates kept twice (`shipping_routes` in Settings, `logistics_services` in Purchases). Design: one order, one journey, one freight truth (ten points in the doc).

## State of the fix-first list (30 items)

Numbering follows the doc. **Landed** means on branch `claude/zen-ptolemy-xwqdha` (20 commits after `936bf53`), not on main.

| # | Item | State |
| --- | --- | --- |
| 1 | Public order request must respect the three publication gates | Landed |
| 2 | Client could repoint `draft_product_id` and rename any product | Landed (`keepServerDraftProductLink`; catalogue editors may give a first link to a product no Curate tea was made into, which is "Develop in Curate") |
| 3 | Promote and receipt proposal lacked a capability gate | Landed (promote: `catalog`; proposal: `stock` or `catalog`) |
| 4 | Stale browser overwrites newer work (whole-record sync, no version) | **Open, invisible.** Design first (wave 2), then build |
| 5 | Arrival acceptance crashed on the unique index | Landed |
| 6 | "Published N items" can be untrue (sets one gate of three) | Open, visible: needs approval |
| 7 | Shift-select in Stock picked hidden rows | Landed |
| 8 | Library quote shows converted money but edits the source number | Open, visible |
| 9 | Unknown per-gram price prints 0.0 (PILLAR documents it) | Open, visible; PILLAR to amend |
| 10 | Unrecorded currency labelled USD, becomes Yuan on load | Open, careful (money rule) |
| 11 | Old Curate stamps a default cake weight (357 g) at capture | Open, changes capture behaviour |
| 12 | Three purchase-confirm sequences (old Curate, new Curate, buying basket) | Open, money path: one `placePurchase()` |
| 13 | Sample graduation copies quote into cost and notes into public description | Open, needs design |
| 14 | Teaware read as sold out (grams instead of units) | Landed |
| 15 | Untyped tea becomes "Misc" and is treated as teaware | Open, needs decision |
| 16 | Merging two Curate teas leaves the product on the loser | Open, invisible; must respect `curate_undo` |
| 17 | Product delete left dangling Curate links | Landed |
| 18 | Every save blocked publishing | Landed |
| 19 | `/admin/orders` and other redirects dropped the query | Landed (`src/admin/carryQuery.ts`, all 22 redirects) |
| 20 | `/admin/stock?search=` read by nothing | Landed (`?panel=<id>`; `?search=` now seeds the box) |
| 21 | Website request shows twice in Waiting | Open, visible |
| 22 | Customer order amounts blank (`total` vs `computed_total`) | Landed |
| 23 | Money mislabelled ("$120.00 NT"; cross-currency sums) | Open, visible |
| 24 | Session cannot be completed in the browser | Open, visible (lifecycle buttons) |
| 25 | Draft/private sessions shown on a tea's public page | Landed |
| 26 | Closing RSVPs sent guests to the after-event screen | Landed |
| 27 | Journey "Delete my data" deletes nothing | Open, visible (remove button until real deletion exists) |
| 28 | "In process" lost orders with expected lines | Landed (`ordered` added; `pending` deliberately left out, see `src/components/shared/inProcessStatus.ts`) |
| 29 | Old Receive buttons dead-end on forwarder-managed purchases | Open, visible |
| 30 | Landed cost hidden by a currency spelling | Landed |

Found by the link guard on 2026-11-11 and still open (each is allow-listed in `src/admin/guards/adminLinkReaders.test.ts`, which fails the day a reader exists so the list can only shrink):

| # | Link that nothing reads | Written at |
| --- | --- | --- |
| 31 | `/admin/events?search=` lands on the full Sessions list (the fallback when an order has no session id) | `src/admin/components/OrdersView.tsx` |
| 32 | `/admin/catalog?search=` lands on the whole catalogue for a non-platform account | `src/admin/components/SoldItemsView.tsx` |
| 33 | `/admin/compass?fromSample=` is read by neither Curate | `src/pages/SamplePage.tsx` |

Guards now in `src/admin/guards/` (wave 2): every admin link with a query has a reader; ceilings that may fall but not rise (raw buttons, browser dialogs, `z-50`, inline styles, `Number(x) || 0`, files over 1,500 lines); no new files in `TeaCompass/` or `CurateV2/`; every Manage room resolves to one real screen.

Also landed, unnumbered: Curate's supplier link (`/admin/people/<id>`), an order's session link (`/admin/events/<id>`).

## Checks, and what fails before any change

Run from the repo root: `npm run lint` (tsc), `npm run lint:colors`, `npm run lint:worker-types`, `npm run test:src`, `npm run test:worker`.

Known failures on the untouched baseline `936bf53` **in the cloud container** (not caused by this work):
- 23 worker tests need the `sqlite3` command-line tool (`spawnSync sqlite3 ENOENT`): migration rehearsals.
- `worker/tests/curate-holdings-read-budget.test.ts`: 30,207 against a limit of 30,000.
- Browser: `tests/inventory-incoming.spec.ts` (2 tests) and `tests/inventory-row-usability.spec.ts` at 375 px on Desktop Chrome. Cause not found.

Browser tests in the cloud container: the repo pins a Playwright build whose browser is not installed. Use a config with `use.launchOptions.executablePath = '/opt/pw-browsers/chromium'`, `testDir` pointing at `tests/`, and `webServer` running `npm run dev:test` (port 7777). Only one thread may run the dev server; workers are told not to.

## Nothing lost: where each function lives

Full table with "what has to be built" is in the doc. Short form, as acceptance rows:

1. Two shop gates (staff "In Shop", owner "Shown/Held"): one Shop chip with two ticks; both permissions stay.
2. Type down a column in Stock on a laptop ("Edit table"): stays.
3. Long-press strip on a Stock row: stays on laptop; pills on the phone card.
4. Stock's finer money controls: one "Price and freight" sheet (cost, freight follow/custom/zero with breakdown, retail computed/override/whole pieces).
5. Bulk actions in Stock incl. un-publish, statuses, Featured, Personal, Can reorder: selection bar at both widths.
6. Drafts: a saved view in Stock with Ready / To review and "Activate N ready".
7. Everything on both customer screens: one customer record in sections.
8. Tastings (join code, per-tea rating during the pour, live grid, guest journal, quick tasting): all stay, attached to a session.
9. QR table card: stays; guests' verdicts shown on the tea (`api.compass.entryFeedback` exists, unused).
10. Close and filter a website inquiry: one card per request, Closed filter.
11. Both reminder jobs on a session: one Messages tab, two sections; edits saved.
12. Quick Note, Quick Sale, Purchase Order Builder: under "+" in Curate's Orders.
13. One ranked list across suppliers: "Group: None".
14. Edit supplier's name, year, type on the card: in place.
15. Reject with reason, 9 s Undo, Rejected list with Restore.
16. Sample as a third answer; "add to sample list".
17. Purchase purpose and how acquired: in the order step.
18. Scan a label: Photo offers "Scan label" or "Photo".
19. Teaware capture and its fields.
20. Fifteen filters: behind "Filter" beside the job chips.
21. Trip, visit, run: Identity row; Trip grouping; the Table tab.
22. Photos grid; crop, rotate, delete.
23. Share a tea; incoming shares on Today.
24. Order extras: supplier message, PDF, tags, mark sent, photos, delete, spend overview (reachable on phone).
25. Restock / "buy again": a Reorder pill.
26. Publish a starred tasting note: through Publish > Guest notes (`TastingNoteReviewQueue` exists, unmounted).
27. Hui Gan, Tang Gan, Qi, Yun, "opens up", "chest reach": wire the unused setter (`src/components/tasting/tasteQualityState.ts`).
28. Complete a session (lifecycle buttons); invoice drafts optional and fixed.
29. Supplier extras (wanted-not-bought, timeline, flavour profile, best value, link/unlink, photos, map): onto the supplier page.
30. "Saved" confirmation in Stock edit mode.
31. Stock on a phone by supplier: finish `todo/plans/stock-phone-by-supplier.md` stages 4 and 5.
32. Change a saved tea's supplier, trip, storage, teaware details: Identity rows editable.
33. Sample list, Stock listing, queue reachable on a phone in new Curate.
34. "Taste this next": starring pins a tea to the top of To taste.
35. Other shops' reviews, brewing QR label, guest passport, save a Stock view.

Kept as they are: search (add given name), shelf-price line, display-currency picker, duplicate warning, Chinese-name and name suggestions, price/weight detection in notes, gram presets, storage chips, "what you said" filing, sample grams used, review pass, delete a tea, files and undo, sync retry, recovery file.

## Questions waiting for Adrian (in the doc, with context and a dropdown each)

4 One Curate as a new version shaped like the sketch. 5 An address for every record. 6 One word per thing (Supplier; Request then Order; Sent; Chosen/Rejected; "Orders" for Curate's buying tab; shop states Private, Ready, In the shop, Held, Sold out). 7 Drafts becomes a view inside Stock. 8 Stock shows his name first. 9 Readiness blocks publishing (name, type, price, counted stock). 10 Sold out always behaves the same. 11 Tastings attach to a session; PILLAR's "no live tasting mode" reworded. 12 Placing an order creates each tea's private Stock draft. 13 May an agent change the 85 yuan shop rate from a bill without asking (recommendation: no, show old, new and how many prices move, apply on his yes).

Navigation labels, tab labels and routes change only with his explicit yes (CLAUDE.md).

## The waves

| Wave | What | Needs Adrian? |
| --- | --- | --- |
| 1 | 17 invisible fixes | Done |
| 2 | Picture archive of every screen as it is (incl. the tasting flow). Tasting line-by-line pass (list only). Design for the stale-browser sync fix (item 4) and merge re-point (16). Drift ratchets (lint). | No |
| 3 | The 13 open fixes that are visible or change behaviour (every open row above except 4 and 16), each as before and after pictures | Approval of each |
| 4 | Server bridge (server-owned link everywhere, one product-creation path, field patches with version, one publish command with readiness, order trackable at placement, freight estimate saved, bill shares stored) in parallel with the kit, page shell, tea card and record panel, with Settings and People as reference rooms built as new versions | Answers to the questions; approval of reference rooms |
| 5 | New Curate and new Stock, as new versions beside the old, in parallel | Parity with "Nothing lost"; visual approval |
| 6 | Connect the rooms: record addresses, the order's journey on every card, Today by id, one finder; Sales and Sessions on the kit; session lifecycle, hosts, recap, pour to stock | Visual approval |
| 7 | One read-only tasting summary on the tea; holdings table for sample and shop stock of one tea | Decisions; a before-and-after data page for any data-writing migration |

## How the work runs

- **Manager** (the session): writes briefs, reviews every diff line by line, corrects, runs the checks, cherry-picks worker commits onto `claude/zen-ptolemy-xwqdha` with clear messages, pushes. Only the manager pushes. Nothing goes to main until Adrian says "ship".
- **Workers** are sub-threads, each in its own git worktree, three or four at most, with disjoint file scopes. One owner at a time for hot files: `worker/src/index.ts`, `src/styles/card-utilities.css`, `src/components/CurateV2/index.tsx`, `src/admin/components/InventoryView.tsx`, `src/admin/AdminApp.tsx`, `src/lib/api.ts`.
- **Models:** server, money, access and the order and freight journey on the stronger model (Opus). Scoped client fixes, components to a written spec, tests and sweeps on Sonnet. Design decisions, trade-offs and review stay with the manager.
- **A brief names** the goal, owned files, forbidden files, the acceptance list and the proof owed. Workers link `node_modules` from the main checkout, do not run a dev server or browser tests, and commit one fix per commit.
- **Review is not optional.** In wave 1 three worker outputs needed correcting: "pending" orders added to "In process" (would have dropped a "do not receive again" warning), the link rule breaking "Develop in Curate", and the permission gate blocking stock-only staff from recording orders.
- Both Curate folders are frozen to fixes; new work goes to the neutral folder.
- Money changes start by reading `docs/claude/money.md`.

## Screenshots

Taken with Playwright against `npm run dev:test` using the repo's fixtures: `tests/helpers/compassHarness.ts` (`installCompassHarness`, options `customers`, `compassEntries`, `products`, `rates`) for Curate, `tests/helpers/inventoryMocks.ts` (`injectAuth`, `mockInventoryApi`) for Stock and the other rooms, with a catch-all `**/api/**` route registered first. Use `deviceScaleFactor: 2`, 390x844 and 1440x950. The first load after a cold start shows the loader; load once and discard before capturing. These are sample teas, not his data.
