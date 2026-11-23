import { describe, expect, it } from 'vitest';
import { structureVendorNotes } from './vendorNotes';
import { contactsPatch, vendorContacts } from './VendorDetailsCard';
import { summariseVendorSales } from './VendorSalesCard';

describe('vendor notes', () => {
  it('puts each thought on its own line and sets labels apart', () => {
    expect(structureVendorNotes('WeChat: weeee36 | Good gushu; sends samples fast\n- Prices: 2025 list')).toEqual([
      { label: 'WeChat', text: 'weeee36' },
      { text: 'Good gushu' },
      { text: 'sends samples fast' },
      { label: 'Prices', text: '2025 list' },
    ]);
  });

  it('leaves links and times alone, and reads nothing from nothing', () => {
    expect(structureVendorNotes('https://shop.example/a')).toEqual([{ text: 'https://shop.example/a' }]);
    expect(structureVendorNotes('Open 10:30 daily')).toEqual([{ text: 'Open 10:30 daily' }]);
    expect(structureVendorNotes('  ')).toEqual([]);
    expect(structureVendorNotes(null)).toEqual([]);
  });
});

describe('vendor contacts', () => {
  it('folds the old single columns in when the list lacks them', () => {
    expect(vendorContacts({ contacts: [{ channel: 'wechat', handle: 'bo1' }], whatsapp: '+62 1', email: undefined, phone: undefined }))
      .toEqual([{ channel: 'wechat', handle: 'bo1' }, { channel: 'whatsapp', handle: '+62 1' }]);
    expect(vendorContacts({ contacts: [{ channel: 'whatsapp', handle: '+62 2' }], whatsapp: '+62 1' }))
      .toEqual([{ channel: 'whatsapp', handle: '+62 2' }]);
  });

  it('keeps the old columns in step when the list is saved', () => {
    expect(contactsPatch([{ channel: 'email', handle: 'bo@tea.test' }, { channel: 'wechat', handle: 'bo1' }]))
      .toEqual({ contacts: [{ channel: 'email', handle: 'bo@tea.test' }, { channel: 'wechat', handle: 'bo1' }], email: 'bo@tea.test', phone: null, whatsapp: null });
  });
});

describe('vendor sales summary', () => {
  it('adds up money, buyers and teas', () => {
    const base = { invoice_number: null, status: 'Paid', created_at: null, quantity_unit: 'g', product_name: 'Tea' };
    expect(summariseVendorSales([
      { ...base, line_id: '1', invoice_id: 'a', customer_id: 'mei', customer_name: 'Mei', product_id: 't1', quantity: 50, price_at_sale: 0.5 },
      { ...base, line_id: '2', invoice_id: 'b', customer_id: 'mei', customer_name: 'Mei', product_id: 't2', quantity: 1, price_at_sale: 10 },
      { ...base, line_id: '3', invoice_id: 'c', customer_id: null, customer_name: 'Walk-in', product_id: 't1', quantity: 2, price_at_sale: 5 },
    ])).toEqual({ total: 45, buyers: 2, teas: 2 });
  });
});
