import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const botanicalAtlas: ReadableStory = {
  id: 'template-2',
  type: ContentType.Article,
  status: 'published',
  title: 'Botanical Atlas',
  subtitle: 'Science of Leaf',
  thumbnailUrl: 'https://picsum.photos/800/1200?random=t2',
  durationOrTime: '26 Pages',
  origin: 'Curated',
  description: 'A clean, scientific layout focusing on the botany of Camellia Sinensis.',
  tags: ['Origins', 'History', 'Health'],
  content: [
     ":::COVER_MINIMAL:::The Botanical|Atlas",
     ":::DEFINITION_LARGE:::Taxonomy (n.)\nThe branch of science concerned with classification.",
     ":::TEXT_SINGLE_COL:::Kingdom: Plantae\nOrder: Ericales\nFamily: Theaceae\nGenus: Camellia",
     ":::IMG_FULL_BLEED:::Camellia Flower|https://picsum.photos/800/1200?random=t2-1",
     ":::TEXT_DOUBLE_COL:::Structure|The leaf is leathery, serrated, and alternates on the stem. The young leaves are covered in fine white hairs known as trichomes.\n\nFunction|These hairs trap moisture and deter pests, creating the prized 'downy' texture in high-grade teas.",
     ":::IMG_ARCH_MASK:::Trichomes under magnification.|https://picsum.photos/800/1200?random=t2-2",
     ":::MAP_CARTOGRAPHY:::Native Distribution Range",
     ":::TEXT_SIDEBAR_LEFT:::Var. Sinensis|Smaller leaves, hardy, cold tolerant. Native to China. Produces delicate greens and oolongs.|https://picsum.photos/600/800?random=t2-3",
     ":::TEXT_SIDEBAR_RIGHT:::Var. Assamica|Larger leaves, tropical, heat loving. Native to India/Yunnan. The base for Pu-erh and Black tea.|https://picsum.photos/600/800?random=t2-4",
     ":::IMG_SPLIT_HORIZONTAL:::Comparative Anatomy|https://picsum.photos/1200/800?random=t2-5",
     ":::TEXT_JUSTIFIED_NARROW:::Chemistry is the language of flavor. The plant produces secondary metabolites to defend against insects. We interpret these defenses as flavor.",
     ":::IMG_GRID_MONDRIAN:::Cultivar Study|Genetics|https://picsum.photos/800/800?random=t2-6|https://picsum.photos/800/800?random=t2-7",
     ":::IMG_CIRCLE_MASK:::The Mother Bush|https://picsum.photos/800/800?random=t2-8",
     ":::STAT_BIG_NUMBER:::200+|Cultivars",
     ":::IMG_FILM_STRIP_VERTICAL:::Growth Cycle|https://picsum.photos/600/400?random=t2-9|https://picsum.photos/600/400?random=t2-10|https://picsum.photos/600/400?random=t2-11",
     ":::RECIPE_CARD:::Propagation|Select semi-wood cutting.|Dip in rooting hormone.|Place in mist chamber.|Wait 6 weeks.",
     ":::TEXT_SINGLE_COL:::From a single cutting, a forest can grow. Cloning ensures genetic consistency.",
     ":::IMG_FULL_BLEED:::The Greenhouse|https://picsum.photos/800/1200?random=t2-12",
     ":::QUOTE_MINIMAL:::Science is simply observation organized.",
     ":::COPYRIGHT_PAGE:::Teajia Science Dept.\nIllustrations by Chen"
  ],
  author: PEOPLE.chen,
};
