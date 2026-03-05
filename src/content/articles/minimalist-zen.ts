import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const minimalistZen: ReadableStory = {
  id: 'template-9',
  type: ContentType.Article,
  status: 'published',
  title: 'Minimalist Zen',
  subtitle: 'Less is More',
  thumbnailUrl: 'https://picsum.photos/800/1200?random=t9',
  durationOrTime: '25 Pages',
  origin: 'In-house',
  description: 'Extreme minimalism. Lots of negative space.',
  tags: ['Philosophy', 'Ceremony'],
  content: [
     ":::COVER_MINIMAL:::Zen",
     ":::TEXT_SINGLE_COL:::Less.",
     ":::IMG_FULL_BLEED:::White Wall|https://picsum.photos/800/1200?random=t9-1",
     ":::QUOTE_MINIMAL:::Bowl. Water. Leaf.",
     ":::TEXT_JUSTIFIED_NARROW:::There is nothing to hide. The tea reveals all.",
     ":::IMG_CIRCLE_MASK:::One Drop|https://picsum.photos/800/800?random=t9-2",
     ":::POEM_CENTERED:::Silence in the room / Only the sound of pouring / Peace fills the empty cup",
     ":::IMG_ARCH_MASK:::Shadow|https://picsum.photos/800/1200?random=t9-3",
     ":::TEXT_SINGLE_COL:::Breathe in.",
     ":::IMG_SPLIT_VERTICAL:::Stillness|https://picsum.photos/800/1200?random=t9-4",
     ":::TEXT_SINGLE_COL:::Breathe out.",
     ":::IMG_FULL_BLEED:::Empty Room|https://picsum.photos/800/1200?random=t9-5",
     ":::QUOTE_BIG:::Mu.",
     ":::COPYRIGHT_PAGE:::Teajia"
  ],
  author: PEOPLE.lin,
};
