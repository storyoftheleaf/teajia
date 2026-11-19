# PayPal sandbox checkout

The customer order page can create a PayPal Sandbox order, redirect the customer to PayPal for approval, then capture and verify the payment on return. Verified completed receipts enter the existing invoice payment ledger and trigger the existing paid-stock transition. A return URL, customer report, approved-but-uncaptured order, pending receipt, wrong amount/currency/merchant or mismatched order never marks an invoice paid.

## Current boundary

This implementation is **local sandbox only**. Both the incoming Worker URL and APP_URL must use localhost/127.0.0.1/[::1], and the explicit sandbox flag plus sandbox account and credentials must be present. Every provider request goes to the fixed `https://api-m.sandbox.paypal.com` origin. There is no live mode, live credential fallback, browser amount override or caller-provided provider endpoint. Setting sandbox variables on the deployed Worker cannot enable the control or write test money to its live database.

No merchant bank, US shipping rate, live payment credential or payment activation has been changed. US orders without a configured rate still require a confirmed shipping quote and operator acceptance before a sandbox checkout can start. Existing bank-transfer confirmation remains manual. Pickup remains explicit; this integration adds no delivery pricing policy.

## Configuration for a real PayPal Sandbox rehearsal

Use a disposable local D1 database, then set the following only in the local test environment:

- `PAYPAL_SANDBOX_ENABLED=true`
- `PAYPAL_SANDBOX_ACCOUNT_ID`: the disposable local shop account ID
- `PAYPAL_SANDBOX_CLIENT_ID` and `PAYPAL_SANDBOX_CLIENT_SECRET`: credentials for a PayPal **Sandbox** app
- `PAYPAL_SANDBOX_MERCHANT_ID`: the sandbox seller merchant ID, not its email
- `APP_URL`: the loopback frontend origin

Store real sandbox credentials in Infisical (Teajia/dev), never in source, chat or screenshot files. No PayPal credential names were present in the existing secret inventory during this build. A completed transaction against PayPal's actual Sandbox is therefore still a connection/acceptance step; the current screenshots use clearly declared simulated provider responses.

Use a PayPal sandbox buyer to approve the order. The app creates and captures through the server, with the secret never sent to the browser. The standard PayPal return `token` is accepted only with the explicit sandbox-return marker; the server still independently reads back and verifies the bound provider order and receipt. Cancellation does not capture.

## Order and receipt integrity

Migration `0069_paypal_sandbox_orders.sql` adds a DDL-only attempt table. Attempts bind account, invoice, reviewed quote, balance and original hold. Provider order and capture identifiers are unique; the payment ledger uses a deterministic per-capture request ID. A repeat return records one receipt and deducts stock once. A changed quote or expired reservation cannot trigger a fresh capture. A receipt already completed at the provider can be reconciled without another capture after an interrupted local response.

The existing invoice link lease serializes review, capture and ledger writes; it is released before the existing stock helper takes its own lease. Completed provider receipts are retained before settlement, so a local write failure is retryable. Failed stock fulfillment retains confirmed money and uses the existing stock exception behavior. The real ledger and stock operations affect only the disposable local database.

## Before any future live integration

This sandbox build does not authorize live activation. That would require the merchant account to be current and verified, separate reviewed live configuration and activation, PayPal address/seller-protection requirements for physical shipments, reconciliation/refund and signed webhook acceptance, and a separately authorized release. The sandbox flow intentionally uses no-shipping provider approval; do not reuse that blindly for live physical shipments.

Official references: [Orders API](https://developer.paypal.com/api/orders/v2), [PayPal Checkout integration](https://developer.paypal.com/checkout/integrate), [provider origins](https://developer.paypal.com/api/rest/requests/).
