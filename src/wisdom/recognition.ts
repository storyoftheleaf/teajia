/**
 * The one recognition index. Four places used to each hold a private keyword
 * table mapping free text to a tea attribute: the free-text capture parser,
 * the admin spreadsheet importer, the import editor's form hints, and the
 * worker's translation terms, and all four independently knew that 饼 means
 * cake. This is the shared answer.
 *
 * Two layers, deliberately kept apart:
 *  - derived:  automatic, read straight from the wisdom base's own entries
 *              (316 tea varieties, their Chinese names and alternate
 *              spellings). Add a tea to `src/data/teaVarieties.ts` and the
 *              recogniser learns it for free, with nobody hand-coding a keyword.
 *  - curated:  dense bilingual keyword knowledge that cannot be derived from
 *              any entity, such as dialect words, physical forms, CJK terms.
 *              Carried forward from admin/lib/intakeMapping.ts's former
 *              TEA_TYPE_RULES / FORM_RULES tables (real, hand-built knowledge,
 *              not lost in the consolidation) plus the wisdom index's own
 *              FORM_HINTS CJK terms.
 *
 * Two careful exceptions are preserved on purpose, because a naive keyword
 * index would break both of them:
 *  - Bare puerh spellings ("puerh", "puer", "pu'er"...) are never resolved to
 *    Sheng or Shou. Only a human can say which. `vocabulary.ts` already
 *    excludes them from `normalizeTeaType`; `recognizeAmbiguity` names the
 *    exception explicitly so a caller can act on it.
 *  - "Red" also opens compound tea names: Da Hong Pao ("Big Red Robe"),
 *    aged puerh "Red Label"/"Red Mark" cakes, Taiwan's "Red Jade" black tea
 *    (itself a wisdom-base variety alias). When "Red" is followed by one of
 *    these name words it is masked out before either layer runs, so the
 *    derived layer cannot accidentally resolve "Red Jade" to Red via the
 *    Ruby 18 variety entry.
 */

import { matchTeaVariety } from '../data/teaVarieties';
import { REGION_NAMES } from './regions';
import { normalizeTeaForm, normalizeTeaType, type TeaForm, type TeaType } from './vocabulary';

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* ---------------------------------------------------------------- Ambiguity */

// Bare puerh spellings are deliberately never resolved to Sheng or Shou; only
// a human can say which. See docs/TEA_WISDOM_BASE.md § "The dialect bridge".
const AMBIGUOUS_PUERH_TERMS = ['puerh', 'pu-erh', 'puer', "pu'er", 'pu er'];
const AMBIGUITY_PATTERN = new RegExp(`\\b(${AMBIGUOUS_PUERH_TERMS.map(escapeRegex).join('|')})\\b`, 'i');

/**
 * True when the text names a bare puerh spelling that `recognizeType` will
 * never resolve to Sheng or Shou by itself. A caller can use this to prompt
 * the human for the missing word, rather than guessing.
 */
export function recognizeAmbiguity(text: string): boolean {
  return AMBIGUITY_PATTERN.test(text || '');
}

/* --------------------------------------------------------------------- Type */

// "Red" also opens compound tea names: Da Hong Pao ("Big Red Robe"), aged
// puerh "Red Label"/"Red Mark" cakes, Taiwan's Ruby 18 ("Red Jade") black tea.
// When followed by one of these words it is part of the name, not the type.
export const RED_COMPOUND_SUFFIXES: string[] = ['robe', 'label', 'jade', 'mark', 'peony', 'beauty', 'dragon'];
const RED_COMPOUND_PATTERN = new RegExp(`\\bred\\s+(${RED_COMPOUND_SUFFIXES.join('|')})\\b`, 'gi');

// Curated: dense bilingual phrases that name a type but are not a single
// dialect word `normalizeTeaType` already knows (multi-word English, or CJK,
// which the vocabulary's alias key strips out entirely). Carried verbatim
// from admin/lib/intakeMapping.ts's former TEA_TYPE_RULES: real knowledge,
// not to be lost in the consolidation.
const TYPE_PHRASES: ReadonlyArray<{ type: TeaType; phrases: readonly string[] }> = [
  { type: 'Shou', phrases: ['shou', 'ripe pu', 'cooked pu', 'ripe puer', 'shu pu', '熟普', '熟茶', '熟饼', '熟餅'] },
  { type: 'Sheng', phrases: ['sheng', 'raw pu', 'raw puer', 'raw pu-erh', 'uncooked', '生普', '生茶', '生饼', '生餅'] },
  { type: 'Oolong', phrases: ['oolong', 'wulong', 'wu long', 'tie guan yin', 'tieguanyin', 'tiekuanyin', 'da hong pao', 'dahongpao', 'rou gui', 'rougui', 'shui xian', 'shuixian', 'dan cong', 'dancong', 'dong ding', 'dongding', 'alishan', 'ali shan', 'jin xuan', 'jinxuan', 'gaba', 'milk oolong', 'high mountain', 'gao shan', '乌龙', '烏龍', '岩茶', '铁观音', '鐵觀音', '凤凰', '鳳凰', '单丛', '單欉'] },
  { type: 'Red', phrases: ['black tea', 'red tea', 'hong cha', 'hongcha', 'dian hong', 'dianhong', 'lapsang', 'zheng shan', 'jin jun mei', 'jinjunmei', 'keemun', 'qimen', '红茶', '紅茶', '正山', '金骏眉', '金駿眉'] },
  { type: 'White', phrases: ['white tea', 'bai cha', 'silver needle', 'bai hao', 'baihao', 'bai mu dan', 'baimudan', 'shou mei', 'shoumei', 'gong mei', 'gongmei', '白茶', '白毫', '白牡丹', '寿眉', '壽眉'] },
  { type: 'Green', phrases: ['green tea', 'lu cha', 'long jing', 'longjing', 'dragon well', 'bi luo chun', 'biluochun', 'mao feng', 'maofeng', 'gunpowder', 'gua pian', 'anji', '绿茶', '綠茶', '龙井', '龍井', '碧螺春', '毛峰'] },
  { type: 'Yellow', phrases: ['yellow tea', 'huang cha', 'jun shan', 'junshan', 'huang ya', '黄茶', '黃茶', '君山', '黄芽'] },
  { type: 'Dark', phrases: ['dark tea', 'hei cha', 'heicha', 'liu bao', 'liubao', 'fu zhuan', 'fu brick', 'an hua', 'anhua', 'golden flower', '黑茶', '六堡', '茯砖', '茯磚', '安化'] },
];

/**
 * Resolves free text to a tea type. Three layers, in order:
 *   1. single dialect words `normalizeTeaType` already knows (sheng, shou,
 *      oolong, hongcha, ...);
 *   2. the curated bilingual phrases above (multi-word English, or CJK);
 *   3. a derived fallback onto the 316 tea varieties in the wisdom base, so a
 *      name like "Zhu Ye Qing" resolves to Green without anyone hand-coding
 *      it: add a variety to the base and this layer knows it immediately.
 * "Red <name-word>" compounds are masked out before any layer runs, so
 * neither the phrase list nor the derived layer can resolve them (masking
 * specifically prevents the derived layer from resolving "Red Jade" via the
 * Ruby 18 variety entry, whose alt name is literally "Red Jade").
 */
export function recognizeType(text: string): TeaType | null {
  if (!text?.trim()) return null;
  const masked = text.replace(RED_COMPOUND_PATTERN, ' ');

  for (const token of masked.split(/\s+/).filter(Boolean)) {
    const lower = token.toLowerCase();
    if (AMBIGUOUS_PUERH_TERMS.includes(lower)) continue;
    const type = normalizeTeaType(lower);
    if (type) return type;
  }

  const lowerMasked = masked.toLowerCase();
  for (const { type, phrases } of TYPE_PHRASES) {
    if (phrases.some((phrase) => lowerMasked.includes(phrase))) return type;
  }

  const variety = matchTeaVariety(masked);
  return variety ? (normalizeTeaType(variety.type) ?? variety.type) : null;
}

/* --------------------------------------------------------------------- Form */

// Curated: the same bilingual/CJK knowledge, merged from intakeMapping's
// former FORM_RULES and the wisdom index's own FORM_HINTS, so no phrase either
// one previously knew is lost in the consolidation.
const FORM_PHRASES: ReadonlyArray<{ form: TeaForm; phrases: readonly string[] }> = [
  { form: 'Cake', phrases: ['cake', 'bing', 'disc', 'beeng', '饼', '餅'] },
  { form: 'Tuo', phrases: ['tuo', 'tuocha', 'nest', 'bowl-shaped', '沱'] },
  { form: 'Brick', phrases: ['brick', 'zhuan', '砖', '磚'] },
  { form: 'Ball', phrases: ['dragon ball', 'ball', 'long zhu', 'pearl', '龙珠', '龍珠'] },
  { form: 'Bag', phrases: ['tea bag', 'teabag', 'sachet', '袋泡'] },
  { form: 'Loose', phrases: ['loose leaf', 'loose-leaf', 'maocha', 'mao cha', 'loose', '散茶'] },
];

/**
 * Resolves free text to a tea form. Same two layers as `recognizeType`, minus
 * the derived one: a form is a physical description (cake, brick, loose),
 * not a name, so nothing in the wisdom base's entities can teach it.
 */
export function recognizeForm(text: string): TeaForm | null {
  if (!text?.trim()) return null;

  for (const token of text.split(/\s+/).filter(Boolean)) {
    const form = normalizeTeaForm(token.toLowerCase());
    if (form) return form;
  }

  const lower = text.toLowerCase();
  for (const { form, phrases } of FORM_PHRASES) {
    if (phrases.some((phrase) => lower.includes(phrase))) return form;
  }

  return null;
}

/* ------------------------------------------------------------------- Region */

/**
 * Resolves free text to a known growing region, derived entirely from the
 * wisdom base's 167 region names plus whatever extra names a caller already
 * knows about (e.g. regions already used in an account's own records, such as
 * a vendor's own village that never made it into the researched corpus).
 * Longer names win first, so "Dong Ding" matches before a bare "Ding" would.
 */
export function recognizeRegion(text: string, extraRegionNames: readonly string[] = []): string | null {
  if (!text?.trim()) return null;

  const candidates = [...new Set([...REGION_NAMES, ...extraRegionNames])].sort((left, right) => right.length - left.length);

  // Multi-word regions first, matched as a whole phrase.
  for (const name of candidates) {
    if (!name.includes(' ')) continue;
    if (new RegExp(`\\b${escapeRegex(name)}\\b`, 'i').test(text)) return name;
  }

  // Then single-word regions, matched as a whole token (not a substring).
  const tokens = text.split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    const match = candidates.find((name) => !name.includes(' ') && name.toLowerCase() === token.toLowerCase());
    if (match) return match;
  }

  return null;
}
