# Tea Wisdom composed entries for every tea

Status: plan only, not started (Adrian, 2026-11-24). Builds on [tea-wisdom-composed-entry.md](tea-wisdom-composed-entry.md), where the ripe pu'er pilot is live for eight teas.

## Goal

Every tea in the shop, now and later, gets one composed entry: written in the house voice from its record and approved Wisdom, linked into Wisdom, approved by Adrian before it shows. Not only the teas listed today, but every type the shop knows: Green, White, Yellow, Oolong, Red, Dark, Sheng, Shou, Herbal (`TEA_TYPES` in `src/wisdom/vocabulary.ts`).

## What already exists

- The composer (`scripts/tea-wisdom-compose/compose.mjs`, `src/wisdom/compose/composeInputs.ts`): Opus writes the story, Opus checks it, mechanical checks refuse dashes, superlatives, taste words in the story, unsupplied links and unknown numbers. It knows only ripe pu'er today (`TYPE_PAGE`, the `shou:` section keys, the "ripe pu'er" style names).
- The approval gate (`scripts/tea-wisdom-compose/entries-cli.mjs`, `generatedEntries.ts`): an entry goes live only when every claim it uses is approved and unchanged.
- The ripe pu'er kit: twelve approved sections in `data/tea-reference/pages/shou.md`, the model for every other kit.
- Named-tea history pages built on main by the integration work (Y562, San He Liu Bao, Malaysian Returned Liu Bao, Mahei Gushu Red, Nanqiao Ruigong Brick). On a confirmed named tea the composed entry is skipped today so that history leads.

## The layer stack, extended

Lot (Adrian's record and voice notes) > named tea or maker > grade > place > style > age > type, then brewing and what people often notice. New: a **style** layer between type and place, for the styles inside a type: Liu Bao and Fu brick inside Dark; Yancha, Dan Cong and Tieguanyin inside Oolong; Dian Hong inside Red; and so on.

## The kit template

Every type kit, and every style kit, has the same sections, each saying why and not only what (the contract rule of 2026-11-23):

1. What it is, and why it exists.
2. How it is made, with the reason for each step.
3. How the practice came to be, in eras where the trade knows them.
4. Age bands, only for teas that age (dark, sheng, shou, some oolong and white): young, settling, aged, with the band edges right for that type.
5. Brewing, with the reasons, plus one line per form (pressed, loose, rolled).
6. What people often notice in the style, young and aged where that differs.

A style kit adds only what differs from its type.

## Steps

1. **Count the stock by type and style.** Done 2026-11-24: 223 teas, see [Stock count](#stock-count). Read the full inventory, private teas included, through the Teajia shop connection (its token is rejected today; Adrian reconnects it). Output: a table of how many teas each kit would unlock. The public shop alone shows 21 teas: 13 ripe, 5 Liu Bao, 1 raw pu'er, 1 red.
2. **One writer for every type.** Replace the ripe-only lookups in `composeInputs.ts` with a type and style lookup from the Wisdom pages; take the style names and age-band edges from each kit's page; keep every check. Add a style layer. About half a day.
3. **Named teas feed the entry instead of being skipped.** Agree with the integration owner how a confirmed named tea's sourced history becomes the entry's lead layer, so Y562 and the other named teas get an entry that carries their history. A design call to settle before building.
4. **A kit factory.** For each kit, in order of teas unlocked: a research prompt (Claude reads the open Chinese trade sites; Hermes reads Zhihu, Baidu Baike and Xiaohongshu, which block Claude), notes saved in the vault under `Teajia/Research/tea-wisdom/`, the drafted sections, and an approval page like the ripe kit's. About 1 to 2 hours of research per kit, then Adrian's approval.
5. **Compose in batches.** After each kit is approved, the composer drafts every tea it unlocks; Claude reads each draft; clean ones are approved, the rest are held with a reason; one push per batch.
6. **Corrections (phase 4 of the pilot plan).** When a kit section changes, every entry that used it is flagged and a fresh draft waits beside the live one.
7. **Intake (phase 5).** A grade field on the tea record; when a tea moves from Curate to the shop, its entry is drafted and lands in Adrian's approval list, so new teas never wait for a batch.

## What success looks like

Each can be checked by looking, or by one command:

1. **Every tea has an entry.** On teajia.com, every tea's product page shows one written entry (story, brewing, what people often notice), not stacked Wisdom blocks. Check: the count of approved entries in `src/wisdom/reference/generatedEntries.ts` equals the count of public teas, less the ones held with a written reason.
2. **No tea waits for a batch.** A tea moved from Curate to the shop has a draft in Adrian's approval list the same day.
3. **Every link goes somewhere worth going.** Each underlined term opens a Wisdom page with more than the sentence it came from, at the right section. Check: every link on a product page lands on a page with two or more sections.
4. **Nothing is invented.** Every sentence rests on the tea's record or an approved claim. Check: each draft passes both checks, and Adrian approves without rewriting.
5. **One fix reaches every tea.** Correcting a kit section flags every entry that used it and puts a fresh draft beside it. Check: edit one section in the practice shop; the affected entries show the flag.
6. **Thin teas still read well.** A tea with only a name, year and type gets a full, true entry from its type, style and age. Check: Adrian reads three thin entries and is happy with them.

## How to run each step

- **Count the stock (step 1).** Reconnect the Teajia shop connection, then read every tea's type, style, year and origin, and write the counts into this file.
- **Writer for every type (step 2).** In `src/wisdom/compose/composeInputs.ts`, replace `TYPE_PAGE` and the `shou:` keys with a lookup of the type and style pages and their section keys. Run `npx vitest run src/wisdom/compose` and `node --test scripts/tea-wisdom-compose/tests/*.test.mjs`.
- **A kit (step 4).** Write the research prompt into the vault (`Teajia/Research/tea-wisdom/<kit>.md`), run it through Claude and Hermes, and draft the sections into `data/tea-reference/pages/<kit>.md`, each saying why. Build `npm run tea-reference:pages`, publish an approval page like the ripe kit's, then on Adrian's word run `node scripts/tea-reference-markdown/claims-cli.mjs approve <page>:<section> --reason "…" --scope "…"` for each section.
- **Compose a batch (step 5).** Fetch the product list once (`curl https://www.teajia.com/api/products/public`). Run `node scripts/tea-wisdom-compose/compose.mjs --products <file> --type <type>`; the claude CLI must be signed in on the Claude plan, not API billing. Read each draft at `/preview/wisdom-pilot/drafts/<id>` in `npm run practice`, run `npm run tea-wisdom:entries:approve <id>` for the clean ones, then the checks and `test:mobile`, then push once.
- **Corrections and intake (steps 6 and 7).** Follow phases 4 and 5 of [tea-wisdom-composed-entry.md](tea-wisdom-composed-entry.md).

## Stock count

Read on 2026-11-24 straight from the shop database, one read-only query of 351 rows. The shop connection was paused by the shared-allowance guard that day, and Adrian approved the direct read. It covers every tea on the main shop account (`acc_teajia_bali`), private, draft, sold-out and archived ones included. Teaware, Misc, three TEST ONLY rows and eight rows on test accounts are left out. That leaves **223 teas, of which 21 are public** (public means `is_public`, `shown_in_shop`, and Active or Sold Out). Each style comes from the record's origin, Chinese name and processing notes, never from the English name alone. "Sheng Puer" and "Shou Puer" are counted as Sheng and Shou. Nothing in the shop was changed.

Each tea needs its type kit, then its style kit if it has one, so a type kit always comes before its styles. "Aged" means 15 years or older by the record's year.

| Order | Kit | Teas it unlocks | Public now | Notes |
|---|---|---|---|---|
| done | Shou (type) | 49 | 14 | Built. 8 approved; 41 waiting to be composed (2 have named-tea pages: Y562, Nanqiao Ruigong) |
| 1 | Sheng (type, with age bands) | 48 | 1 | 36 aged, 2 young, 10 with no year. `sheng.md` already exists and is sourced |
| 2 | Oolong (type) | 40 | 0 | Every oolong also needs its style kit below |
| 3 | Dark (type) | 23 | 5 | 16 aged |
| 4 | Red (type) | 20 | 1 | |
| 5 | Taiwan oolong (style) | 15 | 0 | High mountain, Dong Ding, Nantou roasted, Beipu, palace grade; 10 aged |
| 6 | White (type) | 13 | 0 | |
| 7 | Liu Bao (style, Dark) | 11 | 5 | All aged; 2 have named-tea pages (San He, Malaysian Returned). The only style kit that unlocks public teas |
| 8 | Yancha (style, Oolong) | 9 | 0 | Rougui, Da Hong Pao, Meizhan |
| 9 | Yunnan white (style) | 9 | 0 | Includes one Yabao (wild buds) |
| 10 | Taiwan red (style) | 8 | 0 | 4 from Yuchi, Sun Moon Lake, 1977 to 1981 |
| 11 | Anhua dark (style) | 8 | 0 | Huangye, graded leaf, Gongjian, one Bai Liang roll. No Fu brick in stock |
| 12 | Tieguanyin (style) | 7 | 0 | 6 from Anxi, 1 from Muzha, Taiwan |
| 13 | Dian Hong, Yunnan red (style) | 7 | 1 | Mahei Gushu Red has a named-tea page |
| 14 | Lapsang and Wuyi red (style) | 5 | 0 | Two from 1920 and 1934 |
| 15 | Green (type) | 4 | 0 | 3 aged (two pre-war Japanese, one 1950 Taiwanese) |
| 16 | Purple leaf sheng (style) | 4 | 0 | |
| 17 | Dan Cong (style) | 4 | 0 | |
| 18 | Fujian white (style) | 4 | 0 | Fuding and Zhenghe |
| 19 | GABA oolong (style) | 3 | 0 | 4 more are named GABA but have no notes (see below) |
| 20 | Small kits, 1 or 2 teas each | 10 | 0 | Liu An 2, Oriental Beauty 2, Japanese steamed green 2, citrus-aged 2 (one Xiao Qing Gan, one Taiwan sour citrus), Sichuan Kang brick 1, Chinese pan-fired green 1 |
| none | Yellow, Herbal | 0 | 0 | No stock |

**26 teas wait on their records**, not on a kit, and are not counted in the type rows above:

- 7 pu'er filed as Dark: five Liao Fu loose lots from northern Vietnam, the 1998 Menghai Jia Ji Tuo and the Yiwu Mushroom. Their notes say pu'er. Moving them to Sheng or Shou lets them use those kits.
- 2 red filed as Green: the two Qing Mao Hong Cha, whose notes say red tea.
- 17 thin or mistyped: no processing notes, and the name points to another type or says nothing. Examples: "oolong", "te quan yin", "Phoenix Mountain" and "High Mountain" are filed as Dark; also "cvb", "red bag", Universe, Orange Master Box, four GABA-named teas, Shenhua Native Red and the 1990 Pre-Qingming green.

Approved composed entries today: 8, all Shou. Named-tea Wisdom pages tied to a tea: 5 (Y562, Nanqiao Ruigong, San He Liu Bao, Malaysian Returned Liu Bao, Mahei Gushu Red).

## Held from the pilot

Y562, Naka, Yiwu Gushu, Ripe Puerh Brick and Pasha (reasons in the pilot plan, "Where it stands").

## Needs Adrian

- Fix the 26 tea records listed under Stock count (type or processing notes), so they can be composed.
- Approve each kit on its page, and each batch of entries.
- Settle step 3 with the integration owner.
