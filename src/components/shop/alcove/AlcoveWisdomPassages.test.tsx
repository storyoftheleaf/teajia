import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AlcoveWisdomPassages, AlcoveWisdomStyleReferences, attributionSentence } from './AlcoveWisdomPassages';
import { EMPTY_LISTING_PASSAGES, resolveListingPassages } from '../../../wisdom/reference/listingPassages';
import { PILOT_FIXTURE_CLAIMS } from '../../../pages/preview/wisdomPilot/fixtureClaims';
import { PILOT_FIXTURES } from '../../../pages/preview/wisdomPilot/fixtureProducts';

const render = (node: React.ReactNode) => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>);

describe('AlcoveWisdomPassages', () => {
  it('renders nothing when no claim applies', () => {
    expect(render(<AlcoveWisdomPassages listing={EMPTY_LISTING_PASSAGES} />)).toBe('');
    expect(render(<AlcoveWisdomStyleReferences listing={EMPTY_LISTING_PASSAGES} />)).toBe('');
  });

  it('shows each passage with its text, scope, terms and a Wisdom link, anchored for its grid row', () => {
    const listing = resolveListingPassages(PILOT_FIXTURES['gong-ting-external'].facts, PILOT_FIXTURE_CLAIMS);
    const markup = render(<AlcoveWisdomPassages listing={listing} />);
    expect(markup).toContain('id="wisdom-passage-gong-ting-definition"');
    expect(markup).toContain('Gong Ting is the name used for a fine, bud-rich grade');
    expect(markup).toContain('Scope: </span>Loose ripe pu&#x27;er, Menghai Tea Alliance standard');
    expect(markup).toContain('宫廷');
    expect(markup).toContain('href="/wisdom/grade/gong-ting#definition"');
    expect(markup).toContain('Read more in Wisdom');
    expect(markup).toContain('tap-target');
    expect(markup).not.toContain('Style reference');
  });

  it('puts each observation in the style reference block with its own attribution sentence', () => {
    const listing = resolveListingPassages(PILOT_FIXTURES['gong-ting-external'].facts, PILOT_FIXTURE_CLAIMS);
    const markup = render(<AlcoveWisdomStyleReferences listing={listing} />);
    expect(markup).toContain('Style reference');
    for (const reference of listing.styleReferences) {
      expect(markup).toContain(reference.text);
      expect(attributionSentence(reference)).toMatch(/^Reported by the seller, describing its own batch, about .+ It describes that sample, not this tea\.$/);
    }
    expect(markup.match(/Reported by/g)).toHaveLength(2);
  });
});
