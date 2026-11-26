import type { InvoicePayment, OrderJourney } from './api';

/** The private order receipt, shared by tracking and sandbox checkout. */
export interface TrackedOrder {
      invoices?: Array<{ invoice_id: string; invoice_number: string; status: string }>;
      ref_number: string;
      invoice_id?: string | null;
      invoice_number?: string | null;
      order?: {
        invoice_id: string;
        invoice_number: string;
        status: string;
        fulfillment_method?: 'bali_pickup' | 'us_shipping' | null;
        shipping_cost_usd?: number | null;
        shipping_quote_status?: 'requested' | 'confirmed' | null;
        shipping_status?: string | null;
        shipped_at?: string | null;
        shipping_destination?: string | null;
        tracking_number?: string | null;
        payment_status?: string | null;
        fulfilled_at?: string | null;
        refund_required?: boolean;
        refunded_usd?: number;
        refund_due_usd?: number;
      } | null;
      payment_status?: 'unpaid' | 'partial' | 'paid';
      shipping_destination?: string | null;
      tracking_number?: string | null;
      fulfilled_at?: string | null;
      notification_status?: string | null;
      contact?: { whatsapp: string | null; email?: string | null };
      invoice_items?: Array<{ id: string; product_id?: string | null; name: string; quantity: number; quantity_unit?: 'g' | 'unit'; unit_price_usd: number; line_total_usd: number }>;
      items_json: string;
      status: string;
      total_estimate_usd: number;
      currency: string;
      created_at: string;
      // Null until the request has been priced into an invoice. There is
      // nothing to pay before that.
      payment: InvoicePayment | null;
      // Where the order stands, derived. `status` above is still the operator's
      // own filing word and is NOT what the customer should be shown.
      journey: OrderJourney;
    }

export interface CustomerOrderDetail {
  id: string;
  invoice_number: string;
  status: string;
  created_at: string;
  payment_date: string | null;
  fulfilled_at: string | null;
  refund_required?: boolean;
  refunded_usd?: number;
  refund_due_usd?: number;
  currency: string;
  items: Array<{
    id: string;
    product_id: string | null;
    name: string;
    quantity: number;
    quantity_unit?: 'g' | 'unit';
    unit_price_usd: number;
    line_total_usd: number;
    /** Launch 1, only while it is open: the Tea Chest row this line became, and whether one tap may add it. */
    chest_item_id?: string | null;
    can_keep?: boolean;
  }>;
  subtotal_amount_usd: number;
  shipping_amount_usd: number;
  shipping_quote_status?: 'requested' | 'confirmed' | null;
  total_amount_usd: number;
  contact: { whatsapp: string | null; email: string | null };
}
