import { describe, expect, it } from 'vitest';
import { curateIntakeTools } from '../src/mcpTools/curateIntake';
import { curateQuoteTools } from '../src/mcpTools/curateQuotes';
import { ROUTE_QUOTE_SCHEMA, QUOTE_SCHEMA, QUOTE_LINE_SCHEMA, CONTACT_PEOPLE_SCHEMA, ADDRESSES_SCHEMA, CONTACTS_SCHEMA } from '../src/mcpTools/curateSchemas';
import { CONTACT_CHANNELS, QUOTE_HEADER_COLUMNS, readQuoteFields, readVendorStructuredPatch } from '../../src/lib/curateStructuredFields';
const schema = (name: string) => [...curateIntakeTools.defs, ...curateQuoteTools.defs].find(def => def.name === name)!.inputSchema as any;
describe('live connector schemas expose actual nested sourcing fields', () => {
  it('advertises vendor people, addresses and endpoint properties with their real required fields and enums', () => {
    const properties = schema('curate_save_vendor').properties;
    expect(properties.contact_people).toEqual(CONTACT_PEOPLE_SCHEMA);
    expect(properties.addresses).toEqual(ADDRESSES_SCHEMA);
    expect(properties.contacts).toEqual(CONTACTS_SCHEMA);
    expect(properties.contact_people.items.required).toEqual(['id','name']);
    expect(properties.addresses.items.required).toEqual(['id','label','address']);
    expect(properties.contacts.items.required).toEqual(['channel','handle']);
    expect(properties.contacts.items.properties.channel.enum).toEqual([...CONTACT_CHANNELS]);
    expect(properties.contacts.items.properties).toHaveProperty('person_id');
    expect(properties.addresses.items.properties).toHaveProperty('postal_code');
    expect(properties.contact_people.items.properties).toHaveProperty('title');
    const valid = { contact_people: [{ id: 'person', name: 'Wang', title: 'Owner' }], addresses: [{ id: 'home', label: 'Shop', address: 'Tea Street', postal_code: '123' }], contacts: [{ channel: 'wechat', handle: 'wang', person_id: 'person' }] };
    expect(readVendorStructuredPatch(valid)).toMatchObject(valid);
  });
  it('exposes the complete quote header, line fields, nullable money and dates', () => {
    expect(schema('curate_save_quote').properties.quote).toEqual(QUOTE_SCHEMA);
    expect(Object.keys(QUOTE_SCHEMA.properties).sort()).toEqual([...QUOTE_HEADER_COLUMNS,'lines'].sort());
    expect(QUOTE_LINE_SCHEMA.required).toEqual(['id','compass_entry_id']);
    expect(QUOTE_LINE_SCHEMA.properties.price_amount.type).toEqual(['number','null']);
    expect(QUOTE_SCHEMA.properties.validity_days.type).toEqual(['integer','null']);
    expect(QUOTE_SCHEMA.properties.quote_date.pattern).toContain('\\d{4}');
    expect(QUOTE_LINE_SCHEMA.additionalProperties).toBe(false);
    expect(readQuoteFields({ vendor_id: 'vendor', reference: 'Quote-1', issued_to: 'Teajia', quote_date: '2026-10-08', validity_days: 30, minimum_order_amount: 0, currency: 'CNY', lines: [{ id: 'line', compass_entry_id: 'tea', price_amount: null, price_currency: null, price_per_unit_grams: null }] })).toMatchObject({ currency: 'Yuan', lines: [{ price_amount: null }] });
  });
  it('uses one route shape for both tea records and quote lines', () => {
    expect(QUOTE_LINE_SCHEMA.properties.route_quotes.items).toBe(ROUTE_QUOTE_SCHEMA);
    const tea = schema('curate_add_tea').properties.route_quotes;
    expect(tea.items).toBe(ROUTE_QUOTE_SCHEMA);
    expect(ROUTE_QUOTE_SCHEMA.required).toEqual(['id','mode','amount','currency','basis','basis_quantity','price_kind']);
    expect(ROUTE_QUOTE_SCHEMA.properties.mode.enum).toEqual(['air','sea','land','courier']);
    expect(ROUTE_QUOTE_SCHEMA.properties.basis.enum).toEqual(['g','kg','piece','total']);
    expect(ROUTE_QUOTE_SCHEMA.properties.price_kind.enum).toEqual(['tea_only','landed']);
    expect(ROUTE_QUOTE_SCHEMA.additionalProperties).toBe(false);
  });
});
