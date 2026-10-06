import { describe, expect, it } from 'vitest';
import { normalizeCustomerTags } from './JourneyVisitSheet';

describe('normalizeCustomerTags', () => {
  it('accepts the production array shape', () => {
    expect(normalizeCustomerTags(['customer', 'vendor'])).toEqual(['customer', 'vendor']);
  });

  it('accepts legacy serialized arrays', () => {
    expect(normalizeCustomerTags('["vendor"]')).toEqual(['vendor']);
  });

  it('fails closed for malformed or non-string tags', () => {
    expect(normalizeCustomerTags('vendor')).toEqual([]);
    expect(normalizeCustomerTags([1, 'vendor', null])).toEqual(['vendor']);
  });
});
