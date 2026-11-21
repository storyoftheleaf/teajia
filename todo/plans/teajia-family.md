# Teajia family: member pages, photographs in the tasting, photographs on teas

Status: built 2026-11-20, brought up to current main 2026-11-21, all 19 lines passing in the practice shop. Not live. Working branch `claude/teajia-family-current-b1158f` (the first build's branch `claude/teajia-family` is superseded by it).
Picture of the plan on the real screens: https://claude.ai/artifact/XWhzBLWs9MY5Npv1GS5qTh

## Where it stands (measured 2026-11-21 by the manager session)

**Live on teajia.com.** Nothing of the family. The live site has the people list with two people (Adrian Rasmussen, Yan Jinwen), each person's page, a person's own editor and the shop's people editor. It also has the one shared photo editor and the calmer people-editor photo panel, which shipped on main while the family was being built.

**Built and waiting for "ship".** Everything in this plan, merged with `origin/main` at `88176e52` on the working branch and pushed there (never to main). Measured on the merged branch:

- `npm run lint`: passes. `npm run lint:colors`: passes. `npm run lint:worker-types`: 32 known errors, no drift.
- `npm run test:src`: 3,529 passed, 11 skipped, 339 files. `npm run test:worker`: 3,278 passed, 256 files.
- Practice-shop browser run: 10 of 10 specs passed (the tenth is the people list), and the full walk passed lines 1 to 18. `npm run test:mobile`: 40 of 40. Main's own tea page specs (`sold-out-restock`, `shop-refinement`): 8 of 8. So all 19 "Done in full" lines still pass after the merge.
- The merge had two conflicts. Main's shared photo editor was taken whole; the family's Crop button still opens it. One copy of the crop styles is kept (main's).
- The four family migrations were renumbered from 0069 to 0072 up to **0073 to 0076**, because main took 0071 and 0072 for shipping notices. All four only add tables or one empty column; none reads, changes or adds a row, so no before-and-after page is needed.
- The practice ports can now be set with `PRACTICE_API_PORT` and `PRACTICE_SITE_PORT`, because another session was holding 7813. This run used 8801 and 7821.

**The tea page was rebuilt on main the same day (`88176e52`), and the family was fitted into it.** Main's page wins wherever the two differed:

- The tea's class sits in the head of the plaque's border line and the year in the foot (main's), not in the foot toward the right (the 2026-11-20 change here). The plaque stays short on a phone and still never holds a photograph.
- The family's one row of photographs sits right under the plaque in the new layout. With nothing in the row the page is main's page, unchanged.
- A signed-in member opens their tasting from the "Taste" button among their tea actions (main's). The older "Yours" row is gone from tea pages.
- Signed out, the new page offered "Log in" only. "Add your tasting" is put back beside it, because decision 15 keeps the door there. Adrian has not yet seen this on the new page.
- A sold-out tea page carries one ask, main's "Inquire about purchasing more" in the order bar (Adrian, 2026-11-21: "Inquire only"). The family's "find me more" is off the tea page and stays on a person's own page, where a tea they tasted has gone. This narrows decision 9 and the tea page part of build stage 5.

**Done since.** Guest notes now shows each offered photograph in its member's own crop and shape (it showed the middle of the picture). Checked in `tests/practice-guest-notes.spec.ts`.

**The people list is built** (Adrian said go on 2026-11-21): see "The people list" below. With it the "no gamification" rule became "order only", in this plan and in the project rules, on his word. Migration 0077 only adds two empty columns. One thing to know before shipping: anyone on the live list without a photograph leaves the list the moment this ships.

**Open, in the order to take them.**

1. The family photograph zoom and the tasting's photograph row are not yet matched to the calmer people-editor photo panel that shipped on main.
2. The storage reading in the i64os warning system (another repository) must land before launch.
3. A lawyer's read of the "How we use photographs" page before launch.
4. Adrian's own list for the member page and the tasting: he chose "continue from plan" on 2026-11-21, so none is expected.
5. Adrian says ship; then the live site is proven to carry it.

## What it is

Anyone can join Teajia, taste a tea with voice notes and photographs in the one tasting screen, and share it to a page of their own. Their page is theirs and is live without review. The shop's tea pages stay the owner's: a member photograph reaches the public tea page only when the owner chooses it, credited and linked to the person. A signed-in member also sees their own photographs on the tea, and can make one their own cover for it.

## Decisions (Adrian, 2026-11-19). Do not reopen these.

1. **One tasting screen.** `TastingSession` is already the only tasting (opened from 18 places). Everything added lands there once, so the owner's sourcing tasting gets it too. Do not create a second tasting surface and do not change how the tasting looks beyond the additions below.
2. **In the tasting:** a camera button beside the existing microphone in the header (`tasting-header-controls`, next to `tasting-heading-mic`), on every page of the tasting. On the Impression page a "Your photographs" row sits ABOVE "Your notes", same label style, same box style. Love/Like/Neutral/Dislike, the rating, the notes box and the texture/effect/taste/storage bar do not move.
3. **One tasting per tea, as many notes as they like.** The existing one-entry-per-tea model stays. Notes are a dated list under that one tasting. No "Nth tasting" labels, no counts shown as achievement.
4. **Capture at the table is allowed**, one tap each. The app never prompts, reminds or nudges.
5. **The score is private.** Love/Dislike and the number out of ten never appear on a person's page or a tea page. Words and photographs only.
6. **Photographs become part of the site.** One line at upload: "Photographs you add may be shown on Teajia, with your name." beside a small link "How we use photographs" to a short page. No other warning text. A member can remove a photograph from their own page and their own view at once ("Remove from my page", never "Delete"). The file is kept so the shop can still use it. A real take-down is done by the owner on request.
7. **Notes are personal, and the owner reads them.** One line where a note is written: notes may be used to help describe the tea and help others learn about it. The owner gets a feedback list of all notes and a daily sheet (a download in Manage, not a scheduled job).
8. **Only Teajia teas.** A tasting attaches to a shop tea, as today.
9. **Sold-out teas stay on the person's page and in favourites**, marked as gone, with one action: ask Teajia to find more. That request lands with the owner.
10. **The member's own tea shop.** Signed in, on a tea page, a member sees thumbnails of their own photographs of that tea under the plate. They can make one their cover for that tea by tapping it or dragging it onto the plate. Only they see that cover. It must stay small; it is not a gallery wall.
11. **Others' photographs of the same tea** show in a small "From the family" strip on the tea page, only for photographs whose author shared them.
12. **The public lead picture is the owner's choice**, made in Guest notes (Publish), with "Photograph by Name" linking to the person. The tea's earlier picture is kept and restorable.
13. **Three words on one page:** Teajia family (anyone), tea creator, tea master (only the owner grants the last two). Same page and address at every step. Pay shows for tea masters only. A face is optional; one portrait slot and one or more links (Instagram or wherever they share).
14. **Family pages are live without review.** The existing draft-and-approve gate stays for tea masters. Guards for family: confirmed email, limits, a report line on the page, one-tap hide for the owner (photograph, tasting or whole page).
15. **Join at the tasting, and stay signed in.** The door stays where it is (tapping "Add your tasting" signed out). Shorten the join form to name, email, password and the Google button; everything else is asked later where it is needed (phone at first order). Sign-in must persist across visits. "Continue with Google" stays exactly as it is.
16. **Limits:** six photographs per tea per person, voice notes up to two minutes, twenty a day per person, a daily photograph ceiling per person.

## Changes after the first build (Adrian, 2026-11-20). These replace decisions 2, 10, 11 and 12 where they differ.

- **The plaque.** The top of the tea page is a gallery plaque, short on a phone, with three lines and no more: the name given to the tea (left out when there is none), the kind of tea, its Chinese characters. No photograph ever sits in the plaque. The tea's class ("Dark tea") is said under it, with where the tea is from. The rest of the page is unchanged.
- **One row under the plaque.** The shop's chosen picture, the family's shared photographs and the signed-in member's own sit in one small row. Nothing is written on or under a thumbnail and there is no "From the family" heading.
- **The zoom says everything.** Tapping a photograph opens it. "Photograph by Name" shows only there. On a member's own photograph the zoom offers "Use as my cover" (their photograph goes first in their row, seen only by them) and "Remove from my page". No dragging.
- **In the tasting** the thumbnails are smaller and bare; "Remove from my page" is in the zoom.
- **The photograph notice is the link alone.** "How we use photographs" sits inside the box the photographs are shown in. The longer sentence lives on that page, not in the tasting. This replaces the one-line notice in decision 6.
- **Three shapes only, square by default.** Every family photograph is shown square. Its author can switch it to 2:3 or 3:2 with a button in the zoom (stored per photograph, migration 0075; `src/lib/photographShape.ts`). The thumbnail and zoom are one shared part (`src/components/shared/Photographs.tsx`).

## The people list (Adrian, 2026-11-21). This replaces "a face is optional" in decision 13, for the list only.

His words: "We don't want ever a place where people have no profile picture in the people." "When it starts to get over a certain amount, it can be by who is the most active, plus some key selected early adopters who helped build it." "We don't have to say most active, but we want to highlight the people who really like to use the site. It's called quiet gamification."

1. **No photo, no place on the list.** A person's page still exists at its own address, but they appear on the list only once they have a photograph: one placed on their page (portrait, small round photo or a photo of their work), or one they shared from a tasting (Adrian, 2026-11-21: "Yes, it counts"). The newest shared tasting photograph stands as their picture on the list until they place one of their own. Hands or the practice count; a face is not required.
2. **Three groups, in this order:** "This season" (tea creators, tea masters and the pages from before the family, as before), "Founding members" (picked once by the owner for the early people who helped build it), "The family".
3. **The family is ordered quietly.** Position is the only reward: no badge, no number, no label, no "most active" wording anywhere, and the figures never leave the worker. The method, which he saw and did not change: one credit for each day a person shared a tasting (so posting more in a day earns nothing extra); the shop choosing someone's photograph for a tea page weighs three credits; a rolling 90 days, so old activity fades and a newcomer can rise. Past 24 people the rest sit behind "See everyone".
4. **The owner's hand stays on it.** In a person's Page settings: "Founding member" and "Pinned to the top". Hiding is the existing one-tap hide.

Built in `worker/src/peopleList.ts`, migration 0077 (two empty columns), `src/pages/ContributorsIndexPage.tsx`. Tests: `worker/tests/people-list.test.ts`.

## Not building

No likes, followers, counts, streaks, comments or feed. Quiet ordering of the people list is the one exception (see "The people list"): order only, with no badges, counts, streaks, nudges or notifications. No live Instagram feed. No change to navigation words, tab labels or routes in the nav components. No AI feature. No deploy: nothing here goes live until Adrian says ship.

## Known facts from the survey (measured 2026-11-19)

- Live shop: 21 teas, none has a photograph (`image_url` empty on all). The tea page plate (`label-plate`) is empty on every tea.
- `/api/transcribe` requires the `catalog` bundle, so members cannot use the microphone today.
- Phone-side shrinking exists (`src/pages/read/imageUtils.ts` `shrinkImage`, 2000px long edge; `preparePhoto` in `src/admin/components/contributorEditor/photoUpload.ts`). A photograph already under 2000px is sent untouched, with its location data. Workers cannot resize images, so both sizes are made on the phone and every upload is re-encoded there.
- Member photographs live in R2 (`MEDIA_BUCKET`), served through `/api/media/`. No small copies exist.
- People pages: `src/pages/ContributorProfilePage.tsx`, parts in `src/components/people/immersive.tsx`. Self-edit at `/account/profile` (`ProfileEditor.tsx`), own routes under `/api/me/public-profile*`, drafts in `contributor_profile_drafts`.
- Guest notes: `src/admin/components/CustomerNotesReview.tsx`, table `tasting_note_candidates`, route `/admin/tasting-notes`.
- `worker/src/index.ts` is one very large file and the worker type check pins known errors by line number. New worker code goes in new module files; touch `index.ts` only to register routes, and run `npm run lint:worker-types` after.
- **The practice shop does not start on current main.** The worker now requires the shared allowance governor (`SHARED_ALLOWANCE`, script `i64os-quota-guard`), which is not running locally, so every request answers 503 `shared_allowance_paused`. Proven fix: run wrangler with a generated copy of `wrangler.toml` that drops that one binding and sets `SHARED_ALLOWANCE_REQUIRED = "false"` (login then answers 200). The local database is also behind: `/api/people` fails on a missing `gi.focus` column until pending migrations are applied locally.
- Ports 7777 and 8787 belong to other sessions. Use 8798 (API) and 7813 (site). `.claude/launch.json` cannot be edited from a session, so the browser walk starts its own servers through the Playwright config.

## Build order

One stage at a time, in this one checkout, each ending with a commit. A stage does not start until the one before it has passed its checks. Every stage runs before committing: `npm run lint`, `npm run lint:colors`, `npm run lint:worker-types` if the worker changed, and the unit tests for what it touched.

0. **Practice shop runs here.** A script that writes the generated wrangler config (gitignored), npm scripts for API on 8798 and site on 7813, pending migrations applied to the local database, creator fixtures seeded. Proof: sign-in answers 200 and `/api/people` answers 200.
1. **Storage and the upload door (worker).** New migration, new tables only, no change to existing rows: member photographs (author, tea, tasting, two stored sizes, state: private, on my page, offered; shop use: none, placed, lead; hidden flag), a member's cover choice per tea, dated notes under a tasting if not already stored that way, restock requests, reports. Routes in new modules: upload both sizes with limits; list my photographs for a tea; set my cover; share and unshare a tasting; shared photographs for a tea; offered pile for the shop; place, make lead, restore, hide; restock request; report. Voice notes open to any signed-in member with their own limits. Tenancy on every query. Tests drive the routes against a real local database.
2. **The tasting screen.** Camera beside the microphone, photograph row above notes, the one-line notice, dated notes, and after Save a Share step (on my page; offer to Teajia; keep private is the default).
3. **A page for anyone.** Created on first share. Family role word, no Pay cell, optional face, links. Live without review for family; tea masters keep the approve gate. Owner can upgrade a person to tea creator or tea master in Manage.
4. **The person's page and the people list.** Tastings cell and section built from the existing grid and row parts, small pictures in grids, sold-out teas kept and marked with "find me more", and "The family" group under "This season".
5. **The tea page.** Member's own thumbnails and cover (tap or drag onto the plate), "From the family" strip, the public lead picture with its credit line, and the restock request on a sold-out tea.
6. **Guest notes and the owner's sheet.** Offered photographs beside notes (use, make lead picture, pass, restore), the feedback list of all notes, the daily sheet download, reports, and one-tap hide.
7. **The short door.** Join form reduced, sign-in that lasts, the "How we use photographs" page.
8. **The full walk and review.** A Playwright spec (imports from `tests/fixtures.ts`) that starts its own API and site and performs every line of the checklist below at 390 wide, saving a screenshot per line. Then an independent review of the whole diff against this file, a fix pass, and the walk again.

## Done in full

Each line is checked by the walk, on a phone-sized screen, in the practice shop.

1. A stranger opens a tea, taps "Add your tasting", and joins with name, email and password only.
2. They close the browser and come back still signed in.
3. In the tasting they tap the microphone, speak, and the words appear in the note. They are not shop staff.
4. They tap the camera on the Impression page and again on the taste page. Both photographs show in "Your photographs", above "Your notes".
5. A seventh photograph for that tea is refused in a plain sentence.
6. They add a second note on another day's sitting. Both notes are there, under one tasting.
7. They save and share. Their page exists at its own address with the tasting, and no score anywhere on it.
8. They appear under "The family" on the people list, with a photograph they shared as their picture.
9. Back on the tea, they see their own thumbnails, make one their cover, and it shows on the plate for them only. Signed out, the plate is as it was.
10. A second member who shared a photograph of the same tea appears in "From the family".
11. The shop signs in. The offered photographs and all notes are in Guest notes. The daily sheet downloads.
12. The shop makes one photograph the lead picture. Signed out, the tea shows it with "Photograph by" linking to the person. One tap restores the earlier state.
13. The member removes a photograph from their page. It is gone from their page and still available to the shop.
14. A sold-out tea still shows on their page, marked, and "find me more" reaches the shop.
15. The owner upgrades the person to tea creator and the word on their page changes.
16. A visitor reports a page. The owner hides it. It is gone from the list and from its address.
17. A 12 MB picture is stored under 1 MB, grids request the small copy, and the stored file has no location data. Numbers printed.
18. The owner opens a sourcing tasting. The same camera and photograph row are there.
19. `npm run lint`, `lint:colors`, `lint:worker-types`, the unit suites and `npm run test:mobile` pass, with output saved.

## Left for a person

- The storage reading in the i64os warning system (`i64os/apps/core/lib/meters/`) is in another repository and is not part of this branch. It must land before this goes live.
- The "How we use photographs" wording should be read by a lawyer before launch.
- Going live: Adrian says ship.

## If the night stops early

Nothing half-built is merged. The last commit on the branch is the last stage that passed. The morning report says which checklist lines pass, which do not, and why.
- **Crop, the way Curate does it.** A photograph is square to begin with. "Crop" in the zoom opens the editor Curate frames its photographs with (square, 2:3, 3:2, drag and pinch). Only the frame is saved, as numbers beside the photograph (migration 0076, one empty column); the stored picture is never changed, so a picture the shop approved cannot be swapped through a crop. The editor's turn control is off here, because a frame cannot hold a turn.
- **The tea's class is set into the plaque's border line.** "Dark tea" sits in the bottom line of the plaque, toward the right, in the line's own colour; the line stops for the word. It no longer sits above where the tea is from.
- **No line about who sees a cover.** The button already says it.
