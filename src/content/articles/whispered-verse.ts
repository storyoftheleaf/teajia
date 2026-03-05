import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const whisperedVerse: ReadableStory = {
  id: 'content-display-7',
  type: ContentType.Article,
  status: 'published',
  title: 'Whispered Verse',
  subtitle: 'Tea Poems',
  thumbnailUrl: 'https://picsum.photos/800/1200?random=cd7',
  durationOrTime: '18 Pages',
  origin: 'In-house',
  description: 'A collection of verses inspired by tea, framed in ethereal imagery.',
  tags: ['Philosophy', 'Culture'],
  content: [
    ":::COVER_MINIMAL:::Whispered|Verse",
    ":::POEM_CENTERED:::Steam rises\nLike morning fog\nClearing thought",
    ":::IMG_ARCH_MASK:::Morning light|https://picsum.photos/800/1200?random=cd7-1",
    ":::QUOTE_MINIMAL:::Tea is the poem water writes on leaves.",
    ":::POEM_CENTERED:::Ancient trees\nRemember rain\nFrom centuries past",
    ":::IMG_CIRCLE_MASK:::Tree rings|https://picsum.photos/800/800?random=cd7-2",
    ":::IMG_ARCH_MASK:::Misty mountains|https://picsum.photos/800/1200?random=cd7-3",
    ":::POEM_CENTERED:::Hands pour\nTime suspends\nBetween breaths",
    ":::QUOTE_BIG:::The cup is a mirror. Look closely.",
    ":::IMG_CIRCLE_MASK:::Reflection|https://picsum.photos/800/800?random=cd7-4",
    ":::POEM_CENTERED:::Bitter then sweet\nJourney of taste\nHui gan rising",
    ":::IMG_ARCH_MASK:::Golden liquor|https://picsum.photos/800/1200?random=cd7-5",
    ":::QUOTE_MINIMAL:::Each sip is a stanza. Each session a song.",
    ":::POEM_CENTERED:::Night falls\nTea remains\nCompanion in darkness",
    ":::IMG_CIRCLE_MASK:::Night cup|https://picsum.photos/800/800?random=cd7-6",
    ":::IMG_ARCH_MASK:::Stars above|https://picsum.photos/800/1200?random=cd7-7",
    ":::POEM_CENTERED:::Empty cup\nFull heart\nThe way of tea",
    ":::COPYRIGHT_PAGE:::Poems by Zhou Yu"
  ],
  author: PEOPLE.zhou,
};
