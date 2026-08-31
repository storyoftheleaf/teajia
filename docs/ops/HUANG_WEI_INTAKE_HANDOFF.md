# Huang Wei Intake — 3 teas, Bali (2026-08-31)

Vendor: **Huang Wei (黄伟)** — WeChat `Weee36`, Guangzhou, Guangdong, China.
Tea merchant (WeChat profile). Operator vendor id
`0e3a7a3e-7218-4231-b05e-8c31f01bc7b9` (WeChat stored in `contacts` JSON, not a
`wechat` column — that column does not exist on the live `customers` table).

Source: 3-line price list (per-500g), all CNY, Bali store.

## The 3 products (all LIVE on the public Bali shop, verified 2026-08-31)

| Tea | Qty | Unit ¥ | Line ¥ | Stock | Product id | Status |
|---|---|---|---|---|---|---|
| 陈年六堡茶 Aged Liu Bao Tea | 1×500g | 380 | 380 | 500g | `2ec4bcf5-1773-453c-b710-5b859203cb4e` | Active + shop |
| 陈年旧熟普 Aged Ripe Pu-erh Tea | 2×500g | 400 | 800 | 1kg | `d8b6bcc0-e5d1-4ed1-8cab-67b3bd62d0dc` | Active + shop |
| 北越旧熟普 Aged Northern Vietnam Ripe Pu-erh Tea | 4×500g | 280 | 1120 | 2kg | `bb692acb-b4a0-4114-afa8-c9644140eb5f` | Active + shop |

Total 2300 CNY. Retail per gram (live rate ~6.74, ×3): Liu Bao $0.34, Ripe $0.36,
N. Vietnam $0.25. Shipping 10/kg folded into cost. Stock needs-verification
(`stock_verified_at` NULL per receipt-intake rule).

## Intake record
- Draft `150bfe7b-6686-47fc-9433-76759f08b132` finalized (review_state
  `completed`, 2026-08-31 06:02 UTC). All items `inventoryPurpose=working`,
  identity new, one receipt linked, vendor group resolved to Huang Wei.
- About copy: terroir/processing/lore pushed to tea_profiles via
  `update_tea_pricing`; `description` EMPTY (Adrian's-notes-only field, never
  write marketing copy there). Mood/Experience empty (human-only).
- Tasting notes (canonical taxonomy ids): Liu Bao `earthy, woody`; both puerhs
  `mineral, woody, smooth`. NO perception words (gentle/quiet/mellow/sweet are
  human-only — Adrian's hard rule, AI must not write them).
- N. Vietnam card differentiated on its real thread: Ha Giang/Lao Cai highlands
  on the Yunnan mountain system, old-growth assamica (Shan Tuyet / snow tea,
  700-2800m), HK/Guangzhou border-leaf trade. Verified facts only.

## Repo files
- `products/dark/aged-liu-bao-tea.md`
- `products/shou/aged-ripe-pu-erh-tea.md`
- `products/shou/aged-northern-vietnam-ripe-pu-erh-tea.md`
- `products/index.md` updated.

## Worker tooling built this session (root fixes, all deployed)
- `intake_set_group_vendor` (81510678) — operator resolves curate vendor groups.
- `set_tea_visibility(is_public=true)` (2aa61ab6) — operator publishes intake
  teas to the public shop (is_public=1) without owner-tier REST auth. ROOT FIX.
- `remove_vendor_contact` (d05ad175) — operator deletes duplicate/abandoned
  vendor rows, guarded against references.
- Duplicate Huang Wei row (`e6a2ad35...`) removed after consolidation; only the
  linked `0e3a7a3e` remains.

## Next-session pointers
- Full recipes: skill `teajia-store-intake` (R10-R15) and
  `teajia-site-ops` → `references/vendor-source-model.md`.
- Verify public state on `/api/s/teajia-bali/products` (not get_tea, which hides
  shown_in_shop/is_public).
