import { describe, expect, it } from 'vitest';
import { orderMessage, whatsappLink } from './orderMessage';

const item = (over: Record<string, unknown>) => ({ id: 'x', name: 'Tea', pricePerUnit: 1, priceIsPerGram: false, currency: 'Yuan', addedAt: '', ...over }) as any;

describe('orderMessage', () => {
  it('lists every tea on the order, one line each, Chinese then English', () => {
    const m = orderMessage({
      direction: 'purchase',
      counterpartyName: 'Wang Laoshi',
      items: [
        item({ name: 'Yiwu Gushu', chineseName: '易武古树', year: 2019, form: 'Cake', quantityUnits: 2 }),
        item({ name: 'Jingmai', year: 2021, priceIsPerGram: true, quantityGrams: 500 }),
        item({ name: 'Zhuni teapot', type: 'Teaware', quantityUnits: 1 }),
      ],
    });
    expect(m.zh).toBe('Wang Laoshi您好！我想订：\n易武古树 2019 2饼\nJingmai 2021 500g\nZhuni teapot 1件\n谢谢！');
    expect(m.en).toBe("Hello Wang Laoshi, I'd like to order:\nYiwu Gushu 2019, 2 cakes\nJingmai 2021, 500g\nZhuni teapot, 1 piece\nThank you!");
  });

  it('greets plainly when the order has no vendor', () => {
    const m = orderMessage({ direction: 'purchase', counterpartyName: 'Unknown Vendor', items: [item({ name: 'Bulang', form: 'Cake', quantityUnits: 1 })] });
    expect(m.zh.startsWith('您好！')).toBe(true);
    expect(m.en.startsWith("Hello, I'd like")).toBe(true);
  });

  it('does not greet the placeholder for an order whose vendor is not chosen yet', () => {
    const m = orderMessage({ direction: 'purchase', counterpartyName: 'No vendor yet', items: [item({ name: 'Bulang', form: 'Cake', quantityUnits: 1 })] });
    expect(m.zh.startsWith('您好！')).toBe(true);
    expect(m.en.startsWith("Hello, I'd like")).toBe(true);
    expect(m.both).not.toMatch(/No vendor yet/i);
  });

  it('builds a WhatsApp link to the vendor when the number is known', () => {
    expect(whatsappLink('hi', '+86 138-0000-1111')).toBe('https://wa.me/8613800001111?text=hi');
    expect(whatsappLink('hi', null)).toBe('https://wa.me/?text=hi');
  });
});
