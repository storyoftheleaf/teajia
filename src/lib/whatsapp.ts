export interface WhatsAppOrderItem {
  name: string;
  variant?: string;
  quantity: number;
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
}

export function buildOrderMessage(opts: WhatsAppMessageOptions): string {
  const date = opts.date || new Date().toLocaleDateString();
  const lines: string[] = [];

  if (opts.type === 'inquiry') {
    lines.push("Hello, I'd like to order:", '');
    opts.items.forEach(item => {
      const variant = item.variant ? ` (${item.variant})` : '';
      lines.push(`${item.name}${variant} — ${item.quantity}${item.unit} × ${item.price}`);
    });
    lines.push('');
    lines.push(`Total — ${opts.total}`);
    lines.push('');
    if (opts.customerName) lines.push(`Name — ${opts.customerName}`);
    if (opts.customerContact) lines.push(`Contact — ${opts.customerContact}`);
    if (opts.customerLocation) lines.push(`Shipping to — ${opts.customerLocation}`);
    if (opts.notes) lines.push('', opts.notes);
    if (opts.ref) lines.push('', `Ref: ${opts.ref}`);
  } else if (opts.type === 'invoice') {
    lines.push('Teajia Order', '');
    if (opts.ref) lines.push(`Invoice — ${opts.ref}`);
    if (opts.customerName) lines.push(`Customer — ${opts.customerName}`);
    lines.push(`Date — ${date}`, '');
    opts.items.forEach(item => {
      const qty = `${item.quantity}${item.unit}`;
      lines.push(`${item.name} — ${qty} × ${item.price} = ${item.total}`);
    });
    lines.push('');
    lines.push(`Subtotal — ${opts.subtotal}`);
    if (opts.shipping) lines.push(`Shipping — ${opts.shipping}`);
    lines.push(`Total — ${opts.total}`);
  } else if (opts.type === 'purchase') {
    lines.push('Purchase Order — Teajia');
    lines.push(`Date — ${date}`);
    if (opts.customerName) lines.push(`Vendor — ${opts.customerName}`);
    lines.push('');
    opts.items.forEach(item => {
      const variant = item.variant ? ` (${item.variant})` : '';
      lines.push(`${item.name}${variant} — ${item.quantity}${item.unit} × ${item.total}`);
    });
    lines.push('');
    lines.push(`Total — ${opts.total}`);
    lines.push('', 'Please confirm availability and pricing.');
  }

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
}): string {
  const lines: string[] = [];

  const statusText: Record<typeof opts.status, string> = {
    confirmed: 'Your order has been confirmed',
    filled: 'Your order has been fulfilled and is ready',
    shipped: 'Your order has been shipped',
    cancelled: 'Your order has been cancelled',
  };

  lines.push('Teajia — Order Update', '');
  if (opts.customerName) lines.push(`Hi ${opts.customerName},`);
  lines.push(statusText[opts.status] + '.');
  if (opts.ref) lines.push(`Ref — ${opts.ref}`);

  if (opts.items && opts.items.length > 0) {
    lines.push('');
    opts.items.forEach(item => {
      lines.push(`${item.name} — ${item.quantity}${item.unit}`);
    });
  }
  if (opts.total) lines.push('', `Total — ${opts.total}`);
  if (opts.note) lines.push('', opts.note);
  lines.push('', 'Thank you for choosing Teajia.');

  return lines.join('\n');
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const clean = phone.replace(/\D/g, '').replace(/^0+/, '');
  if (clean.length < 7) return `https://wa.me/?text=${encodeURIComponent(message)}`;
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}

/** Open WhatsApp with a pre-filled status update message */
export function openWhatsAppStatus(phone: string, opts: Parameters<typeof buildStatusMessage>[0]): void {
  const message = buildStatusMessage(opts);
  window.open(buildWhatsAppUrl(phone, message), '_blank');
}
