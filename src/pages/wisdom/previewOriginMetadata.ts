import type { PlaceLevel } from '../../wisdom/reference/types';

export interface PreviewPlaceLevelDefinition {
  level: PlaceLevel;
  singular: string;
  plural: string;
}

/** Preview-only public labels and display order for cited geographic levels. */
export const PREVIEW_PLACE_LEVELS = [
  { level: 'major_region', singular: 'Major region', plural: 'Major regions' },
  { level: 'tea_area', singular: 'Tea area', plural: 'Tea areas' },
  { level: 'mountain', singular: 'Mountain', plural: 'Mountains' },
  { level: 'village', singular: 'Village', plural: 'Villages' },
  { level: 'locality', singular: 'Locality', plural: 'Localities' },
] as const satisfies readonly PreviewPlaceLevelDefinition[];

const PREVIEW_PLACE_LEVEL_BY_ID = Object.fromEntries(
  PREVIEW_PLACE_LEVELS.map(definition => [definition.level, definition]),
) as Record<PlaceLevel, PreviewPlaceLevelDefinition>;

export function previewPlaceLevel(level: PlaceLevel): PreviewPlaceLevelDefinition {
  return PREVIEW_PLACE_LEVEL_BY_ID[level];
}
