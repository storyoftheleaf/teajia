import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const caffeineInTea: ReadableStory = {
  id: 'science-3',
  type: ContentType.Article,
  status: 'published',
  title: 'Caffeine in Tea',
  subtitle: 'Myths vs. Reality',
  thumbnailUrl: 'https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=800&h=1200&fit=crop',
  durationOrTime: '16 Pages',
  origin: 'In-house',
  description: 'Separating fact from fiction about caffeine content in different tea types.',
  category: 'science',
  tags: ['Health', 'Brewing'],
  content: [
    ":::COVER_TYPOGRAPHIC:::CAFFEINE\nMYTHS",
    ":::TEXT_DROP_CAP:::You've heard it: 'Green tea has less caffeine than black tea.' It sounds logical. It's also largely wrong.",
    ":::QUOTE_BIG:::Color does not determine caffeine.",
    ":::TEXT_DOUBLE_COL:::The Myth|Lighter teas = less caffeine. Darker teas = more caffeine.\n\nThe Reality|Caffeine is affected by leaf age, growing conditions, and brewing method — not oxidation level.",
    ":::STAT_BIG_NUMBER:::35-70mg|Per Cup (varies wildly)",
    ":::TEXT_SIDEBAR_LEFT:::Bud vs. Leaf|Young buds contain MORE caffeine than mature leaves. That 'delicate' silver needle may pack more punch than robust Assam.|https://images.unsplash.com/photo-1563822249366-7b0d8e7295cf?w=800&h=600&fit=crop",
    ":::TEXT_SINGLE_COL:::Shade-growing increases caffeine. Japanese gyokuro and matcha, grown under shade covers, have significantly higher caffeine than sun-grown teas.",
    ":::DEFINITION_LARGE:::L-Theanine|An amino acid unique to tea that modulates caffeine's effects, promoting calm alertness rather than jitters.",
    ":::TEXT_DOUBLE_COL:::Coffee Comparison|A cup of coffee: 95-200mg caffeine. A cup of tea: 35-70mg. But tea's L-theanine creates a different experience — focused energy without the crash.\n\nDecaf Reality|Decaffeination removes 97% of caffeine but also strips flavor compounds. A short hot water rinse removes about 30% while preserving taste.",
    ":::RECIPE_CARD:::Lower Caffeine Tips|Use mature leaf teas|Rinse leaves briefly first|Brew at lower temperatures|Avoid young bud teas",
    ":::QUOTE_MINIMAL:::Know your tea. Know your body.",
    ":::COPYRIGHT_PAGE:::Teajia Science"
  ],
  author: PEOPLE.chen,
};
