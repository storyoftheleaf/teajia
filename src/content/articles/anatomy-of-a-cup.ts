import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const anatomyOfACup: ReadableStory = {
  id: 'content-display-4',
  type: ContentType.Article,
  status: 'published',
  title: 'Anatomy of a Cup',
  subtitle: 'Technical Analysis',
  thumbnailUrl: 'https://picsum.photos/800/1200?random=cd4',
  durationOrTime: '20 Pages',
  origin: 'In-house',
  description: 'A scientific breakdown of what happens inside a teacup.',
  tags: ['Brewing', 'Tasting', 'Health'],
  content: [
    ":::COVER_TYPOGRAPHIC:::ANATOMY|OF A CUP",
    ":::DEFINITION_LARGE:::Infusion (n.)\nThe process by which soluble compounds transfer from solid leaf to liquid water.",
    ":::TEXT_DOUBLE_COL:::Temperature|Water temperature determines extraction rate. Hotter water pulls more compounds faster, but can damage delicate leaves.\n\nTime|Steep duration is the second variable. Longer time means more extraction, but also more bitterness from later-releasing tannins.",
    ":::STAT_BIG_NUMBER:::195°F|Optimal Green Tea",
    ":::IMG_CIRCLE_MASK:::Leaf unfurling|https://picsum.photos/800/800?random=cd4-1",
    ":::TEXT_DOUBLE_COL:::Section 1: The Leaf|Tea leaves are tightly rolled or folded. Hot water causes them to unfurl, releasing trapped moisture and compounds.\n\nSection 2: The Water|Pure water is essential. Minerals affect pH and taste. Hard water dulls flavor. Soft water amplifies it.",
    ":::STAT_BIG_NUMBER:::30|Seconds First Steep",
    ":::IMG_FILM_STRIP_VERTICAL:::Extraction sequence|https://picsum.photos/600/400?random=cd4-2|https://picsum.photos/600/400?random=cd4-3|https://picsum.photos/600/400?random=cd4-4",
    ":::DEFINITION_LARGE:::Polyphenol (n.)\nA class of organic compounds that contribute to astringency and antioxidant properties.",
    ":::TEXT_DOUBLE_COL:::Color Formation|The color of the tea liquor comes from dissolved pigments. Green teas release chlorophyll. Black teas release theaflavins and thearubigins.\n\nAroma Compounds|Over 600 volatile compounds contribute to tea aroma. They evaporate quickly, which is why fresh tea smells strongest.",
    ":::IMG_CIRCLE_MASK:::Color spectrum|https://picsum.photos/800/800?random=cd4-5",
    ":::STAT_BIG_NUMBER:::600+|Aroma Molecules",
    ":::IMG_FILM_STRIP_VERTICAL:::Color development|https://picsum.photos/600/400?random=cd4-6|https://picsum.photos/600/400?random=cd4-7|https://picsum.photos/600/400?random=cd4-8",
    ":::TEXT_DOUBLE_COL:::Taste Perception|What we call 'taste' is actually a combination of taste (bitter, sweet, umami), aroma, temperature, and texture.\n\nThe Science|Bitter compounds activate receptors on the back of the tongue. Sweetness is detected at the tip. Umami receptors respond to amino acids like L-theanine.",
    ":::DEFINITION_LARGE:::L-Theanine (n.)\nAn amino acid unique to tea that promotes calm focus and balances caffeine's stimulation.",
    ":::IMG_CIRCLE_MASK:::Microscopic view|https://picsum.photos/800/800?random=cd4-9",
    ":::STAT_BIG_NUMBER:::40mg|Caffeine per Cup",
    ":::COPYRIGHT_PAGE:::Teajia Science Department"
  ],
  author: PEOPLE.chen,
};
