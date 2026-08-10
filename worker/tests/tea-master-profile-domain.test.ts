import { describe, expect, it } from 'vitest';

import {
  normalizeLanguages,
  projectPublicFavorite,
  projectPublicPaymentMethod,
  parsePublicPaymentContext,
  resolvePublishedPaymentMethods,
  type PaymentMethodRow,
} from '../src/profileDomain';

const payment = (overrides: Partial<PaymentMethodRow> = {}): PaymentMethodRow => ({
  id: 'pay-default',
  contributor_id: 'adrian',
  account_id: null,
  method_type: 'bank_transfer',
  label: 'Bank transfer',
  recipient_name: 'Adrian',
  account_identifier: '1234',
  instructions: 'Use the reference shown.',
  external_url: null,
  qr_image_url: null,
  position: 0,
  is_published: 1,
  ...overrides,
});

describe('tea master profile domain', () => {
  it('normalizes unique short language labels', () => {
    expect(normalizeLanguages([' English ', 'Bahasa Indonesia', 'English', '', 3])).toEqual([
      'English',
      'Bahasa Indonesia',
    ]);
  });

  it('uses store methods when published store methods exist', () => {
    const defaults = [payment()];
    const store = [payment({ id: 'pay-store', account_id: 'acc_bali', label: 'QRIS' })];
    expect(resolvePublishedPaymentMethods([...defaults, ...store], 'acc_bali')).toEqual(store);
  });

  it('falls back to defaults and filters unpublished methods', () => {
    const visible = payment();
    const hidden = payment({ id: 'hidden', is_published: 0 });
    expect(resolvePublishedPaymentMethods([visible, hidden], 'acc_without_methods')).toEqual([visible]);
  });

  it('projects only the public payment allowlist', () => {
    expect(projectPublicPaymentMethod(payment())).toEqual({
      id: 'pay-default',
      method_type: 'bank_transfer',
      label: 'Bank transfer',
      recipient_name: 'Adrian',
      account_identifier: '1234',
      instructions: 'Use the reference shown.',
      external_url: null,
      qr_image_url: null,
      position: 0,
      is_published: true,
    });
  });

  it('omits private favorites and favorites without a public tea', () => {
    const row = { contributor_id: 'adrian', tea_profile_id: 'tea-1', note: 'Quiet depth', position: 0, is_public: 1 };
    expect(projectPublicFavorite({ ...row, is_public: 0 }, { id: 'tea-1', is_public: true })).toBeNull();
    expect(projectPublicFavorite(row, { id: 'tea-1', is_public: false })).toBeNull();
    expect(projectPublicFavorite(row, { id: 'tea-1', is_public: true, name: 'Rou Gui' })).toEqual({
      tea_profile_id: 'tea-1',
      note: 'Quiet depth',
      position: 0,
      tea: { id: 'tea-1', is_public: true, name: 'Rou Gui' },
    });
  });

  it('strictly validates display-only payment context', () => {
    expect(parsePublicPaymentContext(new URLSearchParams('amount=12.50&currency=IDR&reference=INV-42'))).toEqual({
      amount: '12.50', currency: 'IDR', reference: 'INV-42', errors: [],
    });
    expect(parsePublicPaymentContext(new URLSearchParams('amount=1e3&currency=ZZZ&reference=%3Cbad%3E'))).toEqual({
      amount: null,
      currency: null,
      reference: null,
      errors: ['invalid_amount', 'unsupported_currency', 'invalid_reference'],
    });
  });
});
