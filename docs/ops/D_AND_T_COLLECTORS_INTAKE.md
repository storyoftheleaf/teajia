# D & T Collectors intake — Delivery Note No. 4791536 (2026-06-30)

Source / vendor: WeChat merchant 【静趣礼承】｜百年工夫茶颜妙珊 (Jingqu Licheng / Yan
Miaoshan), WeChat ID LCQ-F038, region Guangzhou, Guangdong. Tags Tea/Teasource.
Channel 百年工夫茶陈列室. This is the "D and T Collectors" source. Vendor record
in Teajia = customer `9530d63f-3cb3-433b-9940-b80b8ec1546f` (linked vendor_id on
every product from this lot). All prices CNY. Store: Bali (acc_teajia_bali).

## The writing rules that apply (load teajia-description-craft skill)
- **UNIQUE-HOOK RULE**: ONE distinctive thing per tea, dive deep on why it
  matters, and confirm the hook with Adrian BEFORE writing. Do NOT say a little
  about five things.
- **NO SIZE/WEIGHT CLAIMS** in customer copy: never state grams/weight in prose
  ("100 g", "1 cake"). Weights live in admin stock fields only.
- `description` = Adrian's notes only (invisible while empty). The "what it
  drinks like" character line goes decentralized into lore/terroir/processing.
- No em-dashes, no superlatives, no fabrication, no vendor/shop names in copy,
  provenance is a minor closer line, tastes go to tastingNotes.
- Mood/Experience = human only (left empty for Adrian).

## One-hook-per-tea (Opus strategy) + live product IDs
| Tea | CN | qty/g | CNY | Hook |
|---|---|---|---|---|
| 2004 Yiwu Raw Puerh `e949b585-5f07-411b-82fb-7da7355edc77` | 2004年易武生普 | Cake 357g | 700 | the micro-origin (Yiwu, Six Famous Tea Mountains) + position on the sheng age arc (~20 yrs, brisk→quiet/woody) |
| 1990 Ripe Puerh Brick `28436463-2272-4f68-83e1-b6d86f798be2` | 1990年砖熟普 | Brick 450g | 800 | the FORM: pressed as a brick it ages densely and slowly (vs loose/cake shou); **a little more strength than the average ripe puerh, firmer body from how it was processed** (Adrian-verified 2026-08-31); era marker 1990, 30+ yrs |
| 1990 Bamboo Leaf Old Tea (liubao) `7400ece7-a8ed-4328-b462-ac18178b9dfa` | 1990年竹叶老茶 | Loose 100g | 360 | **MORE AGED than other 1990s liu bao** (Adrian-verified); cause NOT stated (location/heat unknown — do NOT claim humid/AC/Guangzhou storage) |

## The liubao differentiator — CAUSE UNKNOWN (do NOT re-invent)
Adrian-verified 2026-08-31: the 1990 Bamboo Leaf liubao is "a bit more aged than
others of the 90s." That is the honest copy hook — the fact, never the reason.
NOT a warm/humid Guangzhou storehouse, NOT air-conditioned aging, NOT "years in
Guangzhou". The lot was ACQUIRED through the Guangzhou tea trade; how long it sat
there and where it aged "a little faster" are unknown. Live processing_notes
close: "This one has aged further than other 1990s liu bao, carrying more
development than its decade usually shows. It comes to us from the Guangzhou tea
trade."

## The two non-store teas → personal collection (wired 2026-08-31)
- 1990 Pre-Qingming Tea `55606539-3eef-4b33-a52b-df3c87e38523` — Draft,
  vendor-linked, personal collection (is_personal=1, hidden from shop), type
  UNKNOWN (do not fabricate). Not written about, not in repo products/.
- 1990 Old Tea Stem Loose `e01c590b-b8b4-4d44-93b2-3ecde1161e13` — Draft,
  vendor-linked, personal collection, type UNKNOWN. Not written about.

## Storage / source wiring notes
- MCP `create_tea` stores `vendor` as TEXT only; it does NOT set
  `products.vendor_id`. To link the source in the app: `upsert_vendor_contact`
  (create customer tagged vendor) + `link_vendor_products` (sets vendor_id).
  Both tools live on the worker MCP but often NOT in the session catalog — use
  the direct worker-MCP curl/urllib path (teajia-description-craft skill ref
  `about-content-push-curl.md`).
- `set_tea_visibility(personal=true, shown_in_shop=false)` moves a tea to the
  owner's personal collection (is_personal=1, hidden, record stays live).
- Repo files: `products/sheng/2004-yiwu-raw-puerh.md`,
  `products/shou/1990-ripe-puerh-brick.md`, `products/dark/1990-bamboo-leaf-old-tea.md`.
  About content pushed live via `update_tea_pricing` (lore/terroir/processing),
  verified on `/api/s/teajia-bali/products` (130 visible products; the 2
  personal teas absent).
