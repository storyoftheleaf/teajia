# The tap ledger (U1)

Done by Sonnet 5.5 (cloud), in place of Sol. Numbers come from `test-results/review/steps.json` (81 rows, written by `task(...)` in the guest, host and owner walks at 1280 on rig set `all`, slot 5), checked against the three walk findings (W1, W2, W3; phone counts are one more where those files say so). The run sheet's budget is two taps from Home or from the page of the thing it belongs to; the "budget" column is the walk's own figure for the task, never above two unless the task is a chain. Over = more taps than budget. Each over-budget row has a finding in `todo/review/findings/U1.md`.

## 1. Reaching things (worst first)

| Task | Who | Taps | Screens | Budget | Over or under |
|---|---|---|---|---|---|
| Her own seat page after signing in (address and way) | guest | cannot be done by tapping (W1-1) | 2 | 1 | over, dead end |
| Guest notes (reports, Tea Table, offered photographs, "does anyone know") on the phone | owner | cannot be done by tapping (W3-1) | n/a | 2 | over, dead end |
| See who is asking to host | owner | cannot be done (W3-2) | n/a | 2 | over, dead end |
| Let a person host by link and set their reach | owner | 8 (phone 9) | 4 | 2 | over by 6 |
| Stop a person's hosting | owner | 6 (phone 7) | 4 | 2 | over by 4 |
| Table's page to its recap or the Tea Table piece | host | 4, and only once the recap is published | 4 | 1 | over by 3 |
| Thank-you link for a guest, from the table's page | host | 4 (After, Mark who came, Save, Copy) | 2 | 1 | over by 3 |
| Buy a tea from the thank-you, to the order | guest | 4 | 2 | 3 | over by 1 |
| Make a second table after the first | host | 3 (Back, door, Make) | 1 | 1 | over by 2 |
| Make a third table, open door | host | 3 | 1 | 1 | over by 2 |
| A photograph on a step of the way in (each step) | host | 3 | 1 | 2 | over by 1 |
| Name the place as her table in Your Table | host | 3 (2 when she has no kept place) | 2 | 2 | over by 1 |
| Print the card for a table | owner | 3 (phone 4) | 3 | 2 | over by 1 |
| Approve one credit request and decline another | owner | 3 | 1 | 2 | over by 1 |
| Act on a session report | owner | 3 | 2 | 2 | over by 1 |
| Tea Table: see the keeps and hold a piece | owner | 3 | 2 | 2 | over by 1 |
| Tea Table: hide a piece | owner | 3 | 2 | 2 | over by 1 |
| Share a tasting to the Tea Table | guest | 3 | 1 | 2 | over by 1 |
| Take a shared tasting off | guest | 3 | 1 | 2 | over by 1 |
| Ask to use credit, from Home (Your Table, credit, Use) | host | 3 | 2 | 2 | over by 1 |
| Reach one of her tables from Home | host | 3 (Your Table, Journey, the table) | 3 | 2 | over by 1 |
| Words and be named on a tea at a table | guest | 2, 2 fields | 1 | 2, 1 field | taps ok, one field over |
| Add a photograph during the session | guest | 2 | 1 | 1 | over by 1 |
| Use the kept place on the next table | host | 2 | 1 | 1 | over by 1 |
| Keep a place and save the way in | host | 2, 2 fields | 1 | 2 | at budget |
| Make a circle | host | 2, 1 field | 2 | 2 | at budget |
| Make a series | host | 1 to 3 | 1 | 3 | under |
| Put two tables in a circle | host | 2 | 1 | 4 | under |
| Make an assistant key | host | 2 | 2 | 2 | at budget |
| Start a table from Home | host | 2 | 2 | 2 | at budget |
| Reach Favourites, a table to come to, her journal, from Home | guest | 2 each | 2 | 2 | at budget |
| Tea Table from Home | guest | 1 | 1 | 2 | under |
| Add a tea to pour (shop tea, own tea, by name) | host | 1 each, 1 field | 1 | 2 | under |
| Keep a tea, an article, a Tea Table piece | guest | 1 each | 1 | 1 | at budget |
| Open the way in, see a request and confirm, copy the link | host | 1 each | 1 | 1 | at budget |
| Read the article offers; write a tea house's words | owner | 2 each | 2 | 2 | at budget |
| Find the waiting guest order in Sales | owner | 1 | 1 | 2 | under |

## 2. Entering things (worst first)

"Asked" counts what the person meets. "Could be filled in or dropped" is what the site already knows, or what can wait. Taps to finish counts the final tap.

| Form | Fields asked (R required, O optional; T typed, C chosen) | Could be filled in or dropped | Taps to finish |
|---|---|---|---|
| Make a table (`HostTablePage.tsx`) | Day R T, Time R T, Seats O (6) C, Name O T, Area O T, How guests get a seat C (request preselected): 6 | Area from Your Table or her last table; Seats and the door from her last table; Name from the day and her table's name. Only Day and Time are unknown | 2 (a second table 3 plus a field, W2-2) |
| Name a place as her table (`YourTablePlace.tsx`) | Place C (radio), Area R T: 2 | Area is the third time she is asked; place can be the one just kept | 3 |
| The way in, a step with a photograph (`WalkthroughEditor.tsx`) | Step line T, photograph C (editor, then Use photograph): 2 per step | Photograph step could create the step | 3 per step |
| Teas to pour (`HostTeaPicker.tsx`) | A few letters T, then pick C; for her own tea "from" T, photograph optional | Her last table's teas; the shop's list shows first | 1 each (budget 2) |
| Ask for a seat, signed out (`RSVPFormSheet.tsx`) | Name R T, contact R T (email or code and phone): 3 | Nothing for a stranger | 2 |
| Ask for a seat, signed in | Name and contact prefilled from the account, with an override | Already dropped | 1 to 2 |
| The thank-you and Mark who came (`HostTableAfter.tsx`) | A tick per confirmed guest (all pre-ticked): 1 per guest | Link could show per guest without Save | 3 (W2-6) |
| Guest book words (`GuestBook.tsx`) | Words O T, which tea C, "share this entry with the host" C, "be named" C: 4 | The tea (only one poured), and "be named" could follow the share tick | 2 to 3 (W1-14) |
| Order from the thank-you (checkout) | Name R T, email R T, plus the order: 4 taps | Name and email of a signed-in guest (W1-7) | 4 |
| Make a circle or series (`HostCircles.tsx`) | Name R T, what it is C (radio, circle preselected): 2 | Nothing; a series could name itself from the first table | 2 |
| Put a table in a circle | One choice C: 1 | None | 2 |
| Keep a tea / a favourite | None: 0 fields | None | 1 |
| Share a tasting to the Tea Table | One choice C and a second confirm button | Second button (W1-10) | 3 |
| Ask to use credit (`TeaCreditPage.tsx`) | Which order C, amount fixed by the site: 0 typed | Could be one tap on the order itself | 3 from Home |
| An article offer (`HostArticleOfferForm.tsx`) | Title R T, body R T (long), photographs O, credit tick O C: 4 | Nothing the site knows; title could come from the first line | 2 to 4 |
| Top teas (`TopTeasSection.tsx`) | Slot C, tea name R T or search then pick C, note O T, photograph O: 3 to 5 | Name filled when picked from the shop list (does so, read-only); slot could be next free | 3 |
| Portfolio words for a tea house (`TeaHousePortfolioSection.tsx`) | Words T, photographs O: 1 to 2 | None | 2 |
| A report (`ReportLink.tsx`) | Reason O T: 1 | Page and person are already known | 2 |
| Owner lets a person host by link (Manage, People) | Reach C (how widely tables are shown), the person C | The reach could default to "the people she asks" | 8 |
| Owner holds or hides a Tea Table piece | One choice each | Hold lasts a fixed 3 days (W3-11) | 3 |

## 3. Missing links (worst first)

| From | To | Taps today | Taps with a direct link |
|---|---|---|---|
| A table (host's page) | its recap and Tea Table piece | 4 via Manage, and only after the recap is published (S2) | 1 |
| A guest's seat page, after sign-in | her own address and way | none (the request form comes back, W1-1) | 1 |
| A table | each guest's thank-you | 4 | 1 per confirmed guest |
| Credit page, a credit row or ask | the order that earned or spent it | 0 (the order number is plain text, `TeaCreditPage.tsx:93`) | 1 |
| Home, Your Table | her own tables | 3 (Journey, then the table) | 2, or 1 with a list under Host a table |
| An owner's Today | what needs the owner (hosting asks, reports, credit requests) | 3 from where it waits (W3-5) | 1 |
| A recap | the Tea Table piece made from it | not found on either page | 1 |
| A table's page | its card for printing | 3 (4 on the phone) | 1 |
| A guest on a table | the tables they came to | no list on the host's guest row; the person's page shows recaps | 1 |
| Tea Table piece | the tea, the person | 1 each (holds) | 1 |
| A tea in the shop | the tables it was poured at | 1 (the table section on the tea card, holds) | 1 |
| Thank-you | the tea in the shop | 1 (holds; no price shown, W1-5) | 1 |
| A person's page | their table recaps | 1 (holds) | 1 |
| A table and its guests | each other | 1 (a tab on the same page, holds) | 1 |
