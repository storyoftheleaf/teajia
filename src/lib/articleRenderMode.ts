// src/lib/articleRenderMode.ts
import type { DbArticle } from '../types';

export type ArticleRenderMode = 'carousel_4x5' | 'immersive_scroll';

// The discriminator rides the existing `layout_template` field, no schema change.
// Only the explicit value 'immersive_scroll' opts into the new reader; everything
// else (missing, 'magazine', any legacy value) stays on the 4:5 carousel.
export function getArticleRenderMode(article: Pick<DbArticle, 'layout_template'>): ArticleRenderMode {
  return article.layout_template === 'immersive_scroll' ? 'immersive_scroll' : 'carousel_4x5';
}
