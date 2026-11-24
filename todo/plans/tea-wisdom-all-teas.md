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

1. **Count the stock by type and style.** Read the full inventory, private teas included, through the Teajia shop connection (its token is rejected today; Adrian reconnects it). Output: a table of how many teas each kit would unlock. The public shop alone shows 21 teas: 13 ripe, 5 Liu Bao, 1 raw pu'er, 1 red.
2. **One writer for every type.** Replace the ripe-only lookups in `composeInputs.ts` with a type and style lookup from the Wisdom pages; take the style names and age-band edges from each kit's page; keep every check. Add a style layer. About half a day.
3. **Named teas feed the entry instead of being skipped.** Agree with the integration owner how a confirmed named tea's sourced history becomes the entry's lead layer, so Y562 and the other named teas get an entry that carries their history. A design call to settle before building.
4. **A kit factory.** For each kit, in order of teas unlocked: a research prompt (Claude reads the open Chinese trade sites; Hermes reads Zhihu, Baidu Baike and Xiaohongshu, which block Claude), notes saved in the vault under `Teajia/Research/tea-wisdom/`, the drafted sections, and an approval page like the ripe kit's. About 1 to 2 hours of research per kit, then Adrian's approval.
5. **Compose in batches.** After each kit is approved, the composer drafts every tea it unlocks; Claude reads each draft; clean ones are approved, the rest are held with a reason; one push per batch.
6. **Corrections (phase 4 of the pilot plan).** When a kit section changes, every entry that used it is flagged and a fresh draft waits beside the live one.
7. **Intake (phase 5).** A grade field on the tea record; when a tea moves from Curate to the shop, its entry is drafted and lands in Adrian's approval list, so new teas never wait for a batch.

## First kits, from the public shop

| Kit | Teas it unlocks today | Notes |
|---|---|---|
| Liu Bao (style, inside Dark) | 5 | all 1990s aged Guangxi tea; basket ageing, what "Malaysian returned" means; two have named-tea pages |
| Raw pu'er age bands (Sheng) | 1 | `sheng.md` exists and is sourced; raw ages very differently from ripe |
| Red (type) | 1 | Mahei Gushu Red, 2025; has a named-tea page |

The order after these comes from step 1.

## Held from the pilot

Y562, Naka, Yiwu Gushu, Ripe Puerh Brick and Pasha (reasons in the pilot plan, "Where it stands").

## Needs Adrian

- Reconnect the Teajia shop connection so step 1 can read the full stock.
- Approve each kit on its page, and each batch of entries.
- Settle step 3 with the integration owner.
