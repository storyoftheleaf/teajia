# About-This-Tea push to tea_profiles — READY-TO-FIRE handoff

Use a FRESH session on the teajia profile, where `mcp__teajia__update_tea_pricing`
surfaces (this session's catalog only had the i64os wrappers, which are
commerce-only — no About-content tool). Each call: preview first (returns
`confirmation_token`), then re-issue with confirm to commit. Then verify on the
public endpoint /api/s/:slug/products (reflects tea_profiles, the single source).

Pass `stock_verified: false` wherever supported so all 7 keep the
"needs verification" flag (receipt stock). DO NOT set mood/experience (human-only).
DO NOT put anything in `description` (Adrian's personal-notes space, invisible).

## Per-tea calls (product_id, slug, and copy from the repo file)

### 1. Malaysian Returned Liu Bao — id 9b5b05f1-a6d6-4651-9126-0fe42c5c5e86
update_tea_pricing:
- origin_country: "China", origin_region: "Guangxi", year: "1990s"
- terroir: "Guangxi province, southern China, where liu bao production is
  centered in the Cangwu and Wuzhou area along the Xijiang river system. The
  warm, humid climate and red acidic soil support the microbial cultures that
  define this tea."
- processing_notes: "Post-fermented liu bao made through wo dui pile
  fermentation, then packed loose into bamboo baskets lined with bamboo leaves.
  The bamboo lining becomes a micro-environment that slowly flavors the tea over
  decades. This lot aged for years in the humid warehouses of Southeast Asia
  before returning to Guangzhou, where it was expertly stored."

### 2. San He Liu Bao — id b11a8bad-89d9-4518-9406-25145d4c6e2c
update_tea_pricing:
- origin_country: "China", origin_region: "Wuzhou, Guangxi", year: "1990s"
- terroir: "Wuzhou city in Guangxi province, where the factory sits along the
  Xijiang river. The region's subtropical heat and humidity support the slow
  post-fermentation that liu bao requires."
- processing_notes: "Factory-processed liu bao with wo dui pile fermentation,
  then aged in basket form. Factory work at this level runs cleaner and more
  refined than village production. This 1990s lot was expertly stored in
  Guangzhou."

### 3. Large Basket Liu Bao — id a3e29766-eaa5-49c1-9ac7-15fc9d0fe3d2
update_tea_pricing:
- origin_country: "China", origin_region: "Guangxi", year: "1990s"
- terroir: "Guangxi province, southern China, centered in the Cangwu and Wuzhou
  area along the Xijiang river system, where the warm humid climate and microbial
  environment define liu bao's character."
- processing_notes: "Wo dui fermented liu bao, then packed loose into a large
  bamboo basket lined with bamboo leaves for long aging. The bamboo lining
  becomes the micro-environment, slowly flavoring the tea over decades in a way
  cedar or camphor storage cannot. This 1990s lot was expertly stored in
  Guangzhou."

### 4. Ripe Puerh Loose — id 6876236c-bcc5-49d8-b918-5c5db02ca2a5
update_tea_pricing:
- origin_country: "China", origin_region: "Yunnan", year: "1990s"
- terroir: "Yunnan province, southern China, the historical heart of puerh
  production."
- processing_notes: "Wo dui fermented shou puerh from the 1990s, pressed-free
  and kept loose. Loose shou skips the press, so time works on it differently:
  more air, no compression, a quieter path than a cake takes. This lot was
  expertly stored in Guangzhou."

### 5. Small Basket Liu Bao — id 4b25399d-e6a7-437e-a7ee-034017ea1614
HK-AGED. NEVER moldy; frame as beneficial proper humid aging.
update_tea_pricing:
- origin_country: "China", origin_region: "Guangxi", year: "1990s"
- terroir: "Guangxi province, southern China, centered in the Cangwu and Wuzhou
  area along the Xijiang river system, where the subtropical climate and
  microbial environment define liu bao's character."
- processing_notes: "Wo dui fermented liu bao, packed into a small bamboo basket
  lined with bamboo leaves. This one carries the character of Hong Kong aging
  done properly, the kind of slow humid transformation that Southeast Asian
  warehouses have brought to liu bao for generations, adding depth and
  complexity you cannot get in a dry room. Expertly stored in Guangzhou."

### 6. Huangpian Ripe — id 997225e0-c2b5-4769-b869-e9a635462462
update_tea_pricing:
- origin_country: "China", origin_region: "Yunnan", year: "1990s"
- terroir: "Yunnan province, southern China, the historical heart of puerh
  production."
- processing_notes: "Wo dui fermented shou puerh made from huangpian, the older,
  more mature leaves set aside during sorting. Once discarded, the trade came
  around: the same leaves are now valued for a rounder, sweeter body. Expertly
  stored in Guangzhou."

### 7. Yuandu Sheng — id 721bd8f9-a211-4830-8f10-cdd855e639ce
HK-AGED (80s). Do NOT interpret the seller's term 原度; do not invent a
translation. Lean on the age.
update_tea_pricing:
- origin_country: "China", origin_region: "Yunnan", year: "1980s"
- terroir: "Yunnan province, southern China, the historical heart of puerh
  production."
- processing_notes: "Raw sheng puerh from the 1980s. Sheng at this age moves
  quietly, the edges of youth long gone. Carries the mellowed character of
  proper humid aging in a tropical place. Expertly stored in Guangzhou."

## After each: verify
- get_tea / search shows status Active, stock correct.
- Public endpoint /api/s/:slug/products returns terroir/processing_notes (single
  source from tea_profiles). Slugs: malaysian-returned-liu-bao, san-he-liu-bao,
  large-basket-liu-bao, ripe-puerh-loose-1990s, small-basket-liu-bao,
  huangpian-ripe, yuandu-sheng.
- Mood/Experience remain empty (human-only) — confirm they are not set.
- Stock_verified remains false (needs-verification flag present).

## Done criteria
All 7 show About content live from tea_profiles, Mood/Experience empty, stock
unverified flag set, repo files + GitHub main already pushed (commit cc436bc8).

## PERSONAL-COLLECTION FILING (2026-08-31)
Adrian: the 3 receipt-2 teas stay in PERSONAL, NOT the shop:
- Small Basket Liu Bao 4b25399d-e6a7-437e-a7ee-034017ea1614
- Huangpian Ripe 997225e0-c2b5-4769-b869-e9a635462462
- Yuandu Sheng 721bd8f9-a211-4830-8f10-cdd855e639ce
DONE 2026-08-31: all 3 marked personal via set_tea_visibility(personal=true).
Each committed with personal_collection:true (is_personal=1,
inventory_purpose='personal', is_public=0), shown_in_shop=false. Verified present
+ Active in inventory. They stay out of the shop / in the owner's personal
collection, correct source confirmed.

## PRICING BUG — MUST FIX (caught 2026-08-31, Adrian)
~~Still open.~~ FIXED + SHIPPED 2026-08-31. Two commits on main:
- 8fe661bc — canonicalCurrency() read-side alias resolution in addPricingFields
- 2d6db2ee — ROOT FIX: moved canonicalCurrency() into teaMasterSales (shared by
  index.ts + mcp.ts); mcp.ts create_tea now STORES the canonical 'Yuan' key at
  write time instead of blindly toUpperCase -> 'CNY'. Future creates store right.
FIX: added canonicalCurrency() alias map (CNY/RMB/renminbi/¥ → 'Yuan') in
worker/src/index.ts, used by addPricingFields. Every pricing path (admin
handleGetProducts, public fetchPublicProductsForAccount, single-product) now
resolves cost_currency aliases to the live 'Yuan' rate instead of the silent
`?? 1` USD fallback.

LIVE RATE NOTE (2026-08-31): the deployed system already refreshes exchange
rates daily via syncLiveExchangeRates() (open.er-api.com, hourly cron gated to
24h). Live /api/rates shows Yuan = 6.745925 (updated 2026-08-30 05:00).
The 7.2 in worker/schema.sql is only the SEED default — the sync overrides it.
Pricing uses the live rate. The earlier hand-computed table used 7.2 (stale);
use the live-rate numbers below.

Correct retail at the LIVE rate (6.746, ×3):
| Tea | cost_amount | stock_g | correct retail/50g |
|---|---|---|---|
| Malaysian Returned Liu Bao 9b5b05f1 | 960 | 600 | ~$35.6 |
| San He Liu Bao b11a8bad | 460 | 600 | ~$17.1 |
| Large Basket Liu Bao a3e29766 | 385 | 550 | ~$15.6 |
| Ripe Puerh Loose 6876236c | 400 | 1000 | ~$8.9 |
| Small Basket Liu Bao 4b25399d | 200 | 50 | ~$83 |
| Huangpian Ripe 997225e0 | 20 | 50 | ~$8 |
| Yuandu Sheng 721bd8f9 | 180 | 50 | ~$75 |

Verify on public endpoint after fix: price shows ÷7.2, not ÷1.

## STATUS: COMPLETE (2026-08-30)
All 7 About pushes committed via update_tea_pricing (preview→confirm).
Verified on public endpoint /api/s/teajia-bali/products:
- terroir + processing_notes set on all 7
- origin_country='China', origin_region set per tea
- year preserved as stored ('1990s'/'1980s' string) — do NOT force to number;
  Adrian confirmed approximate decade strings are fine
- mood/experience None (human-only, correctly left empty)
- stock_verified_at None (needs-verification flag kept), status Active
get_tea does NOT return About fields (inventory-only); verify About on the public
shop endpoint /api/s/:slug/products (reads tea_profiles). The teajia MCP server is
configured in profile config; if its tools aren't in your session catalog, call the
worker MCP endpoint directly via curl (tools/list to confirm, tools/call with
preview then confirm token).