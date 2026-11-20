# Shipping payment notifications

Saving a new confirmed positive shipping quote queues the customer’s existing private order page with its invoice selection. The message shows the shipping charge and the current total remaining balance; tea already paid is included in the ledger calculation. The customer pays through the existing PayPal flow. No carrier fee is invented and no payment is marked received by sending a message.

## Channel and consent

Explicitly consented WhatsApp contact takes precedence. Otherwise a valid email receives a transactional email. A generic phone number without WhatsApp permission is insufficient. Checkout keeps consent unchecked and explicitly names order and shipping-payment updates. WhatsApp configuration failures remain visible rather than silently changing channels or claiming delivery.

New website orders store their contact choice and encrypted tracking capability atomically with the inquiry and invoice. Existing private links can be recovered when their capability is next validated on the order page, using only the stored inquiry email or previously recorded WhatsApp consent. Older orders without contact permission or a recoverable private capability are flagged; no lookup by public order number grants access, no existing link is rotated, and no raw token is stored in the new tables or returned by the operator status endpoint.

## Operator behavior

Orders → open order → Shipping → enter Shipping quote (USD) → Save shipping. The quote and notification intent commit together. Changing the price, or first confirming a requested quote, increments a server revision. Saving an unchanged quote does not resend. A free quote sends no payment request. Drafts wait until acceptance, and sent/void/paid/pickup or superseded requests are suppressed before dispatch. The send worker rechecks the current balance and quote under the invoice lease. A later shipping payment never deducts stock a second time.

The status beside Shipping distinguishes queued, sending, sent to the provider, retry scheduled, missing contact, setup required and uncertain outcomes requiring review. Provider acceptance is not a delivery/read receipt. A background tick recovers queued work; the quote-save request starts it immediately with waitUntil. Do not manually resend an uncertain WhatsApp attempt before inspecting the provider record.

## Activation

Keep credentials in Infisical and install them on the Worker through the secure release path. Required:

- `SHIPPING_PAYMENT_NOTIFICATIONS_ENABLED=true` and `SHIPPING_PAYMENT_NOTIFICATIONS_ACCOUNT_ID=acc_teajia_bali`.
- Existing `KEY_ENCRYPTION_SECRET`; do not rotate it to enable this feature.
- `APP_URL=https://www.teajia.com` (or canonical teajia.com).
- Email: existing `RESEND_API_KEY`, verified `SENDER_EMAIL`, optional `SENDER_NAME`.
- WhatsApp: existing connected number, account opt-in, exact `WHATSAPP_ORDER_ACCOUNT_ID`, matching `WHATSAPP_SENDER_NUMBER`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TRANSPORT=kapso`, `KAPSO_API_KEY`, `WHATSAPP_GRAPH_API_VERSION=v24.0`, `WHATSAPP_ORDER_TEMPLATE_LANGUAGE=en_US` and dedicated `SHIPPING_PAYMENT_TEMPLATE_NAME`.

The old `WHATSAPP_CUSTOMER_CONFIRMATIONS_ENABLED` switch is deliberately independent. Leave it disabled; enabling shipping notices must not drain an old confirmation queue.

The shipping template is `teajia_shipping_payment_v1`, category UTILITY, language en_US, with five positional body values: customer name, invoice number, shipping USD, outstanding USD, private URL. On 20 November 2026 the existing Teajia number was verified CONNECTED in Kapso, the old order template was APPROVED, and the dedicated shipping template was submitted and remained PENDING at the last read. No customer message was sent during setup or testing. Verify APPROVED and category UTILITY before enabling live WhatsApp sending. No production release of this feature has been made by this build.

## Safety and recovery

Migration 0071 is DDL-only: a quote-revision counter, encrypted notification targets and a separate shipping outbox. Existing confirmation rows are unchanged. Unique account/invoice/revision keys prevent duplicate sends. The decrypted token must match the inquiry’s stored SHA-256 hash, and invoice/account/source-inquiry bindings are rechecked before constructing a customer URL. Split invoice links preserve `?invoice=<id>`.

Resend uses a stable Idempotency-Key per request with a bounded retry window below its 24-hour retention. Ambiguous WhatsApp outcomes pause for review; provider rate-limit refusals can retry with bounded attempts. Pending requests are revalidated before every attempt, and the current balance cannot silently change under the same provider idempotency key.

Official provider contracts: [Kapso template creation and sending](https://docs.kapso.ai/docs/whatsapp/templates/simple-text), [Kapso connected phone numbers](https://docs.kapso.ai/api/platform/v1/phone-numbers/list-phone-numbers).
