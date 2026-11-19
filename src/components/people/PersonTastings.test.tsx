import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { ContributorListItem } from '../../types';
import type { FamilyPersonTasting } from '../../lib/familyContract';
import { PersonTastingsSection } from './PersonTastings';
import ContributorsIndexPage from '../../pages/ContributorsIndexPage';

// Teajia family, stage 4: the Tastings section of a person's page and the
// people list's "The family" group. Words and photographs only.

const tasting = (over: Partial<FamilyPersonTasting> = {}): FamilyPersonTasting => ({
  product_id: 'tea-a',
  name: 'Aged Liu Bao',
  chinese_name: null,
  public_path: '/shop/product/tea-a?store=bali',
  sold_out: false,
  words: [{ date: '2026-11-10T08:05:00Z', text: 'Orchid and warm stone' }],
  photographs: [{
    id: 'p1', small_url: 'https://media.teajia.co/family-photos/bali/tea-a/p1-small.jpg',
    full_url: 'https://media.teajia.co/family-photos/bali/tea-a/p1-full.jpg', small_width: 480, small_height: 360,
  }],
  ...over,
});

const render = (node: React.ReactElement) => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>);

describe('the Tastings section', () => {
  it('shows words with their date and asks only for the small photograph', () => {
    const html = render(<PersonTastingsSection tastings={[tasting()]} />);
    expect(html).toContain('Tastings');
    expect(html).toContain('Aged Liu Bao');
    expect(html).toContain('Orchid and warm stone');
    expect(html).toContain('p1-small.jpg');
    expect(html).not.toContain('p1-full.jpg');
    expect(html).not.toMatch(/\/ ?10\b/);
    expect(html).not.toContain('Gone from the shop');
  });

  it('renders nothing for a person who shared nothing', () => {
    expect(render(<PersonTastingsSection tastings={[]} />)).toBe('');
  });

  it('keeps a sold-out tea, marked as gone, with the one find me more action', () => {
    const html = render(<PersonTastingsSection tastings={[tasting({ sold_out: true })]} />);
    expect(html).toContain('Gone from the shop.');
    expect(html.match(/Find me more/g)).toHaveLength(1);
    expect(html).toContain('/signin');
  });
});

const person = (over: Partial<ContributorListItem>): ContributorListItem => ({
  id: 'x', display_name: 'Person X', role: 'Tea master', page_tier: null, family_last_active: null, own_line: null, ...over,
});

vi.mock('../../hooks/useContributor', () => ({
  useContributors: () => ({
    isLoading: false,
    data: [
      person({ id: 'master', display_name: 'Ada Master', role: 'Tea master' }),
      person({ id: 'old', display_name: 'Old Family', role: 'Teajia family', page_tier: 'family', family_last_active: '2026-11-10 10:00:00' }),
      person({ id: 'new', display_name: 'New Family', role: 'Teajia family', page_tier: 'family', family_last_active: '2026-11-16 10:00:00' }),
      person({ id: 'quiet', display_name: 'Quiet Family', role: 'Teajia family', page_tier: 'family', family_last_active: null }),
    ],
  }),
}));

describe('the people list', () => {
  it('lists the family under This season, most recently active first, with no counts', () => {
    const html = render(<ContributorsIndexPage />);
    const season = html.indexOf('This season');
    const family = html.indexOf('The family');
    expect(season).toBeGreaterThan(-1);
    expect(family).toBeGreaterThan(season);
    const familyHtml = html.slice(family);
    expect(familyHtml.indexOf('New')).toBeGreaterThan(-1);
    expect(familyHtml.indexOf('New')).toBeLessThan(familyHtml.indexOf('Old'));
    // Someone who shared nothing is in neither group; a family page never takes a cover card.
    expect(html).not.toContain('Quiet');
    expect(html.slice(season, family)).not.toContain('New');
    expect(html.slice(season, family)).toContain('Master');
    expect(html).not.toMatch(/\b\d+ (tastings|teas|people)\b/);
  });
});
