Repository storyoftheleaf/teajia, your worktree is at build/launch-1 with slices S3, S5 and S8 merged. Read only; you may run tests and write throwaway test files, but commit nothing. Return findings, each with a failing test or an exact reproduction, not a patch.

Two contracts were added in this launch. Find where they do not hold.

Contract A, the thank-you shows nothing its guest could not already see.
The after-sit recap (worker/src/afterSitAccess.ts, opened by a per-seat secret; see worker/tests/after-sit-access.test.ts) now also returns, per tea, a path to the tea's page, plus playlist_url, reading { slug, title }, thanks_ref, and kept per tea for a signed-in caller. Tea pages and offers are resolved by resolveSessionTeas in worker/src/sessionTeas.ts.
Evidence to produce:
1. A tea that is a product not public, not shown in shop, in a suspended or non-public account, or a holding in a host's private Tea Chest: prove the payload carries its name only and no path, id or owner that reveals more than the name the guest already had.
2. The party-link variant (worker/src/afterSitPartyLinks.ts) and the extra-link table return the same additions and no more.
3. After the attendance-correction triggers fire, after expiry, and after the host revokes: none of the new fields can still be read, and POST /api/after-sit/keep-tea refuses with the same answer as an unknown link.
4. reading: an article unpublished after the host picked it must stop appearing. Show what the payload does.
5. Responses stay private, no-store, no-referrer, noindex. The page's links to tea pages and to the article must not carry the seat secret in the address, the fragment or the referrer. Check how src/lib/afterSitAccess.ts strips the fragment and whether any new link is built before that happens.
6. kept: prove it cannot be used to learn anything about another user's chest.

Contract B, an order that began from a thank-you carries its session, and no other order does.
A thank-you's links to tea pages carry `via=<events.thanks_ref>`. The site holds that reference on the device (src/lib/orderVia.ts, rememberOrderVia and currentOrderVia; captured on load in src/index.tsx and sent by src/components/shared/PublicCart.tsx) and sends it as `via` on POST /api/inquiries. On the server, handleCreateInquiry in worker/src/index.ts wraps the saving handler (createInquiry) and calls recordOrderSessionSource once a 2xx answer carries the saved request id. After the order request is saved, recordOrderSessionSource (worker/src/orderSessionSource.ts) writes one row to order_session_sources (inquiry_id primary key, account_id, event_id, host_user_id). An invoice finds it through invoices.source_inquiry_id.
Evidence to produce:
1. createInquiry in worker/src/index.ts has several insert branches. Show that every branch that saves a request answers 2xx with the request's id (so the wrapper records it), that a replayed request answering with the first request's id writes nothing new, and that a branch that fails or rolls back leaves no row.
2. Replays. The handler has request fingerprints and a three-attempt retry loop. Show that a replayed or retried request writes one row, never two and never a row pointing at a request id that was not committed.
3. An unknown via, a via for a session in another account than the order, a via for a session that is not completed, a via longer than expected, and no via: no row, and the order itself is unaffected in every case. The order must never fail because of via.
4. The door in worker/src/mcp.ts (near line 8296) and the admin doors that create invoices directly: confirm none can write a source row, and say whether any should.
5. host_user_id is read from the session on the server. Show that nothing from the browser can set it, and say what it is when a session has several credited people.
6. The reference held with the bag: when is it cleared, can it attach to a later unrelated order weeks afterwards, and does emptying the bag clear it. State what you observe; the intended rule is "cleared when the order is sent, and ignored after 14 days".
7. Nothing reads order_session_sources to show, pay or rank anything yet. Confirm by search.

Return: a numbered list of findings with severity (wrong data, leaked data, or cosmetic), the evidence for each, and for the items that hold, one line saying how you proved it. Do not fix. If a finding depends on a product decision, state the decision needed in one sentence.

Working rules for every slice:
- You are in your own git worktree of storyoftheleaf/teajia on your own branch, made from build/launch-1. Commit nothing. Do not push and do not open a pull request; the build owner does that after checking your work.
- Launch 1 is behind one flag: src/lib/firstTable.ts, `FIRST_TABLE_OPEN` (false), read through `firstTableOpen()`. To see it on locally: VITE_FIRST_TABLE_OPEN=true for the site; FIRST_TABLE_OPEN=true when starting the worker sandbox.
- The local test shop: `TEAJIA_OFFLINE_FIXTURES_STATE=$PWD/.wrangler/ft FIRST_TABLE_OPEN=true npm run sandbox:offline:fixtures` (Node 22 and the sqlite3 CLI) loads worker/sandbox/first-table-fixture.mjs: one finished session "First table, a test sit" with three teas (one for sale, one public and not for sale, one plain name), two guests, one paid order. Its header lists every id, the two after-sit links and the guest sign-in (mei / mei). The operator signs in as sandbox / sandbox. Never use npm run dev: it points at the live shop.
- Ports 7777 and 8787 may be held by another worker. If they are, do not stop anything you did not start; run the unit tests and lint, and say the sandbox check is left for the build owner.
- Wording people read: plain, short, no em dashes, no new navigation words.
