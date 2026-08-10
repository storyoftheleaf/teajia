import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ProfileShareLinks } from './ProfileShareLinks';

describe('ProfileShareLinks', () => {
  it('offers exact profile, public favorites, and account-aware payment links', () => {
    const html = renderToStaticMarkup(
      <ProfileShareLinks slug="rayi" accountSlug="rayi-master" origin="https://teajia.com" />,
    );

    expect(html).toContain('View profile');
    expect(html).toContain('Copy profile link');
    expect(html).toContain('Copy public favorites link');
    expect(html).toContain('Copy payment link');
    expect(html).toContain('href="/people/rayi"');
    expect(html).not.toContain('barry');
  });
});
