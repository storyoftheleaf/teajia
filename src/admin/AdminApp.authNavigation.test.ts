import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { adminAuthReturnTo } from './authNavigation';

describe('admin authentication destination', () => {
  it('preserves a deep admin route, filters, and anchor', () => {
    expect(adminAuthReturnTo({ pathname: '/admin/stock', search: '?q=oolong', hash: '#tea-42' })).toBe('/admin/stock?q=oolong#tea-42');
  });
  it('resumes a pending consent request passed through the legacy admin root', () => {
    expect(adminAuthReturnTo({ pathname: '/admin', search: '?next=%2Fadmin%2Foauth-consent%2Frequest-42%3Fscope%3Dstock', hash: '' })).toBe('/admin/oauth-consent/request-42?scope=stock');
  });
  it('ignores unsafe and auth-page next destinations', () => {
    for (const next of ['//other.example', '/signin', 'https://other.example']) {
      const search = `?next=${encodeURIComponent(next)}`;
      expect(adminAuthReturnTo({ pathname: '/admin', search, hash: '' })).toBe(`/admin${search}`);
    }
  });
  it('routes expired sessions through the canonical page without a second auth form', () => {
    const source = readFileSync(new URL('./AdminApp.tsx', import.meta.url), 'utf8');
    expect(source).not.toContain('<AuthModal');
    expect(source).not.toContain('path="/" element={<Navigate');
    expect(source).not.toContain('setIsLoginOpen');
    expect(source).toContain("authPagePath('signin', adminAuthReturnTo(location))");
  });
});
