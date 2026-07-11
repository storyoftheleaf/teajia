# Teajia Deep Analysis: What the Build List Is Actually Hiding

**Date:** 2026-07-11. **Status:** Private beta, no public users, no real transactions.
**Sources:** `.context/build-classification.json`, `docs/tracks/01..09`, per-clump code investigations of `worker/src/index.ts`, `worker/src/mcp.ts`, `src/`, plus read-only queries against production D1. Every claim below is marked CONFIRMED (seen in code or prod) or HYPOTHESIS (with how to verify).

---

## 1. Executive Read

You asked for the disease behind each symptom. The deep pass found five diseases, and none of them is a missing feature. They are all the same kind of thing: systems that were designed, half-built from one end, and never once run all the way through.

### The five biggest realizations

**1. The money system has never carried real money, and that window is your biggest asset.**
Production has exactly 4 invoices and 6 line items. Nothing is corrupted yet. But the deep pass proved that the first time money flows for real, three things break at once: the collection-order flow stores an inflated price (a customer who agrees to one number produces an order showing a number up to 50x larger), the wholesale flow shows the buyer and the seller totals that differ by a factor of 100, and the admin revenue chart has never rendered for anyone because it asks the database for a column that does not exist. The fix is not a patch. It is writing down, once, what the price field means, fixing the one writer that got it wrong, and then running one complete self-test order through both loops before Australia onboards. Everything money-related is fixable today at zero cost. That stops being true the day a real order exists.

**2. The wall between stores has never been leaned on.**
There has only ever been one operator (you) on one device. So: new stores are born publicly visible by default (that is why Teajia Australia is live, listed, and empty), the test suite that claims to test account isolation structurally cannot represent two accounts, and the phone-side storage for captures, notes, and the pricing ledger is shared across whoever is signed in on a device. On a shared device, one account's unsaved captures can be silently written into another account's data. None of this has bitten because there is no second human yet. Jesse is the second human. Close the boundary before he arrives, not after.

**3. Two live security holes were hiding under a boring-sounding checkbox.**
The item "ship verification-code delivery" turned out to be sitting next to two real problems. First: when the password-reset email fails to send, the system hands the reset key directly back to whoever asked for it, meaning anyone who knows an email address can take over that account whenever the email service hiccups. Second: anyone who knows a guest's phone number can retrieve that guest's private access token, and with it read and edit their RSVP and event history, no code required. Both are live in production right now. Neither is on any build list by name.

**4. A surprising amount of the app is theater: it reports success while doing nothing.**
The verification system says "code sent" and sends nothing. The event post-session editor says "saved" and writes blanks. The product inquiry email form says "sent" and writes the message into a browser storage slot nothing ever reads. The reading-history and saved-articles pages are permanently empty by construction. The admin revenue chart fails silently on every load and shows nothing. The common thread: failures are swallowed, so nobody noticed. The build-properly mandate here means making failure visible, not just fixing the individual instances.

**5. Old generations of the product were never buried.**
There are two article engines (one dead but still receiving taps, which is the blank-screen bug), four generations of "member home" page (three orphaned), two tasting-note systems that cannot see each other, two community-voice systems on the product page, and two parallel representations of a member's tasting notes that silently overwrite each other. Most of the "small bugs" on the list are debris from these half-finished replacements. The fix in each case is a decide-once burial, not a patch.

### If you only do three things

In this order, exactly as the clump map says:

1. **The invoice money spine.** Fix the one wrong price writer, write the price contract down, repair the wholesale loop's four confirmed breaks, then run one self-test order end to end through retail and wholesale. Done before Australia onboards.
2. **The account boundary.** Flip Australia private today (one command), change the default so new stores are born private, build the two-account isolation test harness, and key the on-device stores per account.
3. **Code delivery.** One shared email-sending layer with correct links, honest failures, and durable rate limiting. Close the password-reset echo and the token-by-phone-number hole in the same pass, because they are the same subsystem.

### The single most dangerous thing hiding in the list

The password-reset fallback. It exists because the system was once a single-tenant internal tool and the comment saying so is still in the code. Today it means: any account, including your owner account, can be taken over by anyone who knows the email address, on any day the email provider fails, rate-limits, or has its key rotated. It costs about an hour to remove. It should be the first line of code changed from this entire document.

---

## 2. The Clumps

### Clump 1: Invoice money spine (priority 1)

**Plain intro.** One database field stores the price at the moment of sale. Four different flows write it, more than a dozen read it, and no document says what unit it is in. One writer got the unit wrong, the author documented the wrong belief in a migration comment where it will mislead the next reader, and the wholesale flow (which has never run once) is wrong in four additional ways. Prod state, verified read-only 2026-07-11: 4 invoices, 6 line items, 0 confirm-picks invoices, 0 wholesale orders. **Nothing to repair yet. Entire clump is preventive.**

**Execute lane (safe to just do):**
- Per-order detail page. Sequence it AFTER the price contract lands, and build it on the shared total helper so it becomes a free regression check (it would otherwise be the 10th hand-rolled sum).

**Investigate findings (all CONFIRMED unless marked):**

*K1, confirm-picks inflation.* `handleConfirmCollectionPicks` (`worker/src/index.ts:16113-16226`) computes a correct line total then stores it into `price_at_sale` (:16204), a field every other writer and reader treats as per-unit. Smoking gun: `worker/migrations/077_collection_item_recommendations.sql:11-13` documents the field as "also a line total," in writing, wrongly. Every reader re-multiplies by quantity (worker :2832, :4194, :12997; `mcp.ts:861-1002`; `OrdersView.tsx:836-940`; `InvoicePdf.tsx:128,177`; more in the census below). All three pricing branches wrong when quantity > 1. The customer sees the correct total client-side (`PublicCollectionPage.tsx:617`); the operator's draft diverges immediately. The planned repair script is retired: 0 corrupted rows exist, and the planned identifier would have re-corrupted operator-edited invoices anyway (`handleUpdateInvoiceItems` :3605 deletes and reinserts per-unit).

*Writer census.* Correct per-unit writers: :2865 (create), :3634 (edit), :9283 (post-event, zero placeholder), `mcp.ts:1408`, `LedgerView.tsx:434`. Wrong: :16204 only.

*Siblings found while hunting (worse than K1):*
- **S1:** revenue analytics (:14641) and customer RFM (:14670) query `SUM(invoices.total_usd)` with `status='fulfilled'`. Prod schema has no `total_usd` on invoices and the status domain is `Draft|Pending|Filled|Void`. Both endpoints 500 on every call; `DashboardView.tsx:41-45` swallows it. The revenue chart has never rendered for anyone.
- **S2:** Draft invoices count as money. `total_spent_usd` (:4194) filters only `!= 'Void'`; `/api/me/orders` (:12991) has no status filter. A public confirm-picks draft inflates a customer's lifetime spend instantly.
- **S3:** `POST /api/public/c/:slug/confirm` (:18381) creates invoices with no rate limit while login/signup/verify all have one. Anyone with a link can spam a customer's order history and burn the invoice sequence.
- **S4 (minor):** create-invoice accepts arbitrary client-supplied `status` (:2893).
- **S5 (minor):** favorite-types query (:7158-7164) joins invoices with no `account_id` filter, the only unscoped invoice read found.
- **S6 (HYPOTHESIS):** one prod Void line item has `display_currency='NT'`, `price_at_sale=28`, plausibly NT/g typed into a USD field. Ask Adrian what that order was.

*Wholesale loop (the "just run it" item that cannot pass its own test):*
- **W1:** 100x unit mismatch. Catalog and server are per-gram end to end (:16466-16528, :17421-17423); `WholesaleOrderDraft.tsx:341,551` consumes the same number as per-100g. Buyer approves a subtotal 100x smaller than the server stores and the supplier sees.
- **W2:** the bilateral invoices (:17803-17820) are shells: zero line items (every reader shows $0), status `'Paid'` (outside the domain), `payment_status` left `'unpaid'`, invoice number minted outside `invoice_seq`.
- **W3:** no `stock_ledger` writes anywhere in the wholesale path (grep-verified), violating the standing intake invariant (PURCHASE_RECEIPT + batch, never NULL). Supplier grams vanish with no trail.
- **W4:** double-receive race; final UPDATE has no `AND status='shipped'` guard. Fix is the conditional-UPDATE pattern already at `mcp.ts:1352`.
- **W5:** no stock-availability check; `MAX(0,...)` silently absorbs overselling.
- **W6 (latent):** `rebuildOrderTotals` (:17335) sums mixed-currency line totals into one labeled figure; schema explicitly permits the mismatch.
- **W7:** received stock lands as a listing with no `products` row (:17777-17786), so it cannot enter the buyer's retail invoice/fulfillment spine. Mechanics CONFIRMED; severity is HYPOTHESIS (no sell path reads listings that I found).
- **W8 (accepted risk, note it):** `unit_price_amount` is entirely client-supplied; supplier's human confirm is the only control.

**Ship-together rule.** The proper output is two artifacts, not N patches: (a) a written contract for the money fields (schema comment + corrective migration note superseding 077), enforced at every writer and consumed through one SQL total fragment and one frontend `invoiceTotal()` util; (b) a repeatable end-to-end money self-test (retail confirm-picks → promote → fulfill → detail page; wholesale draft → receive → both invoices, ledger rows on both sides), run before onboarding and after any invoice-touching change. Recommend AGAINST a stored `line_total` column (a second money number per line just creates a new pair that can disagree). This clump gates Australia onboarding and doubles as the tenancy-isolation rehearsal.

---

### Clump 2: The account boundary (priority 2)

**Plain intro.** The multi-tenant boundary exists in three layers (server authorization, client device storage, public exposure) and each leaks differently, all for one root cause: only one operator and one device have ever used it.

**Execute lane:**
- Render the readiness first door in Your Table: `AccountPanel/index.tsx:697,715` already compute `isFirstDoorCandidate` and `firstDoorReadiness` and throw both away (CONFIRMED dead computations). Wire the card.
- Fix the mobile test harness: `@playwright/test` is not in devDependencies or node_modules (CONFIRMED); `npm run test:mobile` cannot run. Add + install (and remember Playwright needs `dangerouslyDisableSandbox`).
- "Today" briefing card: `AdminHomeView.tsx:98-108` already aggregates the badges; explicitly low priority, do last.

**Investigate findings:**

*A. Isolation test suite.* The mechanism is genuinely good: `getActiveAccount` (worker :463-590) re-verifies membership against the DB per request. The proof is absent: `worker/tests/auth-boundaries.test.ts` runs against a `FakeDb` string-matcher hardcoded to a single `acc_test`, so it structurally cannot test cross-account isolation and would pass while returning account B's rows to A. Real harness needed (better-sqlite3 in-memory with real migrations, or Miniflare D1), seeded with two accounts, asserting reads AND writes across customers, invoices, events, products, collections, compass, samples, wholesale. Highest-value targets found during the audit, all CONFIRMED:
- `handleGetSample` :10085 and sample sets :10109: `WHERE id = ?` only (may be intentional for public shares; the test must assert cost/source stripping).
- Tasting journal (:10688, :10721, :10757) and `tea_reviews` (:10630) are user-scoped, not account-scoped. Probably by design; encode the decision in a test.
- `loadWholesaleOrder` :17321 and `handleUpdateAccount` :11348 enforce isolation in JS guard clauses, not SQL. A future refactor that drops the guard silently exposes everything; the tests are the tripwire.

*B. Customer route bundle drift.* Verified gate table: editing a customer requires the events bundle (`gather`) while reading their orders requires `sell`; a seller can see orders but cannot fix a phone number. The taxonomy doc explicitly forbids flattening to one bundle (customers are buyers, vendors, guests, contributors in one row). Pragmatic fix: a new `requireAnyBundle(['sell','gather','catalog'])` on PUT/DELETE. Also drift the doc missed: the full customer list (:4162) and RFM (:14670) are `requireAccount` (any viewer sees all commerce intelligence) while narrower reads are stricter. Decide the whole family once, lock it with bundle-boundary tests.

*C. Curate integrity.* Sharpest finding of the clump. `teaCompassStore.ts:330` persists under fixed key `'teajia-compass'`; `useCompassSync.ts:20-24` documents the exact hazard in a comment and the guard was never added. Traced bleed: account switch does not re-hydrate (hook keys on `isAuthenticated`, not account); hydrate merges "local unsynced wins"; the 2s debounce then pushes account A's unsynced captures **into account B's server table** under B's JWT. Not display-only: cross-tenant persistence. CONFIRMED siblings with the same account-blind key: `notesStore.ts:166`, `ledgerStore.ts:238`, `store.ts:619` (holds the tasting journal mirror). CONFIRMED: nothing clears any of them on logout either, so the bleed also crosses different HUMANS on a shared device. Proper fix is one shared account-scoped persistence primitive (key = user:account, cancel pending debounce, flush-then-clear on switch, fan-out clear on logout) applied to all four stores. The bundled P1 (dead `/admin/sources` and `/admin/personal` nav: redirects at `AdminApp.tsx:788-789` land on wrong tabs, and non-owner admins cannot reach Sources at all per `PeopleView.tsx:24,38,43-46`) is 20 minutes of routing, a different disease. Split them.

*D. Australia public-and-empty.* Root cause is not the flag, it is the default: `handlePlatformCreateAccount:12365` and `PlatformAdminView.tsx:611` make new accounts **born public**. The directory (:12736) gates only on `public_enabled=1 AND status='active'`, no products/members/contact check. Per-product exposure is well-gated; the hole is the account directory. Fix: flip Australia private now (one UPDATE), change the create default to private, and optionally hide zero-inventory accounts from the directory. The readiness computation that should gate go-live already exists (`buildFirstDoorReadiness`, `AccountSettingsView.tsx:498-509`) and is connected to nothing. HYPOTHESIS: exact prod state (0 products/0 members/no contact) is from the track doc; the confirming one-line D1 query is in the appendix.

---

### Clump 3: Getting a code to a human (priority 3)

**Plain intro.** The platform has an email helper serving six flows, an OTP generator, reset tokens, and invite tokens, but no shared, correct way to get a secret from the worker to a human and back. Every flow that tried independently broke in a different place.

**Execute lane:**
- C6 China auth fallback copy hint on the five auth surfaces. BUT: it is blocked on this clump's link fix, because the recovery path it advertises is currently dead (below).
- Distributed rate limiting: `handleVerifyRequest` (:9800) and `handleRedeemJoinCode` (:13769) still use per-isolate `checkRateLimit`; the durable `LOGIN_LIMITER` pattern (wrangler.toml:51-69, wired :1176) is copyable. Fold into the delivery PR and extend to forgot-password and find-rsvp, which the original item omits.

**Investigate findings (all CONFIRMED in code):**

- *The named gap:* `handleVerifyRequest` (:9797) generates and stores the code and never calls `sendEmail` (:11752, already used by six flows with prod keys per Track 4). Only the dev echo (:9867) ever reveals it. No WhatsApp infra exists anywhere. HYPOTHESIS: `DEV_RETURN_VERIFY_CODES` unset in prod.
- *Delivery alone unlocks a broken page:* `handleVerifyConfirm` (:9875) mints no session credential; `VerifySheet.tsx:66` expects one (`?? ''` always fires); `handleGetJourney` then 401s. The item is really "finish the quiet-account loop," of which the email send is one line.
- *Sibling 1, dead reset link:* `handleForgotPassword` builds the URL from `request.url` origin, which behind the Pages proxy is always the workers.dev host; the emailed link 404s (and is GFW-blocked for the China user C6 serves). The correct `env.APP_URL` pattern sits 80 lines away in the OAuth callback with a comment about this exact trap. This falsifies Track 4's premise that password reset already covers a locked-out Google user.
- *Sibling 2, THE WORST FINDING:* forgot-password returns `{email_sent: false, token: resetToken}` to the unauthenticated caller when Resend fails (:1769-1780), guarded by a stale "single-tenant internal tool" comment. Account takeover primitive conditional only on email failure.
- *Sibling 3:* forgot-password has no rate limit and leaks account existence; verify-confirm's 3-attempt counter has a read-modify-write race.
- *Sibling 4:* all four owner/operator invite flows email `/invite/<token>` links that `GuestInviteClaimPage` can never claim (wrong token table); the only consuming endpoint is `/api/auth/reset-password`, which nothing generates links to. HYPOTHESIS on impact: Jesse may have onboarded via a manual path; click a fresh invite link to confirm.
- *Sibling 5:* `https://teajia.app` hardcoded in three emails (HYPOTHESIS whether that domain is even owned); tea-master invite uses worker origin.
- *Sibling 6:* `handleFindRSVP` (:6801) and the existing-attendee RSVP path (:6336) return `magic_token` to any unauthenticated caller who knows a phone (last-9-digit fuzzy match), no rate limit. The token grants read/write on the RSVP and the whole journey. The verify system was designed to gate exactly this and never shipped, which is why the bypass exists.
- *Sibling 7:* OTP uses `Math.random()` while `generateJoinCode` next door uses `crypto.getRandomValues`; codes/tokens stored plaintext; fail counter smuggled into the code column as `"N:123456"`.

**The proper shape:** one `appUrl(env, path)` helper for every emailed link (kills siblings 1, 4-URL, 5 in one move); the verify email send with honest failure semantics (never echo, never silent-success; today the frontend advances to the code step regardless); a short-lived contact-scoped token from confirm; durable rate limiting in the same PR; gate or throttle find-rsvp; WhatsApp leg stays out of scope but must degrade honestly instead of silently succeeding.

---

### Clump 4: Kill the second article engine (priority 4)

**Plain intro.** Three generations of reading architecture; generation 1 was half-deleted in the Phase E cleanup, leaving click handlers that route into a view state whose renderer was removed. That is the blank-screen bug, and the reading-memory shells, and the resurrection-by-old-localStorage behavior that no fresh test device can reproduce.

**Execute lane:**
- R5 owner edit pill: `storyEdit.tsx:73-75` reads store state that is never hydrated on public cold loads; `ReadIndex.tsx:302-326` already decodes JWT claims directly. Extract one shared `useIsOwnerFromToken()` and use it in both.
- R8 dead reader sweep: `ReadPage`, `ReadableCard` zero importers; `SinglePageRenderer` only via dead `Reader.tsx`; `ReadingStreak` only via an unimported barrel (all CONFIRMED). Must land WITH R1, since `Reader.tsx` is also the writer of the dead history key.

**Investigate findings (all CONFIRMED unless marked):**

- *R1 mechanism:* `App.tsx:427-428` and :556-558 set `viewState='PAGE_READER'`; no render branch exists (:1106 is just a comment). No `navigate()` call, so Back does nothing; only tapping a different tab resets. Live triggers, by severity: (1) every Craft curriculum lesson tap (hardcoded Article-type lessons in `constants.ts`, deterministic on every fresh device); (2) global search "Journal" hits on stale devices, because `StoryContext.tsx:18-35` merges localStorage `teajia_stories` over the code array with no version stamp, permanently resurrecting deleted pre-Phase-E articles; (3) product-card "From the journal" rows (dead on fresh devices since no shipped essay has a `teaId`, blank-screen on stale ones); (4) `/magazine-archive`.
- *The track doc's suggested fix is impossible:* `Story` has no slug and the lessons never existed in D1; there is nothing to route a legacy Article click TO. The real fix is finishing the amputation: remove the branches and the `PAGE_READER`/`READER` states (the `READER` render branch has zero setters, the mirror-image corpse), decide the curriculum's fate, delete StoryContext's localStorage layer and purge the key on boot.
- *DO-NOT-BUILD violation live:* `LearnCurriculum.tsx:103-107,182-185` computes and renders a day-streak badge. Comes out immediately regardless of anything else.
- *R2-R4/R6 reading memory:* fully audited key table: `teajia_progress_*` (writer unreachable, reader is the history page: dead pair); `teajia_article_*` (live resume in the carousel reader, never read for history, written unconditionally on mount including page 0); `teajia_saved_stories` (writer uses legacy ids, reader expects DbArticle ids: disjoint by construction, both pages silently filter the mismatch); `teajia_watched_stories` (feeds the banned streak); `teajia_stories` (pure liability). Beyond the doc: no live reading surface has a save affordance at all, and only one of three live readers writes progress. "Wire it" is a 1-2 day account-backed feature (no `/api/me` reading endpoints exist), which belongs inside the later My Tea Life design. The wrong move is the middle path (repointing keys), which yields history-of-everything-opened and saves that still cannot be created.
- *R6 drafts:* the `live` flag gates only the index listing; draft routes render for anyone, and the cross-link audit found MORE live-to-draft links than the track doc (`TastingVocabularyOfTaste.tsx:310`, `CraftRenewalPorcelain.tsx:26-28` additions). Fix must be systemic: one exported `LIVE_PIECES` map driving both the route gate and per-page next-links, or it re-drifts on the next publish flip.
- HYPOTHESES: stale-device prevalence (check beta devices for `teajia_stories` Article entries); R5 mechanism explaining all field reports (cold-load repro steps in appendix); DbArticle id shape vs legacy ids (structurally irrelevant).

---

### Clump 5: Every byte through the GFW (priority 5)

**Plain intro.** One root cause: the app assumes the browser can reach arbitrary third-party hosts. The proven cure is the same-origin proxy. Six of eight items are that cure mechanically reapplied. The two investigate items are where the cure is not a proxy rule: checkout hand-off (a destination, not a fetch) and writes made while the network is failing.

**Execute lane (batch these):**
- C2 rehost Unsplash/picsum onto owned media (`functions/media/[[path]].ts` orphan delete rides along).
- C4 kill hardcoded `https://api.teajia.com`. Census is larger than the doc: `BriefingPage.tsx:21-23`, `McpPage.tsx:5-9`, PLUS `InquiryForm.tsx:162` (raw fetch on `VITE_API_URL`, bypassing the same-origin base and retry logic), and raw `VITE_API_URL` reads in `OAuthConsentView.tsx:20`, `MCPTokensView.tsx:49`. Verify the Pages build env once for all (HYPOTHESIS: whether `VITE_API_URL`/`VITE_WHATSAPP_NUMBER` are set there).
- C5 proxy MCP through the reachable origin (shares the llms.txt line with C4).
- Groq voice leg verification + raw-audio fallback (the worker half of the media outbox below).
- Dead preconnect + stale service-worker cache rules (`vite.config.ts:49-68`).

**Investigate findings:**

*C7 checkout fallback (CONFIRMED census).* The hand-off channel is a hardcoded transport, not a store capability. Three phone sources coexist: per-store `whatsapp_number` (2 surfaces), build-env `VITE_WHATSAPP_NUMBER` (7 surfaces, silently recipient-less if unset), one hardcoded literal (`PublicCart.tsx:14`). Only PublicCart has a non-WhatsApp path, and its email fallback opens `mailto:` with NO recipient (:225) even though `accounts.contact_email` exists and is editable. Worse black hole: `ProductInquiry.tsx:42-44`'s email channel writes to `localStorage['teajia_inquiries']`, which nothing ever reads; the customer's message vanishes with a success state. Tenancy sibling: `api.inquiries.create` never sends the store, so `handleCreateInquiry` (:7865) scopes every inquiry to Teajia Bali; Jesse's paper trail would land in Adrian's inbox. WeChat groundwork exists on customers/venues/vendors but not accounts, and the codebase already knows the constraint ("WeChat has no reliable web link," `VendorStrip.tsx:781`): the fallback is a show-ID/QR/copy card, not a link. Proper shape: `accounts.wechat_id` migration + one shared CheckoutHandoff component consuming the resolved store, replacing ~12 call sites; persist the inquiry server-side with store scoping BEFORE opening any channel; CN promotion via the free `CF-IPCountry` edge signal (currently unused anywhere). Adjacent PII hole: `handleGetInquiryByRef` (:7913) is unauthenticated and unscoped, refs are low-entropy (900/day) and reused forever per browser (never cleared). MCP `prepare_order` should return the channel set, not just wa.me.

*Offline write queue (the premise is false).* Track 8's "no offline mutation queue exists, grep-verified" is wrong: `offlineSync.ts` + `useOfflineSync` IS one, and it is broken for the GFW (only enqueues when `navigator.onLine === false`; GFW failures happen while online), silently drops after 3 retries, has a dead handler type, and double-covers favorites. The pattern that works is the compass synced-flag store (flags, tombstones, 30s heartbeat, visible `syncError`); notes and journal sync are weaker copies. Media has NO durable path: failed photos survive only in memory ("photo lost this round" comment, `PhotoCapture.tsx:292`), failed voice recordings are discarded (`useVoiceCapture.ts:79-99`). The real work: (1) converge notes/journal/favorites onto the compass-grade core and DELETE offlineSync; (2) an IndexedDB media outbox (the only part needing IndexedDB), flushing on heartbeat since iOS has no Background Sync; this is the client half of the raw-audio fallback item; (3) a decision, not code, for one-shot writes: inquiries need server-side idempotency (client id + upsert) before any queueing; admin money writes stay fail-loud (replaying `POST /api/inquiries` duplicates rows today). Any queue MUST stamp account+user at enqueue time or it multiplies the Curate P3 bleed.

---

### Clump 6: One table for tea I've touched (priority 6)

**Plain intro.** The clump says two tables; the code has four surfaces for "tea I've touched" (products, compass entries, the customer journal keyed by EMAIL not user id, and the personal cellar, whose code comments argue against merging). The accept-share bug is one of FOUR server flows that write tea into a place the recipient can never see, all descendants of the killed social plan.

**Execute lane:**
- Permission gate: the six compass handlers plus the wider family (shares, notes sync, feedback, table share, gift sample) are `requireAccount`-only while the client already gates on the catalog bundle (`AdminApp.tsx:671-677`), the classic client/server disagreement. Copy `requireBundle` from :2051/:2141. CAUTION: do not gate the receive endpoints (incoming/accept/claim) behind catalog; receiving belongs to the journal design. The sidebar Curate child link is confirmed still un-gated (`LeftSidebar.tsx:212`).
- Currency map consolidation. Deeper than nine literals: two live vocabularies (admin `NT/Yuan/...` vs shop ISO), promotion copies one into the other (:8856), and `addPricingFields` does `rates.get(currency) || 1` (:1129), silently treating unknown currencies as USD, a ~32x cost error for NT. One shared map module, and make unknown-currency pricing fail loudly.

**Investigate findings (CONFIRMED unless marked):**

- *Accept-share:* `handleCompassAcceptShare` (:10378) inserts into `tea_compass_entries` `status='incoming'`, visible only in admin Curate, which members cannot reach. Sibling copy-paste path the doc missed: `handleCompassClaimInvite` (:10460), behind the public "Save to my journal" link. Deeper: the advertised new-member flow dies at auth before the wrong-table bug even fires (signup creates zero memberships; `requireAccount` 403s). Deepest: the journal table structurally cannot receive a shared tea (requires `product_id`, no `tea_key` column), so "write to the journal instead" is a schema decision, which is why this belongs inside the unification. Identity mismatch: journal `user_id` is an email, compass `user_id` is a user id.
- *The other two flows swallowing tea:* post-fulfillment queue population (:3169-3212, status `'available_to_taste'`, rendered nowhere a member can see, with an arbitrary `LIMIT 1` membership pick) and `handleGiftSample` (:14192, same pick, falls back to the GIFTER's account, and names columns that do not exist).
- *Dead-on-arrival kill-set:* `handleGiftSample`, `/me` profile/queue/wishlist handlers (:12908-12960) all reference `is_sample`/`deleted_at`/`taste_order`, columns no migration ever added (migration 082's own comment calls them localStorage-only). Their only consumer is the orphaned `/me` page; `api.giftSample` has zero UI callers. HYPOTHESIS to close: `PRAGMA table_info(tea_compass_entries)` against prod.
- *SQL identifier injection (found during the gate audit, live cross-tenant vector):* `handleUpdateCompassEntry` (:8727) builds `SET ${cols}` from raw client JSON keys; the exact-string guard misses `"account_id "` with a trailing space, letting any member move rows into another tenant. Same unwhitelisted pattern at :7758, :8564, :8654, :11030, :11140 and insert-side :2109, :2224, :8249. Safe siblings all use `*_ALLOWED_COLS`. One shared `pickAllowedColumns` helper, nine sites, ships WITH the bundle gate.
- *Unification design core:* compass status is a sourcing-lifecycle axis orthogonal to product status; the fold needs a `sourcing_stage` column so "promote" becomes flipping fields on one row, which is what actually kills the four hand-maintained mirrors (promotion copy :8783-8900, tasting mirror :8750 in a swallow-all catch, four stock-status mirror sites, and the bulk-sync REPLACE that already orphaned `tea_key` once per its own comment at :9000). The track doc's orphan-audit query references a nonexistent `owner_role` column and must be rewritten.

**Sequencing:** allowlist + bundle gate now (hours, closes live holes); the "received tea" journal design next; migration + thin wrappers + kill-set third; currency last (same files as the wrappers).

---

### Clump 7: The editorial engine (priority 7)

**Plain intro.** The contributor schema shipped complete a year of features ago; the read side consumes all of it; the write side was never built. Everything in this clump is a write path or content waiting on one. The keystone is the admin editor.

**Execute lane:**
- Author picker: two freetext inputs (`ArticleEditorModal.tsx:861, :1069`), plus fix the always-NULL users join in the public articles query and the publish-time slug regeneration in `buildPayload` (retitling a published article silently changes its URL).
- Pull-quotes: blocked not only on UI; `ARTICLE_ALLOWED_COLS` (:14394) and the create INSERT omit the three fields, and update returns success when every column is filtered out. A UI-only patch would appear to save and write nothing.
- Barry: no seeded row exists (no seed article has his author id); publishing him means CREATING a row through the new editor.
- Interview archive: pipeline (Smart Paste) confirmed shipped; gated on the template decision.
- Glossary tooltips, Advise portfolio images, delete orphaned `ServiceContent.tsx`: all verified as the track doc states.

**Investigate findings (CONFIRMED unless marked):**

- *Editor:* no admin route, no create/update endpoints; seeded contributors uneditable and unpublishable while the public pages sit live waiting. Build the three endpoints under `requireOwnerTier`, with the mirrored `face_of_account_id` ↔ `host_contributor_id` write as one `env.DB.batch()` helper that validates authority over the target account (the FK accepts ANY account id; without the check, owner A can stamp their contributor onto store B).
- *Two latent public leaks to fix in the same PR:* (1) `handleGetPublicContributor` returns `SELECT *` spread, leaking `contact_customer_id` (private CRM id), `account_id`, `user_id` the moment anyone is published; (2) its products query (:14590) has NO visibility filter (compare the shop's `is_public AND shown_in_shop AND status='Active' AND account_id` at :12783), so wave-6 attribution would publish private/draft teas on a public page.
- *Templates:* the dropdown is a lie. `getArticleRenderMode` collapses `layout_template` to a binary; four of five values are dead settings. The live layout vocabulary is per-page/per-block (18 kinds x many variants). The item is an architecture decision: recommend killing the dead article-level values and spending the effort on per-block quality curation (option 3 in the decisions list).
- *Brewing QR:* `BrewingQRCard.tsx` is fully built, zero importers, QR-encodes routes that do not exist, and bakes `window.location.origin` into what would be PRINTED stickers (a localhost print is a dead label forever). Guide content already exists and renders on ProductPage via `brewing-profiles.ts`; build the six pages from that single source, wire the card into the print flows, use the canonical public origin.
- *AI layer:* stays deferred; the pattern already exists (`handleGenerateWisdom`, deliberately dormant with no API key). Note: whoever ever sets `ANTHROPIC_API_KEY` must add rate limiting to both endpoints in the same commit, or two unmetered spend surfaces go hot at once.
- *Later waves:* leaky deferral; several waves' read sides are already live (seasonal calendar matcher, host-account lookup) with zero write paths. Rule: each wave ships write path + admin field + profile section + a visibility-filter audit together. The two leak fixes above should ship NOW, ahead of any wave.
- HYPOTHESIS: whether `/people` is platform-global or per-store is an intent question (code is global; the NOT NULL `account_id` implies otherwise).

---

### Clump 8: Platform hardening (priority 8)

**Plain intro.** The platform's contracts live only as conventions inside one 18,917-line file, and the proof of what happens without extraction already exists: the one seam ever cut (`mcp.ts`) hand-duplicates the JSON helper, JWT verify, the product mirror builder, and six raw stock-ledger INSERTs. Every future seam looks like that unless shared infrastructure is extracted first.

**Execute lane (verified):**
- Remove legacy `PUT /api/products/:id` (route :18302, zero frontend callers) before/within the products domain PR.
- Migration 017 twin resolution (both files confirmed present).
- Timestamp unification: documentation-only, agree with background.
- Code-split Wave 2: ~48 static imports remain in `AdminApp.tsx`; extract `lazyWithReload` (currently private in `App.tsx:23`) into a shared module and use it for all views, retrofitting Wave 1's four. Land AFTER the strict flip. (HYPOTHESIS: whether per-view chunk failures are gracefully caught today.)
- Wave 3 idle prefetch; image batch + index audit.
- Final 3 `.pill-*` sites: all in `PlatformAdminView.tsx` (93, 424, 500); then promote lint Rule 9.
- Delete `src/data/tea-database/` (9,104 lines, zero importers).
- MCP real-iPhone OAuth: code verified consistent; genuinely blocked on the physical phone.

**Investigate findings (CONFIRMED unless marked):**

- *Modularization is mechanical* (good news, verified): no handler calls another handler, no `ctx.waitUntil`, portable Handler type, no duplicate routes, tests exercise the fetch export. Order: PR 0 extracts the shared lib (auth family, http helpers, activity/ledger/mirror builders, email, the two handler factories), then one domain per PR, then delete mcp.ts's forks. Rule: move-only diffs, and the tenancy test suite lands FIRST as the net under the auth core. Start with customers (smallest, contains the bundle fix), not products.
- *Error envelope:* no `{success:false}` variant found anywhere (that track-doc claim looks stale). The fragility is concentrated: `'Account access denied'` is returned for three different semantics and string-matched at `api.ts:580` to clear the active account (over-triggers on stale deep links; under-triggers on suspension, whose raw `account_suspended` code leaks into user-facing toasts). Five string-match sites total, including a dead `err?.status === 404` branch proving the codebase wants a typed error. Fix shape: additive `code` field (four distinct account-denied codes), a typed `ApiError` client-side, three-phase deploy (add code, switch client, then strings become free). ~90% of the security-relevant migration is one auth-helper family, not 368 routes; the rest rides the domain PRs.
- *strictNullChecks, measured:* 46 errors under strictNullChecks alone, 55 under full `strict: true`. The "multi-day" sizing is stale; this is one focused day. Recommend full strict in one PR (nine extra errors buys permanent parity with the already-strict worker). One real crash found in the error list (`LibrarySearch.tsx:71` invoking a possibly-undefined prop). Guardrail: no `!` silencing where the null case is reachable.
- *Unified search:* the track doc's FTS "precedent" is false: `notes_fts` is an external-content table with no triggers, no inserts, no queries; it has been an empty trap since migration 025. Keep `/api/search` deferred. Do the three honest client fixes now: lift the 50-article cap in GlobalSearch, add the static glossary as a fifth Fuse source, and delete/repoint the legacy-story index after Track 1's decision. Write down the one constraint before anyone ever builds server search: it must be account-scoped and respect the visibility flags from day one.

---

### Clump 9: Tasting journal deepening + starred-notes loop (priority 9)

**Plain intro.** The journal keeps two copies of what a member wrote: the structured notes (with stars and sections) and a flattened text summary. The member-facing pages render only the flattened copy; the stars, and the whole curation loop built on them, live in the structured one. The two already overwrite each other in both directions. Every phase in this clump sits on that fork.

**Execute lane:**
- Phase 2 per-section capture and Phase 2b customer starring, WITH a caveat the classification missed: starring already half-exists by accident. The star toggle renders for every customer (no `adminMode` on customer mounts) with admin copy ("Star, publish to product," `NotesPanel.tsx:99,146`), a false promise that is the OPPOSITE of 2b's private-until-promoted contract. 2b is therefore half copy work and read-surface work (render the structured notes in the journal views), not new sync machinery. Also note: the spec's section vocabulary does not match the live session's four tabs (CONFIRMED).

**Investigate findings (CONFIRMED unless marked):**

- *Phase 3 promote queue:* never built (zero code hits), and structurally hard: starred notes live two JSON levels deep in TEXT columns with no note table or index; legacy note ids are regenerated randomly on every normalize (`noteEntries.ts:24-25`), so dismiss-by-id will not stick; `sourceJournalEntryId` is written nowhere; dismiss has no storage. Proper shape: a review-state table keyed on note id OR a text fingerprint, a read endpoint scoped by JOIN through `products.account_id` (see risk), promote via the existing product-update path preserving author/date, plus renderer fixes.
- *The tenancy risk is the big one:* journal rows carry the CUSTOMER'S account claim (often NULL, HYPOTHESIS with a one-line D1 query to confirm), not the product owner's account. Filter by the journal's own account column and the queue is empty or wrong; filter by nothing and every operator reads every customer's private journal platform-wide. The only correct scope is the product-ownership join, behind the catalog bundle, day one.
- *Render-target drift:* the Impressions block is in `AlcoveIdentityHeader.tsx:159-215` (not AlcoveCard as documented), shows initial only (no date), hardcodes "In Adrian's words" for every account and every author, and suppresses the product's own prose when any starred note exists. Promoting a customer's words today would publish them under Adrian's name.
- *A rival system is live:* the public Reviews block on ProductPage renders `tea_reviews` rows, contradicting "starred notes replace reviews for good." Decide its fate with Phase 3.
- *Brief alignment (c) is a real bug, located:* `upsertTastingByProductId` (`store.ts:423-473`) unconditionally overwrites the entry's note in EVERY branch, including fresh sessions that are supposed to nest; and a member's detail-view note edit is clobbered by the next session save. The compare-on-retaste feature and the note fork are the same disease; fix as an explicit merge-strategy parameter, not a modal bolted on. Adjacent: the 100-entry local cap silently drops old entries; a member's own legacy voice note is hidden behind a platform-privilege gate in their own journal.
- *Discovery pair:* both deferral reasons have expired (article routing is live). The shop deep link is not a string swap: recommendations speak in tea-type families and the shop URL has no type/family param; add one. Drift viz needs no schema (observed trajectory derives from timestamped tasting records); stated-profile HISTORY does need a decision now, because it is unrecoverable if not captured. Passport is public; keep drift off it.

---

### Clump 10: Events remember-phase (priority 10)

**Plain intro.** The after-the-gathering phase has never run once: zero post-session rows, zero closed events, zero event tasting notes in prod. Three latent breaks sit undetected in code that has never touched data, and the essay composer's near bank (a working post-session record) does not exist yet.

**Execute lane (with upgrades):**
- Post-session summary email: NOT purely mechanical. Two confirmed reefs: the live `event_notifications` CHECK constraint rejects any new notification type (SQLite cannot ALTER a CHECK; table-recreate migration or reuse `event_update`), and notification rows are records that nothing ever sends; the email needs the real Resend path from Clump 3.
- Event map preview, TicketCard QR: independent, safe.
- Reminder milestones stay manual: no-op by design, confirmed.

**Investigate findings (all CONFIRMED, several proven against prod D1):**

- *Break 1:* the admin save sends camelCase, the handler reads snake_case (`PostSessionEditor.tsx:53-58` vs worker :7277-7305): every field falls to NULL while the toast says saved. One-off, not a pattern (neighbors send correct keys).
- *Break 2:* no admin GET exists at all; the editor's workaround reads a field the events queries never join, so the tab always opens blank, and combined with the unconditional UPDATE this becomes a data-destroying loop the moment Break 1 alone is patched. Read and write fixes must ship together.
- *Break 3:* the public recap SELECT (:6217) names `shared_tasting_notes`, a column with no DDL anywhere; the exact query fails against prod with "no such column." It has never erred only because zero events are closed. The first real closed event 500s its recap page, which the summary email links to.
- *Break 4:* `host_notes`/`energy`/`host_changes` exist in schema and types with zero read/write code, the exact session texture the composer needs.
- *The composer's schema question is already settled:* the article block vocabulary (cover, intro, tasting_notes, image, section headings, product links, epilogue) covers everything event data produces; the composer is a client-side assembler POSTing to the existing draft endpoint and deep-linking into the existing editor. No new schema. The ONE genuine gap: live tasting sessions have no `event_id` (confirmed), so the richest sessions are unreachable from the event; one nullable column + an optional picker fixes it.
- *Consent:* guest impressions carry no publication consent; the composer must default to anonymous aggregation.
- *Tenancy drift, not exploitable yet:* three notification INSERT sites omit `account_id`; the recap route resolves by slug with no account scope (slugs globally unique, so no bleed, but any tenant's recap is public: decide deliberately).
- Build one shared "what happened at this session" assembly feeding recap, email, and essay draft, or three copies drift.

---

### Clump 11: Member IA and naming (priority 11)

**Plain intro.** Four successive generations of "member home" each half-replaced the previous one (traced in git, dates and commits confirmed). The dead link, the routeless Cellar, the orphaned pages, and the naming collisions are the debris field. The work is finishing the generation-4 migration and burying generations 1-3, in one batched sign-off session with Adrian (the nav-change rule makes that mandatory anyway).

**Execute lane:**
- Doc hygiene: INDEX.md rewrite (still sequenced after the other track docs exist) and the small stale-claim fixes (FLOWS.md:88, SITE_MAP.md:106-125, the ACTIVE_BRIEFS stub).

**Investigate findings (CONFIRMED unless marked):**

- *Dead "remember" tile:* born dead (git shows the `?tab=` API never existed at any commit), and conceptually wrong: the tile counts heart-favorites while the page it targets shows a DIFFERENT server-derived favorites concept; the only consistent target is `/account/collection`.
- *Cellar:* fully built, server-backed, reachable only through panel modal state; needs a 14-line route wrapper (it already ignores its back prop).
- *Six "collection" surfaces*, not two, including a legacy base64 share link STILL actively generated by the share button, and a page section titled "Your Collection" that means compass entries.
- *Complete orphan set:* `/start` (zero inbound links), `/me` (full member hub, zero inbound links, NEW finding), `MEMBER_MEMORY_LINKS` (defined, documented, rendered nowhere), and `JourneyCard` (complete component in the live panel file, never rendered, NEW finding), meaning the member journey page has no working inbound link at all.
- *Crawler-level map/territory (NEW):* `public/sitemap.xml` lists 6 URLs all on the wrong domain (`teajia.co`) including a dead route; robots.txt points at the wrong sitemap; there is no `_redirects` file, so all renames would be client-side only. Fix in the rename PR.
- *Homepage:* the track doc is partially stale; the hero IS interactive above the fold. What actually gates behind the scroll is precisely the value-prop line and the account CTAs (finale of the narrative), and the hero fades to non-interactive mid-scroll. Options and recommendation in the decisions list; the grounding lines stay untouched per the locked rules.
- *My Tea Life:* the five-source aggregator already exists (`handleGetMyJourney`); the timeline is chronological interleaving plus orders, not a new table. The blocking design question is scoping: personal memory is inconsistently person-scoped vs account-scoped across tables today, and the UNION query cannot be written until that is decided.
- HYPOTHESES: panel-vs-routed journal duplication drift; whether the stale sitemap is actually served and crawled; unused-export debt implied by dead components (`npx knip`); fold-vs-meta value-prop check via a fresh-load screenshot.

---

## 3. Cross-Cutting Findings

Patterns that span clumps. Each is one root cause with instances scattered across the build list.

**A. Success theater (failures swallowed, success reported).** Verify-request returns success without sending; post-session save toasts over NULL writes; ProductInquiry email "sends" into an unread localStorage key; the revenue chart's 500 is caught and blanked; `persistInquiry` swallows; article update returns success when every field was filtered out; the offline queue silently drops entries after 3 retries. Any fix in any clump should make its failure path visible; that is the cheapest platform-wide quality gain available.

**B. Read side built, write side missing.** Contributors (all of clump 7), `host_notes`/`energy`, `shared_tasting_notes` (rendered, never storable), the readiness first-door computations (computed, discarded), `MEMBER_MEMORY_LINKS` and `JourneyCard` (defined, never rendered), BrewingQRCard (QR to nowhere), seasonal calendar (matcher live, zero writers). The build order that prevents recurrence: never ship a reader without its writer in the same PR.

**C. Account-blind client storage.** One family: `teajia-compass`, `teajia-notes`, `teajia-ledger`, `teajia-storage`, `teajia_stories`, `teajia_saved_stories`, `teajia_orderRef` (reused forever). One shared account-scoped persistence primitive plus a logout fan-out clear fixes the family; per-store hand fixes will drift.

**D. Unauthenticated endpoints handing out more than they should.** Password-reset token echo; find-rsvp magic tokens by phone; inquiry lookup by low-entropy ref (name, email, location); samples by bare id; the public confirm endpoint with no rate limit; contributor `SELECT *` spread. All predate multi-tenancy or delivery shipping; all close with the clump-1/2/3 work.

**E. SQL built from client keys.** Nine handlers build UPDATE/INSERT column lists from raw JSON keys (compass, venue, teaware x2, sample x2, product inserts x3) while their siblings use allowlists. One `pickAllowedColumns` helper, nine call sites, one PR.

**F. Phantom schema and unenforced domains.** Queries against columns that do not exist (`invoices.total_usd`, `shared_tasting_notes`, compass `is_sample`/`deleted_at`/`taste_order`); status values outside the domain (`'Paid'`, `'fulfilled'`); a live CHECK constraint everyone forgot (event notifications); frontend types declaring values the DB rejects. A scripted diff of every explicit SELECT list against `PRAGMA table_info` per table would find the rest of this class in an afternoon (HYPOTHESIS that more exist; the script is the confirmation).

**G. Wrong-origin links baked into artifacts that outlive the code.** Emails built from the worker's own origin (dead or GFW-blocked links), `teajia.app` in three emails, invite links to a page that cannot claim them, QR codes encoding whatever host rendered them onto PRINTED stickers, a sitemap on the wrong domain. One `appUrl(env, path)` helper plus a canonical-origin rule for anything printed or emailed.

**H. Per-isolate rate limiting where durable limiting exists.** verify-request, redeem-join-code, forgot-password (none at all), find-rsvp (none), public confirm (none). The durable limiter pattern is wired and copyable.

**I. Duplicated money/stock logic.** ~9 SQL sites and ~8 frontend sites each re-derive invoice totals; mcp.ts forks the mirror builder and hand-writes six ledger INSERTs; two currency vocabularies with a silent `|| 1` fallback; four hand-maintained compass/product mirrors. Shared helpers turn "every reader agrees" from a coincidence into a property.

**J. Unburied generations.** Two article engines; four member-home generations; two tasting-note systems (event vs live-session, unlinked); two community-voice systems; two brewing-knowledge systems; five write-resilience mechanisms. Each clump's decide-once item is the burial.

---

## 4. Decisions for Adrian

Plain language. Each with a recommendation and what the choice costs. Grouped so one sitting can clear a group.

### Money (clears with Clump 1)

1. **What should a wholesale invoice be?** Real line items in the normal invoice system, or a thin pointer to the wholesale record? *Recommend: real line items.* Consequence: every existing screen, PDF, and voice tool just works; the alternative creates a permanent second money dialect.
2. **Should unreviewed draft orders count toward a customer's lifetime spend and show in their order history?** *Recommend: spend counts fulfilled only; history shows confirmed-and-fulfilled, hides drafts.* Consequence: a prank link submission can no longer inflate anyone's numbers.
3. **Revenue chart and customer segments: rewrite or remove?** They have never worked. *Recommend: rewrite (small query change).* Consequence: the first second operator sees an honest dashboard instead of a permanently blank one.
4. **Wholesale price display: per-gram or per-100g?** Storage stays per-gram either way. *Recommend: display per-100g (tea-trade natural), computed from per-gram.* Consequence: fixes the 100x mismatch without touching the schema.
5. **Does wholesale-received stock need to become sellable retail inventory now?** *Recommend: document the dead-end, defer.* Consequence: the self-test must acknowledge the gap rather than silently "pass."
6. **What was the voided NT$ order?** If it was a Taiwan price typed into a US-dollar field, the entry forms need the currency made unmistakable.

### The boundary and the second operator (clears with Clump 2)

7. **Flip Australia invisible today, or rush-finish its checklist this week?** *Recommend: invisible today.* Consequence: zero cost pre-launch; every day public-and-empty is brand damage under the flagship name.
8. **Should new stores be born private?** *Recommend: yes, strongly.* Consequence: the next store anyone creates cannot repeat this.
9. **Should the public directory hide stores with nothing to sell even if the owner flipped them public?** *Recommend: yes.* Consequence: an early flip cannot advertise an empty shell.
10. **Who can edit a person's record?** *Recommend: anyone holding any of the selling, events, or sourcing capabilities; split finer only when a second store has partial-permission staff.* Consequence: no relationship type is locked out, and the full redesign waits for a real need.
11. **Should the full customer list and spend-intelligence view require the selling capability instead of mere membership?** *Recommend: yes.* Consequence: a read-only viewer stops seeing all commerce data.
12. **On account switch or logout, flush unsaved captures to the old account first, or discard them?** *Recommend: flush then clear.* Consequence: a capture made at a vendor's table is never silently dropped.
13. **Is a member's tasting journal deliberately personal (spans their store memberships) rather than per-store?** *Recommend: yes, and write the test that locks it.* Consequence: it becomes a decision instead of an accident.

### Codes, sign-in, and China (clears with Clumps 3 and 5)

14. **Is the verification code a sign-in system or a guest ticket/journey key?** *Recommend: guest key for launch; real sign-in stays password/Google.* Consequence: a small scoped credential instead of a new auth system.
15. **Confirm the app's one true web address for every emailed link, and whether teajia.app is even owned.** *Recommend: set the address once as configuration, route all links through it, retire teajia.app.* Consequence: kills four broken-link families at once.
16. **WhatsApp code delivery at launch, or email only?** *Recommend: email only; the WhatsApp option must say honestly "sent by email" until the infrastructure exists.* Consequence: no silent no-op.
17. **May the two live security holes (reset-token echo, ticket-token-by-phone) be fixed in the delivery PR even though they sit under other checkboxes?** *Recommend: yes.* Consequence: shipping delivery without them is net-negative security.
18. **China checkout: email-first fallback with an optional WeChat contact card per store?** *Recommend: both; email is universal and leaves a record; the WeChat card (ID + QR + copy) shows when the store sets one.* Consequence: one shared hand-off component replaces twelve inconsistent buttons, and every inquiry finally lands in the right store's inbox.
19. **Offline media outbox timing.** *Recommend: delete the broken queue and fix the silent failures now (hours); build the photo/voice outbox when a China trip is actually scheduled.* Consequence: no field capture is ever lost again, without building ahead of need.

### Content and reading (clears with Clumps 4 and 7)

20. **Reading memory: remove now and rebuild properly inside the later personal timeline, or wire it now?** *Recommend: remove now, keep the silent resume that already works.* Consequence: no third half-wired generation; the honest version arrives with real users.
21. **The four placeholder course lessons: become real articles, or hide the lesson list?** *Recommend: hide; porting placeholder blurbs makes fake content real.* Consequence: the streak badge (banned) comes out immediately either way.
22. **Product-card "from the journal" links: rebuild against the real article system, or drop?** *Recommend: rebuild inside the editorial track; drop the dead version now.*
23. **Should unpublished essay drafts be walled off from visitors?** *Recommend: yes, one shared gate; it also ends the recurring link-drift.* Consequence: trusted users can no longer wander into placeholder interviews.
24. **What is a "template"?** Article-level style presets (would need a whole rendering layer), authoring recipes, or killing the dead dropdown and polishing the best twenty page-block combinations? *Recommend: the third.* Consequence: effort goes where the quality problem actually lives, and the interview archive unblocks.
25. **Is the people directory platform-wide or per-store, and who may bind a contributor to a storefront?** *Recommend: platform-wide, and only you can bind; write it down.* Consequence: the mirrored write is designed once, safely.
26. **Where does the brewing QR live first?** *Recommend: the printed sample/table-card flow; the product page already shows the same data.* Consequence: knowledge goes onto the tea table, per the vision, and printed labels get a permanent-slug guarantee.

### Journal and community voice (clears with Clump 9)

27. **Is the star itself consent to publish, once the wording says so?** *Recommend: yes, after the copy explicitly says starred notes may be published with your initial; and give the member a quiet "chosen" state on their note.* Consequence: the loop closes without gamification.
28. **Attribution on a promoted note: initial only, or initial plus month and year?** *Recommend: initial plus month/year.* Consequence: the date must be carried through promotion.
29. **Keep or relabel the existing public Reviews block?** *Recommend: keep but relabel as network provenance, so member voice has exactly one channel.* Consequence: no silent removal surprises the wholesale track.
30. **When a member re-tastes a tea, does their headline note keep the old text by default?** *Recommend: yes; the compare sheet offers the new values.* Consequence: a tea memory is never silently overwritten, which is the product.
31. **Start recording palate-quiz history now?** *Recommend: yes, a cheap append-only write, even though the visualization ships later.* Consequence: the data is unrecoverable otherwise. And keep all of it off the public passport page.

### Events (clears with Clump 10)

32. **Recap notes: host-curated, or an automatic anonymous digest?** *Recommend: automatic anonymous digest; drop the phantom column.* Consequence: the recap page stops being a latent crash.
33. **Link live tasting sessions to events?** *Recommend: yes, one optional field.* Consequence: the richest tasting data reaches the recap, the email, and the essay.
34. **Guest words in published essays: anonymous only?** *Recommend: yes for now.* Consequence: no consent machinery needed in beta.
35. **Is every closed event's recap page public by design?** *Recommend: acceptable for beta; record it so the multi-store rollout revisits.*
36. **"What I'd change next time": private to the host forever?** *Recommend: yes; never in the recap, email, or essay.*

### Names, routes, and the homepage (one batched sitting, clears Clump 11)

37. **The route table:** favorites page rename, whether the member journey page merges into the future timeline, killing the two orphaned hub pages, deferring the saved/history renames until the reading-memory decision. *Recommendations are in the clump; the point is one sitting, one signed table, one mechanical PR with real redirects and the sitemap/domain fix.*
38. **Homepage: move the existing value-proposition line up under the headline?** *Recommend: yes (zero new copy, zero touch on the protected lines); defer any persistent buy button until there is public traffic to convert.*
39. **Is a person's tea life one timeline across stores, or one per store?** *Recommend: one per person, with store labels on entries.* Consequence: this decision must precede the timeline build AND the cross-link work, because every query encodes it.

---

## 5. Confirmed vs Hypothesis Appendix

For the next agent: everything labeled CONFIRMED above was seen directly in the cited file/line or proven against production D1 during this pass (2026-07-11). The open hypotheses, with how to close each:

**Clump 1 (money):**
- H: the voided NT$ line item was a currency-entry mistake. Close: ask Adrian.
- H: W7's severity (does any sell path read `product_listings`?). Close: trace storefront product queries; none found this pass.
- H: `PUT /api/wholesale/orders/:id` items path (:17460-17575) mirrors create-path validation. Close: line-by-line read.

**Clump 2 (boundary):**
- H: prod state of `acc_teajia_australia` (0 products, 0 members, no contact). Close: `wrangler d1 execute teajia-db --remote --command "SELECT public_enabled, status, (SELECT COUNT(*) FROM products WHERE account_id='acc_teajia_australia'), (SELECT COUNT(*) FROM account_members WHERE account_id='acc_teajia_australia'), whatsapp_number, contact_email FROM accounts WHERE id='acc_teajia_australia'"`.
- Note: everything else in this clump (gates, dead computations, persist keys, create defaults, debounce mechanics, missing Playwright dep) is confirmed.

**Clump 3 (codes):**
- H: `DEV_RETURN_VERIFY_CODES` unset in prod. Close: `wrangler secret list` or hit `/api/verify/request` on prod and check for `code` in the response.
- H: whether `teajia.app` is owned/redirects. Close: curl.
- H: how Jesse's invite actually got claimed. Close: click a freshly minted invite link; check `platform_audit`.

**Clump 4 (article engine):**
- H: stale-device prevalence of resurrected legacy stories. Close: check `localStorage.getItem('teajia_stories')` for Article entries on each beta device.
- H: the edit-pill mechanism explains all field reports. Close: cold-load a read page in a fresh profile with only the owner JWT; pill absent; visit `/admin`; pill appears.
- H: DbArticle id shape vs legacy ids. Close: `SELECT id FROM articles LIMIT 5` (structurally irrelevant either way).

**Clump 5 (China):**
- H: `VITE_API_URL` / `VITE_WHATSAPP_NUMBER` set in the Pages prod build env (decides whether consult inquiries dead-letter in prod and whether seven surfaces emit recipient-less links). Close: Pages project settings, or grep a prod bundle.
- H: Resend and Groq legs complete from a CN connection. Close: real or simulated CN test.
- H: field device is an iPhone (drives the no-Background-Sync design; the heartbeat design is correct regardless).

**Clump 6 (compass):**
- H: prod `tea_compass_entries` lacks `is_sample`/`deleted_at`/`taste_order` (making five handlers dead on arrival). Close: `PRAGMA table_info(tea_compass_entries)` remote.

**Clump 7 (editorial):**
- H: `/people` is intentionally platform-global. Close: Adrian only.

**Clump 8 (hardening):**
- H: strictNullChecks-only count (46) is slightly flattered by implicit-any suppression; bounded above by the measured 55 under full strict.
- H: per-view admin chunk failures lack graceful recovery. Close: read AdminApp's Suspense/ErrorBoundary wiring, or kill the dev server mid-navigation.
- H: the `{success:false, error}` envelope variant exists somewhere. Zero grep matches in `worker/src/index.ts`; treat the track-doc claim as stale until relocated.

**Clump 9 (journal):**
- H: plain members' journal rows carry a NULL account. Close: `SELECT account_id, COUNT(*) FROM customer_tasting_journal GROUP BY 1` plus reading the token-mint path around worker :1340-1360.
- H: nested-JSON extraction performs acceptably at current volume. Close: run the candidate query against prod; a worker-side scan is the fallback at beta volume.
- H: the public Reviews block has visible prod rows today. Close: `SELECT COUNT(*) FROM tea_reviews WHERE visibility='network'`.

**Clump 10 (events):**
- H: uploaded gallery URLs are directly reusable in article image blocks. Close: check the editor's image-block insert flow (very likely; same authed origin).
- H: more phantom-column SELECTs exist elsewhere in the worker. Close: scripted diff of every explicit SELECT column list vs `PRAGMA table_info` per table.
- H: the guest post-session consumers render correctly once real data exists (they have never seen a non-404). Close: during Phase 0 testing.

**Clump 11 (IA):**
- H: the panel journal view and the routed journal page have drifted. Close: diff their feature sets.
- H: the stale wrong-domain sitemap is served and crawled. Close: `curl -s https://www.teajia.com/sitemap.xml`; Search Console.
- H: more dead exports exist (unused-locals checking is off). Close: `npx knip` or a one-off unused-export scan; feeds the dead-code sweep.
- H: share previews communicate the value prop better than the visible fold. Close: fresh-load screenshot at 390x844.

---

*End of deep analysis. Sequence: Clump 1, then 2, then 3, exactly as the clump map orders them. The window in which all of this is free to fix closes the day the first real order or the second real operator arrives.*

---

## 6. Decisions Locked (2026-07-11)

Adrian's calls plus the Fable-recommended defaults he authorized ("do it how you think best"). This is the authoritative decision sheet for the Codex batches. Anything marked DEFERRED is a feature/design build held until Adrian is back; Codex does not touch it autonomously.

**Answered directly by Adrian:**
- Reading history + saved-articles pages: REMOVE both (keep the silent resume that already works). (#20, #22)
- Wholesale catalog price is PER-GRAM. Server is already per-gram; fix the frontend that treats it as per-100g. No schema change, no 100x conversion. (#4)

**Locked to Fable defaults for the fix/harden batches:**
- Security (running now): remove reset-token echo; build reset link from APP_URL; generic response + durable rate limit on forgot-password; close guest-token-by-phone; durable rate limiting on verify-request, redeem-join-code, find-rsvp, public confirm. (#17, H-set)
- Auth model: verification code is a guest ticket/journey key; real sign-in stays password/Google. Delivery is email-only; any WhatsApp option must say "sent by email" honestly. (#14, #16)
- One canonical web address = https://www.teajia.com for every emailed/printed link; retire teajia.app (does not resolve). (#15)
- Money: wholesale invoices are real line items; drafts do NOT count toward lifetime spend and are hidden from order history until confirmed+fulfilled; revenue chart + segments get the small query rewrite; wholesale-received-stock-to-retail stays a documented dead-end (deferred). (#1, #2, #3, #5)
- Tenancy: flip Australia invisible now; new stores born PRIVATE; directory hides stores with nothing to sell; editing a person requires any of sell/events/sourcing capability; full customer list + spend view require the selling capability; on account switch/logout flush unsaved captures to the old account then clear; the member journal is deliberately personal across memberships (lock with a test). (#7-13)
- Article engine burial: remove reading memory, hide the 4 placeholder course lessons, drop the dead "from the journal" product-card links, wall off unpublished essay drafts behind one shared gate. (#20-23)
- China: delete the broken offline queue and make the swallowed failures visible now; email-first checkout fallback with an optional per-store WeChat contact card; build the photo/voice outbox only when a China trip is scheduled. (#18, #19)
- Platform quality rule applied in every batch: make failure paths visible (no more success theater); never ship a reader without its writer; route emailed/printed links through one appUrl helper; use column allowlists for client-driven SQL.

**One open item, non-blocking:** the single voided NT$ line item in prod may be a Taiwan price typed into a US-dollar field. Left as-is (already void); flag the currency entry form for clarity in a later pass. (#6)

**DEFERRED (needs Adrian + design, not handed to Codex now):** magazine templates (#24), contributor directory + storefront binding (#25), brewing-QR placement (#26), the journal starred-notes publishing loop and its consent/attribution/re-taste rules (#27-31), event recap/essay decisions (#32-36), route/name/homepage/personal-timeline decisions (#37-39).
