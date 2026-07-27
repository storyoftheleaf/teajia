import { normalizeTeaType, type TeaType } from '../wisdom';

// Colour by canonical tea type. Record<TeaType, string> means a missing or
// extra type key is a compile error. Values are looked up through
// normalizeTeaType so a legacy stored spelling (e.g. "Black") still resolves.
const THEME_COLORS: Record<TeaType, string> = {
  Green: '#859F85',
  Yellow: '#D4C586',
  White: '#D6D3CD',
  Oolong: '#C4A484',
  Red: '#A67B70',
  Dark: '#8B8C89',
  Shou: '#5C544E',
  Sheng: '#98A67B',
  Herbal: '#BFA09E',
};

export const getThemeColor = (type: string) => {
  const normalized = normalizeTeaType(type);
  return normalized ? THEME_COLORS[normalized] : '#737373';
};

// Text-legible variant of the type colour. The dot palette above is tuned for a
// small filled swatch; the darkest types (Shou, Dark, default) are too dim to
// read as 13px text on the dark inventory surface, so lift those to a lighter
// tint that keeps the hue but clears the contrast floor.
const THEME_TEXT_OVERRIDES: Partial<Record<TeaType, string>> = {
  Shou: '#9B8F84',
  Dark: '#A7A8A4',
  Red: '#BE9189',
};

export const getThemeTextColor = (type: string) => {
  const normalized = normalizeTeaType(type);
  if (normalized && THEME_TEXT_OVERRIDES[normalized]) return THEME_TEXT_OVERRIDES[normalized]!;
  return getThemeColor(type);
};
