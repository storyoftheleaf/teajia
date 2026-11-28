/**
 * Fixing a mistake on an invoice (Adrian, 2026-11-28: "It's not very easy for
 * me to edit mistakes"). The name, the date and the notes can be corrected on
 * any invoice that is not void, paid or not, because none of them changes what
 * is owed. Lines, prices and the discount go through the line editor, which
 * only takes unpaid invoices.
 *
 * Every edit is written to the invoice's own timeline (activity_logs,
 * INVOICE_EDITED) saying what it was before and what it is now, so a
 * correction is never silent. The share link is the invoice's own token, which
 * none of these fields touch, so it keeps working.
 */

export type InvoiceDetailsRow = {
  customer_name?: string | null;
  notes?: string | null;
  created_at?: string | null;
  status?: string | null;
};

export type InvoiceDetailsPlan =
  | { ok: true; sets: string[]; values: unknown[]; changes: string[] }
  | { ok: false; error: string; message: string };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function realDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function shown(value: string | null | undefined): string {
  const text = (value ?? '').trim();
  return text ? `"${text.length > 80 ? `${text.slice(0, 77)}...` : text}"` : 'nothing';
}

/** What a details edit changes, or why it is refused. Unchanged fields are left out. */
export function planInvoiceDetailsEdit(invoice: InvoiceDetailsRow, body: Record<string, unknown>): InvoiceDetailsPlan {
  if (invoice.status === 'Void') return { ok: false, error: 'invoice_void', message: 'A void invoice cannot be edited' };
  const sets: string[] = [];
  const values: unknown[] = [];
  const changes: string[] = [];

  if (Object.prototype.hasOwnProperty.call(body, 'customer_name')) {
    const raw = body.customer_name;
    if (typeof raw !== 'string' || !raw.trim() || raw.trim().length > 200) {
      return { ok: false, error: 'invalid_customer_name', message: 'The name must be between 1 and 200 characters' };
    }
    const next = raw.trim();
    if (next !== (invoice.customer_name ?? '')) {
      sets.push('customer_name = ?');
      values.push(next);
      changes.push(`name ${shown(invoice.customer_name)} to ${shown(next)}`);
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, 'notes')) {
    const raw = body.notes;
    if (raw !== null && (typeof raw !== 'string' || raw.length > 2000)) {
      return { ok: false, error: 'invalid_notes', message: 'Notes must be text under 2000 characters' };
    }
    const next = typeof raw === 'string' && raw.trim() ? raw.trim() : null;
    if ((next ?? '') !== (invoice.notes ?? '').trim()) {
      sets.push('notes = ?');
      values.push(next);
      changes.push(`notes ${shown(invoice.notes)} to ${shown(next)}`);
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, 'invoice_date')) {
    const raw = body.invoice_date;
    if (typeof raw !== 'string' || !realDate(raw)) {
      return { ok: false, error: 'invalid_invoice_date', message: 'The date must be a real day, written YYYY-MM-DD' };
    }
    const before = String(invoice.created_at ?? '').slice(0, 10);
    if (raw !== before) {
      // Keep the time of day, so the order of a day's invoices is unchanged.
      sets.push(`created_at = ? || CASE WHEN length(created_at) > 10 THEN substr(created_at, 11) ELSE ' 00:00:00' END`);
      values.push(raw);
      changes.push(`date ${before || 'nothing'} to ${raw}`);
    }
  }

  return { ok: true, sets, values, changes };
}

type Line = { product_id?: string | null; custom_name?: string | null; product_name?: string | null; quantity?: unknown; price_at_sale?: unknown };

function lineWords(line: Line, names: Map<string, string>): string {
  const name = (line.product_id ? names.get(line.product_id) : null) || line.custom_name || line.product_name || 'tea';
  const price = Number(line.price_at_sale);
  return `${name} ${Number(line.quantity)}g at $${Number.isFinite(price) ? price.toFixed(2) : '?'}`;
}

/** Lines before and after, in a few words, for the timeline. Empty when they are the same. */
export function describeLineChange(before: Line[], after: Line[], names: Map<string, string>): string {
  const was = before.map(line => lineWords(line, names));
  const now = after.map(line => lineWords(line, names));
  if (was.join('|') === now.join('|')) return '';
  return `lines were ${was.join('; ') || 'none'}; now ${now.join('; ') || 'none'}`;
}
