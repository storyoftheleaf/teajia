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
const { ALL_FOLDED } = await import('./config');
type WisdomUsage = import('./usage').WisdomUsage;

const cultivars = WISDOM_HOLDINGS[0];

interface RenderOptions {
  groupKey?: string;
  collapsed?: string[];
  query?: string;
  usage?: WisdomUsage;
  /** The rest of the base, which is what makes a cross-holding answer possible. */
  siblings?: typeof WISDOM_HOLDINGS;
}

const render = (holding = cultivars, options: RenderOptions = {}) =>
  renderToStaticMarkup(
    <WisdomBrowser
      holding={holding}
      tabs={condensed => (condensed ? <nav data-testid="condensed" /> : <nav data-testid="full" />)}
      selectedId={null}
      onSelect={() => {}}
      onJump={() => {}}
      siblings={options.siblings}
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

  // It used to sit under the rows, which on Varieties is under 316 of them and
  // is the one place on the screen nobody arrives at.
  it('reads where a holding is read BEFORE the rows, not under them', () => {
    const html = render();
    const reach = html.indexOf('data-testid="wisdom-reach"');
    expect(reach).toBeGreaterThan(html.indexOf('wisdom-column-row'));
    expect(reach).toBeLessThan(html.indexOf('data-testid="wisdom-rows"'));
    expect(html.indexOf('Read only.')).toBeLessThan(html.indexOf('data-testid="wisdom-rows"'));
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

  // Listing sixteen country names to say "all of them" is 120 characters of
  // address for one press, so the whole shape has a token of its own.
  it('folds the whole shape from one sentinel, not a list of every heading', () => {
    const regions = WISDOM_HOLDINGS.find(holding => holding.id === 'regions')!;
    const folded = render(regions, { groupKey: 'country', collapsed: [ALL_FOLDED] });
    expect(rowCount(folded)).toBe(0);
    expect(folded).toContain('Expand all');
    expect(folded).not.toContain('aria-expanded="true"');
    // Ungrouped there is one nameless section, so the sentinel folds nothing.
    expect(rowCount(render(regions, { collapsed: [ALL_FOLDED] }))).toBeGreaterThan(0);
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

  // Regions was the last holding stating no hole of its own, which read as a
  // complete record next to six holdings that admit to theirs.
  it('states a gap for regions too, in the shape the holding actually has', () => {
    const regions = WISDOM_HOLDINGS.find(holding => holding.id === 'regions')!;
    const html = render(regions);
    expect(html).toContain('data-testid="wisdom-gap"');
    expect(html).toContain('named by no cultivar, no variety and no product');
    // No holding is left without one now except those that genuinely have none.
    const silent = WISDOM_HOLDINGS.filter(holding => !holding.gap).map(holding => holding.id);
    expect(silent).toEqual(['producers', 'named-teas']);
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

  // With the whole base to read, one candidate is usually not the whole answer,
  // and choosing between them silently hides that a choice was made at all.
  it('offers every near candidate, not one picked for the reader', () => {
    const html = render(cultivars, { query: 'rougux', siblings: WISDOM_HOLDINGS });
    expect(html).toContain('data-testid="wisdom-near-misses"');
    expect(html).toMatch(/The base holds \d entries within an edit or two of that/);
    // The one held elsewhere says where it is kept, so opening it is not a
    // surprise change of subject.
    expect(html).toContain('in Varieties');
    // And a query with exactly one candidate still reads as a statement.
    expect(render(cultivars, { query: 'rougux' })).not.toContain('data-testid="wisdom-near-misses"');
  });

  it('says what is currently riding on the holding, not just who reads it', () => {
    const usage: WisdomUsage = {
      total: 139,
      byHolding: new Map([
        ['cultivars', new Map([['rou-gui', { count: 4, products: [{ id: 'p1', name: 'Rou Gui 2019' }] }]])],
      ]),
      byHoldingTotal: new Map([['cultivars', 4]]),
    };
    const html = render(cultivars, { usage });
    expect(html).toContain('4 of the 139 products in this account resolve through it today.');
    // Silent until the products are actually loaded.
    expect(render(cultivars)).not.toContain('data-testid="wisdom-holding-usage"');
  });

  // A count nobody can act on is the same as no count. Every product riding on
  // an entry is now named, and every name is the way back to it.
  it('carries the products themselves, not just how many there are', () => {
    const usage: WisdomUsage = {
      total: 2,
      byHolding: new Map([
        ['regions', new Map([['yiwu', { count: 2, products: [{ id: 'p1', name: 'A' }, { id: 'p2', name: 'B' }] }]])],
      ]),
      byHoldingTotal: new Map([['regions', 2]]),
    };
    const regions = WISDOM_HOLDINGS.find(holding => holding.id === 'regions')!;
    const held = usage.byHolding.get('regions')!.get('yiwu')!;
    expect(held.products.map(product => product.id)).toEqual(['p1', 'p2']);
    // And a region carrying products is no longer counted as a place nothing
    // names, which is the gap that arrived this round.
    expect(regions.gap!.test({ id: 'yiwu' }, { used: id => (id === 'yiwu' ? 2 : 0) })).toBe(false);
  });

  it('makes the public address in the reach line the way to reach it', () => {
    for (const holding of WISDOM_HOLDINGS) {
      const index = holding.publicRef?.index;
      if (!index) continue;
      expect(render(holding), holding.id).toContain(`href="${index}"`);
    }
  });
});
