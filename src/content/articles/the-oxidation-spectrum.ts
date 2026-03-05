import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const theOxidationSpectrum: ReadableStory = {
  id: 'science-2',
  type: ContentType.Article,
  status: 'published',
  title: 'The Oxidation Spectrum',
  subtitle: 'From Green to Black',
  thumbnailUrl: 'https://images.unsplash.com/photo-1517329782449-810562a4ec2f?w=800&h=1200&fit=crop',
  durationOrTime: '22 Pages',
  origin: 'In-house',
  description: 'How controlled oxidation creates the vast diversity of tea types from a single plant.',
  category: 'science',
  tags: ['Origins', 'Tasting'],
  content: [
    ":::COVER_MINIMAL:::The Oxidation|Spectrum",
    ":::TEXT_DROP_CAP:::All tea comes from one plant: Camellia sinensis. What transforms it into green, oolong, or black is oxidation — the same process that browns a cut apple.",
    ":::STAT_BIG_NUMBER:::0-5%|Green Tea",
    ":::TEXT_SINGLE_COL:::Green tea is heat-treated immediately after harvest to halt oxidation. The enzymes responsible for browning are deactivated, preserving the fresh, vegetal character.",
    ":::IMG_SPLIT_VERTICAL:::Fresh leaves|https://images.unsplash.com/photo-1563822249548-9a72b6353cd1?w=800&h=1200&fit=crop",
    ":::STAT_BIG_NUMBER:::15-85%|Oolong",
    ":::TEXT_DOUBLE_COL:::Light Oolong|Floral, creamy, reminiscent of spring. Tieguanyin and High Mountain oolongs fall here.\n\nDark Oolong|Roasted, fruity, complex. Da Hong Pao and aged oolongs live in this range.",
    ":::DEFINITION_LARGE:::Polyphenol Oxidase|The enzyme that catalyzes oxidation when cell walls are damaged by rolling or bruising.",
    ":::STAT_BIG_NUMBER:::85-100%|Black Tea",
    ":::TEXT_SINGLE_COL:::Fully oxidized teas develop malty, honeyed, and sometimes smoky notes. The catechins transform into theaflavins and thearubigins — compounds that give black tea its color and body.",
    ":::IMG_FULL_BLEED:::Oxidation in progress|https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=1200&fit=crop",
    ":::QUOTE_BIG:::Same leaf. Infinite possibilities.",
    ":::COPYRIGHT_PAGE:::Teajia Science"
  ],
  author: PEOPLE.chen,
};
