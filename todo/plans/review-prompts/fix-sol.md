# Fix message for Sol (template; Opus fills the four parts in angle brackets)

You are working on Teajia (repository storyoftheleaf/teajia), in your own git worktree cut from `build/review`. Read `CLAUDE.md` first and follow it. No em dashes in anything you write.

**Fix these findings:** <ids, each with its one sentence, copied from `todo/review/ledger.md`>

**Approved behaviour.** <what the person should see or what the route should answer, one line per finding. This is settled; do not redesign it.>

**You own.** <the files>. Nothing else. If the fix needs a change to `src/lib/api.ts`, `src/types.ts`, a switch file in `src/lib/`, `worker/src/mcp.ts`, any navigation component, or a file not listed, stop on that finding and write the conflict in `todo/review/fixes/<your id>.md` with the two options.

**Follow the pattern in** <the nearest existing file that already does it right>.

**Preserve.** Every switch stays closed by default. With the switches closed the live site must not change. Money rules, the photo editor rule and the back and forward rule in `CLAUDE.md`.

**Acceptance.** <the failing test or walk step named in each finding> passes. `npm run lint`, `npm run lint:colors` and the tests of the files you touched pass. You cannot commit; leave the work in the worktree and end with a list of files changed and each finding's state: fixed, or conflict.
