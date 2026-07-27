import { RESEARCH_REGIONS } from './generated/regions';
import type { Region } from './types';

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

function buildRegions(): Region[] {
  const byKey = new Map<string, Region>();
  for (const region of RESEARCH_REGIONS) byKey.set(lookupKey(region.name), region);
  // The researched origins name a county; the working list names the area a
  // vendor actually writes on an invoice. Keep both as separate entry points.
  for (const [name, country] of WORKING_REGIONS) {
    const entryKey = lookupKey(name);
    if (!byKey.has(entryKey)) byKey.set(entryKey, { id: slug(name), name, country });
  }
  return [...byKey.values()].sort((left, right) => left.name.localeCompare(right.name));
}

export const REGIONS: Region[] = buildRegions();

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
  return REGION_INDEX.get(lookupKey(value)) ?? null;
}

/** The country a region sits in, for records that name only the region. */
export function countryForRegion(value: string | null | undefined): string | null {
  return findRegion(value)?.country ?? null;
}

/** Region names offered as suggestions, shortest and most-written first. */
export const REGION_NAMES: string[] = REGIONS.map(region => region.name);
