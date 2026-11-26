# M1 audit: is the order history fit to carry host credit (Astra, at main 0bf5faf, 2026-11-26)

Verdict: not enough for automatic credit as it stands; keep order_session_sources, record awards separately.
1. Join: use converted_invoice_id OR source_inquiry_id (dedupe) to catch website splits; converted-bag splits and Void-then-rebook replacements lose the link.
2. Filled and paid happen in either order: earn when first Filled AND resolveInvoicePayment fully covered, evaluated on both events. Legacy paid column counts without a receipt. Filled+paid invoices cannot be cancelled/voided/refunded (409), so returns cannot reverse.
3. Base: quantity x price_at_sale on positive lines linked to a tea product in the shop; teaware, custom lines and shipping earn zero. Linking a custom line to a tea after sale changes the base, so snapshot at award time. Refund rows do not name lines.
4. host_user_id: lead host with a user at request time; can be NULL (no linked lead, co-host only) or stale; public credit removal does not change it.
5. Attribution is last thank-you on the device for the whole request.
6. A host can buy through their own thank-you (self-purchase); anonymous checkout cannot be checked.
7. No pre-Launch-1 sources (confirmed by migration and replay).
8. A failed source write is swallowed and replay skips it: missing row is indistinguishable from unattributed.
Smallest change: one award row per eligible line (unique), with sale-time basis, and one reversal per award.
