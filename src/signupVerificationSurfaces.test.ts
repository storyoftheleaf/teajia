import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('signup verification surfaces', () => {
  it.each([
    ['./pages/SignUpPage.tsx', 'standalone signup page'],
  ])('%s renders an accessible six-digit verification step with a safe edit action', (path) => {
    const text = source(path);
    expect(text).toContain('pendingSignup');
    expect(text).toContain('verifySignup');
    expect(text).toContain('autoComplete="one-time-code"');
    expect(text).toContain('inputMode="numeric"');
    expect(text).toContain('Edit email');
    expect(text).toContain('Back to verification');
    expect(text).toContain('Resend code');
    expect(text).toContain('restorePendingSignup');
    expect(text).toMatch(/role="alert"|aria-live="polite"/);
  });

  it('clears persisted signup authority only after verification succeeds', () => {
    const text = source('./hooks/useAuth.ts');
    expect(text).toMatch(/verifySignup[\s\S]*clearPendingSignup/);
    const signupBlock = text.slice(text.indexOf('const signup ='), text.indexOf('const verifySignup ='));
    expect(signupBlock).not.toContain('setToken(');
  });
});
