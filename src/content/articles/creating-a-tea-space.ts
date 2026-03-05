import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const creatingATeaSpace: ReadableStory = {
  id: 'start-here-4',
  type: ContentType.Article,
  status: 'published',
  title: 'Creating a Tea Space',
  subtitle: 'Your Practice Room',
  thumbnailUrl: 'https://images.unsplash.com/photo-1545069122-7236651d5c7e?w=800&h=1200&fit=crop',
  durationOrTime: '14 Pages',
  origin: 'In-house',
  description: 'How to design a personal space for tea practice — from a corner of a desk to an entire room.',
  tags: ['Space Design', 'Philosophy'],
  startHere: true,
  endOfArticleCTA: {
    type: 'consult',
    text: 'Adrian designs spaces like this.',
    linkTarget: 'consult',
  },
  content: [
    ":::COVER_MAIN:::Creating a Tea Space|Your Practice Room|https://images.unsplash.com/photo-1545069122-7236651d5c7e?w=800&h=1200&fit=crop",
    ":::TEXT_DROP_CAP:::A tea space is not about luxury. It is about intention. Whether you have an entire room or just a small tray on your desk, the principles are the same: simplicity, natural materials, and room to breathe.",
    ":::QUOTE_BIG:::The space shapes the practice. The practice shapes the space.",
    ":::TEXT_SINGLE_COL:::More content coming soon. This article is being written.",
    ":::COPYRIGHT_PAGE:::TeajiA Editorial"
  ],
  author: PEOPLE.chen,
};
