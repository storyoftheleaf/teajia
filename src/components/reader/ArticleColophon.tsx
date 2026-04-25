import React from 'react';
import { api } from '../../lib/api';
import ProductReferences from './ProductReferences';

interface ArticleColophonProps {
  articleId: string;
  fallbackTeaId?: string;
}

/**
 * Article colophon — lists teas referenced by a Magazine article.
 * Thin wrapper over `ProductReferences` so the Magazine, Learn, and
 * Advise colophons all share the same primitive.
 */
const ArticleColophon: React.FC<ArticleColophonProps> = ({ articleId, fallbackTeaId }) => (
  <ProductReferences
    sourceId={articleId}
    queryKey="article-products"
    fetcher={api.publicXref.articles}
    label="Teas in this piece"
    fallbackIds={fallbackTeaId ? [fallbackTeaId] : undefined}
  />
);

export default ArticleColophon;
