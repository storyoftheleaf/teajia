# Manage rebuild: audit findings, rules, state and how to resume

> Written 2026-11-11 by the manager session so any later session can continue without the original conversation. The full report, with screenshots, diagrams and the owner's questions, is the doc **Teajia Manage: audit and rebuild plan**: https://claude.ai/artifact/YBTipCxwkRVTbKPiahXcrr. Read that doc before starting a wave. This file is the working state: what is decided, what landed, what is next, and how workers are run.

## Start here (state when the first session closed, 2026-11-12)

**Read this section first. Everything below it is the fuller record.**

### What is live

`origin/main` carries all of this work. Nothing is waiting on a side branch except what "Not yet live" lists.

- Wave 1 and 2 fixes: access gates, the stale-browser sync (field-level), merging two Curate teas, redirects and dead links, 14 tasting fixes, drift guards in `src/admin/guards/`.
- **Curate's Source form, reorganised** (`src/components/curate/`, `src/components/TeaCompass/CaptureCard.tsx`): where, the tea, cost, capture, decision; small cards in the Library's language; Sample opens the Buy panel as a sample; photos stay visible; the header rows and microphone stay in place. The earlier form is kept at `/admin/compass?form=classic`.
- The Library card shows a tea's first photo where the camera was, count inside it, and a viewer with Add on tap.
- No database migrations were added by any of this.

### Decisions he made that override the older plan below

- **The current Curate is the base. Curate v2 (`/admin/compass/v2`) is the base for nothing.** Waves 4 and 5 below still say "new Curate": read that as "keep refining the current one". Standing instruction 13 has his words.
- **The Library and its tea card are not to be redesigned.** Additions he asked for (the photo) are fine; flattening is not.
- Sample means "acquire a small sample" (inside Buy). Tasting is separate.
- Visible changes are shown to him as before and after pictures first. He judges by eye and corrects in rounds; expect three or four rounds per screen.

### Still open, in the order I would take them

1. **His unanswered questions.** Tasting questions 1 to 8 (`todo/plans/tasting-tighten.md`, "Questions for Adrian") and plan questions 5 to 13 (below, "Questions waiting for Adrian"; question 4 is withdrawn). He was given all of them in plain words on 2026-11-12 and has not answered yet. Most later work depends on them.
2. **Source form, next refinement.** A long vendor name still truncates early; in the photo viewer the site's bottom bar shows over the backdrop; the origin, type and year cells could be lighter; after a tasting the decision sits 73 px lower. On a laptop the form works but was only lightly reviewed. Nothing has been tried with his real data.
3. **The visible fix-first items** (table below): 6, 8, 9, 10, 11, 12, 13, 15, 21, 23, 24, 27, 29, and the three dead links 31 to 33. Each needs a before and after picture and his yes. Items 10 and 12 touch money: read `docs/claude/money.md` first.
4. **Buying, freight and logistics** (his words: "not fully connected... put some energy into that"). An order placed in the browser has no receipt lines until matched by hand; freight is the 85 yuan shop rate plus bills he will hand over. See the doc section of that name. Not started.
5. **Stock, Sales, Sessions and the shared kit** (waves 4 to 7 below). Not started. Stock would be a new version beside the old, per standing instruction 3.
6. **Remaining invisible tasting items**: T2, T3, T14, T21, T28, T37 to T39, and T23's history rule (waits on tasting question 8).
7. **`verifyToken` does not check the token header** (`worker/src/index.ts`). Safe today; harden it.

### Housekeeping left behind

- Local worktrees under `.claude/worktrees/` and their `worktree-agent-*` branches are all merged or superseded and can be removed.
- The picture harness is `scripts/manage-archive/` (README inside). `form-tighten.spec.ts` there pictures and measures every state of the Source form; reuse it for before and after pictures.
- Browser tests: `tests/curate-flow-form.spec.ts` holds the new form; the older Curate specs hold the classic form through `openCompass(page, 'classic')`. In a cold container the first browser test after the dev server starts needs about 30 s; use a 90 s timeout.
- One server test, `curate-holdings-read-budget`, fails in the cloud container with the same number on old and new code and passes in CI. 23 others need the `sqlite3` CLI.
- Pages for him: the archive of every screen before the rebuild (https://claude.ai/artifact/SMFTKV9A6sWnd3GmEfWUKx), the Source form today beside new (https://claude.ai/artifact/NzdEue2vEfj9H7gajQiJB1), and the audit report (https://claude.ai/artifact/YBTipCxwkRVTbKPiahXcrr).

### Starting a fresh session

Branch from `origin/main`. Read `CLAUDE.md`, this section, standing instructions 1 to 13 below, and `todo/plans/tasting-tighten.md`. Ask him for the answers in item 1 before building anything visible.

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
13. **Curate is an in-person capture tool, and the current Curate is the base (2026-11-12).** He stands in a shop with the tea seller: opens Curate, writes down what the tea is and what it costs, records the seller talking, photographs the brew and the soup, notes his impression, marks buy or sample, and says where he is sitting. The current Source form and Library card do this well and he finds them easy to read. Curate v2 (`/admin/compass/v2`) flattened that away and is NOT the base for anything; it stays where it is, untouched, as a reference only. The earlier plan question "One Curate as a new version shaped like the sketch" is withdrawn. Rules for any change to Curate:
    - The current Curate keeps its tabs, its form and its card, in the same places. Improvements are made to it, as a new version beside it so the present one is recoverable.
    - Nothing that takes one tap today may take two. Everything on the card stays on the card: name, Choose, Reject, photo, Taste, price per gram, quote, weight, Add information.
    - No screen gets taller. Mobile first: measure before and after on a 390 by 844 phone and show him both pictures with the heights.
    - How he uses it (his words, 2026-11-12): in the shop he listens to the seller, then repeats what matters into **Notes** by voice; Notes with its microphone is the main capture, not an extra. **Teaware works the same way** (someone telling him about a teapot he may buy); the form is "onboarding in person" for anything he might get. **The Library is the second sitting**, at home or in the hotel: it holds every decision and is where he fills a tea out further (give it his own name, buy a sample, buy a quantity, add the brew picture he did not take, work through samples on the table). He does not always decide on the spot. **The Library's layout is "really, really good" and is not to be changed.** Tea cards must stay visible inside their supplier section, because he often remembers the supplier and not the tea.
    - **The tea card is deliberate in every detail** (his words, 2026-11-12): the colour of the band tells him the tea's type at a glance, the year is there to be seen and edited in place, the name line is where he names the tea. Any "cleaning" of the card is visual refinement only (alignment, spacing, consistency of the same parts), never flattening: no band, field, button or colour is removed, merged or moved.
    - **Waiting for his verdict: the reorganised Source form ('flow' layout).** Today beside proposed: https://claude.ai/artifact/PWUUg9kKGYwspHha874XzT was the spacing-only pass (superseded); the real proposal is **Curate Form Proposal**, linked from the session. Code: commit `cd42222` on the local branch `worktree-agent-a5621ce86c605dd5f` (on top of `87409f5`; not on the working branch, not pushed). `?form=flow` on /admin/compass selects it; without it the form and the Library card are exactly as before. New files live in `src/components/curate/`. Still rough: the laptop action bar keeps the old order and old Sample; the Library photo count overlaps the thumbnail; the Tea details line sits close to the capture card.
    - **His verdict on the 'flow' proposal (2026-11-12): he likes it; one more pass, then "get ready to ship it".** The pass: the microphone must look like it belongs in the top row (no box); top rows in one clear font, no serif shift; no "Notes" label above the note box; the note composer stays high but the growing list of saved notes (and the tasting summary) sits BELOW the decision, because a growing notes list is why he kept Considering / Selected / Passed on high; everything slimmer, no large button blocks; one consistent button, label, padding and gap style; fix every rough edge found. Then 'flow' becomes the default with the old form reachable at `?form=classic`. Nothing goes to `origin/main` until he says "ship".
    - **On the working branch, waiting for the word "ship" (2026-11-12):** the reorganised Source form is the default; `?form=classic` shows the earlier one, unchanged. `tests/curate-flow-form.spec.ts` holds the new form to what he asked (decision on the first screen with a price typed, Done last, Buy and Sample answering in view, Sample set to 50 g). The existing Curate browser specs hold the classic form. Not yet verified: a real recording from the header microphone (the test browser has no microphone), and anything with his real data.
    - **Second and third review rounds (2026-11-12), all on the working branch:** cards are one quiet surface with hairline rows and unboxed fields (his words for the earlier look: "chunky", "fragmented", "blocky"); captions that repeated their control are gone and empty fields read their own name; cost and freight on one line; the 1 to 10 rating and the tasting words (one quiet line, no pill) sit under Photo and Taste; the Buy and Sample panel is one more card. He called this "a good first pass" and asked to get it going, with a refinement round to follow. Known for that round: dropdown text in the Buy panel sits 4 px right; the vendor heading is two rows tall; the tasting words line is a full 44 px touch row; once a tea is tasted the decision sits 89 px lower.
    - **Refinement round before shipping (his words, 2026-11-12):** on the Library card the photo count goes INSIDE the thumbnail, and tapping the photo opens a viewer of the tea's photos with a plus to take another. The cost row under the slider "still looks like crap": rebuild it as a proper row (inputs left, shelf price right). The where header becomes one line: Vendor holding Run and Journey / visit, plus stays, Share moves elsewhere. Then the leftovers: less shift of the decision after tasting, dropdown alignment in the Buy panel, and a real check of the header microphone. "After that we can ship." The first push to live was blocked by the session's production-deploy guard; it needs his explicit "ship" or his own push.
    - (Earlier, superseded) the Source form tightened (spacing only, tea and teaware). Before and after: https://claude.ai/artifact/PWUUg9kKGYwspHha874XzT. The code is commit `87409f5` on the local branch `worktree-agent-a5621ce86c605dd5f` (not on the working branch, not pushed); it also adds `scripts/manage-archive/form-tighten.spec.ts`, which measures each row. With a price typed the Notes box now ends 10 px above the bottom bar (was 105 px below). Not reached: after a tasting is saved the form is still 109 px too long.
    - **Design direction for the Source form (his words, 2026-11-12).** "Tightened" never meant only shrinking: he wants better positioning and organisation to proper UI and UX standards, without losing function and without getting taller. Specifics:
        - The microphone must be reachable from any point in the scroll, always in the same place, and must NOT float over the content. Something profound gets said while he is typing elsewhere, and he wants to capture it right then.
        - Photo matters more than Scan: often there is nothing to scan, and a photo is the quick thing.
        - Chinese name should be more hidden (he does not type Chinese). Origin, year and type matter more.
        - One big single-colour panel of unorganised fields "doesn't inspire me to use it". The small cards on the other pages (the Library tea card) do. Organise the form as small cards in that card's language.
      Proposal in progress: a second layout of the form (`?form=flow`) beside the current one, shaped like the Library it feeds: supplier header, a tea card (name row, band in the type's colour with origin, type and year, cost row), a capture card (Photo, Taste, Notes), details, a decide card (status, then Buy, Sample, Done on the right, Buy panel directly under). Found in the current form: Buy opens its panel below Notes and out of sight; the Sample button opens the tasting (buying a sample is Buy, then Inventory purpose, Sample); Teaware and Tea order their last rows differently. **Sample, answered 2026-11-12:** Buy means "yes, I want this one". Done means "no decision yet, save it". Sample means "I want to get a small sample" and belongs inside acquiring (the Buy panel, preset to a sample; they are often given free). Tasting is a separate thing, reached from Taste: it builds out what he needs if he decides to keep the tea.
        - **Photos must not disappear.** After a photo is taken the form must show that there is one or several, with room to display them, and the same photo should show on the tea's Library card so it helps him remember the tea when browsing. The form and the Library should look connected.
        - **The top rows** (Source, Library, Ledger, Samples; Tea, Teaware, Import): he likes how slim they are and does not like how they are styled. Restyle only, same height, same labels and order (labels and order need his explicit yes to change).
    - Measured today on that phone: the Library spends 226 px on search and filters before the first supplier, a card is 160 px, and 3 cards fit. The Source form is about 930 px with a price typed, so the Buy / Done / Sample row lands behind the floating bar and the Notes box with its microphone is below the screen; 238 px sit above the tea's name.

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
| 4 | Stale browser overwrites newer work (whole-record sync, no version) | Landed (`worker/src/compassFieldPatch.ts`, `src/lib/compassFieldEdits.ts`: the browser says which fields it changed and the server writes only those; old bundles behave as before; "later" on a true same-field conflict is the device's clock against the row's `updated_at`) |
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
| 16 | Merging two Curate teas leaves the product on the loser | Landed (`worker/src/curateMergeLink.ts`; when both teas have a product nothing moves and the preview says so, which needs a person to resolve in Stock) |
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

Found in review on 2026-11-11, not yet changed: `verifyToken` in `worker/src/index.ts` checks a sign-in token's signature and expiry but never its header, so any other value signed under `JWT_SECRET` with caller-chosen text could pass as a token. Nothing in the worker does that today (the one attempt was caught and replaced with a derived key), but the header should be checked and no other feature should sign under `JWT_SECRET` directly.

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

4 WITHDRAWN 2026-11-12 (see standing instruction 13): one Curate shaped like the sketch. 5 An address for every record. 6 One word per thing (Supplier; Request then Order; Sent; Chosen/Rejected; "Orders" for Curate's buying tab; shop states Private, Ready, In the shop, Held, Sold out). 7 Drafts becomes a view inside Stock. 8 Stock shows his name first. 9 Readiness blocks publishing (name, type, price, counted stock). 10 Sold out always behaves the same. 11 Tastings attach to a session; PILLAR's "no live tasting mode" reworded. 12 Placing an order creates each tea's private Stock draft. 13 May an agent change the 85 yuan shop rate from a bill without asking (recommendation: no, show old, new and how many prices move, apply on his yes).

Navigation labels, tab labels and routes change only with his explicit yes (CLAUDE.md).

## The waves

| Wave | What | Needs Adrian? |
| --- | --- | --- |
| 1 | 17 invisible fixes | Done |
| 2 | Picture archive of every screen as it is, incl. the tasting flow (done: https://claude.ai/artifact/SMFTKV9A6sWnd3GmEfWUKx). Tasting line-by-line pass (done). Stale-browser sync fix (done) and merge re-point (done). Drift guards (done). Eight invisible tasting fixes (done), then a second batch (T6, T7, T12, T22, T24, T23/T40 in part; see `todo/plans/tasting-tighten.md`). | No |
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

**The picture archive.** `scripts/manage-archive/` takes every Manage screen at both sizes and builds the gallery page (its README has the commands; the full run is about an hour, one spec can be run alone). The published archive of the screens as they stood at `936bf53` is **Teajia Manage Archive**: https://claude.ai/artifact/SMFTKV9A6sWnd3GmEfWUKx (351 pictures, 177 screens, 12 rooms). It is the reference for "what it looked like before"; a before and after picture for wave 3 onward should reuse the same script and fixtures so the two are comparable.

Known gaps in the archive (not reached with the sample data): Purchases Arrived and Services; on the phone, Stock's Edit table, Add new tea, Glossary menu item and selection bar; the menu on each Sales order card; adding a tea and tapping a row in Curate v2 on the laptop; a guest's own tasting screens, `/s/:sampleId`, `/t/:token` and the public event pages; the Tea Masters editor, the add-person form, later tabs in a Stock tea's panel. Samples and the journal show empty.

Seen while capturing, not yet checked as defects: `/admin/compass/v2?tab=vendors` opens Today (the Vendors tab has no link); on the phone, "Edit details" and "Add information" on an old Curate tea open the same sheet; the tasting header cuts long tea names on the phone; on the phone, selecting Stock rows opens the name editor and no selection bar.
