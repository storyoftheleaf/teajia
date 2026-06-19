// src/pages/ImmersiveArticlePage.tsx
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { api } from '../lib/api';
import type { DbArticle } from '../types';
import { ReadingProgress } from '../components/immersive/ReadingProgress';
import { renderBlock } from '../components/immersive/sections';
import { SharePanel } from '../components/article/SharePanel';
import '../styles/reader-animations.css';

export default function ImmersiveArticlePage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [shareOpen, setShareOpen] = useState(false);

  // The immersive reader is full-bleed and escapes the app's bottom tab bar
  // (see isImmersiveRead in App.tsx), so it carries its own minimal escape:
  // a fixed back control, top-left per the panel Close convention. Browser
  // history first (preserves where the reader came from), magazine as fallback.
  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/read');
  };
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
      <button
        type="button"
        onClick={goBack}
        aria-label="Back"
        data-testid="immersive-back"
        className="tap-target fixed top-3 left-3 z-popover flex items-center gap-1.5 rounded-full bg-tea-bg/70 px-3 py-1.5 text-tea-text-sec backdrop-blur-sm transition-colors hover:text-tea-text"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
      >
        <span aria-hidden="true" className="text-ui-15 leading-none">&#8592;</span>
        <span className="text-ui-12 tracking-wide">Back</span>
      </button>
      <article className="pb-nav-gap">
        {article.blocks.map((block, i) => renderBlock(block, i, { onShare: () => setShareOpen(true) }))}
      </article>
      {shareOpen && <SharePanel page={null} article={article} onClose={() => setShareOpen(false)} />}
    </div>
  );
}
