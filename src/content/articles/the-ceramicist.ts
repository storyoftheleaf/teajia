import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const theCeramicist: ReadableStory = {
  id: 'interview-2',
  type: ContentType.Article,
  status: 'published',
  title: 'The Ceramicist',
  subtitle: 'Voices in Tea',
  thumbnailUrl: 'https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=800&h=1200&fit=crop',
  durationOrTime: '24 Pages',
  origin: 'In-house',
  description: 'In conversation with young ceramic artist Liu Xin on bridging tradition and modernity.',
  category: 'interview',
  tags: ['Pottery', 'Teaware'],
  endOfArticleCTA: { type: 'consult', text: 'Adrian designs spaces like this.', linkTarget: 'consult' },
  content: [
    ":::IMG_FULL_BLEED_TITLE:::Liu Xin|https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=800&h=1200&fit=crop",
    ":::TEXT_SINGLE_COL:::Liu Xin's studio is a converted warehouse in Jingdezhen. Ancient kilns neighbor modern sculpture.",
    ":::TEXT_DOUBLE_COL:::Chen: You trained traditionally but your work is very contemporary. How do you reconcile that?\n\nLiu: Tradition isn't a prison. It's a foundation. You have to know the rules before you can break them meaningfully.",
    ":::IMG_SPLIT_VERTICAL:::The studio|https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=800&h=1200&fit=crop",
    ":::QUOTE_BIG:::Every cup is a conversation between 1000 years of tradition and this single moment.",
    ":::TEXT_SINGLE_COL:::Chen: What makes a good tea vessel?\n\nLiu: Function first. It must pour well, hold heat, feel right in the hand. Beauty comes from solving those problems elegantly.",
    ":::IMG_CIRCLE_MASK:::Work in progress|https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=800&h=800&fit=crop",
    ":::TEXT_SIDEBAR_LEFT:::On Materials|I use local clay exclusively. Each deposit has its own character. Some are smooth, some gritty. I let the clay guide the form.|https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?w=800&h=600&fit=crop",
    ":::TEXT_SINGLE_COL:::Chen: What's next for you?\n\nLiu: I'm experimenting with ash glazes from different tea plants. Imagine — the vessel made from the same earth that grew the tea.",
    ":::QUOTE_MINIMAL:::The pot and the tea should feel like they belong to each other.",
    ":::IMG_FULL_BLEED:::Finished pieces|https://images.unsplash.com/photo-1578365746405-da4f83b81b3b?w=800&h=1200&fit=crop",
    ":::COPYRIGHT_PAGE:::Interview by Chen Wei\nPhotography by Li Jun"
  ],
  author: PEOPLE.chen,
  interviewee: PEOPLE.lin,
};
