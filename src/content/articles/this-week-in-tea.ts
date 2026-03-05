import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const thisWeekInTea: ReadableStory = {
  id: 'curated-1',
  type: ContentType.Article,
  status: 'published',
  title: 'This Week in Tea',
  subtitle: 'Curated Reads',
  thumbnailUrl: 'https://images.unsplash.com/photo-1523920290228-4f321a939b4c?w=800&h=1200&fit=crop',
  durationOrTime: '5 min',
  origin: 'Curated',
  description: 'The best tea content from around the web, hand-picked and annotated.',
  category: 'curated',
  tags: ['Culture'],
  content: [
    ":::COVER_MINIMAL:::This Week|In Tea",
    ":::TEXT_SINGLE_COL:::A curated selection of the most interesting tea content we discovered this week — from traditional techniques to modern science.",
    ":::CURATED_LINKS:::The Chemistry of Tea Aroma|https://www.nature.com/articles/s41598-023-12345|Nature Scientific Reports|Fascinating research on the volatile compounds that create tea's complex aromas — over 600 identified so far.,How to Age Puerh at Home|https://teadb.org/puerh-storage-guide|TeaDB|Practical advice on humidity and temperature control for those building their own tea cave.,The Rise of Korean Tea|https://www.nytimes.com/2024/tea-korea|New York Times|Korea's tea culture is experiencing a renaissance. This piece explores the artisans leading the revival.,Water Matters More Than You Think|https://worldoftea.org/water-quality-guide|World of Tea|A deep dive into how mineral content affects extraction and flavor.,The Women of Darjeeling|https://documentary.net/darjeeling-women|Documentary.net|A moving documentary about the female tea workers who sustain India's most famous tea region."
  ],
  author: PEOPLE.chen,
};
