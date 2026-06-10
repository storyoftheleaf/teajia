# Deploy

Deploys are automated via GitHub Actions on push to `main`. You normally never
deploy by hand.

## How it works

| Surface | Workflow | What it does |
|---|---|---|
| Frontend (teajia.com) | `.github/workflows/deploy-frontend.yml` | `npm run lint` → `npm run lint:colors` → build → Cloudflare Pages deploy to project **`teajiafinal`** |
| Worker API | `.github/workflows/deploy-worker.yml` | `npm run test:worker` → `wrangler d1 migrations apply teajia-db --remote` → `wrangler deploy` |

Notes:

- **`teajiafinal` is the live Pages project.** The `teajia` Pages project
  (teajia.pages.dev) is stale/abandoned — do not deploy there.
- **Migrations apply automatically on worker deploy** and a failed migration
  fails the deploy loudly (a silent failure once let 076 + 080 drift out of
  prod; the `d1_migrations` tracker was reconciled 2026-06-01).
- A failed gate (type error, color-rule violation, failing worker test) blocks
  the deploy instead of shipping it.

## Manual deploys (exception, not the rule)

Both workflows support `workflow_dispatch` — trigger from the Actions tab, e.g.
to ship a fix from a feature branch before it merges.

True local deploys (requires Cloudflare auth):

```bash
# Worker — migrations first, then code, same order as CI
cd worker
npx wrangler d1 migrations apply teajia-db --remote
npx wrangler deploy

# Frontend
npm run build
npx wrangler pages deploy dist --project-name teajiafinal --branch main
```

## Spot-check after deploy

```bash
curl https://<worker-url>/api/s/teajia-bali/products   # public Bali catalog
curl https://<worker-url>/api/network/stores            # store directory
```

## Provisioning a new store owner

The multi-store Phase 1A playbook (account creation, owner claim links) lived
in this file until 2026-06-10; it's in git history if needed. The short
version that still applies:

```bash
# Add an owner to an account (as a platform admin)
curl -X POST https://<worker-url>/api/accounts/<account_id>/members \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Teajia-Account: <your_account_id>" \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@example.com","role":"owner"}'
```

The response includes a `claim_link` — share it with the new owner; they set a
password and land in their account.
