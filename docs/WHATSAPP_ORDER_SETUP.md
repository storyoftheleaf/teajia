# Website order confirmations from the existing Teajia WhatsApp

The business uses one number: **+6281339712339**. A website order creates the pending request and draft invoice whether or not the customer uses WhatsApp. The customer can select an unchecked, optional consent box for an order confirmation and replies about that order. Only explicit `whatsapp_confirmation_consent: true` queues a confirmation, and the contact must be an international customer number beginning with `+`. No WhatsApp app opens and the customer does not need to press Send elsewhere.

The confirmation goes **from the account’s business number to the customer**. With an eligible Meta Coexistence connection, that outgoing conversation can appear in the existing WhatsApp Business phone app, where Adrian arranges delivery and payment. This does not create an incoming notification to Adrian. The website’s Orders queue remains the order record.

**Production sending is disabled until provider onboarding, phone connection, and template approval are complete.** Meta’s test sender is not the existing business-number connection. Coexistence onboarding requires an eligible Solution Partner or Tech Provider; follow [Meta’s Business app onboarding documentation](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users). Do not replace or unregister the working Business phone app to use ordinary Cloud API registration.

## Configuration

1. Complete Coexistence onboarding for the existing business number through an eligible provider. Obtain its production Phone Number ID and the server authorization required to send. The current transport sends to Meta Graph API; a provider that requires its own API needs a reviewed adapter before activation. Keep secrets in Infisical and Worker secrets, never in Vite variables, browser code, or account records.
2. Obtain approval for a **UTILITY** customer confirmation template with exactly five body variables, in this order:

   ```text
   Your Teajia order request {{1}} is saved.
   Name: {{2}}
   Delivery or pickup request: {{3}}
   Items and estimate: {{4}}
   Private order status and invoice: {{5}}
   We will confirm availability, shipping and payment with you personally.
   No payment has been taken. Reply here if you need help with this order.
   ```

   Example variables: `TJ-ORDER-1`, `Customer Name`, `Denpasar`, `Rou Gui 25 g; tea subtotal USD 25 (shipping pending)`, and `https://teajia.com/order/<private-tracking-token>`. The link opens the customer’s existing order page and invoice status. Never send an authenticated admin link to a customer. The worker permits only `/order/<token>` links and never truncates URLs. Text is flattened and capped at 80, 80, 160, and 300 characters respectively; links over 200 characters pause delivery.
3. Configure the Worker server-side variables:

   | Variable | Value |
   | --- | --- |
   | `WHATSAPP_CUSTOMER_CONFIRMATIONS_ENABLED` | Leave unset while onboarding; `true` explicitly enables the customer flow |
   | `WHATSAPP_ORDER_ACCOUNT_ID` | Exact account allowed to send; initially `acc_teajia_bali` |
   | `WHATSAPP_ACCESS_TOKEN` | Secret production Meta Graph API authorization for the connected account |
   | `WHATSAPP_PHONE_NUMBER_ID` | Production Phone Number ID for the existing business number |
   | `WHATSAPP_SENDER_NUMBER` | `+6281339712339`; must match that account’s saved `whatsapp_number` |
   | `WHATSAPP_CUSTOMER_TEMPLATE_NAME` | Actual approved five-variable customer utility template name |
   | `WHATSAPP_ORDER_TEMPLATE_LANGUAGE` | Actual approved language, such as `en_US` |
   | `WHATSAPP_GRAPH_API_VERSION` | A supported Graph API version verified during setup |

   The old `WHATSAPP_ORDER_TEMPLATE_NAME` is deliberately not used. An old owner-alert template or test setup cannot activate this customer flow by accident.
4. After verifying the connection and intended account, enable `accounts.order_whatsapp_notifications_enabled=1` for that account through an authorized operator operation. Both the account opt-in and exact allowlist are required, along with the new customer-flow enable switch. A customer number matching the sender is refused. Verify with mocked requests before an explicitly authorized real test.

## Consent, order atomicity, and old rows

Migration `0028_customer_whatsapp_confirmation.sql` adds `message_purpose`, `recipient_number`, and `consent_at` without changing existing messages. Old rows default to `owner_notification`; the dispatcher holds queued legacy rows for review and never reinterprets their contact or admin URL as a customer destination. Previously accepted rows remain accepted and retain their original purpose.

New consented rows use `customer_confirmation`, the normalized customer phone, the server receipt time of consent, and the private tracking link. The row is inserted in the same database transaction as the request and invoice. The unique `(account_id, invoice_id)` constraint and request fingerprint prevent duplicate sends; consent is captured on the first saved submission only. Retrying returns the original order without adding or retargeting a message, even if the checkbox changed or reset after a reload. Without consent there is no outbox row. The UI does not remember consent between reloads and resets it when the number or reply channel changes or an order succeeds.

The private tracking URL is a bearer link. It is kept in the server-side outbox to send the customer’s confirmation; do not log, publish, or expose the outbox through public endpoints. Only the customer order page’s existing safe response is accessible through that link.

The order flow attempts its own newly queued row after saving; the hourly Worker schedule handles pending work and safe retries. Missing configuration holds the message without failing or losing the order. The order receipt always says the request and invoice were saved, and warns that automatic confirmations depend on availability.

## Delivery and recovery states

- `pending`: saved with the order and waiting for processing.
- `config_required`: enablement, allowlist, business sender, or provider configuration is missing. HTTP 400/401/403/404 stops further attempts until operator repair and reset.
- `retry_scheduled`: an explicit HTTP 429 rejection; observes `Retry-After` with a maximum of five attempts.
- `accepted`: Meta returned a message ID. This confirms API acceptance, **not delivery**. Status webhooks are outside this integration.
- `review_required`: legacy owner row, invalid consent/destination/link, uncertain network outcome, ambiguous provider response, or no usable message ID. Inspect the provider before any manual reset.
- `failed`: rate-limit retries exhausted.

A sending claim has a 10-second HTTP timeout and a ten-minute lease. An expired claim becomes `review_required` instead of being replayed: the provider may have accepted it before interruption. No automatic retry is made after an uncertain outcome.

The tests use an in-memory database and mocked provider requests; they send no real messages. Run `NODE_OPTIONS=--experimental-sqlite npx vitest run worker/tests/whatsapp-order-notifications.test.ts worker/tests/website-order-request.test.ts worker/tests/website-order-lifecycle.test.ts` for consent, recipient, link, atomicity, legacy, tenant, deduplication, and retry checks.

Meta’s [Cloud API collection](https://www.postman.com/meta/whatsapp-business-platform/overview) documents the template payload; its [message status reference](https://www.postman.com/meta/whatsapp-business-platform/folder/tduohwq/webhook-payload-reference) distinguishes sent, delivered, and failed.
