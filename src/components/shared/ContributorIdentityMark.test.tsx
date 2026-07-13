import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ContributorIdentityMark, initialsFor } from './ContributorIdentityMark';

describe('ContributorIdentityMark', () => {
  it('creates Unicode-safe initials and falls back for names without letters', () => {
    expect(initialsFor('Élodie 周')).toBe('É周');
    expect(initialsFor('🫖 Tea')).toBe('T');
    expect(initialsFor('  123  ')).toBe('');
  });

  it('is decorative by default and can be explicitly announced', () => {
    const decorative = renderToStaticMarkup(<ContributorIdentityMark name="Chen Wei" />);
    expect(decorative).toContain('aria-hidden="true"');
    expect(decorative).not.toContain('role="img"');

    const announced = renderToStaticMarkup(<ContributorIdentityMark name="Chen Wei" decorative={false} />);
    expect(announced).toContain('role="img"');
    expect(announced).toContain('aria-label="Chen Wei identity mark"');
  });
});
