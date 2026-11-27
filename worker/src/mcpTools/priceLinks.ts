/**
 * Price links, for agents: the two things a person asks for when a friend
 * wants to see what some teas cost.
 *
 *   - draft_invoice writes an invoice WITHOUT touching stock. record_sale fills
 *     the invoice and counts the grams down in one go, which is wrong when the
 *     tea has already left the shelf (stock counted by hand) or has not been
 *     sent yet. The invoice is left Draft with inventory_deducted = 0, so it
 *     stays unfulfilled until someone fulfils it on purpose, and its pay link is
 *     returned so the customer can pay from it.
 *   - share_collection_link opens a private link to a collection: a person
 *     publication with no named recipients, the same row the Collection screen's
 *     Share link writes. It never publishes to the public shop (that is
 *     publish_collection).
 *
 * Both are preview then confirm, through tickets.ts like every module.
 * The pay link comes from index.ts (resolveInvoicePayment) through
 * env.invoicePayLinks, because a module importing index.ts would be a cycle.
 */
import { formatInvoiceNumber } from '../invoiceDomain';
import { authorizeInvoiceLines, resolvePaymentRecipientUserId, SalesInvariantError } from '../teaMasterSales';
import { agentName, str } from './curateIntake';
import type { ToolAuth, ToolEnv, ToolHandler, ToolModule } from './registry';
import { consumeTicket, INVALID_TICKET, issueTicket, previewEnvelope } from './tickets';

type Row = Record<string, any>;
const OWNER_TIERS = new Set(['platform_owner', 'account_owner']);

interface DraftLine { productId: string; grams: number; pricePerGramUsd: number }
type DraftInvoiceTicket = {
  kind: 'invoices:draft';
  accountId: string;
  userId: string;
  customerName: string;
  customerId: string | null;
  customerWhatsapp: string | null;
  currency: string;
  notes: string | null;
  lines: DraftLine[];
  agent: string;
};
type ShareLinkTicket = {
  kind: 'collections:share_link';
  accountId: string;
  userId: string;
  collectionId: string;
  recipientName: string | null;
  agent: string;
};

const money = (n: number) => Math.round(n * 100) / 100;
const siteUrl = (env: ToolEnv) => (env.APP_URL || 'https://www.teajia.com').replace(/\/+$/, '');

/** Lines as the caller gave them. A price is required: 0 is a free line, a blank is refused. */
export function readDraftLines(raw: unknown): DraftLine[] | { error: string; index?: number } {
  if (!Array.isArray(raw) || raw.length === 0) return { error: 'lines_required' };
  if (raw.length > 50) return { error: 'too_many_lines' };
  const lines: DraftLine[] = [];
  for (let index = 0; index < raw.length; index++) {
    const line = raw[index] as Row;
    const productId = str(line?.product_id, 100);
    const grams = line?.grams;
    const price = line?.price_per_gram_usd;
    if (!productId) return { error: 'product_id_required', index };
    if (typeof grams !== 'number' || !Number.isFinite(grams) || grams <= 0) return { error: 'grams_must_be_positive', index };
    if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) return { error: 'price_per_gram_usd_required', index };
    lines.push({ productId, grams, pricePerGramUsd: price });
  }
  return lines;
}

function actorRole(auth: ToolAuth) {
  return OWNER_TIERS.has(auth.creatorTier) ? 'owner' : 'staff';
}

async function authorize(env: ToolEnv, auth: ToolAuth, lines: DraftLine[]) {
  try {
    return await authorizeInvoiceLines(env, {
      accountId: auth.accountId, actorUserId: auth.userId, actorRole: actorRole(auth),
      lines: lines.map(line => ({ product_id: line.productId, quantity: line.grams, price_at_sale: line.pricePerGramUsd, quantity_unit: 'g' })),
    });
  } catch (error) {
    if (error instanceof SalesInvariantError) return { error: error.code, ...(error.details ?? {}) };
    return { error: 'sales_authorization_unavailable' };
  }
}

const draftInvoice: ToolHandler = async (env, auth, args) => {
  const customerName = str(args?.customer_name, 200);
  if (!customerName) return { error: 'customer_name_required' };
  const parsed = readDraftLines(args?.lines);
  if (!Array.isArray(parsed)) return parsed;
  const customerId = str(args?.customer_id, 100);
  if (customerId) {
    const owned = await env.DB.prepare('SELECT id FROM customers WHERE id = ? AND account_id = ?').bind(customerId, auth.accountId).first();
    if (!owned) return { error: 'customer_not_found' };
  }
  const currency = str(args?.display_currency, 10) ?? 'USD';
  const notes = str(args?.notes, 2000);
  const whatsapp = str(args?.customer_whatsapp, 40);

  const confirm = str(args?.confirm, 100);
  if (!confirm) {
    const authorized = await authorize(env, auth, parsed);
    if (!Array.isArray(authorized)) return authorized;
    const names = new Map<string, string>();
    for (const line of parsed) {
      const p = await env.DB.prepare('SELECT given_name, product_name FROM products WHERE id = ? AND account_id = ?')
        .bind(line.productId, auth.accountId).first<Row>();
      names.set(line.productId, String(p?.given_name || p?.product_name || line.productId));
    }
    const previewLines = parsed.map(line => ({
      product: { id: line.productId, name: names.get(line.productId) },
      grams: line.grams, price_per_gram_usd: line.pricePerGramUsd,
      line_total_usd: money(line.grams * line.pricePerGramUsd),
    }));
    const ticket: DraftInvoiceTicket = {
      kind: 'invoices:draft', accountId: auth.accountId, userId: auth.userId,
      customerName, customerId, customerWhatsapp: whatsapp, currency, notes, lines: parsed, agent: agentName(args),
    };
    const token = await issueTicket(env, ticket, auth.tokenId);
    return previewEnvelope({
      action: 'draft_invoice',
      customer: { id: customerId, name: customerName, whatsapp },
      lines: previewLines,
      total_usd: money(previewLines.reduce((sum, line) => sum + line.line_total_usd, 0)),
      display_currency: currency,
      notes,
      note: 'Writes an unfulfilled invoice and returns its pay link. Stock is not touched; fulfil it later on purpose.',
    }, token);
  }

  const ticket = await consumeTicket<DraftInvoiceTicket, 'invoices:draft'>(env, confirm, 'invoices:draft', auth);
  if (!ticket || ticket.userId !== auth.userId || ticket.customerName !== customerName
    || JSON.stringify(ticket.lines) !== JSON.stringify(parsed)) return INVALID_TICKET;
  const authorized = await authorize(env, auth, ticket.lines);
  if (!Array.isArray(authorized)) return authorized;

  const invoiceId = crypto.randomUUID();
  const recipient = resolvePaymentRecipientUserId(authorized);
  let invoiceNumber = '';
  let committed = false;
  for (let attempt = 0; attempt < 3 && !committed; attempt++) {
    const seqRow = await env.DB.prepare(
      'UPDATE accounts SET invoice_seq = invoice_seq + 1 WHERE id = ? RETURNING invoice_seq, invoice_prefix',
    ).bind(auth.accountId).first<{ invoice_seq: number; invoice_prefix: string | null }>();
    invoiceNumber = formatInvoiceNumber(seqRow?.invoice_prefix || null, seqRow?.invoice_seq ?? 1);
    const stmts = [
      env.DB.prepare(
        `INSERT INTO invoices (id, account_id, invoice_number, customer_name, customer_whatsapp, customer_id, display_currency, shipping_cost_usd,
           status, inventory_deducted, notes, payment_status, sold_by_user_id, payment_recipient_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'Draft', 0, ?, 'unpaid', ?, ?)`,
      ).bind(invoiceId, auth.accountId, invoiceNumber, ticket.customerName, ticket.customerWhatsapp, ticket.customerId,
        ticket.currency, ticket.notes, auth.userId, recipient),
      ...authorized.map(line => env.DB.prepare(
        `INSERT INTO invoice_line_items
           (id, account_id, invoice_id, product_id, custom_name, quantity, price_at_sale, stock_owner_user_id, sales_grant_id, owner_share_type, owner_share_value, quantity_unit)
         VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, 'g')`,
      ).bind(crypto.randomUUID(), auth.accountId, invoiceId, line.product_id, line.quantity, line.price_at_sale,
        line.stock_owner_user_id, line.sales_grant_id, line.owner_share_type, line.owner_share_value)),
      env.DB.prepare(
        `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
         VALUES (?, 'INVOICE_CREATED', ?, ?, 'invoice', ?, ?)`,
      ).bind(crypto.randomUUID(), `Draft invoice ${invoiceNumber} for ${ticket.customerName} (${authorized.length} items) via MCP, ${ticket.agent}, stock not touched`,
        auth.userEmail, invoiceId, auth.accountId),
    ];
    try {
      await env.DB.batch(stmts);
      committed = true;
    } catch (error: any) {
      // Only the invoice-number index is worth a retry; anything else is a real refusal.
      if (/UNIQUE/i.test(String(error?.message || error))) continue;
      console.error('draft_invoice write failed:', error);
      return { error: 'invoice_write_unavailable' };
    }
  }
  if (!committed) return { error: 'invoice_number_collision', note: 'Nothing was written. Try again.' };

  const payUrl = env.invoicePayLinks ? await env.invoicePayLinks.payUrl(auth.accountId, invoiceId).catch(() => null) : null;
  return {
    committed: true,
    invoice_id: invoiceId,
    invoice_number: invoiceNumber,
    status: 'Draft (unfulfilled, stock not touched)',
    total_usd: money(ticket.lines.reduce((sum, line) => sum + line.grams * line.pricePerGramUsd, 0)),
    pay_url: payUrl,
    ...(payUrl ? {} : { pay_url_missing: 'No pay link yet: the recipient has not saved payment details on their profile.' }),
  };
};

const shareCollectionLink: ToolHandler = async (env, auth, args) => {
  const collectionId = str(args?.collection_id, 100);
  if (!collectionId) return { error: 'collection_id_required' };
  const recipientName = str(args?.recipient_name, 200);
  const collection = await env.DB.prepare('SELECT id, title, status FROM collections WHERE id = ? AND account_id = ?')
    .bind(collectionId, auth.accountId).first<Row>();
  if (!collection) return { error: 'collection_not_found' };
  if (collection.status === 'archived') return { error: 'collection_archived' };
  const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM collection_items WHERE collection_id = ?').bind(collectionId).first<Row>();
  if (!Number(count?.n)) return { error: 'collection_is_empty' };

  const confirm = str(args?.confirm, 100);
  if (!confirm) {
    const ticket: ShareLinkTicket = {
      kind: 'collections:share_link', accountId: auth.accountId, userId: auth.userId,
      collectionId, recipientName, agent: agentName(args),
    };
    const token = await issueTicket(env, ticket, auth.tokenId);
    return previewEnvelope({
      action: 'share_collection_link',
      collection: { id: collectionId, title: collection.title, teas: Number(count?.n) },
      recipient: recipientName,
      note: 'Opens a private link to this collection, with prices, for anyone who has the link. It is not shown in the public shop.',
    }, token);
  }
  const ticket = await consumeTicket<ShareLinkTicket, 'collections:share_link'>(env, confirm, 'collections:share_link', auth);
  if (!ticket || ticket.userId !== auth.userId || ticket.collectionId !== collectionId) return INVALID_TICKET;

  let slug: string | null = null;
  for (let attempt = 0; attempt < 5 && !slug; attempt++) {
    const candidate = collectionSlug(String(collection.title || 'collection'));
    const taken = await env.DB.prepare('SELECT 1 FROM collection_publications WHERE slug = ?').bind(candidate).first();
    if (!taken) slug = candidate;
  }
  if (!slug) return { error: 'slug_generation_failed' };
  const publicationId = `pub_${crypto.randomUUID().replace(/-/g, '')}`;
  const recipients = ticket.recipientName ? [{ name: ticket.recipientName }] : [];
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO collection_publications (id, collection_id, target_type, target_id, slug, recipients_json, created_by_user_id)
       VALUES (?, ?, 'person', NULL, ?, ?, ?)`,
    ).bind(publicationId, collectionId, slug, JSON.stringify(recipients), auth.userId),
    env.DB.prepare(
      `UPDATE collections SET status = CASE WHEN status = 'draft' THEN 'active' ELSE status END, updated_at = ? WHERE id = ?`,
    ).bind(new Date().toISOString(), collectionId),
    env.DB.prepare(
      `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
       VALUES (?, 'COLLECTION_LINK_SHARED', ?, ?, 'collection', ?, ?)`,
    ).bind(crypto.randomUUID(), `Private link ${slug}${ticket.recipientName ? ` for ${ticket.recipientName}` : ''} via MCP, ${ticket.agent}`,
      auth.userEmail, collectionId, auth.accountId),
  ]);
  return { committed: true, publication_id: publicationId, slug, url: `${siteUrl(env)}/c/${slug}`, in_public_shop: false };
};

/** The same slug shape as buildCollectionSlug in index.ts and curation.ts. */
export function collectionSlug(title: string): string {
  const base = title.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'collection';
  return `${base}-${crypto.randomUUID().replace(/-/g, '').slice(0, 4)}`;
}

export const priceLinkTools: ToolModule = {
  area: 'price-links',
  defs: [
    {
      name: 'draft_invoice', scope: 'sales:write',
      description: 'Write an unfulfilled (Draft) invoice for a customer and return its pay link, WITHOUT touching stock. Use when the tea already left the shelf or will be sent later; use record_sale only when the sale should count stock down now. Each line is product_id, grams and price_per_gram_usd (0 for a free line; a price is always required). Two steps: read the preview, confirm only after the owner agrees.',
      inputSchema: {
        type: 'object',
        properties: {
          customer_name: { type: 'string' },
          customer_id: { type: 'string' },
          customer_whatsapp: { type: 'string' },
          display_currency: { type: 'string', description: 'Defaults to USD.' },
          notes: { type: 'string' },
          lines: {
            type: 'array',
            items: {
              type: 'object',
              properties: { product_id: { type: 'string' }, grams: { type: 'number' }, price_per_gram_usd: { type: 'number' } },
              required: ['product_id', 'grams', 'price_per_gram_usd'], additionalProperties: false,
            },
          },
          agent: { type: 'string' },
          confirm: { type: 'string' },
        },
        required: ['customer_name', 'lines'], additionalProperties: false,
      },
    },
    {
      name: 'share_collection_link', scope: 'catalog:write',
      description: 'Open a private link to a collection (its teas and prices) for one person, and return the URL to send them. Never publishes to the public shop; that is publish_collection. Two steps: read the preview, confirm only after the owner agrees.',
      inputSchema: {
        type: 'object',
        properties: { collection_id: { type: 'string' }, recipient_name: { type: 'string' }, agent: { type: 'string' }, confirm: { type: 'string' } },
        required: ['collection_id'], additionalProperties: false,
      },
    },
  ],
  handlers: { draft_invoice: draftInvoice, share_collection_link: shareCollectionLink },
};
