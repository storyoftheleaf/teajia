import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import Footer from './Footer';

describe('Footer operating-program entrances', () => {
  it('links public visitors to People and the Tea Wisdom Base', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    );

    expect(html).toContain('href="/people"');
    expect(html).toContain('>People<');
    expect(html).toContain('href="/wisdom"');
    expect(html).toContain('>Tea Wisdom<');
  });
});
