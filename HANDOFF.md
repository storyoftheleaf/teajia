## State — what works, what's stubbed, what's untested.
Intake Workspace shipped and merged to `main` (PR #190). Code: `src/admin/views/IntakeWorkspace.tsx`, `src/admin/lib/intakeMapping.ts`; route `/admin/intake` in `src/admin/AdminApp.tsx`; entry points = Stock options menu "Bulk intake" (`InventoryView.tsx`) and the Capture shelf (`DraftsView.tsx`).

Works: multi-file drag/drop + paste (CSV, Excel via lazy `xlsx`, images); column mapping remembered per header signature (localStorage); photo → fields + image via `/api/extract-from-image` (Gemini); teaware + tea-type/form auto-detection; Shop/Personal triage → `is_personal`; everything imports as Draft (never auto-published); per-vendor `purchase_orders` with FX `total_usd`; pre-commit localStorage persistence; shipping split by estimated size folded into landed cost. Verified: `tsc`, `lint:colors`, production build, headless logic checks vs real order data; Cloudflare Pages deploy green.

Stubbed / not built (all optional): smarter size estimate (parse "300g/1kg/2L" from name; S/M/L quick picker); show landed cost in each row; generic pu'er → tea type (stays Misc when no raw/ripe marker); hard `purchase_orders.batch_id` FK (batch ref only lives in notes — needs a migration); Personal-collection → Bulk intake link.

Untested: live authenticated click-through (login → drop → map → commit, real Gemini extraction) — blocked here, no Infisical/worker secrets in this container. `main` now also carries `worker/tests/intake-batches.test.ts` (added upstream) — not run here.

## Next — the exact commands or steps to continue, one per line, specific enough to paste.
git checkout main && git pull origin main && npm install   # sync; feature branch was merged + deleted
git checkout -b claude/intake-followups                    # new branch (don't reuse the merged one)
cd worker && npm run dev   # terminal 1: worker + Infisical secrets
npm run dev                # terminal 2: frontend on port 7777
# Live verify: open /admin → log in → Stock → options menu → "Bulk intake" (or Capture → "Bulk intake")
# Drop a CSV/Excel export or an item photo → check map → Shop/Personal triage → Split shipping → Add to inventory
# Smarter size: add detectSizeFromName() in src/admin/lib/intakeMapping.ts (regex /\d+\s?(g|kg|ml|l)\b/i), prefer it in defaultSize(); add S/M/L buttons in the row in src/admin/views/IntakeWorkspace.tsx
# Show landed cost: in ItemsTable row meta (src/admin/views/IntakeWorkspace.tsx) render costAmount + convert(shareShip(it), shipCur, item currency) when shippingActive
npm run lint && npm run lint:colors && npm run build       # must pass before committing
