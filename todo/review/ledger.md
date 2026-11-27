# The triage ledger

Triage of the review run (`todo/plans/guests-and-tea-masters-review-run.md`, section "Triage"). Written on `review/ledger` from every findings file (A6 to A11, W1, W2, W3, W5, W6, O2, O3) and every fixes file (credit, privacy, quiet, seats, tools). No product code was changed to write it. W4 (the switch crawl) is not in; its section is a placeholder at the end.

## Summary

151 findings were reported. Merging the same hole seen from two sides leaves **139 rows**. Counts below are rows.

| | S1 | S2 | S3 | S4 | all |
|---|---|---|---|---|---|
| rows | 11 | 34 | 63 | 31 | 139 |
| fixed on build/review | 9 | 21 | 12 | 1 | 43 |
| open | 2 | 13 | 51 | 30 | 96 |

- **Fixed: 43.** PR 569 credit, PR 570 agent tools, PR 571 names and privacy, PR 573 closed and failing states, PR 574 seats and time. The 22 documents rows (O3) have no severity in their file; they are put at S4.
- **Open: 96.** By sort: Fix now 34 (12 code rows in 10 work packages, plus the 22 documents rows), Fix with its switch 36, Adrian's 21, Leave 5.
- **Need Adrian: 22 rows** are sorted Adrian's (21 open, plus A8-5 which is fixed on the recommended answer). Together with the questions the fixes files raised on rows that are already fixed, that makes the 33 questions in "Adrian's questions".
- **Gate.** No S1 or S2 is open except the nine S2 and two S1 rows that wait on his word (A8-6, A8-7; A9-9, A9-10, A9-15, A10-4, A10-5, W3-1, W3-2, W3-3, W3-9). The recommended option is built meanwhile, as the run sheet says. Four S2 are open and sorted Fix now (A6-3, W1-4, W2-7, W3-7).
- **Duplicates merged** (the first id is the row's evidence): A8-4 + A10-1; A10-8 + W1-16; A9-12 + W1-2; W2-1 + W6-4; W1-4 + W1-17; W3-5 + A10-9; A11-13 + W6-3 + W2-2 + A11-2; A11-11 + W3-8; A9-13 + W2-6; A7-5 + W6-5.

### How the sorts were applied

- **Fix now:** every S1 and S2 that Adrian's word does not hold up, and every S3 over its tap budget on a task a first-time guest or host does. Added by judgement: W6-10 (a live breach of the money rule, one line) and the 22 documents rows (CLAUDE.md says the pillar is kept true in the same commit; they are edits to words only).
- **Fix with its switch:** matters only once that switch opens. S3 and S4 that are not over a first-time tap budget, and tap overruns on tasks that are not a first-time guest or host task (owner tasks, a second table, credit).
- **Adrian's:** the finding or its fixes file asks him a question, or the change moves a bar word, a bar link, a menu or a page's shape.
- **Leave:** with the reason in the row.
- Where the finding states a recommendation it is used. Where none is stated, the recommendation is the option that keeps today's behaviour, and the question says so.

## The ledger

Worst first (severity, then open before fixed). "Fixed" means fixed on `build/review` by the named PR. Merged ids are joined with plus.

| id | severity | what | area | state | sort |
|---|---|---|---|---|---|
| A8-6 | S1 | A staff seller with permission to sell can award credit without the owner marking the order Filled. | credit | open | Adrian's |
| A8-7 | S1 | Voiding the source of credit already spent takes the signed ledger below zero. | credit | open | Adrian's |
| A8-1 | S1 | Approving tea credit left the customer owing the full price. | credit | fixed, PR 569 | Fix now |
| A8-2 | S1 | Saving the same tea line on a reopened order could award the whole order twice. | credit | fixed, PR 569 | Fix now |
| A8-3 | S1 | A price cut after a request let the owner spend more credit than the tea cost. | credit | fixed, PR 569 | Fix now |
| A8-4 + A10-1 | S1 | An order voided while credit was closed kept its award, spendable once credit reopened. | credit | fixed, PR 569 | Fix now |
| A8-5 | S1 | Two identical sales Filled while credit was closed earned differently after a later edit; built on the recommended answer. | credit | fixed, PR 569 | Adrian's |
| A6-1 | S1 | A saved favourite showed later edits to an offer after its seller lost approval. | names and privacy | fixed, PR 571 | Fix now |
| A7-1 | S1 | Other guests saw the booking surname beside an included guest book note. | names and privacy | fixed, PR 571 | Fix now |
| A7-2 | S1 | Closing the Tea Table named a photographer who had declined credit. | names and privacy | fixed, PR 571 | Fix now |
| A7-3 | S1 | A later sitting appeared on the person page without a new share. | names and privacy | fixed, PR 571 | Fix now |
| A6-3 | S2 | The table chooser drops saved places after the first 50. | forms and entering | open | Fix now |
| A9-9 | S2 | A former host who has handed over ownership still cannot delete their identity (409, then a 500). | seats and time | open | Adrian's |
| A9-10 | S2 | A pending guest of a stopped host is told to wait for an answer that cannot come. | seats and time | open | Adrian's |
| A9-15 | S2 | With Launch 2 alone, withdrawing approval leaves a confirmed guest without directions or a next step. | seats and time | open | Adrian's |
| A10-4 | S2 | With HOME_BAR open and TEA_HOUSES closed, two doors lead to Page not found. | reaching things and links | open | Adrian's |
| A10-5 | S2 | Closing FEW_HOSTS again leaves guests who asked for a seat waiting with nobody able to answer. | closed and failing states | open | Adrian's |
| W1-4 + W1-17 | S2 | During the session the guest page has no way to add a photograph (and the one on the thank-you link is two taps, not one). | forms and entering | open | Fix now |
| W2-7 | S2 | From a table page there is no way to a recap or the Tea Table; both sit in Manage, four taps away. | reaching things and links | open | Fix now |
| W3-1 | S2 | On the phone there is no door to Guest notes, so the owner cannot reach reports or the Tea Table by tapping. | owner in Manage | open | Adrian's |
| W3-2 | S2 | The owner has no screen that shows who is asking to host. | owner in Manage | open | Adrian's |
| W3-3 | S2 | The owner cannot set another person top teas at all. | owner in Manage | open | Adrian's |
| W3-7 | S2 | The Card for a table page has no Back control, a dead end on the phone. | owner in Manage | open | Fix now |
| W3-9 | S2 | Filling an order by the fulfill_invoice tool refuses an order the screen fills. | agent tools | open | Adrian's |
| A8-8 | S2 | A delayed retry could put a declined credit request back in the owner queue. | credit | fixed, PR 569 | Fix now |
| A8-9 | S2 | Voiding an order left unapproved credit held against an order that can never use it. | credit | fixed, PR 569 | Fix now |
| A6-2 | S2 | An old shop favourite opened a missing product page after a visit to another shop. | reaching things and links | fixed, PR 571 | Fix now |
| A6-4 | S2 | An old session still showed under upcoming sessions after its seat door had closed. | seats and time | fixed, PR 574 | Fix now |
| A7-4 | S2 | A party guest public note was credited to the person who booked. | names and privacy | fixed, PR 571 | Fix now |
| A9-1 | S2 | A guest confirmed before party seats existed could lose their place to overbooking. | seats and time | fixed, PR 574 | Fix now |
| A9-2 | S2 | A signed-in circle guest could take a second seat at the same table. | seats and time | fixed, PR 574 | Fix now |
| A9-3 | S2 | A cancelled table still told guests their seat was confirmed. | seats and time | fixed, PR 574 | Fix now |
| A9-4 | S2 | Saving attendance one minute into tea completed the table. | seats and time | fixed, PR 574 | Fix now |
| A9-5 | S2 | A confirmed guest was asked to plan their visit while sitting at the table. | seats and time | fixed, PR 574 | Fix now |
| A9-6 | S2 | A waiting guest was still asked to claim a seat after tea started. | seats and time | fixed, PR 574 | Fix now |
| A9-11 | S2 | A confirmed guest could not see the host saved briefing before tea. | seats and time | fixed, PR 574 | Fix now |
| A10-2 | S2 | With the site open and the worker not yet, a tasting put on the Tea Table is told it is there but only the page share is recorded. | closed and failing states | fixed, PR 573 | Fix now |
| A10-3 | S2 | With the site open and the worker closed, every new door shows an error sentence instead of staying quiet. | closed and failing states | fixed, PR 573 | Fix now |
| A11-1 | S2 | A stopped host is refused a new guest on the page but approve_event_rsvp seats the guest anyway. | agent tools | fixed, PR 570 | Fix now |
| A11-6 | S2 | set_my_recap_on_tea_table let a shop owner who did not host the session put its recap on the Tea Table. | agent tools | fixed, PR 570 | Fix now |
| W1-1 | S2 | A seat asked for while signed out is forgotten on sign-in and the invite offers the form again. | seats and time | fixed, PR 574 | Fix now |
| W5-1 | S2 | The session card page stayed on Loading for the whole wait when the request answered 500, with no try again. | closed and failing states | fixed, PR 573 | Fix now |
| W5-2 | S2 | The session card page showed a crash screen with raw error text on an empty body. | closed and failing states | fixed, PR 573 | Fix now |
| W5-4 | S2 | Journey hid a failed request so a 500 looked like an empty Journey. | closed and failing states | fixed, PR 573 | Fix now |
| W5-5 | S2 | Journey signed out was a dead end with only Go home and no sign-in link. | closed and failing states | fixed, PR 573 | Fix now |
| A6-5 | S3 | Switching back to a saved table takes three taps even when its public area is already known. | forms and entering | open | Fix with its switch (YOUR_TABLE_PLACE_OPEN) |
| A6-6 | S3 | Choosing a place with no saved area leaves the previous place area in the form. | forms and entering | open | Fix with its switch (YOUR_TABLE_PLACE_OPEN) |
| A7-5 + W6-5 | S3 | Putting a table in a circle takes three to four steps even when only one table is eligible, and not from the table itself. | forms and entering | open | Fix with its switch (CIRCLES_OPEN) |
| A9-8 | S3 | Deleting a guest account silently leaves its future seat occupied. | seats and time | open | Adrian's |
| A9-13 + W2-6 | S3 | Recording one absence, and reaching a guest thank-you link, each take four taps behind After and Mark who came. | forms and entering | open | Fix now |
| A10-6 | S3 | A host key paused by a close works again on its own when the switch reopens, and the host is told neither time. | closed and failing states | open | Adrian's |
| A11-4 | S3 | host_table refuses the open door the page gives a host with reach, and cannot take the area. | agent tools | open | Fix with its switch (ANYONE_HOSTS_OPEN) |
| A11-5 | S3 | On a stopped host scoped token, answer_guest no, set_guest_note and add_table_tea say not available where the page allows them. | agent tools | open | Fix with its switch (FEW_HOSTS_OPEN) |
| A11-7 | S3 | The Tea Table tools are narrower than the page: a host cannot hold their own recap, and nobody can let go of a hold or unhide by tool. | agent tools | open | Fix with its switch (TEA_TABLE_OPEN) |
| A11-9 | S3 | The report tool needs a table id, which a public table never shows; the page reports by link. | agent tools | open | Fix with its switch (ANYONE_HOSTS_OPEN) |
| A11-10 | S3 | Ten things on the host page have no tool on the host key. | agent tools | open | Fix with its switch (HOST_TOKENS_OPEN) |
| A11-11 + W3-8 | S3 | Five of Adrian owner actions (reach, reports, article offers, Tea Table list, credit decisions) have no owner tool. | agent tools | open | Fix with its switch (FEW_HOSTS_OPEN and HOST_CREDIT_OPEN) |
| A11-13 + W6-3 + W2-2 + A11-2 | S3 | A host cannot make the same table again on the page, though the agent can; the draft copy that nobody could open (A11-2, S2) is fixed. | forms and entering | open (A11-2 part fixed, PR 570) | Fix now |
| W1-5 | S3 | The thank-you lists teas with links but no prices. | reaching things and links | open | Adrian's |
| W1-7 | S3 | The order form asks a signed-in guest for name and email, and the order takes four taps, not three. | forms and entering | open | Fix now |
| W1-10 | S3 | Sharing a tasting and taking it off each take three taps, not two. | forms and entering | open | Fix now |
| W1-14 | S3 | Send for review stays dim until a second tick that nothing points to, so words plus being named take three taps. | forms and entering | open | Fix now |
| W1-19 | S3 | Favourites lives under a row called remember and is spelled three ways. | reaching things and links | open | Adrian's |
| W1-20 | S3 | Signed out, a seat request at a shop session answers check your messages with no page of her own. | seats and time | open | Adrian's |
| W2-1 + W6-4 | S3 | The make-a-table form fills in none of what the site knows (area from Your table, seats and door from the last table). | forms and entering | open | Fix with its switch (YOUR_TABLE_PLACE_OPEN) |
| W2-3 | S3 | The open door is offered to no host until the owner sets that host reach, and nothing tells the host. | reaching things and links | open | Adrian's |
| W2-4 | S3 | A photograph on the way in takes three taps, and using a kept way takes two. | forms and entering | open | Fix now |
| W2-5 | S3 | Naming a place as her table asks for the area a third time and takes three taps for a host with one already. | forms and entering | open | Fix now |
| W2-8 | S3 | Asking to use credit is three taps from Home, not two. | reaching things and links | open | Fix with its switch (HOST_CREDIT_OPEN) |
| W2-9 | S3 | Your Table and Host a table show none of her tables; they sit two screens deeper under Journey. | reaching things and links | open | Adrian's |
| W2-10 | S3 | Back then Forward on the screen that shows an assistant key once wipes it. | closed and failing states | open | Fix with its switch (HOST_TOKENS_OPEN) |
| W2-11 | S3 | A first-time host has no tea of her own to pour. | forms and entering | open | Leave (a name alone is the answer for a first table; the finding itself says no fix needed) |
| W3-4 | S3 | Letting a person host by link takes 5 to 6 taps, and stopping takes 6 to 7, against a budget of 2. | owner in Manage | open | Adrian's |
| W3-5 + A10-9 | S3 | Today shows nothing the five launches need from the owner, so every owner job (reports, Tea Table pieces, credit) starts three to four taps away. | owner in Manage | open | Adrian's |
| W3-6 | S3 | Printing a card for a table takes 3 taps on desktop and 4 on the phone. | owner in Manage | open | Fix with its switch (TABLE_CARD_OPEN) |
| W3-10 | S3 | fulfill_invoice needs the invoice id again with the confirm, unlike the launch tools. | agent tools | open | Leave (the tool works; it sits in mcp.ts, a shared file, and costs one extra argument) |
| W5-3 | S3 | A guest who opens the session card address sees the admin shell and Waiting for an invite. | closed and failing states | open | Leave (not a leak and not a dead end; wording only, Adrian may add a sentence later) |
| W5-9 | S3 | Where a person cannot host or the table is missing, the page ends with one sentence and nothing to do next. | closed and failing states | open | Fix with its switch (FEW_HOSTS_OPEN) |
| W6-1 | S3 | A photograph zoom is held only in state, so Back leaves the page instead of closing it. | reaching things and links | open | Fix with its switch (TEA_TABLE_OPEN) |
| W6-2 | S3 | Back on Favourites runs a bare navigate(-1), so from a fresh tab it leaves the site. | reaching things and links | open | Fix with its switch (FAVOURITES_OPEN) |
| W6-6 | S3 | Your top teas makes a person type a tea name the site already knows from their chest and journal. | forms and entering | open | Fix with its switch (TOP_TEAS_OPEN) |
| W6-7 | S3 | Making an assistant key asks for a name the site could suggest. | forms and entering | open | Fix with its switch (HOST_TOKENS_OPEN) |
| W6-8 | S3 | Asking about a tea takes five taps and two screens before the tea is on the table. | forms and entering | open | Fix with its switch (KNOW_THIS_TEA_OPEN) |
| W6-9 | S3 | The credit ceiling message shows 0.00 when the shop has no credit terms, a literal ?? 0 on money. | credit | open | Fix with its switch (HOST_CREDIT_OPEN) |
| W6-10 | S3 | Freight edit turns a bad number into free freight (Number(val) // 0 on money). | forms and entering | open | Fix now |
| O2-1 | S3 | Tea Table recaps scan every event. | database speed | open | Fix with its switch (TEA_TABLE_OPEN) |
| O2-2 | S3 | Tea Table manage scans every tasting share. | database speed | open | Fix with its switch (TEA_TABLE_OPEN) |
| O2-3 | S3 | Tea Table manage counts keeps by scanning the whole keeps index once per row. | database speed | open | Fix with its switch (TEA_TABLE_OPEN) |
| O2-4 | S3 | Host credit lines and balances scan the whole ledger per row. | database speed | open | Fix with its switch (HOST_CREDIT_OPEN) |
| O2-5 | S3 | Know this tea scans questions and reads the whole products table to show a few links. | database speed | open | Fix with its switch (KNOW_THIS_TEA_OPEN) |
| O2-6 | S3 | A person top teas read the whole products table on every public view. | database speed | open | Fix with its switch (TOP_TEAS_OPEN) |
| O2-7 | S3 | The sessions list scans all of one host events for every candidate session. | database speed | open | Fix with its switch (FEW_HOSTS_OPEN) |
| O2-8 | S3 | Journey finds attended sessions by scanning every attendee row. | database speed | open | Fix with its switch (FEW_HOSTS_OPEN) |
| O2-9 | S3 | Journey reads tasting notes by scanning every note. | database speed | open | Fix with its switch (FEW_HOSTS_OPEN) |
| O2-10 | S3 | Journey finds sample tastings by scanning every tasting. | database speed | open | Fix with its switch (FEW_HOSTS_OPEN) |
| O2-11 | S3 | Effectively published scans all articles per person. | database speed | open | Fix with its switch (FEW_HOSTS_OPEN and TOP_TEAS_OPEN) |
| A8-10 | S3 | Approving an over-limit credit request from the host detail took three clicks. | credit | fixed, PR 569 | Fix now |
| A9-7 | S3 | Manage prepared a coming-up reminder for guests already sitting. | seats and time | fixed, PR 574 | Fix now |
| A9-12 + W1-2 | S3 | The guest ticket and invite showed a different hour without naming the time zone. | seats and time | fixed, PR 574 | Fix now |
| A9-14 | S3 | Advancing the scheduler clock did not expire an offered seat. | seats and time | fixed, PR 574 | Fix now |
| A10-8 + W1-16 | S3 | With FEW_HOSTS closed on the site, /account/host was a blank page. | closed and failing states | fixed, PR 573 | Fix now |
| A11-3 | S3 | The host copy of a table skipped two rules the page keeps: a past day and a lost by-link door. | agent tools | fixed, PR 570 | Fix now |
| A11-8 | S3 | take_my_tasting_off_tea_table said the tasting stays on the page, then took it off the page too. | agent tools | fixed, PR 570 | Fix now |
| W1-13 | S3 | Host a table told a first-time host Could not open your circles. | closed and failing states | fixed, PR 573 | Fix now |
| W5-6 | S3 | Host a table, the hosted table and tea credit said could not load with no button. | closed and failing states | fixed, PR 573 | Fix now |
| W5-7 | S3 | The Tea Houses pages said could not be loaded with no Try again. | closed and failing states | fixed, PR 573 | Fix now |
| W5-8 | S3 | A tea house page that failed with a 500 said This house has no page here. | closed and failing states | fixed, PR 573 | Fix now |
| W5-10 | S3 | The sign-in link in After the sit had no return path (fixed for sign-in inside the app; a full reload asks for the host link again). | closed and failing states | fixed, PR 573 | Fix now |
| A10-7 | S4 | The closed answers for circles, host keys and Know this tea can be told apart from an address that does not exist. | closed and failing states | open | Fix with its switch (CIRCLES_OPEN, HOST_TOKENS_OPEN and KNOW_THIS_TEA_OPEN) |
| W1-11 | S4 | After sharing, the journal row still says Private behind the sheet. | forms and entering | open | Fix with its switch (TEA_TABLE_OPEN) |
| W1-12 | S4 | Home offers Create an account and Sign in to someone who is signed in. | reaching things and links | open | Fix with its switch (HOME_BAR_OPEN) |
| W1-18 | S4 | The Tea Table page sits in a second main landmark. | closed and failing states | open | Fix with its switch (TEA_TABLE_OPEN) |
| W3-11 | S4 | The Tea Table Hold button holds a fixed 3 days, and Stop hosting has two near-identical stops. | owner in Manage | open | Leave (cosmetic, owner-only; the tool already takes 1 to 14 days) |
| W5-11 | S4 | Empty tea credit tells a host nothing to do next. | closed and failing states | open | Fix with its switch (HOST_CREDIT_OPEN) |
| W6-11 | S4 | A toggle button in the tea page has no tap-target class. | forms and entering | open | Leave (not measured; the row may already be 44 high; check when W6-10 opens the file) |
| W6-12 | S4 | Em dashes in what a person reads (a missing currency shows a dash). | forms and entering | open | Adrian's |
| O3-P1 | S4 | PILLAR line 5 and the last sentence still call Home and the bar proposals and leave out switch names. | documents | open | Fix now |
| O3-P2 | S4 | PILLAR says credit screens are a separate build; they are built, and the ceiling is not per order by default. | documents | open | Fix now |
| O3-P3 | S4 | PILLAR says credit needs FEW_HOSTS_OPEN; only circles and the key do. | documents | open | Fix now |
| O3-P4 | S4 | Does anyone know this tea (KNOW_THIS_TEA_OPEN) is named in none of the four documents. | documents | open | Fix now |
| O3-P5 | S4 | PILLAR says nothing reads order_session_sources; the credit ledger does when HOST_CREDIT_OPEN is on. | documents | open | Fix now |
| O3-P6 | S4 | PILLAR says Visit has no switch; it sits behind TEA_HOUSES_OPEN, and Overview, Build and Work are built. | documents | open | Fix now |
| O3-P7 | S4 | PILLAR is silent on the four words with HOME_BAR_OPEN on, and the Visit comment in navSections.ts is wrong. | documents | open | Fix now |
| O3-P8 | S4 | PILLAR leaves TOP_TEAS_OPEN unnamed and omits Add your table (YOUR_TABLE_PLACE_OPEN). | documents | open | Fix now |
| O3-M1 | S4 | SECTIONS title calls the overhaul proposed though half is built behind switches. | documents | open | Fix now |
| O3-M2 | S4 | SECTIONS first banner contradicts its own second half on what is built. | documents | open | Fix now |
| O3-M3 | S4 | SECTIONS names the bar words read, table, houses; the code has Tea table and Tea house. | documents | open | Fix now |
| O3-M4 | S4 | SECTIONS calls the Host doors proposed; they are built behind FEW_HOSTS_OPEN. | documents | open | Fix now |
| O3-M5 | S4 | SECTIONS calls Tea Houses Overview, Build and Work proposed; they are built behind TEA_HOUSES_OPEN. | documents | open | Fix now |
| O3-M6 | S4 | SECTIONS route table says Visit is built with no flag; it is behind TEA_HOUSES_OPEN. | documents | open | Fix now |
| O3-M7 | S4 | SECTIONS describes Home, the phone menu and keyboard keys as proposed; they are built behind HOME_BAR_OPEN. | documents | open | Fix now |
| O3-M8 | S4 | SECTIONS does not mention Launch 5 parts (Know this tea, credit, circles, key, card, top teas, article offers). | documents | open | Fix now |
| O3-S1 | S4 | STATE_OF_THE_SITE Launch 5 paragraph repeats the credit and FEW_HOSTS faults. | documents | open | Fix now |
| O3-S2 | S4 | STATE_OF_THE_SITE has no Launch 1 or Launch 4 section. | documents | open | Fix now |
| O3-S3 | S4 | STATE_OF_THE_SITE scorecard and boundary leave out hosts, the Tea Table and tea credit. | documents | open | Fix now |
| O3-C1 | S4 | CHANGELOG says the credit screens are a separate build and has no entry for circles or Know this tea. | documents | open | Fix now |
| O3-C2 | S4 | CHANGELOG says Visit has no dedicated flag; it is behind TEA_HOUSES_OPEN. | documents | open | Fix now |
| O3-C3 | S4 | CHANGELOG has no entries for HOME_BAR_OPEN, HOST_ARTICLES_OPEN or TOP_TEAS_OPEN. | documents | open | Fix now |
| A11-12 | S4 | make_circle made a circle when no kind was given; the page refuses. | agent tools | fixed, PR 570 | Fix now |


## Adrian's questions

Each question is one sentence, then the options, then the recommendation that is already being built. Where the finding gave no recommendation, the recommendation is the option that keeps today's behaviour, and it says so. Rows already fixed on his question are marked built.

### Tea credit (A8)

1. **A8-5.** Should an order Filled while credit was closed earn when credit opens? Options: never (earning starts with the first Fill after opening) or a catch-up for every qualifying earlier Fill. Recommendation: never. Built in PR 569 (`CLOSED_FILL_EARNS_LATER = false`), one flag to change.
2. **A8-6.** Should a delegated seller marking an order Filled count as the owner's verification for earning credit? Options: yes, or only the owner's Fill earns. Recommendation: none stated; keeps today's behaviour, so yes. The failing test A8-6 stays red until he answers.
3. **A8-7.** When a sale that earned credit is voided after the host spent it, should later earnings repay the shortfall, or should the shop absorb it? Recommendation: none stated; keeps today's behaviour, so the host owes and later earnings repay. The fix is then a signed ledger with a spendable balance that is never negative, and the A8-7 test is reworded to that.
4. **A8 self-orders.** Should a host ordering from their own thank-you earn nothing, or earn the same share as any buyer? Recommendation: keep the exclusion (built, unchanged).
5. **A8 void after spending.** When the order a credit was spent on is voided, should the approved credit come back, or need a separate owner decision? Recommendation: keep today's behaviour, the spend stays posted (built, unchanged).
6. **A8 stopped hosts.** After a host is stopped, should referrals already recorded keep earning? Recommendation: keep today's behaviour, they keep earning and the balance stays.

### Names and photographs (A7)

7. **A7-2.** Photographs from before migration 0132 have no recorded consent and now show with no author. Should those photographers be asked, or should the photographs stay unnamed until they choose? Recommendation: stay unnamed until they choose (built, PR 571).
8. **A7-3.** Should older page-only shares keep showing every sitting, or wait for a new share before words added later appear? Recommendation: keep showing (built, today's behaviour).
9. **A7-3.** When a tasting is taken off the Tea Table but kept on the page, should the page then show every sitting? Recommendation: today's behaviour, it does (built).

### Seats, time and deletion (A9, W1)

10. **A9-8.** When a guest deletes their account, should their future seats be released, or may they choose which bookings to keep by private link? Recommendation: release, and say so before they delete (the test exercises the release option).
11. **A9-9.** Should a host's deletion wait until they transfer or cancel future tables, or cancel those tables and close their circles? Recommendation: wait, as today, but with an answer the host can act on in place of the 500; the credit ledger is kept either way.
12. **A9-10.** When hosting stops, should a guest's pending request close, or stay paused with a way to withdraw? Recommendation: stay paused with a truthful sentence and a Withdraw button (today they stay pending); the moderation reason stays private.
13. **A9-15.** With Launch 2 alone, when a host loses approval, should confirmed guests keep their directions until the end, or should the table close with a cancellation shown on the ticket? Recommendation: keep the directions, which is what Launch 3 already does.
14. **Seat door during tea (seats note).** Should a direct link still take a request while the table is on? Recommendation: keep today's behaviour, the door stays open until the end.
15. **A9-12 and W1-2.** Show the table's local time, the guest's time, or both? Recommendation: the table's own time with its zone named, and the guest's own clock only when no zone is stated (built, PR 574).
16. **W1-20.** Is the quiet answer to a signed-out seat request on the live site intended? Recommendation: yes, keep it, and say on the request sheet where her link will come from.

### Closing a launch (A10)

17. **A10-5.** If FEW_HOSTS is closed again after it opens, should a host still be able to answer guests at tables already made? Recommendation: the narrow version, read, answer and release seats at tables already made, and make no new ones.
18. **A10-6.** Should a host key paused by a close come back by itself when hosting reopens? Recommendation: yes, keep it, and tell the host on their page that the key was paused from one date to another.
19. **A10-4.** With HOME_BAR open and TEA_HOUSES closed, should "tea house" in the bar and "Find a tea house" on Home go to /advise? Recommendation: open TEA_HOUSES before HOME_BAR (no code), and send both doors to /advise while Tea Houses is closed, as the consult plate already does.

### Hosting and the owner (A11, W1 to W3)

20. **A11-2.** Should a host's "same table again" copy open at once like a new table, or wait as a draft? Recommendation: open at once (built, PR 570).
21. **W1-17 with W1-4.** The photo rule says one tap and the editor rule says crop first; for a photograph at a session, which wins? Recommendation: the editor stays, and the rule reads "one tap, then confirm the crop"; the button goes on the guest's own page.
22. **W1-5.** Should the thank-you show a price beside each tea, given "no price" is the rule elsewhere on a session? Recommendation: no, keep today's behaviour.
23. **W1-19.** Should the Your Table row called "remember" be labelled "Favourites", with one spelling everywhere? Recommendation: yes, label it Favourites and use the British spelling throughout (a navigation word, so it waits for his yes).
24. **W2-3.** Is it meant that the open door is shut for every host until he sets that host's reach, and should the host be told? Recommendation: keep the door as it is and add one line under the doors saying Teajia opens the third.
25. **W2-9.** Should "Host a table" list the host's coming tables under the form (Home, Host a table, the table is two taps)? Recommendation: yes (a change to a page's shape, so a mock-up goes with it).
26. **W3-1.** Should the phone Menu show a room's children (Guest notes under Publish)? Recommendation: yes, list Publish's tabs under it in the phone Menu from any room; it also saves two taps on every Publish tab.
27. **W3-2.** Do you want to be shown who has started hosting and is not yet approved by link? Recommendation: yes, mark people who have made a table and put the unapproved ones at the top of Platform, Users.
28. **W3-3.** Should he be able to fill in a person's top teas for them, or is it only ever the person's own? Recommendation: only the person's own (today's behaviour); drop "the owner sets a person's top teas" from the plan.
29. **W3-4.** Should hosting sit on the person's own page under People, and Platform under Settings, so letting a person host takes three taps, not six? Recommendation: yes (layout, mock-up with it).
30. **W3-5 with A10-9.** Should Today's "What needs you" gain lines for reports, credit requests, article offers and Tea Table pieces, each linking straight to its section? Recommendation: yes, shown only when something is open.
31. **W3-9.** Can a live order reach Filled with no seller recorded (one that began at a host's thank-you), and should the fulfill_invoice tool then fill it as the screen does? Recommendation: the tool follows the screen, so both fill; this also decides whether such orders earn credit.

### Words and documents

32. **W6-12.** Where a currency or rate is missing, should the page say "not stated" or show a plain hyphen? Recommendation: "not stated" (a lone hyphen reads as a minus).
33. **CLAUDE.md (from O3).** The Tea Table exception in CLAUDE.md still reads "not in force until he confirms", while the code records his yes of 2026-11-26. May the line be changed to say so? Recommendation: yes, with his word; the documents package does not touch CLAUDE.md.

## Changes the live site with every switch closed

From the fixes files; each is a real change to what the live shop does while the sixteen switches stay as they are (FIRST_TABLE_OPEN on, the other fifteen closed). Where a fixes file does not say whether a path is live, it is marked "check".

### Names and privacy (PR 571)

- The guest-facing guest book, on booking and party links, shows each writer's saved signature or else first name, never the booking surname; the host's review keeps the full name.
- The public session recap credits a party guest's note to the signature they chose, not to the person who booked.
- Family photographs carry no author (no name, no page, no slug) unless the photographer allowed credit; photographs from before migration 0132 have no recorded consent, so they now show unnamed.
- Favourites and the person page (A6-1, A6-2, A7-3) change only when FAVOURITES_OPEN and TEA_TABLE_OPEN open.

### Seats and time (PR 574)

- One seat per person at a table: the same email (any case), phone or signed-in account cannot hold a second live seat, by any door; the refusal code is `already_seated`. Older confirmed seats with no party row are counted once.
- The upcoming sessions list (public and signed-in) shows only sessions that have not started, judged as an instant in the session's own zone, with eligibility applied before the limit of 20.
- Attendance completes a table only after its end (409 `hosted_table_not_ended` before); the four-hour default applies when no end is stated.
- Times on the guest ticket and the invite name their zone ("11:30 PM, Makassar time"), and a time with no zone names the viewer's own clock.
- Nothing asks a guest anything once tea starts: the planning form, calendar entry, +1 and dietary notes are hidden; waiting-list claims are refused from the start (410 `offer_expired`) and offers are capped at the start; Manage refuses to prepare a coming-up reminder from the start (409 `reminder_window_closed`) and hides Generate Reminders.
- A cancelled table says "This table is cancelled" on every guest's page, with no booking actions; a confirmed guest's saved briefing now shows before tea.
- A guest who asked for a seat signed out finds the request on this device after signing in, in place of the form again.
- The waiting-list scheduler reads every deadline at one operation time.

### Tea credit (PR 569; HOST_CREDIT_OPEN stays closed)

- "Closed does nothing at all" is no longer true: a Void now reverses its award and releases its holds with the switch closed, in one batch that touches only that order. Nothing is earned, no source is read and nothing is filed while closed.
- Migration 0149 adds `host_credit_fills` and three triggers on invoices that write a row the first time any order becomes Filled by any path, and one when an order leaves Filled with no row; it changes no existing rows. Every live Fill now writes that row.
- Invoice arithmetic reads approved credit as its own settlement (`credit_usd` beside cash `paid_usd`), and stock, shipping and the balance check read cash plus credit. With no credit spent, which is the live case, the figures do not change (check).

### Closed and failing states (PR 573)

- `/account/host` and `/account/host/:id` show the site's Page not found while hosting is closed, in place of a blank page and "This table was not found."
- The shop's session form says the tasting or contribution fields "could not be kept" (the worker answers `not_kept`) in place of "Event updated" when ANYONE_HOSTS is closed and it drops them.
- Journey says "We could not open your Journey just now." with Try again when its read fails, and sends a signed-out visitor to sign-in, returning to `/account/journey`.
- After the sit, the sign-in link returns to `/after-sit`; the recap link stays in memory so signing in inside the app comes back to the recap.
- The session card page shows one retry then "Could not load the session card just now." with Try again, never raw error text (card route is behind TABLE_CARD_OPEN, so check).

### Agent tools (PR 570)

- Nothing visible while closed: the changes sit behind FEW_HOSTS_OPEN, TEA_TABLE_OPEN and CIRCLES_OPEN. The one shared move is `accountHostingStopped`, now exported from `worker/src/hostApproval.ts` and called by the shop's two approve routes; it is the same check, and no host is stopped while FEW_HOSTS is closed.

## Open, Fix now

Twelve code rows in ten work packages, and one documents package. A package is the files it touches, so two builders never hold the same file. "Settled" means the file and behaviour are clear and bounded; "subtle" means a decision or a second surface sits inside it. "Rides along" lists switch-sorted rows that touch the same files and should go to the same builder, so the file is opened once.

| package | ids | files | settled or subtle |
|---|---|---|---|
| 1 Your table place | A6-3 (S2), W2-5 (S3, 3 taps against 2). Rides along: A6-5, A6-6 | `worker/src/yourTablePlace.ts`, `src/components/host/YourTablePlace.tsx` | Settled. Return every saved place (or search them) with a 51st-record test; offer "Make this your table" on the keep screen with the area from the table. |
| 2 After the table | W2-7 (S2), A9-13 with W2-6 (S3, 4 taps against 1 to 2) | `src/components/host/HostTableAfter.tsx` | W2-7 settled (one line on After linking to that table's page in Manage). A9-13 and W2-6 subtle: showing a thank-you link beside every guest before saying who came changes who gets a link, and "Mark who came" opens only after the end since PR 574. |
| 3 Same table again | A11-13 with W6-3 and W2-2 (S3, 3 taps against 1). Rides along: W2-1 with W6-4, W5-9 | `src/pages/HostTablePage.tsx`, `src/pages/HostedTablePage.tsx`, `src/lib/hostingApi.ts`, `worker/src/hostTable.ts`, one host route line in `worker/src/index.ts` | Settled. A button on the table's page opens the form filled from that table with the day a week on; the copy rules are already fixed (PR 570). The route line in the worker monolith is Opus's. |
| 4 The way in | W2-4 (S3, 3 taps against 2, and 2 against 1) | `src/components/host/WalkthroughEditor.tsx`, `src/components/events/WayStepPhoto.tsx` | Settled. Add a photograph picks several and makes a step each; "Use the way to X" saves on that tap. The editor still opens on each. |
| 5 Photograph at the table | W1-4 with W1-17 (S2) | `src/components/events/GuestManagement/ConfirmedView.tsx`, `src/components/events/SessionGallery.tsx`, the `/m/:token` page | Subtle. A new control on a surface that must stay quiet during tea ("a photo is one tap"), on the thank-you gallery call, and it waits on question 21 for the tap count. |
| 6 Order form | W1-7 (S3, 4 taps against 3) | `src/components/shared/PublicCart.tsx` | Settled. Prefill name and email from the account, keep town and country from the last order; optionally go from Add to order straight into the sheet. |
| 7 Guest book send | W1-14 (S3, 3 taps against 2) | `src/components/events/GuestBook.tsx` | Settled. Sending words is itself the consent to share with the host (the line under the button says so); leave one optional tick, "Show my first name". |
| 8 Tasting share sheet | W1-10 (S3, 3 taps against 2). Rides along: W1-11 | `src/components/tasting/TastingShareStep.tsx`, `src/components/tasting/JournalShareLine.tsx` | Settled. The choice is the action; the journal row updates from the answer. Keep the PR 573 line that follows `on_tea_table`. |
| 9 Card for a table | W3-7 (S2). Rides along: W3-6 | `src/pages/SessionCardPage.tsx`, `src/admin/components/adminHistory.ts` | Settled. Back top-left with `useAdminBack('/admin/events/<slug>')`, hidden in print. W3-6 adds a Print card link to each Sessions row. |
| 10 Freight entry | W6-10 (S3, a live breach of the money rule) | `src/admin/components/ProductEditPanel.tsx` | Settled. `enteredNumber()` in place of `Number(val) \|\| 0`; an unreadable entry is ignored. W6-11 is left. |
| 11 Documents | all 22 O3 rows (P1 to P8, M1 to M8, S1 to S3, C1 to C3) | `docs/PILLAR.md`, `docs/SECTIONS.md`, `docs/STATE_OF_THE_SITE.md`, `docs/CHANGELOG.md` | Settled, and last: M2, M3 and M7 wait on his answer about the bar words (questions 19 and 23). The `navSections.ts` comment is Opus's, and the CLAUDE.md line is his (question 33). |

No two packages share a file. Files in the shared interfaces (`src/lib/api.ts`, `src/types.ts`, the switch files, `worker/src/mcp.ts`, `navSections.ts`) stay with Opus.

### Held for Adrian, and where they land

These S1 and S2 rows carry on with the recommended option, so builders can see which files they will touch. Most sit in `worker/src/index.ts`; sequence them after the packages above and give each group to one builder so that file is never held twice.

| rows | files |
|---|---|
| A8-6, A8-7 | `worker/src/hostCreditLedger.ts`, the Fill route in `worker/src/index.ts` (lines near 6308 and 6479), `worker/tests/review-credit-ledger.test.ts` |
| A9-8, A9-9 | `worker/src/index.ts` (account deletion near 2342 to 2347), `src/pages/AccountSettingsPage.tsx` |
| A9-10, A9-15 | `src/components/events/GuestManagement/RequestedView.tsx`, `ConfirmedView.tsx`, the link and kept-way reads in `worker/src/index.ts` (near 13308) |
| A10-5 | the `/api/me/tables/*` handlers and the link read in `worker/src/index.ts` (near 17480 to 17549, 12586) |
| W3-2, W3-3 | `src/admin/views/PlatformAdminView.tsx`, `worker/src/index.ts` (top teas near 27414), the Tea Masters editor |
| A10-4, W3-1 | `src/components/navSections.ts`, `src/pages/home/HomeLaunchFour.tsx`, `src/pages/teaHouses/teaHouseRoutes.tsx`, `src/components/manageNav.ts`, `src/components/BottomTabBar.tsx` (Opus; bar and menu words never change without his yes) |
| W3-9 | `worker/src/mcp.ts` (Opus) |

## W4: the switch crawl

Not in yet. Placeholder: when W4's table is complete, its findings go into the ledger above with the same columns, and the gate line "no dead door in any state" is checked against it.
