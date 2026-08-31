export interface WhatsAppOrderItem {
  name: string;
  variant?: string;
  quantity: number;
  /**
   * How many packs of `quantity` are wanted. Absent or 1 is a single pack.
   *
   * The message IS the order here, so it has to distinguish two 25 g packs
   * from one 50 g pack: they weigh the same and they are not the same request,
   * and only one of them earns the bigger pack's price.
   */
  packs?: number;
  unit: string; // 'g', 'units', etc.
  price: string; // pre-formatted price string
  total: string; // pre-formatted total string
}

export interface WhatsAppMessageOptions {
  type: 'inquiry' | 'invoice' | 'purchase';
  ref?: string;
  date?: string;
  customerName?: string;
  customerContact?: string;
  customerLocation?: string;
  notes?: string;
  items: WhatsAppOrderItem[];
  subtotal: string;
  shipping?: string;
  total: string;
  /**
   * The currency code the figures above are quoted in, e.g. `IDR`.
   *
   * Every price in this message is a pre-formatted string, so the builder
   * cannot tell Rupiah from dollars by looking. Three call sites knew, and all
   * three hand-appended the same sentence into `notes`: the product page, the
   * teaware card and the public cart, one of them joining it to the customer's
   * own note with a blank line and two of them overwriting `notes` outright.
   * That is the shared bag this loop already pulled out of the tea card, in
   * message form: a field with a meaning, carried as free text by whoever
   * remembered.
   *
   * Naming it makes it a field of the order rather than a paragraph in it, and
   * the line lands in the same place in all three messages, below the total and
   * above the customer's own words, which is where an operator reading a
   * WhatsApp thread expects a currency to be stated.
   *
   * Omitted, or 'USD', prints nothing: the shop's books are in dollars and a
   * message that says so is stating the default back at the reader.
   */
  currency?: string;
  /** Admin draft prefill URL, appended to inquiry messages so the operator can tap it to open a pre-filled invoice form. */
  adminDraftUrl?: string;
  /**
   * The customer's payment page for this order, already built by the worker with
   * the amount, currency, reference and store on it.
   *
   * Optional, and last: a message that carries it ends on the one thing the
   * reader can act on. Absent, the message is exactly what it was before, which
   * is what every existing caller still gets.
   */
  payUrl?: string;
}

function encodeBase64UrlJson(data: unknown): string {
  const json = JSON.stringify(data);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  bytes.forEach(b => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Encode order data into a base64url `?draft=` param for the admin QuickInvoiceModal prefill. */
export function buildQuickInvoiceDraftParam(data: {
  customerName?: string;
  items?: Array<{ name: string; quantity?: number; unit?: 'g' | 'pcs'; productId?: string; price?: number }>;
  currency?: string;
  shipping?: number;
  notes?: string;
}): string {
  return encodeBase64UrlJson(data);
}

/**
 * The one separator these messages use, everywhere: a colon.
 *
 * Every line here was joined by an em-dash, which the project bans in all copy.
 * This is not internal copy: it is the text that lands in a customer's WhatsApp
 * thread, quoted back at them for as long as the conversation lasts, which made
 * it the most-read instance of the banned mark in the whole product.
 *
 * A colon is also the honest mark for what these lines are. "Total: $84" is a
 * label and its value. An em-dash sets an aside, and none of these is an aside.
 */
export function buildOrderMessage(opts: WhatsAppMessageOptions): string {
  const date = opts.date || new Date().toLocaleDateString();
  const lines: string[] = [];

  /** One sentence, written once, for whichever message needs it. */
  const currencyLine = opts.currency && opts.currency !== 'USD'
    ? `Prices as shown on the site, in ${opts.currency}.`
    : null;

  if (opts.type === 'inquiry') {
    lines.push("Hello, I'd like to order:", '');
    opts.items.forEach(item => {
      const variant = item.variant ? ` (${item.variant})` : '';
      const packs = item.packs && item.packs > 1 ? `${item.packs} × ` : '';
      lines.push(`${item.name}${variant}: ${packs}${item.quantity}${item.unit} × ${item.price}`);
    });
    lines.push('');
    lines.push(`Total: ${opts.total}`);
    if (currencyLine) lines.push(currencyLine);
    lines.push('');
    if (opts.customerName) lines.push(`Name: ${opts.customerName}`);
    if (opts.customerContact) lines.push(`Contact: ${opts.customerContact}`);
    if (opts.customerLocation) lines.push(`Shipping to: ${opts.customerLocation}`);
    if (opts.notes) lines.push('', opts.notes);
    if (opts.ref) lines.push('', `Ref: ${opts.ref}`);
    if (opts.adminDraftUrl) lines.push('', `Draft invoice: ${opts.adminDraftUrl}`);
  } else if (opts.type === 'invoice') {
    lines.push('Teajia Order', '');
    if (opts.ref) lines.push(`Invoice: ${opts.ref}`);
    if (opts.customerName) lines.push(`Customer: ${opts.customerName}`);
    lines.push(`Date: ${date}`, '');
    opts.items.forEach(item => {
      const qty = `${item.quantity}${item.unit}`;
      lines.push(`${item.name}: ${qty} × ${item.price} = ${item.total}`);
    });
    lines.push('');
    lines.push(`Subtotal: ${opts.subtotal}`);
    if (opts.shipping) lines.push(`Shipping: ${opts.shipping}`);
    lines.push(`Total: ${opts.total}`);
    if (currencyLine) lines.push(currencyLine);
  } else if (opts.type === 'purchase') {
    lines.push('Teajia Purchase Order');
    lines.push(`Date: ${date}`);
    if (opts.customerName) lines.push(`Vendor: ${opts.customerName}`);
    lines.push('');
    opts.items.forEach(item => {
      const variant = item.variant ? ` (${item.variant})` : '';
      lines.push(`${item.name}${variant}: ${item.quantity}${item.unit} × ${item.total}`);
    });
    lines.push('');
    lines.push(`Total: ${opts.total}`);
    if (currencyLine) lines.push(currencyLine);
    lines.push('', 'Please confirm availability and pricing.');
  }

  // Appended outside the branches so it is the final line of every message type,
  // after the reference the reader will quote on the transfer.
  if (opts.payUrl) lines.push('', `Pay here: ${opts.payUrl}`);

  return lines.join('\n');
}

/** Build a WhatsApp message for order status updates (confirmation, fulfillment, etc.) */
export function buildStatusMessage(opts: {
  status: 'confirmed' | 'filled' | 'shipped' | 'cancelled';
  ref?: string;
  customerName?: string;
  items?: WhatsAppOrderItem[];
  total?: string;
  note?: string;
  /**
   * Same optional pay link as `buildOrderMessage`, for the same reason.
   *
   * The admin sends a customer their order through this builder, not the order
   * builder, so the link has to reach both or it reaches nobody.
   */
  payUrl?: string;
}): string {
  const lines: string[] = [];

  const statusText: Record<typeof opts.status, string> = {
    confirmed: 'Your order has been confirmed',
    filled: 'Your order has been fulfilled and is ready',
    shipped: 'Your order has been shipped',
    cancelled: 'Your order has been cancelled',
  };

  lines.push('Teajia Order Update', '');
  if (opts.customerName) lines.push(`Hi ${opts.customerName},`);
  lines.push(statusText[opts.status] + '.');
  if (opts.ref) lines.push(`Ref: ${opts.ref}`);

  if (opts.items && opts.items.length > 0) {
    lines.push('');
    opts.items.forEach(item => {
      lines.push(`${item.name}: ${item.quantity}${item.unit}`);
    });
  }
  if (opts.total) lines.push('', `Total: ${opts.total}`);
  if (opts.note) lines.push('', opts.note);
  lines.push('', 'Thank you for choosing Teajia.');
  if (opts.payUrl) lines.push('', `Pay here: ${opts.payUrl}`);

  return lines.join('\n');
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const clean = phone.replace(/\D/g, '').replace(/^0+/, '');
  if (clean.length < 7) return `https://wa.me/?text=${encodeURIComponent(message)}`;
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}

export interface CollectionBasketItem {
  name: string;
  quantity: string | number;
  quantityUnit: string;   // 'g' for loose-leaf; 'cake', 'unit' otherwise
  note?: string;
  outOfStock?: boolean;
  priceUsd?: number | null;   // total quoted price for this line, when the curator set one
}

export function buildCollectionBasketMessage(opts: {
  collectionTitle: string;
  collectionUrl: string;
  curatorDisplayName?: string | null;
  items: CollectionBasketItem[];
  /** Optional free-text note for the whole basket. */
  note?: string | null;
}): string {
  const lines: string[] = [];
  lines.push(`Hi, I've been looking through your collection "${opts.collectionTitle}" and I'd like to request a few things:`);
  lines.push('');
  if (opts.curatorDisplayName) {
    lines.push(`Curated by ${opts.curatorDisplayName}`);
    lines.push('');
  }
  let total = 0;
  let haveAnyPrice = false;
  for (const item of opts.items) {
    const noteStr = item.note ? ` (${item.note})` : '';
    const priceStr = (item.priceUsd !== null && item.priceUsd !== undefined)
      ? ` ($${item.priceUsd})`
      : '';
    if (item.priceUsd !== null && item.priceUsd !== undefined) {
      total += Number(item.priceUsd);
      haveAnyPrice = true;
    }
    if (item.outOfStock) {
      lines.push(`• ${item.name}: asking about availability${noteStr}`);
    } else {
      lines.push(`• ${item.name}: ${item.quantity}${item.quantityUnit}${priceStr}${noteStr}`);
    }
  }
  if (haveAnyPrice) {
    lines.push('');
    lines.push(`Total: $${Math.round(total * 100) / 100}`);
  }
  if (opts.note && opts.note.trim()) {
    lines.push('');
    lines.push(`Note: ${opts.note.trim()}`);
  }
  lines.push('');
  lines.push(opts.collectionUrl);
  return lines.join('\n');
}

/** Open WhatsApp with a pre-filled status update message */
export function openWhatsAppStatus(phone: string, opts: Parameters<typeof buildStatusMessage>[0]): void {
  const message = buildStatusMessage(opts);
  window.open(buildWhatsAppUrl(phone, message), '_blank');
}

// ── Tasting Event: Send my picks ───────────────────────────────────────────

const ROMAN_NUMERALS = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
function roman(n: number): string {
  return ROMAN_NUMERALS[n] ?? String(n + 1);
}

export interface TastingPick {
  teaName: string;
  verdict?: 'love' | 'like' | 'neutral' | 'pass' | string;
  wouldBuy?: boolean;
}

export function buildTastingPicksMessage(opts: {
  guestName: string;
  guestEmail: string;
  sessionTitle?: string | null;
  picks: TastingPick[];
}): string {
  const title = opts.sessionTitle?.trim() || 'today\'s tasting';
  const lines: string[] = [];
  lines.push(`From ${opts.guestName} (${opts.guestEmail}) at ${title}`);
  lines.push('');
  lines.push("At Adrian's tasting today, here's what I want:");
  lines.push('');

  opts.picks.forEach((p, i) => {
    const verdictLabel = p.verdict
      ? p.verdict.charAt(0).toUpperCase() + p.verdict.slice(1)
      : '';
    const buyTag = p.wouldBuy ? ' · would order' : '';
    const tail = verdictLabel ? `${verdictLabel}${buyTag}` : (p.wouldBuy ? 'would order' : '');
    lines.push(tail
      ? `${roman(i)}. ${p.teaName} · ${tail}`
      : `${roman(i)}. ${p.teaName}`
    );
  });

  return lines.join('\n');
}
