import React from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { LearnOverview } from './LearnOverview';

beforeAll(() => {
  vi.stubGlobal('window', {
    matchMedia: () => ({ matches: true }),
  });
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('LearnOverview', () => {
  it('links Tea Reference to the Wisdom reference from the Craft destination list', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <LearnOverview
          onStoryClick={() => undefined}
          watchedStories={{}}
          onNavigateTo={() => undefined}
        />
      </MemoryRouter>,
    );

    expect(html).toContain('href="/wisdom"');
    expect(html).toContain('Tea Reference');
    expect(html).toContain('Plants, places, producers, styles and named teas');
  });
});
