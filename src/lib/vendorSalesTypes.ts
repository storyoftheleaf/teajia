/** One sale of a vendor's tea (GET /api/customers/:id/product-sales). */
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
