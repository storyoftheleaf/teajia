export interface EditOrderLine {
  id?: string;
  product_id: string | null;
  custom_name: string | null;
  product_name: string;
  given_name: string;
  quantity: number;
  price_at_sale: number;
}

export function invoiceLineToEditLine(item: Record<string, unknown>): EditOrderLine {
  return {
    id: typeof item.id === 'string' ? item.id : undefined,
    product_id: typeof item.product_id === 'string' ? item.product_id : null,
    custom_name: typeof item.custom_name === 'string' ? item.custom_name : null,
    product_name: typeof item.product_name === 'string' ? item.product_name : '',
    given_name: typeof item.given_name === 'string' ? item.given_name : '',
    quantity: Number(item.quantity) || 0,
    price_at_sale: Number(item.price_at_sale) || 0,
  };
}

export function editLineToInvoiceWrite(item: EditOrderLine) {
  return {
    product_id: item.product_id,
    custom_name: item.custom_name,
    quantity: item.quantity,
    price_at_sale: item.price_at_sale,
  };
}

export function editOrderLineLabel(item: EditOrderLine): string {
  return item.given_name || item.product_name || item.custom_name || 'Custom item';
}
