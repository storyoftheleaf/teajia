import { describe, expect, it } from 'vitest';
import { sharedTeaRecordHref, sharedTeaRecordId } from './sharedTeaRecord';

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
