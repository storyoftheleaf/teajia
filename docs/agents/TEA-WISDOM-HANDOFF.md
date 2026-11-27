# Tea Wisdom handoff: launching new teas

Read this first, then work from it. Update the "State" and "Open" sections in the same commit as any change you make, so the next agent starts from the truth. Last updated 2026-11-27.

## Start here

- To launch teas: run `/tea-wisdom <tea name or id>` (empty means every public tea without an entry). It sequences the chain.
- The chain, step by step, with models, files to read and the never-list: `docs/agents/TEA-WISDOM-AGENTS.md`. Follow it exactly.
- The one rule behind it: `docs/TEA_WISDOM_BASE.md`, section "One Wisdom Base, two layers". There is ONE Wisdom Base at /wisdom (records in `data/tea-wisdom-source/`, written pages in `data/tea-reference/pages/`, joined by id). Never start a second store or library.
- What a tea still needs: `node scripts/tea-wisdom-compose/needs.mjs --products <file> --ids <ids>`, or the "Wisdom Base" fold on the tea in Curate.

Models (Adrian kept this split on 2026-11-27): Sonnet researches and writes Wisdom pages; Opus writes and checks each tea's entry; Sonnet fixes flags; Haiku sorts review notes.

## State (measured on main, 2026-11-27)

- 209 approved tea entries, live in the site code. An entry shows to visitors only when its tea is public and active.
- 40 Wisdom Base pages. New today: Banzhang, Bulang Mountain, Jingmai, Kunlu Mountain, tea heads. A place page shows publicly only once a public tea links it.
- The new-tea check (`wisdomNeeds()`), the Curate fold and grade matching in the composer are live.

## Open

1. Kits now come only through the chain (PR storyoftheleaf/teajia#580, merged 2026-11-27).
2. Menghai County rewrite and 8 more sections wait on the Wisdom Review page for Adrian's approval.
3. Palace Grade (`gong-ting`) is a draft: its definition holds a `legacy_import` revision, which public pages refuse. Publishing needs Adrian's yes to drop that revision. When approved, limit its grade claims to `form: Loose`, or pressed "Gong Ting" cakes get loose-grade text.
4. Pages still needed (record only, no write-up): Hengfengyuan, Golden Bull, Xinghai Tea Factory, Taiwan as a place. Greater Yiwu and Menghai County have no place claims an entry can use, so Yiwu and Menghai teas get no place paragraph.
5. Liao Fu (5 teas): parked by Adrian. Do not compose.
6. Seven near-empty records (`cvb`, `red bag`, `High Mountain`, `Organic High Mountain`, `Gaba High Mountain`, `Gaba Gigh Mountain`, `Gaba Taiwan`): Adrian decides fill or archive.
7. Shop records that contradict themselves (report, never change without Adrian's yes): Fire oolong (year 1979, notes say 1983, $0.04/g); Taiwan Aged Green (1950 vs 1970); Tie Guan Yin 1970 and 1995 (lore says 1988); Dancong Ancient Spirit (1950 vs 1970); Miracle Fate (1,800 g vs 180 g); Bamboo Tube Shou listed as a brick.

## Traps

- Several sessions share this repo. Push with a temporary index on top of `origin/main` (`git read-tree origin/main`, add only your files, `git commit-tree`, push `"${C}:refs/heads/main"`; in zsh write `${C}`). Never commit `.claude/launch.json`.
- The Edit tool refuses files in another worktree. Assemble in a scratch copy instead (`git archive origin/main`, symlink `node_modules`).
- The local practice site will not start until `@mediapipe/tasks-vision` is installed; check the live admin in the signed-in browser instead (read-only).
- `npx tsc` shows two errors already on main (`heic-to/csp`, `@mediapipe/tasks-vision`). They are not yours.
- After approving pages, update the page lists in `src/wisdom/reference/catalogue.test.ts` and `scripts/tea-reference-markdown/tests/page-builder.test.mjs`.
- Live check: crawl every JS chunk from www.teajia.com with curl and grep for the entry ids; they sit in the `AlcoveCard` chunk.
