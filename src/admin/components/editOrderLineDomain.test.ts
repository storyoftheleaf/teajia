import { describe, expect, it } from 'vitest';
import { editOrderLineLabel, invoiceLineToEditLine, editLineToInvoiceWrite } from './editOrderLineDomain';

describe('Edit Order invoice line mapping', () => {
  it('round-trips a custom-only Quick Invoice line without losing its name', () => {
    const loaded = invoiceLineToEditLine({
      id: 'line-custom',
      product_id: null,
      custom_name: 'Private tasting fee',
      product_name: null,
      given_name: null,
      quantity: 1,
      price_at_sale: 25,
    });

    expect(editOrderLineLabel(loaded)).toBe('Private tasting fee');
    expect(editLineToInvoiceWrite(loaded)).toEqual({
      product_id: null,
      custom_name: 'Private tasting fee',
      quantity: 1,
      price_at_sale: 25,
    });
  });

  it('keeps catalog product labels and emits a null custom name', () => {
    const loaded = invoiceLineToEditLine({
      id: 'line-product', product_id: 'product-a', custom_name: null,
      product_name: 'Wuyi Oolong', given_name: 'Rou Gui', quantity: '50', price_at_sale: '0.4',
    });
    expect(editOrderLineLabel(loaded)).toBe('Rou Gui');
    expect(editLineToInvoiceWrite(loaded)).toMatchObject({ product_id: 'product-a', custom_name: null, quantity: 50, price_at_sale: 0.4 });
  });
});
