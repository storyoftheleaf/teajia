Done by Sonnet 5.5 (cloud).

Checked: the SQL behind the nine new reads (Tea Table list and manage, favourites, journey and sessions, a host's tables and the public table page, tea credit and host credit, Know this tea, a person's top teas and photograph credit, circles), with EXPLAIN QUERY PLAN on the local fixture database (SQL assembled by running the real route and helper code against a recording stand-in for D1, so the shared fragments are exact).
Holds: every read by user, host, account or event id uses an index, and the heavy per-row lookups (holds, hides, seat counts, host credit by host) are indexed; three plans are bounded by an indexed outer loop and are fine.
Findings: 11 full scans of growing tables (all S3), each checked with the proposed index on a scratch copy of the fixture; no migrations written.

Caveat: the fixture has no `sqlite_stat1` and almost no rows, so SQLite picks plans from index shape alone. Every SCAN listed below is a scan the planner chose even with a usable-looking alternative absent, or one that no existing index can serve. They will not show as slow on the fixture; they grow with use.

## Plan table

| Read | SQL at (file:line) | Plan summary | Verdict |
|---|---|---|---|
| 1 Tea Table list, tastings | worker/src/teaTable.ts:188 (readTastings) | SEARCH contributors by idx_contributors_published, then shares by idx_member_tasting_shares_author, products/accounts/journal by primary key, temp b-tree for the order | fine (driven by published people, not by every share; see note A) |
| 1 Tea Table list, photos | worker/src/teaTable.ts:199 | SEARCH shares by primary key (the page's ids), photographs by idx_member_photographs_author_product | fine |
| 1 Tea Table list, recaps | worker/src/teaTable.ts:238 (readRecaps) | `SCAN e` (events), subqueries and joins by index | full scan of growing table (finding 1) |
| 1 Tea Table list, held pieces | teaTable.ts:188 and :238 with `hold: 'only'` | same two plans plus a holds lookup by primary key | recaps: finding 1 |
| 1 Questions inside the list | worker/src/knowThisTea.ts:98 and :155 | `SCAN q`, `MATERIALIZE np` over `SCAN p` (products) | full scan of growing table (finding 5) |
| 1 Your keeps and your own pieces (GET /api/tea-table/me) | worker/src/teaTable.ts:532, :535 | keeps by primary key prefix (user_id); own tastings by idx_member_tasting_shares_author | fine |
| 2 Tea Table manage, tastings | worker/src/teaTable.ts:608 | `SCAN s` (member_tasting_shares), joins by index; per row `SCAN k USING COVERING INDEX` on keeps | full scan (findings 2 and 3) |
| 2 Tea Table manage, recaps | worker/src/teaTable.ts:617 | `SCAN e` (events); per row `SCAN k` on keeps | full scan (findings 1 and 3) |
| 3 Favourites, articles | worker/src/favourites.ts:33 | SEARCH favourite_articles by primary key (user_id), articles by id | fine |
| 3 Favourites, shop teas | worker/src/favourites.ts:40 | SEARCH user_favorites by idx_user_favorites_user, products and accounts by id, temp b-tree for group and order (bounded by one person's favourites) | fine |
| 3 Favourites, cellar | worker/src/favourites.ts:52 | SEARCH personal_cellar_items by idx_cellar_owner | fine |
| 4 Journey, user and customer | worker/src/index.ts:25778, :25784 | user by primary key; customers SEARCH by idx_customers_account (account_id only, then filter user_id) | fine, but see note B |
| 4 Journey, compass entries | worker/src/index.ts:25802 | SEARCH tea_compass_entries by idx_compass_account_shelf_order (account_id) then filter user_id; idx_compass_user (user_id) also exists | fine (indexed; planner choice depends on statistics) |
| 4 Journey, sample tastings | worker/src/index.ts:25814 | `SCAN tst` (tea_sample_tastings); no index on taster_id | full scan of growing table (finding 10) |
| 4 Journey, sessions attended | worker/src/index.ts:25855 | `SCAN ea` (event_attendees); no index on customer_id | full scan of growing table (finding 8) |
| 4 Journey, tasting notes | worker/src/index.ts:25885 | `SCAN etn` (event_tasting_notes); the two unique indexes are partial on tea_menu_id, so an attendee_id IN list cannot use them | full scan of growing table (finding 9) |
| 4 Sessions list (GET /api/me/sessions, same SQL as /api/events) | worker/src/index.ts:12896 (upcomingListedSessions) | SEARCH events by idx_events_status (status only, see note C); per row `SCAN earlier_table` (events) inside listableHostedSessionSql; seat counts by idx_event_party_members_event_seat and idx_attendees_status | full scan of growing table (finding 7) |
| 5 A host's tables (GET /api/me/tables) | worker/src/index.ts:17010 (personalInventoryAccount), :17656 | accounts by idx_accounts_personal_inventory_user; events by idx_events_account (the host's own personal account only); three seat counts by idx_attendees_status | fine |
| 5 Stopped host's check (hostsAnyTable) | worker/src/hostRecord.ts:68 | accounts by idx_accounts_personal_inventory_user, then events by idx_events_account_lifecycle_date | fine |
| 5 Public table page, event row | worker/src/index.ts:12606 | events by slug unique index, accounts, venues by primary key | fine |
| 5 Public table page, seat counts and guest list | worker/src/index.ts:12632, :12647 | party seats by idx_event_party_members_event_seat, offers and guests by idx_attendees_status | fine |
| 5 Public table page, hosts | worker/src/index.ts:12668 with worker/src/sessionHost.ts:18 | event_contributors by event_id index; per row `SCAN ar` (articles) in the "effectively published" rule | full scan of growing table (finding 11) |
| 5 Public table page, circle and series | worker/src/circles.ts:268, :275 | events by uniq_events_id_account; others by idx_events_account_lifecycle_date (one account) | fine |
| 6 Tea credit balance (GET /api/me/tea-credit) | worker/src/hostCreditLedger.ts:394 (readBalances) | distinct keys by idx_host_credit_host, then correlated sums by idx_host_credit_host; the "not yet earned" check is `SCAN x` on host_credit_entries | full scan of growing table (finding 4) |
| 6 Tea credit lines | worker/src/hostCreditLedger.ts:442 (LINE_SELECT), :476 | pending rows by idx_host_credit_host; `SCAN e LEFT-JOIN` on host_credit_entries for the earned row of each line | full scan of growing table (finding 4) |
| 6 Tea credit requests and open orders | worker/src/hostCreditLedger.ts:483, :533 | requests by idx_host_credit_requests_host; orders by idx_invoices_payment_status (account), customers by unique key, line items by idx_invoice_line_items_invoice | fine |
| 6 Shop host credit (GET /api/host-credit) | worker/src/hostCreditLedger.ts:588, :594, :598, :633 | all by idx_host_credit_account or idx_host_credit_requests_account; same `SCAN e` and `SCAN x` as above in lines and balances | full scan of growing table (finding 4) |
| 7 Know this tea, list | worker/src/knowThisTea.ts:98 (QUESTION_SELECT), :155 | `SCAN q`, `MATERIALIZE np` from `SCAN p` (all products) with an automatic index, users/contributors/notes by primary key | full scan of growing table (finding 5) |
| 7 Know this tea, own questions | worker/src/knowThisTea.ts:168 | SEARCH by idx_tea_table_questions_asker | fine |
| 7 Know this tea, link lookup | worker/src/knowThisTea.ts:188 | multi-index OR on idx_products_slug and primary key | fine |
| 8 Top teas (GET /api/public/people/:slug/top-teas) | worker/src/index.ts:27432 | picks by primary key (contributor_id); the shop link is a LEFT JOIN subquery, planned as `MATERIALIZE public_tea` over `SCAN p` (all products) | full scan of growing table (finding 6) |
| 8 Top teas, profile check | worker/src/index.ts:27412 with worker/src/sessionHost.ts:18 | contributor by primary key; `SCAN ar` on articles | full scan of growing table (finding 11) |
| 8 Top teas, shop search (owner only, 2 characters or more) | worker/src/index.ts:27465 | `SCAN p` for the substring match, `instr(lower(...))` | accepted: a substring match cannot use an index, it is the owner's own screen, and it stops at 60 rows; no fix proposed |
| 8 Person's page tastings and "Photograph by" | worker/src/familyPersonTastings.ts:113, :121, :153 | shares by idx_member_tasting_shares_author; photographs by idx_member_photographs_author_created; products by primary key | fine |
| 9 Circles list (GET /api/me/circles) | worker/src/circles.ts:92, :96; account lookup :51 | series by idx_session_series_host; events by idx_events_account (the host's personal account) then series by primary key; account by idx_accounts_personal_inventory_user | fine (events side is per personal account) |

## Notes (not findings)

A. Tea Table list, tastings: the planner starts from published contributors and reaches shares by author, so the cost grows with the number of published people, not with the number of pieces on the table. With finding 2's index it can start from the table instead. Worth a recheck on live data rather than a change now.
B. Journey customer lookup uses `idx_customers_account` and filters by user. That is a SEARCH, but it walks the shop's customers. `CREATE INDEX idx_customers_user ON customers(user_id, account_id);` makes it a point lookup; not counted as a finding because it is not a full scan.
C. The sessions list searches `idx_events_status (status=?)`: nearly every event is 'active', so it reads them all and filters by date. `CREATE INDEX idx_events_status_date ON events(status, event_date);` turns it into a range from now (checked: `SEARCH e USING INDEX idx_events_status_date (status=? AND event_date>?)`). It also helps the public events list, which shares the query.

## Findings

### 1. Tea Table recaps scan every event
- Severity: S3
- Where: worker/src/teaTable.ts:238 (list, held and keyed reads) and worker/src/teaTable.ts:617 (manage)
- Plan line: `SCAN e` (events), then `USE TEMP B-TREE FOR ORDER BY`
- Why: the filter is `tea_table_at IS NOT NULL` and the order is `datetime(e.tea_table_at)`; no index starts with either.
- Smallest fix: `CREATE INDEX idx_events_tea_table ON events(datetime(tea_table_at) DESC) WHERE tea_table_at IS NOT NULL;` Checked: plan becomes `SCAN e USING INDEX idx_events_tea_table`, which walks only events that were put on the table, in the order asked.

### 2. Tea Table manage scans every tasting share
- Severity: S3
- Where: worker/src/teaTable.ts:608
- Plan line: `SCAN s` (member_tasting_shares)
- Smallest fix: `CREATE INDEX idx_member_tasting_shares_tea_table ON member_tasting_shares(datetime(tea_table_at) DESC) WHERE tea_table_at IS NOT NULL;` Checked: `SCAN s USING INDEX idx_member_tasting_shares_tea_table`. (Only the owner opens this screen, and it stops at 200 rows, so the cost is the scan before the limit, not the result.)

### 3. Tea Table manage counts keeps by scanning the whole keeps index, once per row
- Severity: S3
- Where: worker/src/teaTable.ts:600 (`keepsOf`, used at :608 and :617)
- Plan line: `CORRELATED SCALAR SUBQUERY ... SCAN k USING COVERING INDEX sqlite_autoindex_tea_table_keeps_1`
- Why: the primary key is (user_id, item_kind, item_id); counting by kind and id has no leading column, so each of up to 400 rows walks every keep.
- Smallest fix: `CREATE INDEX idx_tea_table_keeps_item ON tea_table_keeps(item_kind, item_id);` Checked: the scan disappears.

### 4. Host credit lines and balances scan the whole ledger per row
- Severity: S3
- Where: worker/src/hostCreditLedger.ts:394 (readBalances, `SCAN x`) and :449-451 (LINE_SELECT, `SCAN e LEFT-JOIN`); reached by GET /api/me/tea-credit, GET /api/host-credit, and the checkout offer (`readOwnAvailableInShop`)
- Plan lines: `SCAN e LEFT-JOIN` and `CORRELATED SCALAR SUBQUERY 1 / SCAN x`
- Why: the earned row is found by `kind = 'earned' AND invoice_line_id = ?`. The existing unique index `idx_host_credit_line_kind(invoice_line_id, kind) WHERE kind IN ('pending','earned','reversed')` is partial and SQLite does not accept `kind = 'earned'` as implying that list, so it is not used. Cost is rows times ledger size.
- Smallest fix, either one: `CREATE INDEX idx_host_credit_earned_line ON host_credit_entries(invoice_line_id) WHERE kind = 'earned';` or change the two `kind = 'earned'` terms to also say `AND e.kind IN ('pending','earned','reversed')` so the existing index qualifies. Checked the index: both scans become index searches.

### 5. Know this tea scans questions and reads the whole products table to show a few shop links
- Severity: S3
- Where: worker/src/knowThisTea.ts:104 (the `np` join inside QUESTION_SELECT), used by readTableQuestions at :155 on every Tea Table page when questions are open
- Plan lines: `MATERIALIZE np` over `SCAN p`, and `SCAN q` (the order is `datetime(q.asked_at)` so `idx_tea_table_questions_asked` cannot serve it)
- Smallest fix: (a) query change: replace the `np` subquery with `LEFT JOIN products np ON np.id = q.named_product_id AND np.is_public = 1 AND np.shown_in_shop = 1 AND np.status IN ('Active','Sold Out') LEFT JOIN accounts na ON na.id = np.account_id AND na.status = 'active' AND na.public_enabled = 1` (the row mapper already treats a missing account slug as no link). Checked: `SEARCH np USING INDEX sqlite_autoindex_products_1 (id=?)`. (b) `CREATE INDEX idx_tea_table_questions_shown ON tea_table_questions(datetime(asked_at) DESC) WHERE taken_off_at IS NULL AND hidden_at IS NULL;` Checked: `SCAN q USING INDEX idx_tea_table_questions_shown`.

### 6. A person's top teas read the whole products table on every public view
- Severity: S3
- Where: worker/src/index.ts:27432 (handleGetTopTeas)
- Plan line: `MATERIALIZE public_tea` / `SCAN p`, then `SEARCH public_tea USING AUTOMATIC COVERING INDEX`
- Why: a join inside a subquery on the right of a LEFT JOIN cannot be flattened, so every product is checked before the five picks are matched.
- Smallest fix (query change): `LEFT JOIN products p ON p.id = t.product_id AND <PUBLIC_PRODUCT_BASE_SQL> AND <PUBLIC_PRODUCT_DETAIL_STATUS_SQL> LEFT JOIN accounts a ON a.id = p.account_id AND <publicStoreIdentitySql('a')>`, selecting `COALESCE(p.slug, p.id) AS slug, a.slug AS store_slug`. The handler already shows no shop link when `store_slug` is null. Checked: `SEARCH p USING INDEX sqlite_autoindex_products_1 (id=?)` and a primary-key search on accounts.

### 7. The sessions list scans all of one host's events for every candidate session
- Severity: S3
- Where: worker/src/hostApproval.ts:211 (listableHostedSessionSql), called from worker/src/index.ts:12909 (GET /api/me/sessions and GET /api/events) and :12726
- Plan line: `CORRELATED SCALAR SUBQUERY ... SCAN earlier_table`
- Why: "is this the host's first table" looks up events by `host_user_id`, and events has no index on it.
- Smallest fix: `CREATE INDEX idx_events_host ON events(host_user_id, created_at) WHERE host_user_id IS NOT NULL;` Checked: the scan disappears. See also note C.

### 8. Journey finds attended sessions by scanning every attendee row
- Severity: S3
- Where: worker/src/index.ts:25855
- Plan line: `SCAN ea` (event_attendees)
- Smallest fix: `CREATE INDEX idx_attendees_customer ON event_attendees(customer_id);` Checked: the scan disappears.

### 9. Journey reads tasting notes by scanning every note
- Severity: S3
- Where: worker/src/index.ts:25885
- Plan line: `SCAN etn` (event_tasting_notes)
- Why: the only indexes that start with attendee_id are partial (on tea_menu_id), so `attendee_id IN (...)` cannot use them.
- Smallest fix: `CREATE INDEX idx_tasting_notes_attendee ON event_tasting_notes(attendee_id);` Checked: the scan disappears.

### 10. Journey finds sample tastings by scanning every tasting
- Severity: S3
- Where: worker/src/index.ts:25814
- Plan line: `SCAN tst` (tea_sample_tastings)
- Why: `taster_id = ? OR taster_id = ?` has no index on taster_id.
- Smallest fix: `CREATE INDEX idx_sample_tastings_taster ON tea_sample_tastings(taster_id);` Checked: the scan disappears.

### 11. "Effectively published" scans all articles per person
- Severity: S3
- Where: worker/src/sessionHost.ts:18 (CONTRIBUTOR_EFFECTIVELY_PUBLISHED_SQL), used by the public table page hosts (worker/src/index.ts:12668) and the top-teas profile check (worker/src/index.ts:27412)
- Plan line: `CORRELATED SCALAR SUBQUERY 1 / SCAN ar` (articles)
- Smallest fix: `CREATE INDEX idx_articles_author ON articles(author_id, status);` Checked: the scan disappears.
