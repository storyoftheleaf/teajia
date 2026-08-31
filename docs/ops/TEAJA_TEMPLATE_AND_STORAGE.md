# Teajia product template + storage map — SINGLE SOURCE (write new teas exactly like this)

> **This is the ONE canonical template.** It lives in the repo so every Teajia
> session on every machine reads the same truth. The skill
> (`teajia-store-intake` → `references/template-and-storage.md`) is only a
> pointer back here — if you see content drift, this file wins.
> Live worked examples: `products/dark/aged-liu-bao-tea.md`,
> `products/shou/aged-ripe-pu-erh-tea.md`,
> `products/shou/aged-northern-vietnam-ripe-pu-erh-tea.md` (Huang Wei intake,
> 2026-08-31).

How a tea is CREATED and CONNECTED into the system so content lives once and is
never forgotten. Verified from schema.sql + the published examples (Liu Bao
"Velvet Earth", "Inward" (1980), Liao Fu 1980, Huang Wei 3-tea intake).

## The END-TO-END shape of one tea
1. **Durable repo file** (one-file-per-entity): `products/<category>/<slug>.md`
   = YAML frontmatter + body copy. The permanent human/authoring record.
2. **`products` DB row** (account-scoped): carries identity, stock, cost, status,
   vendor, slug. Also carries the About columns (description/lore/terroir/
   processing_notes/mood/experience/tasting_notes).
3. **`tea_profiles` row** (the T reference / single source): canonical About
   content. `slug UNIQUE`. Same About fields. THE source the storefront reads.
4. **`product_listings` row**: links `account_id → profile_id`, and holds the
   per-listing commerce fields (stock_grams, cost_amount, fixed_retail_price,
   status draft|active|archived, legacy_product_id, photos, vendor).
Public read path: product JOIN tea_profiles (`tp.id = 'prof_' || p.id`),
COALESCE About fields from the profile. So About content MUST be written to
tea_profiles (via the worker's `update_tea_pricing` mirror), not only products.

## The template — same structure every tea
Repo file `products/<category>/<slug>.md`:
```yaml
---
productName: "Aged Liu Bao Tea"   # English display name FIRST (Adrian's pref)
chineseName: "陈年六堡茶"         # Chinese name goes HERE, not in display/prose
type: Dark                  # Sheng|Shou|Dark|Oolong|Red|White|Green|Teaware
form: Loose Leaf            # Cake|Loose Leaf|Brick|Tuo|Basket|...
year: null                  # ONLY a verified year/decade; null if unknown (R9)
origin: "Guangxi, China"    # harvest origin, NOT the trading house
grams: 500
stock: 500
cost: "380 CNY"             # actual paid currency (CNY, NT, MYR, ...)
vendor: "Huang Wei"
tastingNotes:               # FLAVORS live here (catalog data), never in prose
  - "earthy"
  - "woody"
---
<1-2 line intro: what it factually is, the hook>
## Terroir    # origin, region, elevation, soil, people (factual, AI-OK)
## Processing # leaf type, method (wo dui, basket aging, pressed) (factual, AI-OK)
## Mood       # HUMAN-ONLY. Leave EMPTY for Adrian. Never AI-author.
## Experience # HUMAN-ONLY. Leave EMPTY for Adrian. Never AI-author.
```
The 4-beat recipe maps onto this: intro = classification + one hook; `## Terroir`
= the origin/region beat; `## Processing` = the one craft/history thread; history
(diaspora, TCM, trade) belongs in `lore` if used. Keep EACH fact in exactly ONE
field (single-source: no duplication across description/lore/terroir, which makes
the storefront repeat 3-4x).

## Field rules (single source, non-negotiable)
| Field | content | AI? |
|---|---|---|
| terroir | origin/region/elevation/land | YES |
| processing_notes | leaf type, method | YES |
| lore | history/cultural context | YES (only if sourced) |
| description | ADRIAN's personal/taster notes ONLY | NO (invisible while empty) |
| mood | felt character phrase | HUMAN-ONLY |
| experience | how it drinks / felt session | HUMAN-ONLY |
| tasting_notes | flavors (mineral, woody, earthy...) | data, separate field |

## Hard copy rules (Adrian's corrections — apply to EVERY tea)
- **NO perception words** (gentle, quiet, mellow, sweet, soft): they are human
  perceptions, AI must not write them. Objective character words ARE fine:
  mineral, woody, dark smooth, earthy, thick. Adrian's spec for aged shou
  puerh tasting_notes: mineral, forest wood (woody), dark smooth (smooth).
- **`description` is NEVER written by AI** — it is Adrian's personal-notes
  space (renders as "Adrian's notes", invisible while empty). Customer-facing
  "what it is as a drink" goes in terroir/processing_notes.
- **No fabrication** (R9): no invented pressing, harvest year, producer,
  cultivar, mountain, or storage claim. If unconfirmed, omit. Storage history
  unknown → stay neutral ("comes to us from the Guangzhou tea trade"), never
  "wet storage"/"humid storehouse"/"mold".
- **NO em-dashes (—) anywhere, ever.** Terse, plain, educational, short
  sentences. No superlatives or hype.
- **Flavors never in prose** — only in `tasting_notes`.
- **Never name the specific shop/vendor in customer copy** — the seller is
  never the story; region/trade-hub references are fine.
- **Mood/Experience are human-only** — always left empty for Adrian.

## MCP write path (make it LIVE + CONNECTED)
Use `update_tea_pricing` (mirrors to tea_profiles + syncs product_listings).
TWO-STEP preview→confirm; **re-send FULL args with the `confirm` token** (a
confirm-only call errors "At least one of ... is required"). Tokens expire
~300s.
- pass `lore`, `terroir`, `processing_notes`, plus `year`, `origin_country`,
  `origin_region`, `status` as needed.
- `description` stays '' (personal notes space). `mood`/`experience` NOT passed.
- `tasting_notes` accepted (array ≤8) to set the flavor field.
- `stock_verified: false` on receipt intake (keeps the needs-verification flag;
  stock count IS real, the flag is just notation — sell from the recorded count).

## Publish an intake-created tea (end-to-end, operator-only, no owner auth)
Intake finalize creates Draft products with `is_public=0` (never auto-publish).
Public shop needs `is_public=1 AND shown_in_shop=1 AND status='Active'`:
1. `update_tea_pricing(product_id, status='Active')` — if not already Active.
2. `set_tea_visibility(product_id, shown_in_shop=true, is_public=true)` — the
   `is_public` flag (added 2026-08-31, commit 2aa61ab6) is what lets the
   operator publish without owner-tier REST auth.
3. VERIFY on the public endpoint `GET /api/s/teajia-bali/products` (browser UA).
   Do NOT trust `get_tea` for publication state (it hides shown_in_shop/is_public).
Un-publish: `set_tea_visibility(product_id, shown_in_shop=false)`.
Mark personal (off shop): `set_tea_visibility(product_id, shown_in_shop=false,
personal=true)`.

## Vendor wiring (source of tea must persist)
- Vendors are `customers` rows tagged "vendor". `create_tea`/finalize may leave
  `vendor_id` NULL — always wire it:
  `upsert_vendor_contact` (name + wechat etc.) → `link_vendor_products(customer_id,
  product_ids)`.
- Before finalize with stock-bearing items: set the group vendor with
  `intake_set_group_vendor(import_id, group_id, vendor_customer_id)` or finalize
  fails "Choose a vendor for this group".
- WeChat has NO `wechat` column on live `customers` — store in `contacts` JSON:
  `[{"type":"wechat","value":"Weee36"}]` (upsert_vendor_contact does this).
- Clean up duplicates/abandoned vendors with `remove_vendor_contact(customer_id)`
  (guarded; refuses if still referenced).

## Verify after write
Public endpoint `/api/s/:slug/products` reflects tea_profiles (single source).
Read it there to confirm About content reached the customer card (get_tea may
not project all About fields).

## Never forgotten
- The durable repo file is the authoring record; update `products/index.md`
  (category + link) too.
- Mood/Experience are the two fields Adrian fills by hand; do not overwrite.
- This template is the single source; the skill only points here.
- Receipt math: cost = unit price × units bought; quantity = units × grams/unit;
  per-500g (jin) convention on aged-tea receipts; the AMOUNT column is the real
  cost (handwritten arithmetic is unreliable).
