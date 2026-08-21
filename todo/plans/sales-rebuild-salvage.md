# What is actually inside `codex/sales-system-rebuild`

Audited 2026-08-21. The branch has sat since 2026-08-11 and main has moved 162
commits since. This file records what it holds so the decision can be made once
and the branch can then go.

## The short version

It is two different things wearing one name:

1. **Sixteen security and correctness fixes to the invoice and inquiry flow that
   already exists.** Real, finished, and absent from main. This is the valuable part.
2. **A nine-task plan for a whole new sales architecture that was never started.**
   Zero of its 49 steps are checked, and its foundation has since shifted under it.

## Why the architecture half is dead

The plan reserves migrations 126 through 131 and states in its own text: *do not
renumber these after any one is committed.* Main has since committed different
things into those exact numbers — 126 is now tea master integrity, 127 is tea
master sales, 128 is wordforge article sources, 129 is events trust identity.

Worse for the plan, its **Task 1 already landed on main independently**: the
branch's `126_tea_master_sales.sql` is byte-identical to main's
`127_tea_master_sales.sql`. So step one of nine is done, at a number the plan
forbids using, and every later step counts from the wrong place.

None of the tables the plan exists to create — order lines, payment ledger,
fulfillment records — exist anywhere, on the branch or on main. The architecture
was designed and never built.

## What the sixteen fixes actually cover

From the commit subjects, in the order they were made:

- Public carts bound to one store, so a cart cannot leak across shops
- Checkout contact details kept with the cart they belong to
- Public inquiry tracking secured
- Inquiry retries bound to their store
- Inquiry delivery integrity preserved
- The sales inquiry inbox authenticated
- The inquiry inbox isolated per account, and fenced during account switches
- Customer order currency amounts converted rather than assumed
- Retail invoice writes validated
- Legacy invoice edits preserved once validated
- Invoice edit safety hardened
- Concurrent invoice edits fenced
- Fulfillment and void commands fenced
- Invoice split and line linking fenced
- Split invoice requests validated
- Retail sales safety covered by tests

Several of these are access-control fixes, not polish. "The sales inquiry inbox
authenticated" and "inquiry inbox isolated by account" describe a state where
they were not.

## Evidence they are not on main

Three files the fixes introduce do not exist on main at all:

- `src/lib/publicCartDomain.ts` and its test
- `worker/tests/inquiry-security.test.ts`
- `src/lib/api.inquiries.test.ts`

The shared files they also touch (`src/App.tsx`, `src/lib/api.ts`,
`src/lib/store.ts`, `worker/src/index.ts`, `ActivityView.tsx`) all differ from
main, but main is 162 commits newer on them, so those cannot simply be taken.

## Also in the tree, uncommitted

Thirty-four files were never committed: fifteen admin components (order
attribution, a settlement ledger, quick-invoice and orders-view test harnesses),
ten worker tests, three worker source files, one migration. These belong to the
unbuilt architecture half and have the same problem it does.

## The recommendation

**Do not merge the branch.** A 162-commit rebase carrying a dead architecture
plan is expensive and the result would be hard to trust.

**Do re-land the security fixes as their own small piece of work against current
main.** Take them as intent, not as a diff: read each fix, confirm the hole it
closes is still open on today's code, and write it fresh with its test. The three
new files above can be lifted nearly as-is; the five shared files must be redone
by hand.

## What the check found — 2026-08-21

The inbox was **not** open to the public: the server already required an account.
The bug was the mirror image — the admin client sent no credentials at all and
turned the resulting rejection into an empty list, so the inbox read as "no
inquiries" whether there were none or the request had been refused. That is
fixed and landed.

Looking for that turned up something worse, on a different route.

`GET /api/inquiries/:ref` is **public** — no token, no account. The reference it
takes is built in the browser as `TJ-YYYYMMDD-NNN` where NNN is three digits,
so 900 requests enumerate an entire day of orders. Every hit returned the
customer's **name, email address and phone number**, along with their items and
total.

That is now closed: the route returns only what was ordered and its status, and
`worker/tests/public-inquiry-privacy.test.ts` fails if anyone puts the identity
fields back. Existing tracking links still work.

Still open on that route: the reference remains guessable, so order **contents**
are enumerable even though the people behind them are not. The real fix is the
hashed tracking token on this branch, whose migration must be renumbered from
127 to 130. Landing it breaks existing `/order/TJ-...` links, which is a
customer-facing decision rather than a purely technical one.

## Where this stands

Three of the sixteen fixes are re-landed on main. Thirteen remain, listed above.
Take each as intent and rebuild against current main — do not merge the branch.

When the rest are through, delete the branch and its worktree. Its tip is
`19c2107a`.
