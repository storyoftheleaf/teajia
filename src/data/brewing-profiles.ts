/**
 * Brewing profiles for each tea type stocked in the Teajia collection.
 * Gongfu cha parameters unless otherwise noted.
 * All temperatures in Celsius.
 */
import { normalizeTeaType, type TeaType } from '../wisdom';

export type BrewingProfile = {
  type: TeaType;
  waterTemp: string;     // e.g. "85–90°C"
  steepTime: string;     // e.g. "45–60s (gongfu)"
  leafRatio: string;     // e.g. "5g per 100ml"
  vessel: string;        // e.g. "Gaiwan or small clay teapot"
  infusions: string;     // e.g. "6–10 infusions"
  notes?: string;
};

// Typed against the wisdom base's TeaType so a missing or extra key is a
// compile error.
export const BREWING_PROFILES: Record<TeaType, BrewingProfile> = {
  Green: {
    type: 'Green',
    waterTemp: '75–80°C',
    steepTime: '30–45s (gongfu) · 2–3 min (western)',
    leafRatio: '3–4g per 100ml',
    vessel: 'Gaiwan, glass pitcher, or porcelain cup',
    infusions: '4–6 infusions',
    notes:
      'Never use boiling water — it scorches the leaf and turns the cup bitter. Let water cool after boiling, or flash the gaiwan with cool water first. First rinse is optional but awakens the leaf.',
  },
  Yellow: {
    type: 'Yellow',
    waterTemp: '75–80°C',
    steepTime: '45–60s (gongfu) · 2–3 min (western)',
    leafRatio: '4–5g per 100ml',
    vessel: 'Gaiwan or porcelain pot',
    infusions: '5–7 infusions',
    notes:
      'Yellow tea demands patience. The men huan (smothering) process creates a mellow sweetness that reveals itself slowly — brew gently, extend infusions gradually, and resist rushing the session.',
  },
  White: {
    type: 'White',
    waterTemp: '80–90°C',
    steepTime: '60–90s (gongfu) · 3–5 min (western)',
    leafRatio: '5–6g per 100ml',
    vessel: 'Gaiwan, glass, or wide porcelain bowl',
    infusions: '6–10 infusions',
    notes:
      'Aged white tea tolerates higher temperatures and longer steeps. Fresh white is more delicate — keep temperatures toward the lower end. Allow the sweetness to develop across multiple cups.',
  },
  Oolong: {
    type: 'Oolong',
    waterTemp: '90–95°C',
    steepTime: '30–45s (gongfu)',
    leafRatio: '6–8g per 100ml',
    vessel: 'Gaiwan or clay pot',
    infusions: '8–12 infusions',
    notes:
      'Oolong rewards the rinse. A brief first infusion (discarded) opens the tightly rolled leaves and prepares the tea for its proper expression. Ball-rolled oolongs open slowly — early infusions are often more restrained than the fifth or sixth cup.',
  },
  Red: {
    type: 'Red',
    waterTemp: '90–95°C',
    steepTime: '30–45s (gongfu) · 3–4 min (western)',
    leafRatio: '5–6g per 100ml',
    vessel: 'Gaiwan, porcelain pot, or glass teapot',
    infusions: '6–8 infusions',
    notes:
      'Chinese red teas (what the West calls black) are distinct from Indian and Ceylonese varieties — rounder, less astringent, with stone fruit and malt. They hold up beautifully to western steeping as well.',
  },
  Dark: {
    type: 'Dark',
    waterTemp: '95–100°C',
    steepTime: '20–30s (gongfu)',
    leafRatio: '5–8g per 100ml',
    vessel: 'Clay teapot or gaiwan',
    infusions: '10–15+ infusions',
    notes:
      'Heicha (dark tea) benefits from a rinse — sometimes two — to open the compressed leaf and clear dust from the pressing process. Boiling water is appropriate. These teas improve with age and are forgiving of longer steeps in later infusions.',
  },
  Sheng: {
    type: 'Sheng',
    waterTemp: '90–100°C',
    steepTime: '20–40s (gongfu)',
    leafRatio: '6–8g per 100ml',
    vessel: 'Gaiwan or unglazed clay pot',
    infusions: '10–20+ infusions',
    notes:
      'Young sheng puerh can be sharp and demanding — keep temperatures lower (90°C) and steeps brief. Aged sheng welcomes full boiling water and longer, meditative infusions. Always rinse once; aged tea may benefit from two rinses.',
  },
  Shou: {
    type: 'Shou',
    waterTemp: '95–100°C',
    steepTime: '15–30s (gongfu)',
    leafRatio: '6–8g per 100ml',
    vessel: 'Clay teapot — preferably dedicated to shou',
    infusions: '10–20+ infusions',
    notes:
      'Rinse once or twice with boiling water, discarding those first cups, to reduce the earthy "pile scent" characteristic of wò duī fermentation. Quality shou settles into deep, resinous sweetness by the third or fourth infusion.',
  },
  Herbal: {
    type: 'Herbal',
    waterTemp: '95–100°C',
    steepTime: '3–5 min (western)',
    leafRatio: '3–5g per 200ml',
    vessel: 'Glass or porcelain pot',
    infusions: '2–3 infusions',
    notes:
      'Herbals vary widely by ingredient. As a rule: boiling water, longer western steeps, and lighter ratios. Re-steep once or twice if the material is high quality.',
  },
};

/**
 * Look up a brewing profile by the InventoryItem.type string (case-insensitive).
 * Returns undefined for teaware and unrecognised types.
 */
export function getBrewingProfile(type: string): BrewingProfile | undefined {
  if (!type) return undefined;

  // Try the shared wisdom vocabulary first — it already resolves the common
  // dialects (e.g. a stored "Black" value) to their canonical type.
  const canonical = normalizeTeaType(type);
  if (canonical) return BREWING_PROFILES[canonical];

  // Fallback for dialects the shared vocabulary doesn't yet resolve (e.g. a
  // stored "sheng puerh" / "shou puerh" value with a space — bare "puerh" is
  // deliberately unresolvable there without a human). Kept permissive rather
  // than folded into src/wisdom/vocabulary.ts, which is outside this file's scope.
  const t = type.trim();
  const lower = t.toLowerCase();

  if (lower === 'sheng' || lower.includes('raw') || lower.includes('sheng')) return BREWING_PROFILES['Sheng'];
  if (lower === 'shou' || lower.includes('ripe') || lower.includes('shou')) return BREWING_PROFILES['Shou'];
  if (lower.includes('dark') || lower.includes('heicha')) return BREWING_PROFILES['Dark'];
  if (lower.includes('oolong')) return BREWING_PROFILES['Oolong'];
  if (lower.includes('green')) return BREWING_PROFILES['Green'];
  if (lower.includes('white')) return BREWING_PROFILES['White'];
  if (lower.includes('yellow')) return BREWING_PROFILES['Yellow'];
  if (lower.includes('red') || lower.includes('black')) return BREWING_PROFILES['Red'];
  if (lower.includes('herbal') || lower.includes('floral') || lower.includes('blend')) return BREWING_PROFILES['Herbal'];

  // Exact match fallback (case-sensitive) against the canonical keys
  return (BREWING_PROFILES as Record<string, BrewingProfile>)[t];
}
