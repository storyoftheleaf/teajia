# Curate: fields, files and samples

Curate is the onboarding record for a tea. Supplier facts belong in structured fields; new agent writes cannot use tea or vendor notes as a fallback. Existing notes can be explicitly cleared or deleted. Exact `said` transcripts retain their authorship and can be corrected or deleted separately.

## Structured records

- Tea: quoted age, grade, pack size in grams and label, vendor item number, discount percent, customer-facing name, shipping mode and route prices. Existing type choices distinguish Sheng and Shou. A route price records currency, amount, quantity basis, route and whether it includes freight. Neither a discount nor a route quote silently changes shop pricing.
- Vendor: code, named contact people with titles, several labelled contact endpoints (including email, phone, WhatsApp, fax and Facebook) and labelled addresses. Contacts refer to a person by ID. Explicit replacement and clear operations remove obsolete values without erasing other same-channel contacts.
- Quote: vendor-linked reference, issue date, validity days or end date, minimum order amount and currency, payment terms and recipient. Quote lines snapshot their linked teas, unit prices, item numbers, discounts and routes. Linking a quote does not overwrite a tea's current price.

Blank nullable fields stay NULL; deliberately entered zero remains zero. Unsupported fields and incomplete currency/amount pairs are refused.

## Files

`curate_upload_attachment` accepts base64 JPEG, PNG, WebP or PDF bytes up to 6 MiB. It previews filename, target, role, size and digest. Confirmation must resend identical bytes and target. Roles distinguish leaf, liquor, wrapper, label, price list, business card and source document. Attachments belong to a tea, vendor, arrival proposal or quote.

Private evidence uses the existing private `ATLAS_BUCKET` binding under a separate `curate/attachments/` prefix. It never uses the public media bucket. The authenticated content endpoint checks active shop management rights and account ownership, and sends no-store and nosniff headers. The Files and change history control downloads through authenticated requests. Removing a file hides its attachment; immutable bytes remain available for safe undo. Uploading a source document does not publish it to the storefront.

## Samples and orders

Inventory's **Samples only** filter reads Curate teas marked received or tasted with no full stock on hand. It shows linked operational sample grams separately from saleable stock, including distinct portions from merged records. No grams entered is unknown, never an invented balance. Archived portions are excluded. Each row opens the tea editor.

**Log tasting** requires explicit consumed grams, including zero when no leaf was used. Its review shows the change before confirmation; it reduces only that sample portion, marks it tasted and can record taxonomy terms and a score. **Order** carries the same tea ID and supplier into the existing reviewed supplier-order flow. Arrival acceptance and physical stock receipt keep their existing separate confirmations.

`curate_stock` reads the same account-scoped holdings as this inventory view. It reports sample grams and full stock separately.

## Corrections and history

`curate_correct` previews field edits, null clears, transcript corrections, soft deletion/archive, duplicate merges, todo close/reopen/edit/delete, tasting term or score removal, individual photo removal, and sample consumption. `curate_save_vendor` also accepts a clear list. New vendor/quote/tea writes and supported corrections record actor user ID, token identity, agent label, timestamp and before/after snapshots.

`curate_history` reads these records and file changes associated with a parent record. History starts with this feature; it cannot reconstruct older unrecorded edits. `curate_undo` previews the last confirmed shop change. Confirmation verifies the exact affected records and relevant physical holdings have not changed. Undo appends history, preserves existing receipts and tastings, and archives newly created pristine sample portions instead of destroying evidence.

Every agent mutation uses preview and confirmation. The caller must have its MCP scope and active shop owner membership, or explicit `curate_manage` permission on a staff/admin membership. Authorized managers see all active Curate records in the selected account, preserving the original author. This never grants another account's records.

## Existing LKY/XWT data

The build does not fabricate source-document contents or grams for old rows. Live MCP reads timed out from the build environment. Existing LKY/XWT records have therefore not been corrected, cleared or backfilled by this build. Their exact IDs and stored contents must be read before applying the already-requested targeted cleanup. The read-only inventory review remains documented in [CURATE_INVENTORY_REVIEW.md](CURATE_INVENTORY_REVIEW.md). Empty batches and ambiguous duplicates still need their specific review.

Migrations 0035–0037 add fields, quote records, private evidence metadata and audit state; they do not mass-rewrite existing business records. Release status and exact deployed revision are recorded by the [verified release runner](VERIFIED_RELEASES.md).

## Release verification

The integrated candidate includes main through `9d4bf093`. Verification on 2026-10-08: 2,127 Worker tests; 2,404 client tests (11 existing skips); 16 desktop/mobile browser workflows; 19 release-runner tests; frontend TypeScript, color lint, production build and Worker dry-run bundle. The Worker TypeScript ratchet retains its 37 existing diagnostics with line mappings updated, and no new diagnostics. Browser checks include private photo viewing, upload/removal/undo, new-draft file isolation, explicit zero, unknown-weight measurement, tasting deductions, supplier orders, vendor contacts and quote lines.

New unweighed portions carry `grams_known=0`; serializers return NULL grams until a measurement is confirmed. The numeric legacy storage default is never displayed as that portion's balance. Existing recorded balances are preserved. Public sourcing-set responses remove supplier metadata and supplier-derived set titles.
