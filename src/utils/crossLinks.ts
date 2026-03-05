import { Tag } from '../data/tags';
import { CrossLink } from '../types/read';

interface ArticleSummary {
  id: string;
  tags: Tag[];
  title: string;
}

/**
 * Find articles related to the given tags, excluding a specific article.
 * Prioritizes unread articles, then sorts by tag overlap count.
 */
export function getRelatedArticles(
  currentTags: Tag[],
  excludeId: string,
  allArticles: ArticleSummary[],
  readArticleIds: Set<string>,
  limit: number = 4
): CrossLink[] {
  return allArticles
    .filter(a => a.id !== excludeId)
    .map(a => ({
      ...a,
      overlap: a.tags.filter(t => currentTags.includes(t)).length,
      isRead: readArticleIds.has(a.id)
    }))
    .filter(a => a.overlap > 0)
    .sort((a, b) => {
      // Unread first
      if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
      // Then by tag overlap
      return b.overlap - a.overlap;
    })
    .slice(0, limit)
    .map(a => ({
      type: 'article' as const,
      id: a.id,
      title: a.title,
      linkTarget: a.id
    }));
}
