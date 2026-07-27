import { describe, expect, it } from 'vitest';
import { AUTHORSHIP } from '../../../wisdom/authorship';
import {
  ALL_FOLDED,
  NEAR_MISS_LIMIT,
  OPEN_MARK,
  WISDOM_SLOT,
  compareWisdom,
  defaultPrefs,
  editDistance,
  isSectionFolded,
  nearestWisdom,
  readFold,
  readGapAccount,
  readWisdomShape,
  readWisdomShapeReport,
  recogniseQuery,
  settleLoan,
  toggleFold,
  wisdomEntryHref,
  wisdomInventoryHref,
  wisdomKey,
  wisdomMatches,
  wisdomQueryTokens,
  wisdomShapeToken,
  wisdomShown,
  wisdomStartsWith,
  withInventoryPanel,
  type WisdomPrefs,
} from './config';
import { WISDOM_HOLDINGS } from './holdings';
import { readWisdomScope } from './usage';
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

  // "Find reads every column" was a claim seven hand-written haystacks could
  // falsify, and five of them did: a cultivar's year, a region's altitude, a
  // producer's kind and founding year, a mark's applies-to and a named tea's
  // provenance were all on screen and none of them were findable. The guarantee
  // is structural now, so an eighth column cannot quietly break it.
  it('puts every column a reader can see into the text find reads', () => {
    for (const holding of WISDOM_HOLDINGS) {
      for (const row of holding.rows) {
        const hay = wisdomKey(holding.searchText(row));
        for (const column of holding.columns) {
          const value = column.value(row);
          if (value === null || value === undefined || value === '') continue;
          expect(hay.includes(wisdomKey(String(value))), `${holding.id}.${column.key} = ${value}`).toBe(true);
        }
      }
    }
  });

  // The five that used to fall through, named so the regression is legible.
  it('finds the columns that were on screen and unfindable before', () => {
    const find = (holding: ReturnType<typeof holdingBy>, row: unknown, query: string) =>
      wisdomMatches(holding.searchText(row), wisdomQueryTokens(query));

    const cultivars = holdingBy('cultivars');
    const dated = cultivars.rows.find(row => row.developedYear)!;
    expect(find(cultivars, dated, String(dated.developedYear))).toBe(true);

    const producers = holdingBy('producers');
    const founded = producers.rows.find(row => row.founded)!;
    expect(find(producers, founded, String(founded.founded))).toBe(true);
    const kindColumn = producers.columns.find(column => column.key === 'kind')!;
    expect(find(producers, founded, String(kindColumn.value(founded)))).toBe(true);

    const marks = holdingBy('marks');
    const applied = marks.rows.find(row => row.appliesToTypes?.length)!;
    expect(find(marks, applied, applied.appliesToTypes[0])).toBe(true);

    const namedTeas = holdingBy('named-teas');
    const provenance = namedTeas.columns.find(column => column.key === 'provenance')!;
    const named = namedTeas.rows[0];
    expect(find(namedTeas, named, String(provenance.value(named)))).toBe(true);
  });

  // Folding every column into the haystack also folded in the words the cells
  // render when there is nothing to render: "Any" is what a column says about a
  // mark that states no types, not a word anyone wrote on that mark.
  it('keeps a rendered default out of the text find reads', () => {
    const withFallback = WISDOM_HOLDINGS.flatMap(holding =>
      holding.columns.filter(column => column.fallback).map(column => ({ holding, column })));
    // Two columns declare one, and both are the same absence: applies to nothing
    // in particular. If a third appears it is held to the same rule.
    expect(withFallback.map(entry => `${entry.holding.id}.${entry.column.key}`))
      .toEqual(['marks.applies', 'styles.applies']);

    for (const { holding, column } of withFallback) {
      const tokens = wisdomQueryTokens(column.fallback!);
      for (const row of holding.rows) {
        if (column.value(row) !== null && column.value(row) !== undefined) continue;
        const label = `${holding.id}.${column.key} on ${holding.idOf(row)}`;
        expect(wisdomMatches(holding.searchText(row), tokens), label).toBe(false);
      }
    }
  });

  // Two declarations of one field cost nothing the day they are written and
  // drift on every day after it. A part that IS a column's value is the
  // duplicate; an alias that merely contains one is not, which is why what a
  // holding searches beyond its columns is parts rather than one joined string.
  it('searches beyond the columns only for what the columns do not show', () => {
    // Compared as written rather than folded, because the base holds aliases
    // that differ from the name only in spacing ("Long Jing" for "Longjing").
    // Those are two records of a real thing; a restated column is not.
    const same = (left: unknown, right: unknown) =>
      String(left).trim().toLowerCase() === String(right).trim().toLowerCase();

    // Counted across the holding rather than asserted row by row, because a
    // record here and there genuinely coincides: a Keemun is known as "Qimen"
    // and grows in Qimen. A restated column is not a coincidence, it is every
    // row, so the test is that a column is never restated by the majority.
    for (const holding of WISDOM_HOLDINGS) {
      for (const column of holding.columns) {
        const held = holding.rows.filter(row => {
          const value = column.value(row);
          return value !== null && value !== undefined && value !== '';
        });
        if (held.length < 3) continue;
        const restated = held.filter(row =>
          holding.beyondColumns(row).filter(Boolean).some(part => same(part, column.value(row))));
        const label = `${holding.id}.${column.key} is declared twice on ${restated.length} of ${held.length} rows`;
        expect(restated.length * 2, label).toBeLessThan(held.length);
      }
    }
    // And every holding still carries something beyond its columns: a holding
    // whose parts are all columns has nothing left to say and should say nothing.
    for (const holding of WISDOM_HOLDINGS) {
      const carries = holding.rows.some(row => holding.beyondColumns(row).some(Boolean));
      expect(carries, `${holding.id} searches nothing beyond its columns`).toBe(true);
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

  // Regions was the only holding counting no hole of its own, which read as a
  // complete record and is not.
  it('counts the places nothing names, which is the region-shaped hole', () => {
    const regions = holdingBy('regions');
    expect(regions.gap, 'regions admits to no gap').toBeDefined();
    const unread = regions.rows.filter(row => regions.gap!.test(row));
    expect(unread.length).toBeGreaterThan(0);
    expect(unread.length).toBeLessThan(regions.rows.length);
    // A place a cultivar names is never in it, in either direction.
    const cultivars = holdingBy('cultivars');
    const placed = cultivars.rows.find(row => row.originRegion && regions.matchEntity!(row.originRegion))!;
    const named = regions.matchEntity!(placed.originRegion)!;
    expect(regions.gap!.test(named)).toBe(false);
  });

  // The account's own products are half the answer, and the base cannot see
  // them, so they arrive as context and the count narrows rather than jumping.
  it('lets a product rescue a region the base alone would call unread', () => {
    const regions = holdingBy('regions');
    const unread = regions.rows.find(row => regions.gap!.test(row))!;
    expect(unread).toBeDefined();
    const withProduct = { used: (id: string) => (id === unread.id ? 3 : 0) };
    expect(regions.gap!.test(unread, withProduct)).toBe(false);
  });

  // Two devices, one fact: the count and the grouping that shows it in shape.
  it('names the grouping that reveals a gap, where one exists', () => {
    const marks = holdingBy('marks');
    const reveal = marks.gap!.revealBy!;
    expect(reveal).toBe('producer');
    expect(marks.groups!.some(group => group.key === reveal)).toBe(true);
    // And the grouping really does pile the gap rows under one heading.
    const grouping = marks.groups!.find(group => group.key === reveal)!;
    const gapped = marks.rows.filter(row => marks.gap!.test(row));
    expect(gapped.length).toBeGreaterThan(0);
    expect(new Set(gapped.map(row => grouping.of(row)))).toEqual(new Set(['']));
    // Every holding that names one names a grouping it actually has.
    for (const holding of WISDOM_HOLDINGS) {
      const named = holding.gap?.revealBy;
      if (!named) continue;
      expect(holding.groups?.some(group => group.key === named), `${holding.id} reveals by ${named}`).toBe(true);
    }
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
    const [near] = nearestWisdom('rougi', cultivars, WISDOM_HOLDINGS);
    expect(near).toBeDefined();
    expect(near.own).toBe(true);
    expect(near.name).toBe('Rou Gui');
  });

  it('reads the open holding first, then the rest of the base', () => {
    const [near] = nearestWisdom('rou gu', marks, WISDOM_HOLDINGS);
    expect(near?.holding.id).toBe('cultivars');
    expect(near?.own).toBe(false);
  });

  it('stays silent on a query nothing is near, and on a stub too short to judge', () => {
    expect(nearestWisdom('zzzzqqqqxxxx', cultivars, WISDOM_HOLDINGS)).toEqual([]);
    // Under four characters everything is one edit from everything else.
    expect(nearestWisdom('rou', cultivars, WISDOM_HOLDINGS)).toEqual([]);
  });

  // A silently chosen winner is only ever right when there is one candidate.
  it('offers every close entry, nearest first, and never more than a choice', () => {
    const many = nearestWisdom('rou gux', cultivars, WISDOM_HOLDINGS);
    expect(many.length).toBeGreaterThan(0);
    expect(many.length).toBeLessThanOrEqual(NEAR_MISS_LIMIT);
    // Whatever the base is asked, it never answers with a duplicate entry.
    const seen = many.map(miss => `${miss.holding.id}:${miss.holding.idOf(miss.row)}`);
    expect(new Set(seen).size).toBe(seen.length);
    // The open holding leads: a reader looking at cultivars means a cultivar.
    expect(many[0].own).toBe(true);
  });

  it('puts a nearer entry before a further one', () => {
    const found = nearestWisdom('dahonpao', cultivars, WISDOM_HOLDINGS);
    expect(found.length).toBeGreaterThan(1);
    expect(found[0].name).toBe('Da Hong Pao');
  });
});

describe('the wisdom address', () => {
  const regions = holdingBy('regions');
  /** Written and read back, which is the only property that actually matters. */
  const roundTrip = (prefs: WisdomPrefs, holding: ReturnType<typeof holdingBy>) =>
    readWisdomShape(wisdomShapeToken(prefs, holding), holding);

  it('writes nothing for a holding that has not been shaped', () => {
    expect(wisdomShapeToken(defaultPrefs(regions), regions)).toBe('');
    expect(readWisdomShape('', regions)).toEqual(defaultPrefs(regions));
    expect(readWisdomShape(null, regions)).toEqual(defaultPrefs(regions));
  });

  // Six keys said this, and at six the address was a form rather than a link.
  it('carries the grouping, the sort and the folded shape in ONE token', () => {
    const shaped: WisdomPrefs = {
      sort: { key: 'altitude', direction: 'desc' },
      groupKey: 'country',
      collapsed: ['China', 'Japan'],
      gapOnly: false,
      borrowed: null,
    };
    expect(wisdomShapeToken(shaped, regions)).toBe('gcountry~s-altitude~fChina~fJapan');
    expect(roundTrip(shaped, regions)).toEqual(shaped);
  });

  // Grouping, sort and the folded shape all survived being sent. The gap filter
  // did not, and it is the one link an operator most wants to send.
  it('carries the gap filter too, and refuses it where no gap is counted', () => {
    const marks = holdingBy('marks');
    const gapped: WisdomPrefs = { ...defaultPrefs(marks), groupKey: 'producer', gapOnly: true };
    expect(wisdomShapeToken(gapped, marks)).toBe('gproducer~x');
    expect(roundTrip(gapped, marks)).toEqual(gapped);

    // A holding that counts no hole cannot be filtered to it, however addressed.
    const producers = holdingBy('producers');
    expect(wisdomShapeToken({ ...defaultPrefs(producers), gapOnly: true }, producers)).toBe('');
    expect(readWisdomShape('x', producers).gapOnly).toBe(false);
  });

  // Folding 182 regions to sixteen headings must not spend 120 characters of
  // address saying "all of them".
  it('says a wholly folded shape in one token', () => {
    const folded: WisdomPrefs = {
      sort: defaultPrefs(regions).sort,
      groupKey: 'country',
      collapsed: [ALL_FOLDED],
      gapOnly: false,
      borrowed: null,
    };
    expect(wisdomShapeToken(folded, regions)).toBe(`gcountry~f${ALL_FOLDED}`);
    expect(roundTrip(folded, regions)).toEqual(folded);
  });

  // And "all but one" without abandoning the sentinel and spelling out the other
  // fifteen the moment one heading is opened.
  it('says all but one without listing the rest', () => {
    const shaped: WisdomPrefs = {
      sort: defaultPrefs(regions).sort,
      groupKey: 'country',
      collapsed: [ALL_FOLDED, `${OPEN_MARK}China`],
      gapOnly: false,
      borrowed: null,
    };
    const token = wisdomShapeToken(shaped, regions);
    expect(token).toBe(`gcountry~f${ALL_FOLDED}~f${OPEN_MARK}China`);
    // The whole shape of 182 regions, in a token a person can still read.
    expect(token.length).toBeLessThan(32);
    expect(roundTrip(shaped, regions)).toEqual(shaped);
  });

  // A grouping the gap filter took on loan is a debt, and a debt that lives in a
  // ref is a promise only the session that made it can keep.
  it('carries what the gap filter borrowed, so a link can give it back', () => {
    const marks = holdingBy('marks');
    const onLoan: WisdomPrefs = {
      ...defaultPrefs(marks),
      groupKey: 'producer',
      gapOnly: true,
      borrowed: { groupKey: 'era', collapsed: [ALL_FOLDED] },
    };
    expect(wisdomShapeToken(onLoan, marks)).toBe(`gproducer~x~bera~F${ALL_FOLDED}`);
    expect(roundTrip(onLoan, marks)).toEqual(onLoan);

    // "No grouping at all" is a real thing to hand back, and says so in one char.
    const fromNone: WisdomPrefs = {
      ...defaultPrefs(marks),
      groupKey: 'producer',
      gapOnly: true,
      borrowed: { groupKey: '', collapsed: [] },
    };
    expect(wisdomShapeToken(fromNone, marks)).toBe('gproducer~x~b');
    expect(roundTrip(fromNone, marks)).toEqual(fromNone);
  });

  it('refuses a loan with no gap filter to belong to, or a grouping it cannot repay', () => {
    const marks = holdingBy('marks');
    // Nothing is on loan when the gap filter is off, however addressed.
    expect(readWisdomShape('gproducer~bera', marks).borrowed).toBe(null);
    // And a grouping this holding does not have is not a promise worth keeping.
    expect(readWisdomShape('x~gproducer~bnonsense', marks).borrowed).toBe(null);
  });

  it('falls back rather than obeying a token the holding cannot honour', () => {
    expect(readWisdomShape('gnonsense~s-nonsense~fChina', regions)).toEqual(defaultPrefs(regions));
    // A tag from some later version of this screen is ignored, not obeyed.
    expect(readWisdomShape('zsomething~gcountry', regions).groupKey).toBe('country');
  });

  // A folded shape belongs to the grouping that produced it.
  it('drops a folded shape that has no grouping to belong to', () => {
    expect(readWisdomShape('fChina~fJapan', regions).collapsed).toEqual([]);
  });

  it('refuses to sort by a column the holding says is not sortable', () => {
    const marks = holdingBy('marks');
    const unsortable = marks.columns.find(column => column.sortable === false)!;
    expect(readWisdomShape(`s${unsortable.key}`, marks).sort).toEqual(defaultPrefs(marks).sort);
  });

  // Falling back was right and doing it in silence was not: a link that half
  // fits left the reader looking at a list that was not the one it named, with
  // nothing on screen saying which half had been refused.
  it('says what it refused, and says it in whole sentences', () => {
    const marks = holdingBy('marks');
    const { prefs, refused } = readWisdomShapeReport('gnonsense~s-nonsense~fChina', marks);
    expect(prefs).toEqual(defaultPrefs(marks));
    // One sentence per thing refused: the grouping, the sort, and the fold that
    // was left with no grouping to belong to.
    expect(refused.length).toBe(3);
    for (const sentence of refused) {
      expect(sentence.trim().endsWith('.'), sentence).toBe(true);
      // Every one of them says what happened INSTEAD, not just what was denied.
      expect(sentence, sentence).toMatch(/, so /);
    }
    expect(refused[0]).toContain('"nonsense" is not a grouping Marks has');
    expect(refused[1]).toContain('sorted by Mark');

    // A gap filter on a holding that counts no hole, and a loan with no gap.
    expect(readWisdomShapeReport('x', holdingBy('producers')).refused[0]).toContain('counts no hole');
    expect(readWisdomShapeReport('gproducer~bera', marks).refused[0]).toContain('nothing is on loan');
    // A tag from some later version of this screen is skipped, and said.
    expect(readWisdomShapeReport('zsomething~gproducer', marks).refused[0])
      .toContain('"zsomething" is not a part of the shape this screen knows');
    // And a shape a holding can honour is refused nothing at all, which is what
    // nearly every link is.
    expect(readWisdomShapeReport('gproducer~x', marks).refused).toEqual([]);
    expect(readWisdomShapeReport('', marks).refused).toEqual([]);
    expect(readWisdomShapeReport(null, marks).refused).toEqual([]);
  });
});

// A loan is a promise about a press. It cannot outlive the screen that press was
// made on, and it used to outlive it by the whole visit.
describe('the borrowed grouping', () => {
  const marks = holdingBy('marks');
  const onLoan: WisdomPrefs = {
    ...defaultPrefs(marks),
    groupKey: 'producer',
    gapOnly: true,
    borrowed: { groupKey: 'era', collapsed: [ALL_FOLDED] },
  };

  it('is settled by a gesture that reshapes the list', () => {
    expect(settleLoan(onLoan).borrowed).toBe(null);
    // And nothing else moves with it: the grouping the gap filter set is the
    // grouping the reader has been reading, so it stays.
    expect(settleLoan(onLoan).groupKey).toBe('producer');
    expect(settleLoan(onLoan).gapOnly).toBe(true);
  });

  it('leaves a screen with no loan on it exactly as it stands', () => {
    const plain: WisdomPrefs = { ...defaultPrefs(marks), groupKey: 'producer', gapOnly: true };
    expect(settleLoan(plain)).toBe(plain);
  });
});

// Three states, and the third used to be indistinguishable from the first.
describe('readGapAccount', () => {
  it('tells an unread account from an empty one from a counted one', () => {
    expect(readGapAccount(true, undefined)).toBe('waiting');
    expect(readGapAccount(true, { total: 0 })).toBe('none');
    expect(readGapAccount(true, { total: 139 })).toBe('settled');
  });

  it('says nothing at all about a gap the base can answer on its own', () => {
    expect(readGapAccount(false, undefined)).toBe(null);
    expect(readGapAccount(undefined, { total: 139 })).toBe(null);
  });
});

describe('the folded shape', () => {
  const every = ['China', 'India', 'Japan', 'Taiwan'];

  it('reads a plain list of folded headings', () => {
    const shape = readFold(['China', 'Japan']);
    expect(shape.all).toBe(false);
    expect(isSectionFolded(shape, 'China')).toBe(true);
    expect(isSectionFolded(shape, 'India')).toBe(false);
  });

  it('reads the sentinel with headings held open against it', () => {
    const shape = readFold([ALL_FOLDED, `${OPEN_MARK}China`]);
    expect(shape.all).toBe(true);
    expect(isSectionFolded(shape, 'China')).toBe(false);
    expect(isSectionFolded(shape, 'India')).toBe(true);
    // A heading that did not exist when the link was made is folded, which is
    // what the sentinel means and why it is worth keeping.
    expect(isSectionFolded(shape, 'Vietnam')).toBe(true);
  });

  // One press must stay one press in the address, in both directions.
  it('opens one heading out of a folded shape without spelling out the rest', () => {
    const opened = toggleFold([ALL_FOLDED], 'China', every);
    expect(opened).toEqual([ALL_FOLDED, `${OPEN_MARK}China`]);
    expect(opened.join('~').length).toBeLessThan(12);
    // And folding it again returns to the bare sentinel.
    expect(toggleFold(opened, 'China', every)).toEqual([ALL_FOLDED]);
  });

  it('normalises rather than drifting to the long form', () => {
    // Every heading excepted is nothing folded at all.
    const allOpen = every.reduce((held, key) => toggleFold(held, key, every), [ALL_FOLDED] as string[]);
    expect(allOpen).toEqual([]);
    // And every heading folded one at a time is the sentinel, not a list of four.
    const allFolded = every.reduce((held, key) => toggleFold(held, key, every), [] as string[]);
    expect(allFolded).toEqual([ALL_FOLDED]);
  });
});

describe('the state of each record', () => {
  // Silence carried two opposite meanings until every holding said which.
  it('either counts a hole or says it counts none', () => {
    for (const holding of WISDOM_HOLDINGS) {
      const stated = Boolean(holding.gap) || Boolean(holding.unmeasured);
      expect(stated, `${holding.id} says nothing about its own record`).toBe(true);
      if (!holding.gap) {
        expect(holding.unmeasured!.trim().endsWith('.'), `${holding.id} unmeasured`).toBe(true);
        expect(holding.unmeasured!.length).toBeGreaterThan(20);
        continue;
      }
      // The clean case is a sentence too, not an absence of one.
      const whole = holding.gap.whole(holding.rows.length);
      expect(whole.trim().endsWith('.'), `${holding.id} whole`).toBe(true);
      expect(whole).toContain(String(holding.rows.length));
    }
  });

  // Only the holding whose answer depends on the account declares it, and it is
  // the only one whose count moves after the screen has been read.
  it('declares the one gap the base cannot answer alone', () => {
    const needy = WISDOM_HOLDINGS.filter(holding => holding.gap?.needsAccount).map(holding => holding.id);
    expect(needy).toEqual(['regions']);
  });
});

describe('the crossing between wisdom and the inventory', () => {
  it('addresses the inventory by the entry, not by a list of product ids', () => {
    const href = wisdomInventoryHref('cultivars', 'rou-gui');
    expect(href).toBe('/admin/inventory?wisdom=cultivars%3Arou-gui');
    // Short whatever the blast radius is: sixty ids would be a kilobyte.
    expect(href.length).toBeLessThan(60);
  });

  // The crossing was built one way only, so a filtered inventory could not say
  // which entry had filtered it, let alone go back to it.
  it('has a return leg that lands on the entry the filter names', () => {
    expect(wisdomEntryHref('cultivars', 'rou-gui')).toBe('/admin/wisdom?tab=cultivars&entry=rou-gui');
    // And the two are inverses over every holding the base actually has.
    for (const holding of WISDOM_HOLDINGS) {
      const row = holding.rows[0];
      const back = new URLSearchParams(wisdomEntryHref(holding.id, holding.idOf(row)).split('?')[1]);
      expect(back.get('tab')).toBe(holding.id);
      expect(back.get('entry')).toBe(holding.idOf(row));
    }
  });

  // And then the return leg landed on the entry and nothing else: the grouping,
  // the sort, the gap filter and the query the operator was reading were all
  // dropped by a crossing that was supposed to be a round trip.
  it('carries the list the operator was reading, both ways', () => {
    const marks = holdingBy('marks');
    const shaped: WisdomPrefs = {
      ...defaultPrefs(marks),
      groupKey: 'producer',
      sort: { key: 'era', direction: 'desc' },
      gapOnly: true,
    };
    const shape = wisdomShapeToken(shaped, marks);
    const out = wisdomInventoryHref('marks', '7572', { shape, query: 'menghai' });

    // The inventory reads the first two fields and carries the rest untouched.
    const carried = new URLSearchParams(out.split('?')[1]).get('wisdom')!;
    const [holdingId, entryId, sent = '', ...rest] = carried.split(':');
    expect([holdingId, entryId]).toEqual(['marks', '7572']);
    expect(sent).toBe(shape);

    const back = new URLSearchParams(
      wisdomEntryHref(holdingId, entryId, { shape: sent, query: rest.join(':') }).split('?')[1],
    );
    expect(back.get('tab')).toBe('marks');
    expect(back.get('entry')).toBe('7572');
    expect(back.get('q')).toBe('menghai');
    // The shape arrives as the shape that left, and is validated on arrival.
    expect(readWisdomShape(back.get('shape'), marks)).toEqual(shaped);
  });

  // The inventory's own reader, against the writer, so the two cannot drift into
  // two different grammars for one param.
  it('reads back what it wrote, all the way to the chip', () => {
    const cultivars = holdingBy('cultivars');
    const row = cultivars.rows.find(entry => entry.id === 'rou-gui') ?? cultivars.rows[0];
    const shaped: WisdomPrefs = { ...defaultPrefs(cultivars), groupKey: 'country' };
    const shape = wisdomShapeToken(shaped, cultivars);
    const param = new URLSearchParams(
      wisdomInventoryHref('cultivars', cultivars.idOf(row), { shape, query: 'wuyi' }).split('?')[1],
    ).get('wisdom');

    const scope = readWisdomScope(param, undefined)!;
    expect(scope).toBeTruthy();
    // The chip says what kind of thing filtered the list, in the holding's word.
    expect(scope.kind).toBe(cultivars.detail(row).kind);
    expect(scope.label).toBe(String(cultivars.columns[0].value(row)));
    // And the way back carries the list, not just the entry.
    const back = new URLSearchParams(scope.href.split('?')[1]);
    expect(back.get('entry')).toBe(cultivars.idOf(row));
    expect(back.get('q')).toBe('wuyi');
    expect(readWisdomShape(back.get('shape'), cultivars)).toEqual(shaped);
    // Nothing is loaded yet, so the grid shows nothing rather than everything.
    expect(scope.ids.size).toBe(0);
  });

  // The chip is a promise made by this screen, not by the one that honours it:
  // a link written before a holding changed its columns named a sort that no
  // longer exists, and the chip offered a return to a list that cannot be built.
  it('checks the shape it carries back rather than passing it through', () => {
    const marks = holdingBy('marks');
    const stale = new URLSearchParams(
      wisdomInventoryHref('marks', '7572', { shape: 'gnonsense~s-nonsense~x', query: 'menghai' }).split('?')[1],
    ).get('wisdom');

    const scope = readWisdomScope(stale, undefined)!;
    const back = new URLSearchParams(scope.href.split('?')[1]);
    // What the holding can honour survives; what it cannot is gone from the
    // link rather than carried and dropped on arrival.
    expect(back.get('shape')).toBe('x');
    expect(back.get('q')).toBe('menghai');
    expect(readWisdomShape(back.get('shape'), marks)).toEqual({ ...defaultPrefs(marks), gapOnly: true });
    // A shape with nothing honourable in it leaves no key behind at all.
    const empty = readWisdomScope('marks:7572:gnonsense', undefined)!;
    expect(new URLSearchParams(empty.href.split('?')[1]).get('shape')).toBe(null);
  });

  // Two links in one row reached the same inventory and only one came back.
  it('sends one product through the same crossing as all of them', () => {
    const href = wisdomInventoryHref('cultivars', 'rou-gui', { shape: 'gcountry' });
    const one = withInventoryPanel(href, 'prod-1');
    const params = new URLSearchParams(one.split('?')[1]);
    // The filter, the entry and the way back all still ride with it.
    expect(params.get('wisdom')).toBe('cultivars:rou-gui:gcountry');
    expect(params.get('panel')).toBe('prod-1');
    // And an id with a character worth escaping stays whole.
    expect(new URLSearchParams(withInventoryPanel(href, 'a b&c').split('?')[1]).get('panel')).toBe('a b&c');
  });

  it('keeps a typed query whole, colons and all', () => {
    const out = wisdomInventoryHref('marks', '7572', { query: 'menghai: 7572' });
    const carried = new URLSearchParams(out.split('?')[1]).get('wisdom')!;
    const [, , , ...rest] = carried.split(':');
    expect(rest.join(':')).toBe('menghai: 7572');
    // The whole query survives when the shape travels with it, which is the
    // shape of every link the panel actually writes.
    const both = new URLSearchParams(
      wisdomInventoryHref('marks', '7572', { shape: 'gproducer', query: 'menghai: 7572' }).split('?')[1],
    ).get('wisdom')!;
    const [, , shape, ...tail] = both.split(':');
    expect(shape).toBe('gproducer');
    expect(tail.join(':')).toBe('menghai: 7572');
  });
});

describe('editDistance', () => {
  it('counts an edit, and gives up rather than counting a stranger exactly', () => {
    expect(editDistance('rougui', 'rougui', 2)).toBe(0);
    expect(editDistance('rougi', 'rougui', 2)).toBe(1);
    expect(editDistance('rougui', 'dahongpao', 2)).toBe(3);
  });
});

// The jump axis reads what the cell prints; the find field reads what was
// recorded. They differ on exactly one kind of row, and that row used to answer
// to neither of them.
describe('wisdomShown', () => {
  it('gives a row with nothing recorded the word its cell prints', () => {
    const marks = holdingBy('marks');
    const applies = marks.columns.find(column => column.key === 'applies')!;
    const bare = marks.rows.find(row => applies.value(row) === null)!;
    expect(bare).toBeDefined();
    expect(applies.fallback).toBe('Any tea');
    // Typing the word on screen now lands on the row showing it.
    expect(wisdomShown(applies, bare)).toBe(applies.fallback);
    expect(wisdomStartsWith(wisdomShown(applies, bare), 'any')).toBe(true);
    // While the find field still cannot match it, which is the point of holding
    // the two apart rather than folding the default into the haystack.
    expect(wisdomMatches(marks.searchText(bare), wisdomQueryTokens('any tea'))).toBe(false);

    // A recorded value is untouched, and a column with no default still says
    // nothing where nothing was recorded.
    const stated = marks.rows.find(row => applies.value(row) !== null)!;
    expect(wisdomShown(applies, stated)).toBe(applies.value(stated));
    const era = marks.columns.find(column => column.key === 'era')!;
    const undated = marks.rows.find(row => era.value(row) === null);
    if (undated) expect(wisdomShown(era, undated)).toBe(null);
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
