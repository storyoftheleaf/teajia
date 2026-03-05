import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const urbanTeaHouse: ReadableStory = {
  id: 'template-3',
  type: ContentType.Article,
  status: 'published',
  title: 'Urban Tea House',
  subtitle: 'Modern Spaces',
  thumbnailUrl: 'https://picsum.photos/800/1200?random=t3',
  durationOrTime: '28 Pages',
  origin: 'Curated',
  description: 'Modern magazine layout exploring brutalist tea architecture.',
  tags: ['Architecture', 'Space Design', 'China'],
  content: [
     ":::IMG_FULL_BLEED_TITLE:::Concrete & Clay|https://picsum.photos/800/1200?random=t3-1",
     ":::TEXT_DROP_CAP:::Shanghai is changing. The old lanes are vanishing, replaced by steel towers. But in the shadow of the giants, a new kind of tea house is emerging.",
     ":::IMG_SPLIT_VERTICAL:::Architecture of Silence.|https://picsum.photos/800/1200?random=t3-2",
     ":::TEXT_SIDEBAR_RIGHT:::The Architect|Wang Shu's influence is visible here. Recycled tiles, raw concrete, open spaces that breathe.|https://picsum.photos/600/800?random=t3-3",
     ":::QUOTE_BIG:::We build spaces to hold time, not just people.",
     ":::IMG_GRID_MONDRIAN:::Interior Details|Design|https://picsum.photos/800/800?random=t3-4|https://picsum.photos/800/800?random=t3-5",
     ":::TEXT_DOUBLE_COL:::The menu is minimalist. No food. No music. Just tea. This is a radical proposition in a city that never stops moving.\n\nCustomers must surrender their phones at the door. A locker creates a physical boundary between the noise and the brew.",
     ":::IMG_FULL_BLEED:::The Main Hall|https://picsum.photos/800/1200?random=t3-6",
     ":::CHAPTER_BOLD:::01|The Light",
     ":::TEXT_SINGLE_COL:::Light is treated as a material here. It washes down walls, highlighting the texture of the rammed earth.",
     ":::IMG_ARCH_MASK:::Skylight geometry.|https://picsum.photos/800/1200?random=t3-7",
     ":::TEXT_INVERTED:::$$dark$$Shadow defines the light.",
     ":::IMG_FULL_BLEED:::$$dark$$Night view|https://picsum.photos/800/1200?random=t3-8",
     ":::TEXT_SINGLE_COL:::$$dark$$At night, the space transforms. It becomes a cavern of solitude.",
     ":::IMG_SPLIT_HORIZONTAL:::$$dark$$Evening service.|https://picsum.photos/1200/800?random=t3-9",
     ":::CHAPTER_BOLD:::02|The Ritual",
     ":::TEXT_JUSTIFIED_NARROW:::The brewing is gongfu style, but stripped of affectation. No ornate trays. Just a pot, a bowl, and water.",
     ":::IMG_CIRCLE_MASK:::Pouring.|https://picsum.photos/800/800?random=t3-10",
     ":::IMG_POLAROID_SCATTER:::Patrons.|https://picsum.photos/600/800?random=t3-11|https://picsum.photos/600/800?random=t3-12",
     ":::TEXT_SINGLE_COL:::As we stepped back out into the neon chaos of the Bund, the silence of the tea house stayed with us.",
     ":::QUOTE_MINIMAL:::An island of calm in a sea of speed.",
     ":::CREDITS_PAGE:::Photos: Li Jun\nText: Sarah Jenkins"
  ],
  author: PEOPLE.sarah,
};
