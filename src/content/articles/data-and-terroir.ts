import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const dataAndTerroir: ReadableStory = {
  id: 'template-10',
  type: ContentType.Article,
  status: 'published',
  title: 'Data & Terroir',
  subtitle: 'Infographic',
  thumbnailUrl: 'https://picsum.photos/800/1200?random=t10',
  durationOrTime: '25 Pages',
  origin: 'In-house',
  description: 'A data-heavy template for conveying information and charts.',
  tags: ['Sourcing', 'Origins'],
  content: [
     ":::COVER_TYPOGRAPHIC:::DATA\nTERROIR",
     ":::STAT_BIG_NUMBER:::1400m|Elevation",
     ":::TEXT_SINGLE_COL:::The impact of altitude on polyphenols is measurable.",
     ":::IMG_SPLIT_HORIZONTAL:::Soil Composition|https://picsum.photos/1200/800?random=t10-1",
     ":::MAP_CARTOGRAPHY:::Shan Lin Xi, Taiwan",
     ":::TEXT_SIDEBAR_RIGHT:::Fog Cover|Average 8 hours of fog per day reduces photosynthesis, increasing amino acids (umami) and decreasing tannins (bitterness).|https://picsum.photos/600/800?random=t10-2",
     ":::IMG_QUAD_GRID:::Weather Data|Charts|https://picsum.photos/600/600?random=t10-3|https://picsum.photos/600/600?random=t10-4",
     ":::DEFINITION_LARGE:::Anthocyanin (n.)\nPigment produced in response to UV stress.",
     ":::IMG_FULL_BLEED:::Purple Leaf|https://picsum.photos/800/1200?random=t10-5",
     ":::TEXT_DOUBLE_COL:::Spring Harvest|Highest value. Nitrogen stored in roots over winter releases into the first flush.\n\nSummer Harvest|Fast growth. High catechins. Bitter. Often used for bubble tea.",
     ":::IMG_FILM_STRIP_VERTICAL:::Harvest Seasons|https://picsum.photos/600/400?random=t10-6|https://picsum.photos/600/400?random=t10-7",
     ":::QUOTE_MINIMAL:::Quality is an equation.",
     ":::COPYRIGHT_PAGE:::Teajia Research"
  ],
  author: PEOPLE.chen,
};
