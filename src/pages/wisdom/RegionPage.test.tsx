import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import RegionPage from './RegionPage';

function render(path: string): string {
  return renderToStaticMarkup(
    <HelmetProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/wisdom/region/:id" element={<RegionPage />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );
}

describe('RegionPage origin semantics', () => {
  it('presents official Jinzhai county geography without claiming a tea-growing elevation', () => {
    const html = render('/wisdom/region/jinzhai-county-lu-an');

    expect(html).toContain('County elevation');
    expect(html).toContain('59.5-1729.1m');
    expect(html).toContain('full county range');
    expect(html).toContain('Jinzhai County People’s Government');
    expect(html).not.toContain('400-900m');
    expect(html).not.toContain('Tea-growing elevation');
    expect(html).not.toContain('Elevation and climate have not been added yet');
    expect(html).toContain('"name":"County elevation"');
  });

  it('keeps the map provider invisible behind the View map action', () => {
    const html = render('/wisdom/region/jinzhai-county-lu-an');

    expect(html).toContain('View map');
    expect(html).not.toContain('Apple Maps');
    expect(html).not.toContain('Google Maps');
  });

  it('omits the plants section when no cultivar is linked to the place', () => {
    const html = render('/wisdom/region/jinzhai-county-lu-an');

    expect(html).not.toContain('Plants from here');
    expect(html).not.toContain('Plants recorded within');
    expect(html).not.toContain('No cultivar record links');
  });
});
