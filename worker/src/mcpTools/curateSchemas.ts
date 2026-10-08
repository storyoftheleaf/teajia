/** Public MCP shapes for the private structured evidence validators. */
import { CONTACT_CHANNELS, DISCOUNT_CONDITION_TYPES } from '../../../src/lib/curateStructuredFields';
const text = (maxLength = 500) => ({ type: 'string', minLength: 1, maxLength });
const nullableText = (maxLength = 500) => ({ type: ['string', 'null'], minLength: 1, maxLength });
const list = (items: Record<string, unknown>) => ({ type: 'array', maxItems: 100, items });
export const ROUTE_QUOTE_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    id: text(100), mode: { type: 'string', enum: ['air','sea','land','courier'] },
    label: text(), amount: { type: 'number', minimum: 0 }, currency: text(20),
    basis: { type: 'string', enum: ['g','kg','piece','total'] },
    basis_quantity: { type: 'number', exclusiveMinimum: 0, description: 'Positive quantity; whole number when basis is piece.' },
    price_kind: { type: 'string', enum: ['tea_only','landed'] }, destination: text(),
  },
  required: ['id','mode','amount','currency','basis','basis_quantity','price_kind'],
};
export const ROUTE_QUOTES_SCHEMA = { ...list(ROUTE_QUOTE_SCHEMA), description: 'Explicit route price evidence; [] clears. Never applies freight.' };
export const CONTACT_PEOPLE_SCHEMA = list({
  type: 'object', additionalProperties: false,
  properties: { id: text(100), name: text(), title: text() }, required: ['id','name'],
});
export const ADDRESSES_SCHEMA = list({
  type: 'object', additionalProperties: false,
  properties: { id: text(100), label: text(), address: text(2000), city: text(), region: text(), postal_code: text(), country: text() },
  required: ['id','label','address'],
});
export const CONTACTS_SCHEMA = { ...list({
  type: 'object', additionalProperties: false,
  properties: { id: text(), channel: { type: 'string', enum: [...CONTACT_CHANNELS] }, handle: text(2000), label: text(), person_id: text() },
  required: ['channel','handle'],
}), description: 'Canonical channel/handle endpoints; IDs edit one, others append; [] clears.' };
export const QUOTE_LINE_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    id: text(100), compass_entry_id: text(100), vendor_item_number: nullableText(),
    price_amount: { type: ['number','null'], minimum: 0 }, price_currency: nullableText(20),
    price_per_unit_grams: { type: ['number','null'], exclusiveMinimum: 0 },
    discount_percent: { type: ['number','null'], minimum: 0, maximum: 100 }, route_quotes: ROUTE_QUOTES_SCHEMA,
  },
  required: ['id','compass_entry_id'],
};
export const QUOTE_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    vendor_id: { ...text(), description: 'Required for a new quote; cannot be cleared.' },
    reference: nullableText(), issued_to: nullableText(),
    quote_date: { ...nullableText(), pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    validity_days: { type: ['integer','null'], minimum: 0 },
    valid_until: { ...nullableText(), pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    minimum_order_amount: { type: ['number','null'], minimum: 0, description: 'Supply or clear together with currency.' },
    currency: { ...nullableText(20), description: 'Supported stated currency; supply or clear with minimum_order_amount.' },
    discount_percent: { type: ['number','null'], minimum: 0, maximum: 100, description: 'Explicit document-level discount evidence; never applied to prices.' },
    discount_condition_type: { type: ['string','null'], enum: [...DISCOUNT_CONDITION_TYPES, null], description: 'none means unconditional; unknown means the threshold was not stated. Null clears. Conditional discounts require an explicit header or line discount_percent.' },
    discount_min_amount: { type: ['number','null'], exclusiveMinimum: 0, description: 'Threshold for min_order_amount; supply or clear with discount_min_currency.' },
    discount_min_currency: { ...nullableText(20), description: 'Supported stated threshold currency; paired with discount_min_amount, independent of quote minimum order currency.' },
    discount_min_weight_grams: { type: ['number','null'], exclusiveMinimum: 0, description: 'Threshold in grams for min_order_weight.' },
    discount_min_quantity: { type: ['integer','null'], minimum: 1, description: 'Whole quantity threshold for min_quantity.' },
    payment_terms: nullableText(2000), lines: list(QUOTE_LINE_SCHEMA),
  },
};
