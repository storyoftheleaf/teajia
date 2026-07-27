import { resolveTea, TEA_FORMS, TEA_TYPES, withExistingValue } from '../../../wisdom';

/**
 * What the import editor can answer from the wisdom base when a vendor record
 * left it blank. Nothing here overwrites what the vendor actually wrote; it only
 * fills gaps, so a paste of "陈年六堡茶" arrives already knowing it is a Dark tea
 * from Guangxi, China, without asking an AI to guess.
 */
export interface ImportIdentityFields {
  english_name: string;
  original_name: string;
  chinese_name: string;
  tea_type: string;
  year: string;
  form: string;
  origin_country: string;
  origin: string;
  cultivar: string;
}

/**
 * Returns only the fills that are safe to apply: never overwrites a value the
 * record already carries, and never guesses beyond what the wisdom base states.
 */
export function enrichImportIdentity(
  draft: ImportIdentityFields,
  category: 'tea' | 'teaware',
): Partial<ImportIdentityFields> {
  if (category !== 'tea') return {};
  const names = [draft.english_name, draft.original_name, draft.chinese_name];
  if (!names.filter(Boolean).join(' ').trim()) return {};

  const blank = (value: string) => !value.trim();
  const resolved = resolveTea({
    names,
    known: {
      type: draft.tea_type, form: draft.form,
      region: draft.origin, country: draft.origin_country, year: draft.year,
    },
  });

  const fills: Partial<ImportIdentityFields> = {};
  if (blank(draft.tea_type) && resolved.type) fills.tea_type = resolved.type;
  if (blank(draft.form) && resolved.form) fills.form = resolved.form;
  if (blank(draft.origin) && resolved.region) fills.origin = resolved.region.name;
  if (blank(draft.origin_country) && resolved.country) fills.origin_country = resolved.country;
  if (blank(draft.year) && resolved.year) fills.year = String(resolved.year);
  if (blank(draft.chinese_name) && resolved.variety?.chineseName) fills.chinese_name = resolved.variety.chineseName;
  if (blank(draft.cultivar) && resolved.cultivar) fills.cultivar = resolved.cultivar.name;

  return fills;
}

export { withExistingValue as vocabularyOptions };
export const IMPORT_TEA_TYPES: readonly string[] = TEA_TYPES;
export const IMPORT_TEA_FORMS: readonly string[] = TEA_FORMS;
