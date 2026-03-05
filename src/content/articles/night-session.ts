import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const nightSession: ReadableStory = {
  id: 'content-display-5',
  type: ContentType.Article,
  status: 'published',
  title: 'Night Session',
  subtitle: 'After Dark',
  thumbnailUrl: 'https://picsum.photos/800/1200?random=cd5',
  durationOrTime: '16 Pages',
  origin: 'In-house',
  description: 'A dark, atmospheric meditation on late-night tea drinking.',
  tags: ['Ceremony', 'Philosophy'],
  content: [
    ":::IMG_FULL_BLEED_TITLE:::$$dark$$NIGHT|https://picsum.photos/800/1200?random=cd5-1",
    ":::TEXT_INVERTED:::$$dark$$The city sleeps. The tea wakes.",
    ":::IMG_FULL_BLEED:::$$dark$$Single lamp|https://picsum.photos/800/1200?random=cd5-2",
    ":::QUOTE_BIG:::$$dark$$Darkness holds the flavor.",
    ":::IMG_FULL_BLEED:::$$dark$$Steam in shadow|https://picsum.photos/800/1200?random=cd5-3",
    ":::TEXT_INVERTED:::$$dark$$Silence.",
    ":::IMG_FULL_BLEED_TITLE:::$$dark$$Solitude|https://picsum.photos/800/1200?random=cd5-4",
    ":::IMG_FULL_BLEED:::$$dark$$Black tea, black night|https://picsum.photos/800/1200?random=cd5-5",
    ":::QUOTE_BIG:::$$dark$$Night tea is different tea.",
    ":::IMG_FULL_BLEED:::$$dark$$Reflection in cup|https://picsum.photos/800/1200?random=cd5-6",
    ":::TEXT_INVERTED:::$$dark$$No distractions. Just depth.",
    ":::IMG_FULL_BLEED_TITLE:::$$dark$$3AM|https://picsum.photos/800/1200?random=cd5-7",
    ":::IMG_FULL_BLEED:::$$dark$$Empty street view|https://picsum.photos/800/1200?random=cd5-8",
    ":::QUOTE_BIG:::$$dark$$This is the hour of truth.",
    ":::IMG_FULL_BLEED:::$$dark$$Last sip|https://picsum.photos/800/1200?random=cd5-9",
    ":::TEXT_INVERTED:::$$dark$$Dawn approaches. The session ends.",
    ":::COPYRIGHT_PAGE:::$$dark$$Night Photography by Li Jun"
  ],
  author: PEOPLE.li,
};
