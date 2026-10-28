# Purchases, logistics services and studio arrivals

Local implementation on 2026-10-28; migration `0052_logistics_shipments.sql` and the matching Worker/frontend release are required. Do not treat this document as live deployment proof.

## The working flow

1. Import the supplier invoice through the existing intake tools (`intake_start`, `intake_add_source`, `intake_analyze`, item corrections, `intake_finalize`). Finalization creates purchases and expected receipts, not on-hand stock. Read `list_purchases` and `list_logistics`; never create a duplicate purchase for the same invoice.
2. Save the logistics company, supplier courier and inbound tracking against each purchase with `set_purchase_logistics`. The original supplier and invoice costs stay on the purchase. Logistics companies can be linked to existing People contacts.
3. Record confirmed arrival at that company's hub with `mark_logistics_arrival`. This means **at logistics**, not at the studio. Stock stays unchanged.
4. When instructed to group goods, use `create_logistics_shipment` with explicit receipt-line quantities from one company. Choose its saved air/sea service when available. Multiple purchases can share one shipment; a purchase can be divided across shipments. Draft allocations reserve goods so they cannot be sent twice. Cancel a draft to release them for regrouping; its manifest remains in history.
5. Add the combined outbound courier, tracking number and expected studio date with `update_logistics_shipment`, then `dispatch_logistics_shipment` when sent. Supplier tracking and outbound tracking remain separate. Dispatch still adds no stock.
6. At the studio, use `receive_logistics_shipment` with only the quantities actually checked. Partial arrivals are normal. Studio receipt, stock movement and shipment counters commit together for each line. Reuse the **same request key and quantities** after a timeout or partial failure; the operation resumes without adding stock twice. Ordinary `record_arrival` refuses purchases managed through logistics.

Every MCP write uses a durable preview/confirmation token and rechecks current data when confirmed. `inventory:read` reads logistics; `stock:write` changes it. Browser operations use the same implementation. Account boundaries apply to contacts, purchases, services, shipment lines and studio receipts.

## Saved services and freight

A logistics company can offer multiple named services, such as Airmail and Sea cargo. Agents manage these through `create_logistics_service`, `update_logistics_service` and `archive_logistics_service`; `list_logistics` includes the saved services. Creating a new company contact uses the existing People operation and its contact-management permission. Each service records air/sea, charging basis (kg, m³ or fixed), rate and quoted currency. Selecting one copies that historical quote onto the shipment. Later service-rate edits apply to future shipments; they do not rewrite earlier quotes. Archived services stay available in historical records.

The final bill can override the quote. Rate × billable quantity is used only when no explicit bill total exists; these amounts are never added together. Blank means not yet known, while an entered zero means free. Weight-based charges are divided by item weight; volume-based charges by packed volume. A fixed bill can use either allocation basis. Rounded shares add back to the full bill.

When size is missing, `estimate_logistics_volume` provides the same planning allowances as the screen for loose tea, pressed tea, gaiwans, cups and teapots. Unknown kinds need an entered approximate volume. These are editable packing assumptions, not product measurements. Tea net weight is not automatically a measured billable packed weight. Replace estimates with the logistics company's measurements when available. A confirmed bill with estimated item volumes still has an **estimated split**.

Supplier cost and freight retain their own currencies. A landed total appears only when both use the same currency; different currencies remain separate. This accounting does **not** silently replace the shop's existing retail freight rate or markup. Changing retail pricing remains an explicit separate operation.

## The tracking screen

Purchases opens on compact supplier and shipment summaries. Filters show To logistics, At logistics, To studio, Received and Needs attention. A purchase split between locations shows both quantities. Unmanaged older deliveries retain their existing Coming/Received behavior.

Open a shipment for contents, its original purchases, costs and packing details. Secondary edits and verified studio receiving remain behind small disclosures. Saved services, grouping and correction tools are available without turning the tracking screen into a permanent form.

The logistics-company filter exposes a contents list for goods going to or waiting at that hub, including goods reserved in a draft shipment. Each outbound shipment has its own contents list. Download CSV for quantities, paid prices/currencies, freight, estimated volumes, source links and tracking; download Photo list for a printable document. The user chooses where to send it. No automatic message is sent to the logistics company.

Existing product photos are used where present. An agent can attach an HTTPS reference image and its source page to a shipment line; images found online must be identified as references, not proof of the actual packed goods. Missing images remain visibly missing. The exporter escapes HTML and protects spreadsheet cells from formulas.

## Verification

`worker/tests/logistics-shipments.test.ts` exercises the actual REST and MCP routes, the migration ledger, scoped permissions, reservations, partial receipt retries and stock safeguards. `src/lib/logisticsFreight.test.ts` covers cost allocation and estimate rules. The logistics UI and manifest tests cover tracking semantics and exports. A local browser preview uses sample purchases and blocks production requests; it is not live-site proof.
