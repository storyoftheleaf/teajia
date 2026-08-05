/**
 * The controlled words. Everything that names a tea attribute resolves here.
 *
 * Before this existed the app carried fifteen separate tea-type lists in four
 * dialects (Red vs Black vs Puerh vs Aged/Hei/Yancha), so the same tea read
 * differently on every screen. `normalizeTeaType` is the bridge: it accepts any
 * dialect ever written into a record and returns the one canonical word, which
 * is what makes retiring the other lists safe.
 */

export const TEA_TYPES = ['Green', 'White', 'Yellow', 'Oolong', 'Red', 'Dark', 'Sheng', 'Shou', 'Herbal'] as const;
export type TeaType = typeof TEA_TYPES[number];

// Rolled is a real, distinct form: 23 of Adrian's own teas are ball-rolled
// oolong, which is not the same object as loose leaf. It was the single
// largest gap the coverage audit found.
export const TEA_FORMS = ['Loose', 'Rolled', 'Cake', 'Brick', 'Tuo', 'Ball', 'Bag'] as const;
export type TeaForm = typeof TEA_FORMS[number];

export const SEASONS = ['Spring', 'Summer', 'Fall', 'Winter'] as const;
export type Season = typeof SEASONS[number];

export const STORAGE_STYLES = ['Dry', 'Wet/Traditional', 'HK', 'Malaysian', 'Natural'] as const;
export type StorageStyle = typeof STORAGE_STYLES[number];

/** Categories that are not tea but share the same records. */
export const NON_TEA_TYPES = ['Teaware', 'Misc'] as const;

const key = (value: string) => value.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '');

/**
 * Every spelling any surface has ever written, mapped to the canonical word.
 * Chinese convention: hong cha is Red, not Black. Bare "puerh" is deliberately
 * absent because it cannot be resolved to Sheng or Shou without a human.
 */
const TYPE_ALIASES: Record<string, TeaType> = {
  green: 'Green', matcha: 'Green', sencha: 'Green', gyokuro: 'Green',
  white: 'White', baicha: 'White',
  yellow: 'Yellow', huangcha: 'Yellow',
  oolong: 'Oolong', wulong: 'Oolong', yancha: 'Oolong', rockoolong: 'Oolong', dancong: 'Oolong',
  red: 'Red', black: 'Red', hongcha: 'Red',
  dark: 'Dark', heicha: 'Dark', hei: 'Dark', liubao: 'Dark', darktea: 'Dark',
  sheng: 'Sheng', raw: 'Sheng', shengpu: 'Sheng', shengpuer: 'Sheng', shengpuerh: 'Sheng',
  rawpuer: 'Sheng', rawpuerh: 'Sheng', rawpu: 'Sheng', shengcha: 'Sheng',
  shou: 'Shou', shu: 'Shou', ripe: 'Shou', shoupu: 'Shou', shoupuer: 'Shou', shoupuerh: 'Shou',
  shupu: 'Shou', shupuer: 'Shou', shupuerh: 'Shou', ripepuer: 'Shou', ripepuerh: 'Shou',
  cooked: 'Shou', shoucha: 'Shou',
  herbal: 'Herbal', tisane: 'Herbal', flower: 'Herbal', floral: 'Herbal',
};

const FORM_ALIASES: Record<string, TeaForm> = {
  loose: 'Loose', looseleaf: 'Loose', maocha: 'Loose', leaf: 'Loose',
  rolled: 'Rolled', ballrolled: 'Rolled', ballrolledoolong: 'Rolled', semiball: 'Rolled',
  cake: 'Cake', bing: 'Cake', beeng: 'Cake', disc: 'Cake', bingcha: 'Cake',
  brick: 'Brick', zhuan: 'Brick', zhuancha: 'Brick',
  tuo: 'Tuo', tuocha: 'Tuo', nest: 'Tuo',
  ball: 'Ball', dragonball: 'Ball', longzhu: 'Ball', pearl: 'Ball',
  bag: 'Bag', teabag: 'Bag', sachet: 'Bag',
};

/** Returns the canonical tea type for any known spelling, or null when unresolvable. */
export function normalizeTeaType(value: string | null | undefined): TeaType | null {
  if (!value) return null;
  return TYPE_ALIASES[key(value)] ?? null;
}

export function normalizeTeaForm(value: string | null | undefined): TeaForm | null {
  if (!value) return null;
  return FORM_ALIASES[key(value)] ?? null;
}

export const isTeaType = (value: string): value is TeaType => (TEA_TYPES as readonly string[]).includes(value);
export const isTeaForm = (value: string): value is TeaForm => (TEA_FORMS as readonly string[]).includes(value);

/**
 * Option list for a picker that must not silently drop a value a record already
 * holds. Older records carry spellings that predate this vocabulary.
 */
export function withExistingValue(vocabulary: readonly string[], current: string): string[] {
  const value = current.trim();
  return value && !vocabulary.includes(value) ? [...vocabulary, value] : [...vocabulary];
}
