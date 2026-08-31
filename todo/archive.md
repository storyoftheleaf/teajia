# Teajia TODO — Archive

Finished work, moved here from TODO.md. Nothing is deleted; lineage is kept.

## Orders and payments

- [x] Stop writing the payment ledger rules twice — done 2026-08-31. Eleven pieces of the money code had been copied from `worker/src/index.ts` into `worker/src/mcp.ts` under a "keep in sync" note, because index imports mcp and the reverse would close a module cycle, so a change to what counts as paid had to be made in both files. They now live in `worker/src/invoiceDomain.ts`, which imports neither, and both import from it: PAYMENT_EPSILON, the text limits and caps, roundUsd, paymentTextField, formatInvoiceNumber, loadInvoiceLedgerTotals, invoiceMoney, loadLedgerInvoice, reconcileLedgerWithColumn, recomputeInvoicePaymentStatus. The same pass closed the one place the two implementations disagreed: `whats_waiting` required `status = 'Draft'` across both halves of its unpriced question, so a Pending order carrying a line priced at nothing was on the screen and not in the spoken answer. `worker/tests/attention-parity.test.ts` now asserts the screen and the voice return the same list, and fails if either drifts.

## Curate

- [x] Make Curate deletes survive being offline — done 2026-06-29 via tombstones: a deleted id is recorded locally and filtered out of hydrate so the still-on-server row can't reappear; the delete is retried on each hydrate until the server confirms it. Fixes "I deleted it and it came back."

## Read / Magazine

- [x] Build the immersive article reader that replaces the 4:5 carousel as the default, where writing leads and visuals plus text-effects punctuate it, reading great on phone and desktop _(done 2026-06-17 — AR.0–AR.6 shipped: scroll-driven reader, section families, ~12 text-effects, block-stack authoring, share-card generation; merged into main)_ → Plan: [immersive-article-system.md](plans/archive/immersive-article-system.md)
