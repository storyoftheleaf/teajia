import { ApiError } from '../../lib/api';

/**
 * Reading a refused shop opening.
 *
 * A store cannot be opened to buyers until the person it pays can actually be
 * paid, and the server names which of three things is missing. Repeating its
 * sentence and stopping there leaves the tea master to guess where to go, which
 * is the version that generates a message to Adrian instead of preventing one.
 * So every refusal carries the door it is fixed behind.
 */

export type StoreOpeningRefusal = {
  message: string;
  /** What the person is going to do about it, in their own words. */
  fix: string;
  route: string;
};

const PROFILE_ROUTE = '/account/profile';

const FIXES: Record<string, { fix: string; route: string }> = {
  // Nobody to pay almost always means no Tea Master profile exists yet, not that
  // the shop lacks an owner: a shop cannot be created without one. The profile is
  // where a person becomes payable, so that is where this leads.
  store_has_no_payment_recipient: { fix: 'Create your Tea Master profile', route: PROFILE_ROUTE },
  store_recipient_profile_unpublished: { fix: 'Publish your Tea Master profile', route: PROFILE_ROUTE },
  // Payment methods hang off the person, not the store, because a tea master
  // can be paid while selling nothing.
  store_has_no_payment_method: { fix: 'Add a public payment method', route: PROFILE_ROUTE },
};

// The refusal also names the gap in `details.missing`, which is the only handle
// on it if a code is ever dropped from the payload.
const GAP_CODES: Record<string, string> = {
  no_recipient: 'store_has_no_payment_recipient',
  profile_not_published: 'store_recipient_profile_unpublished',
  no_payment_method: 'store_has_no_payment_method',
};

export function storeOpeningRefusal(cause: unknown): StoreOpeningRefusal | null {
  if (!(cause instanceof ApiError) || cause.status !== 409) return null;
  const data = cause.data ?? {};
  const missing = (data.details as { missing?: string } | undefined)?.missing;
  const code = typeof data.code === 'string' && data.code
    ? data.code
    : typeof missing === 'string'
      ? GAP_CODES[missing]
      : undefined;
  const fix = code ? FIXES[code] : undefined;
  // An unrecognised 409 is somebody else's refusal. Passing it through as a
  // payment problem would send the tea master to fix the wrong thing.
  if (!fix) return null;
  return { message: cause.message, ...fix };
}
