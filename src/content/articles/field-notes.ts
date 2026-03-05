import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const fieldNotes: ReadableStory = {
  id: 'content-display-3',
  type: ContentType.Article,
  status: 'published',
  title: 'Field Notes',
  subtitle: 'Research Journal',
  thumbnailUrl: 'https://picsum.photos/800/1200?random=cd3',
  durationOrTime: '22 Pages',
  origin: 'In-house',
  description: 'Personal observations from the tea fields, sketched and scribbled.',
  tags: ['Sourcing', 'Yunnan', 'China'],
  content: [
    ":::COVER_MINIMAL:::Field|Notes",
    ":::TEXT_TYPEWRITER:::Location: Menghai County\nDate: April 15\nWeather: Humid, 25°C\nMission: Document ancient trees",
    ":::IMG_POLAROID_SCATTER:::First impressions|https://picsum.photos/600/800?random=cd3-1|https://picsum.photos/600/800?random=cd3-2",
    ":::TEXT_TYPEWRITER:::The locals say these trees are 400 years old. Hard to verify. But the trunk diameter doesn't lie.",
    ":::MAP_CARTOGRAPHY:::Menghai Region",
    ":::TEXT_TYPEWRITER:::Observation 1:\nLeaf size correlates with tree age. Ancient trees produce smaller, thicker leaves. Counter-intuitive.",
    ":::IMG_POLAROID_SCATTER:::Leaf samples|https://picsum.photos/600/800?random=cd3-3|https://picsum.photos/600/800?random=cd3-4",
    ":::POEM_SCATTERED:::Tea trees remember / Rain from centuries past / Roots hold stories",
    ":::TEXT_TYPEWRITER:::Observation 2:\nWild tea has a sharper bitterness. It fights back. Cultivated tea has been domesticated into sweetness.",
    ":::IMG_POLAROID_SCATTER:::The old tree|https://picsum.photos/600/800?random=cd3-5|https://picsum.photos/600/800?random=cd3-6",
    ":::TEXT_TYPEWRITER:::Met a farmer named Zhang. He climbs these trees barefoot. Says shoes damage the bark.",
    ":::MAP_CARTOGRAPHY:::Ancient Tea Forests",
    ":::IMG_POLAROID_SCATTER:::Zhang climbing|https://picsum.photos/600/800?random=cd3-7|https://picsum.photos/600/800?random=cd3-8",
    ":::TEXT_TYPEWRITER:::Observation 3:\nBirds nest in the tea trees. Droppings fertilize naturally. Ecosystem is self-sustaining.",
    ":::POEM_SCATTERED:::Branches reach / Birds sing / Life feeds life",
    ":::TEXT_TYPEWRITER:::Final note:\nThis tea tastes different because the land is different. Terroir is real.",
    ":::IMG_POLAROID_SCATTER:::Sunset over fields|https://picsum.photos/600/800?random=cd3-9|https://picsum.photos/600/800?random=cd3-10",
    ":::TEXT_TYPEWRITER:::End of field work.\nReturning tomorrow.",
    ":::COPYRIGHT_PAGE:::Field Research by Sarah Jenkins"
  ],
  author: PEOPLE.sarah,
};
