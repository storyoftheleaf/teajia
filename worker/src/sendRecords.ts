/**
 * Every invoice and every collection link the shop sends, as one record of
 * what happened to it (Adrian, 2026-11-28: "Make sure all these invoices and
 * sample sending things are getting saved, monitored and recorded, they're
 * great sources for data").
 *
 * The send is already kept where it lives: an invoice with its lines, discount
 * and pay link (invoices, invoice_line_items, payment_share_links), a
 * collection link with its teas and quoted prices (collection_publications,
 * collection_items). The one thing nothing kept was what the person did with
 * it, so `link_signals` (migration 0159) records each opening of the link and
 * of each tea on it. Everything else is read from its own table, never copied:
 *
 *   saved    user_favorites (the heart), saved_collections (the collection kept)
 *            and the invoice kept to an account (customers.user_id)
 *   tasted   customer_tasting_journal
 *   ordered  invoices made from the link: source_publication_id, or an order
 *            request whose cart lines carry the link's collectionSlug
 *   paid     invoice_payments and invoices.payment_status
 *
 * Only people seen on the link (signed in when they opened it, or who kept it)
 * are joined to saves and tastings, so a stranger's heart on the same tea is
 * never counted as the link's. The sending shop's own looks are recorded but
 * kept apart (by_sender), so a preview never reads as the friend opening it.
 *
 * Read by Manage (the order panel and the collection's links) and by the
 * Teajia connector (list_sends, get_send).
 */
import { isDiscountLine } from './invoiceDiscount';

type Db = { DB: D1Database };
type Row = Record<string, any>;

export type LinkRef =
  | { kind: 'invoice'; invoiceId: string }
  | { kind: 'collection'; publicationId: string };

export type LinkSignal = 'opened' | 'tea_opened';

const money = (n: number) => Math.round(n * 100) / 100;
const num = (value: unknown): number | null => {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};
const placeholders = (n: number) => Array.from({ length: n }, () => '?').join(',');

/** How long the same visitor opening the same thing counts once. */
const SAME_VISIT_MINUTES = 30;

/**
 * Tells visitors on one link apart without keeping who they are: the signed-in
 * person's id, or a short one-way hash of where the request came from, salted
 * with the link so it means nothing on any other link.
 */
export async function visitorKey(request: Request, viewerUserId: string | null, linkSalt: string): Promise<string> {
  if (viewerUserId) return `u:${viewerUserId}`;
  const from = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || '';
  const agent = request.headers.get('User-Agent') || '';
  const bytes = new TextEncoder().encode(`${linkSalt}|${from}|${agent}`);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return `a:${[...digest.slice(0, 8)].map(b => b.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Whether the person looking is the shop that sent the link: its owner or
 * staff, the platform's own people, or someone named as the sender.
 */
export async function viewerIsSender(env: Db, accountId: string, userId: string | null, senders: Array<string | null | undefined> = []): Promise<boolean> {
  if (!userId) return false;
  if (senders.some(id => id && id === userId)) return true;
  const row = await env.DB.prepare(
    `SELECT 1 FROM account_members WHERE account_id = ? AND user_id = ? AND status = 'active' AND role IN ('owner', 'staff')
     UNION ALL
     SELECT 1 FROM users WHERE id = ? AND platform_role IN ('platform_owner', 'platform_admin')
     LIMIT 1`,
  ).bind(accountId, userId, userId).first();
  return Boolean(row);
}

/**
 * Record one moment on a link. Best-effort by design: a page is never refused
 * or slowed into an error because its record could not be written.
 */
export async function recordLinkSignal(env: Db, input: {
  accountId: string;
  link: LinkRef;
  signal: LinkSignal;
  productId?: string | null;
  viewerUserId: string | null;
  visitorKey: string;
  bySender: boolean;
}): Promise<void> {
  const invoiceId = input.link.kind === 'invoice' ? input.link.invoiceId : null;
  const publicationId = input.link.kind === 'collection' ? input.link.publicationId : null;
  const productId = input.productId ?? null;
  try {
    await env.DB.prepare(
      `INSERT INTO link_signals (id, account_id, link_kind, invoice_id, publication_id, signal, product_id, viewer_user_id, visitor_key, by_sender)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        WHERE NOT EXISTS (
          SELECT 1 FROM link_signals
           WHERE visitor_key = ? AND signal = ?
             AND COALESCE(invoice_id, '') = ? AND COALESCE(publication_id, '') = ? AND COALESCE(product_id, '') = ?
             AND created_at > datetime('now', ?))`,
    ).bind(
      `sig_${crypto.randomUUID().replace(/-/g, '')}`, input.accountId, input.link.kind, invoiceId, publicationId,
      input.signal, productId, input.viewerUserId, input.visitorKey, input.bySender ? 1 : 0,
      input.visitorKey, input.signal, invoiceId ?? '', publicationId ?? '', productId ?? '', `-${SAME_VISIT_MINUTES} minutes`,
    ).run();
  } catch (error) {
    console.error('link signal not recorded:', error);
  }
}

// ── Reading a send back ─────────────────────────────────────────────────────

export interface SendTea {
  product_id: string | null;
  name: string;
  /** Invoice: the amount on the line. Collection: the amount suggested. */
  amount: string | null;
  /** Invoice: the line's total. Collection: the quoted price, null when the link follows the shop's price. */
  price_usd: number | null;
  times_opened: number;
  saved_by: string[];
  tasted_by: Array<{ name: string; at: string | null }>;
  ordered: boolean;
}

export interface SendOpens {
  /** Opens by anyone but the shop, from when the record began. */
  times: number;
  visitors: number;
  first_at: string | null;
  last_at: string | null;
  /** Names of signed-in people who opened it. */
  signed_in: string[];
  /** The shop's own looks, kept apart. */
  by_you: number;
  /**
   * The counter the link kept before this record began, which counts every
   * open including the shop's own. Kept so older sends are not blank.
   */
  counted_before: { times: number; last_at: string | null } | null;
}

export interface SendRecord {
  kind: 'invoice' | 'collection';
  id: string;
  title: string;
  to: string | null;
  sent_at: string | null;
  link: string | null;
  live: boolean;
  teas: SendTea[];
  opens: SendOpens;
  kept_by: Array<{ name: string; at: string | null }>;
  money: {
    subtotal_usd: number;
    discount_percent: number | null;
    discount_usd: number;
    shipping_usd: number;
    total_usd: number;
    paid_usd: number;
    claimed_usd: number;
    payment_status: string | null;
    payments: Array<{ amount_usd: number; status: string; by: string; method: string | null; claimed_at: string | null; confirmed_at: string | null }>;
  } | null;
  orders: Array<{ id: string; invoice_number: string | null; created_at: string | null; status: string | null; payment_status: string | null; total_usd: number }>;
  status: string | null;
}

async function signalsFor(env: Db, link: LinkRef) {
  const column = link.kind === 'invoice' ? 'invoice_id' : 'publication_id';
  const id = link.kind === 'invoice' ? link.invoiceId : link.publicationId;
  const { results } = await env.DB.prepare(
    `SELECT s.signal, s.product_id, s.viewer_user_id, s.visitor_key, s.by_sender, s.created_at,
            COALESCE(NULLIF(TRIM(u.name), ''), u.email) AS viewer_name
       FROM link_signals s LEFT JOIN users u ON u.id = s.viewer_user_id
      WHERE s.${column} = ? ORDER BY s.created_at ASC`,
  ).bind(id).all<Row>();
  return results ?? [];
}

function opensFrom(signals: Row[], countedBefore: SendOpens['counted_before']): SendOpens {
  const theirs = signals.filter(s => !Number(s.by_sender));
  const opened = theirs.filter(s => s.signal === 'opened');
  const any = opened.length ? opened : theirs;
  const names = new Set<string>();
  for (const s of theirs) if (s.viewer_user_id && s.viewer_name) names.add(String(s.viewer_name));
  return {
    times: opened.length,
    visitors: new Set(theirs.map(s => s.visitor_key)).size,
    first_at: any[0]?.created_at ?? null,
    last_at: any.length ? any[any.length - 1].created_at : null,
    signed_in: [...names],
    by_you: signals.filter(s => Number(s.by_sender) && s.signal === 'opened').length,
    counted_before: countedBefore,
  };
}

/** People the link reached who can be joined to their own saves and tastings. */
function viewerIds(signals: Row[], extra: Array<string | null | undefined>): string[] {
  const ids = new Set<string>();
  for (const s of signals) if (!Number(s.by_sender) && s.viewer_user_id) ids.add(String(s.viewer_user_id));
  for (const id of extra) if (id) ids.add(id);
  return [...ids];
}

async function savesAndTastings(env: Db, userIds: string[], productIds: string[]) {
  const saved = new Map<string, string[]>();
  const tasted = new Map<string, Array<{ name: string; at: string | null }>>();
  if (!userIds.length || !productIds.length) return { saved, tasted };
  const [favs, tastings] = await Promise.all([
    env.DB.prepare(
      `SELECT f.item_id, COALESCE(NULLIF(TRIM(u.name), ''), u.email) AS name
         FROM user_favorites f LEFT JOIN users u ON u.id = f.user_id
        WHERE f.user_id IN (${placeholders(userIds.length)}) AND f.item_id IN (${placeholders(productIds.length)})`,
    ).bind(...userIds, ...productIds).all<Row>(),
    env.DB.prepare(
      `SELECT j.product_id, j.created_at, COALESCE(NULLIF(TRIM(u.name), ''), u.email) AS name
         FROM customer_tasting_journal j LEFT JOIN users u ON u.id = j.user_id
        WHERE j.user_id IN (${placeholders(userIds.length)}) AND j.product_id IN (${placeholders(productIds.length)})
          AND COALESCE(j.archived, 0) = 0`,
    ).bind(...userIds, ...productIds).all<Row>(),
  ]);
  for (const row of favs.results ?? []) {
    const list = saved.get(String(row.item_id)) ?? [];
    if (row.name && !list.includes(String(row.name))) list.push(String(row.name));
    saved.set(String(row.item_id), list);
  }
  for (const row of tastings.results ?? []) {
    const list = tasted.get(String(row.product_id)) ?? [];
    list.push({ name: String(row.name ?? 'Someone'), at: row.created_at ?? null });
    tasted.set(String(row.product_id), list);
  }
  return { saved, tasted };
}

function teaOpenCounts(signals: Row[]) {
  const counts = new Map<string, number>();
  for (const s of signals) {
    if (s.signal !== 'tea_opened' || Number(s.by_sender) || !s.product_id) continue;
    counts.set(String(s.product_id), (counts.get(String(s.product_id)) ?? 0) + 1);
  }
  return counts;
}

const siteUrl = (appUrl?: string) => (appUrl || 'https://www.teajia.com').replace(/\/+$/, '');

export async function invoiceSendRecord(env: Db, accountId: string, invoiceId: string, opts: { payUrl?: string | null } = {}): Promise<SendRecord | null> {
  const invoice = await env.DB.prepare(
    `SELECT i.id, i.invoice_number, i.customer_name, i.customer_id, i.created_at, i.status, i.payment_status,
            i.shipping_cost_usd, i.sold_by_user_id, i.payment_recipient_user_id, i.deleted_at,
            c.user_id AS customer_user_id, COALESCE(NULLIF(TRIM(cu.name), ''), cu.email) AS customer_user_name
       FROM invoices i
       LEFT JOIN customers c ON c.id = i.customer_id AND c.account_id = i.account_id
       LEFT JOIN users cu ON cu.id = c.user_id
      WHERE i.id = ? AND i.account_id = ?`,
  ).bind(invoiceId, accountId).first<Row>();
  if (!invoice) return null;
  const [lineRows, payRows, shareLink, grants, signals] = await Promise.all([
    env.DB.prepare(
      `SELECT li.product_id, li.custom_name, li.quantity, li.quantity_unit, li.price_at_sale,
              COALESCE(p.given_name, p.product_name) AS product_name, p.type
         FROM invoice_line_items li LEFT JOIN products p ON p.id = li.product_id
        WHERE li.invoice_id = ? AND (li.account_id = ? OR li.account_id IS NULL) ORDER BY li.rowid ASC`,
    ).bind(invoiceId, accountId).all<Row>(),
    env.DB.prepare(
      `SELECT amount_usd, status, claimed_by, method_label, claimed_at, confirmed_at
         FROM invoice_payments WHERE invoice_id = ? AND account_id = ? ORDER BY claimed_at ASC`,
    ).bind(invoiceId, accountId).all<Row>(),
    env.DB.prepare(`SELECT open_count, last_opened_at FROM payment_share_links WHERE invoice_id = ?`).bind(invoiceId).first<Row>(),
    env.DB.prepare(
      `SELECT g.grantee_user_id FROM payment_access_grants g WHERE g.invoice_id = ? AND g.granted_via = 'link'`,
    ).bind(invoiceId).all<Row>(),
    signalsFor(env, { kind: 'invoice', invoiceId }),
  ]);
  const lines = lineRows.results ?? [];
  const teaLines = lines.filter(line => !isDiscountLine(line));
  const discountLine = lines.find(line => isDiscountLine(line));
  const productIds = [...new Set(teaLines.map(line => line.product_id).filter(Boolean).map(String))];
  const people = viewerIds(signals, [invoice.customer_user_id, ...(grants.results ?? []).map(g => g.grantee_user_id)])
    .filter(id => id !== invoice.sold_by_user_id && id !== invoice.payment_recipient_user_id);
  const { saved, tasted } = await savesAndTastings(env, people, productIds);
  const opened = teaOpenCounts(signals);

  let subtotal = 0;
  const teas: SendTea[] = teaLines.map(line => {
    const quantity = num(line.quantity) ?? 0;
    const price = num(line.price_at_sale) ?? 0;
    subtotal += quantity * price;
    const unit = line.quantity_unit === 'unit' || line.type === 'Teaware' ? (quantity === 1 ? ' piece' : ' pieces') : 'g';
    const pid = line.product_id ? String(line.product_id) : null;
    return {
      product_id: pid,
      name: String(line.product_name || line.custom_name || 'Tea'),
      amount: `${quantity}${unit}`,
      price_usd: money(quantity * price),
      times_opened: pid ? opened.get(pid) ?? 0 : 0,
      saved_by: pid ? saved.get(pid) ?? [] : [],
      tasted_by: pid ? tasted.get(pid) ?? [] : [],
      ordered: true,
    };
  });
  const discountUsd = discountLine ? money(-(num(discountLine.quantity) ?? 0) * (num(discountLine.price_at_sale) ?? 0)) : 0;
  const shipping = num(invoice.shipping_cost_usd) ?? 0;
  const payments = (payRows.results ?? []).map(p => ({
    amount_usd: money(num(p.amount_usd) ?? 0), status: String(p.status), by: String(p.claimed_by),
    method: p.method_label ?? null, claimed_at: p.claimed_at ?? null, confirmed_at: p.confirmed_at ?? null,
  }));
  return {
    kind: 'invoice',
    id: String(invoice.id),
    title: String(invoice.invoice_number || 'Invoice'),
    to: invoice.customer_name ?? null,
    sent_at: invoice.created_at ?? null,
    link: opts.payUrl ?? null,
    live: !invoice.deleted_at && invoice.status !== 'Void',
    teas,
    opens: opensFrom(signals, shareLink ? { times: Number(shareLink.open_count) || 0, last_at: shareLink.last_opened_at ?? null } : null),
    kept_by: invoice.customer_user_id ? [{ name: String(invoice.customer_user_name ?? invoice.customer_name ?? 'Someone'), at: null }] : [],
    money: {
      subtotal_usd: money(subtotal),
      discount_percent: discountLine ? num(String(discountLine.custom_name).match(/[\d.]+/)?.[0]) : null,
      discount_usd: discountUsd,
      shipping_usd: money(shipping),
      total_usd: money(subtotal - discountUsd + shipping),
      paid_usd: money(payments.filter(p => p.status === 'confirmed').reduce((sum, p) => sum + p.amount_usd, 0)),
      claimed_usd: money(payments.filter(p => p.status === 'claimed').reduce((sum, p) => sum + p.amount_usd, 0)),
      payment_status: invoice.payment_status ?? null,
      payments,
    },
    orders: [],
    status: invoice.status ?? null,
  };
}

/** Orders made from a collection link: written from it, or a cart whose lines came from it. */
async function ordersFromLink(env: Db, accountId: string, publicationId: string, slug: string) {
  const { results } = await env.DB.prepare(
    `SELECT i.id, i.invoice_number, i.created_at, i.status, i.payment_status, i.customer_id,
            (SELECT COALESCE(SUM(li.quantity * li.price_at_sale), 0) FROM invoice_line_items li WHERE li.invoice_id = i.id)
              + COALESCE(i.shipping_cost_usd, 0) AS total_usd
       FROM invoices i
      WHERE i.account_id = ? AND i.deleted_at IS NULL
        AND (i.source_publication_id = ?
             OR i.id IN (SELECT q.converted_invoice_id FROM inquiries q
                          WHERE q.account_id = ? AND q.converted_invoice_id IS NOT NULL AND json_valid(q.items)
                            AND EXISTS (SELECT 1 FROM json_each(q.items) j WHERE json_extract(j.value, '$.collectionSlug') = ?)))
      ORDER BY i.created_at ASC`,
  ).bind(accountId, publicationId, accountId, slug).all<Row>();
  return results ?? [];
}

export async function collectionSendRecord(env: Db & { APP_URL?: string }, accountId: string, publicationId: string): Promise<SendRecord | null> {
  const pub = await env.DB.prepare(
    `SELECT cp.id, cp.slug, cp.target_type, cp.recipients_json, cp.published_at, cp.unpublished_at, cp.view_count,
            cp.created_by_user_id, c.id AS collection_id, c.title, c.status
       FROM collection_publications cp JOIN collections c ON c.id = cp.collection_id
      WHERE cp.id = ? AND c.account_id = ?`,
  ).bind(publicationId, accountId).first<Row>();
  if (!pub) return null;
  const [itemRows, keptRows, signals, orders] = await Promise.all([
    env.DB.prepare(
      `SELECT ci.product_id, ci.recommended_quantity, ci.recommended_price_usd, p.type,
              COALESCE(p.given_name, p.product_name) AS name
         FROM collection_items ci LEFT JOIN products p ON p.id = ci.product_id
        WHERE ci.collection_id = ? ORDER BY ci.position ASC`,
    ).bind(pub.collection_id).all<Row>(),
    env.DB.prepare(
      `SELECT s.user_id, s.created_at, COALESCE(NULLIF(TRIM(u.name), ''), u.email) AS name
         FROM saved_collections s LEFT JOIN users u ON u.id = s.user_id
        WHERE s.collection_id = ? AND s.via_slug = ? ORDER BY s.created_at ASC`,
    ).bind(pub.collection_id, pub.slug).all<Row>(),
    signalsFor(env, { kind: 'collection', publicationId }),
    ordersFromLink(env, accountId, publicationId, String(pub.slug)),
  ]);
  const items = itemRows.results ?? [];
  const productIds = items.map(item => String(item.product_id));
  const kept = keptRows.results ?? [];
  const orderedIds = new Set<string>();
  if (orders.length) {
    const { results } = await env.DB.prepare(
      `SELECT DISTINCT product_id FROM invoice_line_items WHERE invoice_id IN (${placeholders(orders.length)}) AND product_id IS NOT NULL`,
    ).bind(...orders.map(o => o.id)).all<Row>();
    for (const row of results ?? []) orderedIds.add(String(row.product_id));
  }
  const customerUsers = orders.length
    ? ((await env.DB.prepare(
      `SELECT DISTINCT user_id FROM customers WHERE account_id = ? AND user_id IS NOT NULL AND id IN (${placeholders(orders.length)})`,
    ).bind(accountId, ...orders.map(o => o.customer_id ?? '')).all<Row>()).results ?? []).map(r => String(r.user_id))
    : [];
  const people = viewerIds(signals, [...kept.map(k => k.user_id), ...customerUsers]).filter(id => id !== pub.created_by_user_id);
  const { saved, tasted } = await savesAndTastings(env, people, productIds);
  const opened = teaOpenCounts(signals);
  let recipients: string[] = [];
  try {
    const parsed = JSON.parse(String(pub.recipients_json || '[]'));
    if (Array.isArray(parsed)) recipients = parsed.map(r => String(r?.name || r?.email || '')).filter(Boolean);
  } catch { /* an unreadable list names nobody */ }
  const teas: SendTea[] = items.map(item => {
    const pid = String(item.product_id);
    const quantity = num(item.recommended_quantity);
    return {
      product_id: pid,
      name: String(item.name || 'Tea'),
      amount: quantity == null ? null : item.type === 'Teaware' ? `${quantity}` : `${quantity}g`,
      price_usd: num(item.recommended_price_usd),
      times_opened: opened.get(pid) ?? 0,
      saved_by: saved.get(pid) ?? [],
      tasted_by: tasted.get(pid) ?? [],
      ordered: orderedIds.has(pid),
    };
  });
  return {
    kind: 'collection',
    id: String(pub.id),
    title: String(pub.title || 'Collection'),
    to: recipients.join(', ') || null,
    sent_at: pub.published_at ?? null,
    link: `${siteUrl(env.APP_URL)}/c/${pub.slug}`,
    live: !pub.unpublished_at && pub.status !== 'archived',
    teas,
    opens: opensFrom(signals, { times: Number(pub.view_count) || 0, last_at: null }),
    kept_by: kept.map(k => ({ name: String(k.name ?? 'Someone'), at: k.created_at ?? null })),
    money: null,
    orders: orders.map(o => ({
      id: String(o.id), invoice_number: o.invoice_number ?? null, created_at: o.created_at ?? null,
      status: o.status ?? null, payment_status: o.payment_status ?? null, total_usd: money(num(o.total_usd) ?? 0),
    })),
    status: pub.unpublished_at ? 'closed' : pub.status ?? null,
  };
}

export interface SendSummary {
  kind: 'invoice' | 'collection';
  id: string;
  title: string;
  to: string | null;
  sent_at: string | null;
  live: boolean;
  teas: number;
  total_usd: number | null;
  payment_status: string | null;
  opened_times: number;
  first_opened_at: string | null;
  last_opened_at: string | null;
  teas_opened: number;
  counted_before: number;
  orders: number;
}

/** Every send, newest first: invoices and the collection links sent to people. */
export async function listSends(env: Db, accountId: string, opts: { kind?: 'invoice' | 'collection'; limit?: number; customer?: string | null } = {}): Promise<SendSummary[]> {
  const limit = Math.min(Math.max(Math.floor(opts.limit ?? 30), 1), 200);
  const customer = opts.customer?.trim() ? `%${opts.customer.trim().toLowerCase()}%` : null;
  const out: SendSummary[] = [];
  if (opts.kind !== 'collection') {
    const { results } = await env.DB.prepare(
      `SELECT i.id, i.invoice_number, i.customer_name, i.created_at, i.status, i.payment_status, i.deleted_at,
              (SELECT COUNT(*) FROM invoice_line_items li WHERE li.invoice_id = i.id AND li.product_id IS NOT NULL) AS teas,
              (SELECT COALESCE(SUM(li.quantity * li.price_at_sale), 0) FROM invoice_line_items li WHERE li.invoice_id = i.id)
                + COALESCE(i.shipping_cost_usd, 0) AS total_usd,
              (SELECT open_count FROM payment_share_links l WHERE l.invoice_id = i.id) AS counted_before,
              (SELECT COUNT(*) FROM link_signals s WHERE s.invoice_id = i.id AND s.signal = 'opened' AND s.by_sender = 0) AS opened_times,
              (SELECT MIN(created_at) FROM link_signals s WHERE s.invoice_id = i.id AND s.by_sender = 0) AS first_opened_at,
              (SELECT MAX(created_at) FROM link_signals s WHERE s.invoice_id = i.id AND s.by_sender = 0) AS last_opened_at,
              (SELECT COUNT(DISTINCT product_id) FROM link_signals s WHERE s.invoice_id = i.id AND s.signal = 'tea_opened' AND s.by_sender = 0) AS teas_opened
         FROM invoices i
        WHERE i.account_id = ? AND i.deleted_at IS NULL AND (? IS NULL OR LOWER(COALESCE(i.customer_name, '')) LIKE ?)
        ORDER BY i.created_at DESC LIMIT ?`,
    ).bind(accountId, customer, customer, limit).all<Row>();
    for (const r of results ?? []) out.push({
      kind: 'invoice', id: String(r.id), title: String(r.invoice_number || 'Invoice'), to: r.customer_name ?? null,
      sent_at: r.created_at ?? null, live: r.status !== 'Void', teas: Number(r.teas) || 0,
      total_usd: money(num(r.total_usd) ?? 0), payment_status: r.payment_status ?? null,
      opened_times: Number(r.opened_times) || 0, first_opened_at: r.first_opened_at ?? null, last_opened_at: r.last_opened_at ?? null,
      teas_opened: Number(r.teas_opened) || 0, counted_before: Number(r.counted_before) || 0, orders: 1,
    });
  }
  if (opts.kind !== 'invoice') {
    const { results } = await env.DB.prepare(
      `SELECT cp.id, cp.slug, cp.recipients_json, cp.published_at, cp.unpublished_at, cp.view_count, c.title, c.status,
              (SELECT COUNT(*) FROM collection_items ci WHERE ci.collection_id = c.id) AS teas,
              (SELECT COUNT(*) FROM link_signals s WHERE s.publication_id = cp.id AND s.signal = 'opened' AND s.by_sender = 0) AS opened_times,
              (SELECT MIN(created_at) FROM link_signals s WHERE s.publication_id = cp.id AND s.by_sender = 0) AS first_opened_at,
              (SELECT MAX(created_at) FROM link_signals s WHERE s.publication_id = cp.id AND s.by_sender = 0) AS last_opened_at,
              (SELECT COUNT(DISTINCT product_id) FROM link_signals s WHERE s.publication_id = cp.id AND s.signal = 'tea_opened' AND s.by_sender = 0) AS teas_opened,
              (SELECT COUNT(*) FROM invoices i WHERE i.account_id = c.account_id AND i.deleted_at IS NULL AND i.source_publication_id = cp.id) AS orders
         FROM collection_publications cp JOIN collections c ON c.id = cp.collection_id
        WHERE c.account_id = ? AND cp.target_type NOT IN ('shop', 'store')
          AND (? IS NULL OR LOWER(COALESCE(cp.recipients_json, '')) LIKE ? OR LOWER(c.title) LIKE ?)
        ORDER BY cp.published_at DESC LIMIT ?`,
    ).bind(accountId, customer, customer, customer, limit).all<Row>();
    for (const r of results ?? []) {
      let to: string | null = null;
      try {
        const parsed = JSON.parse(String(r.recipients_json || '[]'));
        if (Array.isArray(parsed)) to = parsed.map(p => String(p?.name || p?.email || '')).filter(Boolean).join(', ') || null;
      } catch { /* names nobody */ }
      out.push({
        kind: 'collection', id: String(r.id), title: String(r.title || 'Collection'), to,
        sent_at: r.published_at ?? null, live: !r.unpublished_at && r.status !== 'archived', teas: Number(r.teas) || 0,
        total_usd: null, payment_status: null,
        opened_times: Number(r.opened_times) || 0, first_opened_at: r.first_opened_at ?? null, last_opened_at: r.last_opened_at ?? null,
        teas_opened: Number(r.teas_opened) || 0, counted_before: Number(r.view_count) || 0, orders: Number(r.orders) || 0,
      });
    }
  }
  return out.sort((a, b) => String(b.sent_at ?? '').localeCompare(String(a.sent_at ?? ''))).slice(0, limit);
}
