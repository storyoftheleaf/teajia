Repository storyoftheleaf/teajia. Your branch is build/l1-s7-chest, made from build/launch-1.

Goal: adding a tea to the Tea Chest by hand asks where it came from, including a gift and who gave it; and any tea in the chest can be tasted in the journal without retyping its name.

Already done on build/launch-1:
- CellarItem (src/lib/teaChestTypes.ts) has `source?: CellarSource | null` where CellarSource is { kind: 'bought' | 'gift' | 'session' | 'own'; fromName?; eventId?; eventTitle?; invoiceId? }. The chest list returns it (eventTitle is the session's title).
- api.cellar.create and api.cellar.update accept `source_kind` ('gift', 'own' or null) and `source_from_name`. The server ignores a hand change to a tea whose source the site set ('bought', 'session').

Approved behaviour for you to build:
- In the add and edit form of src/components/AccountPanel/CellarView.tsx: one optional choice "Where it came from" with two options by hand, "A gift" and "My own". Choosing "A gift" shows one optional text field "From". Leaving the choice empty is allowed and stores nothing. A tea whose source is 'bought' or 'session' shows its source as text in the edit form, not as a choice.
- On each chest tea, one quiet line when source is set: "A gift from <name>" or "A gift"; "From <session title>" (or "From a session" when the title is missing); "Bought"; nothing for 'own' or unset. Never guess a source for an older tea.
- A tea with grams 0 and source 'session' shows "Tasted, none held" where the grams would be, not "0 g". Every other tea keeps its grams exactly as today, 0 g included. A session tea has no cost: show no "Paid" line for it rather than a dash or zero.
- "Taste this" on each chest tea opens the journal with the tea filled in. src/pages/JournalPage.tsx already reads `?tea=<productId>` (readJournalDeepLink). Extend that reader to accept `?chest=<chestItemId>`: when the chest tea has linkedProductId use the product as today; otherwise start an entry with the tea's name and type filled in. The journal table already allows an entry with a name and no product; confirm by reading how a journal entry is saved, and if it does not, stop and say so.

You own: src/components/AccountPanel/CellarView.tsx, src/pages/JournalPage.tsx and its test src/pages/JournalPage.test.ts.
Do not touch: worker/, src/lib/api.ts, src/lib/store.ts, src/lib/teaChestTypes.ts, src/App.tsx, any tile, label or navigation in the account panel other than the chest's own form and rows.

Must be preserved: everything the chest does today (grams, photograph, notes, cost, shelf offers, placement). A stored 0 renders as 0 everywhere except the one "Tasted, none held" case above. Never write Number(x) || 0 or ?? 0 on a cost. Adding a tea by hand still requires what it cost and its currency, as today; a gift that cost nothing is a typed 0.

Style rules that bite: safe colour tokens only; TYPOGRAPHY_CLASSES or text-ui-N; flex-wrap, no horizontal scroll; tap-target on small controls; the mobile bottom bar overlaps content, so use the pb-nav classes from card-utilities.css, never an inline calc(); no em dashes in wording. A step (an open form or panel) lives in the address through useStepParam if you add one.

Acceptance check: extend src/pages/JournalPage.test.ts for the `chest` deep link (with and without a linked product). Run npm run test:src -- src/pages/JournalPage.test.ts (or the vitest command in package.json for src tests), npm run lint, npm run lint:colors, and npm run test:mobile (required for any change under src/components/AccountPanel/; it starts its own server, so make sure nothing of yours holds 7777). In the local test shop if the ports are free (sign in as mei / mei): add a gift from a named person, see the line, tap "Taste this", see the name filled in.

Report back: the branch, what you ran and its result, anything you could not do.

Working rules for every slice:
- You are in your own git worktree of storyoftheleaf/teajia on your own branch, made from build/launch-1. Commit your work on that branch with a plain message. Do not push and do not open a pull request; the build owner does that after checking your work.
- Launch 1 is behind one flag: src/lib/firstTable.ts, `FIRST_TABLE_OPEN` (false), read through `firstTableOpen()`. To see it on locally: VITE_FIRST_TABLE_OPEN=true for the site; FIRST_TABLE_OPEN=true when starting the worker sandbox.
- The local test shop: `TEAJIA_OFFLINE_FIXTURES_STATE=$PWD/.wrangler/ft FIRST_TABLE_OPEN=true npm run sandbox:offline:fixtures` (Node 22 and the sqlite3 CLI) loads worker/sandbox/first-table-fixture.mjs: one finished session "First table, a test sit" with three teas (one for sale, one public and not for sale, one plain name), two guests, one paid order. Its header lists every id, the two after-sit links and the guest sign-in (mei / mei). The operator signs in as sandbox / sandbox. Never use npm run dev: it points at the live shop.
- Ports 7777 and 8787 may be held by another worker. If they are, do not stop anything you did not start; run the unit tests and lint, and say the sandbox check is left for the build owner.
- Wording people read: plain, short, no em dashes, no new navigation words.
