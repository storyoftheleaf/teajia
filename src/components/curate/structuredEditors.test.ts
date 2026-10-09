import { describe, expect, it } from 'vitest';
import { vendorFieldsPayload } from './CurateVendorFields';
import { quoteDraftPayload, quoteToDraft, type QuoteDraft } from './CurateQuotesPanel';

const quote = (): QuoteDraft => ({ reference: '', issued_to: '', quote_date: '', validity_days: '', valid_until: '', minimum_order_amount: '', currency: '', payment_terms: '', discount_percent: '', discount_condition_type: '', discount_min_amount: '', discount_min_currency: '', discount_min_weight_grams: '', discount_min_quantity: '', lines: [] });
const line = () => ({ id: 'line-1', compass_entry_id: 'tea-1', vendor_item_number: '', price_amount: '', price_currency: '', unitKind: '', price_per_unit_grams: '', discount_percent: '', route_quotes: [] });

describe('structured vendor editor payload', () => {
  it('preserves all hydrated contact entries and their order while explicitly replacing the complete list', () => {
    const contacts = [{ channel: 'email', handle: 'kate@example.com' }, { channel: 'email', handle: 'info@example.com' }, { channel: 'signal', handle: '+123', label: 'Orders' }];
    const payload = vendorFieldsPayload({ vendor_code: ' LKY ', contact_people: [{ id: 'kate', name: 'Kate Ng', title: 'Sales manager' }], addresses: [], contacts });
    expect(payload).toMatchObject({ vendor_code: 'LKY', contacts_mode: 'replace', contacts });
    expect(payload.contact_people).toEqual([{ id: 'kate', name: 'Kate Ng', title: 'Sales manager' }]);
  });
  it('uses explicit empty arrays and null code to clear fields without inventing replacements', () => {
    expect(vendorFieldsPayload({ vendor_code: '', contact_people: [], addresses: [], contacts: [] })).toEqual({ vendor_code: null, contacts_mode: 'replace', contact_people: [], addresses: [], contacts: [] });
  });
  it('refuses incomplete addresses instead of putting factual data in notes', () => {
    expect(() => vendorFieldsPayload({ vendor_code: '', contact_people: [], addresses: [{ id: 'office', label: '', address: 'Queen’s Road' }], contacts: [] })).toThrow();
  });
});

describe('structured vendor quote editor payload', () => {
  it('requires a stated line currency and explicit price unit, including zero prices', () => {
    const draft = quote(); draft.lines = [{ ...line(), price_amount: '0' }];
    expect(() => quoteDraftPayload('vendor-1', draft)).toThrow(/amount and currency/);
    draft.lines[0].price_currency = 'HKD';
    expect(() => quoteDraftPayload('vendor-1', draft)).toThrow(/per piece or by weight/);
    draft.lines[0].unitKind = 'piece'; draft.lines[0].discount_percent = '0';
    expect(quoteDraftPayload('vendor-1', draft).lines?.[0]).toMatchObject({ price_amount: 0, price_currency: 'HKD', price_per_unit_grams: null, discount_percent: 0 });
  });
  it('keeps empty money unknown, and weight pricing refuses an unstated unit quantity', () => {
    const draft = quote(); draft.lines = [line()];
    expect(quoteDraftPayload('vendor-1', draft).lines?.[0]).toMatchObject({ price_amount: null, price_currency: null, discount_percent: null });
    draft.lines[0] = { ...line(), price_amount: '500', price_currency: 'HKD', unitKind: 'grams' };
    expect(() => quoteDraftPayload('vendor-1', draft)).toThrow(/weight/);
    draft.lines[0].price_per_unit_grams = '1000';
    expect(quoteDraftPayload('vendor-1', draft).lines?.[0].price_per_unit_grams).toBe(1000);
  });
  it('pairs the minimum order with its stated currency and keeps structured header terms', () => {
    const draft = { ...quote(), reference: 'LKY 2026', issued_to: 'Adrian', quote_date: '2026-10-08', validity_days: '30', valid_until: '2026-11-07', minimum_order_amount: '0', payment_terms: 'Bank transfer' };
    expect(() => quoteDraftPayload('vendor-1', draft)).toThrow(/amount and currency/);
    const payload = quoteDraftPayload('vendor-1', { ...draft, currency: 'HKD' });
    expect(payload).toMatchObject({ reference: 'LKY 2026', minimum_order_amount: 0, currency: 'HKD', validity_days: 30, payment_terms: 'Bank transfer' });
    expect(payload).not.toHaveProperty('notes');
  });
  it('rejects invalid calendar dates and discounts above the quoted limit', () => {
    expect(() => quoteDraftPayload('vendor-1', { ...quote(), quote_date: '2026-02-30' })).toThrow();
    expect(() => quoteDraftPayload('vendor-1', { ...quote(), lines: [{ ...line(), discount_percent: '101' }] })).toThrow();
  });
  it('preserves hydrated discount facts when editing other quote fields', () => {
    const saved = { id: 'quote-1', vendor_id: 'vendor-1', reference: 'LKY', minimum_order_amount: 2000, currency: 'HKD', discount_percent: 25, discount_condition_type: 'min_order_amount' as const, discount_min_amount: 5000, discount_min_currency: 'HKD', lines: [{ id: 'line-1', compass_entry_id: 'tea-1', discount_percent: 0 }] };
    const draft = quoteToDraft(saved); draft.payment_terms = 'Transfer';
    expect(quoteDraftPayload('vendor-1', draft)).toMatchObject({ discount_percent: 25, discount_condition_type: 'min_order_amount', discount_min_amount: 5000, discount_min_currency: 'HKD', minimum_order_amount: 2000, payment_terms: 'Transfer', lines: [{ discount_percent: 0 }] });
  });
  it('keeps a conditional 25% discount unknown without copying the minimum order', () => {
    const draft = { ...quote(), discount_percent: '25', discount_condition_type: 'unknown', minimum_order_amount: '2000', currency: 'HKD' };
    expect(quoteDraftPayload('vendor-1', draft)).toMatchObject({ discount_percent: 25, discount_condition_type: 'unknown', discount_min_amount: null, discount_min_currency: null, discount_min_weight_grams: null, discount_min_quantity: null });
  });
  it('accepts line discounts governed by header conditions and clears blank fields explicitly', () => {
    expect(quoteDraftPayload('vendor-1', { ...quote(), discount_condition_type: 'unknown', lines: [{ ...line(), discount_percent: '25' }] })).toMatchObject({ discount_percent: null, discount_condition_type: 'unknown', lines: [{ discount_percent: 25 }] });
    expect(quoteDraftPayload('vendor-1', quote())).toMatchObject({ discount_percent: null, discount_condition_type: null, discount_min_amount: null, discount_min_currency: null, discount_min_weight_grams: null, discount_min_quantity: null });
    expect(quoteDraftPayload('vendor-1', { ...quote(), discount_condition_type: 'none' })).toMatchObject({ discount_percent: null, discount_condition_type: 'none' });
  });
  it('requires positive paired thresholds and whole quantities without losing zero discounts', () => {
    const draft = { ...quote(), discount_percent: '0', discount_condition_type: 'min_order_amount', discount_min_amount: '5000' };
    expect(() => quoteDraftPayload('vendor-1', draft)).toThrow(/together/);
    expect(quoteDraftPayload('vendor-1', { ...draft, discount_min_currency: 'cny' })).toMatchObject({ discount_percent: 0, discount_min_amount: 5000, discount_min_currency: 'Yuan' });
    expect(() => quoteDraftPayload('vendor-1', { ...quote(), discount_percent: '25', discount_condition_type: 'min_quantity', discount_min_quantity: '1.5' })).toThrow(/whole/);
    expect(() => quoteDraftPayload('vendor-1', { ...quote(), discount_percent: '25', discount_condition_type: 'min_order_weight', discount_min_weight_grams: '0' })).toThrow(/positive/);
  });

});
