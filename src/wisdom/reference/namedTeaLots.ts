// Editorial links attach a named history to a confirmed Stock lot. Titles are not identifiers.
type LotProseField = 'lore' | 'terroir' | 'processingNotes';

interface ReviewedNamedTeaLot {
  namedTeaId: string;
  replacementProse?: Partial<Record<LotProseField, string>>;
  supersededProse?: Partial<Record<LotProseField, string>>;
}

const confirmedLots = new Map<string, ReviewedNamedTeaLot>([
  ['b11a8bad-89d9-4518-9406-25145d4c6e2c', {
    namedTeaId: 'san-he-liu-bao',
    replacementProse: { processingNotes: 'The shop records Guangzhou as a storage stop for this tea.' },
    supersededProse: {
      lore: "San He, meaning Three Cranes, is the house brand of the Wuzhou Tea Factory, founded in 1953. Wuzhou is where modern liu bao production was concentrated, and the factory became the best-known name in the category, its mark widely respected across southern China and Southeast Asia.",
      terroir: "The tea comes from Wuzhou, a city in Guangxi province on the Xijiang river. The area is subtropical and warm-humid, the kind of climate that supports the slow fermentation dark tea depends on. Only Wuzhou-grown leaf made in the traditional way may carry the liu bao name.",
      processingNotes: "Liu bao is a hei cha, a dark tea, and not a puerh. It is made through wet piling, where leaves are heaped so heat, moisture, and microbes can work on them over weeks. This 1990s lot was pressed into basket form and later held in Guangzhou, where the humid air pushes aging along. Aged liu bao from this style tends to drink dark, smooth, and gently sweet.",
    },
  }],
  ['8c24430b-49d5-4c9d-9ea8-2d353057e2b9', {
    namedTeaId: 'nanqiao-ruigong-brick',
    supersededProse: {
      lore: "The name Qiaorui Gong Jin (乔瑞贡金砖) breaks into gong (贡), meaning tribute, and jin zhuan, gold brick. Yunnan puerh has a documented history of being sent to the Qing imperial court as tribute tea. Today the word gong survives on labels as a quality reference, not an active imperial designation.",
      terroir: "Menghai is a county in Xishuangbanna prefecture, southern Yunnan. The area sits at roughly 1,100 to 1,700 metres and grows the large-leaf assamica varietal used for puerh. Menghai is one of the historic puerh counties of Yunnan.",
      processingNotes: "Ripe puerh, called shou, is Yunnan's dark, wet-piled style. The wo dui method was developed in Yunnan in the early 1970s: damp leaf is heaped so heat and microbes ferment it, turning the tea dark and ready to drink young. A brick is a mould-pressed dense block, one of the old compressed-tea formats alongside the round cake. Dense pressing means the form holds and the leaf ages slowly. This brick was pressed in 2009, making it more than fifteen years old. A ripe puerh of this age class pours a dark liquor and drinks full-bodied and smooth, its earthy pile character settled by time.",
    },
  }],
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
  const lot = confirmedLots.get(productId);
  const superseded = lot?.supersededProse?.[field];
  if (superseded && value?.trim().replace(/\s+/g, ' ') === superseded) return lot?.replacementProse?.[field];
  return value ?? undefined;
}
