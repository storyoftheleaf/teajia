# Tea Wisdom handoff: launching new teas

Read this first, then work from it. Update the "State" and "Open" sections in the same commit as any change you make, so the next agent starts from the truth. Last updated 2026-11-27 (late evening).

## Start here

- To launch teas: run `/tea-wisdom <tea name or id>` (empty means every public tea without an entry). It sequences the chain.
- The chain, step by step, with models, files to read and the never-list: `docs/agents/TEA-WISDOM-AGENTS.md`. Follow it exactly.
- The one rule behind it: `docs/TEA_WISDOM_BASE.md`, section "One Wisdom Base, two layers". There is ONE Wisdom Base at /wisdom (records in `data/tea-wisdom-source/`, written pages in `data/tea-reference/pages/`, joined by id). Never start a second store or library.
- What a tea still needs: `node scripts/tea-wisdom-compose/needs.mjs --products <file> --ids <ids>`, or the "Wisdom Base" fold on the tea in Curate.

Models (Adrian kept this split on 2026-11-27): Sonnet researches and writes Wisdom pages; Opus writes and checks each tea's entry; Sonnet fixes flags; Haiku sorts review notes.

## State (measured on main, 2026-11-27, late)

- 213 approved tea entries, live in the site code (98 rewritten on 2026-11-27 with the new pages). An entry shows to visitors only when its tea is public and active.
- 85 Wisdom Base pages: 66 public, 7 reference topics kept as drafts by rule (the four factories, Hengfengyuan, the Menghai route, the Xishuangbanna list, Yunnan mountain names), 12 thin drafts held for more research.
- Batch 1 and 2 (45 pages and new Yiwu and Menghai place sections) were researched by Sonnet, one agent per page. Adrian asked Claude to decide the review, so Claude approved 187 sections where the research met the bar (5+ places, 3 agreeing); the ledger says so on each.
- Palace Grade (`gong-ting`) is public (PR storyoftheleaf/teajia#585). Its claims apply only to form Loose.
- The three Huang Wei invoice teas have approved entries. Menghai Tender-Bud Palace is Loose in the shop; the 1980s Guogai Bing has no direct mountain origin (Adrian: a medicinal-flavoured cake), so its origin stays blank.
- Records fixed to the sources: Lishan's region is Taichung and Alishan's is Chiayi (record names kept so their ids and links stay the same); Gong Jin is a selling name, not a grade, maker not established; Zhong Cha Pai is eight zhong around a central cha; the bare word "Menghai" is no longer a Menghai Tea Factory match word.
- Research notes for every page: project files `tea-wisdom/research/<id>.md`.

## Open

1. Thin pages held as drafts, to research again before review: Golden Bull, Xinghai Tea Factory, Zhudong, 7572, Blue Seal Green Label, Yellow Label, Yi Ji, Gongjian, Zhen Pin, Red Seal, Gong Jin, Tongqinghao. Teas that need them (Precious Tieguanyin, Anhua Yi Ji, 7572 Menghai, Gongjian) keep draft entries until they pass.
2. 15 teas were recomposed but the new text did not pass, so their earlier approved entry stays live: 11 still flagged after two writes (taste words such as "thick" or "honey" in the story, "best"), and 4 that lean on the held thin pages. The new drafts were not kept; recompose after the fixes.
3. Qiaorui (producer record): almost certainly a misreading of Nanqiao Ruigong. No page; Adrian decides whether to drop the record.
4. Liao Fu and Jia Ji: parked by Adrian. Do not compose.
5. Still with no origin: 1990s Pu'er Tea Brick. Not covered by any page: Bamboo tube (process), China and Japan as whole countries, and the shop's own named teas.
6. Seven near-empty records (`cvb`, `red bag`, `High Mountain`, `Organic High Mountain`, `Gaba High Mountain`, `Gaba Gigh Mountain`, `Gaba Taiwan`): Adrian decides fill or archive.
7. Shop records that contradict themselves (report, never change without Adrian's yes): Fire oolong (year 1979, notes say 1983, $0.04/g); Taiwan Aged Green (1950 vs 1970); Tie Guan Yin 1970 and 1995 (lore says 1988); Dancong Ancient Spirit (1950 vs 1970); Miracle Fate (1,800 g vs 180 g); Bamboo Tube Shou listed as a brick.
8. Curate "Write it up" step (PR 586 in the intake thread) reads `wisdomNeeds()`, so these pages now count there with no further change.

## Traps

- Never recompose the seven teas whose wording Adrian reviewed line by line (`worker/src/wisdomWordingReview.json`: Y562 Black Box, Naka Gushu, Yiwu Gushu, Ripe Puerh Brick 1990, Pasha Village, Aged Northern Vietnam, Xiniu Tang Gushu). A rewrite breaks that review.
- Recomposing a tea replaces its approved entry with a draft. Before shipping, restore from main any entry that did not pass, or the tea loses its live text.
- A county name is not a maker. "Menghai" was removed from the Menghai Tea Factory match words on 2026-11-27; do not add a bare place word to a producer's alt names again.
- Reference topic pages (`kind: reference_topic`, which includes every producer page) must stay `visibility: draft`; the builder refuses them public. Their approved claims still feed entries.
- The composer runs in the cloud too: the `claude` CLI is installed there, about 30 seconds a tea, six in parallel is fine.

- Several sessions share this repo. Push with a temporary index on top of `origin/main` (`git read-tree origin/main`, add only your files, `git commit-tree`, push `"${C}:refs/heads/main"`; in zsh write `${C}`). Never commit `.claude/launch.json`.
- The Edit tool refuses files in another worktree. Assemble in a scratch copy instead (`git archive origin/main`, symlink `node_modules`).
- The local practice site will not start until `@mediapipe/tasks-vision` is installed; check the live admin in the signed-in browser instead (read-only).
- `npx tsc` shows two errors already on main (`heic-to/csp`, `@mediapipe/tasks-vision`). They are not yours.
- After approving pages, update the page lists in `src/wisdom/reference/catalogue.test.ts` and `scripts/tea-reference-markdown/tests/page-builder.test.mjs`.
- Live check: crawl every JS chunk from www.teajia.com with curl and grep for the entry ids; they sit in the `AlcoveCard` chunk.
