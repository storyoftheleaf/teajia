# Curate: fields, files and samples

Curate is the onboarding record for a tea. Supplier facts belong in structured fields; new agent writes cannot use tea or vendor notes as a fallback. Existing notes can be explicitly cleared or deleted. Exact `said` transcripts retain their authorship and can be corrected or deleted separately.

## Structured records

- Tea: quoted age, grade, pack size in grams and label, vendor item number, discount percent, customer-facing name, shipping mode and route prices. Existing type choices distinguish Sheng and Shou. A route price records currency, amount, quantity basis, route and whether it includes freight. Neither a discount nor a route quote silently changes shop pricing.
- Vendor: code, named contact people with titles, several labelled contact endpoints (including email, phone, WhatsApp, fax and Facebook) and labelled addresses. Contacts refer to a person by ID. Explicit replacement and clear operations remove obsolete values without erasing other same-channel contacts.
- Quote: vendor-linked reference, issue date, validity days or end date, minimum order amount and currency, payment terms and recipient. Quote lines snapshot their linked teas, unit prices, item numbers, discounts and routes. Header discount conditions distinguish unconditional, minimum amount/currency, weight or quantity, and an unknown threshold. Unknown means conditional, threshold not known yet; the quote's minimum order is never guessed to be its discount threshold. The shared quote editor and agent schema expose these fields. Linking a quote does not overwrite a tea's current price.

Vendor `preferred_currency` edits the underlying contact's preference explicitly through `curate_save_vendor` or `curate_correct`. It is separate from the profile's quoting `price_currency`; either may be cleared without changing the other. Known currency aliases are canonicalized, so CNY is stored as Yuan.

Blank nullable fields stay NULL; deliberately entered zero remains zero. Unsupported fields and incomplete currency/amount pairs are refused.

## Files

`curate_upload_attachment` accepts base64 JPEG, PNG, WebP or PDF bytes up to 6 MiB. It previews filename, target, role, size and digest. Confirmation must resend identical bytes and target. Roles distinguish leaf, liquor, wrapper, label, price list, business card and source document. Attachments belong to a tea, vendor, arrival proposal or quote.

Private evidence uses the existing private `ATLAS_BUCKET` binding under a separate `curate/attachments/` prefix. It never uses the public media bucket. The authenticated content endpoint checks active shop management rights and account ownership, and sends no-store and nosniff headers. The Files and change history control downloads through authenticated requests. Removing a file hides its attachment; immutable bytes remain available for safe undo. Uploading a source document does not publish it to the storefront.

Photo unlinking leaves its Drive backup intact and says so in the preview. `curate_drive_photo` explicitly previews and confirms trash or restore of an exact synced image selected by tea ID and stored photo URL, even after unlinking. It refuses folders, arbitrary file IDs and shared backup mappings. R2 bytes and the mapping remain; the backup is not recreated by background copying. Google Trash normally retains files for 30 days ([Google documentation](https://developers.google.com/workspace/drive/api/guides/delete)); restoration must happen before permanent removal.

An explicit `trash_drive:true` on `curate_correct` with `remove_photo` offers one combined preview. It confirms the local unlink first, so a stale tea preview never touches Google. Each part retains its own audit; an external failure or uncertain response reports partial completion rather than claiming rollback. Repeating the same confirmation does not repeat either write. Local undo restores only the tea URL; Drive restore remains explicit.

Drive changes have an attributed external-operation ledger (migration 0038), exposed by `curate_tea_photos` alongside mapped files. Confirmations bind identity, file metadata, mapping and connection. An unknown outcome returns an operation ID for readback; a retry needs a fresh same-action preview after a 60-second quiet period. Attempt-bound status updates prevent delayed responses from overwriting newer results. Use explicit Drive restore rather than local `curate_undo` for these operations.

## Samples and orders

`curate_promote_tea` previews and confirms an inventory identity for an existing tea. It reuses an existing product or creates a private Draft with unknown paid cost and zero stock. It preserves sample holdings; reviewed arrivals supply purchased quantities and cost. `curate_undo` can remove a newly created draft only while every product field remains unchanged and no dependent work references it. Undo of an existing product link never deletes that product.

Inventory's **Samples only** filter reads Curate teas marked received or tasted with no full stock on hand. It shows linked operational sample grams separately from saleable stock, including distinct portions from merged records. No grams entered is unknown, never an invented balance. Archived portions are excluded. Each row opens the tea editor.

**Log tasting** requires explicit consumed grams, including zero when no leaf was used. Its review shows the change before confirmation; it reduces only that sample portion, marks it tasted and can record taxonomy terms and a score. **Order** carries the same tea ID and supplier into the existing reviewed supplier-order flow. Arrival acceptance and physical stock receipt keep their existing separate confirmations.

`curate_stock` reads the same account-scoped holdings as this inventory view. Ordinary `search_tea` also returns separate `curate_holdings`; `get_tea` accepts `source: "curate"` for those IDs. Sample grams remain separate from saleable product stock, and unknown weight stays NULL. Shop management permission is required for these private holdings.

When `source` is omitted, `get_tea` falls back from an unmatched product ID to an authorized Curate holding, clearly labelled `entity_type: "curate_tea"` with `curate_tea_id`. Explicit `source:"product"` disables fallback. `list_low_stock` optionally accepts `include_samples:true` together with an explicit nonnegative `sample_threshold_grams`: samples at or below that balance and unmeasured samples are separate collections, never product stock or an invented reorder policy. `curate_get_tea` includes the five most recent attributed changes for managers; full snapshots remain in `curate_history`.

## Corrections and history

`curate_correct` previews field edits, null clears, transcript corrections, soft deletion/archive, duplicate merges, todo close/reopen/edit/delete, tasting term or score removal, individual photo removal, and sample consumption. `curate_save_vendor` also accepts a clear list. `curate_update_tea` accepts `clear:["said"]`: the preview names the exact voice transcripts to soft-delete, leaving manual notes separate. `clear:["note"]` clears only the legacy notes column. New vendor/quote/tea writes and supported corrections record actor user ID, token identity, agent label, timestamp and before/after snapshots.

`curate_history` reads these records and the notes, transcripts, to-dos, sample portions, quote lines and file changes associated with a parent record. MCP to-do changes and linked sample-status changes share the same preview, attributed history and guarded undo; merged sample portions update their surviving tea. History starts with this feature; it cannot reconstruct older unrecorded edits. `curate_undo` previews the last confirmed shop change by default, or a chosen history entry when supplied its `mutation_id`. Each app history entry also offers Preview undo. A selected change may precede unrelated work; already-undone changes, undo-of-undo and conflicting later changes are refused. History exposes `undone_by`. Confirmation verifies the exact affected records and relevant physical holdings have not changed. Undo appends history, preserves existing receipts and tastings, and archives newly created pristine sample portions instead of destroying evidence.

Every agent mutation uses preview and confirmation. The caller must have its MCP scope (`stock:write` for Curate corrections and undo) and active shop owner membership, or explicit `curate_manage` permission on a staff/admin membership. MCP version 0.9.0 advertises the current Curate tools and fields; cached connectors must reload `tools/list`. Platform access alone does not imply Curate management: an existing OAuth identity also needs that active shop membership. Capability grants apply on the next request without replacing its token. Existing catalog administration remains owner-only. Authorized managers see all active Curate records in the selected account, preserving the original author. This never grants another account's records.

`remove_vendor_contact` counts every durable vendor/contact reference, including Curate teas, samples, quotes, archived records and history. Both confirmation and the atomic deletion statement refuse referenced vendors. Use Curate archive/merge for records with history. Curate vendor delete/archive is soft: its preview reports linked record counts and warns that teas, samples and evidence remain attached. Confirmation rechecks those counts.

## Existing LKY/XWT data

The authorized cleanup was confirmed through live MCP on 2026-10-08 after reading exact record IDs and previews. LKY-PE1–PE8 hold 5 g samples; PE9–PE10 have none. XWT-LB1–LB3 are received with unknown weight. All thirteen teas now have structured pack/item/age or grade fields, and the ten LKY teas link to quote QT02-Puerh Medicine-261007, issued to Matteo separately from Adrian’s order. Thirteen manual factual notes and both vendor notes were cleared after moving facts into fields; all thirteen original voice transcripts remain. Vendor codes and Kate Ng’s separate contact details are recorded. No source file bytes or missing addresses were fabricated. The read-only inventory review remains documented in [CURATE_INVENTORY_REVIEW.md](CURATE_INVENTORY_REVIEW.md). Empty batches and ambiguous duplicates still need their specific review.

Migrations 0035–0037 add fields, quote records, private evidence metadata and audit state; they do not mass-rewrite existing business records. Release status and exact deployed revision are recorded by the [verified release runner](VERIFIED_RELEASES.md).

## Release verification

The initial workspace revision `5f9845f0` was independently proven live as build `muznx15q`. Its verification on 2026-10-08 included: 2,127 Worker tests; 2,404 client tests (11 existing skips); 16 desktop/mobile browser workflows; 19 release-runner tests; frontend TypeScript, color lint, production build and Worker dry-run bundle. The Worker TypeScript ratchet retains its 37 existing diagnostics with line mappings updated, and no new diagnostics. Browser checks include private photo viewing, upload/removal/undo, new-draft file isolation, explicit zero, unknown-weight measurement, tasting deductions, supplier orders, vendor contacts and quote lines.

New unweighed portions carry `grams_known=0`; serializers return NULL grams until a measurement is confirmed. The numeric legacy storage default is never displayed as that portion's balance. Existing recorded balances are preserved. Public sourcing-set responses remove supplier metadata and supplier-derived set titles.

Acceptance follow-up: 2,147 Worker tests passed before the final history/to-do fixes; 638 relevant Curate/agent tests and 37 writing/status tests passed for those fixes. Eight desktop/mobile sample workflows, 25 release-runner tests, frontend TypeScript, the unchanged Worker typecheck ratchet, color lint and production build passed. Final publication proof remains in the immutable release artifacts.

OAuth access follow-up: production membership was granted only to the authorized existing OAuth identity, with `curate_manage:true` for the selected shop. The management gate remains enforced on every request. Local verification covers 2,222 Worker tests (full run plus the two corrected fixture/source-location checks), frontend TypeScript, the unchanged 37-error Worker baseline, color lint and Worker bundling. Promotion includes guarded undo of pristine new drafts; publication remains tied to the release artifacts.

The prior release `3b7309c1` was independently proven live as build `mv04eo7d`. GrokBot subsequently confirmed the permission repair, 5 g XWT samples, single-photo removal, structured LKY/XWT records and note cleanup. Exact production years, missing processing/age, tasting/storage facts, real photos and LKY WeChat remain owner-supplied facts; they are not inferred from quoted age or filled with guesses.

Selected-undo/Drive follow-up verification: 2,241 Worker tests and eight desktop/mobile browser workflows passed, together with frontend TypeScript, the existing 37-error Worker ratchet, color lint, frontend production build and Worker dry-run bundle. Screens were checked in both Curate editors. Drive lifecycle tests use controlled Google responses; no production Drive file was trashed during verification.
