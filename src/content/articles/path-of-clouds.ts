import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const pathOfClouds: ReadableStory = {
  id: '1',
  type: ContentType.Article,
  status: 'published',
  title: 'Path of Clouds',
  subtitle: 'Wuyi Peaks',
  thumbnailUrl: 'https://picsum.photos/600/800?random=1',
  durationOrTime: '15 min',
  origin: 'In-house',
  description: 'A visual journey through the Wuyi mountains, exploring the concept of Yan Yun.',
  tags: ['Oolong', 'China', 'Fujian', 'Sourcing'],
  content: [
    ":::COVER_MINIMAL:::Path of Clouds|Wuyi Mountains",
    ":::TEXT_DROP_CAP:::The mist clings to the limestone karsts like a lover reluctant to leave. Here in Wuyi, the air itself tastes of mineral and orchid.",
    ":::IMG_FULL_BLEED:::The Stone Breath|https://picsum.photos/800/1200?random=901",
    ":::TEXT_WITH_VIDEO:::Master Zhou demonstrates the traditional Wuyi gongfu technique passed down through generations.|dQw4w9WgXcQ|Watch the pouring ceremony|The water must be poured from height to awaken the leaves.",
    ":::TEXT_SINGLE_COL:::We met Master Zhou at the halfway pavilion. 'Tea is water,' he said, pouring a stream from a height. 'And water is the mountain's blood.'",
    ":::QUOTE_BIG:::The leaf is the boat. The water is the river.",
    ":::TEXT_WITH_VIDEO_VERTICAL:::The ancient steps wind through morning mist...|IG:C0xKHXNPjVt|A vertical journey through Wuyi|Each step brings us closer to the source.",
    ":::IMG_SPLIT_VERTICAL:::Ancient Steps|https://picsum.photos/800/1200?random=902",
    ":::TEXT_DOUBLE_COL:::History|The original Da Hong Pao bushes grow on a ledge halfway up the cliff. They stand as monuments to a time when tea was medicine.\n\nFuture|Today, they are guarded by the state. No one picks them. We look up at them from the valley floor.",
    ":::IMG_CIRCLE_MASK:::Master Zhou|https://picsum.photos/800/800?random=903",
    ":::RECIPE_CARD:::Wuyi Brewing|Use 8g leaf per 100ml.|Water at 100°C.|Rinse quickly.|Steep 10s, adding 5s each time.",
    ":::COPYRIGHT_PAGE:::Words by Chen Wei\nPhotos by Li Jun"
  ],
  author: PEOPLE.chen,
  interviewee: PEOPLE.zhou,
};
