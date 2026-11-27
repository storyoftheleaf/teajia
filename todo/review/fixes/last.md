Fixed by Opus 5.5 (cloud), in place of Astra.

# The last open findings before the ship: A11-4, A11-5, A11-7, A11-9, A11-10, A11-11, A8-6 and A8-7

Branch `review/fix-last`, from `review/gate`. Findings: `todo/review/findings/A11.md` and `todo/review/findings/A8.md`; ledger `todo/review/ledger.md`.

How to rerun: `NODE_OPTIONS=--experimental-sqlite node_modules/.bin/vitest run worker/tests/review-three-ways-in.test.ts worker/tests/review-credit-ledger.test.ts worker/tests/host-token.test.ts worker/tests/host-credit-spend-audit.test.ts`.

## For Adrian to confirm: two choices about tea credit

Both stay behind `HOST_CREDIT_OPEN`, which is closed on the live site. Nothing changes for anyone until it opens.

### A8-6: a staff seller cannot award credit on their own

**What I chose:** a staff seller can still mark an order Filled. If that order began from a host's thank-you, it earns no credit until you look at it. It waits in Manage, Tea credit, "Waiting on a second look", marked "marked Filled by your team", and your Approve lets the credit through. It also earns if you take the order out of Filled and mark it Filled again yourself. Your own Fill, or the platform owner's, earns as before.

- How it works: each Fill path (the order form, fulfil, ship, and the `fulfill_invoice` agent tool) asks `hostCreditStaffFill` whether the person filling is an owner of the shop. When they are not, the order's `host_credit_fills.filled_by_staff` is stamped, and `earnInvoiceCredit` holds the credit as pending until your approval (`POST /api/host-credit/invoices/:id/approve`, the same button the over-limit orders use). Taking the order out of Filled clears the stamp (a trigger in migration 0152).
- A Fill from before the record began (no `host_credit_fills` row) keeps the rule it was made under.
- **The other answer** would be to count a staff Fill as yours, which is how it worked before. To go back, stop passing `staffFill` at the four Fill paths.

### A8-7: voiding credit the host already spent never takes the ledger below zero

**What I chose:** when an order that earned credit is voided, only the part the host has not spent yet is taken back. If they already used it, the shop absorbs the difference. The host's balance stops at zero, so they owe nothing and their later earnings are theirs to spend at once. The amount the shop absorbed shows to you alone, in Manage, Tea credit, "Absorbed by the shop". Nobody is notified.

- How it works: `reverseAwards` in `worker/src/hostCreditLedger.ts` replaces the three places that wrote a whole reversal (a Void, the reconcile sweep, and a self-purchase found later). Each award reverses the smaller of itself and what its host has not spent, and the rest goes to the new `host_credit_shortfalls` table, one row per award. Each award is settled once. The integrity check accepts a partial reversal when its shortfall row makes up the difference.
- This replaces the earlier rule, "a reversal that exceeds unspent credit leaves debt that future earnings repay". Two tests in `worker/tests/host-credit-spend-audit.test.ts` recorded that rule, and the A8-7 test contradicts it directly (its signed ledger has to stay at zero or more). I rewrote them to the new rule.
- **The other answer** would be that the host owes the difference and later earnings repay it. That would mean keeping the debt outside the signed ledger, which is not built.

### Migration 0152

`worker/migrations/0152_host_credit_owner_fill_and_shortfalls.sql` (also added to `worker/schema.sql`) only creates and alters. It adds one column (`host_credit_fills.filled_by_staff`), one trigger and one table (`host_credit_shortfalls`), and it changes, adds or removes no existing row. 0150 and 0151 are taken on other branches.

## A11: the agent tools now do what the page does

- **A11-4** (`ANYONE_HOSTS_OPEN`): `host_table` accepts the `open` door when the host's reach allows it, and an optional `area`, checked by `readTableArea` and `areaGivesAwayTheWay` as the page checks it.
- **A11-5** (`FEW_HOSTS_OPEN`): in `fewHosts.ts`, `hostOf` keeps a stopped host who still has tables, as `hostedTableAccess` does. They can still say no, keep a note and set the teas. Making a table, and a yes to a guest, answer `hosting_stopped` in the preview and again on confirm.
- **A11-7** (`TEA_TABLE_OPEN`): `hold_tea_table_piece` follows the page's rule: the platform owner can hold any piece, and a host can hold their own session's recap. `release: true` lets go of a hold. `hide_tea_table_piece` takes `hidden: false` to show a piece again.
- **A11-9** (`ANYONE_HOSTS_OPEN`): `report` accepts `target_slug` for a session, resolved by `publicSessionIdBySlug`, the same query the report route now uses.
- **A11-10** (`HOST_TOKENS_OPEN`, and each page's own switch): there are new host tools in `worker/src/mcpTools/pageActions.ts`: `change_my_table`, `mark_who_came`, `get_guest_thanks_link`, `review_guest_book`, `set_table_way` and `ask_guest_back` (each also needs `FEW_HOSTS_OPEN`, and `ask_guest_back` needs `CIRCLES_OPEN` as well), `set_your_table` (`YOUR_TABLE_PLACE_OPEN`) and `offer_article` (`HOST_ARTICLES_OPEN`). These eight, plus `set_my_favourite` and `set_my_recap_on_tea_table`, are now in `HOST_SELF_TOOLS`.
- **A11-11**: there are new owner tools in the same module: `set_host_reach` (`FEW_HOSTS_OPEN` and `ANYONE_HOSTS_OPEN`), `list_reports` and `resolve_report` (`ANYONE_HOSTS_OPEN`), `review_article_offer` (`HOST_ARTICLES_OPEN`) and `list_tea_table` (`TEA_TABLE_OPEN`). Each one is for the platform owner only. The brief put A11-11 behind `FEW_HOSTS_OPEN` and `HOST_CREDIT_OPEN`, but none of these five pages is behind `HOST_CREDIT_OPEN`. I followed the rule that each tool stays behind the same switch as the page it mirrors.

### How the new tools keep the page's rules

Each tool in `pageActions.ts` is the page's own route, called as the person the token belongs to. `callPageRouteAs` in `worker/src/index.ts` signs that same person in for one minute, on their current session version, and calls only the route the tool names. The route then applies its own switch, ownership check, platform-owner check, stopped-host limits, validation and rate limits. Every write previews first: the preview reads what the page would read, and the confirm makes the call with a ticket from `tickets.ts`. Each tool is listed only while its page's switch is open.

### Tests I changed, and why

- `review-three-ways-in.test.ts`, A11-10 and A11-11: the finding names `YOUR_TABLE_PLACE_OPEN` and `HOST_ARTICLES_OPEN` as open, but the test's setup did not open them. The two tests now open them first. Their assertions are unchanged.
- `host-token.test.ts`: its written-out list of host-key tools now includes the ten tools above, and its setup opens the same two switches. This follows from A11-10. It also settles Conflict 2 in `todo/review/findings/A11.md` partly toward option B: only `set_my_favourite` joins. `set_tea_table_keep`, `take_my_tasting_off_tea_table` and `release_my_seat` stay off a host key.
- `review-older-data.test.ts`: its list of migrations now includes 0152.
- `host-credit-spend-audit.test.ts`: the two tests of the old debt rule now test the rule chosen for A8-7.
- `launch4-tools.test.ts`: it checked that a host key never lists `hold_tea_table_piece`. A11-7 lets a host hold their own recap, so the test now checks that a host sees `hold_tea_table_piece` but not `hide_tea_table_piece`. The handler still refuses a host any piece that is not their own recap.

## Still open

- W3-8, merged with A11-11 in the ledger: there are still no owner tools for credit decisions (approving or declining a spend, or an order over the limit). Those pages are behind `HOST_CREDIT_OPEN`. A11-11's test names only the five tools above.
