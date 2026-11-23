import React from 'react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { HelmetProvider } from 'react-helmet-async';
import { describe, expect, it } from 'vitest';
import PhotographsPage from './PhotographsPage';

const source = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

describe('the short door', () => {
  const signUp = source('./SignUpPage.tsx');
  const form = signUp.slice(signUp.indexOf('<form onSubmit={handleSubmit}'), signUp.indexOf('</form>', signUp.indexOf('<form onSubmit={handleSubmit}')));

  it('asks for name, email and password and nothing else', () => {
    expect(form).toContain('id="signup-name"');
    expect(form).toContain('id="signup-email"');
    expect(form).toContain('id="signup-password"');
    expect(form.match(/<input\b/g)).toHaveLength(3);
    expect(form).not.toMatch(/Username|WhatsApp|Telegram|type="tel"/);
  });

  it('keeps Continue with Google exactly as it was', () => {
    expect(signUp).toContain('href={`${API_URL}/api/auth/google?return=${encodeURIComponent(authPagePath(\'signin\', destination))}`}');
    expect(signUp).toContain('Continue with Google');
  });

  it('asks for the phone where an order is first placed, which is already there', () => {
    expect(source('../components/shared/PublicCart.tsx')).toContain("'Your WhatsApp number'");
  });

  it('sends a signed-out person back to the tasting, not only the tea', () => {
    const page = source('./ProductPage.tsx');
    expect(page).toContain('tastingReturnPath(window.location.pathname, window.location.search)');
    expect(page).toContain("searchParams.get('taste') === '1'");
  });
});

describe('How we use photographs', () => {
  const html = renderToStaticMarkup(<HelmetProvider><PhotographsPage /></HelmetProvider>);
  it('says the three things in plain words', () => {
    expect(html).toContain('How we use photographs');
    expect(html).toMatch(/may be shown on Teajia, with your name/);
    expect(html).toContain('Remove from my page');
    expect(html).toMatch(/ask/i);
    expect(html).toContain('taken down');
  });
  it('keeps its direct address and stays out of the menu', () => {
    expect(source('../App.tsx')).toContain('path="/photographs"');
    for (const nav of ['../components/BottomTabBar.tsx']) expect(source(nav)).not.toContain('/photographs');
  });
  it('has no em dash and never names the owner', () => {
    expect(html).not.toContain('—');
    expect(html).not.toMatch(/Adrian/);
  });
});
