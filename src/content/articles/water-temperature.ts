import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const waterTemperature: ReadableStory = {
  id: 'science-1',
  type: ContentType.Article,
  status: 'published',
  title: 'Water Temperature',
  subtitle: 'The Science of Heat',
  thumbnailUrl: 'https://images.unsplash.com/photo-1556909212-d5b604d0c90d?w=800&h=1200&fit=crop',
  durationOrTime: '18 Pages',
  origin: 'In-house',
  description: 'Why temperature matters: the chemistry behind extraction and flavor development.',
  category: 'science',
  tags: ['Brewing', 'Water'],
  endOfArticleCTA: { type: 'learn', text: 'We teach this in our courses.', linkTarget: 'learn' },
  content: [
    ":::COVER_TYPOGRAPHIC:::WATER\nTEMPERATURE",
    ":::TEXT_DROP_CAP:::The difference between 80°C and 100°C water might seem minor. But in tea, it's the difference between sweetness and bitterness, between delicacy and harshness.",
    ":::STAT_BIG_NUMBER:::70-85°C|Green Tea",
    ":::TEXT_DOUBLE_COL:::Catechins|These bitter, astringent compounds extract rapidly in hot water. Lower temperatures slow their release, allowing sweeter amino acids to dominate.\n\nL-Theanine|This amino acid responsible for tea's calming effect extracts at lower temperatures. Hot-brewed tea may sacrifice umami for strength.",
    ":::DEFINITION_LARGE:::Extraction (n.)|The dissolution of soluble compounds from tea leaf into water.",
    ":::IMG_SPLIT_HORIZONTAL:::Temperature comparison|https://images.unsplash.com/photo-1556909212-d5b604d0c90d?w=1200&h=800&fit=crop",
    ":::TEXT_SIDEBAR_RIGHT:::The Bubble Guide|Shrimp eyes (70°C): tiny bubbles. Crab eyes (80°C): medium bubbles. Fish eyes (85°C): large bubbles. Rolling boil (100°C): full turbulence.|https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=800&h=600&fit=crop",
    ":::STAT_BIG_NUMBER:::90-100°C|Oolong & Black",
    ":::TEXT_SINGLE_COL:::Heavily oxidized teas benefit from higher temperatures. Their catechins have been transformed during processing, reducing bitterness.",
    ":::RECIPE_CARD:::Quick Reference|Green: 70-80°C|White: 75-85°C|Oolong: 85-95°C|Black: 90-100°C|Puerh: 95-100°C",
    ":::QUOTE_MINIMAL:::Temperature is the conductor. The tea is the orchestra.",
    ":::COPYRIGHT_PAGE:::Teajia Science"
  ],
  author: PEOPLE.chen,
};
