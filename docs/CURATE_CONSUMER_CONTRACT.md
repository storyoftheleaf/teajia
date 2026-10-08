# Curate consumer contract

Curate, inventory, agents and editorial consumers share identities and domain operations. This describes existing behavior; release and integration evidence belongs in [Launch validation](LAUNCH_VALIDATION.md#curate-release-and-integration-evidence-2026-10-09). Field and workflow details remain in [Curate workspace](CURATE_WORKSPACE.md).

## Identities and quantities

| Record | Canonical identity and relationship | Consumer rule |
| --- | --- | --- |
| Shop | `account_id` | Scope every private read/write to the selected authorized account. A name or vendor code is not an authorization boundary. |
| Curate tea | `tea_compass_entries.id` | Preserve this encounter ID through ordering, promotion and arrivals. Names and item numbers are searchable facts, not primary keys. |
| Vendor | `customers.id`; vendor profile uses `vendor_id` | Contact-person IDs inside the profile are distinct from the whole vendor. Soft archive/delete retains linked teas, samples and provenance. |
| Sample portion | `tea_samples.id`, `compass_entry_id` → tea, `source_id` → vendor, `set_id` → sample set | Keep separate portions separate after merging teas. `grams_known=0` serializes as unknown grams. Consuming a sample never reduces saleable stock. |
| Shop product | `products.id`; `source_compass_entry_id` → tea and tea's `draft_product_id` → product | Use the returned product ID for product inventory operations. Do not substitute a Curate or sample ID. |
| Quote, order, arrival, receipt | Separate IDs, with source tea/vendor links | A quote is not a purchase, an arrival proposal is not a receipt, and a sample is not purchased inventory. Preserve the links instead of creating a second tea by name. |

`curate_promote_tea` creates or reuses the product identity immediately. A new product is a private Draft, with zero stock and unknown paid cost. Promotion does not publish or move sample grams. Reviewed arrivals supply the purchased quantity and paid line total. Quoted HKD/kg or yuan prices and discounts must not be copied into a batch-cost field. Unknown money stays NULL; explicit zero means free. Freight follows the shared shop setting unless deliberately overridden.

## Shared agent and human operations

Agents use MCP `/mcp` and the current `tools/list`. Browser consumers use authenticated REST routes, including the account context. The schemas define confirmation argument names; do not assume every tool calls its token `confirm`.

| Operation | Agent tools | Browser/API route |
| --- | --- | --- |
| Read and maintain tea facts | `curate_find`, `curate_get_tea`, `curate_add_tea`, `curate_update_tea` | `/api/compass/entries`, `/api/compass/entries/:id`, `/api/compass/sync` |
| Read remaining samples and stock | `curate_stock`; `search_tea` returns `curate_holdings`; `get_tea` accepts `source: "curate"` | `GET /api/curate/holdings` |
| Create/reuse product identity | `curate_promote_tea` | `POST /api/compass/entries/:id/promote` |
| Order from the source tea | `curate_order` | `POST /api/curate/order` |
| Review arrivals | `curate_list_arrivals`, `curate_approve_arrival` | `/api/curate/receipt-proposals`; creation at `/api/compass/entries/:id/receipt-proposals`, edit and accept/reject by proposal ID |
| Correct, archive, merge or consume samples | `curate_correct` | `POST /api/curate/correct` |
| Read history and reverse a selected change | `curate_history`, `curate_undo` with optional `mutation_id` | `GET /api/curate/history`, `POST /api/curate/undo` |
| Attach/read private evidence | `curate_upload_attachment`, `curate_list_attachments` | `/api/curate/attachments`; authenticated `/api/curate/attachments/:id/content` |
| Inspect and clean Drive backups | `curate_tea_photos`, `curate_drive_photo` | Agent operation; no browser trash/restore control is implied |

Management requires active shop ownership or explicit `curate_manage` on an active staff/admin membership. An MCP scope alone is insufficient. Private reads also require authorization; managers see the selected shop's records without rewriting their original authorship. Agent mutations preview first and confirm the bound change. History is append-only. Selected undo refuses conflicting newer changes or changed physical holdings. External Drive changes use their own operation ledger and explicit restore, not local database undo.

`remove_vendor_contact` is the legacy whole-vendor removal tool, not a contact-person deletion tool. It refuses durable dependencies. Curate vendor soft deletion reports those dependencies and leaves records attached. Use structured vendor profile edits for individual contacts.

## Editorial and private evidence

Raw `said` transcripts, vendor contacts and business cards, quote recipients, costs, discounts, route prices, internal notes, history and sample holdings are private source material. Access for drafting is not publication approval. Preserve exact attribution and leave unknown years, processing, ages or storage blank.

New private attachments use `ATLAS_BUCKET` and authenticated content downloads. Some legacy photo URLs can already be publicly reachable; that does not make them approved editorial assets. Unlinking a tea photo retains the stored bytes and Drive backup. Drive cleanup is a separate preview/confirm action against its stored mapping; it does not delete R2 bytes.

Public editorial may reference an already published product by its product ID and existing `/shop/product/:id` route, using approved public catalog fields and images. Private drafts may retain opaque source IDs internally. Do not expose private attachment URLs, vendor contact details, costs or raw transcripts through a public article. Publication continues through the existing editorial workflow and authorization; this contract introduces no editorial backend or source-storage expansion.

The server-backed v2 Orders consumer must preserve purchase-order and source-tea identities. Phone Samples must read the same holdings and retain unknown-weight and sample/stock distinctions. Order-total consumers must preserve NULL as unknown rather than convert it to zero. Those interfaces remain shared regardless of which editor or agent starts the operation.
