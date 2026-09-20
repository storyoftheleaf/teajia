# Handoff to fresh chat — conduct the prime-time fixes

Open a new chat with this worktree as the working directory (`.claude/worktrees/prime-time-fixes`, branch `claude/prime-time-fixes`) and paste the block below. The copy button on the code fence grabs it cleanly.

```
You are the conductor. Execute todo/plans/prime-time-fixes.md in this worktree: land the eight agent-runnable items from the prime-time audit on main, one commit each, using workers at the model tiers the plan names. You dispatch, review and land; workers never push to main.

Before dispatching anything, read in this order:
1. CLAUDE.md in this project (the money rules, the migration-page rule, the sandbox section).
2. docs/AUDIT-2026-09.md, the report the plan executes.
3. todo/plans/prime-time-fixes.md, the plan, including its 2026-09-09 audit deltas at the top.
4. todo/plans/freight-default-lives-in-the-table.md, for item 1.
5. The ten lines under "Prime-time audit" in TODO.md.

You do not need to re-survey the code. The audit of 2026-09-09 already read every money door, every route, every tool and every workflow, and every finding in the report was reproduced by a second agent. Each worker's first step is still to reproduce its own finding on this checkout before changing anything.

Run it as one Workflow: Chain A runs the four money items in sequence on Opus, each landed on main before the next starts, because they share files. Fan-out B runs the five separate-file items in parallel on Sonnet, each in an isolated worktree. Every item gets an Opus reviewer who reverts the fix and watches the new test go red before you land it. Item 6 waits for Adrian's answer; ask once, with the recommendation, and do not build it until he replies.

Two items pause for Adrian: items 1 and 4 each carry a data migration. Publish the walkthrough page, send him the link, and do not push that migration until he has said go. Everything else lands without asking.

The sandbox database in this worktree is already a clean copy of live with migrations through 0016 applied, and worker dependencies are installed; run npm run sandbox to start it. One worker at a time against it. If it gets polluted, npm run sandbox:refresh.

Success per item: the finding no longer reproduces, a test goes red without the fix, npm run test:worker and npm run lint and npm run lint:colors are green after rebasing onto current origin/main, the TODO line moves to todo/archive.md in the same commit, and the commit is on main. Send a clickable sandbox link (http://localhost:7777) for anything Adrian would want to see, with a screenshot.

Hard rails:
- No popup questions. One recommendation, one chance to push back.
- No em-dashes anywhere, including commit messages and tests.
- No file paths or line numbers in prose to Adrian; identifiers go in code blocks.
- No icons or emoji. Warm dark tones. The tea tokens only, never white, never gold.
- Never call api.teajia.com or touch the live database.
- Never git restore or git checkout a file in the working tree; save a copy and restore from it.
- The nohup walk-away script is retired; do not propose it.
- A migration that moves rows is shown to Adrian as a page before it pushes. No exceptions.

When all eight agent-runnable items are on main, or when one is blocked on Adrian, stop and report: what landed, what is waiting on him and why, with the consequence of waiting. Do not start the "Later" bucket from the report.
```

---

## Context for after (Adrian's reference only, not for the fresh chat)

When the eight land, the money score moves from 3 to roughly 7 and tests-and-CI from 3 to 6. The two things still yours: photographs for 359 products (the shop grid and product page are graded 4 and 5 for that alone), and the vendor yuan backlog, which becomes safe to run once item 5 lands. The report's "Later" bucket is the next audit-shaped session, not this one.
