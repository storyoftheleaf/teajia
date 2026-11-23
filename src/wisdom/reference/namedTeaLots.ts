// Editorial links attach a named history to a confirmed Stock lot. Titles are not identifiers.
type LotProseField = 'lore' | 'terroir' | 'processingNotes';

interface ReviewedNamedTeaLot {
  namedTeaId: string;
  supersededProse?: Partial<Record<LotProseField, string>>;
}

const confirmedLots = new Map<string, ReviewedNamedTeaLot>([
  ['cb7efd7b-9da6-4dc8-be76-3c7e69bdb02e', {
    namedTeaId: 'y562',
    // Suppress only the reviewed version. Edited Stock copy passes through.
    supersededProse: {
      lore: "The Y562 is a named export recipe from Yunnan's state tea trade house, not an anonymous cake. In old puerh coding the Y prefix marks it as the Yunnan Tea Import and Export Company, and Jixing, meaning fortune, was their export brand. The number itself is shorthand for leaf grade and factory. Grade 5 to 6 points to fine tender leaf, in contrast to the coarse ripe bricks of the same period.",
      terroir: "The leaf comes from Menghai, a warm humid county in southern Yunnan near the Burma and Laos borders. This is the historic home of large-leaf puerh, where old tea plants grow in red iron-rich soil. The climate is hot in summer and mild in winter, which suits the thick fleshy leaves that puerh needs.",
      processingNotes: "Ripe puerh is made by wo dui, a wet piling step developed in the early 1970s where damp leaves are heaped and turned so microbes speed up the ageing. Rather than pressed into a cake, this lot was kept loose in a 100 gram box, then aged in Hong Kong dry storage from around 1993, a steady climate that lets the tea settle cleanly. Ripe puerh of this age drinks dark, smooth, and thick in the mouth.",
    },
  }],
]);

const linkedNamedTeaIds = new Set(Array.from(confirmedLots.values(), lot => lot.namedTeaId));

export function requiresNamedTeaLotLink(namedTeaId: string): boolean {
  return linkedNamedTeaIds.has(namedTeaId);
}

export function namedTeaIdForLot(productId: string): string | undefined {
  return confirmedLots.get(productId)?.namedTeaId;
}

export function reviewedLotProse(productId: string, field: LotProseField, value?: string | null) {
  const superseded = confirmedLots.get(productId)?.supersededProse?.[field];
  if (superseded && value?.trim().replace(/\s+/g, ' ') === superseded) return undefined;
  return value ?? undefined;
}
