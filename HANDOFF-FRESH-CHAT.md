# Handoff to fresh chat: the navigation foundation, one word per route

Open a new chat in the Teajia project and paste the block below. The copy button on the code fence grabs it cleanly.

```
Execute the navigation foundation slice specified in todo/plans/nav-foundation.md. It is the third slice of Direction A from the 2026-09-22 navigation survey; the first two (the two-door bottom bar with the site panel, and Your Table as the person's room with one Manage door) are live on teajia.com.

Start with git pull origin main so you have the plan file and both shipped slices. Work in your own worktree on a branch; five or six sessions run on this repo at once.

Before touching code, read in this order:
1. todo/plans/nav-foundation.md, the audit deltas at the top first.
2. The "Desktop / mobile layout principles" section of CLAUDE.md, the two bullets dated 2026-09-22.
3. src/components/manageNav.ts and src/components/navigationConnections.ts, the one list of Manage rooms and its gates.
4. The survey page for the reasoning, sections "What is actually wrong" and "The shared foundation": https://claude.ai/artifact/VNLJtEDaYFRshPSgMeWk9P

You do not need to re-survey the navigation. Every nav surface, every Your Table tile, every Manage room, every public route and its inbound links were mapped on 2026-09-22 by four agents and the results are in the plan and on the survey page. Re-grep each dead file before deleting it, nothing more.

Execute the plan in its four parts, in order: the renames with the one-word guard, the dead code, the routes with no door, the docs. One PR against main, conventional commit messages, no em-dashes anywhere. Where the plan says "default", take the default and name it in the closing report; ask Adrian once, at the end, only about the two routes the plan leaves to him.

Verification is what the plan's last section says and nothing less. Run the browser specs on the managed mock server (plain npx playwright test, port 7777 free), never against a dev server that talks to the live API. Prove the one-word guard goes red before you trust it green. Before saying anything is live, load the live site and paste the check.

Hard rails:
- No popup questions, no em-dashes, no file paths in prose Adrian reads.
- Never change a nav word beyond what the plan names without asking.
- The Manage rooms live in manageNav.ts only; never add a second list.
- Warm dark theme, no icons beside words in the rail or the column.
- Do not touch worker/ in this slice; the worker type ratchet fails on moved lines.
- Send a clickable dev-server URL and a screenshot of the open Manage column and the phone's site panel for an owner when ready to look at.

After the slice is merged and proven live, stop and report. Do not start the connections page or any other follow-up.
```

---

## Context for after (Adrian's reference only, not for the fresh chat)

When this lands, Direction A is complete. What remains from the survey is one design call: the connections page, people and places on one screen, merging the spaces page and Find a Table. The plan for it is todo/plans/connections-page.md. Direction B's "Around you" band and Direction C's fifth word were not chosen and stay on the survey page as the record.
