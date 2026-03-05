import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const theMidnightKiln: ReadableStory = {
  id: 'template-1',
  type: ContentType.Article,
  status: 'published',
  title: 'The Midnight Kiln',
  subtitle: 'Fire & Earth',
  thumbnailUrl: 'https://picsum.photos/800/1200?random=t1',
  durationOrTime: '25 Pages',
  origin: 'In-house',
  description: 'A dark-mode journey into the heart of a wood-fired kiln firing.',
  tags: ['Pottery', 'Teaware', 'Materials'],
  content: [
     ":::COVER_TYPOGRAPHIC:::$$dark$$MIDNIGHT|KILN",
     ":::TEXT_INVERTED:::$$dark$$In the depth of the night, the fire breathes.",
     ":::IMG_FULL_BLEED:::$$dark$$Fire Texture|https://picsum.photos/800/1200?random=t1-1",
     ":::CHAPTER_BOLD:::$$dark$$01|Ignition",
     ":::TEXT_SINGLE_COL:::$$dark$$The wood is dry. The air is still. We begin the ritual of fire. It starts with a single match and a prayer to the kiln god.",
     ":::IMG_SPLIT_VERTICAL:::$$dark$$Stacking the wood.|https://picsum.photos/800/1200?random=t1-2",
     ":::QUOTE_BIG:::$$dark$$Fire is the painter. Clay is the canvas.",
     ":::TEXT_DOUBLE_COL:::$$dark$$Temperature|The kiln must reach 1300 degrees Celsius. It is a slow climb, requiring patience and constant vigilance.\n\nAtmosphere|We starve the fire of oxygen to create reduction. This pulls oxygen from the clay, changing red to grey.",
     ":::IMG_CIRCLE_MASK:::$$dark$$The eye of the fire.|https://picsum.photos/800/800?random=t1-3",
     ":::STAT_BIG_NUMBER:::$$dark$$1300°C|Peak Heat",
     ":::TEXT_SIDEBAR_RIGHT:::$$dark$$Reduction|The flame seeks oxygen everywhere, even stealing it from the metal oxides in the glaze, transforming copper greens into oxblood reds.|https://picsum.photos/600/800?random=t1-4",
     ":::IMG_FULL_BLEED_TITLE:::$$dark$$Transformation|https://picsum.photos/800/1200?random=t1-5",
     ":::TEXT_JUSTIFIED_NARROW:::$$dark$$We watch the pyrometric cones bend. They are the only true measure of heat work. Time and temperature combined into a single physical gesture.",
     ":::CHAPTER_SPLIT:::$$dark$$02|Cooling",
     ":::TEXT_INVERTED:::$$dark$$Silence returns to the kiln shed. The heat radiates for days.",
     ":::IMG_QUAD_GRID:::$$dark$$Details of ash glaze.|https://picsum.photos/600/600?random=t1-6|https://picsum.photos/600/600?random=t1-7|https://picsum.photos/600/600?random=t1-8",
     ":::POEM_CENTERED:::$$dark$$Ash falls like snow / Melting into glass / A landscape / On a cup",
     ":::TEXT_SINGLE_COL:::$$dark$$Unloading the kiln is like opening presents. Many pieces will be lost. Warped, cracked, or simply dull. But the ones that survive are gifts.",
     ":::IMG_ARCH_MASK:::$$dark$$The survivors.|https://picsum.photos/800/1200?random=t1-9",
     ":::IMG_FULL_BLEED:::$$dark$$The perfect bowl|https://picsum.photos/800/1200?random=t1-10",
     ":::QUOTE_MINIMAL:::$$dark$$Perfection is found in the imperfect.",
     ":::IMG_DUOTONE:::$$dark$$Smoke & Shadow|https://picsum.photos/800/1200?random=t1-11",
     ":::COPYRIGHT_PAGE:::$$dark$$Kiln Master: Lin\nPhotography: Chen\n\nTeajia Studios"
  ],
  author: PEOPLE.lin,
};
