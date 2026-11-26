Repository storyoftheleaf/teajia. Your branch is build/l1-s6-bought, made from build/launch-1 after slice S5 merged. Return a patch with tests, committed on your branch.

Contract: a signed-in buyer, looking at one of their paid orders, may put a tea line into their own Tea Chest with one tap. Nothing is ever written without that tap. One order line yields at most one chest row for that person, for ever, however many times and from however many devices they tap.

What exists:
- personal_cellar_items has source_kind, source_invoice_id, source_invoice_line_id, and a unique index idx_cellar_bought_once on (owner_user_id, source_invoice_line_id) where the line id is not null.
- worker/src/chestKeep.ts has the type BoughtOrder { userId, invoice, lines, payment, linkedToUser } and two stubs for you: `boughtLineChestState(db, order)` returning Map<lineId, { chest_item_id, can_keep }> and `keepBoughtLine(db, order, lineId)` returning the chest row or null. It also has keepSessionTea and a shared row mapping from slice S5: reuse that mapping for the row you return.
- The build owner already wired both: GET /api/me/orders/:id calls boughtLineChestState (flag open only) and puts chest_item_id and can_keep on each line; POST /api/me/orders/:id/keep-in-chest { lineId } (handleKeepOrderLineInChest in worker/src/index.ts) loads the order with the same ownership predicate, the lines joined to products (product_name, type, piece_weight_g, year, origin_country, origin_region) and resolveInvoicePayment, then calls keepBoughtLine; null becomes 409. Read both handlers before you start. `linkedToUser` is true only when the order's customer row is linked to this user. The site calls it through api.me.keepOrderLineInChest(id, lineId) in src/lib/api.ts.
- Orders a person owns are found by loadMyOrderOwnership and MY_ORDER_OWNERSHIP_SQL in worker/src/index.ts (near line 23926). It matches by the linked customer row, then by email, then by phone.
- Lines are invoice_line_items: product_id (nullable), custom_name, quantity, quantity_unit ('g' or 'unit', sometimes NULL on older rows), price_at_sale. Payment state is resolved by resolveInvoicePayment, never by reading invoices.payment_status alone.

The risk, precisely: this takes a fact from the shop's books and writes it into a person's private chest. It goes wrong when the order is not really theirs, when the line is not a tea, when the quantity is not grams, when the order's state changes afterwards, or when the same tap lands twice.

Cases you must settle, each with a test in worker/tests/chest-keep-bought.test.ts and one sentence of reasoning:
1. Two taps at once, and a retry after a timeout: one row, and both calls answer with it.
2. An order matched to the user only by phone or only by email, not by the linked customer row. State whether can_keep should be true, with the evidence from MY_ORDER_OWNERSHIP_SQL for how strong each match is. Default if unsure: offer it only on the strongest match, and say so.
3. A line with quantity_unit 'unit' that is a tea (a cake, a can) and has piece_weight_g on its product (products.piece_weight_g, what one piece weighs); one without it; a teaware line; a line with custom_name and no product. Grams are never invented: where grams cannot be known, either refuse or store what is true, and say which you chose and why.
4. A line with quantity_unit NULL on an older row. Read how handleGetMyOrderDetail infers it and match that, in one shared helper, not a second copy.
5. An order that is unpaid, cancelled, awaiting refund, or deleted (deleted_at). An order refunded after the tea was kept: the chest row is the person's own record and stays; confirm nothing else reads it as proof of purchase.
6. The person deletes the chest tea, then taps again.
7. The chest row's cost. chest_cost_amount is the person's own private note of what they paid. The price is known here (price_at_sale, in USD, times quantity). Repository rule: every cost states its currency, and nothing is invented. Either store the amount with currency USD or store nothing; pick one, justify it from docs/claude/money.md, and never store an amount without its currency.
8. Another signed-in user calling the route with someone else's invoice id and line id: the same answer as an unknown order.

Also change src/pages/OrderDetailPage.tsx: beside each line where can_keep is true, a quiet button "Add to my Tea Chest"; where chest_item_id is set, the plain words "In your Tea Chest" linking to /account/cellar. Hidden entirely when FIRST_TABLE_OPEN (src/lib/firstTable.ts) is false. Safe colour tokens only, tap-target on small controls, no em dashes.

You own: the additions to worker/src/chestKeep.ts, src/pages/OrderDetailPage.tsx, worker/tests/chest-keep-bought.test.ts.
Do not touch: worker/src/index.ts, worker/migrations/, src/lib/api.ts, the shop's order and payment code. If correctness needs a change there (for example exporting the ownership predicate), bring back the exact lines and the reason; the build owner makes that change.

Existing tests that must still pass: worker/tests/customer-order-detail.test.ts, worker/tests/order-journey.test.ts, worker/tests/website-order-lifecycle.test.ts. Run npm run lint, npm run lint:worker-types, npm run lint:colors.

Return: the patch, the test output, and a short table of the eight cases with the decision taken for each. Anything that is a product decision and not a correctness one comes back as a question with your recommended default already implemented behind it.

Working rules for every slice:
- You are in your own git worktree of storyoftheleaf/teajia on your own branch, made from build/launch-1. Commit your work on that branch with a plain message. Do not push and do not open a pull request; the build owner does that after checking your work.
- Launch 1 is behind one flag: src/lib/firstTable.ts, `FIRST_TABLE_OPEN` (false), read through `firstTableOpen()`. To see it on locally: VITE_FIRST_TABLE_OPEN=true for the site; FIRST_TABLE_OPEN=true when starting the worker sandbox.
- The local test shop: `TEAJIA_OFFLINE_FIXTURES_STATE=$PWD/.wrangler/ft FIRST_TABLE_OPEN=true npm run sandbox:offline:fixtures` (Node 22 and the sqlite3 CLI) loads worker/sandbox/first-table-fixture.mjs: one finished session "First table, a test sit" with three teas (one for sale, one public and not for sale, one plain name), two guests, one paid order. Its header lists every id, the two after-sit links and the guest sign-in (mei / mei). The operator signs in as sandbox / sandbox. Never use npm run dev: it points at the live shop.
- Ports 7777 and 8787 may be held by another worker. If they are, do not stop anything you did not start; run the unit tests and lint, and say the sandbox check is left for the build owner.
- Wording people read: plain, short, no em dashes, no new navigation words.
