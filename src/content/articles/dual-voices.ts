import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const dualVoices: ReadableStory = {
  id: 'content-display-9',
  type: ContentType.Article,
  status: 'published',
  title: 'Dual Voices',
  subtitle: 'East Meets West',
  thumbnailUrl: 'https://picsum.photos/800/1200?random=cd9',
  durationOrTime: '24 Pages',
  origin: 'In-house',
  description: 'Two tea experts from different traditions discuss their approaches side-by-side.',
  tags: ['Philosophy', 'Ceremony', 'Culture'],
  content: [
    ":::COVER_MINIMAL:::Dual|Voices",
    ":::TEXT_DOUBLE_COL:::Master Zhou (East)|I learned tea from my grandfather. He learned from his. The knowledge is in the blood.\n\nSarah Jenkins (West)|I learned tea from books. Then travel. Then unlearning what the books said.",
    ":::IMG_SPLIT_VERTICAL:::Two perspectives|https://picsum.photos/800/1200?random=cd9-1",
    ":::CHAPTER_SPLIT:::Water|Temperature",
    ":::TEXT_SIDEBAR_RIGHT:::Zhou's Method|I judge water by sound. When the bubbles sing like wind in pines, it is ready. No thermometer.|https://picsum.photos/600/800?random=cd9-2",
    ":::TEXT_SIDEBAR_LEFT:::Sarah's Method|I use precise temperature control. 195°F for oolong. Consistency is key to repeatable results.|https://picsum.photos/600/800?random=cd9-3",
    ":::TEXT_DOUBLE_COL:::Zhou|Science is useful. But the ear knows what the thermometer cannot measure.\n\nSarah|I agree intuition matters. But how do you teach intuition? Temperature can be taught.",
    ":::CHAPTER_SPLIT:::The|Vessel",
    ":::TEXT_SIDEBAR_LEFT:::Sarah's Preference|I use porcelain for most teas. It doesn't interfere with flavor. Clean slate.|https://picsum.photos/600/800?random=cd9-4",
    ":::TEXT_SIDEBAR_RIGHT:::Zhou's Preference|Yixing clay for oolong and puerh. The clay seasons over time. It becomes part of the tea.|https://picsum.photos/600/800?random=cd9-5",
    ":::IMG_SPLIT_VERTICAL:::Two vessels|https://picsum.photos/800/1200?random=cd9-6",
    ":::TEXT_DOUBLE_COL:::Sarah|But doesn't that mean you can't taste the tea itself? Only the tea-plus-pot?\n\nZhou|The pot is not separate from the tea. They are married. This is the tradition.",
    ":::CHAPTER_SPLIT:::Time|Ritual",
    ":::TEXT_SIDEBAR_RIGHT:::Zhou's Approach|Gongfu style. Many short infusions. 10 seconds, 15 seconds, 20 seconds. The tea unfolds slowly.|https://picsum.photos/600/800?random=cd9-7",
    ":::TEXT_SIDEBAR_LEFT:::Sarah's Approach|I adapt. Gongfu for oolong. Western brewing for breakfast tea. Different teas need different respect.|https://picsum.photos/600/800?random=cd9-8",
    ":::TEXT_DOUBLE_COL:::Zhou|There is wisdom in consistency. The same method reveals subtle differences.\n\nSarah|There is wisdom in flexibility. The method should serve the tea, not ego.",
    ":::IMG_SPLIT_VERTICAL:::Hands pouring|https://picsum.photos/800/1200?random=cd9-9",
    ":::CHAPTER_SPLIT:::Common|Ground",
    ":::TEXT_DOUBLE_COL:::Zhou & Sarah|Despite our differences, we agree on this: Tea is a conversation. Between leaf and water. Between past and present. Between people.\n\nZhou & Sarah|There is no one true way. Only your way. Find it through practice. Question everything. Taste deeply.",
    ":::QUOTE_BIG:::Dialogue is the essence of tea.",
    ":::COPYRIGHT_PAGE:::Conversation between Master Zhou Yu & Dr. Sarah Jenkins\nModerated by Chen Wei"
  ],
  author: PEOPLE.chen,
  interviewee: PEOPLE.zhou,
};
