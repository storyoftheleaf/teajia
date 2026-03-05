import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const gridStudy: ReadableStory = {
  id: 'content-display-6',
  type: ContentType.Article,
  status: 'published',
  title: 'Grid Study',
  subtitle: 'Geometric Order',
  thumbnailUrl: 'https://picsum.photos/800/1200?random=cd6',
  durationOrTime: '20 Pages',
  origin: 'Curated',
  description: 'A Bauhaus-inspired exploration of tea through strict geometric composition.',
  tags: ['Space Design', 'Philosophy'],
  content: [
    ":::COVER_TYPOGRAPHIC:::GRID|STUDY",
    ":::CHAPTER_BOLD:::01|Form",
    ":::IMG_GRID_MONDRIAN:::Structure|Composition|https://picsum.photos/800/800?random=cd6-1|https://picsum.photos/800/800?random=cd6-2",
    ":::TEXT_SIDEBAR_RIGHT:::The Grid|Order emerges from structure. Every element has its place. Nothing is arbitrary.|https://picsum.photos/600/800?random=cd6-3",
    ":::IMG_QUAD_GRID:::Four views|https://picsum.photos/600/600?random=cd6-4|https://picsum.photos/600/600?random=cd6-5|https://picsum.photos/600/600?random=cd6-6|https://picsum.photos/600/600?random=cd6-7",
    ":::TEXT_DOUBLE_COL:::Vertical Division|The page divides. Left and right. Balance through asymmetry.\n\nHorizontal Division|Top and bottom. Weight distributed. Harmony through tension.",
    ":::CHAPTER_BOLD:::02|Function",
    ":::IMG_GRID_MONDRIAN:::Process|Method|https://picsum.photos/800/800?random=cd6-8|https://picsum.photos/800/800?random=cd6-9",
    ":::TEXT_SIDEBAR_LEFT:::The Method|Form follows function. The grid serves the content. Content fills the grid.|https://picsum.photos/600/800?random=cd6-10",
    ":::IMG_QUAD_GRID:::Elements|https://picsum.photos/600/600?random=cd6-11|https://picsum.photos/600/600?random=cd6-12|https://picsum.photos/600/600?random=cd6-13|https://picsum.photos/600/600?random=cd6-14",
    ":::TEXT_DOUBLE_COL:::Typography|Type is architecture. Letters build space. Words create structure.\n\nWhite Space|Empty space is not empty. It is active. It defines the filled.",
    ":::CHAPTER_BOLD:::03|Color",
    ":::IMG_GRID_MONDRIAN:::Palette|Theory|https://picsum.photos/800/800?random=cd6-15|https://picsum.photos/800/800?random=cd6-16",
    ":::TEXT_SIDEBAR_RIGHT:::Primary Focus|Red. Yellow. Blue. The foundation. All color derives from these.|https://picsum.photos/600/800?random=cd6-17",
    ":::IMG_QUAD_GRID:::Color blocks|https://picsum.photos/600/600?random=cd6-18|https://picsum.photos/600/600?random=cd6-19|https://picsum.photos/600/600?random=cd6-20|https://picsum.photos/600/600?random=cd6-21",
    ":::CHAPTER_BOLD:::∞|Unity",
    ":::COPYRIGHT_PAGE:::Design Study by Chen Wei"
  ],
  author: PEOPLE.chen,
};
