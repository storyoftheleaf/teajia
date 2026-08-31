import { describe, expect, it } from 'vitest';
import { ApiError } from '../../lib/api';
import { storeOpeningRefusal } from './storeOpening';

describe('a refused shop opening', () => {
  it('sends the tea master to their payment methods when there is no way to pay them', () => {
    const refusal = storeOpeningRefusal(new ApiError(
      'Add a published payment method before opening the shop, so customers have somewhere to pay.',
      409,
      { code: 'store_has_no_payment_method', details: { missing: 'no_payment_method' } },
    ));

    expect(refusal).toEqual({
      message: 'Add a published payment method before opening the shop, so customers have somewhere to pay.',
      fix: 'Add a public payment method',
      route: '/account/profile',
    });
  });

  it('separates an unpublished profile from a missing method, since they are fixed differently', () => {
    expect(storeOpeningRefusal(new ApiError('Publish your Tea Master profile first.', 409, {
      code: 'store_recipient_profile_unpublished',
    }))).toMatchObject({ fix: 'Publish your Tea Master profile', route: '/account/profile' });

    expect(storeOpeningRefusal(new ApiError('This store has no tea master to be paid.', 409, {
      code: 'store_has_no_payment_recipient',
    }))).toMatchObject({ fix: 'Create your Tea Master profile', route: '/account/profile' });
  });

  it('reads the named gap when no code came back', () => {
    expect(storeOpeningRefusal(new ApiError('Nobody to pay.', 409, {
      details: { missing: 'no_recipient' },
    }))).toMatchObject({ fix: 'Create your Tea Master profile' });
  });

  it('leaves every other failure alone rather than blaming payment for it', () => {
    expect(storeOpeningRefusal(new ApiError('Slug already taken', 409, { code: 'slug_conflict' }))).toBeNull();
    expect(storeOpeningRefusal(new ApiError('Account access denied', 403, { code: 'store_has_no_payment_method' }))).toBeNull();
    expect(storeOpeningRefusal(new Error('Network down'))).toBeNull();
    expect(storeOpeningRefusal(null)).toBeNull();
  });
});
