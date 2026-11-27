Fixed by Opus 5.5 (cloud), in place of Astra.

Findings fixed: A7-1, A7-2, A7-3, A7-4 (todo/review/findings/A7.md) and A6-1, A6-2 (todo/review/findings/A6.md). The other findings in those files (A7-5, A6-3 to A6-6) are untouched, and their failing cases in the review suites still fail as they did.

The contract these fixes hold to: a name is shown only as the person chose. No migration was needed and none was written.

## A7-1: other guests saw the booking surname beside an included note

- What changed: one signature rule, `guestSignature` in `worker/src/sessionGuestBook.ts`. It is the note's own saved signature (`session_guest_book.signed_name`) or else the booking first name, never the surname. The guest-facing book on a booking link (`serveGuestBook`) and on a party link (`servePartyGuestBook` in `worker/src/afterSitPartyLinks.ts`) both use it. The host's review (`serveGuestBookReview`) keeps the roster name.
- Tests: `review-one-fact-every-door.test.ts` "guest-facing note signatures omit the booking surname" now passes. New case in `after-sit-party-links.test.ts`: it writes the old row shape first (a booking note with no saved signature) and checks that a party reader sees "Booker" and the host review still sees "Booker Full Name".
- Old tests updated to the contract: `session-guest-book-photos.test.ts:145` expected `Photo Guest` in the peer list and now expects `Photo`. `review-older-data.test.ts` ("keeps an included note signed, its old photograph unnamed...") expected `Lin Chen` in the guest-facing book and now expects `Lin` with no `Chen`. This is the pre-0128 row shape.

## A7-2: closing the Tea Table named a photographer who declined credit

- What changed: `publicPhoto` in `worker/src/familyRoutes.ts` applies the photographer's choice (`credit_name_shown`) first, in both switch states. A declined credit has no author at all: no name, no page, no slug. With the Tea Table closed, an allowed credit keeps the old tea page credit (page name and published page) and still has no `photograph_by` label. With it open, nothing changes.
- Tests: both states of "the public photograph respects its author" pass.
- Old tests updated to the contract: `quiet-acknowledgement.test.ts:249` expected the name with the stored choice at zero and now expects `author: null` with the photograph still served. Two cases in `teajia-family-routes.test.ts` (lines 268 and 341) assumed the default zero still named the author. They now check `author: null` first, then set `credit_name_shown = 1` and check the old credit, page link included.
- Not changed: `credit_name_shown` defaults to 0 since migration 0132, so every photograph from before then has no recorded consent. With the switch closed, those photographs now show without an author. Question for Adrian: should those photographers be asked, or should older photographs stay unnamed until they choose?

## A7-3: a later sitting appeared on the person page without a new share

- What changed: `wordsAsShared` in `worker/src/familyPersonTastings.ts`. A share that records its agreed sittings (`member_tasting_shares.tea_table_sittings`) shows only those sittings on the person page, and only notes written by `tea_table_at`, the same rule the Tea Table applies. An older page-only share has no such record and shows every sitting, as before.
- Tests: "the same consent covers the same sittings" passes. New case in `teajia-family-person-page.test.ts`: it reads the old page-only shape first (both sittings shown), then records `["s1"]` (only s1 shown), then adds a later note to s1 (left out).
- Not changed: `teaTable.ts` (not mine) keeps its own `wordsOnTheTable`. A circular import would have hit a temporal dead zone, so the rule now exists twice. A follow-up could have `teaTable.ts` call `wordsAsShared`.
- Questions for Adrian:
  1. Should older page-only shares keep showing every sitting, as they do now, or wait for a new share before showing words added later?
  2. Taking a tasting off the table clears `tea_table_sittings` when `page_alone_at` keeps it on the page. The person page then falls back to the page-only rule and shows every sitting. Is that what he wants?

## A7-4: a party guest's public note was credited to the booking holder

- What changed: `publicGuestNotes` in `worker/src/publicSessions.ts` uses the same `guestSignature`. The note's saved signature comes first and the booking first name is the fallback.
- Tests: "the published note carries the signature its party writer used" passes. In `public-session-teas.test.ts`, the old shape (notes with no signature) still credits `Ana` and `Kim` by first name.

## A6-1: a saved favourite showed later edits after the seller lost approval

- What changed: in `worker/src/favourites.ts`, `OPEN_SHOP` now includes the storefront's seller approval check (`personalSellerApprovedSql('a')` from `personalSellerApproval.ts`). It applies to the list, to keeping a tea and to looking up a tea to remove. The `user_favorites` row stays, so the heart comes back when approval does.
- Tests: "removes an old saved offer from favourites when the owner withdraws seller approval" passes with the switch open and closed. New case in `favourites.test.ts`: withdraw approval and the tea and its new name are gone while the heart row stays. Restore approval and the tea is back.
- Not changed: I did not add `personal_offer_withdrawn_at`. A withdrawn offer is already set to Archived and not public (index.ts), which the favourites filter already refuses.

## A6-2: an old shop favourite opened a missing product page in another shop

- What changed: the favourite's path is built with the existing `buildPublicProductHref` and the source shop's slug, for example `/shop/product/<slug>?store=<shop>`, with the id when there is no slug.
- Tests: "opens an old favourite in its own shop after visiting another shop" passes. New case in `favourites.test.ts`: an old heart with no `account_id` and a tea with no slug links as `/shop/product/tea-away?store=other-house`.
- Old test updated to the contract: `favourites.test.ts` expected `/shop/product/old-tree-red` and now expects `?store=shop` on it.

## Shared interfaces

No change to `src/lib/api.ts`, `src/types.ts`, any switch file or `worker/src/mcp.ts`. `FamilySharedPhotograph.author` was already typed `FamilyAuthor | null`. The favourites `path` stays a string, and `buildPublicProductHref` on the site keeps a `store` that is already present.

## Evidence

- `NODE_OPTIONS=--experimental-sqlite node_modules/.bin/vitest run worker/tests/review-one-fact-every-door.test.ts worker/tests/review-older-data.test.ts`: every A7-1 to A7-4, A6-1 and A6-2 case passes. Still failing, and left for their own fixers: A6-3 ("offers the fifty-first old saved place") and A6-4 ("stops listing an old session", in both switch states).
- These all pass: the 34 worker test files that touch the changed modules or their routes (after-sit, guest book, family, Tea Table, favourites, people, public sessions, seller approval and others), and the six site tests on person pages, the tea family, guest book grouping and product links.
- A whole worker run stopped at its time limit before it could report. The only failures it showed were the A6-3 and A6-4 cases above and `review-credit-ledger.test.ts`, the A10 tea credit cases that belong to the credit fixer. It also logged a unique constraint error on `tea_reference_issues`, which none of these files write.
- `npm run lint`, `npm run lint:worker-types` (27 known, no drift) and `npm run lint:colors` pass.
