# Tea Atlas — plan

Status: plan only. Nothing built. Waiting on Adrian's "go".

**Mockup:** https://claude.ai/artifact/RuXYohDow1V2T9YVLJGyBj (six screens: library, topic page, reader, interview, post ideas, adding a book).

**Scope added 2026-09-27:** a study, research and content guide. Drop in anything (book, magazine, Chinese text, interview recording, web article) → split into sections → tagged by topic → you confirm. Post ideas keep their sources. Read it in Obsidian *and* a private website reading the same files.

**Goal:** a private research tool. Pick a topic → see everything Global Tea Hut says about it, next to what your teachers said, your talks, and your own tastings. Easy to open, easy to read. The public website comes later and stays in your own words.

## What the survey found

- **The archive is one long file per issue (107 files, 1.2 GB with PDFs and pictures).** Finding "the Liu Bao article" today means opening an issue and scrolling. That's the main thing to fix.
- **Contents pages give headline + page number** for 83 issues, so each issue can be cut into its separate articles by script. No AI.
- **The main Obsidian vault syncs to other machines via Syncthing**, and was wiped once by a sync surprise. 1.2 GB shouldn't go in there.
- **The website already has a wisdom section** (`teajia.com/wisdom`: regions, cultivars, producers, named teas). The public layer later extends that.

## 1. What makes it a good research tool

1. **One note per article, not per issue.** "Hakka Lei Cha — Wu De — Jan 2017, p.43", its text and its pictures, readable in one sitting. ~1,000–1,500 article notes. Free script.
2. **One hub per topic.** Opens with your own summary, then every GTH article on it (newest first, one line each, click to read), then key passages pasted in — quoting is fine, it's private.
3. **Your own sources sit beside GTH, same shape.** Folders for `Teachers/`, `Talks/`, `Tastings/`. Tag a note with a topic and it shows up on that hub automatically. This is what turns it from "a magazine index" into your research.
4. **Browse three ways:** by topic (hubs), by issue (INDEX.md, already done), by author (Wu De, Shen Su… — author notes list their articles).
5. **Ask it questions from Claude.** Optional: point i64os search at the atlas so "what did GTH say about water temperature for shou?" answers with links.

## 2. Where it lives

**Recommended:** open the `Tea wisdom` folder as its own Obsidian vault. Hubs, article notes and your own notes all go in there.

- Links work natively; the 1.2 GB stays on this Mac, off Syncthing.
- Cost: separate from the main vault's search.

## 3. Taxonomy — 6 categories, 40 starter topics

| Category | Starter topics |
|---|---|
| **Teas** (8) | Sheng puerh · Shou puerh · Liu Bao · Wuyi cliff tea · Dian Hong (Yunnan red) · Taiwanese high-mountain oolong · Aged tea · Fuding white |
| **Regions** (7) | Xishuangbanna · Wuyi Mountains · Guangxi (Wuzhou) · Anxi · Taiwan (Alishan, Sun Moon Lake) · Anhua (Hunan) · Uji (Japan) |
| **Teaware** (7) | Yixing clay · Tea bowls · Jian ware (tenmoku) · Kettles & charcoal · Jingdezhen porcelain · Chaozhou gongfu set · Storage jars |
| **Concepts** (7) | Cha Qi · Living tea (old-growth, ecological) · Water · Oxidation vs fermentation · Roasting · Aging & storage · Terroir |
| **People** (5) | Lu Yu · Sen no Rikyu · Baisao · Zhao Zhou · Eisai |
| **Practices** (6) | Gongfu cha · Bowl tea · Chaxi (the tea space) · Chanoyu / matcha · Song whisked tea · Hakka Lei Cha |

A starting guess. The Sonnet pass over CONTENTS.md confirms, merges and adds — expect 50–70 topics for you to prune.

## 4. Hub template

```markdown
---
type: tea | region | ware | concept | person | practice
aliases: [Liu Bao, 六堡茶, Liubao]
related: [[Guangxi]], [[Aging & storage]]
public: (blank until a website page exists)
---

# Liu Bao

## My understanding
Your summary, in your words. Grows as you learn.

## Global Tea Hut
- [[Liu Bao and the tin mines]] — Wu De, Mar 2015 · one line on what it covers
- …

## Key passages
> quote … — [[source article]]

## Teachers, talks, tastings
(fills itself from anything tagged #liu-bao)

## Questions I still have
```

## 5. Build order (token-lean)

1. **Split issues into article notes — free.** Script uses contents-page titles + page numbers. The 24 early issues without contents pages get cut by their printed headings; any it can't cut stay whole. ~1–2 hours to build and check.
2. **Keyword index — free.** Grep every article for each topic + aliases (incl. Chinese). Links each article to its topics.
3. **Topic list — one Sonnet call** over CONTENTS.md (~25k tokens) to confirm the taxonomy.
4. **Hubs — free.** Script writes each hub with its article list. No prose.
5. **Deep read — one Sonnet call per topic you pick**, only for the "Key passages" and a draft of "My understanding" for you to rewrite. ~20–60k tokens each.

## 6. Later: the public site

Each hub can become a `teajia.com/wisdom/…` page and feed `/read/…` articles, in your words and photos, with "Further reading: Global Tea Hut" credited.

First article ideas (8): Liu Bao, the tea that crossed the sea · Sheng and shou, plainly · Bowl tea · Water first · Storing tea in Australia · Lu Yu and the first tea book · Cliff tea · Cha Qi without the mysticism.
