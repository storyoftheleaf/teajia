// src/pages/ImmersiveArticlePage.tsx
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { api } from '../lib/api';
import type { DbArticle } from '../types';
import { ReadingProgress } from '../components/immersive/ReadingProgress';
import { renderBlock } from '../components/immersive/sections';

export default function ImmersiveArticlePage() {
  const { slug } = useParams();
  const { data: article, isLoading, isError } = useQuery<DbArticle>({
    queryKey: ['article', slug],
    queryFn: () => api.articles.getBySlug(slug as string),
    enabled: !!slug,
  });

  if (isLoading) return <div className="min-h-[100dvh] bg-tea-bg" data-testid="immersive-loading" />;
  if (isError || !article) return <div className="min-h-[100dvh] bg-tea-bg flex items-center justify-center text-tea-text-dim">Article not found</div>;

  return (
    <div className="bg-tea-bg text-tea-text min-h-[100dvh]" data-testid="immersive-article">
      <Helmet><title>{article.title} · Teajia</title></Helmet>
      <ReadingProgress />
      <article>
        {article.blocks.map((block, i) => renderBlock(block, i))}
      </article>
    </div>
  );
}
