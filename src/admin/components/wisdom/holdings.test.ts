import { describe, expect, it } from 'vitest';
import { AUTHORSHIP } from '../../../wisdom/authorship';
import {
  WISDOM_SLOT,
  compareWisdom,
  editDistance,
  nearestWisdom,
  recogniseQuery,
  wisdomMatches,
  wisdomQueryTokens,
  wisdomStartsWith,
} from './config';
import { WISDOM_HOLDINGS } from './holdings';
import { rungSummary } from './Rung';

const wordCount = (label: string) => label.trim().split(/\s+/).length;
const holdingBy = (id: string) => WISDOM_HOLDINGS.find(holding => holding.id === id)!;

describe('wisdom holdings', () => {
  it('covers every holding the base actually has', () => {
    expect(WISDOM_HOLDINGS.map(holding => holding.id)).toEqual([
      'cultivars', 'regions', 'varieties', 'producers', 'marks', 'styles', 'named-teas',
    ]);
    for (const holding of WISDOM_HOLDINGS) {
      expect(holding.rows.length, `${holding.id} is empty`).toBeGreaterThan(0);
    }
  });

  it('gives every row a unique id so a detail panel can resolve it', () => {
    for (const holding of WISDOM_HOLDINGS) {
      const ids = holding.rows.map(row => holding.idOf(row));
      expect(new Set(ids).size, `${holding.id} has duplicate ids`).toBe(ids.length);
    }
  });

  // Micro-caps are a LABEL treatment: three words or fewer, never a sentence.
  it('keeps every micro-caps label to three words or fewer', () => {
    for (const holding of WISDOM_HOLDINGS) {
      for (const column of holding.columns) {
        expect(wordCount(column.label), `${holding.id}.${column.key}`).toBeLessThanOrEqual(3);
      }
      for (const row of holding.rows) {
        const detail = holding.detail(row);
        expect(wordCount(detail.kind), `${holding.id} panel eyebrow`).toBeLessThanOrEqual(3);
        for (const fact of detail.facts) {
          expect(wordCount(fact.label), `${holding.id} fact ${fact.label}`).toBeLessThanOrEqual(3);
        }
      }
    }
  });

  it('sorts by every sortable column without losing a row', () => {
    for (const holding of WISDOM_HOLDINGS) {
      for (const column of holding.columns.filter(entry => entry.sortable !== false)) {
        const sorted = [...holding.rows].sort((left, right) =>
          compareWisdom(column.value(left), column.value(right), 'asc'));
        expect(sorted.length, `${holding.id}.${column.key}`).toBe(holding.rows.length);
      }
    }
  });

  it('searches names, Chinese names and aliases', () => {
    const cultivars = WISDOM_HOLDINGS[0];
    const withChinese = cultivars.rows.find((row: { chineseName?: string }) => row.chineseName);
    expect(withChinese).toBeDefined();
    const haystack = cultivars.searchText(withChinese);
    expect(haystack).toContain(withChinese.chineseName);
    expect(haystack).toBe(haystack.toLowerCase());
  });

  // The tabs must not shift the axis under the reader. Every column outside the
  // name column lays into a shared slot, so its width and breakpoint are the
  // slot's, never the holding's own invention.
  it('lays every column into a shared slot, so the tabs agree', () => {
    const widths = new Set(Object.values(WISDOM_SLOT).map(entry => entry.width));
    for (const holding of WISDOM_HOLDINGS) {
      expect(holding.columns[0].width, `${holding.id} name column`).toBe('');
      for (const column of holding.columns.slice(1)) {
        expect(widths.has(column.width), `${holding.id}.${column.key} width ${column.width}`).toBe(true);
      }
    }
  });

  it('puts the same role in the same position on every tab', () => {
    // Slot two is the categorical word, slot three is the place. Both are the
    // same width and appear at the same breakpoint everywhere they exist.
    for (const holding of WISDOM_HOLDINGS) {
      const second = holding.columns[1];
      expect(second.width, `${holding.id} slot two`).toBe(WISDOM_SLOT.kind.width);
      expect(second.at ?? 'always', `${holding.id} slot two`).toBe(WISDOM_SLOT.kind.at);
      const third = holding.columns[2];
      if (!third) continue;
      expect(third.width, `${holding.id} slot three`).toBe(WISDOM_SLOT.place.width);
      expect(third.at, `${holding.id} slot three`).toBe(WISDOM_SLOT.place.at);
    }
  });

  it('gives every holding a grouping and a stated reach', () => {
    for (const holding of WISDOM_HOLDINGS) {
      expect(holding.groups?.length ?? 0, `${holding.id} has no grouping`).toBeGreaterThan(0);
      for (const group of holding.groups ?? []) {
        expect(wordCount(group.label), `${holding.id} group ${group.label}`).toBeLessThanOrEqual(3);
      }
      expect(holding.reach.length, `${holding.id} reach`).toBeGreaterThan(20);
      // The reach line is a sentence, so it ends like one.
      expect(holding.reach.trim().endsWith('.'), `${holding.id} reach`).toBe(true);
    }
  });

  it('groups the two holdings that plainly earn it', () => {
    const regions = WISDOM_HOLDINGS.find(holding => holding.id === 'regions')!;
    const byCountry = regions.groups!.find(group => group.key === 'country')!;
    const countries = new Set(regions.rows.map(row => byCountry.of(row)));
    expect(countries.size).toBeGreaterThan(5);
    expect(countries.size).toBeLessThan(regions.rows.length);

    const varieties = WISDOM_HOLDINGS.find(holding => holding.id === 'varieties')!;
    const byType = varieties.groups!.find(group => group.key === 'type')!;
    const types = new Set(varieties.rows.map(row => byType.of(row)));
    expect(types.size).toBeGreaterThan(3);
    expect(types.size).toBeLessThan(20);
  });

  it('says which kind of entry a region is, because the two differ in depth', () => {
    const regions = WISDOM_HOLDINGS.find(holding => holding.id === 'regions')!;
    const notes = regions.rows.map(row => regions.detail(row).note);
    expect(notes.every(Boolean), 'a region with no note reads as a bug').toBe(true);
    const kinds = new Set(notes);
    expect(kinds.size, 'both a researched and a working entry are held').toBe(2);
    // The short one says so plainly rather than leaving a blank panel.
    const working = regions.rows.find(row => !row.altitude && !row.climate);
    expect(regions.detail(working).note).toMatch(/working entry/i);
  });

  it('makes a held producer navigable from a mark, and back again', () => {
    const marks = WISDOM_HOLDINGS.find(holding => holding.id === 'marks')!;
    const producers = WISDOM_HOLDINGS.find(holding => holding.id === 'producers')!;
    const jumps: Array<{ holding: string; entry: string }> = [];
    const ctx = { jump: (link: { holding: string; entry: string }) => jumps.push(link) };

    const linkedMark = marks.rows.find(row => row.producerId);
    expect(linkedMark, 'no mark names a producer').toBeDefined();
    // The row cell and the panel both carry the link, not just the panel.
    const producerColumn = marks.columns.find(column => column.key === 'producer')!;
    expect(producerColumn.render!(linkedMark, ctx)).not.toBe(null);
    expect(marks.detail(linkedMark, ctx).facts.find(fact => fact.label === 'Producer')?.value).toBeTruthy();

    // And the other direction: a producer's held marks are somewhere to go.
    const producer = producers.rows.find(row => row.id === linkedMark.producerId)!;
    expect(producers.detail(producer, ctx).facts.find(fact => fact.label === 'Known for')?.value).toBeTruthy();
  });

  it('offers the base its own matcher for the holdings that have one', () => {
    const marks = WISDOM_HOLDINGS.find(holding => holding.id === 'marks')!;
    expect(marks.matchEntity).toBeDefined();
    const known = marks.rows.find(row => /^\d{4}$/.test(row.name));
    if (known) expect(marks.matchEntity!(known.name)?.id).toBe(known.id);
  });

  // Every holding is either published or plainly says it is not. The address is
  // named inside the reach sentence, which is what the browser turns into a link.
  it('names its public address in the sentence that links to it', () => {
    for (const holding of WISDOM_HOLDINGS) {
      const index = holding.publicRef?.index;
      if (!index) {
        expect(holding.reach, `${holding.id} has no public page and must say so`).toMatch(/no public page/i);
        continue;
      }
      expect(holding.reach, `${holding.id} reach`).toContain(index);
      const row = holding.rows[0];
      expect(holding.publicRef!.entry!(row), `${holding.id} entry path`).toContain(holding.idOf(row));
    }
  });

  it('reaches a region from the plants and teas that name it, and back', () => {
    const cultivars = holdingBy('cultivars');
    const regions = holdingBy('regions');
    const jumps: Array<{ holding: string; entry: string }> = [];
    const ctx = { jump: (link: { holding: string; entry: string }) => jumps.push(link) };

    // Forward: the row cell and the panel both carry it, as marks do for producers.
    const placed = cultivars.rows.find(row => row.originRegion && regions.matchEntity!(row.originRegion));
    expect(placed, 'no cultivar names a held region').toBeDefined();
    const regionColumn = cultivars.columns.find(column => column.key === 'region')!;
    expect(regionColumn.render!(placed, ctx)).not.toBe(null);
    expect(cultivars.detail(placed, ctx).facts.find(fact => fact.label === 'Region')?.value).toBeTruthy();

    // Back: the region names what grows there.
    const region = regions.matchEntity!(placed.originRegion)!;
    const facts = regions.detail(region, ctx).facts;
    expect(facts.find(fact => fact.label === 'Cultivars')?.value).toBeTruthy();
  });

  // A gap is a work queue, so it is stated as a sentence and counted, never
  // worn as a micro-caps label and never left to be met one row at a time.
  it('counts its own holes rather than describing them', () => {
    const gapped = WISDOM_HOLDINGS.filter(holding => holding.gap);
    expect(gapped.length, 'no holding admits to a gap').toBeGreaterThan(0);
    for (const holding of gapped) {
      const missing = holding.rows.filter(row => holding.gap!.test(row)).length;
      expect(missing, `${holding.id} gap counts more than it holds`).toBeLessThanOrEqual(holding.rows.length);
      const sentence = holding.gap!.sentence(missing, holding.rows.length);
      expect(sentence.trim().endsWith('.'), `${holding.id} gap sentence`).toBe(true);
      expect(sentence).toContain(String(missing));
    }
    // The one that prompted the whole thing: most cultivars name a place the
    // base cannot resolve, and until it was counted that was an anecdote.
    const cultivars = holdingBy('cultivars');
    const unheld = cultivars.rows.filter(row => cultivars.gap!.test(row)).length;
    expect(unheld).toBeGreaterThan(cultivars.rows.length / 3);
  });

  // A count standing in for a list has to be a way to reach the list.
  it('makes the counted tail of a relation somewhere to go', () => {
    const regions = holdingBy('regions');
    const varieties = holdingBy('varieties');
    const links: Array<{ holding: string; entry?: string; query?: string }> = [];
    const ctx = { jump: (link: { holding: string; entry?: string; query?: string }) => links.push(link) };

    // A place naming more varieties than a fact grid will list.
    const crowded = regions.rows.find(row => {
      const value = regions.detail(row, ctx).facts.find(fact => fact.label === 'Varieties')?.value;
      return Boolean(value);
    })!;
    expect(crowded).toBeDefined();

    // And the query such a link would carry finds them: a variety related to a
    // region always says that region somewhere in its own search text.
    const named = varieties.rows.filter(row =>
      wisdomMatches(varieties.searchText(row), wisdomQueryTokens(crowded.name)));
    expect(named.length).toBeGreaterThan(0);
  });

  it('says what a variety entry is, because it is the shallowest record held', () => {
    const varieties = holdingBy('varieties');
    for (const row of varieties.rows) {
      expect(varieties.detail(row).note, `${row.id} reads as a gap without a note`).toMatch(/short by design/i);
    }
    // And it resolves through the importer's own alias index, not a substring.
    const longjing = varieties.rows.find(row => row.name === 'Longjing')!;
    expect(varieties.matchEntity!('Dragon Well')?.id).toBe(longjing.id);
  });
});

describe('recogniseQuery', () => {
  const marks = holdingBy('marks');
  const varieties = holdingBy('varieties');
  const known = marks.rows.find(row => /^\d{4}$/.test(row.name))!;

  it('reports a recognition inside the open holding as its own', () => {
    const found = recogniseQuery(known.name, marks, WISDOM_HOLDINGS)!;
    expect(found.own).toBe(true);
    expect(marks.idOf(found.row)).toBe(known.id);
  });

  it('names the holding a query belongs to when it is not this one', () => {
    const found = recogniseQuery(known.name, varieties, WISDOM_HOLDINGS)!;
    expect(found.own).toBe(false);
    expect(found.holding.id).toBe('marks');
  });

  it('stays silent when the base makes nothing of the query', () => {
    expect(recogniseQuery('zzzznothing', marks, WISDOM_HOLDINGS)).toBe(null);
    expect(recogniseQuery('   ', marks, WISDOM_HOLDINGS)).toBe(null);
  });
});

describe('nearestWisdom', () => {
  const cultivars = holdingBy('cultivars');
  const marks = holdingBy('marks');

  it('offers the entry a query was one character away from', () => {
    const near = nearestWisdom('rougi', cultivars, WISDOM_HOLDINGS)!;
    expect(near).not.toBe(null);
    expect(near.own).toBe(true);
    expect(near.name).toBe('Rou Gui');
  });

  it('reads the open holding first, then the rest of the base', () => {
    const near = nearestWisdom('rou gu', marks, WISDOM_HOLDINGS);
    expect(near?.holding.id).toBe('cultivars');
    expect(near?.own).toBe(false);
  });

  it('stays silent on a query nothing is near, and on a stub too short to judge', () => {
    expect(nearestWisdom('zzzzqqqqxxxx', cultivars, WISDOM_HOLDINGS)).toBe(null);
    // Under four characters everything is one edit from everything else.
    expect(nearestWisdom('rou', cultivars, WISDOM_HOLDINGS)).toBe(null);
  });
});

describe('editDistance', () => {
  it('counts an edit, and gives up rather than counting a stranger exactly', () => {
    expect(editDistance('rougui', 'rougui', 2)).toBe(0);
    expect(editDistance('rougi', 'rougui', 2)).toBe(1);
    expect(editDistance('rougui', 'dahongpao', 2)).toBe(3);
  });
});

describe('wisdomStartsWith', () => {
  it('folds a typed prefix the way the find field folds a query', () => {
    expect(wisdomStartsWith('Da Hong Pao', 'dah')).toBe(true);
    expect(wisdomStartsWith("Lu'an Gua Pian", 'lua')).toBe(true);
    expect(wisdomStartsWith('Longjing', 'x')).toBe(false);
    // Nothing typed is not a match for everything; it is no jump at all.
    expect(wisdomStartsWith('Longjing', '')).toBe(false);
  });
});

describe('wisdom find', () => {
  const find = (hay: string, query: string) => wisdomMatches(hay, wisdomQueryTokens(query));

  it('will not cut a number in half', () => {
    expect(find('7572 Menghai', '7572')).toBe(true);
    expect(find('75720 Menghai', '7572')).toBe(false);
    expect(find('Tainung 80', '8')).toBe(false);
  });

  it('ignores spacing and punctuation the way the rest of the app does', () => {
    expect(find('Da Hong Pao 大红袍', 'dahongpao')).toBe(true);
    expect(find('Da Hong Pao', 'da hong')).toBe(true);
    expect(find("Pu'er, Yunnan", 'puer')).toBe(true);
  });

  it('requires every word of a query, so a second word narrows', () => {
    expect(find('Menghai Tea Factory 7572', 'menghai 7572')).toBe(true);
    expect(find('Menghai Tea Factory 7572', 'menghai 8582')).toBe(false);
  });

  it('matches everything when nothing was asked', () => {
    expect(find('anything', '')).toBe(true);
    expect(find('anything', '   ')).toBe(true);
  });
});

describe('compareWisdom', () => {
  it('sinks missing values to the end in both directions', () => {
    expect(compareWisdom(null, 'Anhui', 'asc')).toBeGreaterThan(0);
    expect(compareWisdom(null, 'Anhui', 'desc')).toBeGreaterThan(0);
    expect(compareWisdom('Anhui', undefined, 'desc')).toBeLessThan(0);
    expect(compareWisdom('', 'Anhui', 'asc')).toBeGreaterThan(0);
  });

  it('compares numbers numerically, not as strings', () => {
    expect(compareWisdom(9, 100, 'asc')).toBeLessThan(0);
  });
});

describe('rungSummary', () => {
  it('says the shape once instead of repeating a word on every row', () => {
    expect(rungSummary(['a', 'b', 'c'])).toBe('all 3 drafted, none reviewed');
  });

  it('counts the rungs once a record is actually reviewed', () => {
    AUTHORSHIP['test-reviewed'] = { rung: 'reviewed' };
    try {
      expect(rungSummary(['a', 'b', 'test-reviewed'])).toBe('2 drafted, 1 reviewed');
    } finally {
      delete AUTHORSHIP['test-reviewed'];
    }
  });
});
