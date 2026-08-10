export const TEA_REFERENCE_PREVIEW_ENABLED = import.meta.env.MODE === 'tea-reference-preview';

export const TEA_REFERENCE_ROUTE_PATHS = {
  index: '/wisdom/types',
  family: '/wisdom/family/:id',
  type: '/wisdom/type/:id',
} as const;

export function teaReferenceRoutePaths(previewEnabled: boolean): string[] {
  return previewEnabled ? Object.values(TEA_REFERENCE_ROUTE_PATHS) : [];
}

export const ACTIVE_TEA_REFERENCE_ROUTE_PATHS = teaReferenceRoutePaths(
  TEA_REFERENCE_PREVIEW_ENABLED,
);
