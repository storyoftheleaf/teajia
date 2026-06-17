// src/pages/ImmersiveArticlePage.tsx
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { api } from '../lib/api';
import type { DbArticle } from '../types';
import { ReadingProgress } from '../components/immersive/ReadingProgress';
import { renderBlock } from '../components/immersive/sections';
import { ImmersiveShareCard } from '../components/immersive/ImmersiveShareCard';
import '../styles/reader-animations.css';

export default function ImmersiveArticlePage() {
  const { slug } = useParams();
  const [shareOpen, setShareOpen] = useState(false);
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
      <article className="pb-nav-gap">
        {article.blocks.map((block, i) => renderBlock(block, i, { onShare: () => setShareOpen(true) }))}
      </article>
      {shareOpen && <ImmersiveShareCard article={article} onClose={() => setShareOpen(false)} />}
    </div>
  );
}
