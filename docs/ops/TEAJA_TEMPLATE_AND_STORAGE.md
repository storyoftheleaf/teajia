# Teajia product template + storage map (write new teas exactly like this)

How a tea is CREATED and CONNECTED into the system so content lives once and is
never forgotten. Verified from schema.sql + the published examples (Liu Bao
"Velvet Earth", "Inward" (1980), Liao Fu 1980).

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

## The template (from published examples) — same structure every tea
Repo file `products/<category>/<slug>.md`:
```yaml
---
productName: "..."          # e.g. "Liu Bao 1990"
givenName: "Velvet Earth"   # shop display name / persona name
chineseName: "六堡茶"
type: Dark                  # Sheng|Shou|Dark|Oolong|Red|White|Green|Teaware
form: Loose Leaf            # Cake|Loose Leaf|Brick|Tuo|Basket|...
year: 1990
origin: "Cangwu, Guangxi, China"   # harvest origin, NOT the trading house
grams: 120
stock: 2100
cost: "500 NT"
vendor: "Edward"
tastingNotes:               # FLAVORS live here (catalog data), never in prose
  - "earthy sweetness"
  - "betel nut"
---
<1-2 line intro: what it factually is, the hook>
## Terroir    # origin, region, elevation, soil, people (factual, AI-OK)
## Processing # leaf type, method (wo dui, basket aging, pressed) (factual, AI-OK)
## Mood       # HUMAN-ONLY. Leave EMPTY for Adrian. Never AI-author.
## Experience # HUMAN-ONLY. Leave EMPTY for Adrian. Never AI-author.
```
The 4-beat recipe maps onto this: intro = classification + one hook; `## Terroir`
= the origin/region beat (incl. "expertly stored in Guangzhou" provenance line, one
line, minor); `## Processing` = the one craft/history thread (basket aging, wo dui,
Malaysia history can go in an early prose line or lore). History like the Malaysia/
diaspora/TCM story belongs in `lore` if used — keep EACH fact in exactly ONE field
(single-source: no duplication across description/lore/terroir, which makes the
storefront repeat 3-4x).

## Field rules (single source, non-negotiable)
| Field | content | AI? |
|---|---|---|
| terroir | origin/region/elevation/land | YES |
| processing_notes | leaf type, method | YES |
| lore | history/cultural context | YES (only if sourced) |
| description | ADRIAN's personal/taster notes ONLY | NO (invisible while empty) |
| mood | felt character phrase | HUMAN-ONLY |
| experience | how it drinks / felt session | HUMAN-ONLY |
| tasting_notes | flavors (malt, camphor, earthy...) | data, separate field |

## MCP write path (make it LIVE + CONNECTED)
Use `update_tea_pricing` (mirrors to tea_profiles + syncs product_listings):
- pass `lore`, `terroir`, `processing_notes`, plus `year`, `origin_country`,
  `origin_region`, `status` as needed.
- `description` stays '' (personal notes space).
- `mood`/`experience` NOT passed (stay empty until Adrian writes them).
- `tasting_notes` accepted (array ≤8) to set the flavor field.
- `clear_fields` ["experience","mood","lore"] to null stale/duplicate content.
- `stock_verified: false` on receipt intake (keeps the needs-verification flag).
Flow: preview (returns confirmation_token) → confirm to commit.

## Verify after write
Public endpoint `/api/s/:slug/products` reflects tea_profiles (single source).
Read it there to confirm About content reached the customer card (get_tea may
not project all About fields).

## Never forgotten
- The durable repo file is the authoring record; update `products/index.md`
  (category + link) too.
- This template lives in the skill reference so every future intake reuses it.
- Mood/Experience are the two fields Adrian fills by hand; do not overwrite.