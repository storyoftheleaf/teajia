# Fix CI Cloudflare token — add D1 Edit permission

## ✅ RESOLVED 2026-06-01

Token updated with D1 write (`CLOUDFLARE_API_TOKEN` secret refreshed at 07:10 UTC).
Verified live: deploy run 26740632400 (07:13 UTC, after the token update) succeeded
with the migration step reporting `✅ No migrations to apply!` — no more 7403. The
`continue-on-error` swallow was also removed from the workflow, so the pipeline now
fails loudly on migration errors instead of hiding them. Migration auto-apply on
deploy is fully working. Archived.

## What's wrong

The GitHub Actions deploy (`.github/workflows/deploy-worker.yml`) has two steps that
use the same credentials (`secrets.CLOUDFLARE_API_TOKEN` + `secrets.CLOUDFLARE_ACCOUNT_ID`):

1. **Apply D1 migrations** — `wrangler d1 migrations apply teajia-db --remote`
2. **Deploy to Cloudflare Workers** — `wrangler deploy`

On the 2026-06-01 deploy (run 26739638614), step 2 **succeeded** but step 1 **failed**:

```
✘ ERROR  A request to the Cloudflare API (.../d1/database/.../query) failed.
  The given account is not valid or is not authorized to access this service [code: 7403]
```

## Diagnosis (confirmed)

Same token + same account ID: `wrangler deploy` worked, `d1 migrations apply` did not.
An expired token or wrong account ID would fail **both**. Since only D1 fails, the
token is valid and the account ID is correct — **the token is missing the `D1:Edit`
permission**. It was minted 2026-05-04 with Workers Scripts edit but no D1 scope.

Because the migration step still carries `continue-on-error: true` (as of this writing),
the deploy reports success while migrations silently don't apply — this is the drift
that left 076 + 080 out of sync. (A separate in-flight change removes
`continue-on-error` so this fails loudly going forward.)

## The fix — pick one

### Option A — add D1 to the existing token (fastest, no GitHub change)
1. Cloudflare dashboard → **My Profile → API Tokens** → the token used for Teajia CI
   (created ~2026-05-04) → **Edit**.
2. Permissions → add **Account → D1 → Edit**. Save.
3. Token value is unchanged, so the GitHub secret stays as is. Done.

### Option B — mint a fresh token (if the old one can't be found/edited)
1. Cloudflare → API Tokens → **Create Token**. Permissions:
   - **Account → Workers Scripts → Edit**
   - **Account → D1 → Edit**
   - **Account → Account Settings → Read**
   Scope it to the account that owns `teajia-api`.
2. Copy the value once.
3. `gh secret set CLOUDFLARE_API_TOKEN` (paste), or set it in the repo's
   GitHub Actions secrets UI. (Adrian runs this — secret values never go through chat.)

## Verify

Re-run the failed deploy or push a trivial change, then:

```
gh run rerun 26739638614          # or watch the next deploy
gh run view --job=<id> --log | grep -i "Apply D1 migrations" -A5
```

The "Apply D1 migrations" step should report applied/up-to-date with no 7403.

Cross-check the tracker matches reality (no drift):

```
cd worker && npx wrangler d1 migrations list teajia-db --remote
```

## Context

- Secrets are referenced at `.github/workflows/deploy-worker.yml` lines 50–51, 58–59.
- Repo secrets present: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (both 2026-05-04).
- The 080 table (`saved_collections`) IS already in prod (applied out-of-band during the
  2026-06-01 tracker reconciliation), so this token fix is about *future* migrations,
  not a current outage.
- Related: [deploy-db-migrations.md](deploy-db-migrations.md) — the broader "deploys apply
  DB changes automatically" effort this unblocks.
