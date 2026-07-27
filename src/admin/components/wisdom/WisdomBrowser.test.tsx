import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// AnchoredMenu portals to document.body, which the server renderer cannot do.
// The menu's contents are not what this file is testing; its trigger is.
vi.mock('../../../components/shared/AnchoredMenu', () => ({
  AnchoredMenu: ({ trigger }: { trigger: (props: Record<string, unknown>) => React.ReactNode }) =>
    <>{trigger({})}</>,
}));

const { WisdomBrowser } = await import('./WisdomBrowser');
const { WISDOM_HOLDINGS } = await import('./holdings');

const cultivars = WISDOM_HOLDINGS[0];
const render = (holding = cultivars) =>
  renderToStaticMarkup(<WisdomBrowser holding={holding} tabs={<nav />} />);

describe('WisdomBrowser', () => {
  it('labels its columns, which the old browsers never did', () => {
    const html = render();
    expect(html).toContain('data-testid="wisdom-column-row"');
    for (const column of cultivars.columns) {
      expect(html).toContain(`>${column.label}<`);
    }
    // The sort state rides in the label, not aria-sort: there is no table here.
    expect(html).toContain('Sort by Cultivar, currently ascending');
  });

  it('says the rung in the count line instead of on all 79 rows', () => {
    const html = render();
    expect(html).toContain(`${cultivars.rows.length} cultivars`);
    expect(html).toContain(`all ${cultivars.rows.length} drafted, none reviewed`);
    // The word used to appear once per row. It now appears only in the chrome,
    // and never below the column header.
    const belowHeader = html.slice(html.indexOf('wisdom-column-row'));
    expect(belowHeader).not.toMatch(/drafted/i);
  });

  it('renders every entry of every holding as a row', () => {
    for (const holding of WISDOM_HOLDINGS) {
      const html = render(holding);
      const rows = html.match(/min-h-\[36px\]/g) ?? [];
      expect(rows.length, holding.id).toBe(holding.rows.length);
    }
  });

  it('keeps the read-only note under the content, not in front of it', () => {
    const html = render();
    const note = html.indexOf('Read only.');
    expect(note).toBeGreaterThan(html.indexOf('wisdom-column-row'));
  });
});
