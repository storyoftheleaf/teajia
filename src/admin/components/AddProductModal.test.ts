import { describe, expect, it } from 'vitest';
import { productTastingIsOwner, productTastingSourceForSave } from './AddProductModal';

describe('AddProductModal tasting source semantics', () => {
  it('preserves source-described tasting until the tasting editor explicitly saves', () => {
    expect(productTastingSourceForSave({ flavor: ['honey'] }, 'source', false)).toBe('source');
    expect(productTastingSourceForSave({ flavor: ['honey'] }, 'source', true)).toBe('owner');
    expect(productTastingIsOwner('source', false)).toBe(false);
    expect(productTastingIsOwner('source', true)).toBe(true);
  });

  it('preserves imported common tasting until the tasting editor explicitly saves', () => {
    expect(productTastingSourceForSave({ flavor: ['honey'] }, 'common', false)).toBe('common');
    expect(productTastingSourceForSave({ flavor: ['honey'] }, 'common', true)).toBe('owner');
  });

  it('switches the status badge to owner immediately after explicit tasting save', () => {
    expect(productTastingIsOwner('common', false)).toBe(false);
    expect(productTastingIsOwner('common', true)).toBe(true);
  });
});
