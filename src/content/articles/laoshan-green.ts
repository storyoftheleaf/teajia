import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const laoshanGreen: ReadableStory = {
  id: 'tea-feature-1',
  type: ContentType.Article,
  status: 'published',
  title: 'Laoshan Green',
  subtitle: 'Mountain Mist Tea',
  thumbnailUrl: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=800&h=1200&fit=crop',
  durationOrTime: '20 Pages',
  origin: 'In-house',
  description: 'A rare coastal green tea from Shandong Province with unique mineral complexity.',
  category: 'tea-feature',
  isFeatured: true,
  tags: ['Green', 'Sourcing', 'China', 'Tasting'],
  featured: true,
  endOfArticleCTA: { type: 'shop', text: 'This tea is in our shop.', linkTarget: 'shop' },
  content: [
    ":::COVER_MAIN:::Laoshan Green|Mountain Mist Tea|https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=800&h=1200&fit=crop",
    ":::TEXT_DROP_CAP:::Unlike most Chinese green teas, Laoshan grows within sight of the sea. The ocean mists that blanket these mountains each morning impart a unique mineral quality found nowhere else.",
    ":::MAP_CARTOGRAPHY:::Laoshan, Shandong Province",
    ":::TEXT_SIDEBAR_RIGHT:::Terroir|The granite bedrock filters water for centuries before it reaches the tea roots. The result is a tea with remarkable structure and a hint of salt.|https://images.unsplash.com/photo-1563822249366-7b0d8e7295cf?w=800&h=1200&fit=crop",
    ":::DEFINITION_LARGE:::Hai Wei (海味)|The 'taste of the sea' — a briny, mineral quality unique to coastal teas.",
    ":::IMG_FULL_BLEED:::Morning harvest|https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=1200&fit=crop",
    ":::TEXT_DOUBLE_COL:::Flavor Profile|The first sip reveals chestnut sweetness. By the third steeping, vegetal notes emerge — spinach, artichoke. The finish is long and mineral.\n\nBrewing Notes|Use water at 80°C. This tea is forgiving but rewards attention. Lower temperatures reveal more sweetness.",
    ":::RECIPE_CARD:::Brewing Guide|5g leaf per 150ml|Water: 80°C (175°F)|First steep: 45 seconds|Add 15 seconds each round|Good for 5+ infusions",
    ":::IMG_CIRCLE_MASK:::The dry leaf|https://images.unsplash.com/photo-1563822249548-9a72b6353cd1?w=800&h=800&fit=crop",
    ":::QUOTE_BIG:::Where the mountain meets the sea, the leaf finds its voice.",
    ":::TEXT_SINGLE_COL:::Laoshan was once reserved for Taoist priests who tended the mountain temples. Today, it remains one of China's best-kept secrets.",
    ":::IMG_FULL_BLEED:::Coastal terraces|https://images.unsplash.com/photo-1523920290228-4f321a939b4c?w=800&h=1200&fit=crop",
    ":::COPYRIGHT_PAGE:::Words by Chen Wei\nTeajia Journal"
  ],
  author: PEOPLE.chen,
};
