import { TEA_VARIETIES } from '../../../data/teaVarieties';
import {
  CULTIVARS,
  MARKS,
  NAMED_TEAS,
  PRODUCERS,
  REGIONS,
  STYLES,
  findProducerById,
  markNamesOf,
} from '../../../wisdom';
import type { Cultivar, Mark, NamedTea, Producer, Region, Style } from '../../../wisdom';
import { getThemeTextColor } from '../../themeUtils';
import { CultivarDetailPanel } from './CultivarDetailPanel';
import { WISDOM_TYPE, defineHolding, haystack, type AnyWisdomHolding } from './config';

/**
 * The seven holdings of the wisdom base, described once each.
 *
 * Every one of them is the same kind of thing: a named entity with a Chinese
 * name, some facts and some prose. Adding a holding means adding a config here,
 * not writing another browser.
 */

// ── shared cells ──────────────────────────────────────────────────────────────

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

const listOf = (values: readonly string[] | undefined, fallback: string) =>
  values && values.length > 0 ? values.join(', ') : fallback;

const joined = (...parts: Array<string | number | null | undefined>) =>
  parts.filter(Boolean).join(', ') || null;

// ── cultivars ─────────────────────────────────────────────────────────────────

const cultivars = defineHolding<Cultivar>({
  id: 'cultivars',
  label: 'Cultivars',
  noun: 'cultivars',
  rows: CULTIVARS,
  idOf: row => row.id,
  placeholder: 'Search cultivars by name, Chinese name, or alias',
  searchText: row => haystack(row.name, row.chineseName, ...row.altNames, row.originRegion, row.originCountry),
  columns: [
    {
      key: 'name',
      label: 'Cultivar',
      width: '',
      value: row => row.name,
      render: row => nameCell(row.name, row.chineseName),
    },
    {
      key: 'origin',
      label: 'Origin',
      width: 'w-[30%]',
      at: 'sm',
      value: row => joined(row.originRegion, row.originCountry),
    },
    {
      key: 'developed',
      label: 'Year',
      width: 'w-[10%]',
      at: 'md',
      align: 'right',
      value: row => row.developedYear ?? null,
    },
  ],
  detail: row => ({
    kind: 'Cultivar',
    name: row.name,
    chineseName: row.chineseName,
    altNames: row.altNames,
    facts: [
      { label: 'Origin', value: joined(row.originRegion, row.originCountry) },
      { label: 'Developed', value: row.developedYear },
      { label: 'Parentage', value: row.parentage },
    ],
  }),
  renderDetail: (row, ctx) => (
    <CultivarDetailPanel cultivar={row} onClose={ctx.onClose} onSelectCultivar={ctx.onSelect} />
  ),
});

// ── regions ───────────────────────────────────────────────────────────────────

const regions = defineHolding<Region>({
  id: 'regions',
  label: 'Regions',
  noun: 'regions',
  rows: REGIONS,
  idOf: row => row.id,
  placeholder: 'Search regions by name, country, or province',
  searchText: row => haystack(row.name, row.country, row.province, row.climate),
  columns: [
    {
      key: 'name',
      label: 'Region',
      width: '',
      value: row => row.name,
      render: row => nameCell(row.name),
    },
    { key: 'country', label: 'Country', width: 'w-[26%]', value: row => row.country },
    { key: 'province', label: 'Province', width: 'w-[22%]', at: 'md', value: row => row.province ?? null },
    { key: 'altitude', label: 'Altitude', width: 'w-[16%]', at: 'sm', align: 'right', value: row => row.altitude ?? null },
  ],
  detail: row => ({
    kind: 'Region',
    name: row.name,
    facts: [
      { label: 'Country', value: row.country },
      { label: 'Province', value: row.province },
      { label: 'Altitude', value: row.altitude },
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

const slug = (value: string) =>
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
      const base = `${slug(type)}-${slug(entry.name)}`;
      const count = seen.get(base) ?? 0;
      seen.set(base, count + 1);
      const id = count === 0 ? base : `${base}-${count + 1}`;
      out.push({ id, type, name: entry.name, chineseName: entry.chineseName, altNames: entry.altNames, region: entry.region });
    }
  }
  return out;
}

export const ALL_VARIETIES = flattenVarieties();

const varieties = defineHolding<FlatVariety>({
  id: 'varieties',
  label: 'Varieties',
  noun: 'varieties',
  rows: ALL_VARIETIES,
  idOf: row => row.id,
  placeholder: 'Search varieties by name, Chinese name, type, or region',
  searchText: row => haystack(row.name, row.chineseName, ...(row.altNames ?? []), row.region, row.type),
  columns: [
    {
      key: 'name',
      label: 'Variety',
      width: '',
      value: row => row.name,
      render: row => nameCell(row.name, row.chineseName),
    },
    { key: 'type', label: 'Type', width: 'w-[20%]', value: row => row.type, render: row => typeCell(row.type) },
    { key: 'region', label: 'Region', width: 'w-[26%]', at: 'sm', value: row => row.region ?? null },
  ],
  detail: row => ({
    kind: 'Variety',
    name: row.name,
    chineseName: row.chineseName,
    altNames: row.altNames,
    facts: [
      { label: 'Type', value: typeCell(row.type) },
      { label: 'Region', value: row.region },
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
  columns: [
    {
      key: 'name',
      label: 'Producer',
      width: '',
      value: row => row.name,
      render: row => nameCell(row.name, row.chineseName),
    },
    { key: 'kind', label: 'Kind', width: 'w-[18%]', value: row => KIND_LABEL[row.kind] },
    { key: 'region', label: 'Region', width: 'w-[24%]', at: 'sm', value: row => joined(row.region, row.country) },
    { key: 'founded', label: 'Founded', width: 'w-[12%]', at: 'md', align: 'right', value: row => row.founded ?? null },
  ],
  detail: row => ({
    kind: 'Producer',
    name: row.name,
    chineseName: row.chineseName,
    altNames: row.altNames,
    facts: [
      { label: 'Kind', value: KIND_LABEL[row.kind] },
      { label: 'Region', value: row.region },
      { label: 'Country', value: row.country },
      { label: 'Founded', value: row.founded },
      { label: 'Known for', value: listOf(markNamesOf(row), '') },
    ],
    prose: row.description,
  }),
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
  columns: [
    {
      key: 'name',
      label: 'Mark',
      width: '',
      value: row => row.name,
      render: row => nameCell(row.name, row.chineseName),
    },
    {
      key: 'producer',
      label: 'Producer',
      width: 'w-[28%]',
      at: 'sm',
      value: row => findProducerById(row.producerId)?.name ?? null,
    },
    { key: 'era', label: 'Era', width: 'w-[14%]', value: row => row.era ?? null },
    {
      key: 'applies',
      label: 'Applies to',
      width: 'w-[16%]',
      at: 'md',
      sortable: false,
      value: row => listOf(row.appliesToTypes, 'Any'),
    },
  ],
  detail: row => ({
    kind: 'Mark',
    name: row.name,
    chineseName: row.chineseName,
    altNames: row.altNames,
    facts: [
      { label: 'Producer', value: findProducerById(row.producerId)?.name },
      { label: 'Era', value: row.era },
      { label: 'Applies to', value: listOf(row.appliesToTypes, 'Any tea') },
    ],
    prose: row.description,
  }),
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
  columns: [
    {
      key: 'name',
      label: 'Style',
      width: '',
      value: row => row.name,
      render: row => nameCell(row.name, row.chineseName),
    },
    {
      // Visible at 390px: for a style, what it applies to is the whole point,
      // so it earns the one column a phone has room for beside the name.
      key: 'applies',
      label: 'Applies to',
      width: 'w-[26%]',
      sortable: false,
      value: row => listOf(row.appliesToTypes, 'Any'),
    },
    { key: 'region', label: 'Region', width: 'w-[30%]', at: 'sm', value: row => row.region ?? null },
  ],
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
  columns: [
    {
      key: 'name',
      label: 'Named tea',
      width: '',
      value: row => row.name,
      render: row => nameCell(row.name, row.chineseName),
    },
    { key: 'type', label: 'Type', width: 'w-[16%]', value: row => row.type ?? null, render: row => typeCell(row.type) },
    { key: 'region', label: 'Region', width: 'w-[22%]', at: 'sm', value: row => joined(row.region, row.country) },
    {
      key: 'provenance',
      label: 'Provenance',
      width: 'w-[20%]',
      at: 'md',
      value: row => PROVENANCE_LABEL[row.provenance],
    },
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
