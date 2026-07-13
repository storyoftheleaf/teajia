export const SET_COVER_VARIANTS = ['orbit', 'column', 'horizon', 'seal'] as const;

export type SetCoverVariant = typeof SET_COVER_VARIANTS[number];

export const getSetCoverVariant = (id: string, category = ''): SetCoverVariant => {
  const identity = `${category}:${id}`;
  let hash = 2166136261;
  for (const character of Array.from(identity)) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return SET_COVER_VARIANTS[(hash >>> 0) % SET_COVER_VARIANTS.length];
};
