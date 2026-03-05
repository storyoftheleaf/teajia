import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const culinaryLeaf: ReadableStory = {
  id: 'template-6',
  type: ContentType.Article,
  status: 'published',
  title: 'Culinary Leaf',
  subtitle: 'Tea Cuisine',
  thumbnailUrl: 'https://picsum.photos/800/1200?random=t6',
  durationOrTime: '25 Pages',
  origin: 'In-house',
  description: 'A template for food and tea pairings and cooking recipes.',
  tags: ['Tasting', 'Culture', 'Brewing'],
  content: [
     ":::COVER_TYPOGRAPHIC:::TEA\n& FOOD",
     ":::TEXT_SINGLE_COL:::Tea is not just for drinking. It is a spice. An herb. A smoke.",
     ":::CHAPTER_BOLD:::01|Smoked Duck",
     ":::IMG_FULL_BLEED:::The Dish|https://picsum.photos/800/1200?random=t6-1",
     ":::TEXT_SIDEBAR_LEFT:::Why Lapsang?|The pine smoke penetrates the fat of the duck, cutting the richness and adding depth.|https://picsum.photos/600/800?random=t6-2",
     ":::RECIPE_CARD:::Smoking Method|Line wok with foil.|Mix tea, rice, sugar.|Heat until smoking.|Place duck on rack.|Seal and smoke 15 mins.",
     ":::IMG_SPLIT_VERTICAL:::Step by Step|https://picsum.photos/800/1200?random=t6-3",
     ":::TEXT_SINGLE_COL:::Slice thinly. Serve with plum sauce.",
     ":::CHAPTER_BOLD:::02|Matcha Salt",
     ":::IMG_CIRCLE_MASK:::Green Dust|https://picsum.photos/800/800?random=t6-4",
     ":::TEXT_DOUBLE_COL:::A simple finishing salt. Mix 1 part ceremonial matcha with 4 parts sea salt.\n\nPerfect for dusting over tempura or white chocolate desserts.",
     ":::IMG_GRID_MONDRIAN:::Ingredients|Mise en place|https://picsum.photos/800/800?random=t6-5|https://picsum.photos/800/800?random=t6-6",
     ":::CHAPTER_BOLD:::03|Oolong Peach",
     ":::IMG_FULL_BLEED:::Poached Peaches|https://picsum.photos/800/1200?random=t6-7",
     ":::TEXT_JUSTIFIED_NARROW:::Poach white peaches in a strong brew of Dancong Oolong. The honey fragrance of the tea amplifies the fruit.",
     ":::RECIPE_CARD:::Syrup|500ml Water|20g Honey Orchid Dancong|100g Sugar|Vanilla Bean",
     ":::IMG_QUAD_GRID:::Plating|https://picsum.photos/600/600?random=t6-8|https://picsum.photos/600/600?random=t6-9|https://picsum.photos/600/600?random=t6-10",
     ":::QUOTE_MINIMAL:::Eat your tea.",
     ":::COPYRIGHT_PAGE:::Recipes by Teajia Kitchen"
  ],
  author: PEOPLE.chen,
};
