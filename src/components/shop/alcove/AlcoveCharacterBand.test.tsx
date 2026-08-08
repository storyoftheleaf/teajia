import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AlcoveCharacterBand } from './AlcoveCharacterBand';

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
});
