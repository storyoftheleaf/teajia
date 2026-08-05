# Style and mark extraction notes

Source: `data/tea-wisdom-source/styles.csv` (10 rows), `data/tea-wisdom-source/marks.csv`
(15 rows), extracted from `products/*.md` (185 tea write-ups) per the coverage
audit at `docs/_notes/wisdom-gap-report.md` and the definitions in
`docs/TEA_WISDOM_BASE.md`.

Method: ran `node scripts/audit-wisdom-coverage.mjs` and read every unresolved
tea name, then grepped the prose bodies of all `products/dark|shou|sheng|oolong|red|white|green|misc/*.md`
files for style and mark language (seal, label, grade, recipe, brand,
tribute, palace grade, basket, camphor, GABA, and the named examples in the
task brief) and read every matching file in full. No fact below is invented;
every row's description is drawn from a product's own frontmatter or prose.

## Styles (10)

| Style | Chinese | Products |
|---|---|---|
| Xiao Qing Gan | 小青柑 | `shou/xiao-qing-gan.md` |
| Qi Zi Bing | 七子饼 | `shou/qi-zi-bing-2001.md` |
| Tie Bing | 铁饼 | `sheng/dark-green-tie-bing-2000.md`, `sheng/light-green-tie-bing-2001.md`, `shou/yellow-label-tie-bing-1997.md`, `sheng/blue-seal-green-label-1990.md` (chineseName carries 铁饼 too) |
| Bai Liang / Hua Juan | 花卷茶 | `dark/bai-liang-2006.md` |
| Kang Brick | 康磚 | `dark/yaan-kang-brick-1980.md` |
| Bamboo Tube | 竹筒茶 | `shou/bamboo-tube-shou-1998.md` |
| GABA Oolong | GABA乌龙 | `oolong/eu-gaba-oolong.md`, `oolong/gaba-organic-high-mountain-2024.md`, `oolong/organic-gaba-oolong.md` |
| Basket Tea | 篮茶 | `dark/aged-liu-an-1985.md` (form: Basket), `dark/liu-an-1990.md`, `dark/aged-liu-bao-1960.md`, `dark/guangxi-liupao-1970-1970.md`, `dark/liu-bao-1980.md`, `dark/liu-bao-1990-1990.md` (basket-aging described in Processing prose even where the `form` field says Loose Leaf) |
| Wet-Stored | 湿仓 | `sheng/wet-stored-sheng-2007.md` |
| Camphor-Stored | 樟香 | `sheng/red-seal-camphor-puerh-1980.md` (full prose), `shou/camphor-shou-2012.md` (chineseName 樟香熟茶 only, no prose body) |

Notes on scope decisions:

- **Basket Tea is a style (a packing/aging technique), not a tea name.** The
  tea names themselves ("Liu An", "Liu Bao") are a separate holding
  (`src/data/teaVarieties.ts`, out of my file ownership) and in fact already
  partly exist there (`Liu An Basket Tea`, 六安篓茶). This CSV row is
  deliberately about the general bamboo-basket-aging *method*, shared across
  both Liu An (Anhui) and Liu Bao (Guangxi), not a duplicate of either
  variety entry.
- **Bai Liang / Hua Juan overlaps in spirit with an existing variety row**,
  `Bai Liang Cha` (百两茶, Hundred Tael Tea, Hunan) already in
  `teaVarieties.ts`. It didn't match algorithmically because the product's
  own chineseName is `花卷茶` (Hua Juan) and productName is bare `Bai Liang`
  without the `Cha` suffix. I kept it in styles.csv because the task brief
  explicitly names it as a style example, but flagging the overlap so
  whoever wires styles.csv into the build doesn't double-count it against a
  near-duplicate variety.
- Region field left blank for Tie Bing, Bamboo Tube, GABA Oolong, Basket Tea,
  Wet-Stored and Camphor-Stored because none of these are exclusive to one
  place in the write-ups (Tie Bing and GABA processing happen wherever the
  factory/farm is; Basket Tea spans Anhui and Guangxi; Wet/Camphor storage
  is a warehouse practice, not a growing region).

## Marks (15)

| Mark | Chinese | Producer stated | Products |
|---|---|---|---|
| 7572 | 7572 | Menghai Tea Factory | `shou/7572-menghai-1999.md` |
| Red Seal | 紅印 | China National Tea Corporation | `sheng/red-seal-camphor-puerh-1980.md` |
| Blue Seal Green Label | 蓝印绿标 | China National Tea Corporation | `sheng/blue-seal-green-label-1990.md` |
| Yellow Label | 黄标 | (not stated) | `shou/yellow-label-tie-bing-1997.md` |
| Zhong Cha Pai | 中茶牌 | China National Tea Corporation | `shou/zhong-cha-pai-yuan-1998.md` |
| Three Cranes | 三鹤 | Wuzhou Tea Factory | `dark/3-cranes-liu-bao-1999.md` |
| Jia Ji | 甲级 | (blank, spans producers) | `dark/menghai-jia-ji-tuo-1998.md`, `dark/liao-fu-1980.md` (chineseName 廖福甲级) |
| Yi Ji | 一级 | (blank) | `dark/anhua-yi-ji-2015-2015.md`, `dark/anhua-yi-ji-2020-2020.md` |
| Wan Yan | 万言 | Liao Fu | `dark/liao-fu-wan-yan-aaa-1980.md` |
| AAA | (n/a) | (blank) | `dark/liao-fu-wan-yan-aaa-1980.md` |
| Gong Ting | 宫廷 | (blank) | `shou/banzhang-gongting.md`, `shou/banzhang-palace-grade-2003.md` (chineseName only, no prose), `oolong/gong-ting-oolong-1970-1970.md` |
| Zhen Pin | 珍品 | (blank) | `oolong/precious-tieguanyin.md` |
| Gongjian | 贡尖 | (blank) | `dark/gongjian-2024.md` |
| Gong Jin | 贡金 | Qiaorui | `shou/qiaorui-gong-jin-2009.md` |
| Golden Bull | 金牛 | Hengfengyuan | `shou/golden-bull-hengfengyuan-2009.md` (no prose body; name only) |

Notes on scope decisions:

- **Jia Ji and Yi Ji are generic grade classifications, not one producer's
  property.** Jia Ji shows up under both Menghai and Liao Fu in this
  collection; Yi Ji shows up with no stated producer at all. I left
  `producer` blank on both rather than guess, per the "do not guess" rule.
  `teaVarieties.ts` already has one narrow instance of each baked into a
  compound name (`Xiaguan Jia Ji`, `Yi Ji` tied specifically to 一级熟普/shou
  pu-erh), but the grade concept itself is broader and reusable across tea
  types, which is why a standalone mark entry still adds value.
- **Tianjian and Shengjian are named but not given their own rows.** Adrian's
  own `gongjian-2024.md` write-up names them as the other two grades in
  Anhua's traditional three-grade ("three jian") system, but no product in
  the collection carries either grade and the write-up gives no further
  detail (no Chinese characters, no description). Blank beats wrong: I left
  them out of marks.csv rather than supply their commonly-known characters
  (天尖 / 生尖) from outside knowledge the corpus itself doesn't state.
- **Cross-checked against `data/tea-wisdom-source/producers.csv`** (built in
  parallel by another agent, appeared partway through this pass). Its
  `notable_marks` column independently lists 7572, Zhong Cha, Red Seal, Blue
  Seal Green Label, San He/Three Cranes, Jia Ji, Wan Yan AAA, Gong Jin, and
  Golden Bull, which cross-validates those choices. Producer name strings in
  marks.csv (`Menghai Tea Factory`, `Wuzhou Tea Factory`, `China National Tea
  Corporation`, `Liao Fu`, `Qiaorui`, `Hengfengyuan`) match that file's `name`
  column exactly, for a clean future join. I did not read or edit
  producers.csv beyond this cross-check.

## Excluded: Adrian's own poetic names (not styles or marks)

Confirmed excluded per the task brief and each product's own `givenName`
field: Courage, Passion, Mercy, Wisdom, Inspiration, Universe, Galaxy, True
Love, Miracle Fate, New Rainbow, Old Rainbow, Yun Shen Chu, Yue Chen Yue
Xiang. These are Adrian's own naming for a specific lot, confirmed by the
presence of a distinct `givenName` field or by the product's own prose
("This tea arrived already named... The name marks not just what a tea is
but what it means to the one who kept it," `sheng/courage.md`).

## Uncertain: excluded from both CSVs, with reasoning

These are named things in the write-ups that read like they could be a
style, a mark, or a producer, but I could not confirm which without
guessing. Listed here rather than placed in a CSV, per "blank beats wrong."

- **Wan Zhi (万枝)**, `shou/wan-zhi-1980-1980.md`. The write-up explicitly
  says the name "may indicate a blend from multiple garden sources" and
  frames it as poetic/uncertain rather than a documented mark. It also
  carries a `givenName` identical to its Chinese-derived English name,
  blurring the line between "Adrian's own name" and "a stated product name."
- **French Brick (法国砖)**, `sheng/french-brick.md`. The write-up itself
  calls it "a curious name" and offers three competing, unconfirmed
  explanations (colonial-era export, French storage history, French-market
  production) without settling on one. Not enough to call it a mark.
- **Tea Masters Cake (茶师饼)**, `shou/tea-masters-cake.md`. The write-up
  says outright: "Whether this is a brand name, a designation of quality, or
  a tribute to the maker is unknown."
- **Huakang Oolong (华康乌龙)**, `oolong/huakang-oolong.md`. The write-up
  says: "The Huakang name may refer to a brand, a location, or a maker."
- **Orange Master Box**, `oolong/orange-master-box.md`. No Chinese name, no
  origin, no cultivar; the write-up frames it as "the most honest form of
  anonymous tea," defined only by its packaging. Nothing to attach a style
  or mark record to.
- **Golden Award / Award-Winning (金奖 / 获奖)**, appears on three unrelated
  products (`oolong/golden-award-aged-oolong-1989.md`,
  `shou/golden-award-puerh-1990s.md`, `red/award-winning-red-2023.md`) from
  three different vendors and eras. This is a competition honorific, not a
  recipe/seal/label identifying one product line, and not a way of making or
  pressing tea. It doesn't fit either holding cleanly, so it's excluded from
  both. Flagging in case a future "certifications/awards" holding is ever
  added.
- **Anhua Huangye (荒野, "wasteland"/wild tea)**, `dark/anhua-huangye-2022-2022.md`,
  `dark/anhua-huangye-2024-2024.md`. This is a cultivation-method descriptor
  (wild-growing vs. cultivated bushes), not a pressing/preparation style and
  not a producer mark. It likely belongs on a future "cultivation method"
  axis in `vocabulary.ts` rather than in either of my two files, so it's
  excluded here rather than force-fit.
- **Maojian as a pu-erh picking grade**, `sheng/maojian-raw-puerh-1963.md`
  ("fur tip," the tenderest spring picking). Deliberately excluded even
  though it reads like a Jia Ji/Yi Ji-style grade term, because `Mao Jian`
  (毛尖) already exists in `src/data/teaVarieties.ts` as a distinct green tea
  variety name (plus `Xinyang Mao Jian`, `Duyun Mao Jian`, etc.). Adding it
  again here as a generic picking-grade mark risked conflating a proper-noun
  tea variety with an unrelated grading concept that happens to share the
  same two Chinese characters.

## Public-fact allowance used once

Per the task brief's own example (7572's formula/grade/factory encoding),
I filled in one detail from well-established public knowledge only where a
write-up already confirmed the underlying entity exists and the fact was
directly on-topic: none beyond what's already stated in `7572`'s own
write-up were used. I deliberately declined to do this for Red Seal's era
(commonly dated to the 1940s-1950s) because the write-up only vaguely states
"by 1980 the original... era had passed" without giving a specific decade,
so `era` is left blank rather than asserting a date Adrian's own prose
doesn't state.

## Not found in the corpus

- **7542** (the other famous pu-erh recipe number named in the task brief)
  does not appear anywhere in `products/`. Not added.
