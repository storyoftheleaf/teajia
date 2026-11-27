---
name: review-pr
description: Review this branch's change against CODING_STANDARDS.md before a pull request opens, commit the fixes yourself, and write the PR's Merge danger section. Use before every `gh pr create` in teajia, and when asked to "review this change" or "get this ready for a PR".
---

# Review a change before its pull request

The agent that wrote the change is out of room to also hold the standards.
This step is the second pass: a fresh reviewer that only reads and fixes.

## 1. Review in a subagent

Start one subagent (Agent tool, model sonnet) with this brief, filled in:

> Review the change on this branch against `origin/main` (`git diff origin/main...HEAD`).
> Read `CODING_STANDARDS.md` and the MANDATORY sections of `CLAUDE.md` first.
> Read around the changed code enough to understand it. Do not run the full
> browser suite. For each real problem: fix it in the files, then list it as
> one line (file, rule number, what you changed). If something needs a
> decision you can't make, list it as a question instead of guessing.
> Ignore style preferences no rule names. Return the list only.

## 2. Commit the fixes

Run `npm run lint` and `npm run lint:colors`, plus the unit tests next to any
file the reviewer touched. Commit the fixes as one commit,
`review: <short summary>`. The reviewer's default is a commit, not a comment:
a human should arrive at a finished change.

## 3. Write the Merge danger section

Fill the PR body from `.github/pull_request_template.md`. Decide the door:

- **One-way door** if the change runs a D1 migration with `UPDATE`, `DELETE`
  or `INSERT` on existing rows, sends email or WhatsApp or any message to
  customers, changes money, pricing or payment flow, or deletes stored files
  or images.
- **Two-way door** otherwise: reverting the merge undoes it.

Blast radius is one plain sentence: who notices if it's wrong, and how fast.

Put a short "What changed" above it: before and after in one or two lines
each, or a small mermaid diagram when the change moves data between parts.

List the reviewer's open questions under "Questions for Adrian". Omit the
heading when there are none.

## 4. Open the PR

`gh pr create` with that body. CI's `merge-danger` check reads it. A one-way
door stays red until Adrian adds the `owner-approved` label; never add that
label yourself, and never merge a one-way door.
