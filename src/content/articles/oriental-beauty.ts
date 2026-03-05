import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const orientalBeauty: ReadableStory = {
  id: 'tea-feature-2',
  type: ContentType.Article,
  status: 'published',
  title: 'Oriental Beauty',
  subtitle: 'The Bug-Bitten Wonder',
  thumbnailUrl: 'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=800&h=1200&fit=crop',
  durationOrTime: '22 Pages',
  origin: 'In-house',
  description: 'A Taiwanese oolong whose legendary flavor comes from an unlikely partnership with insects.',
  category: 'tea-feature',
  isFeatured: false,
  tags: ['Oolong', 'Taiwan', 'Tasting'],
  content: [
    ":::COVER_MAIN:::Oriental Beauty|東方美人|https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=800&h=1200&fit=crop",
    ":::TEXT_DROP_CAP:::Queen Elizabeth II named it 'Oriental Beauty.' The Taiwanese call it Bai Hao. But its secret lies in something the farmers once considered a disaster: tiny green leafhoppers.",
    ":::IMG_SPLIT_VERTICAL:::The characteristic tips|https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=1200&fit=crop",
    ":::TEXT_SIDEBAR_LEFT:::The Leafhopper Effect|When Jacobiasca formosana bites the leaf, the plant releases terpenes as a defense. We taste these as honey and muscatel grape.|https://images.unsplash.com/photo-1563822249366-7b0d8e7295cf?w=800&h=600&fit=crop",
    ":::STAT_BIG_NUMBER:::70%|Oxidation Level",
    ":::TEXT_DOUBLE_COL:::Appearance|Look for the distinctive white tips among amber and copper leaves. The more tips, the higher the grade.\n\nFlavor|Honey, ripe peach, and muscatel grape. The finish is cooling, almost mentholated.",
    ":::IMG_FULL_BLEED:::Hsinchu County gardens|https://images.unsplash.com/photo-1545069122-7236651d5c7e?w=800&h=1200&fit=crop",
    ":::RECIPE_CARD:::Brewing Guide|5g leaf per 150ml|Water: 90°C (195°F)|First steep: 60 seconds|Western style works well|No bitterness even overbrewed",
    ":::QUOTE_MINIMAL:::Nature's accidents become our treasures.",
    ":::TEXT_SINGLE_COL:::Farmers who produce Oriental Beauty must forgo pesticides entirely. The leafhoppers are essential partners, not pests.",
    ":::IMG_ARCH_MASK:::Traditional processing|https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=800&h=1200&fit=crop",
    ":::COPYRIGHT_PAGE:::Words by Chen Wei\nTeajia Journal"
  ],
  author: PEOPLE.chen,
};
