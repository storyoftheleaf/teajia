import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const theTeaFarmer: ReadableStory = {
  id: 'interview-1',
  type: ContentType.Article,
  status: 'published',
  title: 'The Tea Farmer',
  subtitle: 'Voices in Tea',
  thumbnailUrl: 'https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?w=800&h=1200&fit=crop',
  durationOrTime: '25 Pages',
  origin: 'In-house',
  description: 'A conversation with Wang Mei, third-generation tea farmer from Fujian Province.',
  category: 'interview',
  tags: ['Oolong', 'Sourcing', 'Fujian'],
  content: [
    ":::IMG_FULL_BLEED_TITLE:::Wang Mei|https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?w=800&h=1200&fit=crop",
    ":::TEXT_SINGLE_COL:::We met Wang Mei at her family's tea garden in Anxi County. The sun was setting behind the tiered hillsides.",
    ":::TEXT_DOUBLE_COL:::Chen: When did you first learn to make tea?\n\nWang: I was five. My grandmother would let me help sort leaves. I thought it was a game.\n\nChen: What changed?\n\nWang: When I was twelve, I tasted my first truly great Tieguanyin. My grandmother's 1995 vintage. That's when I understood this wasn't just farming.",
    ":::QUOTE_BIG:::Tea farming is a conversation with the land that lasts generations.",
    ":::IMG_SPLIT_VERTICAL:::The family garden|https://images.unsplash.com/photo-1563822249366-7b0d8e7295cf?w=800&h=1200&fit=crop",
    ":::TEXT_SINGLE_COL:::Chen: How has the industry changed?\n\nWang: Speed. Everyone wants faster production. But great tea cannot be rushed. The shaking, the oxidation, the roasting — each step has its own time.",
    ":::IMG_CIRCLE_MASK:::Wang's hands|https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=800&h=800&fit=crop",
    ":::TEXT_SIDEBAR_RIGHT:::On Climate|The rains come later now. Summers are hotter. We're adapting, but the old recipes don't always work anymore.|https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=600&fit=crop",
    ":::TEXT_SINGLE_COL:::Chen: What do you hope for the future?\n\nWang: That my daughter will want to continue. That the land will still be healthy. That people will still appreciate slow things.",
    ":::QUOTE_MINIMAL:::The best tea is made by those who love the waiting.",
    ":::IMG_FULL_BLEED:::Evening in Anxi|https://images.unsplash.com/photo-1523920290228-4f321a939b4c?w=800&h=1200&fit=crop",
    ":::COPYRIGHT_PAGE:::Interview by Chen Wei\nPhotography by Li Jun"
  ],
  author: PEOPLE.chen,
};
