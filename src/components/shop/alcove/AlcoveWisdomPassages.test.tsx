import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AlcoveWisdomPassages, AlcoveWisdomStyleReferences } from './AlcoveWisdomPassages';
import type { PublicClaim } from '../../../wisdom/reference/claims';
import { EMPTY_LISTING_PASSAGES, resolveListingPassages } from '../../../wisdom/reference/listingPassages';
import { PILOT_FIXTURE_CLAIMS } from '../../../pages/preview/wisdomPilot/fixtureClaims';
import { PILOT_FIXTURES } from '../../../pages/preview/wisdomPilot/fixtureProducts';

const render = (node: React.ReactNode) => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>);

describe('AlcoveWisdomPassages', () => {
  it('renders nothing when no claim applies', () => {
    expect(render(<AlcoveWisdomPassages listing={EMPTY_LISTING_PASSAGES} />)).toBe('');
    expect(render(<AlcoveWisdomStyleReferences listing={EMPTY_LISTING_PASSAGES} />)).toBe('');
  });

  it('shows each passage with its text, terms and a Wisdom link, anchored for its grid row, and never its scope', () => {
    const listing = resolveListingPassages(PILOT_FIXTURES['gong-ting-external'].facts, PILOT_FIXTURE_CLAIMS);
    const markup = render(<AlcoveWisdomPassages listing={listing} />);
    expect(markup).toContain('id="wisdom-passage-gong-ting-definition"');
    expect(markup).toContain('Gong Ting is the name used for a fine, bud-rich grade');
    // Scope is an editing note for the Wisdom record, never shown to customers.
    expect(markup).not.toContain('Scope');
    expect(markup).toContain('宫廷');
    expect(markup).toContain('href="/wisdom/grade/gong-ting#definition"');
    expect(markup).toContain('Read more in Wisdom');
    expect(markup).toContain('tap-target');
    expect(markup).not.toContain('What people often notice');
    expect(markup).not.toContain('data-citation-line');
  });

  it('links a sourced passage to its evidence in Wisdom', () => {
    const listing = resolveListingPassages(PILOT_FIXTURES['gong-ting-external'].facts, PILOT_FIXTURE_CLAIMS);
    const cited = { ...listing, passages: [{ ...listing.passages[0], claim: { ...listing.passages[0].claim, basis: 'sourced', sourceIds: ['s'] } as PublicClaim }] };
    expect(render(<AlcoveWisdomPassages listing={cited} />)).toContain('href="/wisdom/grade/gong-ting#definition"');
  });

  it('shows the taste sentence under "What people often notice", naming no source, framed as the style', () => {
    const listing = resolveListingPassages(PILOT_FIXTURES['gong-ting-external'].facts, PILOT_FIXTURE_CLAIMS);
    const markup = render(<AlcoveWisdomStyleReferences listing={listing} />);
    expect(markup).toContain('What people often notice');
    expect(markup).toContain('People often notice dried fruit and a creamy sweetness in Gong Ting ripe pu&#x27;er.');
    expect(markup).toContain('not a tasting of this tea');
    expect(markup).not.toMatch(/Reported by|Yunnan Sourcing|Style reference/);
  });
});
