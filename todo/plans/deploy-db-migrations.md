# Let deploys apply database changes automatically

## Status update 2026-06-01 — drift fixed, one token check left

A read-only audit found the migration tracker (`d1_migrations`) had fallen badly
out of sync with prod: it claimed 074–080 were all unapplied, but 074/075/077/078/079
were physically present while **076 and 080 were genuinely missing** (inquiry
ref_numbers and the saved_collections table — both live features silently degraded).
Root cause: migrations were applied by hand via `execute --file` without recording
them in the tracker, and CI's `continue-on-error: true` hid the resulting failures.

Done this session:
1. Applied the two missing migrations (076, 080) to prod. Both additive/safe.
2. Reconciled the tracker — inserted applied-records for 074–080. `wrangler d1
   migrations list --remote` now reports "No migrations to apply!".
3. Removed `continue-on-error` from the workflow so future failures fail loudly.

**✅ Token fixed and verified 2026-06-01.** `CLOUDFLARE_API_TOKEN` now has D1 write.
Deploy run 26740632400 (07:13 UTC) succeeded with the migration step reporting
"No migrations to apply!" — no more 7403. The pipeline now auto-applies migrations on
every deploy and fails loudly if one errors. This whole effort is complete.

## Steps to fix (token)

1. Mint a Cloudflare API token with both Workers deploy permission and D1 write permission.
2. Save it as the repository secret named `CLOUDFLARE_API_TOKEN`.
3. ~~Remove the `continue-on-error: true` line~~ — done 2026-06-01.

## Affected workflow

[.github/workflows/deploy-worker.yml](../../.github/workflows/deploy-worker.yml)

## Article schema

The article table is part of the tracked migration chain. Use the [database deploy
runbook](../../docs/claude/deploy-and-secrets.md#keep-schema-changes-in-the-migration-ledger)
for article schema changes and migration drift.
