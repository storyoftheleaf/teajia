Repository storyoftheleaf/teajia. Your branch is build/l1-s4-reading, made from build/launch-1.

Goal: a host picks at most one published article for a session, and guests see it on the session's public page.

Already done on build/launch-1, so do not redo it:
- The column events.reading_article_id exists.
- worker/src/eventDomain.ts exports `readableArticleFor(db, accountId, articleId)` returning { id, slug, title } for a published article of that account, else null.
- The event update route (PUT on an event in Manage, handleUpdateEvent) accepts `reading_article_id`: null or '' clears it, an id that readableArticleFor refuses is answered 400 "Choose a published article from this shop."
- The public session payload (GET /api/events/:slug/public) returns `reading: { slug, title } | null`, and only while the article is still published.

Approved behaviour for you to build:
- In the session editor (src/admin/components/EventForm/), add one control "A reading for guests": a select of this shop's published articles, with "None" first. Saving and clearing both work. Follow the existing field pattern in that folder, including how fields save and how the editor loads the event (it must show the saved choice on reload; if the admin event payload does not carry reading_article_id, say so in your report rather than changing the server). Find how the admin already lists articles in src/lib/api.ts (`articles`) and use that read; filter to published.
- On the public session page (src/components/events/EventLanding.tsx), when the session payload has `reading { slug, title }`, show one line "To read before you come" linking to /article/<slug>. Nothing when absent. Add `reading?: { slug: string; title: string } | null` to the page's local type for the payload if it has one; if the type lives in a shared file you may not touch, say which.

You own: files inside src/admin/components/EventForm/, the reading line in src/components/events/EventLanding.tsx, and a new tests/event-reading.spec.ts.
Do not touch: worker/, src/lib/api.ts, src/types.ts, src/App.tsx, any navigation. If you need a line in one of those, say exactly which line and why.

Must be preserved: every existing field of the session editor and how it saves. Admin steps live in the address: if your control opens a panel or tab, use useStepParam (src/hooks/useStepParam.ts); a plain select needs nothing. Full-screen admin overlays use z-modal.

Style rules that bite: the safe colour tokens only (tea-text, tea-surface, tea-bg, tea-elevated, tea-gold, tea-gold-lt, tea-border, tea-accent-sub, tea-text-sec, tea-text-dim); TYPOGRAPHY_CLASSES or text-ui-N; no em dashes in wording.

Acceptance check: tests/event-reading.spec.ts, mocking the API in the style of the other specs in tests/, proves the editor offers only published articles with "None" first, sends reading_article_id on save and null on clearing, and that the public page shows the line when `reading` is set and nothing when it is null. Then in the local test shop, if the ports are free: as sandbox / sandbox open "First table, a test sit" in Manage, pick "Before a white tea", reload, see it kept; open /event/first-table-test (the public page may refuse a completed session; say what you see); clear it. Run npm run lint, npm run lint:colors.

Report back: the branch, what you verified and how, anything you could not do.

Working rules for every slice:
- You are in your own git worktree of storyoftheleaf/teajia on your own branch, made from build/launch-1. Commit your work on that branch with a plain message. Do not push and do not open a pull request; the build owner does that after checking your work.
- Launch 1 is behind one flag: src/lib/firstTable.ts, `FIRST_TABLE_OPEN` (false), read through `firstTableOpen()`. To see it on locally: VITE_FIRST_TABLE_OPEN=true for the site; FIRST_TABLE_OPEN=true when starting the worker sandbox.
- The local test shop: `TEAJIA_OFFLINE_FIXTURES_STATE=$PWD/.wrangler/ft FIRST_TABLE_OPEN=true npm run sandbox:offline:fixtures` (Node 22 and the sqlite3 CLI) loads worker/sandbox/first-table-fixture.mjs: one finished session "First table, a test sit" with three teas (one for sale, one public and not for sale, one plain name), two guests, one paid order. Its header lists every id, the two after-sit links and the guest sign-in (mei / mei). The operator signs in as sandbox / sandbox. Never use npm run dev: it points at the live shop.
- Ports 7777 and 8787 may be held by another worker. If they are, do not stop anything you did not start; run the unit tests and lint, and say the sandbox check is left for the build owner.
- Wording people read: plain, short, no em dashes, no new navigation words.
