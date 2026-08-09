import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AlcoveCharacterBand } from './AlcoveCharacterBand';
import type { ProductResearchResolution } from '../../../wisdom/productResearch';

describe('AlcoveCharacterBand tasting attribution', () => {
  it('labels common imported potential without attributing it to Adrian', () => {
    const markup = renderToStaticMarkup(<AlcoveCharacterBand
      item={{ tasting: { flavor: ['honey'] }, tastingSource: 'common' } as never}
      legacyNotes={[]}
    />);

    expect(markup).toContain('Potential profile');
    expect(markup).not.toContain('Adrian');
  });

  it('does not label legacy-only visible terms as a common potential profile', () => {
    const markup = renderToStaticMarkup(<AlcoveCharacterBand
      item={{ tasting: { body: ['full'] }, tastingSource: 'common' } as never}
      legacyNotes={['legacy honey note']}
    />);

    expect(markup).toContain('Legacy Honey Note');
    expect(markup).not.toContain('Potential profile');
  });

  it('keeps owner tasting distinct while showing cited shared potential character', () => {
    const potentialResearch = {
      entryKind: 'cultivar',
      entryId: 'jin-xuan',
      profile: {
        entryKind: 'cultivar',
        entryId: 'jin-xuan',
        tasting: { flavor: ['honey'], feeling: ['calming'] },
        citationIds: ['jin-xuan-profile'],
      },
      citations: [{
        id: 'jin-xuan-profile',
        entryKind: 'cultivar',
        entryId: 'jin-xuan',
        fields: ['potentialProfile'],
        sourceIds: ['tea-institute'],
        usage: 'usable',
      }],
      sources: [{
        id: 'tea-institute',
        publisher: 'Tea Research Institute',
        title: 'Jin Xuan character',
        url: 'https://example.com/jin-xuan',
        kind: 'institutional',
        accessedAt: '2026-08-08',
      }],
    } satisfies ProductResearchResolution;

    const markup = renderToStaticMarkup(<AlcoveCharacterBand
      item={{ tasting: { flavor: ['orchid'] }, tastingSource: 'owner' } as never}
      legacyNotes={[]}
      potentialResearch={potentialResearch}
    />);

    expect(markup).toContain('Taste');
    expect(markup).toContain('Orchid');
    expect(markup).toContain('Potential character');
    expect(markup).toContain('Honey');
    expect(markup).toContain('Calming');
    expect(markup).toContain('Tea Research Institute');
    expect(markup).toContain('href="/wisdom/cultivar/jin-xuan"');
    expect(markup).not.toContain('description');
  });
});
