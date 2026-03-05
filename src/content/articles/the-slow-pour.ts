import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const theSlowPour: ReadableStory = {
  id: 'content-display-2',
  type: ContentType.Article,
  status: 'published',
  title: 'The Slow Pour',
  subtitle: 'Frame by Frame',
  thumbnailUrl: 'https://picsum.photos/800/1200?random=cd2',
  durationOrTime: '18 Pages',
  origin: 'In-house',
  description: 'A cinematic exploration of the tea ceremony, framed like a film.',
  tags: ['Ceremony', 'Philosophy'],
  content: [
    ":::COVER_MINIMAL:::The Slow|Pour",
    ":::IMG_SPLIT_HORIZONTAL:::Opening frame|https://picsum.photos/1200/800?random=cd2-1",
    ":::TEXT_JUSTIFIED_NARROW:::Water meets leaf. Time suspends.",
    ":::IMG_SPLIT_HORIZONTAL:::The setup|https://picsum.photos/1200/800?random=cd2-2",
    ":::QUOTE_MINIMAL:::Every gesture is a sentence.",
    ":::IMG_SPLIT_HORIZONTAL:::Hand reaching|https://picsum.photos/1200/800?random=cd2-3",
    ":::TEXT_JUSTIFIED_NARROW:::The pot is lifted. Gravity pulls the stream.",
    ":::IMG_SPLIT_HORIZONTAL:::The pour begins|https://picsum.photos/1200/800?random=cd2-4",
    ":::IMG_SPLIT_HORIZONTAL:::Mid-stream|https://picsum.photos/1200/800?random=cd2-5",
    ":::TEXT_JUSTIFIED_NARROW:::Arc of water. Thread of light. Connection.",
    ":::IMG_SPLIT_HORIZONTAL:::Cup fills|https://picsum.photos/1200/800?random=cd2-6",
    ":::QUOTE_MINIMAL:::Patience is the pour.",
    ":::IMG_SPLIT_HORIZONTAL:::Steam rises|https://picsum.photos/1200/800?random=cd2-7",
    ":::TEXT_JUSTIFIED_NARROW:::Heat escapes. Aroma blooms. Anticipation.",
    ":::IMG_SPLIT_HORIZONTAL:::The sip|https://picsum.photos/1200/800?random=cd2-8",
    ":::IMG_SPLIT_HORIZONTAL:::Eyes close|https://picsum.photos/1200/800?random=cd2-9",
    ":::QUOTE_MINIMAL:::Taste is time collapsed.",
    ":::IMG_SPLIT_HORIZONTAL:::Empty cup|https://picsum.photos/1200/800?random=cd2-10",
    ":::COPYRIGHT_PAGE:::Film by Li Jun"
  ],
  author: PEOPLE.li,
};
