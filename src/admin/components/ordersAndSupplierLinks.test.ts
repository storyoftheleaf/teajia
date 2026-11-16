import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

describe('supplier link', () => {
  for (const rel of ['../../components/TeaCompass/VendorStrip.tsx', '../../components/CurateV2/VendorStrip.tsx']) {
    it(`${rel} opens the customer route, not an unread ?customer= param`, () => {
      const source = read(rel);
      expect(source).not.toContain('/admin/people?customer=');
      expect(source).toContain('/admin/people/${linkedCustomerId}');
    });
  }
});

describe('order rows link to the session by id', () => {
  it('OrdersView goes to /admin/events/:id when the order carries source_event_id', () => {
    const source = read('./OrdersView.tsx');
    expect(source).toContain('/admin/events/${encodeURIComponent(order.source_event_id)}');
    expect(source).toContain('/admin/events/${encodeURIComponent(viewingInvoice.source_event_id)}');
  });
});
