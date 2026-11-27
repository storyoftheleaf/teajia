import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import HostTablePage from './HostTablePage';
import HostedTablePage from './HostedTablePage';
import { shareLine } from '../components/tasting/TastingShareStep';

// A10-8, W1-16: closed on the site, the hosting pages are the site's own
// not-found page, as before Launch 2, never a blank one.
describe('closed doors stay quiet, never blank', () => {
  it('/account/host and a hosted table show the not-found page while FEW_HOSTS is closed', () => {
    for (const Page of [HostTablePage, HostedTablePage]) {
      const html = renderToStaticMarkup(<MemoryRouter><Page /></MemoryRouter>);
      expect(html).toContain('Page not found');
    }
  });
});

// A10-2: the line after a share says what the worker recorded.
describe('the tasting share line', () => {
  it('names the Tea Table only when the worker put it there', () => {
    expect(shareLine(true, true)).toBe('On your page and the Tea Table.');
    expect(shareLine(true, false)).toBe('On your page. The Tea Table could not take it just now.');
    expect(shareLine(false, false)).toBe('On your page.');
  });
});
