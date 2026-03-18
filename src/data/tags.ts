export const TAG_SECTIONS = {
  teaTypes: {
    label: 'Tea Types',
    tags: ['White', 'Green', 'Yellow', 'Oolong', 'Black', "Pu'erh", 'Herbal & Other'] as const
  },
  subjects: {
    label: 'Subjects',
    tags: [
      'Teaware', 'Ceremony', 'Philosophy', 'History', 'Calligraphy',
      'Brewing', 'Water', 'Sourcing', 'Storage', 'Seasons',
      'Health', 'Culture', 'Teaching', 'Business', 'Origins',
      'Tasting', 'Events & Celebrations'
    ] as const
  },
  artsDesign: {
    label: 'Arts & Design',
    tags: [
      'Pottery', 'Metalwork', 'Woodwork', 'Textiles', 'Bamboo',
      'Space Design', 'Architecture', 'Materials'
    ] as const
  },
  places: {
    label: 'Places',
    tags: [
      'China', 'Yunnan', 'Fujian', 'Taiwan', 'Japan',
      'Bali', 'United States', 'Global'
    ] as const
  }
} as const;

export type TagSection = keyof typeof TAG_SECTIONS;
export type Tag = typeof TAG_SECTIONS[TagSection]['tags'][number];
export const ALL_TAGS: Tag[] = Object.values(TAG_SECTIONS).flatMap(s => [...s.tags]);

/**
 * Maps article IDs to their tag metadata.
 * Kept separate from article data files to avoid modifying the shared Story type.
 */
export interface ArticleTagMeta {
  tags: Tag[];
  featured?: boolean;
  startHere?: boolean;
  endOfArticleCTA?: {
    type: 'shop' | 'learn' | 'consult';
    text: string;
    linkTarget: string;
  };
}

export const ARTICLE_TAG_MAP: Record<string, ArticleTagMeta> = {
  // --- Template Showcase ---
  'template-showcase': {
    // Layout Template Showcase - all 86 layout variants
    tags: ['Teaching', 'Culture'],
    featured: true,
  },

  // --- Original / Template Articles ---
  '1': {
    // Path of Clouds - Wuyi mountains, Yan Yun
    tags: ['Oolong', 'Origins', 'China', 'Philosophy'],
  },
  'template-1': {
    // The Midnight Kiln - Wood-fired kiln firing
    tags: ['Pottery', 'Teaware', 'Materials'],
    endOfArticleCTA: {
      type: 'shop',
      text: 'Browse our handmade teaware collection.',
      linkTarget: 'shop',
    },
  },
  'template-2': {
    // Botanical Atlas - Botany of Camellia Sinensis
    tags: ['History', 'Origins', 'Health'],
    endOfArticleCTA: {
      type: 'learn',
      text: 'We teach the science of tea in our courses.',
      linkTarget: 'learn',
    },
  },
  'template-3': {
    // Urban Tea House - Brutalist tea architecture
    tags: ['Architecture', 'Space Design', 'Culture'],
    endOfArticleCTA: {
      type: 'consult',
      text: 'Adrian designs spaces like this.',
      linkTarget: 'consult',
    },
  },
  'template-4': {
    // The Master's Voice - Long-form interview
    tags: ['Ceremony', 'Philosophy', 'Teaching'],
  },
  'template-5': {
    // Ancient Routes - Tea Horse Road
    tags: ['History', 'China', 'Sourcing'],
  },
  'template-6': {
    // Culinary Leaf - Tea cuisine/pairings
    tags: ['Brewing', 'Culture', 'Tasting'],
  },
  'template-7': {
    // Fluid Dynamics - Abstract art
    tags: ['Philosophy', 'Culture'],
  },
  'template-8': {
    // Archive 1980 - HK Storage, retro
    tags: ['History', 'Storage', "Pu'erh"],
  },
  'template-9': {
    // Minimalist Zen - Extreme minimalism
    tags: ['Philosophy', 'Space Design', 'Japan'],
  },
  'template-10': {
    // Data & Terroir - Infographic
    tags: ['Sourcing', 'Origins', 'China'],
  },

  // --- Tea Feature Articles ---
  'tea-feature-1': {
    // Laoshan Green - Shandong coastal green tea
    tags: ['Green', 'Tasting', 'China', 'Origins'],
    endOfArticleCTA: {
      type: 'shop',
      text: 'This tea is in our shop.',
      linkTarget: 'shop',
    },
  },
  'tea-feature-2': {
    // Oriental Beauty - Taiwanese oolong
    tags: ['Oolong', 'Taiwan', 'Origins', 'Tasting'],
    endOfArticleCTA: {
      type: 'shop',
      text: 'This tea is in our shop.',
      linkTarget: 'shop',
    },
  },

  // --- Interview Articles ---
  'interview-1': {
    // The Tea Farmer - Wang Mei, Fujian
    tags: ['Sourcing', 'Fujian', 'Culture', 'Teaching'],
  },
  'interview-2': {
    // The Ceramicist - Liu Xin, ceramic artist
    tags: ['Pottery', 'Teaware', 'Culture'],
    endOfArticleCTA: {
      type: 'shop',
      text: 'Browse our handmade teaware collection.',
      linkTarget: 'shop',
    },
  },

  // --- Science Articles ---
  'science-1': {
    // Water Temperature - Chemistry of extraction
    tags: ['Brewing', 'Water', 'Health'],
    endOfArticleCTA: {
      type: 'learn',
      text: 'We teach this in our courses.',
      linkTarget: 'learn',
    },
  },
  'science-2': {
    // The Oxidation Spectrum - Green to Black
    tags: ['Green', 'Black', 'Oolong', 'Origins'],
    endOfArticleCTA: {
      type: 'learn',
      text: 'We teach this in our courses.',
      linkTarget: 'learn',
    },
  },
  'science-3': {
    // Caffeine in Tea - Myths vs Reality
    tags: ['Health', 'Brewing', 'Tasting'],
  },

  // --- Curated ---
  'curated-1': {
    // This Week in Tea - Curated web content
    tags: ['Culture', 'Global', 'Events & Celebrations'],
  },

  // --- Content Display Articles ---
  'content-display-1': {
    // Seasonal Rhythms - Year in tea
    tags: ['Seasons', 'Culture', 'Brewing'],
  },
  'content-display-2': {
    // The Slow Pour - Cinematic tea ceremony
    tags: ['Ceremony', 'Philosophy', 'Brewing'],
  },
  'content-display-3': {
    // Field Notes - Tea field observations
    tags: ['Sourcing', 'Origins', 'China'],
  },
  'content-display-4': {
    // Anatomy of a Cup - Scientific breakdown
    tags: ['Brewing', 'Teaware', 'Tasting'],
  },
  'content-display-5': {
    // Night Session - Late-night tea
    tags: ['Ceremony', 'Philosophy', 'Seasons'],
  },
  'content-display-6': {
    // Grid Study - Bauhaus geometric
    tags: ['Space Design', 'Architecture', 'Culture'],
  },
  'content-display-7': {
    // Whispered Verse - Tea poems
    tags: ['Calligraphy', 'Philosophy', 'Culture'],
  },
  'content-display-8': {
    // Living Archive - Curated references
    tags: ['History', 'Culture', 'Global'],
  },
  'content-display-9': {
    // Dual Voices - East meets West
    tags: ['Philosophy', 'Culture', 'Global'],
  },

  // --- Start Here Placeholder Articles ---
  'start-here-1': {
    // The Creation of TeajiA
    tags: ['Philosophy', 'Bali'],
    startHere: true,
  },
  'start-here-2': {
    // Beginning Into Tea
    tags: ['Brewing', 'Culture'],
    startHere: true,
  },
  'start-here-3': {
    // History of Tea
    tags: ['History', 'Origins', 'China'],
    startHere: true,
  },
  'start-here-4': {
    // Creating a Tea Space
    tags: ['Space Design', 'Philosophy'],
    startHere: true,
    endOfArticleCTA: {
      type: 'consult',
      text: 'Adrian designs spaces like this.',
      linkTarget: 'consult',
    },
  },
};

/**
 * Helper: get tag metadata for an article by ID.
 * Returns empty tags array if article has no tag mapping.
 */
export function getArticleTags(articleId: string): ArticleTagMeta {
  return ARTICLE_TAG_MAP[articleId] ?? { tags: [] };
}

/**
 * Helper: get all article IDs that match any of the given tags.
 */
export function getArticleIdsByTags(tags: Tag[]): string[] {
  if (tags.length === 0) return Object.keys(ARTICLE_TAG_MAP);
  return Object.entries(ARTICLE_TAG_MAP)
    .filter(([, meta]) => meta.tags.some(t => tags.includes(t)))
    .map(([id]) => id);
}
