import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-router-dom', () => ({
  Navigate: ({ to, replace }: { to: string; replace: boolean }) => <div data-to={to} data-replace={String(replace)} />,
  useLocation: () => ({
    pathname: '/tea-atlas/read/article-1',
    search: '?page=3&from=bookmark',
    hash: '#illustration',
  }),
}));

import OldAtlasRedirect from './OldAtlasRedirect';

describe('OldAtlasRedirect', () => {
  it('forwards the old path and preserves its query and hash', () => {
    const markup = renderToStaticMarkup(<OldAtlasRedirect />);
    expect(markup).toContain('data-to="/atlas/read/article-1?page=3&amp;from=bookmark#illustration"');
    expect(markup).toContain('data-replace="true"');
  });
});
