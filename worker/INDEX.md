# Worker code index

> Navigation aid only. Current authorization and tenancy contracts live in [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md); open engineering work lives in [`docs/tracks/08-platform-hardening.md`](../docs/tracks/08-platform-hardening.md).

## Entry points

- `src/index.ts` — HTTP route table and most handlers.
- `src/mcp.ts` — authenticated and public MCP transport/tools.
- `migrations/` — ordered D1 migrations; never rerun raw `ALTER TABLE` files outside the migration ledger.
- `tests/` — Worker behavior, authorization, tenancy, repair, contributor, event, and product-loop coverage.
- `wrangler.toml` — bindings, environment configuration, and edge rate limiters.

## Authorization model

- `requireAccount` resolves the active account and membership; account-owned SQL must still filter by `account_id`.
- `requireBundle` gates delegated capabilities such as catalog, stock, publish, gather, sell, and members.
- `requireOwnerTier` protects owner-only account operations.
- Platform gates are explicit and tested separately from ordinary account membership.
- Product mutations use domain command routes: `/catalog`, `/stock`, `/commercial`, and `/publication`.
- Public routes must be intentionally registered and return only publishable/storefront-safe data.

Cross-account denial coverage is maintained in `tests/tenancy-isolation.test.ts` plus resource-specific suites. Do not use old audit counts or copied line-number tables as evidence; inspect the current router and tests.

## When adding or changing a route

1. Choose the public/account/bundle/owner/platform boundary explicitly.
2. Scope every owned read and write by `account_id`.
3. Use stable error codes rather than requiring clients to match prose.
4. Audit sensitive cross-account or privilege-changing mutations.
5. Add focused authorization and tenancy tests.
6. Add a numbered migration for schema changes and rehearse it through the migration ledger.
7. Update [`docs/SITE_MAP.md`](../docs/SITE_MAP.md) when the externally reachable route surface changes.

## Current debt

The concise actionable queue is [`docs/tracks/08-platform-hardening.md`](../docs/tracks/08-platform-hardening.md). It supersedes historical endpoint inventories and security-audit snapshots.
