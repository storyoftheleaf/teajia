/**
 * What the shop sold of one vendor's teas: every invoice line whose product
 * came from that vendor, newest first, with who bought it.
 *
 * Adrian, 2026-11-23, on the vendor page: "you're sharing what I've purchased
 * from there, but you're not sharing what other people purchased from me."
 *
 * Only real sales count: drafts, cancelled and deleted invoices are left out.
 */

export interface VendorProductSale {
  line_id: string;
  invoice_id: string;
  invoice_number: string | null;
  status: string | null;
  created_at: string | null;
  customer_id: string | null;
  customer_name: string | null;
  product_id: string;
  product_name: string | null;
  quantity: number;
  quantity_unit: string | null;
  price_at_sale: number;
}

export async function listVendorProductSales(db: D1Database, accountId: string, vendorId: string): Promise<VendorProductSale[]> {
  const result = await db.prepare(`
    SELECT li.id AS line_id, li.invoice_id, i.invoice_number, i.status, i.created_at,
           i.customer_id, COALESCE(c.name, i.customer_name) AS customer_name,
           li.product_id, COALESCE(p.given_name, p.product_name, li.custom_name) AS product_name,
           li.quantity, COALESCE(li.quantity_unit, CASE WHEN p.type = 'Teaware' THEN 'unit' ELSE 'g' END) AS quantity_unit, li.price_at_sale
      FROM invoice_line_items li
      JOIN invoices i ON i.id = li.invoice_id AND i.account_id = ?
      JOIN products p ON p.id = li.product_id AND p.account_id = ?
      LEFT JOIN customers c ON c.id = i.customer_id AND c.account_id = ?
     WHERE p.vendor_id = ?
       AND i.deleted_at IS NULL
       AND i.cancelled_at IS NULL
       AND lower(COALESCE(i.status, '')) NOT IN ('draft', 'cancelled', 'void')
     ORDER BY i.created_at DESC
     LIMIT 300
  `).bind(accountId, accountId, accountId, vendorId).all();
  return ((result.results ?? []) as Array<Record<string, unknown>>).map(row => ({
    line_id: String(row.line_id),
    invoice_id: String(row.invoice_id),
    invoice_number: (row.invoice_number as string | null) ?? null,
    status: (row.status as string | null) ?? null,
    created_at: (row.created_at as string | null) ?? null,
    customer_id: (row.customer_id as string | null) ?? null,
    customer_name: (row.customer_name as string | null) ?? null,
    product_id: String(row.product_id),
    product_name: (row.product_name as string | null) ?? null,
    quantity: Number(row.quantity),
    quantity_unit: (row.quantity_unit as string | null) ?? null,
    price_at_sale: Number(row.price_at_sale),
  }));
}
