# Website order notifications to the Teajia WhatsApp

When a shopper places an order, Teajia creates the order request and invoice together with one owner-notification outbox row. The order flow attempts that invoice's notification immediately after saving; the hourly Worker schedule handles queued notifications and retries. Both require operator enablement. A missing provider configuration leaves the order and invoice intact; the outbox shows `config_required`. The notification goes to the Teajia account's saved `whatsapp_number` (currently `+6281339712339` for the Bali account). There is no automatic customer WhatsApp message.

The WhatsApp Cloud API requires a **separate sending number** under a Meta WhatsApp Business Account. The existing Teajia recipient number cannot also be the sending number. No sender, API token, approved template, or production send has been set up by this change.

## What to provide and configure

1. In Meta Business Manager, register a separate WhatsApp Cloud API sender number. Obtain its **Phone Number ID** and a server-side access token with permission to send WhatsApp messages. Keep the access token in Infisical, then expose it to the Worker as a secret. Never place it in Vite variables, browser code, or account records.
2. Submit and obtain approval for a **UTILITY** template with exactly six body variables, in this order. Set its actual approved name and language code in the Worker environment:

   ```text
   New Teajia order {{1}}
   Customer: {{2}}
   Contact: {{3}}
   Destination: {{4}}
   Order: {{5}}
   Invoice: {{6}}
   ```

   Example variables: `TJ-ORDER-1`, `Customer Name`, `+628111234567`, `Denpasar`, `Rou Gui 25 g; estimated USD 25`, and an HTTPS admin invoice link. The invoice is a **link**, not a PDF attachment. The link opens the admin orders view and requires an authorized Teajia sign-in; the message summary is the quick notification.

   The worker flattens line breaks and limits the six values to 80, 80, 80, 160, 300, and 200 characters respectively. Long summaries end with “see invoice.” It never cuts the invoice URL; a link over 200 characters pauses the notification for review so the link stays usable.
3. Set these Worker server-side variables. Use Infisical as the source of truth for secrets. `WHATSAPP_ORDER_ACCOUNT_ID=acc_teajia_bali` is an exact account allowlist, so configuring a provider does not activate every tenant.

   | Variable | Value |
   | --- | --- |
   | `WHATSAPP_ORDER_ACCOUNT_ID` | Account ID allowed to receive owner notifications; initially `acc_teajia_bali` |
   | `WHATSAPP_ACCESS_TOKEN` | Secret Meta API token |
   | `WHATSAPP_PHONE_NUMBER_ID` | Numeric Phone Number ID for the separate sender |
   | `WHATSAPP_SENDER_NUMBER` | Separate sender's international phone number, used for the same-number safety check |
   | `WHATSAPP_ORDER_TEMPLATE_NAME` | Exact approved utility template name |
   | `WHATSAPP_ORDER_TEMPLATE_LANGUAGE` | Exact approved language, such as `en_US` |
   | `WHATSAPP_GRAPH_API_VERSION` | Supported Graph API version, such as `v23.0`; review when Meta retires versions |

4. Confirm `accounts.whatsapp_number` is the intended recipient, then set `accounts.order_whatsapp_notifications_enabled=1` for that account through the authenticated operator setting or an authorized database operation. Both this opt-in and the exact account allowlist are required. A sender number matching the recipient is refused. Complete the initial test with a non-production recipient and mocked fetch before enabling production delivery.

The local unit tests mock the Meta HTTP request and use an in-memory database; they never send WhatsApp messages. Run `npx vitest run worker/tests/whatsapp-order-notifications.test.ts` to verify payload, account scoping, deduplication, and retry behavior.

## Delivery and recovery states

- `pending`: recorded with the order; waiting for the scheduled delivery pass.
- `config_required`: opt-in, allowlist, destination, or provider configuration is missing; HTTP 400/401/403/404 also stops automatic attempts until the operator fixes the issue and resets that row.
- `retry_scheduled`: Meta returned HTTP 429; the next attempt observes `Retry-After` when available, with a maximum of five attempts.
- `accepted`: Meta returned a message ID. This means its API accepted the message; it **does not mean delivered**. Delivery confirmation requires WhatsApp status webhooks and is outside this first integration.
- `review_required`: the network failed, Meta returned an ambiguous response, or the request was accepted without a usable message ID. Inspect Meta's message status and the outbox before any manual retry to avoid a duplicate message.
- `failed`: rate-limit retries were exhausted.

The `sending` state is claimed before the HTTP request, which has a 10-second timeout. A Worker interruption can leave it there; an expired claim moves to `review_required` on the next scheduled pass. Do not automatically replay such a row: the request may already have reached Meta. An operator should check the provider and reset it only when safe. The unique `(account_id, invoice_id)` constraint prevents a second notification row for the same invoice.

Meta's official [Cloud API collection](https://www.postman.com/meta/whatsapp-business-platform/overview) documents the template send shape, and its [message status reference](https://www.postman.com/meta/whatsapp-business-platform/folder/tduohwq/webhook-payload-reference) distinguishes `sent`, `delivered`, and `failed` statuses.
