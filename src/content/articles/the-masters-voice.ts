import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const theMastersVoice: ReadableStory = {
  id: 'template-4',
  type: ContentType.Article,
  status: 'published',
  title: 'The Master\'s Voice',
  subtitle: 'A Conversation',
  thumbnailUrl: 'https://picsum.photos/800/1200?random=t4',
  durationOrTime: '25 Pages',
  origin: 'In-house',
  description: 'A template designed for long-form interviews with portraits.',
  tags: ['Pottery', 'Teaware', 'Philosophy'],
  content: [
     ":::IMG_FULL_BLEED_TITLE:::Master Lin|https://picsum.photos/800/1200?random=t4-1",
     ":::TEXT_SINGLE_COL:::We sat down with Master Lin in his Yixing studio. The air smelled of damp clay and cigarette smoke.",
     ":::TEXT_SINGLE_COL:::Chen: When did you touch your first clay?\n\nLin: Before I could walk. My father's wheel was my playground.",
     ":::IMG_SPLIT_VERTICAL:::The Studio|https://picsum.photos/800/1200?random=t4-2",
     ":::QUOTE_BIG:::The clay speaks. You just have to learn its language.",
     ":::TEXT_DOUBLE_COL:::On Tradition|Many people think tradition is doing exactly what your grandfather did. I disagree. Tradition is a fire you must keep burning, not ashes you worship.\n\nOn Innovation|I use gas kilns now. Does that make the pot less real? The fire is still hot. The clay is still true.",
     ":::IMG_CIRCLE_MASK:::Lin's hands.|https://picsum.photos/800/800?random=t4-3",
     ":::IMG_FULL_BLEED:::Pottery Shelf|https://picsum.photos/800/1200?random=t4-4",
     ":::TEXT_SIDEBAR_LEFT:::The Zhuni Myth|Zhuni clay is almost extinct. Lin creates his own blend to mimic the porosity and heat retention of the Qing era classics.|https://picsum.photos/600/800?random=t4-5",
     ":::TEXT_SINGLE_COL:::He paused to pour tea. It was a 20-year-old puerh. Dark as ink, sweet as dates.",
     ":::IMG_VIGNETTE_SOFT:::The Pour|https://picsum.photos/800/800?random=t4-6",
     ":::IMG_FILM_STRIP_VERTICAL:::The firing process.|https://picsum.photos/600/400?random=t4-7|https://picsum.photos/600/400?random=t4-8|https://picsum.photos/600/400?random=t4-9",
     ":::TEXT_JUSTIFIED_NARROW:::We talked until the sun went down. He showed me shards of ancient pots he dug up from the hills. 'This,' he said, holding a broken spout, 'is my teacher.'",
     ":::IMG_FULL_BLEED:::Ancient Shards|https://picsum.photos/800/1200?random=t4-10",
     ":::QUOTE_MINIMAL:::We are all just students of the earth.",
     ":::TEXT_SINGLE_COL:::As I left, he gave me a small, unglazed cup. 'Feed it,' he said. 'It is hungry.'",
     ":::IMG_ARCH_MASK:::The Gift|https://picsum.photos/800/1200?random=t4-11",
     ":::EPILOGUE_CENTERED:::Master Lin continues to work in Dingshan. His pots are available in our ledger.",
     ":::COPYRIGHT_PAGE:::Interview by Chen Wei\nPhotography by Li Jun"
  ],
  author: PEOPLE.chen,
};
