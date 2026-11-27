import { describe, expect, it } from 'vitest';
import { contactHref, wisdomPlaceLink, wisdomTypeLink } from './vendorLinks';
import { contactsPatch, vendorContacts, vendorSubtitle } from './VendorDetailsCard';
import { summariseVendorSales } from './VendorSalesCard';

describe('vendor contacts', () => {
  it('folds the old single columns in when the list lacks them', () => {
    expect(vendorContacts({ contacts: [{ channel: 'wechat', handle: 'bo1' }], whatsapp: '+62 1', email: undefined, phone: undefined }))
      .toEqual([{ channel: 'wechat', handle: 'bo1' }, { channel: 'whatsapp', handle: '+62 1' }]);
    expect(vendorContacts({ contacts: [{ channel: 'whatsapp', handle: '+62 2' }], whatsapp: '+62 1' }))
      .toEqual([{ channel: 'whatsapp', handle: '+62 2' }]);
  });

  it('shows contacts written in the older {type, value} shape', () => {
    expect(vendorContacts({ contacts: [{ type: 'wechat', value: 'Weee36' }] as never }))
      .toEqual([{ type: 'wechat', value: 'Weee36', channel: 'wechat', handle: 'Weee36' }]);
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

describe('the line under a vendor name', () => {
  it('does not repeat a shop recorded under their own name', () => {
    expect(vendorSubtitle({ name: 'Huang Wei', company: 'Huang Wei', city: 'Guangzhou', country: 'China' })).toBe('Guangzhou, China');
    expect(vendorSubtitle({ name: 'Huang Wei', company: 'Fangcun Tea', city: 'Guangzhou' })).toBe('Fangcun Tea · Guangzhou');
  });
});

describe('where a vendor page links', () => {
  it('reaches a contact in one tap where the channel has a link', () => {
    expect(contactHref('whatsapp', '+62 812-3456-789')).toBe('https://wa.me/628123456789');
    expect(contactHref('email', 'a@b.co')).toBe('mailto:a@b.co');
    expect(contactHref('website', 'teajia.com')).toBe('https://teajia.com');
    expect(contactHref('wechat', 'Weeee36')).toBeNull();
  });
  it('links a type or place only to a Wisdom page that exists', () => {
    expect(wisdomTypeLink('Shou Puer')?.href).toBe('/wisdom/type/shou');
    expect(wisdomTypeLink('Something else')).toBeNull();
    expect(wisdomPlaceLink('Guangxi, Southern China', 'China')?.href).toBe('/wisdom/region/guangxi');
    expect(wisdomPlaceLink(null, null)).toBeNull();
  });
});
