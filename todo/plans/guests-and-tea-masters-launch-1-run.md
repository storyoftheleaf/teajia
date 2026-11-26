# Launch 1, the first table: the run sheet for Opus 5.5

**Status: ready to run, 2026-11-26.** Written by the Fable build thread from a read of the code on that day. This file turns Launch 1 of [guests-and-tea-masters-build.md](guests-and-tea-masters-build.md) into slices with one owner each, and carries the exact message to send each worker. The why is in [guests-and-tea-masters.md](guests-and-tea-masters.md). Where this file and the build file differ on Launch 1, this file is the newer one, and each difference is listed under "What changed from the build file".

Launches 2 to 5 are not cut here on purpose. Each is cut the same way once the one before has been used by real people.

## Opus, do these first

1. **Make the integration branch.** `build/launch-1` from `main`. Every slice opens a pull request into it. Nothing goes to `main` before the gate and Adrian's "ship", because a push to `main` publishes the live site.
2. **Stand up a test table.** The sandbox database has the catalogue and no users, guests, sessions or orders (`docs/claude/testing.md`), and every slice below needs a finished session to look at. Run `npm run sandbox:offline:fixtures` (Node 22 and the `sqlite3` CLI), then add one fixture, in `worker/sandbox/`, that every worker reuses: one completed session in the sandbox shop with three teas on its menu (one a public product for sale, one a public product not for sale, one a plain name), a playlist link, two confirmed guests marked attended, one of them linked to a signed-in user, and one paid website order for that user with a tea line in grams and a teaware line. Until this exists, do not send any worker message.
3. **Run the three small checks** under "Checks that could change the build". Each takes minutes and two of them can change a slice.
4. **Write slice S1** (the contract) and merge it into `build/launch-1`. Then start S2 yourself and send the messages marked "can start after S1".

## Who does what

Adrian set this routing on 2026-11-26. It replaces the tier letters in the build file for Launch 1.

| Who | Work |
|---|---|
| **Opus 5.5** | Owns the build end to end: ordinary engineering decisions, every shared file, small changes where handing off costs more than doing, integration, and the final walk as a guest and as a host |
| **GPT-6.2 Sol** | Settled, bounded changes: the behaviour, the files, what must not change and one focused check are all stated |
| **GPT-6.2 Astra** | Settled behaviour where the details are easy to get wrong: older data, repeated taps, retries, the same fact read through several doors. Returns a patch or findings, as its message says |
| **Fable** | Questions where the approach itself is unsure. Its answers for Launch 1 are the next section. Bring it new ones through the build thread |

Shared files only Opus edits: `worker/src/index.ts`, `src/App.tsx`, `src/lib/store.ts`, `src/lib/api.ts`, `src/types.ts`, `src/styles/tokens.css`, `worker/migrations/`, `worker/src/mcpTools/registry.ts`, `CLAUDE.md`, `docs/PILLAR.md`, and the two build files. Workers write new modules and export functions. Opus adds the wiring lines.

## How the Sol and Astra workers are run

Adrian, 2026-11-26: the build decides who gets what and sends the work itself, and he speaks through the project chat. He is not asked to paste anything.

Checked on his Mac the same day: the Codex command-line tool is installed (`codex-cli 0.153.4`) and signed in with his ChatGPT account. Opus reaches it through a Remote Control session in the Teajia folder on his Mac.

- **Models.** Sol is `gpt-6.2-sol`, already Codex's default there. Astra is 6.2 as well; Adrian confirmed it exists. The list saved on the Mac did not show its id, so run `codex debug models` with network once and use the 6.2 Astra id it prints. If none is printed, ask in the project chat before sending Astra's messages. Do not quietly send them to another model.
- **Never work in his folder.** His checkout is on `main`, 361 commits behind GitHub, with unsaved work. Do not pull, reset, stash or commit there. For each worker: `git fetch origin build/launch-1`, then `git worktree add ../teajia-l1-<slice> -b build/l1-<slice> origin/build/launch-1`, run outside the Codex sandbox.
- **One run per worker.** Save the worker's message as `prompt.md` in its worktree, then `codex exec -C ../teajia-l1-<slice> -m <model> -s workspace-write -o last.md - < prompt.md`. Always pass `-s workspace-write`: his Codex config defaults to full access with no approvals. Astra's read-only audit (S9) uses `-s read-only`.
- **Opus pushes and opens the pull request**, not the worker, after reading `last.md` and the diff and running the worker's acceptance check itself. A worker's word is not the check.
- **Ports.** Only one sandbox can hold 7777 and 8787 on the Mac. Workers that need the browser run one at a time, or Opus runs their sandbox check for them in the cloud.
- **At the end.** Remove each worktree once its pull request is merged, and close the Remote Control session.
- **If the Mac is asleep or unreachable**, Opus does that slice itself or waits, and says so in the project chat. It does not hand a Sol or Astra slice to a different model family without Adrian's word.

## The hard questions, settled

Each has the evidence, the recommendation, and what would prove it wrong.

### 1. The thank-you already exists. Extend it, do not build a second page.

**Evidence.** `/after-sit` (`src/pages/AfterSitPage.tsx`, `worker/src/afterSitAccess.ts`) is already a page a guest opens with no account, from a link the host copies in Manage ("Copy guest link" in `src/admin/components/AttendeeTable.tsx`). It shows the host's note, the teas served by name, a button to keep the setup, and the guest book for words and a photograph. Its access is careful and tested: one secret per seat, stored only as a hash, valid 14 days, only for a guest who was confirmed and marked attended at a completed session, removed by a database trigger if attendance is corrected, rate limited, never cached (`worker/tests/after-sit-access.test.ts`, `after-sit-party-links.test.ts`).

**Recommendation.** The thank-you is this page with four things added: each tea opens onto its page, the playlist, the reading, and "keep this tea". No new `SessionThanksPage`, no new kind of link, no second answer to "who may open this". That removes the largest privacy question in Launch 1, since the people who can open a thank-you are exactly the people who can open an after-sit link today.

**What would change it.** If Adrian wants one link for the whole table instead of one per guest. See his working action below. If he does, Opus adds a second, read-only table link that shows teas, playlist and reading and carries no guest book. That is an addition to this plan, not a rewrite, so nothing waits on it.

### 2. "Keep this tea" in Launch 1 is from the thank-you only.

**Evidence.** The build file has it "from the thank-you or from a tea's page". A tea kept from a shop page, never bought and never poured for you, has no grams and no story. That is a favourite, which is Launch 4 ("favourites in three kinds").

**Recommendation.** Leave the shop page alone in Launch 1. A kept tea is always one that was poured for the person, so its "where it came from" is always a session.

### 3. A kept tea is a Tea Chest row with zero grams and no cost.

**Evidence.** `personal_cellar_items.grams` is `REAL NOT NULL DEFAULT 0` and the cost columns are nullable (`0084_personal_tea_prices.sql`). The standing rule is that nothing is invented: no grams were held and no cost was stated.

**Recommendation.** Kept from a session: `grams = 0`, `chest_cost_amount` and `chest_cost_currency` left NULL, `linked_product_id` set only when the tea is a public product. Check 2 below decides whether the chest screen needs a small "tasted, none held" state.

### 4. A bought tea reaches the chest only by the buyer's tap, once per order line.

**Evidence.** A person's orders are found by `loadMyOrderOwnership` (`worker/src/index.ts:23926`), which matches on the linked customer, then email, then phone. Order lines are `invoice_line_items` with `product_id`, `quantity` and `quantity_unit` ('g' or 'unit').

**Recommendation.** One route, `POST /api/me/orders/:id/keep-in-chest` with a line id. A unique index on (owner, order line) makes a second tap return the same chest row. Tea lines only. Paid orders only. The subtle parts (phone-matched orders, unit lines for cakes, cancelled and refunded orders, repeated taps) go to Astra as a patch, slice S6.

### 5. Where an order came from is a small table beside the order request, written by one function.

**Evidence.** The build file says "a column". But an order request is inserted in five places in `handleCreateInquiry` (`worker/src/index.ts:15337`, `15420`, `15490` to `15499`) plus one in `worker/src/mcp.ts:8296`, and invoices in eight more. A column means touching every one of them, and missing one silently loses the fact.

**Recommendation.** A new table `order_session_sources`, one row per order request that came through a thank-you, written by one exported function called once at the end of `handleCreateInquiry`. An invoice finds its source through `invoices.source_inquiry_id`, which already exists. The shop's own order path is not edited at all. The link from the thank-you to the shop carries a short random reference kept on the session (`events.thanks_ref`), never the guest's seat secret, so nothing private rides in a shop address. The host is read from the session on the server, never taken from the browser.

**What it does not do.** No credit is paid and nothing is shown, as decided. The reference proves only "this order began from that session's thank-you". The credit rule (Q8) decides later what that is worth.

### 6. The invite repair is one page, and the server is already right.

**Evidence.** Five places in `worker/src/index.ts` (lines 21382, 22646, 22905, 23069, 23153) put an account or tea master invite token in `password_reset_tokens` and send the address `/invite/<token>`. `src/App.tsx:1307` gives that address to `GuestInviteClaimPage`, which only asks `/api/guest-invite/:token` and so answers "Invite not found". The handler that does accept those tokens, `handleResetPassword` (`index.ts:2547`), already sets the password, marks the email verified and turns the invited membership active. Only `/reset-password?token=` reaches it.

**Recommendation.** Keep the address, because invites already sent must start working. When the guest invite lookup says not found, the page offers "set your password to accept" and posts the same token to the existing reset route. No worker change. Opus does this one itself (slice S2) because it is sign-in. It needs no flag and can ship ahead of the launch if Adrian says "ship" for it alone.

### 7. One migration, columns and one table only, no existing row touched.

So there is no before and after page to show Adrian for Launch 1. Existing chest teas keep `source_kind` NULL, which the screens show as nothing at all. Nobody guesses where an old tea came from.

## Checks that could change the build

| # | Check | How | What it changes |
|---|---|---|---|
| 1 | The invite link really fails | In the sandbox, Settings, add a member with a new email, open the returned `/invite/…` link | Expected "Invite not found". If it works, S2 shrinks to a test |
| 2 | A zero-gram tea in the chest | Add a chest tea with 0 grams, look at `src/components/AccountPanel/CellarView.tsx` on a phone-sized screen | If it reads as empty or finished, S7 adds a plain "tasted, none held" line. If it is hidden, S5 cannot ship until S7 does |
| 3 | The tea ids match | The after-sit page lists teas through `namedSetupTeas` (`worker/src/sessionServedTeas.ts`); tea pages and prices come from `resolveSessionTeas` (`worker/src/sessionTeas.ts`). Confirm one id can be used for both on the fixture session | If not, S1 adds a mapping in the payload before S3 and S5 start |

## The contract (slice S1)

Opus writes this first. If a name changes while writing it, change it in the worker messages below before sending them.

**Migration**, the next free number after `0127` at the time it merges, `worker/migrations/0128_first_table.sql`:

```sql
ALTER TABLE events ADD COLUMN reading_article_id TEXT;
ALTER TABLE events ADD COLUMN thanks_ref TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_thanks_ref ON events(thanks_ref) WHERE thanks_ref IS NOT NULL;

ALTER TABLE personal_cellar_items ADD COLUMN source_kind TEXT CHECK (source_kind IN ('bought','gift','session','own'));
ALTER TABLE personal_cellar_items ADD COLUMN source_from_name TEXT;
ALTER TABLE personal_cellar_items ADD COLUMN source_event_id TEXT;
ALTER TABLE personal_cellar_items ADD COLUMN source_tea_ref TEXT;
ALTER TABLE personal_cellar_items ADD COLUMN source_invoice_id TEXT;
ALTER TABLE personal_cellar_items ADD COLUMN source_invoice_line_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_cellar_bought_once
  ON personal_cellar_items(owner_user_id, source_invoice_line_id) WHERE source_invoice_line_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_cellar_session_once
  ON personal_cellar_items(owner_user_id, source_event_id, source_tea_ref) WHERE source_kind = 'session';

CREATE TABLE IF NOT EXISTS order_session_sources (
  inquiry_id   TEXT PRIMARY KEY,
  account_id   TEXT NOT NULL,
  event_id     TEXT NOT NULL,
  host_user_id TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Flag.** `src/lib/firstTable.ts` exports `FIRST_TABLE_OPEN = false`, in the style of `src/lib/brewingExperiences.ts`. The worker imports the same constant, as `worker/src/teaMasterSales.ts` already imports from `src`. New reads are additive and harmless. Every new write route answers 404 while the flag is off. Launch 1 is this flag turning on.

**Types.** `CellarItem` in `src/lib/teaChestTypes.ts` gains `source?: { kind: 'bought' | 'gift' | 'session' | 'own'; fromName?: string | null; eventId?: string | null; eventTitle?: string | null; invoiceId?: string | null } | null`. `AfterSitRecap` in `src/lib/afterSitAccess.ts` gains:

```ts
teas: Array<{ id: string; name: string; path?: string | null; kept?: boolean }>;
playlist_url?: string | null;
reading?: { slug: string; title: string } | null;
thanks_ref?: string | null;
```

**Routes**, all wired by Opus:

| Route | Who may call | Does |
|---|---|---|
| after-sit recap lookup (existing) | The seat's link | Also returns `path` per tea, `playlist_url`, `reading`, `thanks_ref`. `kept` is filled only when the caller is also signed in |
| `POST /api/after-sit/keep-tea` `{ credential, teaId }` | The seat's link and a signed-in user | Puts that tea in the user's chest once. Returns the chest item |
| `POST /api/me/orders/:id/keep-in-chest` `{ lineId }` | The order's signed-in buyer | Puts that line's tea in the chest once, with its grams. Returns the chest item |
| `GET /api/me/orders/:id` (existing) | The buyer | Each line also carries `chest_item_id` and `can_keep` |
| chest create and update (existing, `index.ts:16006`, `16074`) | The owner | Accept `source_kind` (only `gift` or `own` by hand) and `source_from_name` |
| event update (existing, `EVENT_ALLOWED_COLS` at `index.ts:13728`) | The host | Accepts `reading_article_id`, checked by a function from `worker/src/eventDomain.ts` |
| `POST /api/inquiries` (existing) | Anyone | Accepts optional `via` (a `thanks_ref`). One call to `recordOrderSessionSource` after the request is saved |

## The slices

Twelve slices. S1, S2, S8 and S12 are Opus's own. Six go to Sol, two to Astra.

| # | Slice | Owner | Starts | Files it owns | Proven by |
|---|---|---|---|---|---|
| S1 | The contract: migration, flag, types, the after-sit payload additions, wiring stubs | Opus | Now | Shared files, `worker/src/afterSitAccess.ts`, `src/lib/firstTable.ts` | Migration applies on the offline sandbox; `npm run lint`; `npm run lint:worker-types`; `after-sit-access.test.ts` still passes |
| S2 | Invite repair | Opus | Now, beside S1 | `src/pages/GuestInviteClaimPage.tsx`, new `tests/invite-accept.spec.ts` | Both kinds of link accepted in the sandbox |
| S3 | The thank-you page: teas open onto their pages, playlist, reading | Sol | After S1 | `src/pages/AfterSitPage.tsx`, new `src/components/events/ThanksTeas.tsx` | New `tests/first-table-thanks.spec.ts` at 390 wide |
| S4 | A session carries one reading | Sol | After S1 | `worker/src/eventDomain.ts` (one new function), `src/admin/components/EventForm/`, `src/components/events/EventLanding.tsx` | Picked, saved, shown, removed in the sandbox |
| S5 | Keep this tea, from the thank-you | Sol | After S1 | New `worker/src/chestKeep.ts`, new `src/components/events/KeepTeaButton.tsx`, new `worker/tests/chest-keep.test.ts` | The worker test; a guest keeps a tea and it is in the chest with its session |
| S6 | A bought tea arrives in the chest | Astra, patch | After S5 | `worker/src/chestKeep.ts` (adds to it), `src/pages/OrderDetailPage.tsx`, new `worker/tests/chest-keep-bought.test.ts` | The cases named in its message, each as a test |
| S7 | Where a chest tea came from, and "taste this" | Sol | After S1 | `src/components/AccountPanel/CellarView.tsx`, `src/pages/JournalPage.tsx` | `npm run test:mobile`; a gift is added and tasted without retyping |
| S8 | Where an order came from | Opus | After S3 | New `worker/src/orderSessionSource.ts`, `src/lib/store.ts`, the one call in `index.ts` | An order from a thank-you has a row; one from the shop has none |
| S9 | Audit: who can read what, and whether the order source can be wrong | Astra, findings | After S3, S5, S8 | Read only | The evidence named in its message |
| S10 | The same actions as agent tools | Sol | After S4, S5 | New `worker/src/mcpTools/firstTable.ts` | A worker test that each write previews, then confirms |
| S11 | Browser checks for the whole journey | Sol, a worker that built none of it | After S3 to S8 | New `tests/first-table.spec.ts` | Passes on phone and desktop sizes against the sandbox |
| S12 | Home's sentence and door; six reading drafts; truth-up of `docs/PILLAR.md`, `docs/CHANGELOG.md`, `docs/STATE_OF_THE_SITE.md`; the ledger | Opus | Home after Q2, the rest last | `src/pages/HomeV2Page.tsx`, `docs/` | Adrian's sentence, his yes. No bar word changes |

**Side by side after S1:** S3, S4, S5, S7. That is four workers, which is the ceiling. **In order:** S1, then S5, then S6. S3, then S8, then S9. **Waiting on Adrian:** only the Home part of S12 (his sentence). Nothing else waits.

## What Adrian is asked, and what he can try

- **Q3 and the shape of the link, one action.** On any session of yours that is finished, open it in Manage, open the guest list, and tap "Copy guest link" beside one guest, or beside yourself. Open it on your phone. That is today's thank-you. Then say: is one link per guest right, or do you want one link for the whole table? We build on one per guest until you say otherwise, and that same session can be the one you run by hand (L1-00).
- **Q2, Home's sentence.** Send the sentence you say out loud when a guest asks what Teajia is. Rough is fine.
- **Q1.** Launch 1 is your own tables only. Treated as yes.
- **One change to notice.** "Keep this tea" is on the thank-you only in Launch 1, not on shop pages. Say so if you want it on shop pages now.

## What changed from the build file

| Build file | This run sheet | Why |
|---|---|---|
| L1-04, a new thank-you page | The existing `/after-sit` page, extended | It already is the thank-you, with tested access |
| L1-05, keep from the thank-you or a tea's page | From the thank-you only | A tea kept from a shop page is a favourite, Launch 4 |
| L1-01, a column for the host an order came through | A small table beside the order request | One writer instead of fourteen insert sites |
| L1-R, review of who can open a thank-you | S9, narrowed to what the page newly shows | The door itself is unchanged |
| Tiers A, B, C, R | Opus, Sol, Astra | Adrian's routing of 2026-11-26 |

## The messages to send

Each is complete without this file. Send it as written, after replacing any name that changed in S1. Every worker branches from `build/launch-1` and opens its pull request into `build/launch-1`.

### Sol, S3: the thank-you page

```
Repository storyoftheleaf/teajia. Branch from build/launch-1 as build/l1-s3-thanks; open your pull request into build/launch-1, never main.

Goal: a guest who opens their after-sit link sees the teas that were poured (each one opening onto its page when it has one), the playlist, and one thing to read.

Approved behaviour:
- The page is src/pages/AfterSitPage.tsx at /after-sit. Its data type AfterSitRecap (src/lib/afterSitAccess.ts) now carries, per tea, an optional `path`; and at the top level optional `playlist_url`, `reading { slug, title }`. These are already returned by the server. Do not change the type or the server.
- "Teas served": a tea with a `path` is a link to that path. A tea without one stays plain text. No prices on this page.
- Playlist: when `playlist_url` is set, show it the way the public recap does. Reuse the pattern in src/pages/EventRecapPage.tsx (PlaylistSection). Move that component into src/components/events/ so both pages share one copy.
- Reading: when `reading` is set, one line "To read" linking to /article/<slug> with the title as the link text.
- A session with no teas, no playlist and no reading must still be a good page: the title, date, host's note and the guest book, with no empty headings.
- Order on the page: title and date, host's note, teas, reading, playlist, then the existing PrivateKeptSetup and GuestBook exactly as they are.

You own: src/pages/AfterSitPage.tsx, a new src/components/events/ThanksTeas.tsx, the moved playlist component, and a new tests/first-table-thanks.spec.ts.
Do not touch: worker/, src/App.tsx, src/lib/api.ts, src/lib/afterSitAccess.ts, src/types.ts, the GuestBook and PrivateKeptSetup components, any navigation.

Must be preserved: the loading, missing, error and "copy on this device" states of the page; the credential handling; the existing test tests/after-sit-guest-book-photos.spec.ts must still pass.

Style rules that bite (from CLAUDE.md): colours only from tea-text, tea-surface, tea-bg, tea-elevated, tea-gold, tea-gold-lt, tea-border, tea-accent-sub, tea-text-sec, tea-text-dim. border-tea-border takes no opacity modifier. Headings and body through TYPOGRAPHY_CLASSES; raw sizes as text-ui-N, never text-[Npx]. No horizontal scroll, use flex-wrap. Anything tappable under 44 by 44 gets the class tap-target. No em dashes in any wording.

Acceptance check: tests/first-table-thanks.spec.ts, using the route-mocking style of tests/after-sit-guest-book-photos.spec.ts, covers (a) a full recap at 390 by 844 with a linked tea, a plain tea, a playlist and a reading, (b) an empty recap with none of them and no empty headings, (c) no horizontal overflow. Run npm run lint and npm run lint:colors.

Report back: the branch, what you ran and its result, and anything you could not do. If you find you need a field the payload does not carry, or a product decision, stop and send the exact conflict. Do not work around it.
```

### Sol, S4: a session carries one reading

```
Repository storyoftheleaf/teajia. Branch from build/launch-1 as build/l1-s4-reading; pull request into build/launch-1, never main.

Goal: a host picks at most one published article for a session, and guests see it on the session's public page.

Approved behaviour:
- The column events.reading_article_id (TEXT, nullable) already exists. The event update route already accepts the field `reading_article_id` and calls a function you write.
- Write, in worker/src/eventDomain.ts, `export async function readableArticleFor(db, accountId, articleId)` returning { id, slug, title } when the article exists, is published, and belongs to that account, else null. The route refuses a value this returns null for. An empty string or null clears the reading.
- In the session editor (src/admin/components/EventForm/), add one control "A reading for guests": a select of published articles, with "None" first. Saving and clearing both work. Follow the existing field pattern in that folder, including how fields save.
- On the public session page (src/components/events/EventLanding.tsx), when the session payload has `reading { slug, title }`, show one line "To read before you come" linking to /article/<slug>. Nothing when absent.

You own: the one new function in worker/src/eventDomain.ts, files inside src/admin/components/EventForm/, the reading line in src/components/events/EventLanding.tsx, a new worker/tests/event-reading.test.ts.
Do not touch: worker/src/index.ts, worker/migrations/, src/lib/api.ts, src/types.ts, src/App.tsx, any navigation. If you need a line in one of those, say exactly which line and why.

Must be preserved: every existing field of the session editor and how it saves. Admin steps live in the address: if your control opens a panel or tab, use useStepParam (src/hooks/useStepParam.ts); a plain select needs nothing. Full-screen admin overlays use z-modal.

Style rules that bite: the safe colour tokens only (tea-text, tea-surface, tea-bg, tea-elevated, tea-gold, tea-gold-lt, tea-border, tea-accent-sub, tea-text-sec, tea-text-dim); TYPOGRAPHY_CLASSES or text-ui-N; no em dashes in wording.

Acceptance check: worker/tests/event-reading.test.ts proves readableArticleFor refuses a draft article, an article from another account and an unknown id, and accepts a published one. Then in the sandbox (npm run sandbox, sign in sandbox / sandbox; never npm run dev, which edits the real shop): pick a reading, reload, see it kept; open the public session page, see the line; clear it, see it gone. Run npm run lint, npm run lint:worker-types, npm run lint:colors.

Report back: the branch, what you verified and how, anything you could not do.
```

### Sol, S5: keep this tea

```
Repository storyoftheleaf/teajia. Branch from build/launch-1 as build/l1-s5-keep; pull request into build/launch-1, never main.

Goal: beside each tea on the after-sit page, a guest taps "Keep this tea" and it is in their own Tea Chest, marked with the session it came from.

Approved behaviour:
- Server. Write worker/src/chestKeep.ts exporting `keepSessionTea(db, { userId, credentialHash, teaId })`. It (1) finds the seat exactly as findEligibleSeat does in worker/src/afterSitAccess.ts, reusing that eligibility, not a copy of its conditions; (2) confirms teaId is one of that session's served teas; (3) inserts one row into personal_cellar_items with owner_user_id = userId, name, type, year and origin taken from the tea record when there is one, grams = 0, chest_cost_amount and chest_cost_currency left NULL, linked_product_id set only when the tea is a public product, source_kind = 'session', source_event_id, source_tea_ref = teaId; (4) on a repeat, returns the existing row. The unique index idx_cellar_session_once (owner_user_id, source_event_id, source_tea_ref) already exists: use INSERT ... ON CONFLICT DO NOTHING then read the row back.
- No cost is ever invented. No grams are ever invented.
- An invalid, expired or revoked link gets the same answer as an unknown one. Do not reveal which.
- The route POST /api/after-sit/keep-tea { credential, teaId } is wired by the build owner and calls your function. It requires a signed-in user.
- Client. src/components/events/KeepTeaButton.tsx: a quiet button "Keep this tea" per tea. Signed out: the tap sends the person to sign in and brings them back to the after-sit page with the link still working (see how src/pages/AfterSitPage.tsx and src/lib/afterSitAccess.ts hold the credential, and how the sign-in pages take a return path). Kept: the button becomes the plain words "In your Tea Chest" linking to /account/cellar. The recap payload marks a tea `kept: true` when it already is.
- The whole feature is hidden when FIRST_TABLE_OPEN (src/lib/firstTable.ts) is false.

You own: worker/src/chestKeep.ts, src/components/events/KeepTeaButton.tsx, worker/tests/chest-keep.test.ts.
Do not touch: worker/src/index.ts, worker/src/afterSitAccess.ts (import from it; if you need something exported, name it), worker/migrations/, src/lib/api.ts, src/lib/store.ts, src/App.tsx. Another worker is editing src/pages/AfterSitPage.tsx: export your button and state in your report the one line that mounts it; do not edit that page.

Existing pattern to follow: worker/src/privateKeptSetups.ts does the same kind of thing (a signed-in user keeps something through an after-sit link) and worker/tests/after-sit-access.test.ts shows how these are tested against an in-memory database.

Style rules that bite: safe colour tokens only; a button under 44 by 44 gets tap-target; use the shared Button (src/components/shared/Button); no em dashes in wording.

Acceptance check: worker/tests/chest-keep.test.ts proves (a) a valid seat keeps a tea and the row has grams 0, NULL cost, source_kind 'session', (b) keeping twice gives one row, (c) a tea id from another session is refused, (d) a link for a guest later marked not attended is refused, (e) an expired link is refused, (f) two users keeping the same tea each get their own row. Run npm run test:worker for that file, npm run lint, npm run lint:worker-types, npm run lint:colors.

Report back: the branch, test output, the mount line for the button, anything you could not do. A product question (for example what to do with a tea that has no name) comes back as a question, not a guess.
```

### Sol, S7: where a chest tea came from, and "taste this"

```
Repository storyoftheleaf/teajia. Branch from build/launch-1 as build/l1-s7-chest; pull request into build/launch-1, never main.

Goal: adding a tea to the Tea Chest by hand asks where it came from, including a gift and who gave it; and any tea in the chest can be tasted in the journal without retyping its name.

Approved behaviour:
- CellarItem (src/lib/teaChestTypes.ts) now has `source?: { kind: 'bought' | 'gift' | 'session' | 'own'; fromName?; eventId?; eventTitle?; invoiceId? } | null`. The chest create and update calls already accept `source_kind` and `source_from_name`.
- In the add and edit form of src/components/AccountPanel/CellarView.tsx: one optional choice "Where it came from" with two options by hand, "A gift" and "My own". Choosing "A gift" shows one optional text field "From". Leaving the choice empty is allowed and stores nothing. 'bought' and 'session' are never chosen by hand; they are set by other parts of the build.
- On each chest tea, one quiet line when source is set: "A gift from <name>" or "A gift"; "From <session title>"; "Bought"; nothing for 'own' or unset. Never guess a source for an older tea.
- A tea with grams 0 and source 'session' shows "Tasted, none held" where the grams would be, not "0 g" and not an empty or finished state.
- "Taste this" on each chest tea opens the journal with the tea filled in. src/pages/JournalPage.tsx already reads `?tea=<productId>` (readJournalDeepLink). Extend that reader to accept `?chest=<chestItemId>`: when the chest tea has linkedProductId use the product as today; otherwise start an entry with the tea's name and type filled in. The journal table already allows an entry with a name and no product.

You own: src/components/AccountPanel/CellarView.tsx, src/pages/JournalPage.tsx and its test src/pages/JournalPage.test.ts.
Do not touch: worker/, src/lib/api.ts, src/lib/store.ts, src/lib/teaChestTypes.ts, src/App.tsx, any tile, label or navigation in the account panel other than the chest's own form and rows.

Must be preserved: everything the chest does today (grams, photograph, notes, cost, shelf offers, placement). A stored 0 renders as 0 everywhere except the one "Tasted, none held" case above. Never write Number(x) || 0 or ?? 0 on a cost.

Style rules that bite: safe colour tokens only; TYPOGRAPHY_CLASSES or text-ui-N; flex-wrap, no horizontal scroll; tap-target on small controls; the mobile bottom bar overlaps content, so use the pb-nav classes from card-utilities.css, never an inline calc(); no em dashes in wording. A step (an open form or panel) lives in the address through useStepParam if you add one.

Acceptance check: extend src/pages/JournalPage.test.ts for the `chest` deep link (with and without a linked product). Run npm run test:mobile (required for any change under src/components/AccountPanel/; stop any running npm run dev first), npm run lint, npm run lint:colors. In the sandbox (npm run sandbox, never npm run dev): add a gift from a named person, see the line, tap "Taste this", see the name filled in.

Report back: the branch, what you ran and its result, anything you could not do.
```

### Astra, S6: a bought tea arrives in the chest (return a patch)

```
Repository storyoftheleaf/teajia. Branch from build/launch-1 as build/l1-s6-bought (it already contains worker/src/chestKeep.ts from an earlier slice); pull request into build/launch-1, never main. Return a patch with tests.

Contract: a signed-in buyer, looking at one of their paid orders, may put a tea line into their own Tea Chest with one tap. Nothing is ever written without that tap. One order line yields at most one chest row for that person, for ever, however many times and from however many devices they tap.

What exists:
- personal_cellar_items has source_kind, source_invoice_id, source_invoice_line_id, and a unique index idx_cellar_bought_once on (owner_user_id, source_invoice_line_id) where the line id is not null.
- Orders a person owns are found by loadMyOrderOwnership and MY_ORDER_OWNERSHIP_SQL in worker/src/index.ts (near line 23926). It matches by the linked customer row, then by email, then by phone.
- Lines are invoice_line_items: product_id (nullable), custom_name, quantity, quantity_unit ('g' or 'unit', sometimes NULL on older rows), price_at_sale. Payment state is resolved by resolveInvoicePayment, never by reading invoices.payment_status alone.
- The route POST /api/me/orders/:id/keep-in-chest { lineId } and the extra fields chest_item_id and can_keep on each line of GET /api/me/orders/:id are wired by the build owner and call functions you export from worker/src/chestKeep.ts: `keepBoughtLine(db, deps, { userId, invoiceId, lineId })` and `boughtLineChestState(db, { userId, invoiceId })`.

The risk, precisely: this takes a fact from the shop's books and writes it into a person's private chest. It goes wrong when the order is not really theirs, when the line is not a tea, when the quantity is not grams, when the order's state changes afterwards, or when the same tap lands twice.

Cases you must settle, each with a test in worker/tests/chest-keep-bought.test.ts and one sentence of reasoning:
1. Two taps at once, and a retry after a timeout: one row, and both calls answer with it.
2. An order matched to the user only by phone or only by email, not by the linked customer row. State whether can_keep should be true, with the evidence from MY_ORDER_OWNERSHIP_SQL for how strong each match is. Default if unsure: offer it only on the strongest match, and say so.
3. A line with quantity_unit 'unit' that is a tea (a cake, a can) and has pack_size_grams on its product; one without pack_size_grams; a teaware line; a line with custom_name and no product. Grams are never invented: where grams cannot be known, either refuse or store what is true, and say which you chose and why.
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
```

### Astra, S9: audit of what the thank-you newly shows and of the order source (return findings)

```
Repository storyoftheleaf/teajia, branch build/launch-1. Read only. Return findings, each with a failing test or an exact reproduction, not a patch.

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
A thank-you's links to tea pages carry `via=<events.thanks_ref>`. The site holds that reference with the bag (src/lib/store.ts) and sends it as `via` on POST /api/inquiries. After the order request is saved, recordOrderSessionSource (worker/src/orderSessionSource.ts) writes one row to order_session_sources (inquiry_id primary key, account_id, event_id, host_user_id). An invoice finds it through invoices.source_inquiry_id.
Evidence to produce:
1. handleCreateInquiry in worker/src/index.ts has several insert branches (near lines 15337, 15420, 15490 to 15499). Show that every branch that saves a request reaches the one call, and that a branch that fails or rolls back leaves no row.
2. Replays. The handler has request fingerprints and a three-attempt retry loop. Show that a replayed or retried request writes one row, never two and never a row pointing at a request id that was not committed.
3. An unknown via, a via for a session in another account than the order, a via for a session that is not completed, a via longer than expected, and no via: no row, and the order itself is unaffected in every case. The order must never fail because of via.
4. The door in worker/src/mcp.ts (near line 8296) and the admin doors that create invoices directly: confirm none can write a source row, and say whether any should.
5. host_user_id is read from the session on the server. Show that nothing from the browser can set it, and say what it is when a session has several credited people.
6. The reference held with the bag: when is it cleared, can it attach to a later unrelated order weeks afterwards, and does emptying the bag clear it. State what you observe; the intended rule is "cleared when the order is sent, and ignored after 14 days".
7. Nothing reads order_session_sources to show, pay or rank anything yet. Confirm by search.

Return: a numbered list of findings with severity (wrong data, leaked data, or cosmetic), the evidence for each, and for the items that hold, one line saying how you proved it. Do not fix. If a finding depends on a product decision, state the decision needed in one sentence.
```

### Sol, S10: the same actions as agent tools

```
Repository storyoftheleaf/teajia. Branch from build/launch-1 as build/l1-s10-tools; pull request into build/launch-1, never main.

Goal: a host can say to an agent "set the reading for Saturday's session" and "what does the thank-you for that session contain", and each write is previewed before it is confirmed.

Approved behaviour: one new module worker/src/mcpTools/firstTable.ts with three tools.
- set_session_reading { event_id, article_id | null }: preview shows the session title and the article title (or "no reading"); confirm writes events.reading_article_id through readableArticleFor in worker/src/eventDomain.ts. Refuses an article that function refuses.
- get_session_thanks { event_id }: read only. Returns what a guest's thank-you would show for that session: title, date, host's note, the teas with their paths, playlist_url, reading. Never returns a guest's link or any secret.
- list_readings {}: read only. Published articles, id, slug and title, for choosing a reading.

Existing pattern to copy exactly: worker/src/mcpTools/events.ts for shape and scoping, and worker/src/mcpTools/tickets.ts for confirmation tickets. Confirmation tickets come only from tickets.ts. Read docs/claude/mcp.md first.

You own: worker/src/mcpTools/firstTable.ts and a new worker/tests/first-table-tools.test.ts.
Do not touch: worker/src/mcp.ts, worker/src/mcpTools/registry.ts (state in your report the lines needed to register the module; the build owner adds them), worker/src/index.ts.

Must be preserved: every tool is scoped to the caller's account; a session from another account is "not found".

Acceptance check: worker/tests/first-table-tools.test.ts proves set_session_reading does not write on preview, writes on confirm, refuses a draft article and a session from another account, and that get_session_thanks contains no link secret. Run npm run test:worker for that file, npm run lint:worker-types, npm run test:mcp-token.

Report back: the branch, test output, the registry lines, anything you could not do.
```

### Sol, S11: browser checks for the whole journey (a worker that built none of it)

```
Repository storyoftheleaf/teajia, branch build/launch-1. Branch as build/l1-s11-checks; pull request into build/launch-1, never main. You wrote none of this feature: test it as a stranger would, from what a person can do.

Goal: one browser spec, tests/first-table.spec.ts, that fails if the first-table journey breaks.

The journey, with FIRST_TABLE_OPEN true:
1. A host opens a session in Manage, picks a reading, saves, reloads, and it is still picked.
2. A guest with no account opens their after-sit link on a phone-sized screen. They see the host's note, the teas (one linked, one plain), the reading and the playlist.
3. The guest taps "Keep this tea", is asked to sign in, signs in, and comes back to the same page. The tea reads "In your Tea Chest".
4. In the Tea Chest the tea shows "From <session title>" and "Tasted, none held". "Taste this" opens the journal with the tea's name filled in.
5. From the thank-you the guest opens the linked tea's page, adds it to the bag, and sends the order request. The request succeeds.
6. A signed-in buyer opens a paid order and taps "Add to my Tea Chest" on a tea line. It reads "In your Tea Chest". The chest shows it as "Bought" with its grams. The teaware line offers nothing.
7. With FIRST_TABLE_OPEN false, none of the new buttons or lines appear, and the after-sit page still works as before.

How to run: against the sandbox with the fixture session and order described in worker/sandbox/README.md (npm run sandbox:offline:fixtures; sign in sandbox / sandbox). Never npm run dev, which points at the live shop; stop it if it is running. Follow the structure of tests/after-sit-guest-book-photos.spec.ts and tests/event-signin-navigation.spec.ts, and the helpers in tests/helpers and tests/fixtures.ts. Run at 390 by 844 and at a desktop size. Each step also asserts no horizontal overflow and no console errors, as tests/account-panel-mobile.spec.ts does.

You own: tests/first-table.spec.ts and, if needed, one helper file under tests/helpers.
Do not touch: anything under src/ or worker/. A step you cannot make pass is a finding: report the step, what you saw, and a screenshot path. Never skip, weaken or delete a check to get a pass.

Report back: the branch, the run output at both sizes, and the list of findings.
```

## The gate, and the journey Opus runs last

The launch gate in the build file stands unchanged: every slice merged and read, the four checks run by Opus on `build/launch-1` (`npm run lint`, `npm run lint:worker-types`, `npm run lint:colors`, `npm run test:src`, `npm run test:worker`, `npm run test:mobile`), Astra's S9 findings answered or fixed, the documents true, Adrian's "ship".

Then Opus walks this itself in the sandbox, on a phone-sized screen, with the flag on, and writes down what it saw at each step. No builder's word stands in for it.

1. **As Adrian, the host.** Open the fixture session in Manage. Pick a reading. Mark the session completed with both guests attended. Tap "Copy guest link" for the guest who has no account.
2. **As that guest, signed out, on a phone.** Open the link. Read the host's note. See the three teas: the one for sale opens its page, the one not for sale opens its page with no price, the plain name does nothing. See the reading and open it. See the playlist.
3. **Keep a tea.** Go back to the thank-you. Tap "Keep this tea". Be asked to sign in, create an account, and land back on the thank-you with the tea now reading "In your Tea Chest". Tap it again from a second browser tab: still one tea.
4. **In the Tea Chest.** The tea is there, "From" the session, "Tasted, none held", with no cost. Tap "Taste this". The journal opens with its name filled in. Save a tasting.
5. **Add a gift.** Add a tea by hand, "A gift", from a named person. Taste it without retyping the name.
6. **Buy from the thank-you.** Open the thank-you again, open the tea that is for sale, add it to the bag, send the order request. As Adrian, find the request in Sales. In the database, `order_session_sources` has one row for it, naming the session and its host. Send a second order straight from the shop: no row.
7. **The bought tea.** As Adrian, mark the first order paid. As the guest, open the order, tap "Add to my Tea Chest". The chest shows it as "Bought" with its grams. Tap again: still one.
8. **The invite repair.** As Adrian, add a member with a new email in Settings. Open the invite link signed out. Set a password. The membership is active. Then open a session plus-guest invite link: it still works as before.
9. **The door closes.** As Adrian, mark the guest not attended. The thank-you link no longer opens, and "Keep this tea" refuses.
10. **Flag off.** Turn `FIRST_TABLE_OPEN` off. The after-sit page, the chest and the order page look exactly as they do on the live site today.

Launch 1 is done, in the build file's words, when one real session has run through it and a few guests opened the thank-you and kept or tasted a tea.
