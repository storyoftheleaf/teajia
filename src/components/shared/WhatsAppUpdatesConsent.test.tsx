import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../admin/hooks/useAdminData', () => ({ useRates: () => ({ data: [] }) }));
vi.mock('../../lib/api', () => ({ api: { inquiries: { create: vi.fn() } } }));

import { MemoryRouter } from 'react-router-dom';
import { PublicCart } from './PublicCart';
import { WhatsAppUpdatesConsent, updateEmailError, updateEmailForRequest } from './WhatsAppUpdatesConsent';

// Adrian, 2026-11-25: WhatsApp updates are agreed by default; unticked, the
// customer may leave an email and the updates go there.
const storage = (saved: Record<string, string>) => {
  const values = new Map([['teajia_cartDetails', JSON.stringify(saved)]]);
  vi.stubGlobal('localStorage', { getItem: (k: string) => values.get(k) ?? null, setItem: () => undefined, removeItem: () => undefined });
  vi.stubGlobal('sessionStorage', { getItem: () => null, setItem: () => undefined, removeItem: () => undefined });
};
afterEach(() => vi.unstubAllGlobals());

const item = { id: 'tea', name: 'Spring oolong', category: 'tea', storeSlug: 'shop', storeName: 'Shop', quantityGrams: 50, pricePerGram: 0.5, totalPrice: 25 } as never;

describe('WhatsApp order updates at checkout', () => {
  it('opens with the WhatsApp updates box ticked', () => {
    storage({ name: 'Mei', contact: '+14155550100' });
    const html = renderToStaticMarkup(<MemoryRouter><PublicCart storeSlug="shop" storeName="Shop" cart={[item]} isOpen whatsappNumber="+6281339712339"
      onRemoveItem={() => {}} onUpdateQuantity={() => {}} onUpdatePacks={() => {}} onAddItem={() => {}} /></MemoryRouter>);
    const box = html.slice(html.indexOf('data-testid="whatsapp-updates-consent"'));
    expect(box).toMatch(/<input type="checkbox"[^>]*checked=""/);
    expect(box).not.toContain('checkout-update-email');
  });

  it('asks for an email once the box is unticked, and sends it only then', () => {
    const html = renderToStaticMarkup(<WhatsAppUpdatesConsent storeName="Shop" consent={false} onConsent={() => {}} email="" onEmail={() => {}} />);
    expect(html).toContain('Email for order updates (optional)');
    expect(updateEmailForRequest(false, ' mei@example.test ')).toBe('mei@example.test');
    expect(updateEmailForRequest(true, 'mei@example.test')).toBeUndefined();
    expect(updateEmailError(false, 'not-an-email')).toMatch(/Enter an email address/);
    expect(updateEmailError(false, '')).toBeNull();
  });
});
