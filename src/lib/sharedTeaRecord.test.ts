import { describe, expect, it } from 'vitest';
import { sharedTeaRecordHref, sharedTeaRecordId, sharedStockRecordId, sharedStockRecordHref } from './sharedTeaRecord';

describe('the same durable tea record from Inventory', () => {
  it('uses the product backlink even before Compass has hydrated', () => {
    expect(sharedTeaRecordId({ id: 'stock-1', sourceCompassEntryId: 'tea-1' }, [])).toBe('tea-1');
  });
  it('resolves a Compass-owned product link without manufacturing a second record', () => {
    const entries = [{ id: 'tea-1', draftProductId: 'stock-1' }, { id: 'tea-2', draftProductId: 'stock-2' }];
    expect(sharedTeaRecordId({ id: 'stock-2' }, entries)).toBe('tea-2');
    expect(entries).toHaveLength(2);
  });
  it('prefers the explicit product backlink over a conflicting cached draft link', () => {
    expect(sharedTeaRecordId({ id: 'stock-1', sourceCompassEntryId: 'tea-1' }, [{ id: 'tea-2', draftProductId: 'stock-1' }])).toBe('tea-1');
  });
  it('leaves an unlinked product unlinked', () => {
    expect(sharedTeaRecordId({ id: 'stock-1' }, [{ id: 'tea-1', draftProductId: 'stock-2' }])).toBeUndefined();
  });
  it('opens Library with an encoded record ID', () => {
    expect(sharedTeaRecordHref('tea/?1')).toBe('/admin/compass?tab=library&entry=tea%2F%3F1');
  });
});

describe('Library opens only the same verified Stock record', () => {
  it('accepts a durable backlink before a stale forward link', () => {
    expect(sharedStockRecordId({id:'tea-1',draftProductId:'old'}, [{id:'stock-1',source_compass_entry_id:'tea-1'}])).toBe('stock-1');
  });
  it('refuses a missing or conflicting target and never matches a name', () => {
    expect(sharedStockRecordId({id:'tea-1',draftProductId:'missing'}, [])).toBeUndefined();
    expect(sharedStockRecordId({id:'tea-1',draftProductId:'stock-1'}, [{id:'stock-1',sourceCompassEntryId:'other'}])).toBeUndefined();
  });
  it('accepts a legacy forward link to a verified product and encodes its URL', () => {
    expect(sharedStockRecordId({id:'tea-1',draftProductId:'stock/1'}, [{id:'stock/1'}])).toBe('stock/1');
    expect(sharedStockRecordHref('stock/1')).toBe('/admin/stock?panel=stock%2F1');
  });
});
