import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { DbArticle, ArticleBlock } from '../admin/types';

// ─────────────────────────────────────────────────────────────────────────────
//  Article Pages Reader — 4:5 paginated, Instagram + book ready.
//
//  Every page is rendered inside a strict 4:5 frame so a screenshot at
//  1080×1350 is shippable without any export step. The on-screen reader
//  swipes horizontally between pages and never scrolls vertically.
// ─────────────────────────────────────────────────────────────────────────────

const T = {
  bg: 'var(--tea-bg)',
  surface: 'var(--tea-surface)',
  text: 'var(--tea-text)',
  textSec: 'var(--tea-text-sec)',
  textDim: 'var(--tea-text-dim)',
  gold: 'var(--tea-gold)',
  border: 'var(--tea-border)',
  display: 'var(--font-display)',
  body: 'var(--font-body)',
  ui: 'var(--font-sans)',
  mono: 'var(--font-mono)',
} as const;

// Page-frame dimensions — 4:5 portrait, Instagram canonical
const PAGE_W = 1080;
const PAGE_H = 1350;
const FRAME_MAX_W = 540;   // desktop max width
const FRAME_MAX_H = 675;   // desktop max height (4:5 of 540)

// Content pagination tuning — tested against Cormorant Garamond + Lora
const MAX_CHARS_PER_BODY_PAGE = 520;

// ─── Page model ──────────────────────────────────────────────────────────────

type Page =
  | { kind: 'cover'; title: string; subtitle?: string; coverImage?: string; category?: string; mark?: string }
  | { kind: 'masthead'; intro: string; author?: string; date?: string; readingTime?: number }
  | { kind: 'body'; head: string; paragraphs: string[]; pageNum: number; pageTotal: number }
  | { kind: 'section'; title: string; numeral: string }
  | { kind: 'quote'; text: string; attribution?: string }
  | { kind: 'image'; url: string; caption?: string; alt: string }
  | { kind: 'colophon'; title: string; author?: string; date?: string; category?: string }
  | { kind: 'end'; title: string };

// ─── Pagination ──────────────────────────────────────────────────────────────

function formatDate(iso?: string): string {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatAuthor(authorId?: string): string | undefined {
  if (!authorId) return undefined;
  if (/^[0-9a-f]{8}-/i.test(authorId)) return undefined;
  return authorId.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function chunkParagraphs(paragraphs: string[], max: number): string[][] {
  const out: string[][] = [];
  let bucket: string[] = [];
  let chars = 0;
  for (const p of paragraphs) {
    if (bucket.length && chars + p.length > max) {
      out.push(bucket);
      bucket = [];
      chars = 0;
    }
    // single paragraph longer than max — split on sentence boundaries
    if (p.length > max) {
      const sentences = p.match(/[^.!?]+[.!?]+\s*|[^.!?]+$/g) ?? [p];
      let sub: string[] = [];
      let subChars = 0;
      for (const s of sentences) {
        if (sub.length && subChars + s.length > max) {
          out.push([sub.join('').trim()]);
          sub = [];
          subChars = 0;
        }
        sub.push(s);
        subChars += s.length;
      }
      if (sub.length) {
        bucket = [sub.join('').trim()];
        chars = bucket[0].length;
      }
      continue;
    }
    bucket.push(p);
    chars += p.length;
  }
  if (bucket.length) out.push(bucket);
  return out;
}

function buildPages(article: DbArticle): Page[] {
  const pages: Page[] = [];
  const author = formatAuthor(article.author_id);
  const date = formatDate(article.published_at ?? article.created_at);

  // 1. Cover
  pages.push({
    kind: 'cover',
    title: article.title,
    subtitle: article.subtitle,
    coverImage: article.cover_image_url,
    category: article.category,
    mark: '茶',
  });

  // 2. Masthead — only if there is an intro to set the tone
  const intro = article.blocks?.find(b => b.type === 'intro');
  if (intro && 'text' in intro) {
    pages.push({
      kind: 'masthead',
      intro: intro.text,
      author,
      date,
      readingTime: article.reading_time_mins,
    });
  }

  // 3. Body — convert blocks into a stream, breaking on section_heading / quote / image / divider
  let paragraphBucket: string[] = [];
  let sectionCount = 0;
  const numerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

  const flushBody = () => {
    if (!paragraphBucket.length) return;
    const chunks = chunkParagraphs(paragraphBucket, MAX_CHARS_PER_BODY_PAGE);
    chunks.forEach((chunk, i) => {
      pages.push({
        kind: 'body',
        head: article.title,
        paragraphs: chunk,
        pageNum: i + 1,
        pageTotal: chunks.length,
      });
    });
    paragraphBucket = [];
  };

  (article.blocks ?? []).forEach((block: ArticleBlock) => {
    switch (block.type) {
      case 'intro':
        // already used on masthead — skip from body stream
        return;
      case 'paragraph':
        paragraphBucket.push(block.text);
        return;
      case 'section_heading':
        flushBody();
        sectionCount++;
        pages.push({
          kind: 'section',
          numeral: numerals[sectionCount - 1] ?? String(sectionCount),
          title: block.text,
        });
        return;
      case 'quote':
        flushBody();
        pages.push({ kind: 'quote', text: block.text, attribution: block.attribution });
        return;
      case 'image':
        if (!block.url) return;
        flushBody();
        pages.push({
          kind: 'image',
          url: block.url,
          caption: block.caption,
          alt: block.description || '',
        });
        return;
      case 'divider':
        flushBody();
        return;
    }
  });
  flushBody();

  // 4. Colophon
  pages.push({
    kind: 'colophon',
    title: article.title,
    author,
    date,
    category: article.category,
  });

  // 5. End
  pages.push({ kind: 'end', title: article.title });

  return pages;
}

// ─── Frame ───────────────────────────────────────────────────────────────────
//  Strict 4:5. Hybrid behavior:
//    - Phone (≤767px): full-bleed. Page IS the screen. No shadow, no radius.
//    - Tablet/desktop (≥768px): inset, floating sheet on grain backdrop.

const FRAME_STYLES = `
  .article-page-outer {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    padding: 0;
  }
  .article-page-frame {
    position: relative;
    aspect-ratio: ${PAGE_W} / ${PAGE_H};
    width: 100%;
    max-width: 100vw;
    max-height: 100%;
    overflow: hidden;
    border-radius: 0;
    box-shadow: none;
  }
  @media (min-width: 768px) {
    .article-page-outer {
      padding: clamp(16px, 3vw, 40px);
    }
    .article-page-frame {
      max-width: ${FRAME_MAX_W}px;
      max-height: ${FRAME_MAX_H}px;
      border-radius: 2px;
      box-shadow:
        0 20px 60px rgba(0, 0, 0, 0.5),
        0 4px 12px rgba(0, 0, 0, 0.3),
        inset 0 1px 0 rgba(200, 170, 120, 0.06);
    }
  }
  .article-page-grain {
    position: absolute;
    inset: 0;
    opacity: 0.05;
    pointer-events: none;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    background-size: 180px;
    mix-blend-mode: overlay;
  }
`;

const PageFrame: React.FC<{ children: React.ReactNode; backgroundImage?: string }> = ({
  children,
  backgroundImage,
}) => (
  <div className="article-page-outer">
    <div
      className="article-page-frame"
      style={{
        background: backgroundImage ? `url("${backgroundImage}") center/cover` : T.bg,
      }}
    >
      <div aria-hidden="true" className="article-page-grain" />
      {children}
    </div>
  </div>
);

// ─── Page renderers ──────────────────────────────────────────────────────────

const PageInner: React.FC<{ children: React.ReactNode; padded?: boolean }> = ({ children, padded = true }) => (
  <div
    style={{
      position: 'relative',
      zIndex: 1,
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      padding: padded ? 'clamp(20px, 4.5%, 38px)' : 0,
      boxSizing: 'border-box',
    }}
  >
    {children}
  </div>
);

const Watermark: React.FC = () => (
  <div
    aria-hidden="true"
    style={{
      position: 'absolute',
      bottom: 'clamp(12px, 2.4%, 22px)',
      left: 0,
      right: 0,
      display: 'flex',
      justifyContent: 'center',
      pointerEvents: 'none',
      zIndex: 2,
    }}
  >
    <span
      style={{
        fontFamily: T.display,
        fontWeight: 500,
        fontSize: 'clamp(8.5px, 1.05%, 11px)',
        letterSpacing: '0.32em',
        textTransform: 'uppercase',
        color: T.textDim,
        opacity: 0.55,
      }}
    >
      Teajia
    </span>
  </div>
);

const CoverPage: React.FC<{ page: Extract<Page, { kind: 'cover' }> }> = ({ page }) => (
  <PageFrame>
    {page.coverImage && (
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url("${page.coverImage}")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 0.55,
          filter: 'saturate(0.85)',
        }}
      />
    )}
    {/* warm gradient veil */}
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        background:
          'linear-gradient(180deg, rgba(24,19,14,0.4) 0%, rgba(24,19,14,0.55) 50%, rgba(24,19,14,0.85) 100%)',
      }}
    />
    <PageInner>
      <div style={{ flex: 1 }} />
      {page.category && (
        <div
          style={{
            fontFamily: T.display,
            fontWeight: 500,
            fontSize: 'clamp(10px, 1.4%, 13px)',
            letterSpacing: '0.36em',
            textTransform: 'uppercase',
            color: T.gold,
            marginBottom: 'clamp(10px, 1.6%, 16px)',
            opacity: 0.85,
          }}
        >
          {page.category}
        </div>
      )}
      <h1
        style={{
          fontFamily: T.display,
          fontStyle: 'italic',
          fontWeight: 400,
          fontSize: 'clamp(28px, 6.4%, 56px)',
          lineHeight: 1.04,
          letterSpacing: '-0.012em',
          color: T.text,
          margin: 0,
        }}
      >
        {page.title}
      </h1>
      {page.subtitle && (
        <p
          style={{
            fontFamily: T.body,
            fontStyle: 'italic',
            fontSize: 'clamp(14px, 1.95%, 19px)',
            lineHeight: 1.4,
            color: T.textSec,
            marginTop: 'clamp(10px, 1.4%, 14px)',
            marginBottom: 0,
          }}
        >
          {page.subtitle}
        </p>
      )}
      {page.mark && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 'clamp(20px, 4.5%, 38px)',
            right: 'clamp(20px, 4.5%, 38px)',
            fontFamily: T.display,
            fontSize: 'clamp(40px, 6%, 64px)',
            color: T.gold,
            opacity: 0.35,
            lineHeight: 1,
          }}
        >
          {page.mark}
        </div>
      )}
    </PageInner>
    <Watermark />
  </PageFrame>
);

const MastheadPage: React.FC<{ page: Extract<Page, { kind: 'masthead' }> }> = ({ page }) => (
  <PageFrame>
    <PageInner>
      <div
        aria-hidden="true"
        style={{
          fontFamily: T.display,
          fontSize: 'clamp(34px, 5%, 48px)',
          color: T.gold,
          opacity: 0.5,
          lineHeight: 0.8,
          marginBottom: 'clamp(8px, 1.2%, 12px)',
        }}
      >
        &ldquo;
      </div>
      <p
        style={{
          fontFamily: T.body,
          fontWeight: 400,
          fontStyle: 'italic',
          fontSize: 'clamp(15px, 2.05%, 20px)',
          lineHeight: 1.5,
          color: T.text,
          margin: 0,
        }}
      >
        {page.intro}
      </p>
      <div style={{ flex: 1 }} />
      <div
        style={{
          fontFamily: T.mono,
          fontSize: 'clamp(9.5px, 1.05%, 11px)',
          letterSpacing: '0.08em',
          color: T.textDim,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        {page.author && <span>By {page.author}</span>}
        <span>
          {page.date}
          {page.readingTime && ` · ${page.readingTime} min`}
        </span>
      </div>
    </PageInner>
    <Watermark />
  </PageFrame>
);

const BodyPage: React.FC<{ page: Extract<Page, { kind: 'body' }> }> = ({ page }) => (
  <PageFrame>
    <PageInner>
      <div
        style={{
          fontFamily: T.display,
          fontStyle: 'italic',
          fontWeight: 400,
          fontSize: 'clamp(11px, 1.25%, 13px)',
          letterSpacing: '0.04em',
          color: T.textDim,
          marginBottom: 'clamp(14px, 2.2%, 22px)',
          paddingBottom: 'clamp(10px, 1.4%, 14px)',
          borderBottom: `1px solid ${T.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, paddingRight: 12 }}>
          {page.head}
        </span>
        <span style={{ fontFamily: T.mono, fontStyle: 'normal', fontSize: 'clamp(9px, 1%, 10px)', flexShrink: 0 }}>
          {String(page.pageNum).padStart(2, '0')} / {String(page.pageTotal).padStart(2, '0')}
        </span>
      </div>
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 'clamp(10px, 1.6%, 16px)',
          overflow: 'hidden',
        }}
      >
        {page.paragraphs.map((p, i) => (
          <p
            key={i}
            style={{
              fontFamily: T.body,
              fontWeight: 400,
              fontSize: 'clamp(13.5px, 1.7%, 17px)',
              lineHeight: 1.62,
              color: T.text,
              margin: 0,
            }}
          >
            {p}
          </p>
        ))}
      </div>
    </PageInner>
    <Watermark />
  </PageFrame>
);

const SectionPage: React.FC<{ page: Extract<Page, { kind: 'section' }> }> = ({ page }) => (
  <PageFrame>
    <PageInner>
      <div style={{ flex: 1 }} />
      <div
        style={{
          fontFamily: T.display,
          fontWeight: 300,
          fontSize: 'clamp(60px, 11%, 120px)',
          color: T.gold,
          opacity: 0.75,
          lineHeight: 1,
          letterSpacing: '0.04em',
        }}
      >
        {page.numeral}
      </div>
      <div
        aria-hidden="true"
        style={{
          width: 56,
          height: 1,
          background: T.border,
          margin: 'clamp(16px, 2.4%, 22px) 0',
        }}
      />
      <h2
        style={{
          fontFamily: T.display,
          fontStyle: 'italic',
          fontWeight: 400,
          fontSize: 'clamp(22px, 3.4%, 34px)',
          lineHeight: 1.15,
          color: T.text,
          margin: 0,
          maxWidth: '85%',
        }}
      >
        {page.title}
      </h2>
      <div style={{ flex: 1.4 }} />
    </PageInner>
    <Watermark />
  </PageFrame>
);

const QuotePage: React.FC<{ page: Extract<Page, { kind: 'quote' }> }> = ({ page }) => (
  <PageFrame>
    <PageInner>
      <div style={{ flex: 1 }} />
      <div
        aria-hidden="true"
        style={{
          fontFamily: T.display,
          fontSize: 'clamp(64px, 10%, 110px)',
          color: T.gold,
          opacity: 0.4,
          lineHeight: 0.7,
          marginBottom: 'clamp(8px, 1%, 12px)',
        }}
      >
        &ldquo;
      </div>
      <blockquote
        style={{
          fontFamily: T.display,
          fontStyle: 'italic',
          fontWeight: 400,
          fontSize: 'clamp(20px, 3%, 30px)',
          lineHeight: 1.32,
          color: T.text,
          margin: 0,
        }}
      >
        {page.text}
      </blockquote>
      {page.attribution && (
        <div
          style={{
            fontFamily: T.mono,
            fontSize: 'clamp(10px, 1.15%, 12px)',
            letterSpacing: '0.08em',
            color: T.textDim,
            marginTop: 'clamp(16px, 2.4%, 22px)',
          }}
        >
          — {page.attribution}
        </div>
      )}
      <div style={{ flex: 1.2 }} />
    </PageInner>
    <Watermark />
  </PageFrame>
);

const ImagePage: React.FC<{ page: Extract<Page, { kind: 'image' }> }> = ({ page }) => (
  <PageFrame backgroundImage={page.url}>
    {/* image fills the frame; soft gradient at the foot for caption legibility */}
    {page.caption && (
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, transparent 60%, rgba(24,19,14,0.45) 80%, rgba(24,19,14,0.85) 100%)',
        }}
      />
    )}
    <PageInner padded={false}>
      <div style={{ flex: 1 }} />
      {page.caption && (
        <div
          style={{
            padding: 'clamp(16px, 3%, 26px) clamp(20px, 4.5%, 38px)',
            position: 'relative',
            zIndex: 2,
          }}
        >
          <div
            style={{
              fontFamily: T.mono,
              fontSize: 'clamp(10px, 1.15%, 12px)',
              letterSpacing: '0.08em',
              color: T.text,
              opacity: 0.92,
            }}
          >
            {page.caption}
          </div>
        </div>
      )}
    </PageInner>
    <Watermark />
    {/* preload alt for screen readers */}
    <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
      {page.alt}
    </span>
  </PageFrame>
);

const ColophonPage: React.FC<{ page: Extract<Page, { kind: 'colophon' }> }> = ({ page }) => (
  <PageFrame>
    <PageInner>
      <div style={{ flex: 1 }} />
      <div
        style={{
          fontFamily: T.display,
          fontWeight: 500,
          fontSize: 'clamp(10px, 1.25%, 12px)',
          letterSpacing: '0.32em',
          textTransform: 'uppercase',
          color: T.gold,
          marginBottom: 'clamp(14px, 2.2%, 20px)',
        }}
      >
        Colophon
      </div>
      <h2
        style={{
          fontFamily: T.display,
          fontStyle: 'italic',
          fontWeight: 400,
          fontSize: 'clamp(20px, 2.8%, 28px)',
          lineHeight: 1.2,
          color: T.text,
          margin: 0,
          marginBottom: 'clamp(20px, 3%, 28px)',
        }}
      >
        {page.title}
      </h2>
      <dl
        style={{
          fontFamily: T.body,
          fontSize: 'clamp(12px, 1.5%, 15px)',
          lineHeight: 1.6,
          color: T.textSec,
          margin: 0,
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          columnGap: 18,
          rowGap: 8,
        }}
      >
        {page.author && (
          <>
            <dt style={{ fontFamily: T.mono, fontSize: 'clamp(9.5px, 1.05%, 11px)', letterSpacing: '0.08em', color: T.textDim, textTransform: 'uppercase' as const }}>Author</dt>
            <dd style={{ margin: 0, color: T.text }}>{page.author}</dd>
          </>
        )}
        {page.date && (
          <>
            <dt style={{ fontFamily: T.mono, fontSize: 'clamp(9.5px, 1.05%, 11px)', letterSpacing: '0.08em', color: T.textDim, textTransform: 'uppercase' as const }}>Published</dt>
            <dd style={{ margin: 0, color: T.text }}>{page.date}</dd>
          </>
        )}
        {page.category && (
          <>
            <dt style={{ fontFamily: T.mono, fontSize: 'clamp(9.5px, 1.05%, 11px)', letterSpacing: '0.08em', color: T.textDim, textTransform: 'uppercase' as const }}>Section</dt>
            <dd style={{ margin: 0, color: T.text }}>{page.category}</dd>
          </>
        )}
        <dt style={{ fontFamily: T.mono, fontSize: 'clamp(9.5px, 1.05%, 11px)', letterSpacing: '0.08em', color: T.textDim, textTransform: 'uppercase' as const }}>Set in</dt>
        <dd style={{ margin: 0, color: T.text }}>Cormorant Garamond &amp; Lora</dd>
      </dl>
      <div style={{ flex: 1.2 }} />
    </PageInner>
    <Watermark />
  </PageFrame>
);

const EndPage: React.FC<{ page: Extract<Page, { kind: 'end' }> }> = ({ page }) => (
  <PageFrame>
    <PageInner>
      <div style={{ flex: 1 }} />
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div
          aria-hidden="true"
          style={{
            fontFamily: T.display,
            fontWeight: 300,
            fontSize: 'clamp(48px, 8%, 88px)',
            color: T.gold,
            opacity: 0.55,
            lineHeight: 1,
            letterSpacing: '0.06em',
          }}
        >
          ⁕
        </div>
        <div
          style={{
            fontFamily: T.display,
            fontStyle: 'italic',
            fontSize: 'clamp(15px, 2%, 19px)',
            color: T.textSec,
            marginTop: 'clamp(14px, 2.2%, 20px)',
          }}
        >
          End of <span style={{ color: T.text }}>{page.title}</span>
        </div>
        <div
          style={{
            fontFamily: T.mono,
            fontSize: 'clamp(9.5px, 1.05%, 11px)',
            letterSpacing: '0.32em',
            textTransform: 'uppercase',
            color: T.textDim,
            marginTop: 'clamp(28px, 4%, 38px)',
          }}
        >
          Teajia · Journal
        </div>
      </div>
      <div style={{ flex: 1.4 }} />
    </PageInner>
  </PageFrame>
);

const PageDispatch: React.FC<{ page: Page }> = ({ page }) => {
  switch (page.kind) {
    case 'cover':    return <CoverPage page={page} />;
    case 'masthead': return <MastheadPage page={page} />;
    case 'body':     return <BodyPage page={page} />;
    case 'section':  return <SectionPage page={page} />;
    case 'quote':    return <QuotePage page={page} />;
    case 'image':    return <ImagePage page={page} />;
    case 'colophon': return <ColophonPage page={page} />;
    case 'end':      return <EndPage page={page} />;
  }
};

// ─── Loading state ───────────────────────────────────────────────────────────

const ReaderLoading: React.FC = () => (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      background: T.bg,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      zIndex: 100,
    }}
  >
    <span
      aria-hidden="true"
      style={{
        fontFamily: T.display,
        fontSize: 64,
        color: T.textDim,
        opacity: 0.5,
        animation: 'fadeIn 1.4s ease-out infinite alternate',
      }}
    >
      茶
    </span>
    <span
      style={{
        fontFamily: T.mono,
        fontSize: 11,
        letterSpacing: '0.08em',
        color: T.textDim,
      }}
    >
      loading
    </span>
  </div>
);

// ─── Main ────────────────────────────────────────────────────────────────────

export default function ArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const { data: article, isLoading, isError } = useQuery<DbArticle>({
    queryKey: ['article', slug],
    queryFn: () => api.articles.getBySlug(slug as string),
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const pages = useMemo(() => (article ? buildPages(article) : []), [article]);
  const total = pages.length;

  const [current, setCurrent] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  // Restore reading progress
  useEffect(() => {
    if (!article) return;
    const saved = localStorage.getItem(`teajia_article_${article.id}`);
    if (saved) {
      const n = parseInt(saved, 10);
      if (!isNaN(n) && n > 0 && n < total) setCurrent(n);
    }
  }, [article, total]);

  useEffect(() => {
    if (!article) return;
    localStorage.setItem(`teajia_article_${article.id}`, String(current));
  }, [current, article]);

  // After pages mount, snap track to restored position (no smooth scroll on first paint)
  useEffect(() => {
    const el = trackRef.current;
    if (!el || total === 0) return;
    el.scrollTo({ left: current * el.clientWidth, behavior: 'auto' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  const scrollTo = useCallback((n: number) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: n * el.clientWidth, behavior: 'smooth' });
  }, []);

  const handleScroll = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    if (idx !== current) setCurrent(idx);
  }, [current]);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'Escape') { navigate('/magazine'); return; }
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); scrollTo(Math.min(total - 1, current + 1)); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); scrollTo(Math.max(0, current - 1)); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, total, scrollTo, navigate]);

  if (isLoading) return <ReaderLoading />;

  if (isError || !article) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: T.bg,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
          padding: 24,
          textAlign: 'center',
        }}
      >
        <p style={{ fontFamily: T.display, fontStyle: 'italic', fontSize: 22, color: T.text, margin: 0 }}>
          Article not found
        </p>
        <p style={{ fontFamily: T.body, fontSize: 14, color: T.textSec, margin: 0, maxWidth: 360 }}>
          This article may have been removed, or the link is incorrect.
        </p>
        <button
          onClick={() => navigate('/magazine')}
          style={{
            fontFamily: T.body,
            fontSize: 14,
            color: T.textSec,
            background: 'none',
            border: 0,
            cursor: 'pointer',
            marginTop: 8,
          }}
        >
          ← Journal
        </button>
      </div>
    );
  }

  const description = article.subtitle ?? (() => {
    const intro = article.blocks?.find(b => b.type === 'intro');
    return intro && 'text' in intro ? intro.text.slice(0, 160) : undefined;
  })();

  return (
    <>
      <Helmet>
        <title>{article.title} — Teajia</title>
        {description && <meta name="description" content={description} />}
        <meta property="og:type" content="article" />
        <meta property="og:title" content={article.title} />
        {description && <meta property="og:description" content={description} />}
        {article.cover_image_url && <meta property="og:image" content={article.cover_image_url} />}
        <meta name="twitter:card" content={article.cover_image_url ? 'summary_large_image' : 'summary'} />
      </Helmet>

      <div
        aria-label={`${article.title} — paginated reader`}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100,
          background: T.bg,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: T.body,
          color: T.text,
        }}
      >
        <style>{FRAME_STYLES}</style>

        {/* Atmospheric backdrop grain — outside the page frame, makes the page feel like a sheet on a desk */}
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            inset: 0,
            opacity: 0.06,
            pointerEvents: 'none',
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Top bar */}
        <header
          style={{
            position: 'relative',
            zIndex: 40,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px 12px',
            background: 'linear-gradient(180deg, rgba(24,19,14,0.92), rgba(24,19,14,0.55) 70%, transparent)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
          }}
        >
          <button
            onClick={() => navigate('/magazine')}
            aria-label="Back to journal"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: T.textSec,
              padding: '6px 4px',
              background: 'none',
              border: 0,
              cursor: 'pointer',
              fontFamily: T.body,
              fontSize: 13,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M13 8H3M6.5 11.5L3 8l3.5-3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Journal
          </button>
          <div
            style={{
              fontFamily: T.display,
              fontWeight: 500,
              letterSpacing: '0.22em',
              fontSize: 11,
              textTransform: 'uppercase',
              color: T.text,
            }}
          >
            Teajia
          </div>
          <div style={{ width: 64 }} aria-hidden="true" />
        </header>

        {/* Page track */}
        <div
          ref={trackRef}
          onScroll={handleScroll}
          role="region"
          aria-label="Article pages"
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            overflowX: 'auto',
            overflowY: 'hidden',
            scrollSnapType: 'x mandatory',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          } as React.CSSProperties}
        >
          {pages.map((page, idx) => (
            <section
              key={idx}
              aria-label={`Page ${idx + 1} of ${total}`}
              style={{
                flex: '0 0 100%',
                scrollSnapAlign: 'start',
                height: '100%',
                alignSelf: 'stretch',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <PageDispatch page={page} />
            </section>
          ))}
        </div>

        {/* Bottom progress bar */}
        <footer
          style={{
            flexShrink: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 18,
            padding: '12px 18px',
            paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
            background: T.bg,
            borderTop: `1px solid ${T.border}`,
          }}
        >
          <button
            onClick={() => scrollTo(Math.max(0, current - 1))}
            disabled={current === 0}
            aria-label="Previous page"
            style={{
              opacity: current === 0 ? 0.3 : 1,
              color: T.textSec,
              padding: 8,
              background: 'none',
              border: 0,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div style={{ flex: 1, minWidth: 60, display: 'flex', alignItems: 'center', gap: 12, maxWidth: 320 }}>
            <div
              role="slider"
              aria-label="Reading progress"
              aria-valuenow={current + 1}
              aria-valuemin={1}
              aria-valuemax={total}
              tabIndex={0}
              onClick={e => {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                const pct = (e.clientX - rect.left) / rect.width;
                scrollTo(Math.round(pct * (total - 1)));
              }}
              onKeyDown={e => {
                if (e.key === 'ArrowRight') scrollTo(Math.min(total - 1, current + 1));
                if (e.key === 'ArrowLeft')  scrollTo(Math.max(0, current - 1));
              }}
              style={{ flex: 1, height: 20, display: 'flex', alignItems: 'center', cursor: 'pointer' }}
            >
              <div
                style={{
                  flex: 1,
                  height: 2,
                  background: 'rgba(184,146,78,0.18)',
                  borderRadius: 2,
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    background: T.gold,
                    width: `${total ? ((current + 1) / total) * 100 : 0}%`,
                    transition: 'width .35s cubic-bezier(.4,0,.2,1)',
                    borderRadius: 2,
                  }}
                />
              </div>
            </div>
            <span
              style={{
                fontFamily: T.mono,
                fontSize: 11,
                color: T.textSec,
                whiteSpace: 'nowrap',
              }}
            >
              {String(current + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
            </span>
          </div>
          <button
            onClick={() => scrollTo(Math.min(total - 1, current + 1))}
            disabled={current === total - 1}
            aria-label="Next page"
            style={{
              opacity: current === total - 1 ? 0.3 : 1,
              color: T.textSec,
              padding: 8,
              background: 'none',
              border: 0,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </footer>
      </div>
    </>
  );
}
