import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { PersonalTeaLinks } from './PersonalTeaLinks';
import { favouritesPath } from '../../lib/favouritesOpen';

describe('PersonalTeaLinks', () => {
  it('links the distinct personal tea models and omits the current one', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <PersonalTeaLinks current="journal" />
      </MemoryRouter>,
    );

    expect(html).toContain(`href="${favouritesPath()}"`);
    expect(html).toContain('Favorites');
    expect(html).toContain('href="/account/cellar"');
    expect(html).toContain('Tea Chest');
    expect(html).not.toContain('href="/account/journal"');
  });
});
