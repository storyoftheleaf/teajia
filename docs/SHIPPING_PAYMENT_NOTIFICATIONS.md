# Shipping payment notifications

Saving a new confirmed positive shipping quote queues the customer’s existing private order page with its invoice selection. The message shows the shipping charge and the current total remaining balance; tea already paid is included in the ledger calculation. The customer pays through the existing PayPal flow. No carrier fee is invented and no payment is marked received by sending a message.

## Channel and consent

Explicitly consented WhatsApp contact takes precedence. Otherwise a valid email receives a transactional email. A generic phone number without WhatsApp permission is insufficient. Checkout keeps consent unchecked and explicitly names order and shipping-payment updates. WhatsApp configuration failures remain visible rather than silently changing channels or claiming delivery.

New website orders store their contact choice and encrypted tracking capability atomically with the inquiry and invoice. Existing private links can be recovered when their capability is next validated on the order page, using only the stored inquiry email or previously recorded WhatsApp consent. Older orders without contact permission or a recoverable private capability are flagged; no lookup by public order number grants access, no existing link is rotated, and no raw token is stored in the new tables or returned by the operator status endpoint.

## Operator behavior

Orders → open order → Shipping → enter Shipping quote (USD) → Save shipping. The quote and notification intent commit together. Changing the price, or first confirming a requested quote, increments a server revision. Saving an unchanged quote does not resend. A free quote sends no payment request. Drafts wait until acceptance, and sent/void/paid/pickup or superseded requests are suppressed before dispatch. The send worker rechecks the current balance and quote under the invoice lease. A later shipping payment never deducts stock a second time.

The status beside Shipping distinguishes queued, sending, sent to the provider, retry scheduled, missing contact, setup required and uncertain outcomes requiring review. Provider acceptance is not a delivery/read receipt. A background tick recovers queued work; the quote-save request starts it immediately with waitUntil. Do not manually resend an uncertain WhatsApp attempt before inspecting the provider record.

## Activation

The owner authorized email publication and automatic WhatsApp activation on 20 November 2026. Keep credentials in Infisical and install them on the Worker through the secure release path. Required:

- `SHIPPING_PAYMENT_NOTIFICATIONS_ENABLED=true` and `SHIPPING_PAYMENT_NOTIFICATIONS_ACCOUNT_ID=acc_teajia_bali`.
- Existing `KEY_ENCRYPTION_SECRET`; do not rotate it to enable this feature.
- `APP_URL=https://www.teajia.com` (or canonical teajia.com).
- Email: existing `RESEND_API_KEY`, verified `SENDER_EMAIL`, optional `SENDER_NAME`.
- `SHIPPING_PAYMENT_BUSINESS_ACCOUNT_ID`: the connected number’s verified business account.
- WhatsApp: existing connected number, account opt-in, exact `WHATSAPP_ORDER_ACCOUNT_ID`, matching `WHATSAPP_SENDER_NUMBER`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TRANSPORT=kapso`, `KAPSO_API_KEY`, `WHATSAPP_GRAPH_API_VERSION=v24.0`, `WHATSAPP_ORDER_TEMPLATE_LANGUAGE=en_US` and dedicated `SHIPPING_PAYMENT_TEMPLATE_NAME`.

The old `WHATSAPP_CUSTOMER_CONFIRMATIONS_ENABLED` switch is deliberately independent. Leave it disabled; enabling shipping notices must not drain an old confirmation queue.

The shipping template is `teajia_shipping_payment_v1`, category UTILITY, language en_US, with five positional body values: customer name, invoice number, shipping USD, outstanding USD, private URL. On 20 November 2026 the existing Teajia number was verified CONNECTED in Kapso, the old order template was APPROVED, and the dedicated shipping template was submitted and remained PENDING at the last read. No customer message was sent during setup or testing. Email sending is independent of WhatsApp approval. The server verifies the exact template name, en_US language, UTILITY category, APPROVED state and five body parameters before allowing WhatsApp requests. The existing hourly tick rechecks even when no orders are queued; a new request also refreshes evidence older than 15 minutes. Pending requests resume automatically after approval without another quote save or deployment. Rejected, paused, stale or unavailable evidence never grants sending.

## Safety and recovery

Migrations 0071 and 0072 are DDL-only. The latter records provider approval evidence without changing customer rows. Migration 0071 adds: a quote-revision counter, encrypted notification targets and a separate shipping outbox. Existing confirmation rows are unchanged. Unique account/invoice/revision keys prevent duplicate sends. The decrypted token must match the inquiry’s stored SHA-256 hash, and invoice/account/source-inquiry bindings are rechecked before constructing a customer URL. Split invoice links preserve `?invoice=<id>`.

Resend uses a stable Idempotency-Key per request with a bounded retry window below its 24-hour retention. Ambiguous WhatsApp outcomes pause for review; provider rate-limit refusals can retry with bounded attempts. Pending requests are revalidated before every attempt, and the current balance cannot silently change under the same provider idempotency key.

Official provider contracts: [Kapso template creation and sending](https://docs.kapso.ai/docs/whatsapp/templates/simple-text), [Kapso connected phone numbers](https://docs.kapso.ai/api/platform/v1/phone-numbers/list-phone-numbers).

## Live readiness and notification

`GET /api/public/shipping-notifications` is a read-only, coarse availability endpoint for the release observer: `email_enabled`, `whatsapp_state` and `checked_at`. It exposes no recipients, links or credentials and never triggers provider metadata requests. WhatsApp readiness requires fresh evidence and the matching runtime account, template, business, transport and graph version.

The durable release observer reports email activation only after the exact Worker and Pages revision is independently proven live. A lightweight, non-LLM desktop observer then reports approved WhatsApp readiness separately. It checks only this public status, stores its state outside the checkout, deduplicates notifications and does not publish or send customer messages.
