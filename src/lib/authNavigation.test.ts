import { describe, expect, it } from 'vitest';
import { authPagePath, authReturnTo, safeAuthReturnTo } from './authNavigation';

describe('one authentication destination policy', () => {
  it('defaults to Your Table and preserves an explicit journey including query and anchor', () => {
    expect(authReturnTo()).toBe('/account');
    expect(authReturnTo('/read?view=books#tea')).toBe('/read?view=books#tea');
    expect(authReturnTo('/read?q=oolong%20tea')).toBe('/read?q=oolong%20tea');
    expect(authReturnTo(undefined, '/admin/orders?status=paid#invoice')).toBe('/admin/orders?status=paid#invoice');
  });
  it.each(['https://other.test', '//other.test', '/\\other.test', '/%5cother.test', '/signin', '/signin?returnTo=/read', '/signup', '/reset-password?token=x', '/read\n'])('rejects unsafe or looping return %j', path => {
    expect(safeAuthReturnTo(path)).toBeUndefined();
    expect(authReturnTo(path)).toBe('/account');
  });
  it('carries the same return between both authentication pages', () => {
    const destination = '/events/tea?rsvp=1#details';
    for (const mode of ['signin', 'signup'] as const) {
      expect(new URL(authPagePath(mode, destination), 'https://teajia.com').searchParams.get('returnTo')).toBe(destination);
    }
    expect(authPagePath('signin')).toBe('/signin');
  });
});
