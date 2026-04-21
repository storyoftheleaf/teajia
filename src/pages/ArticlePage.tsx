import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { DbArticle, ArticleBlock } from '../admin/types';

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(iso?: string): string {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

// ── Block renderers ────────────────────────────────────────────────────────────

function renderBlock(block: ArticleBlock, idx: number): React.ReactNode {
  switch (block.type) {
    case 'intro':
      return (
        <p
          key={idx}
          className="text-tea-text leading-relaxed mb-6"
          style={{ fontSize: 17 }}
        >
          {block.text}
        </p>
      );

    case 'paragraph':
      return (
        <p
          key={idx}
          className="text-tea-text-sec leading-relaxed mb-5"
          style={{ fontSize: 15 }}
        >
          {block.text}
        </p>
      );

    case 'section_heading':
      return (
        <h2
          key={idx}
          className="font-serif text-tea-text mt-8 mb-3"
          style={{ fontSize: 20 }}
        >
          {block.text}
        </h2>
      );

    case 'quote':
      return (
        <blockquote
          key={idx}
          className="border-l-2 border-tea-gold pl-4 italic text-tea-text-sec my-6"
        >
          <p style={{ fontSize: 16 }}>{block.text}</p>
          {block.attribution && (
            <cite className="block not-italic text-tea-text-dim mt-2" style={{ fontSize: 12 }}>
              {block.attribution}
            </cite>
          )}
        </blockquote>
      );

    case 'image':
      if (!block.url) return null;
      return (
        <figure key={idx} className="my-6">
          <img
            src={block.url}
            alt={block.description || ''}
            loading="lazy"
            className="w-full rounded-sm"
          />
          {block.caption && (
            <figcaption className="text-tea-text-dim mt-1.5" style={{ fontSize: 11 }}>
              {block.caption}
            </figcaption>
          )}
        </figure>
      );

    case 'divider':
      return <hr key={idx} className="border-tea-border my-8" />;

    default:
      return null;
  }
}

// ── Loading Skeleton ───────────────────────────────────────────────────────────

function ArticleSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-10 animate-pulse">
      <div className="h-3 w-32 bg-tea-elevated rounded mb-8" />
      <div className="h-64 w-full bg-tea-surface rounded-sm mb-8" />
      <div className="h-8 w-3/4 bg-tea-surface rounded mb-3" />
      <div className="h-5 w-1/2 bg-tea-elevated rounded mb-8" />
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="h-4 w-full bg-tea-elevated rounded mb-3" />
      ))}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function ArticlePage() {
  const { slug } = useParams<{ slug: string }>();

  const { data: article, isLoading, isError } = useQuery<DbArticle>({
    queryKey: ['article', slug],
    queryFn: () => api.articles.getBySlug(slug as string),
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (isLoading) return <ArticleSkeleton />;

  if (isError || !article) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-10 text-center">
        <p className="font-serif text-xl italic text-tea-text mb-3">Article not found</p>
        <p className="text-tea-text-sec text-sm mb-8">
          This article may have been removed or the link is incorrect.
        </p>
        <Link to="/magazine" className="text-tea-text-sec hover:text-tea-text text-sm transition-colors">
          ← Back to Journal
        </Link>
      </div>
    );
  }

  const displayDate = formatDate(article.published_at ?? article.created_at);

  return (
    <>
      <Helmet>
        <title>{article.title} — Teajia</title>
        {article.subtitle && <meta name="description" content={article.subtitle} />}
      </Helmet>

      <article
        className="pb-[calc(1rem+44px+env(safe-area-inset-bottom,0px))] lg:pb-10"
        style={{ maxWidth: '42rem', margin: '0 auto', padding: '0 1.5rem 0' }}
      >
        {/* Back link */}
        <div className="pt-5 pb-4">
          <Link
            to="/magazine"
            className="inline-flex items-center gap-1.5 text-tea-text-sec hover:text-tea-text transition-colors text-sm"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Read
          </Link>
        </div>

        {/* Cover image */}
        {article.cover_image_url && (
          <div className="w-full overflow-hidden rounded-sm mb-8" style={{ aspectRatio: '16/9' }}>
            <img
              src={article.cover_image_url}
              alt={article.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Header */}
        <header className="mb-8">
          {article.category && (
            <div
              className="mb-3"
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: 10.5,
                fontWeight: 400,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: 'var(--tea-gold)',
              }}
            >
              {article.category}
            </div>
          )}
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontStyle: 'italic',
              fontWeight: 400,
              fontSize: 'clamp(28px, 8vw, 40px)',
              lineHeight: 1.05,
              letterSpacing: '-0.01em',
              color: 'var(--tea-text)',
              margin: '0 0 12px',
            }}
          >
            {article.title}
          </h1>
          {article.subtitle && (
            <p
              className="text-tea-text-sec"
              style={{ fontSize: 17, lineHeight: 1.5, margin: '0 0 16px' }}
            >
              {article.subtitle}
            </p>
          )}
          <div
            className="flex items-center gap-3 text-tea-text-dim"
            style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.04em' }}
          >
            {article.author_id && <span>{article.author_id}</span>}
            {article.author_id && displayDate && <span>·</span>}
            {displayDate && <span>{displayDate}</span>}
            {article.reading_time_mins && (
              <>
                <span>·</span>
                <span>{article.reading_time_mins} min read</span>
              </>
            )}
          </div>
        </header>

        {/* Divider */}
        <hr className="border-tea-border mb-8" />

        {/* Body blocks */}
        <div>
          {(article.blocks ?? []).map((block, idx) => renderBlock(block, idx))}
        </div>

        {/* Footer back link */}
        <div className="mt-12 pt-6 border-t border-tea-border">
          <Link
            to="/magazine"
            className="inline-flex items-center gap-1.5 text-tea-text-sec hover:text-tea-text transition-colors text-sm"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back to Journal
          </Link>
        </div>
      </article>
    </>
  );
}
