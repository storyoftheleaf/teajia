import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const historyOfTea: ReadableStory = {
  id: 'start-here-3',
  type: ContentType.Article,
  status: 'published',
  title: 'A History of Tea',
  subtitle: 'Five Thousand Years',
  thumbnailUrl: 'https://images.unsplash.com/photo-1563822249366-7b0d8e7295cf?w=800&h=1200&fit=crop',
  durationOrTime: '20 Pages',
  origin: 'In-house',
  description: 'From Shennong to the modern tea house — the remarkable journey of a single leaf.',
  tags: ['History', 'Origins', 'China'],
  startHere: true,
  content: [
    ":::COVER_MAIN:::A History of Tea|Five Thousand Years|https://images.unsplash.com/photo-1563822249366-7b0d8e7295cf?w=800&h=1200&fit=crop",
    ":::TEXT_DROP_CAP:::Legend says the emperor Shennong discovered tea when a leaf drifted into his boiling water. Whether true or not, the story captures something essential: tea has always found us at moments of stillness.",
    ":::LIST_TIMELINE:::2737 BCE — Shennong discovers tea|760 CE — Lu Yu writes The Classic of Tea|1610 — Tea reaches Europe|1773 — Boston Tea Party|1823 — Tea plants found in Assam|2000s — Third wave tea movement begins",
    ":::TEXT_SINGLE_COL:::More content coming soon. This article is being written.",
    ":::COPYRIGHT_PAGE:::TeajiA Editorial"
  ],
  author: PEOPLE.chen,
};
