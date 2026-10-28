import type { TastingData } from '../../types';

export const BASIC_TASTES = ['Sweet', 'Bitter', 'Sour / tart', 'Umami', 'Salty'] as const;
export const RETURNING_SWEETNESS = ['None', 'Slight', 'Moderate', 'Strong'] as const;
export function toggleBasicTaste(value: TastingData, taste: typeof BASIC_TASTES[number]): TastingData {
  const tastes = value.basicTastes ?? [];
  return { ...value, basicTastes: tastes.includes(taste) ? tastes.filter(t => t !== taste) : [...tastes, taste] };
}
export function setReturningSweetness(value: TastingData, amount: number | undefined): TastingData {
  if (amount === undefined) return { ...value, huiGan: undefined, huiGanIntensity: undefined };
  if (!Number.isFinite(amount)) return value;
  const level = Math.max(0, Math.min(3, Math.round(amount)));
  return { ...value, huiGanIntensity: level, huiGan: level > 0 };
}
