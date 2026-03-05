import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const ancientRoutes: ReadableStory = {
  id: 'template-5',
  type: ContentType.Article,
  status: 'published',
  title: 'Ancient Routes',
  subtitle: 'Tea Horse Road',
  thumbnailUrl: 'https://picsum.photos/800/1200?random=t5',
  durationOrTime: '30 Pages',
  origin: 'In-house',
  description: 'A travel journal template focusing on maps and landscapes.',
  tags: ['History', 'China', 'Yunnan', 'Origins'],
  content: [
     ":::COVER_MINIMAL:::Ancient\nRoutes",
     ":::MAP_CARTOGRAPHY:::The Tea Horse Road",
     ":::TEXT_TYPEWRITER:::Day 1: We departed Lijiang at dawn. The mules were restless.",
     ":::IMG_FULL_BLEED:::The Caravan|https://picsum.photos/800/1200?random=t5-1",
     ":::TEXT_SINGLE_COL:::The path is narrow here. One side is the mountain, the other is a sheer drop to the Jinsha river.",
     ":::IMG_SPLIT_HORIZONTAL:::River Gorge|https://picsum.photos/1200/800?random=t5-2",
     ":::TEXT_SIDEBAR_RIGHT:::Pu-erh Bricks|Tea was compressed into tight bricks for transport. It was money. It was food. It was survival.|https://picsum.photos/600/800?random=t5-3",
     ":::IMG_POLAROID_SCATTER:::Views from the saddle.|https://picsum.photos/600/800?random=t5-4|https://picsum.photos/600/800?random=t5-5",
     ":::TEXT_TYPEWRITER:::Day 4: Shaxi Village. The market square is unchanged for centuries.",
     ":::IMG_FULL_BLEED:::Shaxi Market|https://picsum.photos/800/1200?random=t5-6",
     ":::CHAPTER_SPLIT:::The High\nPass",
     ":::TEXT_JUSTIFIED_NARROW:::Altitude: 3500m. Breathing is difficult. The mules stop every hundred meters to catch their breath.",
     ":::IMG_FULL_BLEED:::Snow Peaks|https://picsum.photos/800/1200?random=t5-7",
     ":::POEM_SCATTERED:::Cold wind / Hot tea / The distance / Between stars",
     ":::TEXT_SINGLE_COL:::We camped by a glacial lake. We brewed thick Tibetan butter tea to keep warm.",
     ":::RECIPE_CARD:::Butter Tea|Boil brick tea strongly.|Add yak butter.|Add salt.|Churn in bamboo tube.|Serve hot.",
     ":::IMG_CIRCLE_MASK:::The Churn|https://picsum.photos/800/800?random=t5-8",
     ":::TEXT_INVERTED:::$$dark$$The stars here are terrifyingly bright.",
     ":::IMG_FULL_BLEED:::$$dark$$Milky Way|https://picsum.photos/800/1200?random=t5-9",
     ":::TEXT_TYPEWRITER:::$$dark$$Day 10: Arrival in Lhasa. The end of the road.",
     ":::IMG_FULL_BLEED_TITLE:::Lhasa|https://picsum.photos/800/1200?random=t5-10",
     ":::TEXT_SINGLE_COL:::The tea has been delivered. The journey is the destination.",
     ":::QUOTE_MINIMAL:::The road makes the tea sweeter.",
     ":::COPYRIGHT_PAGE:::Travel Log by Sarah Jenkins"
  ],
  author: PEOPLE.sarah,
};
