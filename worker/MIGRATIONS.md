# Database migrations & schema provenance

> Addresses audit finding **C3** (no migration runner; core tables exist only
> in `schema.sql`; duplicate-numbered migration files conflict on restore).

## Source of truth

**`worker/schema.sql` is the canonical schema.** A ground-up build is:

```bash
cd worker
npm run db:init        # wrangler d1 execute teajia-db --remote --file=./schema.sql
npm run db:seed        # optional sample data
```

`schema.sql` is **idempotent** (`CREATE TABLE/INDEX IF NOT EXISTS`) and already
absorbs the cumulative result of the numbered migrations — including the core
tables (`products`, `invoices`, `invoice_line_items`, `customers`,
`activity_logs`) that exist **only** here and in no numbered migration.

> ⚠️ Do **not** try to rebuild a database from `migrations/` alone — the base
> tables are not defined there, so it produces a broken schema. The numbered
> files are a forward-only **reconciliation journal** applied ad-hoc to the
> already-live remote D1 as the schema evolved; they are not a replayable
> migration history and there is no `[[migrations]]` runner in `wrangler.toml`
> tracking which have been applied.

## Applying a new migration

```bash
cd worker
wrangler d1 execute teajia-db --remote --file=./migrations/NNN_name.sql
```

Then **fold the change into `schema.sql`** so the canonical source stays
current (e.g. migrations 086–088 are already reflected there).

Caveats baked into this repo's history:
- SQLite `ALTER TABLE ... ADD COLUMN` has **no `IF NOT EXISTS`** — column-adding
  migrations (e.g. 087, 088) error if run twice. Apply each exactly once.
- `CHECK` / `NOT NULL` additions require a full table rebuild — see the
  review-required template in `089_inventory_integrity_constraints.sql`. Never
  auto-apply a rebuild; copy the live column list verbatim first.

## Duplicate-numbered files (historical — do not re-run blindly)

Several migration numbers were reused for unrelated changes. On a fresh restore
this is moot (use `schema.sql`); the notes below disambiguate the journal:

| Number | Files | Canonical / notes |
|---|---|---|
| 004 | `004_add_form_column.sql`, `004_events_v2.sql`, `004_saved_locations.sql` | Three unrelated changes. `004_add_form_column.sql` is a `SELECT 1` no-op. All folded into `schema.sql`. |
| 012 | `012_invoice_source_event.sql`, `012_source_compass_entry_id.sql` | Both real, both applied; both columns present in `schema.sql`. |
| **017** | `017_multi_account.sql`, `017_multi_account_patched.sql` | **`_patched` is canonical.** It drops ALTERs for tables not yet on prod. Running **both** double-`ALTER ADD COLUMN account_id` and errors. Apply only the patched file on a system that predates multi-account. |
| 025 | `025_notes.sql`, `025_stock_ledger_seed.sql`, `025_venues.sql` | Three unrelated; all applied. |
| 028 | `028_customer_type.sql`, `028_invoice_custom_items.sql`, `028_sample_data.sql` | Three unrelated; all reflected in `schema.sql`. |
| 058 | `058_articles_category_vocabulary.sql`, `058_in_transit_details.sql` | Two unrelated; both applied. |
| 059 | `059_contributors.sql`, `059_session_product_link.sql`, `059_session_reserve_grams.sql` | Three unrelated; all applied. |
| 082 | `082_compass_verdict.sql`, `082_oauth_authorize_requests.sql`, `082_tea_discovery_profiles.sql` | Three unrelated; all applied. |

## Recommended consolidation (your decision)

Long term, either (a) adopt Wrangler's tracked `[[migrations]]` system so applied
versions are recorded, or (b) treat `schema.sql` as the only build artifact and
archive `migrations/` read-only. Until then, keep folding each new migration
into `schema.sql` as above.
