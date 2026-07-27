/**
 * Guards the shape of the public reference, not its prose.
 *
 * Every assertion here stands for a specific way the pages have already gone
 * wrong once: a second back link, a footnote repeated on 300 entries, a group
 * head that was a sentence, a filtered list that vanished without saying why.
 *
 * Run with: npx vitest run src/pages/wisdom/reference.test.tsx
 */
import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import CultivarPage from './CultivarPage';
import MarkIndexPage from './MarkIndexPage';
import MarkPage from './MarkPage';
import NamedTeaIndexPage, { traditionLabel } from './NamedTeaIndexPage';
import ProducerPage from './ProducerPage';
import RegionIndexPage from './RegionIndexPage';
import RegionPage from './RegionPage';
import WisdomHomePage from './WisdomHomePage';
import { WISDOM_SECTIONS, isMicroCapsLabel, searchHoldings } from './wisdomShared';
import { tidyName } from './LineageTree';
import { NAMING_TRADITIONS, REGIONS } from '../../wisdom';

const render = (path: string) =>
  renderToString(
    <HelmetProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/wisdom" element={<WisdomHomePage />} />
          <Route path="/wisdom/regions" element={<RegionIndexPage />} />
          <Route path="/wisdom/region/:id" element={<RegionPage />} />
          <Route path="/wisdom/cultivar/:id" element={<CultivarPage />} />
          <Route path="/wisdom/marks" element={<MarkIndexPage />} />
          <Route path="/wisdom/mark/:id" element={<MarkPage />} />
          <Route path="/wisdom/producer/:id" element={<ProducerPage />} />
          <Route path="/wisdom/named" element={<NamedTeaIndexPage />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );

const DETAIL_PAGES = [
  '/wisdom/cultivar/jin-xuan',
  '/wisdom/mark/7572',
  '/wisdom/producer/menghai-tea-factory',
  '/wisdom/region/wuyi-mountains-fujian',
];

describe('wayfinding', () => {
  it('carries one control, not a back link above a lit nav item', () => {
    for (const path of DETAIL_PAGES) {
      const html = render(path);
      expect(html).toContain('aria-label="The wisdom base"');
      expect(html).toContain('aria-current="page"');
      // The back link said "All tea plants" directly above a strip already
      // marking Plants as current. 44px of chrome saying the same thing twice.
      expect(html).not.toMatch(/All (tea plants|marks|producers|growing regions)</);
    }
  });

  it('lights the holding a detail page belongs to', () => {
    expect(render('/wisdom/region/wuyi-mountains-fujian')).toMatch(
      /aria-current="page"[^>]*>Regions|Regions<\/a>/,
    );
  });
});

describe('the foot of a page', () => {
  it('runs one line of authorship and no repeated scope footnote', () => {
    for (const path of DETAIL_PAGES) {
      const html = render(path);
      expect(html).toContain('Drafted from research.');
      expect(html).not.toContain('account scoped');
    }
  });

  it('says the scope once, on the front door', () => {
    expect(render('/wisdom')).toContain('Nothing in the reference is account scoped');
  });
});

describe('growing regions', () => {
  it('is a holding in the nav', () => {
    expect(WISDOM_SECTIONS.map(section => section.id)).toContain('regions');
    expect(WISDOM_SECTIONS.find(section => section.id === 'regions')?.path).toBe('/wisdom/regions');
  });

  it('lists every place the base holds', () => {
    const html = render('/wisdom/regions');
    expect(REGIONS.length).toBeGreaterThan(150);
    expect(html).toContain(`${REGIONS.length} places`);
    expect(html).toContain('/wisdom/region/wuyi-mountains-fujian');
  });

  it('names the plants recorded from a place, and says so when there are none', () => {
    const wuyi = render('/wisdom/region/wuyi-mountains-fujian');
    expect(wuyi).toContain('Plants from here');
    expect(wuyi).toContain('/wisdom/cultivar/');

    const bare = render('/wisdom/region/anji');
    expect(bare).toContain('No plant in the reference records this place as its origin yet');
  });

  it('answers for a place it does not hold', () => {
    expect(render('/wisdom/region/nope')).toContain('Not a place we hold');
  });
});

describe('a mark and its producer', () => {
  it('reaches the producer from the row, not just the page', () => {
    const index = render('/wisdom/marks');
    expect(index).toContain('/wisdom/producer/menghai-tea-factory');
    // A mark with no producer in the base keeps a plain cell.
    expect(index).toContain('AAA');
  });

  it('says plainly when no producer is recorded', () => {
    expect(render('/wisdom/mark/aaa-grade')).toContain('Not recorded');
  });

  it('reaches the marks from the producer', () => {
    expect(render('/wisdom/producer/menghai-tea-factory')).toContain('/wisdom/mark/7572');
  });
});

describe('a cultivar is not a dead end', () => {
  it('says what the reference does not know about the shop, and points at it', () => {
    const html = render('/wisdom/cultivar/jin-xuan');
    expect(html).toContain('nothing on sale is currently attributed to this plant');
    expect(html).toContain('href="/shop"');
  });
});

describe('searching every holding at once', () => {
  it('finds a name without being told which holding it lives in', () => {
    const hits = searchHoldings('Rou Gui');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].holding).toBe('Plants');
    expect(hits[0].to).toMatch(/^\/wisdom\/cultivar\//);
  });

  it('reaches every holding', () => {
    expect(searchHoldings('7572')[0]?.holding).toBe('Marks');
    expect(searchHoldings('Menghai Tea Factory')[0]?.holding).toBe('Producers');
    expect(searchHoldings('Courage')[0]?.holding).toBe('Named');
    expect(searchHoldings('Wuyi')[0]?.holding).toBeTruthy();
  });

  it('sorts an exact name above a partial one', () => {
    const hits = searchHoldings('Wuyi');
    const exact = hits.findIndex(hit => hit.name.toLowerCase() === 'wuyi');
    expect(exact).toBe(0);
  });

  it('answers nothing for nothing', () => {
    expect(searchHoldings('   ')).toEqual([]);
    expect(searchHoldings('qqzzx')).toEqual([]);
  });

  it('says what it searched for when a search finds nothing', () => {
    // Rendered server-side the field is empty, so this checks the copy exists
    // in the component rather than driving the input.
    expect(render('/wisdom')).toContain('Search every holding');
  });
});

describe('group heads', () => {
  it('never uses a sentence as a label', () => {
    for (const tradition of NAMING_TRADITIONS) {
      const label = traditionLabel(tradition);
      expect(label).not.toContain('(');
      expect(label.split(/\s+/).length).toBeLessThanOrEqual(3);
      expect(isMicroCapsLabel(label)).toBe(true);
    }
  });

  it('keeps what makes each tradition different', () => {
    expect(traditionLabel('Chinese poetic tea-naming (named for the feeling of origin rather than a technical specification)')).toBe('Poetic');
    expect(traditionLabel('Chinese private-collection naming')).toBe('Private-collection');
    expect(traditionLabel('Chinese private-collection naming, paired naming')).toBe('Private-collection, paired');
    expect(traditionLabel('anonymous or packaging-only naming')).toBe('Anonymous or packaging-only');
    // Cut from the front: the export is what makes this one different.
    expect(traditionLabel('undocumented export or trade-route naming')).toBe('Export or trade-route');
  });

  it('explains the axis once, above the list', () => {
    const html = render('/wisdom/named');
    expect(html).toContain('Grouped by how the tea came by its name');
    expect(html).not.toContain('named for the feeling of origin rather than a technical specification');
  });
});

describe('the lineage rail at a narrow width', () => {
  it('does not let the not-held tag break across two lines', () => {
    const html = render('/wisdom/cultivar/cui-yu');
    expect(html).toMatch(/whitespace-nowrap[^>]*>not held here</);
  });

  it('keeps two generations on the page', () => {
    // Chin Hsin's parent Cui Yu is itself a cross, so its parents appear a
    // generation further back at the fact size.
    const html = render('/wisdom/cultivar/chin-hsin');
    expect(html).toContain('/wisdom/cultivar/cui-yu');
    expect(html).toContain('TRES-2022');
    expect(html).toContain('Tainung #80');
  });

  it('closes a bracket a split left dangling instead of printing half a name', () => {
    expect(tidyName('(Jin Xuan')).toBe('Jin Xuan');
    expect(tidyName('Qing Xin)')).toBe('Qing Xin');
    expect(tidyName('C. sinensis var. assamica (Burma')).toBe('C. sinensis var. assamica (Burma)');
    expect(tidyName("a hybrid of 'Sofu' and 'Makura-Cd86'.")).toBe("a hybrid of 'Sofu' and 'Makura-Cd86'");
    expect(tidyName("'Saemidori'")).toBe('Saemidori');
  });
});
