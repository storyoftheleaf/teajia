import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PublicIdentityLinks } from './PublicIdentityLinks';

describe('PublicIdentityLinks', () => {
  it('cross-links an explicitly mapped Tea Master profile and shelf', () => {
    const html = renderToStaticMarkup(
      <PublicIdentityLinks contributorSlug="rayi" shelfSlug="rayi-shelf" subjectName="Rayi" />,
    );

    expect(html).toContain('Rayi’s Tea Master profile');
    expect(html).toContain('href="/people/rayi"');
    expect(html).toContain('Rayi’s personal shelf');
    expect(html).toContain('href="/u/rayi-shelf"');
  });

  it('does not invent a profile or shelf link when no mapping exists', () => {
    const html = renderToStaticMarkup(<PublicIdentityLinks subjectName="Barry" />);
    expect(html).toBe('');
  });
});
