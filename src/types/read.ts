import { Story } from '../types';
import { Tag, ArticleTagMeta } from '../data/tags';

/**
 * An article enriched with tag metadata for the Read section.
 * Merges the Story data with the tag mapping at runtime.
 */
export interface ReadArticle extends Story {
  tags: Tag[];
  featured: boolean;
  startHere: boolean;
  endOfArticleCTA?: {
    type: 'shop' | 'learn' | 'consult';
    text: string;
    linkTarget: string;
  };
}

/**
 * Cross-link reference to related content across sections.
 */
export interface CrossLink {
  type: 'article' | 'product' | 'course' | 'glossary' | 'consult';
  id: string;
  title: string;
  linkTarget: string;
}

/**
 * Props for the end-of-article section.
 */
export interface EndOfArticleProps {
  article: ReadArticle;
  relatedArticles: CrossLink[];
  onNavigateToArticle: (id: string) => void;
}

/**
 * Merge a Story with its tag metadata to create a ReadArticle.
 */
/**
 * Merge a Story with its tag metadata to create a ReadArticle.
 */
export function toReadArticle(story: Story, meta?: ArticleTagMeta): ReadArticle {
  return {
    ...story,
    tags: meta?.tags ?? [],
    featured: meta?.featured ?? false,
    startHere: meta?.startHere ?? false,
    endOfArticleCTA: meta?.endOfArticleCTA,
  };
}

/**
 * Type for article data files — same as ReadArticle but with optional featured/startHere
 * since not all article files specify these fields.
 */
export interface ReadableStory extends Story {
  tags: Tag[];
  featured?: boolean;
  startHere?: boolean;
  endOfArticleCTA?: {
    type: 'shop' | 'learn' | 'consult';
    text: string;
    linkTarget: string;
  };
}
