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
