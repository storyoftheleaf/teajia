import { describe, expect, it } from 'vitest';
import { shouldPersistQueryKey } from './queryPersistence';

describe('query disk persistence', () => {
  it('excludes customer, invoice, event admin, and attendee records', () => {
    for (const key of [
      ['invoices-pending-summary', 'store-a', 'operator', 1],
      ['invoices-all', 'store-a', 'operator', 1],
      ['pending-attendees', 'store-a', 'operator', 1],
      ['events', 'admin', 'store-a', 'operator', 1],
      ['event-attendees', 'event-a', 'store-a', 'operator', 1],
      ['vendor-products', 'vendor-a', 'store-a', 'operator', 1],
      ['customers', 'store-a', 'operator'],
      ['products', 'store-a', 'operator'],
    ]) expect(shouldPersistQueryKey(key)).toBe(false);
    expect(shouldPersistQueryKey(['products', 'public'])).toBe(true);
    expect(shouldPersistQueryKey(['events', 'public', 'search'])).toBe(true);
  });
});
