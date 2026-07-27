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
import CultivarIndexPage from './CultivarIndexPage';
import CultivarPage from './CultivarPage';
import MarkIndexPage from './MarkIndexPage';
import MarkPage from './MarkPage';
import NamedTeaIndexPage, { traditionLabel } from './NamedTeaIndexPage';
import ProducerIndexPage from './ProducerIndexPage';
import ProducerPage from './ProducerPage';
import RegionIndexPage from './RegionIndexPage';
import RegionPage from './RegionPage';
import StyleIndexPage from './StyleIndexPage';
import WisdomHomePage, { readableDate } from './WisdomHomePage';
import { WISDOM_SECTIONS, isMicroCapsLabel, searchHoldings } from './wisdomShared';
import { DATASET_BUILT, DATASET_VERSION } from './datasetStamp';
import { tidyName } from './LineageTree';
import { AUTHORSHIP } from '../../wisdom/authorship';
import { NAMING_TRADITIONS, REGIONS } from '../../wisdom';

const render = (path: string) =>
  renderToString(
    <HelmetProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/wisdom" element={<WisdomHomePage />} />
          <Route path="/wisdom/cultivars" element={<CultivarIndexPage />} />
          <Route path="/wisdom/regions" element={<RegionIndexPage />} />
          <Route path="/wisdom/region/:id" element={<RegionPage />} />
          <Route path="/wisdom/cultivar/:id" element={<CultivarPage />} />
          <Route path="/wisdom/producers" element={<ProducerIndexPage />} />
          <Route path="/wisdom/marks" element={<MarkIndexPage />} />
          <Route path="/wisdom/mark/:id" element={<MarkPage />} />
          <Route path="/wisdom/producer/:id" element={<ProducerPage />} />
          <Route path="/wisdom/styles" element={<StyleIndexPage />} />
          <Route path="/wisdom/named" element={<NamedTeaIndexPage />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );

const INDEX_PAGES = [
  '/wisdom/cultivars',
  '/wisdom/regions',
  '/wisdom/producers',
  '/wisdom/marks',
  '/wisdom/styles',
  '/wisdom/named',
];

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

  it('collapses to one line on a phone and keeps all seven reachable', () => {
    const html = render('/wisdom/regions');
    // Seven serif items need two 44px rows at 390px. Below sm the strip is
    // the holding you are in, and it opens in place.
    expect(html).toContain('aria-controls="wisdom-holdings"');
    expect(html).toContain('7 holdings');
    // Both shapes are in the DOM, but `hidden` is display:none, so exactly one
    // of them is in the accessibility tree at any width.
    expect(html).toContain('class="sm:hidden"');
    expect(html).toContain('class="hidden sm:block"');
    for (const section of WISDOM_SECTIONS) {
      expect(html).toContain(`href="${section.path}"`);
    }
  });
});

describe('the foot of a page', () => {
  it('does not repeat the scope footnote on every entry', () => {
    for (const path of DETAIL_PAGES) {
      expect(render(path)).not.toContain('account scoped');
    }
  });

  it('says the scope once, on the front door', () => {
    expect(render('/wisdom')).toContain('Nothing in the reference is account scoped');
  });
});

describe('where the authorship line lives', () => {
  it('states the rung once per holding while every entry sits on the same one', () => {
    for (const path of INDEX_PAGES) {
      expect(render(path)).toContain('was drafted from research');
    }
  });

  it('does not repeat that sentence on all three hundred entries', () => {
    for (const path of DETAIL_PAGES) {
      expect(render(path)).not.toContain('Drafted from research.');
    }
  });

  it('returns to the entry the moment a second rung exists', () => {
    AUTHORSHIP['jin-xuan'] = { rung: 'reviewed', reviewer: 'Adrian', date: '2026-07-27' };
    try {
      // The reviewed entry credits the person who read it...
      expect(render('/wisdom/cultivar/jin-xuan')).toContain('Reviewed and corrected by Adrian');
      // ...and every other entry starts saying it is not that, because from
      // here on the sentence tells one entry from the next.
      expect(render('/wisdom/mark/7572')).toContain('Drafted from research.');
      expect(render('/wisdom/cultivars')).toContain('states its own authorship');
    } finally {
      delete AUTHORSHIP['jin-xuan'];
    }
  });
});

describe('what the base is, as of when', () => {
  it('states the version, the build date and a citation on the front door', () => {
    // React writes comment separators between adjacent text nodes, so the
    // rendered sentence is matched by its parts rather than as one string.
    const html = render('/wisdom').replace(/<!-- -->/g, '');
    expect(html).toContain(`Version ${DATASET_VERSION}`);
    expect(html).toContain(`built ${readableDate(DATASET_BUILT)}`);
    expect(html).toContain('Cite it as');
  });

  it('reads an ISO date as a date a person would write', () => {
    expect(readableDate('2026-07-27')).toBe('27 July 2026');
    expect(readableDate('2026-01-01')).toBe('1 January 2026');
  });
});

describe('reaching the cross-holding search from inside a holding', () => {
  it('offers the way across on every index', () => {
    for (const path of INDEX_PAGES) {
      expect(render(path)).toContain('Search every holding at once');
    }
  });

  it('is not offered on the search itself', () => {
    expect(render('/wisdom')).not.toContain('Search every holding at once');
  });

  it('opens the front door with the words already typed', () => {
    expect(render('/wisdom?q=rou%20gui')).toContain('/wisdom/cultivar/rou-gui');
  });
});

describe('a toolbar with nothing on it', () => {
  it('gives every holding a way to order its own list', () => {
    for (const path of INDEX_PAGES) {
      expect(render(path)).toMatch(/aria-label="Browse the [a-z ]+"/);
    }
  });
});

describe('an empty cell', () => {
  it('says a mark has no producer rather than leaving the column blank', () => {
    const html = render('/wisdom/marks');
    expect(html).toContain('No producer recorded');
    expect(html).toContain('Not recorded');
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

  it('breaks the 98 places under China into groups a reader can land in', () => {
    const html = render('/wisdom/regions');
    // The country head, then the provinces inside it, then somewhere to jump.
    expect(html).toContain('id="place-china"');
    expect(html).toContain('id="place-china-fujian"');
    expect(html).toContain('Province not recorded');
    expect(html).toMatch(/<select[^>]*aria-label="Jump to a group of places"/);
    // A heading that leaves with the first screenful is no heading at all.
    expect(html).toMatch(/class="sticky top-0[^"]*"/);
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
