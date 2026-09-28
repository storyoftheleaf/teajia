import { describe, expect, it } from 'vitest';
import { buildOrderMessage, buildStatusMessage, type WhatsAppMessageOptions } from './whatsapp';

const order: WhatsAppMessageOptions = {
  type: 'inquiry', items: [{ name: 'Tea', quantity: 25, packs: 2, unit: 'g', price: '$8', total: '$16' }],
  subtotal: '$16', total: '$20', ref: 'TJ-123',
};

describe('personal order messages', () => {
  it('labels the requested tea subtotal and leaves delivery and final total for confirmation', () => {
    const message = buildOrderMessage(order);
    expect(message).toContain('Tea subtotal: $16');
    expect(message).toContain('Delivery and the final total will be confirmed by message.');
    expect(message).not.toContain('Total: $20');
    expect(message).toContain('Tea: 2 × 25g, $16');
    expect(message).not.toContain('25g × $8');
  });

  it('carries the private status link only when supplied', () => {
    const trackingUrl = `https://teajia.com/order/${'q'.repeat(43)}`;
    expect(buildOrderMessage({ ...order, trackingUrl })).toContain(`Your private order link: ${trackingUrl}`);
    expect(buildOrderMessage(order)).not.toContain('private order link');
  });

  it('connects a saved request to its existing invoice', () => {
    const message = buildOrderMessage({ ...order, invoiceNumber: 'TJB-00123', trackingUrl: 'https://teajia.com/order/private-token' });
    expect(message).toContain('Ref: TJ-123');
    expect(message).toContain('Invoice: TJB-00123');
    expect(message).toContain('Your private order link: https://teajia.com/order/private-token');
    expect(message).not.toContain('/admin');
  });
  it('keeps invoice totals and payment links unchanged', () => {
    const message = buildOrderMessage({ ...order, type: 'invoice', shipping: '$4', payUrl: 'https://teajia.com/people/adrian/pay' });
    expect(message).toContain('Subtotal: $16\nShipping: $4\nTotal: $20');
    expect(message).not.toContain('will be confirmed');
    expect(message).toMatch(/Pay here: https:\/\/teajia.com\/people\/adrian\/pay$/);
  });

  it('does not call a fulfilled pickup order shipped', () => {
    expect(buildStatusMessage({ status: 'filled' })).not.toMatch(/shipped|on its way/);
  });
});
