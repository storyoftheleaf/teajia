import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const theCreationOfTeajia: ReadableStory = {
  id: 'start-here-1',
  type: ContentType.Article,
  status: 'published',
  title: 'The Creation of TeajiA',
  subtitle: 'Our Story',
  thumbnailUrl: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=800&h=1200&fit=crop',
  durationOrTime: '12 Pages',
  origin: 'In-house',
  description: 'How a small island in Bali became the birthplace of a new philosophy of tea.',
  tags: ['Philosophy', 'Bali'],
  startHere: true,
  content: [
    ":::COVER_MAIN:::The Creation of TeajiA|Our Story|https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=800&h=1200&fit=crop",
    ":::TEXT_DROP_CAP:::TeajiA began as a question: what would tea look like if we approached it not as a commodity, but as a living art? This is the story of how that question led us to Bali, and how Bali led us to tea.",
    ":::QUOTE_BIG:::Tea is not a drink. It is a way of attending to the world.",
    ":::TEXT_SINGLE_COL:::More content coming soon. This article is being written.",
    ":::COPYRIGHT_PAGE:::TeajiA Editorial"
  ],
  author: PEOPLE.chen,
};
