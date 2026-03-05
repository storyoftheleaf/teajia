import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const archive1980: ReadableStory = {
  id: 'template-8',
  type: ContentType.Article,
  status: 'published',
  title: 'Archive 1980',
  subtitle: 'HK Storage',
  thumbnailUrl: 'https://picsum.photos/800/1200?random=t8',
  durationOrTime: '25 Pages',
  origin: 'Curated',
  description: 'A retro-styled template utilizing typewriter fonts and sepia images.',
  tags: ["Pu'erh", 'Storage', 'History'],
  content: [
     ":::COVER_MINIMAL:::Archive\nFile: 80-HK",
     ":::TEXT_TYPEWRITER:::Location: Hong Kong\nDate: Nov 1980\nSubject: Puerh Storage",
     ":::IMG_POLAROID_SCATTER:::The warehouse.|https://picsum.photos/600/800?random=t8-1|https://picsum.photos/600/800?random=t8-2",
     ":::TEXT_SINGLE_COL:::The humidity here is 90%. The tea ferments rapidly. This is the birthplace of 'Traditional Storage'.",
     ":::IMG_FULL_BLEED:::Tea Cakes|https://picsum.photos/800/1200?random=t8-3",
     ":::TEXT_SIDEBAR_LEFT:::Wet Storage|By intentionally storing tea in humid basements, merchants accelerated the aging process to mimic 50-year-old tea in just 10 years.|https://picsum.photos/600/800?random=t8-4",
     ":::IMG_FILM_STRIP_VERTICAL:::Evidence|https://picsum.photos/600/400?random=t8-5|https://picsum.photos/600/400?random=t8-6",
     ":::QUOTE_MINIMAL:::Time is money.",
     ":::TEXT_JUSTIFIED_NARROW:::We found cakes from the 1950s wrapped in bamboo. The paper had disintegrated. The tea was rock hard.",
     ":::IMG_CIRCLE_MASK:::Red Mark|https://picsum.photos/800/800?random=t8-7",
     ":::STAT_BIG_NUMBER:::1952|Red Mark Era",
     ":::TEXT_DOUBLE_COL:::Taste Profile|The soup is thick, almost like soup stock. It coats the mouth. The hui gan (sweetness) rises from the throat immediately.\n\nMarket Value|A single tong (7 cakes) of this era can buy a house today.",
     ":::IMG_FULL_BLEED:::The Brew|https://picsum.photos/800/1200?random=t8-8",
     ":::TEXT_TYPEWRITER:::End of Report.\nStatus: Archived.",
     ":::COPYRIGHT_PAGE:::HK Tea Association Archives"
  ],
  author: PEOPLE.chen,
};
