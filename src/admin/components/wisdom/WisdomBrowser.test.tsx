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

interface RenderOptions {
  groupKey?: string;
  collapsed?: string[];
  query?: string;
  usage?: { total: number; byHolding: Map<string, Map<string, number>>; byHoldingTotal: Map<string, number> };
}

const render = (holding = cultivars, options: RenderOptions = {}) =>
  renderToStaticMarkup(
    <WisdomBrowser
      holding={holding}
      tabs={condensed => (condensed ? <nav data-testid="condensed" /> : <nav data-testid="full" />)}
      selectedId={null}
      onSelect={() => {}}
      onJump={() => {}}
      initialQuery={options.query}
      usage={options.usage}
      prefs={{
        sort: { key: holding.columns[0].key, direction: 'asc' },
        groupKey: options.groupKey ?? '',
        collapsed: options.collapsed ?? [],
      }}
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
    for (const hint of ['move', 'Home End jump', 'Enter open']) {
      expect(html).toContain(hint);
    }
    // The last hint names the axis the keys jump by, which follows the sort.
    expect(html).toContain('Type → Cultivar');
    const regions = WISDOM_HOLDINGS.find(holding => holding.id === 'regions')!;
    expect(render(regions, { groupKey: 'country' })).toContain('Type → Country');
  });

  it('offers one press to fold a grouped holding, and none when ungrouped', () => {
    const regions = WISDOM_HOLDINGS.find(holding => holding.id === 'regions')!;
    expect(render(regions, { groupKey: 'country' })).toContain('Collapse all');
    expect(render(regions, { groupKey: '' })).not.toContain('Collapse all');
  });

  // Folding is as much a standing choice as the grouping that produced it, so
  // it arrives as a preference rather than as state the remount throws away.
  it('takes its folded sections from the preferences it was handed', () => {
    const regions = WISDOM_HOLDINGS.find(holding => holding.id === 'regions')!;
    const open = render(regions, { groupKey: 'country' });
    const folded = render(regions, { groupKey: 'country', collapsed: ['China'] });
    expect(rowCount(folded)).toBeLessThan(rowCount(open));
    expect(folded).toContain('aria-expanded="false"');
    // Every section folded is the state the one press produces, and it reads
    // back as the offer to undo it.
    const countries = [...new Set(regions.rows.map(row => row.country).filter(Boolean))] as string[];
    const all = render(regions, { groupKey: 'country', collapsed: countries });
    expect(rowCount(all)).toBe(0);
    expect(all).toContain('Expand all');
  });

  it('states the current sort in words, because a phone hides the arrow', () => {
    // At 390px every sortable column except the name is hidden, so the header
    // arrow is not a way to read the sort. The status band says it instead.
    expect(render()).toContain('sorted by Cultivar ↑');
    expect(render()).toContain('data-testid="wisdom-status-band"');
  });

  it('counts a hole in the data instead of leaving it to be met one row at a time', () => {
    const html = render();
    expect(html).toContain('data-testid="wisdom-gap"');
    const cultivarGap = cultivars.rows.filter(row => cultivars.gap!.test(row)).length;
    expect(cultivarGap).toBeGreaterThan(0);
    expect(html).toContain(cultivars.gap!.sentence(cultivarGap, cultivars.rows.length));
    expect(html).toContain('Show only these');
    // A holding whose gap is currently empty says nothing at all.
    const varieties = WISDOM_HOLDINGS.find(holding => holding.id === 'varieties')!;
    const varietyGap = varieties.rows.filter(row => varieties.gap!.test(row)).length;
    if (varietyGap === 0) expect(render(varieties)).not.toContain('data-testid="wisdom-gap"');
  });

  it('seeds the find field from a query a link arrived with', () => {
    const varieties = WISDOM_HOLDINGS.find(holding => holding.id === 'varieties')!;
    const html = render(varieties, { query: 'Yiwu' });
    expect(html).toContain('value="Yiwu"');
    const shown = rowCount(html);
    expect(shown).toBeGreaterThan(0);
    expect(shown).toBeLessThan(rowCount(render(varieties)));
  });

  it('offers the near miss when the find field empties the list', () => {
    // One character off Rou Gui: a slip, not a question about a tea the base
    // does not hold. The exact matcher has nothing to say here, which is
    // precisely where holding a matcher should earn its keep.
    const html = render(cultivars, { query: 'rougux' });
    expect(html).toContain('data-testid="wisdom-empty"');
    expect(html).toContain('The nearest entry the base holds is Rou Gui');
    expect(html).toContain('Open it');
  });

  it('says what is currently riding on the holding, not just who reads it', () => {
    const usage = {
      total: 139,
      byHolding: new Map([['cultivars', new Map([['rou-gui', 4]])]]),
      byHoldingTotal: new Map([['cultivars', 4]]),
    };
    const html = render(cultivars, { usage });
    expect(html).toContain('4 of the 139 products in this account resolve through it today.');
    // Silent until the products are actually loaded.
    expect(render(cultivars)).not.toContain('data-testid="wisdom-holding-usage"');
  });

  it('makes the public address in the reach line the way to reach it', () => {
    for (const holding of WISDOM_HOLDINGS) {
      const index = holding.publicRef?.index;
      if (!index) continue;
      expect(render(holding), holding.id).toContain(`href="${index}"`);
    }
  });
});
