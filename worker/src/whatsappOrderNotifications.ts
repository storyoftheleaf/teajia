import { internationalWhatsAppNumber } from '../../src/lib/whatsappContact';

/** Opted-in customer confirmations from the store’s existing business number. */
export interface WhatsAppOrderEnv {
  WHATSAPP_CUSTOMER_CONFIRMATIONS_ENABLED?: string;
  WHATSAPP_ORDER_ACCOUNT_ID?: string;
  WHATSAPP_ACCESS_TOKEN?: string;
  WHATSAPP_PHONE_NUMBER_ID?: string;
  WHATSAPP_SENDER_NUMBER?: string;
  WHATSAPP_CUSTOMER_TEMPLATE_NAME?: string;
  WHATSAPP_ORDER_TEMPLATE_LANGUAGE?: string;
  WHATSAPP_GRAPH_API_VERSION?: string;
}

export interface CustomerOrderNotificationInput {
  accountId: string;
  invoiceId: string;
  orderRef: string;
  customerName: string;
  customerContact?: string | null;
  deliveryLocation?: string | null;
  orderSummary?: string | null;
  invoiceUrl: string;
  recipientNumber: string;
  consentAt: string;
}

type OutboxRow = {
  id: string;
  account_id: string;
  invoice_id: string;
  order_ref: string;
  customer_name: string;
  customer_contact: string | null;
  delivery_location: string | null;
  order_summary: string | null;
  invoice_url: string;
  message_purpose: string;
  recipient_number: string | null;
  consent_at: string | null;
  state: string;
  attempts: number;
};

export type CustomerOrderSetupStatus = {
  ready: boolean;
  missing: string[];
  sender: string | null;
};

const MAX_ATTEMPTS = 5;

function digits(value: string | null | undefined): string {
  return (value || '').replace(/\D/g, '');
}

function validPhone(value: string | null | undefined): boolean {
  return /^\d{8,15}$/.test(digits(value));
}

function validCustomerOrderUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || (url.protocol === 'http:' && url.hostname === 'localhost')) &&
      !url.username && !url.password && !url.search && !url.hash && /^\/order\/[A-Za-z0-9_-]{32,128}$/.test(url.pathname);
  } catch { return false; }
}

function validGraphVersion(value: string | undefined): boolean {
  return /^v\d+\.\d+$/.test(value || '');
}

function shortTemplateValue(value: string | null | undefined, fallback: string, maxLength: number): string {
  const clean = value?.replace(/\s+/g, ' ').trim() || fallback;
  return clean.length <= maxLength ? clean : `${clean.slice(0, maxLength - 13).trimEnd()}… see invoice`;
}

/** Include this statement in the same D1 batch as the order and invoice inserts. */
export function buildCustomerOrderNotificationInsert(
  db: D1Database,
  input: CustomerOrderNotificationInput,
): D1PreparedStatement {
  if (!input.accountId || !input.invoiceId || !input.orderRef || !input.customerName || !input.invoiceUrl) {
    throw new Error('Missing customer order confirmation fields');
  }
  if (!internationalWhatsAppNumber(input.recipientNumber) || !input.consentAt || !Number.isFinite(Date.parse(input.consentAt))) {
    throw new Error('Customer confirmation requires an international recipient and explicit consent');
  }
  if (!validCustomerOrderUrl(input.invoiceUrl)) throw new Error('Customer confirmation requires a private order URL');
  return db.prepare(
    `INSERT OR IGNORE INTO order_whatsapp_outbox
       (id, account_id, invoice_id, order_ref, customer_name, customer_contact,
        delivery_location, order_summary, invoice_url, message_purpose, recipient_number, consent_at, state)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'customer_confirmation', ?, ?, 'pending')`,
  ).bind(
    crypto.randomUUID(), input.accountId, input.invoiceId, input.orderRef,
    input.customerName, input.customerContact?.trim() || null,
    input.deliveryLocation?.trim() || null, input.orderSummary?.trim() || null, input.invoiceUrl,
    internationalWhatsAppNumber(input.recipientNumber), input.consentAt,
  );
}

/** For a non-batched caller; use buildCustomerOrderNotificationInsert for atomic order creation. */
export async function queueCustomerOrderNotification(db: D1Database, input: CustomerOrderNotificationInput): Promise<void> {
  await buildCustomerOrderNotificationInsert(db, input).run();
}

export async function getCustomerOrderNotificationSetupStatus(
  db: D1Database,
  env: WhatsAppOrderEnv,
  accountId: string,
): Promise<CustomerOrderSetupStatus> {
  const account = await db.prepare(
    'SELECT whatsapp_number, order_whatsapp_notifications_enabled FROM accounts WHERE id = ?',
  ).bind(accountId).first<{ whatsapp_number: string | null; order_whatsapp_notifications_enabled: number }>();
  const missing: string[] = [];
  const sender = account?.whatsapp_number ?? null;
  if (env.WHATSAPP_CUSTOMER_CONFIRMATIONS_ENABLED !== 'true') missing.push('customer_confirmations_disabled');
  if (!account?.order_whatsapp_notifications_enabled) missing.push('account_opt_in');
  if (!env.WHATSAPP_ORDER_ACCOUNT_ID || env.WHATSAPP_ORDER_ACCOUNT_ID !== accountId) missing.push('account_allowlist');
  if (!validPhone(sender)) missing.push('account_whatsapp_number');
  if (!env.WHATSAPP_ACCESS_TOKEN?.trim()) missing.push('WHATSAPP_ACCESS_TOKEN');
  if (!/^\d+$/.test(env.WHATSAPP_PHONE_NUMBER_ID || '')) missing.push('WHATSAPP_PHONE_NUMBER_ID');
  if (!validPhone(env.WHATSAPP_SENDER_NUMBER)) missing.push('WHATSAPP_SENDER_NUMBER');
  if (!env.WHATSAPP_CUSTOMER_TEMPLATE_NAME?.trim()) missing.push('WHATSAPP_CUSTOMER_TEMPLATE_NAME');
  if (!env.WHATSAPP_ORDER_TEMPLATE_LANGUAGE?.trim()) missing.push('WHATSAPP_ORDER_TEMPLATE_LANGUAGE');
  if (!validGraphVersion(env.WHATSAPP_GRAPH_API_VERSION)) missing.push('WHATSAPP_GRAPH_API_VERSION');
  if (validPhone(sender) && validPhone(env.WHATSAPP_SENDER_NUMBER) &&
      digits(sender) !== digits(env.WHATSAPP_SENDER_NUMBER)) missing.push('sender_must_match_business_number');
  return { ready: missing.length === 0, missing, sender: validPhone(sender) ? sender : null };
}

export interface CustomerOrderProcessingResult {
  examined: number;
  accepted: number;
  configRequired: number;
  retryScheduled: number;
  reviewRequired: number;
  failed: number;
}

function retryDelaySeconds(response: Response, attempts: number): number {
  const raw = response.headers.get('Retry-After');
  const seconds = raw && /^\d+$/.test(raw) ? Number(raw) : NaN;
  if (Number.isFinite(seconds)) return Math.max(60, Math.min(86400, seconds));
  return Math.min(3600, 60 * 2 ** Math.max(0, attempts - 1));
}

/**
 * Can run from the existing hourly scheduled handler or an authenticated admin action.
 * A request whose outcome is uncertain stays in review_required, never auto-resubmitted.
 */
export async function processPendingCustomerOrderNotifications(
  db: D1Database,
  env: WhatsAppOrderEnv,
  options: { limit?: number; fetcher?: typeof fetch; accountId?: string; invoiceId?: string } = {},
): Promise<CustomerOrderProcessingResult> {
  if (options.invoiceId && !options.accountId) {
    throw new Error('An account ID is required to target an invoice notification');
  }
  const limit = Math.max(1, Math.min(25, Math.trunc(options.limit ?? 10)));
  const fetcher = options.fetcher ?? fetch;
  const result: CustomerOrderProcessingResult = {
    examined: 0, accepted: 0, configRequired: 0, retryScheduled: 0, reviewRequired: 0, failed: 0,
  };
  // A crashed Worker may have reached Meta. Never replay an expired claim blindly.
  await db.prepare(
    `UPDATE order_whatsapp_outbox SET state = 'review_required', last_error = 'sending_outcome_unknown',
            lease_token = NULL, lease_expires_at = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE state = 'sending' AND lease_expires_at <= CURRENT_TIMESTAMP`,
  ).run();
  const rows = await db.prepare(
    `SELECT id, account_id, invoice_id, order_ref, customer_name, customer_contact,
            delivery_location, order_summary, invoice_url, message_purpose, recipient_number, consent_at, state, attempts
      FROM order_whatsapp_outbox
      WHERE state IN ('pending', 'config_required', 'retry_scheduled')
        AND (next_attempt_at IS NULL OR next_attempt_at <= CURRENT_TIMESTAMP)
        AND (? IS NULL OR account_id = ?)
        AND (? IS NULL OR invoice_id = ?)
      ORDER BY CASE WHEN account_id = ? THEN 0 ELSE 1 END, created_at, id LIMIT ?`,
  ).bind(
    options.accountId || null, options.accountId || null,
    options.invoiceId || null, options.invoiceId || null,
    env.WHATSAPP_ORDER_ACCOUNT_ID || '', limit,
  ).all<OutboxRow>();

  for (const row of rows.results ?? []) {
    result.examined++;
    // Old owner alerts retain their meaning and must never become customer sends.
    if (row.message_purpose !== 'customer_confirmation' || !row.consent_at ||
        !internationalWhatsAppNumber(row.recipient_number) || !validCustomerOrderUrl(row.invoice_url)) {
      await db.prepare(
        `UPDATE order_whatsapp_outbox SET state = 'review_required', last_error = 'customer_confirmation_not_authorized',
                updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND state IN ('pending', 'config_required', 'retry_scheduled')`,
      ).bind(row.id).run();
      result.reviewRequired++;
      continue;
    }
    const setup = await getCustomerOrderNotificationSetupStatus(db, env, row.account_id);
    if (digits(row.recipient_number) === digits(setup.sender) || digits(row.recipient_number) === digits(env.WHATSAPP_SENDER_NUMBER)) {
      setup.missing.push('customer_matches_sender');
      setup.ready = false;
    }
    if (!setup.ready) {
      await db.prepare(
        `UPDATE order_whatsapp_outbox SET state = 'config_required', last_error = ?,
                updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND state IN ('pending', 'config_required', 'retry_scheduled')`,
      ).bind(setup.missing.join(','), row.id).run();
      result.configRequired++;
      continue;
    }
    if (row.invoice_url.length > 200) {
      await db.prepare(
        `UPDATE order_whatsapp_outbox SET state = 'config_required', last_error = 'invoice_url_too_long',
                next_attempt_at = '9999-12-31 23:59:59', updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND state IN ('pending', 'config_required', 'retry_scheduled')`,
      ).bind(row.id).run();
      result.configRequired++;
      continue;
    }

    const claim = crypto.randomUUID();
    const claimed = await db.prepare(
      `UPDATE order_whatsapp_outbox
          SET state = 'sending', attempts = attempts + 1, lease_token = ?,
              lease_expires_at = datetime('now', '+10 minutes'),
              last_error = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND state IN ('pending', 'config_required', 'retry_scheduled')
          AND (next_attempt_at IS NULL OR next_attempt_at <= CURRENT_TIMESTAMP)`,
    ).bind(claim, row.id).run();
    if (!claimed.meta?.changes) continue;

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: digits(row.recipient_number),
      type: 'template',
      template: {
        name: env.WHATSAPP_CUSTOMER_TEMPLATE_NAME,
        language: { code: env.WHATSAPP_ORDER_TEMPLATE_LANGUAGE },
        components: [{ type: 'body', parameters: [
          { type: 'text', text: shortTemplateValue(row.order_ref, 'See invoice', 80) },
          { type: 'text', text: shortTemplateValue(row.customer_name, 'Not supplied', 80) },
          { type: 'text', text: shortTemplateValue(row.delivery_location, 'Not supplied', 160) },
          { type: 'text', text: shortTemplateValue(row.order_summary, 'See invoice', 300) },
          { type: 'text', text: row.invoice_url },
        ] }],
      },
    };
    let response: Response;
    try {
      response = await fetcher(
        `https://graph.facebook.com/${env.WHATSAPP_GRAPH_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
        { method: 'POST', headers: {
          Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        }, body: JSON.stringify(payload), signal: AbortSignal.timeout(10000) },
      );
    } catch {
      // The provider may have accepted a request before the connection failed.
      await settle(db, row.id, claim, 'review_required', 'network_outcome_unknown');
      result.reviewRequired++;
      continue;
    }

    if (response.ok) {
      let providerId: string | undefined;
      try {
        const body = await response.json() as { messages?: Array<{ id?: unknown }> };
        providerId = typeof body.messages?.[0]?.id === 'string' ? body.messages[0].id : undefined;
      } catch { /* An accepted request with an unreadable receipt needs review. */ }
      if (providerId) {
        await db.prepare(
          `UPDATE order_whatsapp_outbox SET state = 'accepted', provider_message_id = ?,
                  lease_token = NULL, lease_expires_at = NULL, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND state = 'sending' AND lease_token = ?`,
        ).bind(providerId, row.id, claim).run();
        result.accepted++;
      } else {
        await settle(db, row.id, claim, 'review_required', 'accepted_without_message_id');
        result.reviewRequired++;
      }
      continue;
    }

    if (response.status === 429 && row.attempts + 1 < MAX_ATTEMPTS) {
      const delay = retryDelaySeconds(response, row.attempts + 1);
      await db.prepare(
        `UPDATE order_whatsapp_outbox SET state = 'retry_scheduled',
                next_attempt_at = datetime('now', ?), last_error = 'rate_limited',
                lease_token = NULL, lease_expires_at = NULL, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND state = 'sending' AND lease_token = ?`,
      ).bind(`+${delay} seconds`, row.id, claim).run();
      result.retryScheduled++;
    } else if ([400, 401, 403, 404].includes(response.status)) {
      // Do not reattempt until an operator resets this row after fixing config/template.
      await db.prepare(
        `UPDATE order_whatsapp_outbox SET state = 'config_required',
                next_attempt_at = '9999-12-31 23:59:59', last_error = ?,
                lease_token = NULL, lease_expires_at = NULL, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND state = 'sending' AND lease_token = ?`,
      ).bind(`provider_http_${response.status}`, row.id, claim).run();
      result.configRequired++;
    } else if (response.status === 429) {
      await settle(db, row.id, claim, 'failed', 'rate_limit_attempts_exhausted');
      result.failed++;
    } else {
      // 5xx and other responses can be ambiguous; avoid duplicate messages.
      await settle(db, row.id, claim, 'review_required', `provider_http_${response.status}`);
      result.reviewRequired++;
    }
  }
  return result;
}

async function settle(db: D1Database, id: string, claim: string, state: string, error: string): Promise<void> {
  await db.prepare(
    `UPDATE order_whatsapp_outbox SET state = ?, last_error = ?, lease_token = NULL,
            lease_expires_at = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND state = 'sending' AND lease_token = ?`,
  ).bind(state, error, id, claim).run();
}
