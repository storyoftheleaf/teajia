import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

// AnchoredMenu portals to document.body, which the server renderer cannot do.
// The menu's contents are not what this file is testing; its trigger is.
vi.mock('../../../components/shared/AnchoredMenu', () => ({
  AnchoredMenu: ({ trigger }: { trigger: (props: Record<string, unknown>) => React.ReactNode }) =>
    <>{trigger({})}</>,
}));

// The detail panel portals for the same reason. Its overlay behaviour is the
// Modal's business and is tested there; what this file reads is its contents.
vi.mock('../../../components/shared/Modal', () => ({
  Modal: ({ children, headerActions }: { children: React.ReactNode; headerActions?: React.ReactNode }) => (
    <div data-testid="wisdom-panel">{headerActions}{children}</div>
  ),
}));

const { WisdomBrowser, dwellFor } = await import('./WisdomBrowser');
const { WISDOM_HOLDINGS } = await import('./holdings');
const { ALL_FOLDED, OPEN_MARK, WISDOM_SEAT } = await import('./config');
type WisdomUsage = import('./usage').WisdomUsage;
type WisdomBorrowed = import('./config').WisdomBorrowed;

const cultivars = WISDOM_HOLDINGS[0];

interface RenderOptions {
  /** What the shape token asked for and the holding refused, as the view reads it. */
  shapeRefused?: string[];
  groupKey?: string;
  collapsed?: string[];
  gapOnly?: boolean;
  /** What the gap filter took on loan, as a shared link would carry it. */
  borrowed?: WisdomBorrowed;
  query?: string;
  selectedId?: string;
  usage?: WisdomUsage;
  /** The rest of the base, which is what makes a cross-holding answer possible. */
  siblings?: typeof WISDOM_HOLDINGS;
}

const render = (holding = cultivars, options: RenderOptions = {}) =>
  renderToStaticMarkup(
    // A router, because a blast radius chip is a link into the inventory.
    <MemoryRouter>
    <WisdomBrowser
      holding={holding}
      tabs={condensed => (condensed ? <nav data-testid="condensed" /> : <nav data-testid="full" />)}
      selectedId={options.selectedId ?? null}
      onSelect={() => {}}
      onJump={() => {}}
      siblings={options.siblings}
      initialQuery={options.query}
      usage={options.usage}
      shapeRefused={options.shapeRefused}
      prefs={{
        sort: { key: holding.columns[0].key, direction: 'asc' },
        groupKey: options.groupKey ?? '',
        collapsed: options.collapsed ?? [],
        gapOnly: options.gapOnly ?? false,
        borrowed: options.borrowed ?? null,
      }}
      onPrefsChange={() => {}}
    />
    </MemoryRouter>,
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

  // The sentinel could say "all" and "none" and nothing between them, so opening
  // one heading out of a folded shape had to spell out the other fifteen.
  it('holds one heading open against the sentinel instead of spelling out the rest', () => {
    const regions = WISDOM_HOLDINGS.find(holding => holding.id === 'regions')!;
    const china = regions.rows.filter(row => row.country === 'China').length;
    expect(china).toBeGreaterThan(0);
    const html = render(regions, { groupKey: 'country', collapsed: [ALL_FOLDED, `${OPEN_MARK}China`] });
    expect(rowCount(html)).toBe(Math.min(china, PAGE));
    // One heading open, every other one folded.
    expect((html.match(/aria-expanded="true"/g) ?? []).length).toBe(1);
    expect((html.match(/aria-expanded="false"/g) ?? []).length).toBeGreaterThan(1);
    // Not every section is folded any more, so the one press on offer is the
    // one that folds the last of them.
    expect(html).toContain('Collapse all');
  });

  it('states the current sort in words, because a phone hides the arrow', () => {
    // At 390px every sortable column except the name is hidden, so the header
    // arrow is not a way to read the sort. The status band says it instead.
    expect(render()).toContain('sorted by Cultivar ↑');
    expect(render()).toContain('data-testid="wisdom-status-band"');
  });

  it('counts a hole in the data instead of leaving it to be met one row at a time', () => {
    const html = render();
    expect(html).toContain('data-testid="wisdom-gap-count"');
    const cultivarGap = cultivars.rows.filter(row => cultivars.gap!.test(row)).length;
    expect(cultivarGap).toBeGreaterThan(0);
    expect(html).toContain(cultivars.gap!.sentence(cultivarGap, cultivars.rows.length));
    expect(html).toContain('Show only these');
  });

  // Silence used to mean two opposite things: a holding with no hole left, and a
  // holding whose hole was never measured. They rendered identically.
  it('tells a clean holding apart from an unmeasured one', () => {
    for (const holding of WISDOM_HOLDINGS) {
      const html = render(holding);
      expect(html, `${holding.id} says nothing about its record`).toContain('data-testid="wisdom-gap"');
      if (!holding.gap) {
        expect(html, holding.id).toContain('data-testid="wisdom-unmeasured"');
        expect(html, holding.id).toContain('No hole is counted');
        continue;
      }
      const missing = holding.rows.filter(row => holding.gap!.test(row)).length;
      const which = missing > 0 ? 'wisdom-gap-count' : 'wisdom-gap-whole';
      expect(html, holding.id).toContain(`data-testid="${which}"`);
    }
    // Both of the two silent holdings now say why they are silent.
    const silent = WISDOM_HOLDINGS.filter(holding => !holding.gap);
    expect(silent.map(holding => holding.id)).toEqual(['producers', 'named-teas']);
    expect(silent.every(holding => Boolean(holding.unmeasured))).toBe(true);
  });

  // A number that falls a beat after arrival, with nothing said, reads as a
  // fault rather than as a narrowing.
  it('says the region count is provisional until the account is read', () => {
    const regions = WISDOM_HOLDINGS.find(holding => holding.id === 'regions')!;
    expect(regions.gap!.needsAccount).toBe(true);
    expect(render(regions)).toContain('data-testid="wisdom-gap-provisional"');
    // With the products counted, the qualification leaves with the guess.
    const usage: WisdomUsage = { total: 3, byHolding: new Map(), byHoldingTotal: new Map() };
    expect(render(regions, { usage })).not.toContain('data-testid="wisdom-gap-provisional"');
    // And a holding whose gap the base can answer alone never says it.
    expect(render(cultivars)).not.toContain('data-testid="wisdom-gap-provisional"');
  });

  // A qualification that vanishes leaves a reader who was told a number was
  // conditional never told it had settled. A resolution that never leaves is the
  // opposite fault: an answer standing above the list all day, on every visit,
  // to a question this reader was never asked.
  it('says a count has settled at the transition, and not on arrival', () => {
    const regions = WISDOM_HOLDINGS.find(holding => holding.id === 'regions')!;
    const counted: WisdomUsage = { total: 139, byHolding: new Map(), byHoldingTotal: new Map() };
    // A second visit reads the counted answer out of the cache: nothing was ever
    // in doubt on this screen, so nothing is resolved on it.
    const arrived = render(regions, { usage: counted });
    expect(arrived).not.toContain('data-testid="wisdom-gap-settled"');
    expect(arrived).not.toContain('data-testid="wisdom-gap-provisional"');
    // The three states themselves are read by `readGapAccount`, which
    // holdings.test.ts holds to; what this file holds is when each is due.

    // An account holding no products is a third state, and it used to wear the
    // first one forever: waiting on a reading that had already happened. That
    // one IS a standing fact, so it keeps its line.
    const none: WisdomUsage = { total: 0, byHolding: new Map(), byHoldingTotal: new Map() };
    const empty = render(regions, { usage: none });
    expect(empty).toContain('data-testid="wisdom-gap-base-only"');
    expect(empty).not.toContain('data-testid="wisdom-gap-provisional"');
    expect(empty).not.toContain('data-testid="wisdom-gap-settled"');

    // None of the three ever appear on a gap the base can answer on its own.
    for (const testId of ['provisional', 'base-only', 'settled']) {
      expect(render(cultivars, { usage: counted })).not.toContain(`data-testid="wisdom-gap-${testId}"`);
    }
  });

  // The loan lived in a ref, so a link carrying the gap AND the grouping it took
  // arrived with nothing marked as borrowed and Show all kept it for good.
  it('marks a borrowed grouping as borrowed when it arrives in a link', () => {
    const marks = WISDOM_HOLDINGS.find(holding => holding.id === 'marks')!;
    // A settled loan is still a grouping the gap filter is holding the list in,
    // so it still says why. What ends is the promise, not the explanation: the
    // sentence used to leave with the loan, and the grouping outlived it in
    // silence. Sorting or typing settles the debt, which is exactly the moment
    // that used to happen.
    const plain = render(marks, { gapOnly: true, groupKey: 'producer' });
    expect(plain).toContain('data-testid="wisdom-gap-grouped"');
    expect(plain).toContain('Grouped by producer to show them');
    expect(plain).toContain('That grouping is yours now');
    expect(plain).not.toContain('Show all gives back');
    // A grouping the gap filter did not ask for explains nothing about the gap.
    const elsewhere = render(marks, { gapOnly: true, groupKey: 'era' });
    expect(elsewhere).not.toContain('data-testid="wisdom-gap-grouped"');

    const onLoan = render(marks, {
      gapOnly: true,
      groupKey: 'producer',
      borrowed: { groupKey: 'era', collapsed: [] },
    });
    expect(onLoan).toContain('data-testid="wisdom-gap-grouped"');
    expect(onLoan).toContain('Show all gives back your grouping by era');
  });

  // And the folded shape it unfolded to make room, which moved in total silence.
  it('names the folded shape the gap toggle unfolded, not just the grouping', () => {
    const marks = WISDOM_HOLDINGS.find(holding => holding.id === 'marks')!;
    const some = render(marks, {
      gapOnly: true,
      groupKey: 'producer',
      borrowed: { groupKey: 'era', collapsed: ['Vintage', 'Modern'] },
    });
    expect(some).toContain('and the 2 sections you had folded');

    const all = render(marks, {
      gapOnly: true,
      groupKey: 'producer',
      borrowed: { groupKey: 'era', collapsed: [ALL_FOLDED] },
    });
    expect(all).toContain('and every section you had folded');

    // A reader who had no grouping at all is owed exactly that back.
    const fromNone = render(marks, {
      gapOnly: true,
      groupKey: 'producer',
      borrowed: { groupKey: '', collapsed: [] },
    });
    expect(fromNone).toContain('Show all gives back your ungrouped list.');
  });

  // The one link an operator most wants to send, and until now the only part of
  // the shape that did not survive being sent.
  it('takes the gap filter from the preferences the address carries', () => {
    const marks = WISDOM_HOLDINGS.find(holding => holding.id === 'marks')!;
    const gapped = marks.rows.filter(row => marks.gap!.test(row)).length;
    expect(gapped).toBeGreaterThan(0);
    const html = render(marks, { gapOnly: true, groupKey: 'producer' });
    expect(rowCount(html)).toBe(gapped);
    expect(rowCount(html)).toBeLessThan(rowCount(render(marks, { groupKey: 'producer' })));
    expect(html).toContain('gaps only');
    expect(html).toContain('Show all');
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

  // Sixty chips is a list to read. The inventory filtered to the same sixty is
  // a list to act on, and the panel now hands the operator that instead of
  // growing to sixty rows tall with no way back.
  it('hands the blast radius to the inventory, and can be folded back up', () => {
    const products = Array.from({ length: 12 }, (_, index) => ({
      id: `p${index}`,
      name: `Tea ${index}`,
    }));
    const usage: WisdomUsage = {
      total: 40,
      byHolding: new Map([['cultivars', new Map([['rou-gui', { count: 12, products }]])]]),
      byHoldingTotal: new Map([['cultivars', 12]]),
    };
    const html = render(cultivars, { usage, selectedId: 'rou-gui' });
    expect(html).toContain('data-testid="wisdom-usage-products"');
    expect(html).toContain('and 4 more');
    expect(html).toContain('data-testid="wisdom-usage-inventory"');
    expect(html).toContain('Open all 12 in the inventory');
    expect(html).toContain(`href="/admin/inventory?wisdom=${encodeURIComponent('cultivars:rou-gui')}"`);
    // And one product goes the same way as all of them. It used to go a
    // different way: a bare panel link, which arrives with no chip naming the
    // entry, no filter and no way back, beside a link that carries all three.
    expect(html).toContain(`href="/admin/inventory?wisdom=${encodeURIComponent('cultivars:rou-gui')}&amp;panel=p0"`);
    expect(html).not.toContain('href="/admin/inventory?panel=');
  });

  // Eight seconds was a number nobody chose: no relationship to reading speed or
  // to the length of what it held on screen.
  it('sizes a line that shows itself and goes from what it says', () => {
    const short = 'Counted against all 4 products in this account, so this number is settled.';
    const long = `Counted against all 12345 products in this account, so this number is settled.`;
    expect(dwellFor(long)).toBeGreaterThan(dwellFor(short));
    // A beat to notice it, then reading speed. Both ends stay humane.
    expect(dwellFor('')).toBeGreaterThanOrEqual(1000);
    expect(dwellFor(short)).toBeGreaterThan(4000);
    expect(dwellFor(short)).toBeLessThan(8000);
  });

  // The token was the only thing on this screen that did not say itself: a link
  // that half fits fell back in silence and the reader was never told which half.
  it('says what a link asked for that this holding refused', () => {
    const refused = ['"nonsense" is not a grouping Cultivars has, so the list is ungrouped.'];
    const html = render(cultivars, { shapeRefused: refused });
    expect(html).toContain('data-testid="wisdom-shape-refused"');
    expect(html).toContain('is not something Cultivars can do');
    expect(html).toContain('is not a grouping Cultivars has, so the list is ungrouped.');
    // Nearly every link fits, and a screen with nothing to report says nothing.
    expect(render(cultivars)).not.toContain('data-testid="wisdom-shape-refused"');
    expect(render(cultivars, { shapeRefused: [] })).not.toContain('data-testid="wisdom-shape-refused"');
  });

  // The panel's position is a position IN something, and three controls narrow
  // that something. One of them re-tests on its own when the products land.
  it('names the run prev and next are walking, when it is not the whole holding', () => {
    const marks = WISDOM_HOLDINGS.find(holding => holding.id === 'marks')!;
    const gapped = marks.rows.filter(row => marks.gap!.test(row));
    expect(gapped.length).toBeGreaterThan(0);
    const open = render(marks, { gapOnly: true, selectedId: marks.idOf(gapped[0]) });
    expect(open).toContain('data-testid="wisdom-run-note"');
    expect(open).toContain(`walk ${gapped.length} of the ${marks.rows.length} marks: gaps only`);
    // Walking the whole holding needs no note; there is nothing to say.
    expect(render(marks, { selectedId: marks.idOf(marks.rows[0]) })).not.toContain('data-testid="wisdom-run-note"');
  });

  // The fraction was in the toolbar and the sentence about the run was at the
  // other end of the header, and a reader had to work out that the denominator
  // in one was the count in the other.
  it('prints the toolbar fraction at the head of the sentence that explains it', () => {
    const marks = WISDOM_HOLDINGS.find(holding => holding.id === 'marks')!;
    const gapped = marks.rows.filter(row => marks.gap!.test(row));
    const html = render(marks, { gapOnly: true, selectedId: marks.idOf(gapped[0]) });
    const note = html.slice(html.indexOf('data-testid="wisdom-run-note"'));
    // Same fraction, same mono, inside the run sentence.
    expect(note).toContain(`1 / ${gapped.length}`);
    expect(note).toContain('tabular-nums');
    // And the toolbar copy of it is not read out twice by a screen reader.
    expect(html).toContain(`Entry 1 of the ${gapped.length} this run walks`);
    // Walking the whole holding, the fraction stands on its own.
    const whole = render(marks, { selectedId: marks.idOf(marks.rows[0]) });
    expect(whole).toContain(`Entry 1 of ${marks.rows.length}`);
  });

  // Two searches on one screen. The field intersects every word across every
  // field; typing at the list is a prefix on the axis the list is ordered by.
  it('states both searches side by side, so the difference is not a surprise', () => {
    const html = render();
    expect(html).toContain('Type → Cultivar');
    // "Every field" was a claim the data could falsify. Every COLUMN is a claim
    // defineHolding guarantees, and holdings.test.ts holds it to that.
    expect(html).toContain('Find → every column');
    expect(html).not.toContain('every field');
    // The intersection says itself the moment it is doing something.
    expect(render(cultivars, { query: 'da hong' })).toContain('every word must match');
    expect(render(cultivars, { query: 'dahong' })).not.toContain('every word must match');
  });

  // The live region used to sit on the settling line, which is removed at the
  // exact moment the result arrives: a screen reader heard the question and
  // never the answer.
  it('keeps one live region mounted across both halves of the answer', () => {
    const looking = render(cultivars, { query: 'rougux' });
    const live = looking.indexOf('data-testid="wisdom-near-live"');
    expect(live).toBeGreaterThan(-1);
    // The region is the container, not the sentence, so it outlives each state.
    expect(looking.slice(live)).toContain('The nearest entry the base holds is Rou Gui');
    expect(looking).toContain('aria-live="polite"');
    // And the sentence it used to carry no longer claims to be its own region.
    expect(looking).not.toMatch(/data-testid="wisdom-near-settling"[^>]*aria-live/);
  });

  // Two seats, one statement. They carried two ids, which promised two different
  // things and let nothing hold the pair to being complements.
  it('seats the type-ahead miss once under one name, at both widths', () => {
    const html = render();
    // Both seats exist, and neither is named as though it were a second fact.
    expect(html).toContain('data-testid="wisdom-seat-wide"');
    expect(html).toContain('data-testid="wisdom-seat-narrow"');
    expect(html).not.toContain('wisdom-type-miss-sm');
    // The pair is complementary by construction: one is hidden until md, the
    // other hidden from md, so exactly one of them is ever on screen.
    expect(WISDOM_SEAT.wide).toBe('hidden md:block');
    expect(WISDOM_SEAT.narrow).toBe('md:hidden');
    for (const seat of ['wide', 'narrow'] as const) {
      const at = html.indexOf(`data-testid="wisdom-seat-${seat}"`);
      const tag = html.slice(html.lastIndexOf('<p', at), at);
      expect(tag, `${seat} seat`).toContain(WISDOM_SEAT[seat]);
    }
  });

  // A default is not a value that was recorded, and making every column findable
  // made the rendered defaults findable with the data.
  it('shows a column default in the cell and keeps it out of the find field', () => {
    const marks = WISDOM_HOLDINGS.find(holding => holding.id === 'marks')!;
    const applies = marks.columns.find(column => column.key === 'applies')!;
    const bare = marks.rows.find(row => applies.value(row) === null)!;
    expect(bare).toBeDefined();
    // The cell still says what it always said.
    expect(render(marks)).toContain(applies.fallback!);
    // And the word it says is not a way to find that row.
    const searched = render(marks, { query: applies.fallback! });
    expect(searched).not.toContain(`data-wisdom-id="${marks.idOf(bare)}"`);
  });

  it('makes the public address in the reach line the way to reach it', () => {
    for (const holding of WISDOM_HOLDINGS) {
      const index = holding.publicRef?.index;
      if (!index) continue;
      expect(render(holding), holding.id).toContain(`href="${index}"`);
    }
  });
});
