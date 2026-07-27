import type React from 'react';
import { TEA_VARIETIES, matchTeaVariety } from '../../../data/teaVarieties';
import {
  CULTIVARS,
  MARKS,
  NAMED_TEAS,
  PRODUCERS,
  REGIONS,
  STYLES,
  findProducerById,
  findRegion,
  markNamesOf,
  marksOf,
  matchCultivar,
  matchMark,
  matchNamedTea,
  matchProducer,
  matchStyle,
} from '../../../wisdom';
import { RESEARCH_REGIONS } from '../../../wisdom/generated/regions';
import type { Cultivar, Mark, NamedTea, Producer, Region, Style } from '../../../wisdom';
import { getThemeTextColor } from '../../themeUtils';
import { CultivarDetailPanel } from './CultivarDetailPanel';
import { WisdomChip, WisdomRoving } from './WisdomDetailPanel';
import {
  WISDOM_SLOT,
  WISDOM_TYPE,
  defineHolding,
  haystack,
  type AnyWisdomHolding,
  type WisdomColumn,
  type WisdomLink,
  type WisdomLinkCtx,
} from './config';

/**
 * The seven holdings of the wisdom base, described once each.
 *
 * Every one of them is the same kind of thing: a named entity with a Chinese
 * name, some facts and some prose. Adding a holding means adding a config here,
 * not writing another browser.
 */

// ── shared cells ──────────────────────────────────────────────────────────────

/**
 * Lays a column into one of the five shared slots, so its width, breakpoint and
 * alignment come from the slot rather than from whoever wrote the holding. See
 * WISDOM_SLOT in config.ts for why the tabs have to agree.
 */
function slot<T>(
  name: keyof typeof WISDOM_SLOT,
  column: Omit<WisdomColumn<T>, 'width' | 'at' | 'align'>,
): WisdomColumn<T> {
  return { ...column, ...WISDOM_SLOT[name] };
}

/**
 * Row name plus its Chinese name. The Latin name is the one that gives way:
 * `min-w-0` lets it shrink so `truncate` can bite, while the hanzi holds its
 * few characters. Without the `min-w-0` a flex item refuses to shrink below its
 * content and the row would push past the column instead of ellipsing.
 */
const nameCell = (name: string, chineseName?: string) => (
  <>
    <span className={`${WISDOM_TYPE.rowName} min-w-0 truncate`}>{name}</span>
    {chineseName && <span className={`${WISDOM_TYPE.fact} shrink-0`}>{chineseName}</span>}
  </>
);

/**
 * Category colour lives in the text itself, tinted and bold. Never a dot, never
 * a swatch: a colour chip beside a word makes the eye do two jobs.
 */
const typeCell = (type?: string | null) =>
  type ? (
    <span className="font-semibold" style={{ color: getThemeTextColor(type) }}>
      {type}
    </span>
  ) : null;

/**
 * A held relation, rendered as somewhere to go. Falls back to the plain text it
 * always was when nothing is listening, which is what the tests and any
 * non-browser reader get.
 */
const linkCell = (label: string | null | undefined, link: WisdomLink, ctx?: WisdomLinkCtx) => {
  if (!label) return null;
  if (!ctx) return label;
  return (
    <button
      type="button"
      onClick={event => {
        event.stopPropagation();
        ctx.jump(link);
      }}
      className="max-w-full truncate text-tea-gold transition-colors hover:text-tea-gold-lt"
    >
      {label}
    </button>
  );
};

/** The same relation as a chip, for a detail panel's fact grid. */
const linkChip = (label: string, link: WisdomLink, ctx?: WisdomLinkCtx) => (
  <WisdomChip key={label} label={label} onClick={ctx ? () => ctx.jump(link) : undefined} />
);

/**
 * A row of chips is one keyboard stop, not six. `WisdomRoving` gives the group
 * the same arrow-key contract the list itself uses, so a panel reached by
 * keyboard can be read by keyboard.
 */
const chipRow = (children: React.ReactNode) => (
  <WisdomRoving className="flex flex-wrap gap-1.5">{children}</WisdomRoving>
);

/**
 * A written place rendered as somewhere to go.
 *
 * A cultivar's origin and a variety's region are free text, not ids, so they go
 * through `findRegion` first: the same call `resolveTea` makes, so a place that
 * resolves at import resolves here too, aliases and all. A place the base does
 * not hold stays the plain text it always was rather than pretending to be a
 * link that leads nowhere.
 */
const regionCell = (written: string | null | undefined, ctx?: WisdomLinkCtx) => {
  if (!written) return null;
  const region = findRegion(written);
  return region ? linkCell(written, { holding: 'regions', entry: region.id }, ctx) : written;
};

const regionChip = (written: string | null | undefined, ctx?: WisdomLinkCtx) => {
  if (!written) return null;
  const region = findRegion(written);
  return chipRow(
    region ? linkChip(written, { holding: 'regions', entry: region.id }, ctx) : <WisdomChip label={written} />,
  );
};

const listOf = (values: readonly string[] | undefined, fallback: string) =>
  values && values.length > 0 ? values.join(', ') : fallback;

/* ── the region relation, both ways ──────────────────────────────────────────
 *
 * A cultivar names a region and a variety names a region, both as free text.
 * Reading that relation backwards is what makes a region worth opening: 115
 * places with an altitude are a table, but "nine plants and four teas come from
 * here" is a reason to read one.
 *
 * Built once and lazily. Once, because the panel would otherwise re-scan 79
 * cultivars and 316 varieties on every open; lazily, because the varieties are
 * flattened further down this file and a top-level scan would read them before
 * they exist.
 */

interface RegionRelation {
  id: string;
  name: string;
}

const indexByRegion = <T,>(
  rows: readonly T[],
  written: (row: T) => string | undefined,
  id: (row: T) => string,
  name: (row: T) => string,
): Map<string, RegionRelation[]> => {
  const map = new Map<string, RegionRelation[]>();
  for (const row of rows) {
    const region = findRegion(written(row));
    if (!region) continue;
    const entry = { id: id(row), name: name(row) };
    const list = map.get(region.id);
    if (list) list.push(entry);
    else map.set(region.id, [entry]);
  }
  for (const list of map.values()) list.sort((left, right) => left.name.localeCompare(right.name));
  return map;
};

let regionRelationCache: { cultivars: Map<string, RegionRelation[]>; varieties: Map<string, RegionRelation[]> } | null = null;

const regionRelations = () =>
  (regionRelationCache ??= {
    cultivars: indexByRegion(CULTIVARS, row => row.originRegion, row => row.id, row => row.name),
    varieties: indexByRegion(ALL_VARIETIES, row => row.region, row => row.id, row => row.name),
  });

/** How many relations a fact grid cell will name before it starts counting. */
const MAX_RELATION_CHIPS = 10;

/**
 * The relation, chipped, with the tail counted rather than listed.
 *
 * The count used to be a dead end: a place naming forty varieties showed ten and
 * said "and 30 more" with no way to reach them. It is now the way there, which
 * is why a link may carry a query as well as an entry: there is no single entry
 * to open, the answer is the holding narrowed to this place.
 */
const relationChips = (
  entries: RegionRelation[] | undefined,
  holdingId: string,
  /** What to search the other holding for, when the tail has to be opened. */
  query: string,
  ctx?: WisdomLinkCtx,
): React.ReactNode => {
  if (!entries || entries.length === 0) return null;
  const shown = entries.slice(0, MAX_RELATION_CHIPS);
  const rest = entries.length - shown.length;
  return chipRow(
    <>
      {shown.map(entry => linkChip(entry.name, { holding: holdingId, entry: entry.id }, ctx))}
      {rest > 0 &&
        (ctx ? (
          <button
            type="button"
            onClick={() => ctx.jump({ holding: holdingId, query })}
            className="tap-target self-center rounded-md px-2 py-1 text-ui-12 text-tea-gold transition-colors hover:text-tea-gold-lt"
          >
            and {rest} more
          </button>
        ) : (
          <span className="self-center text-ui-12 text-tea-text-dim">and {rest} more</span>
        ))}
    </>,
  );
};

const joined = (...parts: Array<string | number | null | undefined>) =>
  parts.filter(Boolean).join(', ') || null;

/** Grouping never leaves a row homeless; an empty answer collects at the end. */
const orUnknown = (value: string | null | undefined) => value?.trim() || '';

/**
 * A row that names a place in words the base cannot resolve to a region.
 *
 * This is the shape of the commonest gap in the base, and it is invisible one
 * row at a time: the place is written, it reads perfectly well, and the only
 * tell is that it did not turn into a link. Counted per holding it becomes a
 * work queue, which is what the gap line above the list is for.
 */
const unheldPlace = (written: string | null | undefined): boolean =>
  Boolean(written?.trim()) && !findRegion(written);

/**
 * The same absence as `unheldPlace`, read from the other end: a region that no
 * cultivar and no variety points at.
 *
 * Half the answer. The other half is the account's own products, which the base
 * cannot see, so the region gap takes those as context and this only reports
 * what the base knows on its own.
 */
const namesNothing = (regionId: string): boolean => {
  const relations = regionRelations();
  return !relations.cultivars.get(regionId) && !relations.varieties.get(regionId);
};

// ── cultivars ─────────────────────────────────────────────────────────────────

const cultivars = defineHolding<Cultivar>({
  id: 'cultivars',
  label: 'Cultivars',
  noun: 'cultivars',
  rows: CULTIVARS,
  idOf: row => row.id,
  placeholder: 'Search cultivars by name, Chinese name, or alias',
  searchText: row => haystack(row.name, row.chineseName, ...row.altNames, row.originRegion, row.originCountry),
  matchEntity: query => matchCultivar(query),
  reach: 'Read by the lineage block on every shop product page, by the import editor when it identifies a tea, and by the public reference at /wisdom/cultivars.',
  publicRef: { index: '/wisdom/cultivars', entry: row => `/wisdom/cultivar/${row.id}` },
  columns: [
    {
      key: 'name',
      label: 'Cultivar',
      width: '',
      value: row => row.name,
      render: row => nameCell(row.name, row.chineseName),
    },
    slot('kind', { key: 'country', label: 'Country', value: row => row.originCountry ?? null }),
    slot('place', {
      key: 'region',
      label: 'Region',
      value: row => row.originRegion ?? null,
      render: (row, ctx) => regionCell(row.originRegion, ctx),
    }),
    slot('when', { key: 'developed', label: 'Year', value: row => row.developedYear ?? null }),
  ],
  // 79 cultivars over three countries: a grouping that turns a scroll into a
  // shape. Decade was tried and dropped, because 18 headings over 79 rows is not
  // a grouping, it is a second scroll.
  groups: [{ key: 'country', label: 'Country', of: row => orUnknown(row.originCountry) }],
  gap: {
    test: row => unheldPlace(row.originRegion),
    sentence: (missing, total) =>
      `${missing} of the ${total} cultivars name an origin the base does not hold as a region, so their place cannot be opened or read back.`,
  },
  detail: (row, ctx) => ({
    kind: 'Cultivar',
    name: row.name,
    chineseName: row.chineseName,
    altNames: row.altNames,
    facts: [
      { label: 'Region', value: regionChip(row.originRegion, ctx) },
      { label: 'Country', value: row.originCountry },
      { label: 'Developed', value: row.developedYear },
      { label: 'Parentage', value: row.parentage },
    ],
  }),
  renderDetail: (row, ctx) => (
    <CultivarDetailPanel
      cultivar={row}
      onClose={ctx.onClose}
      onSelectCultivar={ctx.onSelect}
      jump={ctx.jump}
      nav={ctx.nav}
      section={ctx.section}
      publicHref={ctx.publicHref}
      usage={ctx.usage}
    />
  ),
});

// ── regions ───────────────────────────────────────────────────────────────────

/**
 * Which regions came from the researched corpus.
 *
 * The holding merges two sources of unequal depth: 98 researched origins that
 * carry province, altitude and climate, and a shorter working list of the names
 * an operator actually writes on an invoice, which carries a country and nothing
 * else. Both belong in the base. But a reader who opens Yiwu and finds a panel
 * with one fact in it concludes the screen is broken, so each entry says which
 * kind it is rather than leaving the reader to guess.
 */
const RESEARCHED_REGION_IDS = new Set(RESEARCH_REGIONS.map(region => region.id));
const isResearched = (row: Region) => RESEARCHED_REGION_IDS.has(row.id);

const REGION_NOTE = {
  researched:
    'A researched origin. Province, altitude and climate are recorded here when the source stated them.',
  working:
    'A working entry: the name operators write on an invoice, held so records resolve to a real place. Altitude and climate were never recorded for it, so this panel is short by design.',
} as const;

const regions = defineHolding<Region>({
  id: 'regions',
  label: 'Regions',
  noun: 'regions',
  rows: REGIONS,
  idOf: row => row.id,
  placeholder: 'Search regions by name, country, or province',
  searchText: row => haystack(row.name, row.country, row.province, row.climate),
  matchEntity: query => findRegion(query),
  reach: 'Offers the region suggestions on the capture card and the import editor, answers the country a record leaves blank everywhere resolveTea runs, and backs the public reference at /wisdom/regions.',
  publicRef: { index: '/wisdom/regions', entry: row => `/wisdom/region/${row.id}` },
  columns: [
    {
      key: 'name',
      label: 'Region',
      width: '',
      value: row => row.name,
      render: row => nameCell(row.name),
    },
    slot('kind', { key: 'country', label: 'Country', value: row => row.country }),
    slot('place', { key: 'province', label: 'Province', value: row => row.province ?? null }),
    slot('when', { key: 'altitude', label: 'Altitude', value: row => row.altitude ?? null }),
  ],
  groups: [
    { key: 'country', label: 'Country', of: row => orUnknown(row.country) },
    { key: 'entry', label: 'Entry', of: row => (isResearched(row) ? 'Researched origin' : 'Working entry') },
  ],
  /**
   * The gap every other holding had and this one did not.
   *
   * Regions was the only holding counting no hole of its own, which read as a
   * complete record and is not: a place that no plant, no variety and no product
   * names is held and never read, exactly as much a hole as a cultivar naming an
   * origin the base cannot resolve. It is the same shape of absence, pointed the
   * other way, and until now it was counted nowhere.
   *
   * The products are the half the base cannot answer alone, so they arrive as
   * context. Before they load the count is what the base knows on its own, which
   * can only ever be an over-count, and it narrows rather than jumping.
   */
  gap: {
    test: (row, ctx) => namesNothing(row.id) && (ctx?.used(row.id) ?? 0) === 0,
    sentence: (missing, total) =>
      `${missing} of the ${total} regions are named by no cultivar, no variety and no product in this account, so they are held and never read.`,
  },
  detail: (row, ctx) => ({
    kind: 'Region',
    name: row.name,
    note: isResearched(row) ? REGION_NOTE.researched : REGION_NOTE.working,
    facts: [
      { label: 'Country', value: row.country },
      { label: 'Province', value: row.province },
      { label: 'Altitude', value: row.altitude },
      { label: 'Entry', value: isResearched(row) ? 'Researched' : 'Working' },
      // The relation read backwards. What grows here is the reason a place is
      // worth opening, and it is the return leg of the link a cultivar and a
      // variety now carry into this holding.
      { label: 'Cultivars', value: relationChips(regionRelations().cultivars.get(row.id), 'cultivars', row.name, ctx) },
      { label: 'Varieties', value: relationChips(regionRelations().varieties.get(row.id), 'varieties', row.name, ctx) },
    ],
    prose: row.climate,
  }),
});

// ── varieties ─────────────────────────────────────────────────────────────────

interface FlatVariety {
  id: string;
  type: string;
  name: string;
  chineseName?: string;
  altNames?: string[];
  region?: string;
}

const slugify = (value: string) =>
  value.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Flattens the type-keyed variety record into rows, with ids computed the same
 * way scripts/export-wisdom-dataset.mjs does (type-slug + name-slug, numbered on
 * collision). Keeping the same formula means an authorship entry added for a
 * variety id later resolves here without any change.
 */
function flattenVarieties(): FlatVariety[] {
  const seen = new Map<string, number>();
  const out: FlatVariety[] = [];
  for (const [type, entries] of Object.entries(TEA_VARIETIES)) {
    for (const entry of entries) {
      const base = `${slugify(type)}-${slugify(entry.name)}`;
      const count = seen.get(base) ?? 0;
      seen.set(base, count + 1);
      const id = count === 0 ? base : `${base}-${count + 1}`;
      out.push({ id, type, name: entry.name, chineseName: entry.chineseName, altNames: entry.altNames, region: entry.region });
    }
  }
  return out;
}

export const ALL_VARIETIES = flattenVarieties();

/**
 * What a variety entry actually is, said in the panel rather than left for the
 * reader to infer from two facts.
 *
 * Regions got this treatment first, for the same reason: a panel that comes up
 * nearly empty reads as a screen that failed to load. A variety is genuinely
 * this small. It is a recognition key, and the names in the header ARE the
 * record, because those are the strings the importer matches on.
 */
const VARIETY_NOTE =
  'A recognition key, not an article. What the base holds for a variety is exactly what is above: the names the import editor matches on, and the type and place they resolve to. Nothing further was ever recorded for one, so this panel is short by design. The prose lives on the cultivar and the region it points at.';

const varieties = defineHolding<FlatVariety>({
  id: 'varieties',
  label: 'Varieties',
  noun: 'varieties',
  rows: ALL_VARIETIES,
  idOf: row => row.id,
  placeholder: 'Search varieties by name, Chinese name, type, or region',
  searchText: row => haystack(row.name, row.chineseName, ...(row.altNames ?? []), row.region, row.type),
  // The alias index the importer itself uses, so a query the import editor would
  // recognise is pinned here too rather than landing wherever a substring hits.
  matchEntity: query => {
    const match = matchTeaVariety(query);
    if (!match) return null;
    return ALL_VARIETIES.find(row => row.type === match.type && row.name === match.name) ?? null;
  },
  reach: 'The largest holding, and the one that teaches type recognition: a variety added here is recognised by the import editor, the capture card and the worker without anyone writing a keyword. It is the one holding with no public page of its own, because a variety reaches a reader through the cultivar and the region it resolves to.',
  columns: [
    {
      key: 'name',
      label: 'Variety',
      width: '',
      value: row => row.name,
      render: row => nameCell(row.name, row.chineseName),
    },
    slot('kind', { key: 'type', label: 'Type', value: row => row.type, render: row => typeCell(row.type) }),
    slot('place', {
      key: 'region',
      label: 'Region',
      value: row => row.region ?? null,
      render: (row, ctx) => regionCell(row.region, ctx),
    }),
  ],
  // Type is the one that earns it: nine headings over 316 rows. Region was tried
  // and dropped at 85 headings, which is not a grouping.
  groups: [{ key: 'type', label: 'Type', of: row => orUnknown(row.type) }],
  gap: {
    test: row => unheldPlace(row.region),
    sentence: (missing, total) =>
      `${missing} of the ${total} varieties name a place the base does not hold as a region, so the type resolves at import and the place does not.`,
  },
  detail: (row, ctx) => ({
    kind: 'Variety',
    name: row.name,
    chineseName: row.chineseName,
    altNames: row.altNames,
    note: VARIETY_NOTE,
    facts: [
      { label: 'Type', value: typeCell(row.type) },
      { label: 'Region', value: regionChip(row.region, ctx) },
      // Derived, not stored: the country falls out of the region the same way it
      // does for a record that names only a region.
      { label: 'Country', value: findRegion(row.region)?.country ?? null },
    ],
  }),
});

// ── producers ─────────────────────────────────────────────────────────────────

const KIND_LABEL: Record<Producer['kind'], string> = {
  factory: 'Factory',
  house: 'House',
  brand: 'Brand',
  cooperative: 'Cooperative',
  unknown: 'Unknown',
};

const producers = defineHolding<Producer>({
  id: 'producers',
  label: 'Producers',
  noun: 'producers',
  rows: PRODUCERS,
  idOf: row => row.id,
  placeholder: 'Search producers by name, Chinese name, or mark',
  searchText: row => haystack(row.name, row.chineseName, ...row.altNames, row.region, row.country, ...row.notableMarks),
  matchEntity: query => matchProducer(query),
  reach: 'Answers who made a tea wherever one is identified, at import and in the shop, and backs the public reference at /wisdom/producers.',
  publicRef: { index: '/wisdom/producers', entry: row => `/wisdom/producer/${row.id}` },
  columns: [
    {
      key: 'name',
      label: 'Producer',
      width: '',
      value: row => row.name,
      render: row => nameCell(row.name, row.chineseName),
    },
    slot('kind', { key: 'kind', label: 'Kind', value: row => KIND_LABEL[row.kind] }),
    slot('place', { key: 'region', label: 'Region', value: row => joined(row.region, row.country) }),
    slot('when', { key: 'founded', label: 'Founded', value: row => row.founded ?? null }),
  ],
  groups: [{ key: 'kind', label: 'Kind', of: row => KIND_LABEL[row.kind] }],
  detail: (row, ctx) => {
    const held = marksOf(row);
    const heldIds = new Set(held.map(mark => mark.name));
    const namedOnly = markNamesOf(row).filter(name => !heldIds.has(name));
    return {
      kind: 'Producer',
      name: row.name,
      chineseName: row.chineseName,
      altNames: row.altNames,
      facts: [
        { label: 'Kind', value: KIND_LABEL[row.kind] },
        { label: 'Region', value: row.region },
        { label: 'Country', value: row.country },
        { label: 'Founded', value: row.founded },
        {
          // Marks we actually hold are somewhere to go. Marks the producer's own
          // record merely names stay plain, because there is nothing behind them.
          label: 'Known for',
          value:
            held.length > 0 || namedOnly.length > 0
              ? chipRow(
                  <>
                    {held.map(mark => linkChip(mark.name, { holding: 'marks', entry: mark.id }, ctx))}
                    {namedOnly.map(name => (
                      <span key={name} className="rounded-md bg-tea-surface px-2 py-1 text-ui-12 text-tea-text-sec">
                        {name}
                      </span>
                    ))}
                  </>,
                )
              : null,
        },
      ],
      prose: row.description,
    };
  },
});

// ── marks ─────────────────────────────────────────────────────────────────────

const marks = defineHolding<Mark>({
  id: 'marks',
  label: 'Marks',
  noun: 'marks',
  rows: MARKS,
  idOf: row => row.id,
  placeholder: 'Search marks by number, name, or producer',
  searchText: row =>
    haystack(row.name, row.chineseName, ...row.altNames, row.era, findProducerById(row.producerId)?.name),
  matchEntity: query => matchMark(query),
  reach: 'Turns a recipe number on a wrapper into a producer and an era at import, and backs the public reference at /wisdom/marks.',
  publicRef: { index: '/wisdom/marks', entry: row => `/wisdom/mark/${row.id}` },
  columns: [
    {
      key: 'name',
      label: 'Mark',
      width: '',
      value: row => row.name,
      render: row => nameCell(row.name, row.chineseName),
    },
    slot('kind', { key: 'era', label: 'Era', value: row => row.era ?? null }),
    slot('place', {
      key: 'producer',
      label: 'Producer',
      value: row => findProducerById(row.producerId)?.name ?? null,
      render: (row, ctx) => {
        const producer = findProducerById(row.producerId);
        return producer ? linkCell(producer.name, { holding: 'producers', entry: producer.id }, ctx) : null;
      },
    }),
    slot('detail', {
      key: 'applies',
      label: 'Applies to',
      sortable: false,
      value: row => listOf(row.appliesToTypes, 'Any'),
    }),
  ],
  groups: [
    { key: 'producer', label: 'Producer', of: row => orUnknown(findProducerById(row.producerId)?.name) },
    { key: 'era', label: 'Era', of: row => orUnknown(row.era) },
  ],
  gap: {
    test: row => !findProducerById(row.producerId),
    sentence: (missing, total) =>
      `${missing} of the ${total} marks name no producer the base holds, so a wrapper carrying one resolves to a recipe and stops there.`,
    // Grouping by producer piles these exact rows under one heading, which is
    // the same fact the count states. The toggle sets it, so the two agree.
    revealBy: 'producer',
  },
  detail: (row, ctx) => {
    const producer = findProducerById(row.producerId);
    return {
      kind: 'Mark',
      name: row.name,
      chineseName: row.chineseName,
      altNames: row.altNames,
      facts: [
        {
          label: 'Producer',
          value: producer
            ? chipRow(linkChip(producer.name, { holding: 'producers', entry: producer.id }, ctx))
            : null,
        },
        { label: 'Era', value: row.era },
        { label: 'Applies to', value: listOf(row.appliesToTypes, 'Any tea') },
      ],
      prose: row.description,
    };
  },
});

// ── styles ────────────────────────────────────────────────────────────────────

const styles = defineHolding<Style>({
  id: 'styles',
  label: 'Styles',
  noun: 'styles',
  rows: STYLES,
  idOf: row => row.id,
  placeholder: 'Search styles by name, Chinese name, or region',
  searchText: row => haystack(row.name, row.chineseName, ...row.altNames, row.region, ...row.appliesToTypes),
  matchEntity: query => matchStyle(query),
  reach: 'Names how a tea was made or pressed when that is not simply its form, wherever a tea is identified, and backs /wisdom/styles.',
  publicRef: { index: '/wisdom/styles', entry: row => `/wisdom/style/${row.id}` },
  columns: [
    {
      key: 'name',
      label: 'Style',
      width: '',
      value: row => row.name,
      render: row => nameCell(row.name, row.chineseName),
    },
    // Visible at 390px: for a style, what it applies to is the whole point, so
    // it takes the one slot a phone has room for beside the name.
    slot('kind', {
      key: 'applies',
      label: 'Applies to',
      sortable: false,
      value: row => listOf(row.appliesToTypes, 'Any'),
    }),
    slot('place', { key: 'region', label: 'Region', value: row => row.region ?? null }),
  ],
  groups: [{ key: 'applies', label: 'Applies to', of: row => listOf(row.appliesToTypes, 'Any tea') }],
  gap: {
    test: row => unheldPlace(row.region),
    sentence: (missing, total) =>
      `${missing} of the ${total} styles name a place the base does not hold as a region, so the style resolves at import and the place does not.`,
  },
  detail: row => ({
    kind: 'Style',
    name: row.name,
    chineseName: row.chineseName,
    altNames: row.altNames,
    facts: [
      { label: 'Applies to', value: listOf(row.appliesToTypes, 'Any tea') },
      { label: 'Region', value: row.region },
    ],
    prose: row.description,
  }),
});

// ── named teas ────────────────────────────────────────────────────────────────

const PROVENANCE_LABEL: Record<NamedTea['provenance'], string> = {
  undisclosed: 'Undisclosed',
  partial: 'Partial',
  stated: 'Stated',
};

const namedTeas = defineHolding<NamedTea>({
  id: 'named-teas',
  label: 'Named teas',
  noun: 'named teas',
  rows: NAMED_TEAS,
  idOf: row => row.id,
  placeholder: 'Search named teas by name, Chinese name, or collection',
  searchText: row =>
    haystack(row.name, row.chineseName, ...row.altNames, row.type, row.region, row.collection, row.vendor, row.tradition),
  matchEntity: query => matchNamedTea(query),
  reach: 'Lets a tea that arrived already named resolve at import instead of falling through, and backs the public reference at /wisdom/named.',
  publicRef: { index: '/wisdom/named', entry: row => `/wisdom/named/${row.id}` },
  columns: [
    {
      key: 'name',
      label: 'Named tea',
      width: '',
      value: row => row.name,
      render: row => nameCell(row.name, row.chineseName),
    },
    slot('kind', { key: 'type', label: 'Type', value: row => row.type ?? null, render: row => typeCell(row.type) }),
    slot('place', { key: 'region', label: 'Region', value: row => joined(row.region, row.country) }),
    slot('detail', {
      key: 'provenance',
      label: 'Provenance',
      value: row => PROVENANCE_LABEL[row.provenance],
    }),
  ],
  groups: [
    { key: 'provenance', label: 'Provenance', of: row => PROVENANCE_LABEL[row.provenance] },
    { key: 'type', label: 'Type', of: row => orUnknown(row.type) },
  ],
  detail: row => ({
    kind: 'Named tea',
    name: row.name,
    chineseName: row.chineseName,
    altNames: row.altNames,
    facts: [
      { label: 'Type', value: typeCell(row.type) },
      { label: 'Form', value: row.form },
      { label: 'Region', value: joined(row.region, row.country) },
      { label: 'Provenance', value: PROVENANCE_LABEL[row.provenance] },
      { label: 'Tradition', value: row.tradition },
      { label: 'Collection', value: row.collection },
      { label: 'Obtained from', value: row.vendor },
    ],
    prose: row.description,
  }),
});

/** Tab order: the three original holdings, then the four the base gained. */
export const WISDOM_HOLDINGS: AnyWisdomHolding[] = [
  cultivars,
  regions,
  varieties,
  producers,
  marks,
  styles,
  namedTeas,
];

export const findHolding = (id: string | null | undefined): AnyWisdomHolding | undefined =>
  WISDOM_HOLDINGS.find(holding => holding.id === id);
