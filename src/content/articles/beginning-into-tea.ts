import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const beginningIntoTea: ReadableStory = {
  id: 'start-here-2',
  type: ContentType.Article,
  status: 'published',
  title: 'A Beginning Into Tea',
  subtitle: 'First Steps',
  thumbnailUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=1200&fit=crop',
  durationOrTime: '15 Pages',
  origin: 'In-house',
  description: 'Everything you need to know to start your journey with tea — no experience required.',
  tags: ['Brewing', 'Culture'],
  startHere: true,
  endOfArticleCTA: {
    type: 'shop',
    text: 'Browse our starter teas in the shop.',
    linkTarget: 'shop',
  },
  content: [
    ":::COVER_MAIN:::A Beginning Into Tea|First Steps|https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=1200&fit=crop",
    ":::TEXT_DROP_CAP:::You don't need expensive equipment or years of study. You need leaves, water, and a willingness to pay attention. This guide will walk you through the essentials.",
    ":::QUOTE_MINIMAL:::Begin where you are. Use what you have. Start with what you know.",
    ":::TEXT_SINGLE_COL:::More content coming soon. This article is being written.",
    ":::COPYRIGHT_PAGE:::TeajiA Editorial"
  ],
  author: PEOPLE.chen,
};
