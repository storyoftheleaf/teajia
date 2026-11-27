---
description: Take new public teas to finished Tea Wisdom entries — check, research missing pages, Adrian's review page, compose, check, push on his word
argument-hint: "[tea name or product id, or empty for every public tea without an entry]"
---

Run the new-tea Tea Wisdom chain in this repo. The brief for every step, with its model, files to read and never-list, is `docs/agents/TEA-WISDOM-AGENTS.md`. Read it whole first and follow it exactly. This command only sequences it.

Teas: $ARGUMENTS (empty means every public tea with no approved entry in `data/tea-reference/entries/`).

1. Fetch the public product list once: `curl -s https://www.teajia.com/api/products/public > $TMPDIR/products.json`. Resolve the teas to product ids.
2. **Step 1:** run `scripts/tea-wisdom-compose/needs.mjs` for those ids. Show Adrian, in plain words, what each tea needs (one line per missing page) and how long the research will take (about 1 to 2 hours per page).
3. **Step 2:** a missing style kit ("No style kit for …") is a page like the rest: draft it from the kit template. For each missing page, dispatch one research agent with `model: "sonnet"`, all in one message so they run in parallel, each given only its page's row of the placement table and the step 2 brief. When they report, check that each page builds (`npm run tea-reference:pages`).
4. **Step 4 and 5, for teas whose pages are all covered already:** compose them now (`compose.mjs --ids …`, Opus, about 3 minutes a tea), then run the fix step for any flags with a `model: "sonnet"` agent.
5. **Steps 3 and 6 together:** run the Opus judge and apply what it approved. Compose any tea whose pages it just approved, and judge those entries too. Then publish the "Held for you" page (only if something is held) and the "What went up" page, and give Adrian both links. Do not wait for him to approve things the judge approved. When he sends anything back, apply it, write any ticked note into the page rules, and re-judge what the note touches.
6. **Step 7:** run the checks and commit. Push to `main` only when Adrian says "push".

At each stop, tell Adrian what is waiting for him and what happens after. Nothing in this chain writes to the live shop.
