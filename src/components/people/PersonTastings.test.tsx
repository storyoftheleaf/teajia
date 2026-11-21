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
    full_url: 'https://media.teajia.co/family-photos/bali/tea-a/p1-full.jpg', small_width: 480, small_height: 360, shape: 'square',
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

// The list as the worker sends it: only people with a photograph, already grouped and ordered.
vi.mock('../../hooks/useContributor', () => ({
  useContributors: () => ({
    isLoading: false,
    data: [
      person({ id: 'master', display_name: 'Ada Master', role: 'Tea master', list_group: 'season', card_image_url: 'master.jpg' }),
      person({ id: 'founder', display_name: 'Early Founder', role: 'Teajia family', page_tier: 'family', list_group: 'founding', card_image_url: 'founder.jpg' }),
      person({ id: 'first', display_name: 'First Family', role: 'Teajia family', page_tier: 'family', list_group: 'family', card_image_url: 'first.jpg' }),
      person({ id: 'second', display_name: 'Second Family', role: 'Teajia family', page_tier: 'family', list_group: 'family', avatar_url: 'second.jpg' }),
      ...Array.from({ length: 24 }, (_, i) => person({ id: `more-${i}`, display_name: `More ${String(i).padStart(2, '0')} Family`, role: 'Teajia family', page_tier: 'family', list_group: 'family', card_image_url: `more-${i}.jpg` })),
    ],
  }),
}));

describe('the people list', () => {
  it('prints three groups in order, and the family in the order it arrived, with no counts or ranking words', () => {
    const html = render(<ContributorsIndexPage />);
    const season = html.indexOf('This season');
    const founding = html.indexOf('Founding members');
    const family = html.indexOf('The family');
    expect(season).toBeGreaterThan(-1);
    expect(founding).toBeGreaterThan(season);
    expect(family).toBeGreaterThan(founding);
    expect(html.slice(season, founding)).toContain('Master');
    expect(html.slice(founding, family)).toContain('Founder');
    const familyHtml = html.slice(family);
    expect(familyHtml.indexOf('First')).toBeGreaterThan(-1);
    expect(familyHtml.indexOf('First')).toBeLessThan(familyHtml.indexOf('Second'));
    expect(html).not.toMatch(/\b\d+ (tastings|teas|people)\b/);
    expect(html).not.toMatch(/most active|top member|rank|score/i);
  });

  it('gives every person a photograph, whichever group they are in', () => {
    const html = render(<ContributorsIndexPage />);
    const rows = html.match(/data-testid="(people-card|family-row)"/g) ?? [];
    const pictures = html.match(/<img /g) ?? [];
    expect(rows.length).toBeGreaterThan(0);
    expect(pictures.length).toBe(rows.length);
  });

  it('keeps the family past the first twenty-four behind See everyone', () => {
    const html = render(<ContributorsIndexPage />);
    expect((html.match(/data-testid="family-row"/g) ?? []).length).toBe(24);
    expect(html).toContain('See everyone');
    expect(html).toContain('More 21 Family');
    expect(html).not.toContain('More 22 Family');
  });
});
