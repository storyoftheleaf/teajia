import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { OrderContactsSection } from './AccountSettingsView';

const render = (whatsappNumber = '', email = '', disabled = false) => renderToStaticMarkup(
  <OrderContactsSection whatsappNumber={whatsappNumber} email={email} disabled={disabled} onWhatsAppChange={() => {}} onEmailChange={() => {}} />,
);

describe('order contact setup', () => {
  it('shows unset contacts and the existing routes without requiring WhatsApp', () => {
    const html = render('   ', '');
    expect(html).toContain('id="order-contacts"');
    expect(html).toContain('WhatsApp not set');
    expect(html).toContain('Order email not set');
    expect(html).toContain('Business WhatsApp (optional)');
    expect(html).toContain('href="/admin/activity?tab=inquiries"');
    expect(html).toContain('href="/account/profile"');
    expect(html).not.toContain('required=');
  });
  it('distinguishes entered contacts from verified email delivery and preserves view-only mode', () => {
    const html = render('+628123456789', 'orders@example.test', true);
    expect(html).toContain('Number entered');
    expect(html).toContain('Address entered');
    expect(html).toContain('does not verify email delivery');
    expect(html).toContain('type="tel"');
    expect(html).toContain('type="email"');
    expect((html.match(/disabled=""/g) ?? [])).toHaveLength(2);
    expect(html).toContain('for="order-email"');
  });
});
