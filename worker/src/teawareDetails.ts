export const TEAWARE_TEXT_FIELDS = {
  clay_type: 'Yixing clay type, such as Zhuni (朱泥), Duanni (段泥), Zini (紫泥), or a documented clay blend. Qualify uncertain attributions.',
  clay_history: 'Sourced context about the clay.',
  form_history: 'Sourced context about the form.',
  age_estimate: 'Estimated age, period or date range.',
  dating_basis: 'Evidence and source supporting the date.',
  maker: 'Maker or workshop, with uncertainty where applicable.',
  mark: 'Visible inscription or mark.',
  acquired_in: 'Purchase location approved for the public page.',
  acquired_from: 'Public attribution to the acquisition source. Never copy private supplier details.',
  acquired_when: 'Acquisition date or period approved for the public page.',
  construction: 'Observed or documented construction, such as fully handmade or half handmade.',
  use_history: 'Known use history, such as previously used or new.',
  condition: 'Observed wear, repairs, chips or other condition notes.',
  recommended_tea_type: 'Legacy single tea suggestion. Use recommended_tea_types for a list.',
  brewing_notes: 'Brewing observations or separately attributed traditions.',
  pour_notes: 'Observed pouring behavior, such as a slight dribble near the end.',
  provenance: 'Additional publicly shareable provenance and research sources.',
} as const;
export const TEAWARE_TEXT_LIMIT = 4000;
export const TEAWARE_TEA_TYPE_LIMIT = 8;
export const TEAWARE_TEA_TYPE_LENGTH = 120;

type TextKey = keyof typeof TEAWARE_TEXT_FIELDS;
export type TeawareDetails = Partial<Record<TextKey, string>> & {
  is_yixing?: boolean;
  recommended_tea_types?: string[];
};
const textKeys = Object.keys(TEAWARE_TEXT_FIELDS) as TextKey[];

/** A valid list may be empty. Undefined indicates invalid input. */
export function parseRecommendedTeaTypes(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.length > TEAWARE_TEA_TYPE_LIMIT) return undefined;

  const names: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== 'string') return undefined;
    const name = entry.trim();
    const key = name.toLowerCase();
    if (!name || name.length > TEAWARE_TEA_TYPE_LENGTH || seen.has(key)) return undefined;
    names.push(name);
    seen.add(key);
  }
  return names;
}

/** Explicit public projection, including for legacy or partially written data. */
export function readTeawareDetails(raw: unknown): TeawareDetails | undefined {
  let input = raw;
  if (typeof input === 'string') {
    try { input = JSON.parse(input); } catch { return undefined; }
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return undefined;

  const values = input as Record<string, unknown>;
  const details: TeawareDetails = {};
  for (const key of textKeys) {
    const value = values[key];
    if (typeof value === 'string' && value.trim()) details[key] = value.trim().slice(0, TEAWARE_TEXT_LIMIT);
  }
  const teaTypes = parseRecommendedTeaTypes(values.recommended_tea_types);
  if (teaTypes) {
    delete details.recommended_tea_type;
    if (teaTypes.length) details.recommended_tea_types = teaTypes;
  }
  if (typeof values.is_yixing === 'boolean') details.is_yixing = values.is_yixing;
  return Object.keys(details).length ? details : undefined;
}

export function attachPublicTeawareDetails(output: Record<string, unknown>, product: Record<string, unknown>) {
  if (product.type !== 'Teaware') return;
  const details = readTeawareDetails(product.teaware_details);
  if (details) output.teaware_details = details;
}
