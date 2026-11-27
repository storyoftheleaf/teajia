---
name: review-pr
description: Review this branch's change against CODING_STANDARDS.md before a pull request merges, commit the fixes yourself, and write the PR's Merge danger section. Use for every teajia pull request (open it as a draft, review while CI runs), and when asked to "review this change" or "get this ready for a PR".
---

# Review a change before its pull request merges

The agent that wrote the change is out of room to also hold the standards.
This step is the second pass: a fresh reviewer that only reads and fixes.
It runs while CI runs, not before it, so the review costs no waiting
(Adrian, 2026-11-27: "My goal is to be able to ship way faster").
The whole path is in [docs/claude/ship-fast.md](../../../docs/claude/ship-fast.md).

## 1. Preflight, push, open a draft

1. `npm run preflight`. About a minute; it runs the checks CI fails on most
   (type check, colors, the repo-wide ceilings and ledgers, the tests for what
   changed). Fix anything red before pushing: a red CI run costs 5 minutes.
2. Push and open the PR **as a draft**, with the body filled from
   `.github/pull_request_template.md` (step 3 below says how). CI starts now.

## 2. Review in a subagent, while CI runs

Start one subagent (Agent tool, model sonnet, in the background) with this
brief, filled in:

> Review the change on this branch against `origin/main` (`git diff origin/main...HEAD`).
> Read `CODING_STANDARDS.md` and the MANDATORY sections of `CLAUDE.md` first.
> Read around the changed code enough to understand it. Do not run the full
> browser suite or the full worker suite; `npm run preflight` is the check.
> For each real problem: fix it in the files, then list it as one line
> (file, rule number, what you changed). If something needs a decision you
> can't make, list it as a question instead of guessing. Ignore style
> preferences no rule names. Return the list only.

A change that only touches docs, `todo/` or prose needs no subagent: read
it yourself against the No fine print and voice rules and go to step 4.

## 3. Commit the fixes, write the Merge danger section

If the reviewer changed files: `npm run preflight`, then one commit,
`review: <short summary>`, pushed to the same PR. The reviewer's default is a
commit, not a comment: a human should arrive at a finished change. No fixes
means no new push, and the CI run already going is the verdict.

Decide the door:

- **One-way door** if the change runs a D1 migration with `UPDATE`, `DELETE`
  or `INSERT` on existing rows, sends email or WhatsApp or any message to
  customers, changes money, pricing or payment flow, or deletes stored files
  or images.
- **Two-way door** otherwise: reverting the merge undoes it.

Blast radius is one plain sentence: who notices if it's wrong, and how fast.

Put a short "What changed" above it: before and after in one or two lines
each, or a small mermaid diagram when the change moves data between parts.

List the reviewer's open questions under "Questions for Adrian". Omit the
heading when there are none. Correct the body if the review changed the door.

## 4. Ready, auto-merge, move on

Mark the PR ready for review, turn on auto-merge (squash), and subscribe to
its activity. Then start the next piece of work: GitHub merges it when the
checks pass, and a failure arrives as an event. Do not wait on checks.
If the repository refuses auto-merge, merge when the subscription reports
the checks green, for a two-way door you were asked to build.

A one-way door stays red at `merge-danger` until Adrian adds the
`owner-approved` label, so auto-merge holds it for him. Never add that label
yourself, and never merge a one-way door.
