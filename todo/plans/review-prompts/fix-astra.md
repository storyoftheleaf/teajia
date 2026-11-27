# Fix message for Astra (template; Opus fills the parts in angle brackets)

You are working on Teajia (repository storyoftheleaf/teajia), in your own git worktree cut from `build/review`. Read `CLAUDE.md` first and follow it. No em dashes in anything you write.

You found these in your review <slice id>; now make them hold: <ids, each with its one sentence>

**The contract.** <the rule, restated in one paragraph, with Adrian's answer if a question was put to him.>

**The cases it must hold under.** The ones in your review's test file <path>, all of them, not only the ones that failed. Add a case for any new path your fix creates (a retry of the fix itself, a row written before the fix).

**Evidence.** Your review test file passes whole. Rows written before your fix still read correctly: show it with a test that writes the old shape first. If the fix needs a migration, it creates or alters only; a migration that would UPDATE, DELETE or INSERT rows is not yours to write: stop and describe it, since Adrian sees a before and after page first.

**You own.** <the files>. A change to a shared interface (`src/lib/api.ts`, `src/types.ts`, a switch file, `worker/src/mcp.ts`, `worker/src/mcpTools/tickets.ts`) comes back to Opus as a conflict with the exact signature you need and why.

**Return.** A patch in the worktree, and `todo/review/fixes/<your id>.md`: for each finding, what changed, the test that proves it, and anything you chose not to change with the reason.
