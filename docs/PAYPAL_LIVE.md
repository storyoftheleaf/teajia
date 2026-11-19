# Live PayPal checkout

Customers pay for confirmed tea first. New US shipping orders retain an unpriced shipping quote; the tea receipt says **Tea paid**, and shipping is charged separately later. Enter the shipping amount explicitly on the order, including zero when intentionally free. The same private order link offers the remaining balance through PayPal. Dispatch remains blocked until the shipping quote is confirmed and all known charges are paid. Pickup is separately selected and has no shipping charge or invented address.

## Secure configuration

Store credentials in Infisical, then install the production Worker secrets through the normal secure deployment path. Never place credentials in source, frontend variables, chat, or screenshots.

- `PAYPAL_LIVE_CLIENT_ID`, `PAYPAL_LIVE_CLIENT_SECRET`: the separate Teajia **live** app.
- `PAYPAL_LIVE_MERCHANT_ID`: the real receiving business merchant ID.
- `PAYPAL_LIVE_ACCOUNT_ID`: the Teajia account allowed to receive these payments.
- `PAYPAL_LIVE_WEBHOOK_ID`: the registered live webhook ID.
- `PAYPAL_LIVE_ENABLED`: exactly `true` activates this complete configuration.
- `APP_URL`: `https://teajia.com` or `https://www.teajia.com`.

Register `https://api.teajia.com/api/paypal/webhook` for `CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED`, and `PAYMENT.CAPTURE.PENDING`. Missing webhook configuration keeps live checkout disabled. Sandbox credentials, provider origins, attempt tables, UI and ledger labels remain separate; sandbox receipts cannot mark production invoices paid.

Known-stock, priced US website orders can reserve stock and proceed directly to PayPal without bank details or an operator reply. Unknown availability, unpriced items and mixed ownership retain review. Confirming a reviewed order starts its existing 24-hour payment hold.

## Automatic confirmation and recovery

Teajia creates provider orders only from the current invoice balance in USD, with merchant and quote bindings, a private invoice association and a fixed PayPal endpoint. Shipping orders provide the full saved US address through `SET_PROVIDED_ADDRESS`; explicit pickup uses `NO_SHIPPING`.

A browser return is not payment evidence. The server reads PayPal's order and validates the merchant, custom attempt ID, currency, amount and completed capture before writing the existing payment ledger. Capture IDs make ledger writes repeatable, and paid-stock allocation runs once. A pending, declined, expired or changed quote cannot produce a fresh confirmed payment.

PayPal also delivers signed webhook events. Teajia verifies their signatures through PayPal's verification API, independently reads the provider order, and uses the same invoice lease and settlement path. An approved event can capture and confirm payment even if the customer closes the return page. Completed events can recover a local ledger write that failed after provider capture. Non-success responses remain retryable by PayPal; no webhook-supplied amount is trusted.

## Refunds and operating limits

Refunds are performed in the existing PayPal Business dashboard, then recorded using Teajia's existing refund workflow with the provider refund reference. This integration does not issue automatic PayPal refunds or synchronize disputes, reversals or dashboard refunds. Check the PayPal transaction before refunding, and keep Teajia's refund record aligned. Shipping quotes are entered manually until Adrian supplies the per-kilo rate; no carrier label purchase or invented shipping fee is included.

Provider contracts: [PayPal Orders v2](https://developer.paypal.com/api/orders/v2/) and [PayPal webhook verification and retries](https://developer.paypal.com/api/rest/webhooks/).
