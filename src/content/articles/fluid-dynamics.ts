import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const fluidDynamics: ReadableStory = {
  id: 'template-7',
  type: ContentType.Article,
  status: 'published',
  title: 'Fluid Dynamics',
  subtitle: 'Abstract Art',
  thumbnailUrl: 'https://picsum.photos/800/1200?random=t7',
  durationOrTime: '25 Pages',
  origin: 'Curated',
  description: 'Experimental template. High art, abstract photography, non-linear.',
  tags: ['Philosophy', 'Culture'],
  content: [
     ":::IMG_FULL_BLEED_TITLE:::FLUID|https://picsum.photos/800/1200?random=t7-1",
     ":::POEM_CENTERED:::Water \n   has \n no \n  shape.",
     ":::IMG_SPLIT_HORIZONTAL:::Flow|https://picsum.photos/1200/800?random=t7-2",
     ":::TEXT_INVERTED:::$$dark$$It takes the shape of the vessel.",
     ":::IMG_FULL_BLEED:::$$dark$$Dark Water|https://picsum.photos/800/1200?random=t7-3",
     ":::TEXT_VERTICAL_CJK:::$$dark$$Be Like Water",
     ":::IMG_CIRCLE_MASK:::$$dark$$Ripples|https://picsum.photos/800/800?random=t7-4",
     ":::IMG_DUOTONE:::$$dark$$Abstract Tea|https://picsum.photos/800/1200?random=t7-5",
     ":::QUOTE_BIG:::$$dark$$The tea leaves read the future.",
     ":::IMG_GRID_MONDRIAN:::$$dark$$Leaves|Forms|https://picsum.photos/800/800?random=t7-6|https://picsum.photos/800/800?random=t7-7",
     ":::TEXT_TYPEWRITER:::$$dark$$0101010101 \nDigital Nature.",
     ":::IMG_ARCH_MASK:::$$dark$$Portal|https://picsum.photos/800/1200?random=t7-8",
     ":::IMG_FULL_BLEED:::$$dark$$Steam rising|https://picsum.photos/800/1200?random=t7-9",
     ":::POEM_CENTERED:::$$dark$$Nothing remains / But the taste / Of time",
     ":::COPYRIGHT_PAGE:::$$dark$$Art by Li Jun"
  ],
  author: PEOPLE.li,
};
