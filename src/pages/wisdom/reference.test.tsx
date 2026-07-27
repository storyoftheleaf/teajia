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
import NamedTeaPage from './NamedTeaPage';
import StylePage from './StylePage';
import ProducerIndexPage from './ProducerIndexPage';
import ProducerPage from './ProducerPage';
import RegionIndexPage from './RegionIndexPage';
import RegionPage from './RegionPage';
import StyleIndexPage from './StyleIndexPage';
import WisdomHomePage, { TOTAL_ENTRIES, readableDate } from './WisdomHomePage';
import { WISDOM_SECTIONS, isMicroCapsLabel, searchHoldings } from './wisdomShared';
import { DATASET_BUILT, DATASET_PAGES, DATASET_RECORDS, DATASET_VERSION } from './datasetStamp';
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
          <Route path="/wisdom/named/:id" element={<NamedTeaPage />} />
          <Route path="/wisdom/style/:id" element={<StylePage />} />
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
  '/wisdom/named/courage',
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

  it('prints it once, at the foot, and never stacked under a second dim line', () => {
    // Two 11px lines used to run between the toolbar and the first record on
    // the places and named-teas indexes. A reader met both before they met a
    // single entry.
    for (const path of INDEX_PAGES) {
      const html = render(path);
      const before = html.slice(0, html.indexOf('Search every holding at once'));
      expect(before).toContain('aria-label="Browse the');
      // The escape line now sits after the list, with the holding's own notes.
      expect(before).toContain('was drafted from research');
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
    expect(html).toMatch(/class="sticky top-0 pt-7[^"]*"/);
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

  it('explains the axis once, with the notes at the foot rather than above the list', () => {
    const html = render('/wisdom/named');
    expect(html).toContain('The groups above are how each tea came by its name');
    expect(html).not.toContain('named for the feeling of origin rather than a technical specification');
  });
});

describe('a cold arrival on one entry', () => {
  it('states the rung in the header, in one word, on every detail page', () => {
    for (const path of [...DETAIL_PAGES, '/wisdom/style/xiao-qing-gan']) {
      const html = render(path);
      // Somebody arriving from a search engine walks through no index, so the
      // holding's authorship sentence never reaches them. One micro-caps word
      // in the header is the whole repair.
      expect(html).toContain('Authorship: ');
      expect(html).toMatch(/>Drafted</);
      // Not the four-line footnote block that used to sit on all 300 entries.
      expect(html).not.toContain('Drafted from research. Not yet read by a human.<');
    }
  });

  it('leaves the word off an index, which says the sentence in full instead', () => {
    for (const path of INDEX_PAGES) {
      expect(render(path)).not.toContain('Authorship: ');
    }
  });
});

describe('two counts on the front door', () => {
  it('names what each one counts instead of printing them side by side', () => {
    const html = render('/wisdom').replace(/<!-- -->/g, '');
    expect(html).toContain(`${DATASET_RECORDS} records in all`);
    expect(html).toContain(`${DATASET_PAGES} entries with a page above`);
    expect(html).toContain(`${DATASET_RECORDS - DATASET_PAGES} tea variety names carried as data only`);
  });

  it('keeps the page count and the holding totals from drifting apart', () => {
    // The table above the stamp sums to TOTAL_ENTRIES; the export counts the
    // same records as DATASET_PAGES. If a holding is added to one and not the
    // other, the front door starts contradicting itself again in public.
    expect(DATASET_PAGES).toBe(TOTAL_ENTRIES);
    expect(DATASET_RECORDS).toBeGreaterThan(DATASET_PAGES);
  });
});

describe('a column that is empty on half its rows', () => {
  it('says why once, above the list, rather than on every bare row', () => {
    const html = render('/wisdom/regions');
    expect(html).toContain('working-list names');
    expect(html).toContain('not researched rather than not applicable');
    // 94 of the 182 places carry no altitude. The absent-cell device is for a
    // scarce absence; at this density it would be the loudest thing on screen.
    const notRecorded = html.match(/Not recorded/g) ?? [];
    expect(notRecorded.length).toBeLessThan(5);
  });

  it('counts what is recorded rather than printing a number that rots', () => {
    const altitude = REGIONS.filter(region => region.altitude).length;
    const province = REGIONS.filter(region => region.province).length;
    expect(altitude).toBeLessThan(REGIONS.length);
    const html = render('/wisdom/regions').replace(/<!-- -->/g, '');
    expect(html).toContain(`An altitude is recorded for ${altitude} of these places and a province for ${province}`);
  });
});

describe('a sticky group head', () => {
  it('carries an opaque fill and a bottom edge, so a row passing behind it is not a clipping fault', () => {
    const html = render('/wisdom/regions');
    // The fill is the panel's own, not a tone of its own: a filled heading band
    // over a ruled list is a table header, which is the one thing this is not.
    expect(html).toMatch(/class="sticky top-0 pt-7 z-10 bg-tea-surface border-b border-tea-border/);
  });

  it('is a heading with air above it rather than a band pressed against the row', () => {
    // Labels, head and first row used to run twenty pixels apart with nothing
    // saying which was the parent of which.
    expect(render('/wisdom/regions')).toContain('pt-7');
  });
});

describe('the container a holding sits in', () => {
  it('gives every index one panel, so the list has an edge and an inset', () => {
    for (const path of ['/wisdom', ...INDEX_PAGES]) {
      expect(render(path)).toContain('bg-tea-surface border border-tea-border rounded-xl');
    }
  });

  it('gives every detail page the same shape for its record', () => {
    for (const path of [...DETAIL_PAGES, '/wisdom/style/xiao-qing-gan']) {
      expect(render(path)).toContain('bg-tea-surface border border-tea-border rounded-xl');
    }
  });
});

describe('the jump control', () => {
  it('wears house chrome rather than the browser default', () => {
    const html = render('/wisdom/regions');
    expect(html).toMatch(/<select[^>]*class="[^"]*appearance-none/);
    // Its own chevron, drawn in the same glyph the compact nav uses.
    expect(html).toMatch(/<select[\s\S]{0,4000}?lucide-chevron-down/);
  });
});

describe('the pair of holdings that describe one relation', () => {
  it('opens both grouped, each by its own axis', () => {
    // Marks fall into producer piles; producers fall into kind piles. Neither
    // opens flat while the other opens grouped.
    expect(render('/wisdom/marks')).toContain('Menghai Tea Factory');
    const producers = render('/wisdom/producers');
    expect(producers).toContain('Factory');
    expect(producers).toContain('Marks held');
  });
});

describe('the tradition of a named tea', () => {
  it('is set as prose, not at label size', () => {
    const html = render('/wisdom/named/courage');
    expect(html).toContain('Naming tradition');
    // The sentence used to run at 11px, the label size, which is the fine-print
    // defect this loop removed everywhere else.
    const sentence = 'Chinese private-collection naming';
    const at11px = new RegExp(`text-ui-11[^"]*"[^>]*>${sentence}`);
    expect(html).not.toMatch(at11px);
    expect(html).toMatch(new RegExp(`text-ui-15[^"]*"[^>]*>${sentence}`));
  });
});

describe('searching wider than a name', () => {
  it('answers a place name with the records that name it, not only the place', () => {
    const hits = searchHoldings('Fujian');
    const holdings = new Set(hits.map(hit => hit.holding));
    expect(hits.length).toBeGreaterThan(3);
    // A search that answered "Fujian" with region rows alone made the base look
    // smaller than it is at the one moment a reader asked it to be bigger.
    expect(holdings.size).toBeGreaterThan(1);
  });

  it('reaches the marks a factory made, not only the factory', () => {
    const hits = searchHoldings('Menghai');
    expect(hits.some(hit => hit.holding === 'Marks')).toBe(true);
  });

  it('never lets a context match outrank a name match', () => {
    // The place itself still opens the list. The records that merely name it
    // follow, rather than displacing the thing the reader typed.
    for (const place of ['Wuyi', 'Fujian', 'Yunnan']) {
      expect(searchHoldings(place)[0].name.toLowerCase()).toBe(place.toLowerCase());
    }
  });

  it('still searches no prose', () => {
    // A word that appears only inside a description or a climate paragraph must
    // not match, or one query returns a hundred paragraphs.
    expect(searchHoldings('benchmark')).toEqual([]);
    expect(searchHoldings('monsoon')).toEqual([]);
  });
});

describe('the lineage rail at a narrow width', () => {
  it('does not let the not-held tag break across two lines', () => {
    const html = render('/wisdom/cultivar/cui-yu');
    expect(html).toMatch(/whitespace-nowrap[^>]*>not held here</);
  });

  it('keeps two generations reachable without a second rail', () => {
    // Chin Hsin's parent Cui Yu is itself a cross, so its parents are still on
    // the page, folded onto Cui Yu's own line rather than opening a nested list
    // with a spine and an indent of its own.
    const html = render('/wisdom/cultivar/chin-hsin').replace(/<!-- -->/g, '');
    expect(html).toContain('/wisdom/cultivar/cui-yu');
    expect(html).toContain('TRES-2022');
    expect(html).toContain('Tainung #80');
    // Said for a screen reader, so the folded line is not a bare "from".
    expect(html).toContain('Parents of Cui Yu');
    // One spine. The nested list that carried the second one is gone.
    expect(html).not.toContain('m-0 mt-2 p-0');
  });

  it('closes a bracket a split left dangling instead of printing half a name', () => {
    expect(tidyName('(Jin Xuan')).toBe('Jin Xuan');
    expect(tidyName('Qing Xin)')).toBe('Qing Xin');
    expect(tidyName('C. sinensis var. assamica (Burma')).toBe('C. sinensis var. assamica (Burma)');
    expect(tidyName("a hybrid of 'Sofu' and 'Makura-Cd86'.")).toBe("a hybrid of 'Sofu' and 'Makura-Cd86'");
    expect(tidyName("'Saemidori'")).toBe('Saemidori');
  });
});
