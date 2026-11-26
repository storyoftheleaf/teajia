Repository storyoftheleaf/teajia. Your branch is build/l1-s3-thanks, made from build/launch-1.

Goal: a guest who opens their after-sit link sees the teas that were poured (each one opening onto its page when it has one), the playlist, and one thing to read.

Approved behaviour:
- The page is src/pages/AfterSitPage.tsx at /after-sit. Its data type AfterSitRecap (src/lib/afterSitAccess.ts) now carries, per tea, `path` (string or null) and `kept` (only for a signed-in caller, only with the flag open); at the top level `playlist_url`, `reading { slug, title }` (or null) and `thanks_ref` (only with the flag open). The server already returns all of these. Do not change the type or the server.
- "Teas served": a tea with a `path` is a link to that path. A tea without one stays plain text. No prices on this page.
- When the flag is open and `thanks_ref` is set, each tea link's address is `withOrderVia(path, thanks_ref)` and tapping it first calls `rememberOrderVia(thanks_ref)` (both from src/lib/orderVia.ts). This is how an order that begins here is later known to have begun here. With the flag off, the links are the plain paths.
- Playlist: when `playlist_url` is set, show it the way the public recap does. Reuse the pattern in src/pages/EventRecapPage.tsx (PlaylistSection). Move that component into src/components/events/ so both pages share one copy.
- Reading: when `reading` is set, one line "To read" linking to /article/<slug> with the title as the link text.
- A session with no teas, no playlist and no reading must still be a good page: the title, date, host's note and the guest book, with no empty headings.
- Order on the page: title and date, host's note, teas, reading, playlist, then the existing PrivateKeptSetup and GuestBook exactly as they are.
- Leave a clear place beside each tea for a "Keep this tea" button that another worker is building (src/components/events/KeepTeaButton.tsx, not yet on your branch). Do not build it. Render nothing there yet, and say in your report where the one mount line will go.

You own: src/pages/AfterSitPage.tsx, a new src/components/events/ThanksTeas.tsx, the moved playlist component (and the one import change in EventRecapPage.tsx that the move needs), and a new tests/first-table-thanks.spec.ts.
Do not touch: worker/, src/App.tsx, src/lib/api.ts, src/lib/afterSitAccess.ts, src/lib/orderVia.ts, src/types.ts, the GuestBook and PrivateKeptSetup components, any navigation.

Must be preserved: the loading, missing, error and "copy on this device" states of the page; the credential handling (the secret never appears in any link you build); the existing test tests/after-sit-guest-book-photos.spec.ts must still pass.

Style rules that bite (from CLAUDE.md): colours only from tea-text, tea-surface, tea-bg, tea-elevated, tea-gold, tea-gold-lt, tea-border, tea-accent-sub, tea-text-sec, tea-text-dim. border-tea-border takes no opacity modifier. Headings and body through TYPOGRAPHY_CLASSES; raw sizes as text-ui-N, never text-[Npx]. No horizontal scroll, use flex-wrap. Anything tappable under 44 by 44 gets the class tap-target. No em dashes in any wording.

Acceptance check: tests/first-table-thanks.spec.ts, using the route-mocking style of tests/after-sit-guest-book-photos.spec.ts, covers (a) a full recap at 390 by 844 with a linked tea, a plain tea, a playlist and a reading, (b) an empty recap with none of them and no empty headings, (c) no horizontal overflow, (d) no link on the page contains the 64-character credential. Run npm run lint and npm run lint:colors, and the two specs: npx playwright test tests/first-table-thanks.spec.ts tests/after-sit-guest-book-photos.spec.ts --trace off.

Report back: the branch, what you ran and its result, the mount line for the keep button, and anything you could not do. If you find you need a field the payload does not carry, or a product decision, stop and send the exact conflict. Do not work around it.

Working rules for every slice:
- You are in your own git worktree of storyoftheleaf/teajia on your own branch, made from build/launch-1. Commit your work on that branch with a plain message. Do not push and do not open a pull request; the build owner does that after checking your work.
- Launch 1 is behind one flag: src/lib/firstTable.ts, `FIRST_TABLE_OPEN` (false), read through `firstTableOpen()`. To see it on locally: VITE_FIRST_TABLE_OPEN=true for the site; FIRST_TABLE_OPEN=true when starting the worker sandbox.
- The local test shop: `TEAJIA_OFFLINE_FIXTURES_STATE=$PWD/.wrangler/ft FIRST_TABLE_OPEN=true npm run sandbox:offline:fixtures` (Node 22 and the sqlite3 CLI) loads worker/sandbox/first-table-fixture.mjs: one finished session "First table, a test sit" with three teas (one for sale, one public and not for sale, one plain name), two guests, one paid order. Its header lists every id, the two after-sit links and the guest sign-in (mei / mei). The operator signs in as sandbox / sandbox. Never use npm run dev: it points at the live shop.
- Ports 7777 and 8787 may be held by another worker. If they are, do not stop anything you did not start; run the unit tests and lint, and say the sandbox check is left for the build owner.
- Wording people read: plain, short, no em dashes, no new navigation words.
