# Tea Wisdom research prompt (for DeepSeek, Kimi, Perplexity or any research agent)

Copy everything between the lines into the other agent. Send one topic batch per run. Save each answer as its own file in the vault at `Teajia/Research/tea-wisdom/<entry-id>.md`, then tell Claude "research is in". Claude turns the files into Wisdom entries in our own words.

---

You are helping build Tea Wisdom, a reference for a specialist tea shop. Everything below is common knowledge in the tea trade: what a tea master, a farmer in the growing area, or an experienced seller would tell anyone who asked. Your job is to find out what that shared knowledge is by reading many places, and to show where those places agree and where they don't. Do not copy any source's wording. Write every statement in your own plain English.

**Read widely, in Chinese and English.** For each topic, use at least 5 independent places, mixing as many of these kinds as you can:
- producers and factories (their own history pages);
- sellers who describe their own teas;
- tea educators and specialist blogs;
- Chinese trade and industry sites, county or provincial government pages, and trade associations;
- standards documents (group, industry or national);
- tea forums and Q&A sites (Chinese and English);
- academic abstracts.

Two pages that copy each other count as one place.

**For each topic, return one Markdown file in exactly this shape:**

```
# <Entry name>            (entry-id: <kebab-case-id>)
Kind: tea type | leaf grade | growing area | village | producer | process | brewing method
Part of: <parent entry-id>     Related: <entry-id>, <entry-id>

## Chinese names
- <characters> · <pinyin> · <plain-English meaning>

## What is commonly agreed
1. <One statement, own words, one fact per line.>
   Applies to: <exactly what it covers, e.g. "loose ripe pu'er", "Menghai County", "this grade label in the market">
   Agreement: <how many independent places say this> of <how many you read>
   Places: <place name> (<kind>, <language>, <URL>); <place name> (...); ...

## Where places disagree or are unclear
- <The question> — <view A> (places …) vs <view B> (places …)

## What people commonly notice when drinking it   (teas, grades and styles only)
- Notes mentioned and how often: <note> (<n> places), <note> (<n> places), ...
- Things that change it: <age, storage, blend, leaf size, …>, with the places that say so

## Not established
- <Claims you saw but could not find in 3 or more independent places, e.g. a founding date or a "first used" claim>

## Places read
| Place | Kind | Language | URL | Date read |
```

**Rules**
- A statement goes under "commonly agreed" only if 3 or more independent places support it. Anything weaker goes under "Not established".
- Keep what applies to a type, a grade, a place and a maker separate. A grade name says nothing about where a tea grew. A village name says nothing about tree age. A factory's history is not a fact about every tea from its county.
- Never describe one particular cake or product as if it were the whole category.
- Taste notes are counted across places, never quoted.
- If a page needs a login, an app or a CAPTCHA, skip it and list it under "Places read" as "not reachable".

**Topics for this batch** (one file each):
1. `shou`: ripe pu'er (熟普洱): how wet piling (渥堆) works, the steps, how long it takes, how it differs from raw pu'er.
2. `gong-ting`: the Gong Ting (宫廷) grade of ripe pu'er: what the leaf looks like, how it is sorted, how the label is used in the market versus in grading standards.
3. `ripe-puer-grades`: the full loose ripe pu'er grade ladder (宫廷, 特级, 一级 … 十级): what changes from grade to grade (buds, leaf size, stems). Which standards define it (e.g. the Menghai Tea Alliance group standard T/MHC 003–2020 and the national standard GB/T 22111), and how they differ.
4. `menghai-county`: Menghai County (勐海县) as a growing area: its main mountain areas and how they are grouped.
5. `mengsong` and `naka`: Mengsong (勐宋) and Naka village (那卡): where they are, which mountain area Naka belongs to, and the altitude. Some sources put Naka on Nannuo; check this.
6. `menghai-tea-factory`: Menghai Tea Factory and Dayi: when ripe pu'er wet piling was developed there, and the 7572 recipe (what the number means, when it started).
7. `grade-comparison-brewing`: how tea people compare two grades side by side (same dose, water, temperature, steep times; dry leaf, wet leaf, early and later infusions).

---

## What Claude can and can't fetch directly

**Can fetch:** most public pages whose robots rules allow it: TeaDB, Dayi's own site, Yunnan Sourcing, white2tea and the national standards record. Also PDFs you approve, and Chinese pages, which Claude can read and translate.

**Can't fetch:**
- sites that block AI crawlers (the spgykj journal);
- sites that refuse automated requests (MDPI);
- anything behind a login, an app or a CAPTCHA: WeChat articles, Zhihu, Xiaohongshu, Douyin, Taobao listings;
- what people tell you in person.

Those are what the other agents, or you, should cover.
