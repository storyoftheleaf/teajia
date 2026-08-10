import { RESEARCH_REGIONS } from './generated/regions';
import type { Region, RegionElevation } from './types';

/**
 * Growing places, held once.
 *
 * Two sources merge here: the 83 researched origins (which carry altitude and
 * climate) and the shorter working list the capture card has always used. The
 * working list has no altitude, so it fills gaps rather than overriding.
 */

const WORKING_REGIONS: Array<[string, string]> = [
  ['Ailao Mountain', 'China'], ['Anhui', 'China'], ['Anji', 'China'], ['Anxi', 'China'], ['Bozhou', 'China'],
  ['Chuzhou', 'China'], ['Dehong', 'China'], ['Emei Mountain', 'China'], ['Enshi', 'China'], ['Fuding', 'China'],
  ['Fujian', 'China'], ['Guangdong', 'China'], ['Guangxi', 'China'], ['Guizhou', 'China'], ['Hangzhou', 'China'],
  ['Huangshan', 'China'], ['Hunan', 'China'], ['Huoshan', 'China'], ['Jinggu', 'China'], ['Jingmai', 'China'],
  ['Junshan', 'China'], ['Kunming', 'China'], ['Lincang', 'China'], ["Lu'an", 'China'], ['Lushan', 'China'],
  ['Menghai', 'China'], ['Mengla', 'China'], ['Nanjing', 'China'], ['Phoenix Mountain', 'China'], ['Pingyang', 'China'],
  ["Pu'er", 'China'], ['Qimen', 'China'], ['Sichuan', 'China'], ['Suzhou', 'China'], ['Taiping', 'China'],
  ['Tongxiang', 'China'], ['Wuliang Mountain', 'China'], ['Wuyi', 'China'], ['Xiaguan', 'China'], ['Xinyang', 'China'],
  ["Ya'an", 'China'], ['Yingde', 'China'], ['Yiwu', 'China'], ["Yuan'an", 'China'], ['Yunnan', 'China'],
  ['Zhejiang', 'China'], ['Zhenghe', 'China'],
  ['Alishan', 'Taiwan'], ['Da Yu Ling', 'Taiwan'], ['Hsinchu', 'Taiwan'], ['Li Shan', 'Taiwan'], ['Lugu', 'Taiwan'],
  ['Nantou', 'Taiwan'], ['Dong Ding', 'Taiwan'], ['Sun Moon Lake', 'Taiwan'], ['Taipei', 'Taiwan'],
  ['Taitung', 'Taiwan'], ['Taiwan', 'Taiwan'], ['Wenshan', 'Taiwan'],
  ['Shizuoka', 'Japan'], ['Uji', 'Japan'], ['Wazuka', 'Japan'], ['Yame', 'Japan'],
  ['Boseong', 'South Korea'], ['Hadong', 'South Korea'], ['Jeju', 'South Korea'],
  ['Assam', 'India'], ['Darjeeling', 'India'], ['Doke', 'India'], ['Meghalaya', 'India'], ['Nilgiri', 'India'],
  ['Sikkim', 'India'], ['Nepal', 'Nepal'],
  ['Dimbula', 'Sri Lanka'], ['Kandy', 'Sri Lanka'], ['Nuwara Eliya', 'Sri Lanka'], ['Sri Lanka', 'Sri Lanka'], ['Uva', 'Sri Lanka'],
  ['Bao Loc', 'Vietnam'], ['Vietnam', 'Vietnam'], ['Chiang Rai', 'Thailand'], ['Doi Mae Salong', 'Thailand'],
  ['Java', 'Indonesia'], ['Ethiopia', 'Ethiopia'], ['Georgia', 'Georgia'], ['Kenya', 'Kenya'], ['Rize', 'Turkey'],
];

const slug = (value: string) => value.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const lookupKey = (value: string) => value.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '');

/**
 * Reviewed structure only. Most of the inherited origin corpus is flat, so it
 * stays flat until a parent and level are evidenced instead of being inferred
 * from punctuation or route-shaped labels.
 */
const REVIEWED_REGION_SEMANTICS: Record<string, Partial<Region>> = {
  china: { level: 'country' },
  anhui: { level: 'province', parentId: 'china' },
  'lu-an-city-anhui': { level: 'prefecture', parentId: 'anhui' },
  'jinzhai-county-lu-an': {
    level: 'county',
    parentId: 'lu-an-city-anhui',
    // The old 400-900m value had no tea-garden evidence. The county government
    // supports only the full geographic range, so keep that narrower meaning.
    altitude: undefined,
    climate: undefined,
    elevation: {
      value: '59.5-1729.1m',
      scope: 'place',
      note: 'This is the full county range, not a claimed elevation range for its tea gardens.',
      source: {
        label: 'Jinzhai County People’s Government · Geographic location',
        url: 'https://www.ahjinzhai.gov.cn/zjjz/dlwz/index.html',
      },
    },
  },
};

function buildRegions(): Region[] {
  const byKey = new Map<string, Region>();
  for (const region of RESEARCH_REGIONS) {
    byKey.set(lookupKey(region.name), { ...region, ...REVIEWED_REGION_SEMANTICS[region.id] });
  }
  // The researched origins name a county; the working list names the area a
  // vendor actually writes on an invoice. Keep both as separate entry points.
  for (const [name, country] of WORKING_REGIONS) {
    const entryKey = lookupKey(name);
    if (!byKey.has(entryKey)) {
      const id = slug(name);
      byKey.set(entryKey, { id, name, country, ...REVIEWED_REGION_SEMANTICS[id] });
    }
  }
  return [...byKey.values()].sort((left, right) => left.name.localeCompare(right.name));
}

export const REGIONS: Region[] = buildRegions();

/**
 * Short forms operators actually write, mapped to the canonical entry. Retiring
 * the old working list cost a few of these: a Dan Cong invoice says "Phoenix",
 * not "Phoenix Mountain", and losing that silently stopped resolving a real
 * place.
 */
const REGION_ALIASES: Record<string, string> = {
  phoenix: 'Phoenix Mountain', fenghuang: 'Phoenix Mountain', chaozhou: 'Phoenix Mountain',
  wudong: 'Phoenix Mountain',
  wuyishan: 'Wuyi', wuyimountain: 'Wuyi', wuyimountains: 'Wuyi',
  dongding: 'Dong Ding', tungting: 'Dong Ding',
  lishan: 'Li Shan', dayuling: 'Da Yu Ling',
  yiwushan: 'Yiwu', yiwumountain: 'Yiwu',
  xishuangbanna: 'Menghai', banna: 'Menghai',
  puercity: "Pu'er", simao: "Pu'er",
  emeishan: 'Emei Mountain', huangshanmountain: 'Huangshan',
  jingmaishan: 'Jingmai', jingmaimountain: 'Jingmai',
};

const REGION_INDEX = new Map<string, Region>();
for (const region of REGIONS) {
  REGION_INDEX.set(lookupKey(region.name), region);
  REGION_INDEX.set(region.id, region);
  // "Anji County, Zhejiang" should also answer to "Anji".
  const leading = region.name.split(',')[0]?.trim();
  if (leading && !REGION_INDEX.has(lookupKey(leading))) REGION_INDEX.set(lookupKey(leading), region);
}

/** Resolves a written region to a known place, or null when it is not one we hold. */
export function findRegion(value: string | null | undefined): Region | null {
  if (!value?.trim()) return null;
  const key = lookupKey(value);
  const direct = REGION_INDEX.get(key);
  if (direct) return direct;
  const alias = REGION_ALIASES[key];
  return alias ? REGION_INDEX.get(lookupKey(alias)) ?? null : null;
}

/** The country a region sits in, for records that name only the region. */
export function countryForRegion(value: string | null | undefined): string | null {
  return findRegion(value)?.country ?? null;
}

/** Returns only a held, explicit parent. Labels and missing ids are never guessed. */
export function regionParent(region: Region | null | undefined): Region | null {
  if (!region?.parentId || region.parentId === region.id) return null;
  return REGIONS.find(candidate => candidate.id === region.parentId) ?? null;
}

/** Root-first explicit ancestors. An unresolved first parent produces no invented path. */
export function regionAncestors(region: Region | null | undefined): Region[] {
  if (!region) return [];
  const ancestors: Region[] = [];
  const seen = new Set([region.id]);
  let current = region;
  while (current.parentId && !seen.has(current.parentId)) {
    const parent = regionParent(current);
    if (!parent) break;
    ancestors.unshift(parent);
    seen.add(parent.id);
    current = parent;
  }
  return ancestors;
}

/** Direct children through explicit ids only; legacy province strings remain flat. */
export function regionsWithin(region: Region | null | undefined): Region[] {
  if (!region) return [];
  return REGIONS
    .filter(candidate => candidate.parentId === region.id && regionParent(candidate)?.id === region.id)
    .sort((left, right) => left.name.localeCompare(right.name));
}

export interface RegionElevationPresentation {
  label: 'Tea-growing elevation' | 'Place elevation' | 'County elevation' | 'Recorded elevation';
  value: string;
  note?: string;
  source?: RegionElevation['source'];
}

/** Gives a numerical range its evidenced scope instead of presenting all altitude as tea-growing fact. */
export function regionElevationPresentation(
  region: Region | null | undefined,
): RegionElevationPresentation | null {
  if (!region) return null;
  if (region.elevation) {
    const label = region.elevation.scope === 'tea_growing'
      ? 'Tea-growing elevation'
      : region.level === 'county' ? 'County elevation' : 'Place elevation';
    return {
      label,
      value: region.elevation.value,
      ...(region.elevation.note ? { note: region.elevation.note } : {}),
      ...(region.elevation.source ? { source: region.elevation.source } : {}),
    };
  }
  return region.altitude ? { label: 'Recorded elevation', value: region.altitude } : null;
}

/** Region names offered as suggestions, shortest and most-written first. */
export const REGION_NAMES: string[] = REGIONS.map(region => region.name);
