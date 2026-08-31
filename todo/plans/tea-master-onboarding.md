# Becoming a tea master — the flow that does not exist yet

A handoff for working out the whole path: someone decides to be a tea master,
sets themselves up, can be paid, and has teas for sale.

Written 2026-08-31, after shipping the order process. **This is a discovery and
design handoff, not an implementation plan.** Do not start building. The first
job is to settle what this flow should be, with Adrian, because most of the open
questions are curation questions and not technical ones.

## The finding that reframes the problem

Adrian said "if you set yourself up as a tea master, you can add teas for sale,
and we don't have any of that." That is right, but the reason is sharper than
missing onboarding.

**A tea master is one thing to Adrian and two things to the system**, built at
different times, by different mechanisms, with different approval paths, and
never joined up:

1. **An account** — the shop. Holds stock, orders, the storefront at
   `/store/:slug`, the invoice sequence, team members. Created **by Adrian, by
   hand**. The person is then invited into it.
2. **A contributor profile** — the person. Holds their public page at
   `/people/:slug`, their writing, their tea selection, and **their payment
   methods**. Created **by the person themselves** as a private draft at
   `/account/profile`, then published.

That split is why the payment links feel orphaned. They live on the person, but
everything that generates money lives on the account, and nothing walks anyone
from one to the other. It is also why there is no single answer to "am I set up
yet" — there are two half-finished setups and no surface that knows about both.

**Any design for this flow has to decide how those two relate.** That is the
first question below, and nothing else can be settled before it.

## What actually exists (measured, not assumed)

- **Applying to join: only half of it.** `account_applications` is a real table
  with a real review flow, and Adrian can list and decide applications at
  `/api/platform/applications` and `/api/platform/applications/:id/decide`.
  **Nothing can create one.** There is no public route, no form, no page. The
  inbox exists and nothing can post to it.
- **Manual onboarding is the real path today**, documented at
  `docs/MULTI_STORE_PLAN.md` under "Onboarding a New Store": Adrian creates the
  account, invites the owner, they claim the invite at `/join/:code`, land on an
  empty inventory, import opening stock by CSV, invite their team. It works. It
  is entirely Adrian-driven.
- **Self-service operator onboarding is named as Phase 3** in that same document,
  after wholesale and cross-store fulfilment. It was always future work; it has
  simply become the blocking thing now that payment links exist.
- **The person's own setup exists and is decent.** `/account/profile` creates a
  draft profile, tracks readiness across five things (identity, associated
  accounts, tea selection, public favourites, payment methods), and has a
  publish and unpublish control. It is a good surface that nothing points at.
- **Adding teas for sale exists** through the admin (inventory, CSV import,
  stock, listings). There is a `StoreLaunchPlaybookView` in the admin, and a
  launch checklist in the multi-store plan. Read both before writing anything
  new; they may already be most of the operator-facing sequence.
- **`/start` is not this.** It is a customer-facing path chooser ("discover your
  tea"), not operator onboarding. Do not extend it into one without asking.
- **The network directory exists** at `/find-a-table`, with per-store
  storefronts. The public side of being a tea master is mostly built.

## Decided by Adrian, 2026-08-31

**Two answers settle the shape. Do not re-open them.**

**1. Invitation only, for now.** Nobody applies. Do NOT build a public
"become a tea master" form, and do not open the `account_applications` inbox to
the outside. Adrian starts every one of these. His words were "as of now", so
build the invitation so it could later be pointed at an application queue, but
do not build the queue.

**2. A tea master does not need a shop.** A person can be a tea master, hold a
public profile, and be paid, while selling nothing. This one is load-bearing and
it inverts the current arrangement.

### What those two answers do to the design

Today a person becomes real by being added to a shop Adrian already made:
`account_members`, invited from the admin team screen. The shop comes first and
the person is an afterthought. Adrian's answers say the opposite. **The person is
the trunk and the shop is a branch.**

So the flow is: invitation, then the person sets themselves up as a tea master
(profile, payment links, published), and only then, if they sell, a shop is
attached and teas go into it. "Add teas for sale" is the optional second half,
not the spine.

That also confirms the payment links are in the right place. They hang off the
person, which is exactly right if a person can be paid without a shop. Nothing
about the payment work needs moving; it needs a path leading to it.

### The gap this opens, and it is the real one

**There is no invitation that makes someone a tea master.** Two things exist and
neither is it:

- `/join` and `/join/:code` are for **tea session guests**, not operators. The
  code redeems into a tasting session and returns a session id. Do not extend it;
  it is a different thing wearing a similar word.
- The team invite in the admin adds a person to **an account that already
  exists**, as a member with a role. That presumes a shop, which Adrian has just
  said a tea master does not need.

So the invitation is the thing to build, and it has to be able to invite a
**person** with no shop at all. Everything else in this flow is assembly of
surfaces that already exist. This is the one genuinely new piece.

## Decided by Adrian, 2026-08-31 (second pass)

**3. Money never moves through Teajia, and that is the design, not a gap.** The
pay page is a directory of ways to pay a person: pay me here, or here, or here.
Nothing is processed, held, or forwarded. This is why there is no gateway and
why there will not be one.

The consequence, already true in the shipped code and worth keeping true: **paid
is always a human's word.** A customer reporting a transfer is a report and
nothing more; only the tea master confirming it against their own bank makes it
money. Every surface holds that line today.

**4. A tea master may have a store without payment methods. They may not open it
to buyers.** Adrian's words: a tea master can have a store, "you just can't
invite anyone to buy anything on it until he sets up his payment method."

So payment methods gate **selling**, not **existing**. Someone can be invited,
build a profile, have a store, add teas, and arrange the whole thing, and the
only thing withheld is the ability to let a customer order.

### Where that gate belongs, and what is missing today

Two places, and neither checks anything now:

- **`accounts.public_enabled`** is what makes a store visible and shoppable, and
  it is a bare checkbox in `src/admin/views/AccountSettingsView.tsx` and
  `PlatformAdminView.tsx`. Nothing anywhere asks whether the person being paid
  can actually be paid. This is the primary gate: a store should not be able to
  go public until the payment recipient has at least one published payment
  method.
- **Checkout** blocks only when the store has neither a WhatsApp number nor a
  contact email (`resolveContactChannels` in `src/lib/contact.ts`, used by
  `PublicCart`). It does not look at payment methods at all. This is the backstop
  for a store that went public and then had its payment methods removed.

**The hole this closes.** Today a store can be flipped public with no way to pay
anyone. A customer can browse it, fill a cart, check out, and reach the end of
the order with nowhere to send money. The order surfaces shipped on 2026-08-31
degrade quietly in that case, showing no pay link, which is correct behaviour but
means the failure is invisible until a real customer hits it. Adrian's rule moves
that discovery to the moment the tea master tries to open the shop, where it
belongs.

When building this, make the refusal say what is missing and link straight to
where it is fixed. A disabled toggle with no explanation is the version that
generates a message to Adrian instead of preventing one.

## Still open

Two, neither blocking:

1. **Who approves a profile, and against what?** Publishing has an approval step
   with no written standard behind it. Invitation-only makes this less urgent,
   since Adrian has already vouched for the person by inviting them, and the
   honest answer may be that an invited tea master needs no second gate.
2. **Where does a half-set-up tea master live?** Your Table adapts by role and
   already carries the attention list, so it is the obvious home. It does not
   currently know about a person who has been invited but has not finished.

## How to approach the work

- **Survey before designing.** Read `docs/MULTI_STORE_PLAN.md` (especially
  "Onboarding a New Store", "Roles", "Rollout Phases"), `docs/VISION.md`,
  `docs/CONSOLIDATED_DIRECTION.md`, `docs/tracks/02-first-operator-and-users.md`,
  and then the surfaces named above. Much of this is assembly, not invention.
- **Talk first, build second.** This is design and curation work. Adrian's
  standing preference is a conversation with two or three options, not a
  dispatched agent producing a flow nobody agreed to.
- **Do not build a public application form as the opening move.** It presumes
  the answer to question one, and it is the piece most likely to be wrong.
- **The first surface to build is the one that tells an invited person what is
  left before they can be paid** — profile drafted,
  profile published, account linked, stock present, payment method public. That
  surface is useful under every answer above, it makes the two identities visible
  as one thing for the first time, and the readiness pieces already exist to feed
  it.

## What this connects to

The order process shipped on 2026-08-31 assumes a set-up tea master with
published payment methods. See `order-process-handoff.md` for its remaining work.
Every order surface degrades quietly when a tea master has no published transfer
details, which is correct behaviour but also means an unfinished setup is
currently invisible until a customer cannot pay.

## Measured 2026-08-31, second survey

Four findings from reading the code, not assuming it. Two of them change the plan.

**The invitation may not need to exist.** Anyone signed in can already start a tea
master profile. The profile endpoint hands out permission to create one to any
authenticated user with no profile yet, and saving it creates the draft. Publishing
is separately gated by owner approval, so nothing public leaks. The section above
calls the invitation "the one genuinely new piece". It may instead be a link Adrian
sends, plus the approval gate that already exists. Build the token only when
strangers start filling the approval queue; today it is empty and Adrian approves
everything by hand anyway.

**A tea master already works with no shop, with no schema change needed.** A profile
must belong to an account, but the create path attaches it to the platform owner,
not to a shop. Shops attach separately through the association table. Decision 2 is
already true in the data.

**The readiness list contradicts decision 2.** `profileReadiness` marks "Accounts"
unready when a person has no associated shop, and "Tea selection" counts only teas
listed in a master-kind shop that is already public. A tea master with no shop sees
a five item checklist where two items can never complete. Fixing that is part of the
readiness surface, not a separate job.

**The payment gate has no code anywhere.** The account update endpoint writes
whatever fields are passed, `public_enabled` included, with no check on anything.
Separately, the account-side launch readiness panel in the store settings already
runs six stages and is decent, and it never mentions payment methods. So the
readiness surface named at the end of this plan is half built on the account side,
half built on the person side, and neither half knows the other exists.

---

# The build plan

Written 2026-08-31 after a second survey, three parallel read-only scouts across
the person side, the store-opening side, and the existing onboarding surfaces.
**Everything below is measured.** A builder picking this up should not re-survey
these areas; read this section and go.

## The two findings that decide the whole shape

**1. The invitation is already built, and it already emails.** This plan's earlier
section calls it "the one genuinely new piece". It is not.
`POST /api/platform/tea-masters/invite` creates a `kind='master'`,
`trust_tier='verified'`, `public_enabled=0` account, adds the person as owner,
mints a claim link, and sends it through Resend with the subject "You've been
invited as a Tea Master on Teajia". It has a working form, "Invite a Tea Master"
in `PlatformAccessView`, platform-tier only, at `/admin/access/platform`. The
multi-store plan document says invite email delivery does not exist; for this path
the document is wrong.

So Adrian's decision 1 (invitation only) is **already the shipped behaviour**, and
his decision 2 (a tea master need not sell) is already structurally true: the
invited store is born private and nothing forces stock into it.

**2. There are FOUR onboarding checklists, and only one is both live and visible.**
This is the actual problem. Not a missing surface, a scattered one.

| Checklist | State | Where |
|---|---|---|
| Launch Center, six stages from live data | Works, visible | Store settings |
| Store Launch Playbook, same six steps | Ticks stored in the browser only, so they can disagree with reality | Admin page with no nav entry, plus a public twin |
| First-door readiness, six steps | Fully implemented, computed on every Your Table render, **never displayed** | Dead |
| Person profile readiness, five items | Works, visible | The profile page |

Nothing joins the person to the shop. Three separate vocabularies, no shared type,
no file imports from more than one.

**Therefore this is a consolidation job, not a construction job.** The build below
deletes more than it adds.

## Stage 1 — The payment gate

The only stage where the absence costs real money: a customer can browse a public
store, fill a cart, check out, and arrive with nowhere to send payment.

**Exactly two code paths can make a store public.** Both are covered below; there
are no others. The tool-server account settings tool cannot touch the flag, and no
script or seed writes it.

1. `PUT /api/accounts/:id` (owner tier, and platform staff acting as an account).
   It writes whatever whitelisted fields the body carries, with no value checking
   and no activity record.
2. `POST /api/platform/accounts` (platform admin). Born private in code, **but the
   admin form pre-checks the public box**, so the default click makes it public.

**Two traps found while measuring, both worth fixing in this stage:**

- The column's own default is public. Any future insert that omits the field
  creates a public store. The three current insert paths all override it, so this
  is a latent trap rather than a live bug. Flip the default so an omission is safe.
- Nothing coerces the value, so a non-boolean lands in the column raw.

**The check to write.** A ready-made answer already exists: a helper that, given a
person, reports whether they hold any published payment method, either personal or
scoped to a linked public store. It is already used to decide whether a pay link
appears. Reuse it; do not write a second query.

Given a store, the person who would be paid is found through the owner membership
to their public profile. Note that a store can have several stock owners and an
order with mixed owners records no recipient at all, so the gate should ask "does
the store's host tea master have a published method", not "do all possible
recipients".

**How to refuse.** The codebase already has exactly this shape: a standalone
predicate returning either a refusal or nothing, wrapped by a guard that only fires
when the field is actually being switched on, invoked as a two-line prelude in every
handler that can set the flag. Copy it. Status 409, a human sentence, a machine code
the store settings screen branches on so the refusal can link straight to the
payment methods editor. Only one code is branched on in the frontend today, so this
is a deliberate addition, not free.

**Backstop.** Checkout currently refuses only when a store has neither a WhatsApp
number nor an email. It never looks at payment methods. Add the second condition
there for the case where a store went public and then had its methods removed.

**Tests.** Nothing today tests either write path with the public flag, and nothing
tests the default publicness of a newly created store. Both gaps get filled here.

## Stage 2 — One readiness surface

**Add one shared readiness model covering both halves of being a tea master**, and
render it in the place an invited person actually lands.

The person half and the shop half already exist as separate functions. Join them
behind one type. The shop half currently lives as a closure inside the store
settings screen with local, unexported types, so lifting it out is most of the work.

**Fix the contradiction first.** The person checklist marks "Accounts" unready when
someone has no associated shop, and counts tea selection only from a shop that is
already public. Under Adrian's decision that a tea master need not sell, that is a
five-item list where two items can never complete. Selling items become optional and
appear only once a shop is attached.

**Where it goes: Your Table.** The first-door readiness card was specified, built,
and never wired up. That is the deliverable. It shows the count complete, the next
incomplete step, and its description. This is where an invited person lands, and it
is the first time the two identities appear as one thing.

**Payment methods join the store-opening stage** in the Launch Center, which today
runs six stages and never mentions being paid.

## Stage 3 — Delete the duplicates

Do this last, once the joined surface proves itself.

- The admin copy of the launch playbook duplicates the Launch Center step for step,
  with ticks that live in the browser and can lie. Retire the admin copy. **Keep the
  public one** at `/store-launch-playbook`; it is linked from a customer-facing page
  and is marketing, not operations. Adrian's call before removing anything customers
  can see.
- The dead first-door computation and its unused support links either get rendered
  by stage 2 or deleted. Nothing stays computed-and-hidden.
- Correct the multi-store plan document, which describes hand-written SQL, a role
  that the invite endpoint rejects, a team screen that is now a redirect, and absent
  email delivery that exists.

## Order, and why

1. **Payment gate.** It is the only one where the gap reaches a customer.
2. **Joined readiness on Your Table.** It is what an invited person needs, and it
   is mostly wiring already-written code.
3. **Deletion.** Safe only after 2 replaces what it removes.

Stage 1 is self-contained and testable on the local sandbox. Stage 2 touches a
customer-visible surface and should be looked at before it ships. Stage 3 includes
one call only Adrian can make.

## What NOT to do

- Do not build an invitation. It exists and it emails.
- Do not build a public application form. Adrian decided invitation only.
- Do not write a second "can this person be paid" query. One exists.
- Do not add a fifth checklist.
- Do not re-survey the six areas covered above.

---

## Stage 1 is built (2026-08-31)

A store can no longer be opened to buyers unless the person it pays can actually
be paid. Both write paths are covered and there are no others.

- Opening a store now refuses with 409 and a code the settings screen can branch
  on, naming which of three things is missing: nobody to pay, an unpublished
  profile, or no published payment method. The profile case matters because the
  pay page serves only published people, so a published method behind a private
  profile is still a dead end and the refusal has to say so or the tea master
  fixes the wrong thing.
- New stores are now born private with no way to ask otherwise. A store created
  this second has no tea master linked and so cannot be payable; the platform
  create form's public checkbox was pre-ticked, which made the default click the
  broken one. The checkbox is gone and the form says the owner opens it later.
- The public shop payload now carries a plain yes or no on whether money can
  still reach anyone, and checkout stops on an explicit no. This is the backstop:
  the gate cannot help a store that was opened earlier and lost its methods
  afterwards.
- Ten tests cover all of it, including that closing a store is never blocked.

**A bug found on the way, fixed here.** The store settings screen sends the public
flag as a true/false and the handler bound it into the database with no
conversion. SQLite refuses a boolean outright, so the save fails rather than
saving wrongly. Measured in the test database; whether the live database coerces
it was not measured. Every field on that endpoint now converts.

**Correction to this plan's stage 1 note.** The existing "can this person be paid"
helper could NOT be reused: it counts a store-scoped method only when that store
is already public, so asked about the one store being opened it answers no every
time. A purpose-built check replaces it, and says why in the code.

---

## Stage 1b — the invited tea master cannot reach the screen this gate is on

Found while answering "what about the tea master editing pages". This is larger
than anything else in this plan and it changes stage 2.

**The permission check reads the wrong thing.** Every invite path creates the
person with a global account type of ordinary user, and separately makes them
owner of their shop. Roughly a dozen admin screens gate on the global type rather
than on the shop role. Their shop role and all six capability bundles resolve
correctly; it is only the legacy global check they fail.

**What an invited tea master literally cannot open**, all of it "Access
Restricted":

- **Store settings.** Name, tagline, description, currency, contact, and the
  public toggle stage 1 just gated. The store identity screen, unreachable.
- **The store-opening playbook.**
- **The workshop**, which is where both the Launchpad tile and the mobile centre
  button send them.
- Voice and agent tokens, vendor profiles, product story editing, the
  walk-throughs, the in-app library.

**And the navigation is worse than the routes.** On desktop the Manage menu
filters down to a single entry, Wisdom, for anyone failing the global check, even
though they may open nine of those screens. On mobile the bottom bar drops stock,
sales and people. In Contacts, four of six tabs are hidden.

**So an invited tea master today** can reach Curate, Capture, Stock, Sales,
Contacts, Events, Writing, Collections, Wisdom, Tea masters, Members and Access
and the whole Network, and the menu offers them one of those.

**The fix is to read the shop role, not the global type**, on the screens where a
shop owner belongs, and to let the menu show what the routes already allow. The
platform-only screens keep their separate, correct check. This is a permissions
correction, not a redesign, but it touches the nav and needs looking at.

**Members and Access is separately orphaned**: every link into it sits behind one
of the blocked screens or in code that never renders. So a tea master cannot
invite their own staff even though the screen would admit them.

**This lands before stage 2.** A joined readiness surface is pointless while the
steps it names open onto Access Restricted.

---

## Stages 1b and 2 are built, and verified by clicking (2026-08-31)

**Stage 1b.** An invited tea master can now reach their own shop. Store settings,
the opening playbook, the workshop, voice tokens, vendor records and product
stories all ask what a person runs rather than what type of account they hold.
The desktop menu went from one entry to nine, the mobile bar regained stock,
sales and people, and Contacts shows all six tabs. The platform admin screen was
open to any admin-typed account and now asks the platform question properly. Six
tests, including the exact regression.

**Stage 2** built the joined setup list, lifted the shop audit out of the settings
screen so both halves share one model, and rendered the card on Your Table.

### Verified in the running app, not just in tests

Signed in as a user shaped exactly like an invited tea master (ordinary account
type, owner of the shop) and walked it: store settings opens, the menu carries
nine entries, the Launch Center names payment, the card on Your Table reads
"1 of 7 steps done" with the next step, and the shop refuses to open, then opens
once a published profile and a published payment method exist.

### Three defects the clicking found, all fixed

1. **The gate blocked ordinary saves.** The settings form sends every field on
   every save, the public flag included, so a gate asking only "is the flag true"
   refused a tagline edit on a shop already open, locking the tea master out of
   the screen they would fix the problem on. It now fires only on the closed to
   open moment. A store already serving customers is the backstop's job.
2. **The refusal blamed the wrong thing.** "Add an owner before opening the shop"
   on a shop that has an owner. Nobody to pay almost always means no Tea Master
   profile exists yet, so it says that, and leads to the profile rather than the
   members screen.
3. **The form lied after a refusal.** The public checkbox fell back to closed on
   a shop that was still open. Fixed by 1: the refusal now only happens when the
   shop really was closed, where falling back is correct.

### Worth knowing

The public shop's payability answer rides the existing five minute cache on that
endpoint, so the checkout backstop can be up to five minutes stale in both
directions. Acceptable for a safety net behind a gate, but it is not instant.

### Not ours, recorded separately

The sandbox copy is missing columns the real database has, so the personal
profile and journey endpoints return errors locally while working live. Also a
test that can never pass on this machine because the folder name has a space.
Both are filed as their own jobs rather than widening this one.

---

## Stage 3 is done (2026-08-31)

Adrian's call: keep the public page, delete the admin copy.

**The admin launch playbook is gone.** It repeated the Launch Center step for
step but kept its ticks in the browser, so it could tell someone they were done
when they were not. Its URL now redirects to the Launch Center, which reads live
data, so an old bookmark lands somewhere true rather than nowhere. The public
page at `/store-launch-playbook` is untouched and still linked from the
customer-facing space page.

**Six more dead files removed**, all verified to have no live reference: the four
that had never been imported anywhere (an admin home grid, a settings hub, a
gather hub, a personal collection view), the delegated-tools panel that was
imported but never rendered, and the operator support links beside it.

**A route that could never run is gone.** A second activity route sat below the
one that already claimed the same path, so it never rendered; its view file went
with it.

**The multi-store document was rewritten where it contradicted the code.** It
described hand-written SQL creating a store already public, a role the invite
endpoint rejects, a team screen that is now a redirect, and absent invite email
that in fact works. The onboarding sequence now describes what actually happens,
and notes that the payment step is enforced by the server rather than advised.

**Self-service onboarding was struck from the phase list**, since invitation only
is now a decision rather than a not-yet.

### Verified

The public playbook still renders and still fills its worksheet. The retired
admin URL redirects to the Launch Center, confirmed by navigating inside the app.
Whole-page cold loads of any admin URL land on an empty shell in this sandbox,
including untouched working ones, so that is the sandbox's boot behaviour and not
a property of the redirect.

Typecheck clean, colour rules pass, 84 tests across the touched areas pass.

### Left alone deliberately

The tool registry survives with no consumer now that the panel using it is gone.
It is a documented place to register admin tools, so deleting it is a decision
about how tools get registered rather than tidying, and that is not this job.
