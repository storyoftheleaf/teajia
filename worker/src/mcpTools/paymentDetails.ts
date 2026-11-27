/**
 * Payment details, for agents: the paste box on a person's profile, as a tool.
 *
 * A tea master's pay link opens only once their profile has a published way to
 * be paid. The profile's paste box (PaymentMethodsEditor) keeps the details
 * exactly as Wise or the bank hands them over, as the method's instructions,
 * and the pay page splits them into lines with a Copy beside each value. This
 * tool writes that same row, for the signed-in person's OWN profile only:
 * there is no way to name somebody else's.
 *
 * The details are bank numbers, so they are kept out of places that outlive
 * the call. The preview shows each number with all but its last four digits
 * hidden. The ticket stores only a SHA-256 of the paste, and the confirm call
 * sends the paste again, which must match. The audit row records which fields
 * changed, never the values, the same as the profile screen's own audit.
 */
import { sha256Hex } from '../inquiryDomain';
import { familyPageAllowsPay, familyPageTierOf } from '../familyPages';
import { agentName, str } from './curateIntake';
import type { ToolHandler, ToolModule } from './registry';
import { consumeTicket, INVALID_TICKET, issueTicket, previewEnvelope } from './tickets';

type Row = Record<string, any>;

/** The same limit as the profile's paste box (PASTED_DETAILS_LIMIT). */
export const PAYMENT_DETAILS_LIMIT = 1000;

type PaymentDetailsTicket = {
  kind: 'profile:payment_details';
  accountId: string;
  userId: string;
  contributorId: string;
  methodId: string | null;
  detailsHash: string;
  label: string;
  recipientName: string;
  agent: string;
};

const KEY_VALUE = /^([^:]{1,48}):\s*(\S.*)$/;

/** The paste's "Name:" line, as the profile's paste box reads it. */
export function pastedRecipientName(text: string): string | null {
  for (const line of text.split(/\r?\n/)) {
    const match = KEY_VALUE.exec(line.trim());
    if (match && /^(account holder|recipient|beneficiary)?\s*name$/i.test(match[1].trim())) return match[2].trim();
  }
  return null;
}

/** "Wise" when the paste mentions Wise, else "Bank transfer", as the paste box suggests. */
export function pastedLabel(text: string): string {
  return /\bwise\b/i.test(text) ? 'Wise' : 'Bank transfer';
}

/** Every run of digits longer than four keeps only its last four, so a preview never echoes a whole number. */
export function maskDigits(text: string): string {
  return text.replace(/[0-9][0-9 -]{3,}[0-9]/g, run => {
    const digits = run.replace(/\D/g, '');
    return digits.length <= 4 ? run : `${'•'.repeat(4)}${digits.slice(-4)}`;
  });
}

const setMyPaymentDetails: ToolHandler = async (env, auth, args) => {
  const raw = typeof args?.details === 'string' ? args.details.replace(/\r\n/g, '\n').trim() : '';
  if (!raw) return { error: 'details_required', note: 'Paste the details as the bank or Wise gives them.' };
  if (raw.length > PAYMENT_DETAILS_LIMIT) return { error: 'details_too_long', limit: PAYMENT_DETAILS_LIMIT };

  const contributor = await env.DB.prepare('SELECT id, display_name, page_tier, is_published FROM contributors WHERE user_id = ?')
    .bind(auth.userId).first<Row>();
  if (!contributor) return { error: 'profile_required', note: 'Make your profile first; payment details live on it.' };
  if (!familyPageAllowsPay(familyPageTierOf(contributor.page_tier))) return { error: 'pay_not_for_this_page' };

  const label = str(args?.label, 80) || pastedLabel(raw);
  const recipientName = str(args?.recipient_name, 120) || pastedRecipientName(raw) || String(contributor.display_name || '').trim();
  if (!recipientName) return { error: 'recipient_name_required' };

  // One row per label: pasting Wise details again replaces the Wise row
  // rather than adding a second one beside it.
  const existing = await env.DB.prepare(
    `SELECT id FROM payment_methods
      WHERE contributor_id = ? AND account_id IS NULL AND method_type = 'bank_transfer' AND label = ?
      ORDER BY position LIMIT 1`,
  ).bind(contributor.id, label).first<Row>();
  const methodId = existing ? String(existing.id) : null;
  const detailsHash = await sha256Hex(raw);

  const confirm = str(args?.confirm, 100);
  if (!confirm) {
    const ticket: PaymentDetailsTicket = {
      kind: 'profile:payment_details', accountId: auth.accountId, userId: auth.userId,
      contributorId: String(contributor.id), methodId, detailsHash, label, recipientName, agent: agentName(args),
    };
    const token = await issueTicket(env, ticket, auth.tokenId);
    return previewEnvelope({
      action: 'set_my_payment_details',
      profile: { id: contributor.id, name: contributor.display_name ?? null, published: Number(contributor.is_published) === 1 },
      method: { label, recipient_name: recipientName, replaces_existing: Boolean(methodId) },
      details_masked: maskDigits(raw),
      note: 'Saves these details on your own profile, shown on your pay links with a Copy beside each value. Confirm by sending the same details again with the token.',
    }, token);
  }

  const ticket = await consumeTicket<PaymentDetailsTicket, 'profile:payment_details'>(env, confirm, 'profile:payment_details', auth);
  if (!ticket || ticket.userId !== auth.userId || ticket.contributorId !== String(contributor.id)
    || ticket.detailsHash !== detailsHash || ticket.label !== label || ticket.recipientName !== recipientName
    || ticket.methodId !== methodId) return INVALID_TICKET;

  const id = methodId ?? crypto.randomUUID();
  const changed = ['account_identifier', 'instructions', 'is_published', 'label', 'method_type', 'recipient_name'];
  const snapshot = {
    account_id: null, method_type: 'bank_transfer', label, recipient_name: recipientName,
    has_account_identifier: false, has_instructions: true, external_host: null, has_qr_image: false, is_published: true,
  };
  const write = methodId
    ? env.DB.prepare(
      `UPDATE payment_methods SET recipient_name = ?, account_identifier = NULL, instructions = ?, is_published = 1, updated_at = datetime('now')
        WHERE id = ? AND contributor_id = ?`,
    ).bind(recipientName, raw, id, contributor.id)
    : env.DB.prepare(
      `INSERT INTO payment_methods
        (id, contributor_id, account_id, method_type, label, recipient_name, account_identifier,
         instructions, external_url, qr_image_url, position, is_published, created_at, updated_at)
       VALUES (?, ?, NULL, 'bank_transfer', ?, ?, NULL, ?, NULL, NULL,
         (SELECT COALESCE(MAX(position) + 1, 0) FROM payment_methods WHERE contributor_id = ?), 1, datetime('now'), datetime('now'))`,
    ).bind(id, contributor.id, label, recipientName, raw, contributor.id);
  await env.DB.batch([
    write,
    env.DB.prepare(
      `INSERT INTO payment_method_audit_events
        (id, contributor_id, payment_method_id, actor_user_id, action, changed_fields, redacted_snapshot, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    ).bind(crypto.randomUUID(), contributor.id, id, auth.userId, methodId ? 'updated' : 'created',
      JSON.stringify(changed), JSON.stringify({ ...snapshot, position: null, via: `mcp:${ticket.agent}` })),
  ]);
  return {
    committed: true,
    payment_method_id: id,
    label,
    recipient_name: recipientName,
    replaced_existing: Boolean(methodId),
    note: 'Your pay links can open now. An invoice made before this gets its link the next time it is read.',
  };
};

export const paymentDetailsTools: ToolModule = {
  area: 'payment-details',
  defs: [
    {
      name: 'set_my_payment_details', scope: 'signed-in',
      description: 'Save how people pay you (bank or Wise details, pasted as the bank gives them) on your OWN profile, so your invoices get a pay link. Only ever your own profile. Two steps: the preview hides all but the last four digits of each number; confirm by sending the same details again with the token, only after the person agrees.',
      inputSchema: {
        type: 'object',
        properties: {
          details: { type: 'string', description: 'The details as pasted, line by line ("Account number: ..."). Up to 1000 characters.' },
          label: { type: 'string', description: 'What the method is called on the pay page. Defaults to "Wise" when the paste mentions Wise, else "Bank transfer".' },
          recipient_name: { type: 'string', description: 'Defaults to the paste\'s "Name:" line, else your profile name.' },
          agent: { type: 'string' },
          confirm: { type: 'string' },
        },
        required: ['details'], additionalProperties: false,
      },
    },
  ],
  handlers: { set_my_payment_details: setMyPaymentDetails },
};
