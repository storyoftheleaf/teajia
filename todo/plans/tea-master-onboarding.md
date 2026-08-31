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

## The questions Adrian has to answer first

These are curation and brand calls, not technical ones. Front-load them in one
conversation before any building, and do not let an agent guess a default.

1. **Is this invitation-only, or can someone ask?** Teajia's stated position is
   that Adrian's curation is the engine, and the vision documents are explicit
   that this is not a franchise. A public "become a tea master" form may be the
   wrong shape entirely, and the honest answer might be that the application
   inbox stays closed and onboarding is always a conversation Adrian starts.
   Everything below changes depending on this answer.
2. **Can someone be a tea master without a shop?** A writer, a host, a person
   whose profile and payment links exist but who sells nothing. The data model
   already allows it, since a contributor profile does not require an account.
   If yes, the flow forks early and "add teas for sale" is an optional branch.
3. **What is the minimum before someone can take money?** Right now a customer
   can only pay if the profile is published AND a payment method is marked
   public. Should the system refuse to let a shop open without that, or allow it
   and simply have no pay link? This is the question that connects onboarding to
   the work just shipped.
4. **Who approves, and against what?** There is an approval step on publishing a
   profile and a decision step on applications, but no written standard for
   either. If the flow becomes self-service, that standard has to exist or
   Adrian becomes the bottleneck he was trying to avoid.
5. **Where does the person live while they are half set up?** Your Table is the
   obvious home, since it already adapts by role and already carries the
   attention list. But a half-onboarded tea master is a role that surface does
   not currently know about.

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
- **The cheapest honest first step, whatever the answers, is a single surface
  that tells one person what is left before they can trade** — profile drafted,
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
