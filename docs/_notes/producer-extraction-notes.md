# Producer extraction notes

Source: all 303 files in `products/`, read directly (not sampled). Output:
`data/tea-wisdom-source/producers.csv`, 10 rows.

## Method actually used

1. Read `docs/TEA_WISDOM_BASE.md` and `docs/_notes/wisdom-gap-report.md` for
   context on what the wisdom base already models and what it is missing.
2. Ran `node scripts/audit-wisdom-coverage.mjs` and read its full "Unresolved
   tea names" list (110 names) as a candidate pool. That report explicitly
   flags Liao Fu, Xinghai, Tongqinghao, Qiaorui, Hengfengyuan, Huakang,
   Shenhua, Menghai, Xiaguan, and Zhong Cha as likely producer names.
3. Grepped every product body for producer signal terms in three passes:
   factory/brand keyword pairs (`Tea Factory`, `茶厂`, `茶廠`, `Dayi`, `大益`,
   `Xiaguan`, `下關`/`下关`, `Menghai`, `勐海`, `CNNP`, `Zhong Cha`, `中茶`,
   `Haiwan`, `海湾`, `Xinghai`, `兴海`, `Chen Sheng`, `陈升`, `Hengfengyuan`,
   `恒丰源`, `Qiaorui`, `乔瑞`, `Liao Fu`, `廖福`, `Huakang`, `华康`, `Shenhua`,
   `神华`, `号`/`號`, `Kunming`, `昆明`, `Tongqinghao`, `同慶`/`同庆`), an English
   structural pass (`factory`, `brand`, `trademark`, `cooperative`,
   `state-run`/`state owned`, `distillery`, `workshop`, `guild`), and a named-
   brand sweep for historic and modern puerh houses not caught above
   (`Fuhai`/`福海`, `Douji`/`斗记`, `Changtai`/`昌泰`, `Songpin`/`松聘`,
   `Xizhihao`, `六大茶山`, `Lao Tong Zhi`/`老同志`, recipe numbers `7542`,
   `8582`, `8592`, `0622`, `7262`, `7452`). Also checked `family`, `estate`,
   `garden`, `tea house`, `founded by`, `established` across oolong/red/
   white/green, since those categories could plausibly carry a named
   Taiwanese tea house or garden.
4. Every file any pass surfaced (52 candidates plus the full oolong/red/
   white/green sweep for the "family/estate" terms, 14 more) was read in
   full, not just grepped. `products/index.md` and `products/misc/yaobao.md`
   were also read; neither contains producer information.
5. Cross-checked the CSV's `kind` values against the task's own definitions
   (house = pre-1950 family firm like Tong Qing Hao; factory = state or
   modern industrial producer) before assigning them.

## Producers found: 10

Ranked by number of Adrian's products naming them:

1. **Liao Fu** (廖福): 5 products: `dark/liao-fu-1980.md`,
   `dark/liao-fu-2.md`, `dark/liao-fu-wan-yan-aaa-1980.md`,
   `dark/liao-fu-wild-1980.md`, `dark/liao-fu.md`. All five write-ups use
   near-identical language ("a respected name in Guangxi dark tea
   production... centered around Cangwu county"), so `kind` is `unknown`
   rather than `factory`/`house` since none of the five ever states which
   it is.
2. **Menghai Tea Factory** (勐海茶厂): 4 products, all with explicit factory
   attribution in prose: `shou/7572-menghai-1999.md` ("Menghai Tea
   Factory's benchmark shou recipe"), `dark/menghai-jia-ji-tuo-1998.md`
   ("tuo cha from the Menghai factory... has been a center of pu-erh
   production since 1940"), `sheng/menghai-bullet-tuo-1996.md` ("The
   Menghai Tea Factory and surrounding producers were the primary source
   of tuo cha production in this era"), `sheng/menghai-raw-loose-1976.md`
   ("Menghai Tea Factory was operating under state control in 1976").
   Founded year (1940) and the Dayi/Taetea alt names come from the task
   brief's own worked example, not from the product prose.
3. **China National Tea Corporation** (中国茶叶公司 / Zhong Cha / CNNP): 3
   products: `sheng/blue-seal-green-label-1990.md` ("designation from the
   era of state-controlled pu-erh production... used by the China National
   Tea Corporation"), `sheng/red-seal-camphor-puerh-1980.md` ("Red Seal...
   originally referring to cakes produced by the China National Tea
   Corporation with a red seal on the wrapper"), `shou/zhong-cha-pai-yuan-
   1998.md` ("Zhong Cha Pai... the iconic brand of the China National Tea
   Corporation, marked by the eight-pointed 'zhong' character"). Treated as
   one entity across its CNNP/Zhong Cha/中茶 names since the write-ups use
   them interchangeably for the same trademark.
4. **Xiaguan Tea Factory** (下关茶厂): 1 product: `sheng/xiaguan-wild-2005.md`
   ("wild tea cake from Xiaguan Tea Factory... one of Yunnan's oldest and
   most important tea factories, based in Dali"). Founded year (1941) is
   from the task brief's worked example.
5. **Wuzhou Tea Factory** (梧州茶厂): 1 product: `dark/3-cranes-liu-bao-
   1999.md` ("San He (Three Cranes) is the most recognized liu bao brand,
   produced by the Wuzhou Tea Factory in Guangxi since 1953"). The 1953
   founding year is stated directly in this product's own write-up, not a
   public-record addition. San He/Three Cranes is recorded as an alt name/
   brand of the factory rather than a separate producer row, since the
   write-up itself describes that relationship.
6. **Kunming Tea Factory** (昆明茶厂): 1 product, indirect: `shou/shou-1980-
   1980.md` mentions it only as the birthplace of wo dui fermentation
   ("the technique was developed at Kunming Tea Factory in 1973"), not as
   this specific cake's producer. Included because it is a real, named
   entity described factually in the corpus, but the CSV's `founded` field
   is left blank since only the fermentation-invention year is stated, not
   the factory's own founding date, and I did not want to substitute a
   remembered year the source never gave.
7. **Xinghai Tea Factory** (兴海茶厂): 1 product: `sheng/xinghai-aged-sheng-
   2005.md`. This file has an **empty prose body** (a 24g sample record
   with `tastingNotes: []`). The only evidence is the product's own name.
   Included on the strength of the task brief explicitly listing "Xinghai"
   as a likely producer and the name being a well-documented real puerh
   factory, but every CSV field beyond name/alt_names is left blank because
   nothing in Adrian's own write-up confirms region, founding, or marks.
8. **Qiaorui** (乔瑞): 1 product: `shou/qiaorui-gong-jin-2009.md`. The
   prose describes the "gong jin" (tribute gold brick) grade generically
   without ever confirming what Qiaorui itself is. `kind` left as
   `unknown`.
9. **Hengfengyuan** (恒丰源): 1 product: `shou/golden-bull-hengfengyuan-
   2009.md`. Also an empty-body 24g sample record. Name only.
10. **Tongqinghao** (同慶號): 1 product: `sheng/tongqinghao-1980.md`
    ("among the oldest known pu'erh brands, with origins traced to the
    late Qing dynasty in Yiwu"). `kind: house` per the task brief's own
    definition (a pre-1950 family firm). No founding year given anywhere
    in the write-up beyond "late Qing dynasty," which is not a year, so
    `founded` is blank rather than a guessed date.

## Names I was unsure about and excluded from the CSV

- **Huakang** (华康): `oolong/huakang-oolong.md`. Excluded. The write-up
  itself hedges: "The Huakang name may refer to a brand, a location, or a
  maker." Since Adrian's own source material declines to say it is a
  producer, I did not promote it to one. Different from Qiaorui/
  Hengfengyuan/Xinghai above, where the write-up is silent rather than
  actively uncertain.
- **Shenhua** (神华): `red/shenhua-native-red.md`. Excluded for the same
  reason: the write-up explicitly says "Whether this is a brand name, a
  designation of quality, or a tribute to the maker is unknown" (that
  sentence is actually from `shou/tea-masters-cake.md`, but
  `shenhua-native-red.md` carries the same open-ended treatment of its own
  name, never asserting Shenhua is a producer).
- **Tea Masters Cake** (茶师饼): `shou/tea-masters-cake.md`. Not a
  producer name at all on inspection; "Tea Masters Cake" is the product's
  own name/designation ("Whether this is a brand name... or a tribute to
  the maker is unknown"), not a distinct producer entity to catalog.
- **"Lao Tong Zhi" as a vendor-field coincidence.** 17 products carry
  `vendor: "Lao Tong Zhi"` (a batch of small 24g-100g sample records, all
  with empty prose bodies): `red/aged-sheng-essence-hongcha-1997.md`,
  `sheng/aged-lao-banzhang-1980s.md`, `red/thousand-year-wild-chu-
  hongcha-2024.md`, `sheng/kunlu-imperial-tribute-2007.md`,
  `sheng/wild-round-tea-classic-2005.md`, `sheng/song-dynasty-tribute-
  2005.md`, `shou/banzhang-lao-cha-tou-2000.md`, `shou/camphor-shou-
  2012.md`, `sheng/xinghai-aged-sheng-2005.md`,
  `shou/bulang-high-end-gushu-shou-2013.md`,
  `shou/golden-bull-hengfengyuan-2009.md`,
  `shou/bulang-banpen-tea-heads-2018.md`, `shou/jingmai-gushu-shou-2009.md`,
  `shou/banzhang-palace-grade-2003.md`,
  `shou/lao-banzhang-best-under-heaven-2012.md`,
  `shou/yiwu-mahei-gushu-shou-2006.md`, `white/yiwu-wild-white-2015.md`.
  "Lao Tong Zhi" (老同志) is not an incidental name: it is the actual,
  well-known flagship brand of Haiwan Tea Factory (海湾茶厂). It is
  plausible the `vendor` field on this whole sample batch was populated
  with the brand Adrian bought under rather than a personal supplier name
  like Lidia/HangJia/Edward. I did **not** add Haiwan Tea Factory / Lao
  Tong Zhi to the CSV on this basis, per the task's explicit rule that the
  `vendor` field is who Adrian bought from, not the producer, and because
  every one of these 17 files has a completely empty prose body, so there
  is nothing beyond the vendor field to corroborate it. Flagging here for
  a human to confirm; if Adrian confirms these 17 samples really are
  Haiwan Tea Factory's Lao Tong Zhi line, that would be an easy CSV
  addition with strong confidence, not a fabrication.
- **Kunming Xiongda** (appears as `vendor` on `shou/naka-gushu.md`,
  `shou/xiniu-tang-gushu.md`, `shou/yiwu-mahei-gushu.md`): reads like a
  trading company name, not a personal name, similar to the Lao Tong Zhi
  case above. Excluded for the same reason: it is only ever in the
  `vendor` field, never in prose, and the task is explicit that vendor is
  not producer.
- **Adrian's own poetic tea names** (Courage/勇气, Wisdom/智慧, True Love/
  真爱, Inspiration/灵感, Universe/宇宙, Galaxy/银河, Miracle Fate/奇缘, Mercy/
  慈悲, Passion/热情, New Rainbow, Old Rainbow, Purple King, etc.): per the
  task brief, these are Adrian's own naming for a lot, not producers.
  Confirmed by reading each one; none of their write-ups name a producer,
  they describe terroir/processing/mood/experience only.
- **Recipe-number-only mentions**: `7572` is captured as a `notable_mark`
  of Menghai Tea Factory since the write-up ties it directly to that
  factory. No other 4-digit puerh recipe numbers (7542, 8582, 8592, 0622,
  7262, 7452) appear anywhere in the 303 files; I grepped for them
  specifically and got zero matches, so I did not invent additional
  recipe-linked producers.
- **Village/mountain names that are origins, not producers**: Banzhang,
  Bulang, Jingmai, Naka, Pasha, Mahei, Xiniu Tang, Yiwu and its named
  micro-origins all describe *where* leaf grew, never *who* made the tea.
  These already live in `data/tea-wisdom-source/origins.csv` per the prior
  wisdom-gap-report pass and were correctly left out of this producer CSV.

## Fields left blank and why

- `founded` is blank for 7 of the 10 rows. Only Menghai Tea Factory (1940)
  and Xiaguan Tea Factory (1941) carry a founding year, and both come from
  the task brief's own worked example rather than something I looked up or
  recalled independently. Wuzhou Tea Factory's 1953 date is the one
  founding year actually stated inside a product write-up
  (`dark/3-cranes-liu-bao-1999.md`). I deliberately did not add a
  remembered year for Kunming Tea Factory, China National Tea Corporation,
  or Tongqinghao even though general tea literature has approximate dates
  for some of these, because the task's "blank beats wrong" rule applies
  most strongly to years I would be recalling rather than reading.
- `region` uses names already present in `src/wisdom/generated/regions.ts`
  where one exists (`Cangwu`, `Dali`, `Wuzhou`, `Xishuangbanna Prefecture`).
  Menghai itself has no standalone row in that file (it only appears
  inside another region's description text), so Menghai Tea Factory is
  filed under the broader `Xishuangbanna Prefecture`, its containing
  prefecture, rather than inventing a new region string.
- `notable_marks` is blank for Xiaguan Tea Factory, Kunming Tea Factory,
  Xinghai Tea Factory, and Tongqinghao because no write-up names a specific
  recipe number, seal, or label tied to that producer (Xiaguan's products
  are described by format, "tuo cha" and "iron cake," which are shapes, not
  marks).

## Files touched

- `data/tea-wisdom-source/producers.csv` (new, 10 rows)
- `docs/_notes/producer-extraction-notes.md` (this file)

No file under `src/wisdom/**`, `scripts/build-wisdom.mjs`, or any component/
admin/page directory was read for the purpose of editing, and none was
edited.
