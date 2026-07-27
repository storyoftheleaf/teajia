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
const render = (holding = cultivars, groupKey = '') =>
  renderToStaticMarkup(
    <WisdomBrowser
      holding={holding}
      tabs={<nav />}
      selectedId={null}
      onSelect={() => {}}
      onJump={() => {}}
      prefs={{ sort: { key: holding.columns[0].key, direction: 'asc' }, groupKey }}
      onPrefsChange={() => {}}
    />,
  );

/** Rows carry the admin density class; counting it counts mounted rows. */
const rowCount = (html: string) => (html.match(/min-h-\[36px\]/g) ?? []).length;

/** The first page. Kept in step with PAGE in WisdomBrowser.tsx. */
const PAGE = 150;

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

  it('mounts at most one page of rows, however large the holding', () => {
    for (const holding of WISDOM_HOLDINGS) {
      const html = render(holding);
      expect(rowCount(html), holding.id).toBe(Math.min(holding.rows.length, PAGE));
    }
  });

  it('offers a way to see the rest, and says how much is showing', () => {
    const varieties = WISDOM_HOLDINGS.find(holding => holding.id === 'varieties')!;
    expect(varieties.rows.length).toBeGreaterThan(PAGE);
    const html = render(varieties);
    expect(html).toContain(`${PAGE} of ${varieties.rows.length}`);
    expect(html).toContain('Show more');
    // A holding that fits in one page never shows the strip.
    expect(render(cultivars)).not.toContain('Show more');
  });

  it('gives the list one tab stop, with the rest reachable by arrow', () => {
    const html = render();
    expect((html.match(/tabindex="0"/g) ?? []).length).toBe(1);
    expect((html.match(/tabindex="-1"/g) ?? []).length).toBe(rowCount(html) - 1);
  });

  it('offers Group beside Sort wherever a holding can be grouped', () => {
    for (const holding of WISDOM_HOLDINGS) {
      const html = render(holding);
      expect(html).toContain(`Sort ${holding.noun}`);
      expect(html, holding.id).toContain(`Group ${holding.noun}`);
    }
  });

  it('keeps the read-only note and the reach line under the content', () => {
    const html = render();
    const note = html.indexOf('Read only.');
    expect(note).toBeGreaterThan(html.indexOf('wisdom-column-row'));
    // Every holding says where it is read, once.
    for (const holding of WISDOM_HOLDINGS) {
      expect(render(holding), holding.id).toContain(holding.reach.slice(0, 40));
    }
  });

  it('says what the keyboard does, where the keyboard is', () => {
    const html = render();
    expect(html).toContain('data-testid="wisdom-key-hints"');
    for (const hint of ['move', 'Home End jump', 'Enter open', 'Type to jump']) {
      expect(html).toContain(hint);
    }
  });

  it('offers one press to fold a grouped holding, and none when ungrouped', () => {
    const regions = WISDOM_HOLDINGS.find(holding => holding.id === 'regions')!;
    expect(render(regions, 'country')).toContain('Collapse all');
    expect(render(regions, '')).not.toContain('Collapse all');
  });

  it('makes the public address in the reach line the way to reach it', () => {
    for (const holding of WISDOM_HOLDINGS) {
      const index = holding.publicRef?.index;
      if (!index) continue;
      expect(render(holding), holding.id).toContain(`href="${index}"`);
    }
  });
});
