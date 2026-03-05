import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const seasonalRhythms: ReadableStory = {
  id: 'content-display-1',
  type: ContentType.Article,
  status: 'published',
  title: 'Seasonal Rhythms',
  subtitle: 'A Year in Tea',
  thumbnailUrl: 'https://picsum.photos/800/1200?random=cd1',
  durationOrTime: '20 Pages',
  origin: 'In-house',
  description: 'A continuous visual journey through the seasons, told through seamless transitions.',
  tags: ['Seasons', 'Culture'],
  content: [
    ":::IMG_FULL_BLEED:::Spring awakening|https://picsum.photos/800/1200?random=cd1-1",
    ":::TEXT_JUSTIFIED_NARROW:::The first leaves emerge in March. Tender. Fragile. Worth their weight in silver.",
    ":::IMG_FULL_BLEED:::Morning mist|https://picsum.photos/800/1200?random=cd1-2",
    ":::IMG_FULL_BLEED:::Harvest hands|https://picsum.photos/800/1200?random=cd1-3",
    ":::POEM_CENTERED:::Green shoots / Rising through frost / The year begins",
    ":::IMG_FULL_BLEED:::$$dark$$Summer heat|https://picsum.photos/800/1200?random=cd1-4",
    ":::TEXT_JUSTIFIED_NARROW:::$$dark$$By June the growth is unstoppable. The bushes drink the rain and exhale green.",
    ":::IMG_FULL_BLEED:::$$dark$$Monsoon clouds|https://picsum.photos/800/1200?random=cd1-5",
    ":::IMG_FULL_BLEED:::$$dark$$Thunder over fields|https://picsum.photos/800/1200?random=cd1-6",
    ":::POEM_CENTERED:::$$dark$$Rain falls / Tea grows / Cycle continues",
    ":::IMG_FULL_BLEED:::Autumn gold|https://picsum.photos/800/1200?random=cd1-7",
    ":::TEXT_JUSTIFIED_NARROW:::September brings the final flush. These leaves know they are the last.",
    ":::IMG_FULL_BLEED:::Falling leaves|https://picsum.photos/800/1200?random=cd1-8",
    ":::IMG_FULL_BLEED:::Harvest sunset|https://picsum.photos/800/1200?random=cd1-9",
    ":::POEM_CENTERED:::Amber light / Cooling earth / Preparation",
    ":::IMG_FULL_BLEED:::$$dark$$Winter silence|https://picsum.photos/800/1200?random=cd1-10",
    ":::TEXT_JUSTIFIED_NARROW:::$$dark$$The plants sleep beneath snow. Roots strengthen. Energy stores for spring.",
    ":::IMG_FULL_BLEED:::$$dark$$Frost patterns|https://picsum.photos/800/1200?random=cd1-11",
    ":::IMG_FULL_BLEED:::$$dark$$Waiting|https://picsum.photos/800/1200?random=cd1-12",
    ":::POEM_CENTERED:::$$dark$$Silence / Rest / Rebirth waits",
    ":::COPYRIGHT_PAGE:::Photography by Li Jun"
  ],
  author: PEOPLE.li,
};
