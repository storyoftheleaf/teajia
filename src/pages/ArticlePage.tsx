/**
 * @color-literals. Decided, not deferred.
 *
 * The token block `T` below is the rule in this file: chrome, type and surfaces
 * all read `var(--tea-*)`. What is exempt is the plate art, and only the plate
 * art: the radial washes behind a cover, the concentric rings of the compass
 * plate, the gradient scrim that lets a title sit on a photograph. Those are
 * drawings, and the page they are drawn on is a fixed 1080x1350 frame designed
 * to be screenshotted at that size and posted. A rasteriser reads computed
 * inline values, so a custom property in a plate bakes in whichever theme the
 * sender happened to be using when they hit export.
 *
 * Same reasoning as components/tasting/TastingCard.tsx, and the same condition:
 * a colour that is chrome rather than art still takes a token. See
 * COLOR_RULES.md Rule 11.
 */
import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { DbArticle } from '../types';
import { SharePanel, type SharePage } from '../components/article/SharePanel';

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

// Page-frame internal coordinate system. Every renderer designs against
// these dimensions in fixed pixels (no clamp, no %, no responsive math).
// The page is then transform:scale()'d as a single unit to fit whatever
// physical size the viewport allows. This guarantees that what you see at
// any viewport size is identical to a 1080x1350 PNG export.
const PAGE_W = 1080;
const PAGE_H = 1350;
// Desktop physical ceiling. Tuned so the page sits with comfortable
// breathing room above and below at typical laptop viewport heights.
// Width follows the 4:5 ratio.
const FRAME_MAX_H_DESKTOP = 1100;
const FRAME_MAX_W_DESKTOP = 880; // 1100 * 4 / 5

// ─── Page model ──────────────────────────────────────────────────────────────

// Page model. Synthetic pages (cover/masthead/colophon/end) wrap the article;
// block pages map 1:1 to ArticleBlock[] from the parser. Each ArticleBlock
// gets its own page kind here, with shape mirroring the block but using
// `kind` as the discriminator.
type Page =
  // Synthetic
  | { kind: 'cover'; title: string; subtitle?: string; coverImage?: string; category?: string; mark?: string }
  | { kind: 'masthead'; intro: string; author?: string; authorSlug?: string; date?: string; readingTime?: number }
  | { kind: 'colophon'; title: string; author?: string; authorSlug?: string; date?: string; category?: string }
  | { kind: 'end'; title: string }
  // Original 8 (kept for the renderers we already wrote)
  | { kind: 'body'; head: string; paragraphs: string[]; pageNum: number; pageTotal: number }
  | { kind: 'section'; title: string; numeral: string }
  | { kind: 'quote'; text: string; attribution?: string; variant?: 'big' | 'minimal' }
  | { kind: 'image'; url: string; caption?: string; alt: string; variant?: string; images?: string[] }
  // New block-derived kinds
  | { kind: 'paragraph_styled'; text: string; variant: 'single' | 'double' | 'justified' | 'center' | 'drop_cap' }
  | { kind: 'block_cover'; title: string; subtitle?: string; image?: string; kicker?: string; variant?: string }
  | { kind: 'block_chapter'; title: string; subtitle?: string; number?: string }
  | { kind: 'qa'; items: Array<{ q: string; a: string }>; pageNum: number; pageTotal: number }
  | { kind: 'pull_sidebar'; side: 'left' | 'right' | 'image'; body: string; sidebar: string; image?: string }
  | { kind: 'epilogue'; text: string; signature?: string }
  | { kind: 'stat'; value: string; label: string; context?: string }
  | { kind: 'definition'; term: string; body: string; etymology?: string }
  | { kind: 'recipe'; title: string; ingredients: string[]; steps: string[]; pairing?: string }
  | { kind: 'tasting_notes'; items: Array<{ label: string; note: string }> }
  | { kind: 'poem'; text: string; variant: string }
  | { kind: 'map'; caption?: string; locations: string[] }
  | { kind: 'list'; variant: 'checklist' | 'timeline'; title?: string; items: string[] }
  | { kind: 'embed'; platform: 'youtube' | 'instagram'; externalId: string; caption?: string; description?: string }
  | { kind: 'back_matter'; variant: 'copyright' | 'dedication'; lines: string[] };

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

// (Pagination logic now lives in scripts/parseDirectives.ts; the parser
// produces page-shaped blocks and the reader maps them 1:1.)

function buildPages(article: DbArticle): Page[] {
  const pages: Page[] = [];
  const author = article.author_name || formatAuthor(article.author_id);
  const authorSlug = article.author_name && article.author_id && !/^[0-9a-f]{8}-/i.test(article.author_id)
    ? article.author_id
    : undefined;
  const date = formatDate(article.published_at ?? article.created_at);

  // The first non-cover block is the intro; if a cover block exists, use it
  // for the synthetic cover page. Otherwise synthesize one.
  const blocks = article.blocks ?? [];
  const firstCover = blocks.find(b => b.type === 'cover');
  const firstIntro = blocks.find(b => b.type === 'intro');
  let chapterCount = 0;
  const numerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

  // 1. Synthetic cover (uses the first cover block if present, else article meta)
  if (firstCover && firstCover.type === 'cover') {
    pages.push({
      kind: 'cover',
      title: firstCover.title,
      subtitle: firstCover.subtitle,
      coverImage: firstCover.image ?? article.cover_image_url,
      category: article.category,
      mark: '茶',
    });
  } else {
    pages.push({
      kind: 'cover',
      title: article.title,
      subtitle: article.subtitle,
      coverImage: article.cover_image_url,
      category: article.category,
      mark: '茶',
    });
  }

  // 2. Masthead — built from intro block
  if (firstIntro && firstIntro.type === 'intro') {
    pages.push({
      kind: 'masthead',
      intro: firstIntro.text,
      author,
      authorSlug,
      date,
      readingTime: article.reading_time_mins,
    });
  }

  // 3. Body — every block becomes one page (parser already shaped them this way)
  blocks.forEach(block => {
    switch (block.type) {
      case 'intro':
      case 'cover':
        return; // already consumed for synthetic pages

      case 'paragraph':
        pages.push({
          kind: 'paragraph_styled',
          text: block.text,
          variant: block.variant ?? 'single',
        });
        return;

      case 'section_heading':
        chapterCount++;
        pages.push({
          kind: 'section',
          numeral: numerals[chapterCount - 1] ?? String(chapterCount),
          title: block.text,
        });
        return;

      case 'chapter_divider':
        chapterCount++;
        pages.push({
          kind: 'block_chapter',
          title: block.title,
          subtitle: block.subtitle,
          number: block.number ?? numerals[chapterCount - 1],
        });
        return;

      case 'quote':
        pages.push({
          kind: 'quote',
          text: block.text,
          attribution: block.attribution,
          variant: block.variant,
        });
        return;

      case 'image':
        if (!block.url && !block.images?.length) return;
        pages.push({
          kind: 'image',
          url: block.url ?? block.images?.[0] ?? '',
          caption: block.caption,
          alt: block.description || '',
          variant: block.variant,
          images: block.images,
        });
        return;

      case 'divider':
        return; // dividers are page breaks, but every block already is one

      case 'qa_pair': {
        // Paginate Q&A: try to fit ~2 short pairs or 1 longer pair per page.
        const items = block.items;
        const pages_qa: Array<Array<{ q: string; a: string }>> = [];
        let bucket: Array<{ q: string; a: string }> = [];
        let chars = 0;
        const MAX_QA = 700;
        for (const item of items) {
          const len = (item.q?.length ?? 0) + (item.a?.length ?? 0);
          if (bucket.length && chars + len > MAX_QA) {
            pages_qa.push(bucket);
            bucket = [];
            chars = 0;
          }
          bucket.push(item);
          chars += len;
        }
        if (bucket.length) pages_qa.push(bucket);
        pages_qa.forEach((page, i) =>
          pages.push({ kind: 'qa', items: page, pageNum: i + 1, pageTotal: pages_qa.length }),
        );
        return;
      }

      case 'pull_sidebar':
        pages.push({
          kind: 'pull_sidebar',
          side: block.side,
          body: block.body,
          sidebar: block.sidebar,
          image: block.image,
        });
        return;

      case 'epilogue':
        pages.push({ kind: 'epilogue', text: block.text, signature: block.signature });
        return;

      case 'stat':
        pages.push({ kind: 'stat', value: block.value, label: block.label, context: block.context });
        return;

      case 'definition':
        pages.push({ kind: 'definition', term: block.term, body: block.body, etymology: block.etymology });
        return;

      case 'recipe':
        pages.push({
          kind: 'recipe',
          title: block.title,
          ingredients: block.ingredients,
          steps: block.steps,
          pairing: block.pairing,
        });
        return;

      case 'tasting_notes':
        pages.push({ kind: 'tasting_notes', items: block.items });
        return;

      case 'poem':
        pages.push({ kind: 'poem', text: block.text, variant: block.variant });
        return;

      case 'map':
        pages.push({ kind: 'map', caption: block.caption, locations: block.locations });
        return;

      case 'list':
        pages.push({ kind: 'list', variant: block.variant, title: block.title, items: block.items });
        return;

      case 'embed':
        pages.push({
          kind: 'embed',
          platform: block.platform,
          externalId: block.externalId,
          caption: block.caption,
          description: block.description,
        });
        return;

      case 'back_matter':
        pages.push({ kind: 'back_matter', variant: block.variant, lines: block.lines });
        return;
    }
  });

  // 4. Colophon
  pages.push({
    kind: 'colophon',
    title: article.title,
    author,
    authorSlug,
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

/* Frame architecture
 * ─────────────────────────────────────────────────────────────────
 * Three nested elements:
 *
 *   .article-page-outer   centering container, fills available space
 *   .article-page-sizer   the visible page (responsive 4:5 box, clips overflow)
 *   .article-page-frame   FIXED ${PAGE_W}x${PAGE_H} canvas, transform:scale'd
 *                         to fit the sizer. Scale factor is set inline by
 *                         JS via ResizeObserver in the React component.
 *
 * Why JS-driven scale: container queries (cqw) give a value but require
 * `container-type: size` which restricts other layout behavior; pure CSS
 * `aspect-ratio` plus `transform: scale(...)` is well-supported. JS reads
 * sizer dimensions and writes a CSS variable for the transform.
 */
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
  .article-page-sizer {
    position: relative;
    aspect-ratio: ${PAGE_W} / ${PAGE_H};
    width: 100%;
    max-width: 100vw;
    max-height: 100%;
    overflow: hidden;
    border-radius: 0;
    box-shadow: none;
    --page-scale: 1;
  }
  .article-page-frame {
    position: absolute;
    top: 0;
    left: 0;
    width: ${PAGE_W}px;
    height: ${PAGE_H}px;
    transform-origin: top left;
    transform: scale(var(--page-scale));
    overflow: hidden;
    will-change: transform;
  }
  @media (min-width: 768px) {
    .article-page-outer {
      padding: clamp(16px, 2.4vw, 32px);
    }
    .article-page-sizer {
      /* Reserve 220px of vertical chrome: ~50 header + ~80 footer +
         70 of breathing room top/bottom (so the drop shadow is visible
         and the page doesn't kiss either bar). */
      max-width: min(${FRAME_MAX_W_DESKTOP}px, calc((100vh - 220px) * 4 / 5));
      max-height: min(${FRAME_MAX_H_DESKTOP}px, calc(100vh - 220px));
      border-radius: 3px;
      box-shadow:
        0 30px 80px rgba(0, 0, 0, 0.55),
        0 8px 24px rgba(0, 0, 0, 0.35),
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
}) => {
  const sizerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = sizerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      if (w > 0) {
        el.style.setProperty('--page-scale', String(w / PAGE_W));
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="article-page-outer">
      <div ref={sizerRef} className="article-page-sizer">
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
    </div>
  );
};

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
      padding: padded ? '60.8px' : 0,
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
      bottom: '32.4px',
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
        fontSize: '17px',
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

// ─── Stock-image detection ───────────────────────────────────────────────────
// Stock placeholders (Unsplash) are detected at render time and replaced with
// typographic "plates" so the brand stays editorial. When real photography
// arrives later, the original image renderers take over automatically.

function isStockImage(url?: string | null): boolean {
  if (!url) return false;
  return /images\.unsplash\.com|source\.unsplash\.com/i.test(url);
}

// ─── Plate ───────────────────────────────────────────────────────────────────
// Typographic placeholder used in place of stock photography. Renders the
// caption (or kicker) on a warm grain surface with a generative geometric
// ornament. The surface still reads as a "page" with content, not a missing
// image.

interface PlateProps {
  kicker?: string;       // small label ("Plate", "Image", "Video")
  caption?: string;      // the caption / description text from the source
  ornament?: 'circle' | 'arch' | 'split' | 'strip' | 'scatter' | 'square';
  index?: number;        // varies the geometric pattern across pages
}

const Plate: React.FC<PlateProps> = ({ kicker = 'Plate', caption, ornament = 'square', index = 0 }) => {
  // Generative pattern positions, seeded by index so adjacent plates differ.
  const seed = (n: number) => ((index * 9301 + 49297 + n * 233280) % 233280) / 233280;
  return (
    <div
      style={{
        position: 'relative',
        zIndex: 1,
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '60.8px',
        boxSizing: 'border-box',
        background: `
          radial-gradient(ellipse 80% 60% at 30% 20%, rgba(184,146,78,0.06) 0%, transparent 65%),
          radial-gradient(ellipse 60% 60% at 80% 90%, rgba(184,146,78,0.04) 0%, transparent 60%),
          var(--tea-bg)
        `,
      }}
    >
      {/* Ornament panel (top half of the plate) */}
      <div
        aria-hidden="true"
        style={{
          flex: 1.2,
          position: 'relative',
          margin: '18.9px 0 43.2px',
          overflow: 'hidden',
          border: '1px solid var(--tea-border)',
          borderRadius: 2,
          background: `
            linear-gradient(135deg, rgba(40,33,26,0.55) 0%, rgba(24,19,14,0.85) 100%)
          `,
        }}
      >
        {ornament === 'circle' && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '62%',
              aspectRatio: '1/1',
              borderRadius: '50%',
              border: '1px solid rgba(184,146,78,0.35)',
              boxShadow: 'inset 0 0 60px rgba(184,146,78,0.08)',
            }}
          />
        )}
        {ornament === 'arch' && (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              width: '62%',
              aspectRatio: '3/4',
              borderRadius: '50% 50% 2px 2px / 35% 35% 2px 2px',
              border: '1px solid rgba(184,146,78,0.32)',
              borderBottom: 'none',
              background: 'linear-gradient(180deg, rgba(184,146,78,0.06) 0%, transparent 80%)',
            }}
          />
        )}
        {ornament === 'split' && (
          <>
            <div style={{ position: 'absolute', inset: 0, left: '50%', borderLeft: '1px solid rgba(184,146,78,0.22)' }} />
            <div style={{ position: 'absolute', top: '50%', left: '15%', width: '20%', aspectRatio: '1/1', borderRadius: '50%', border: '1px solid rgba(184,146,78,0.4)', transform: 'translateY(-50%)' }} />
            <div style={{ position: 'absolute', top: '50%', right: '15%', width: '20%', aspectRatio: '1/1', border: '1px solid rgba(184,146,78,0.4)', transform: 'translateY(-50%)' }} />
          </>
        )}
        {ornament === 'strip' && (
          <div style={{ position: 'absolute', inset: '8% 12%', display: 'flex', flexDirection: 'column', gap: '4%' }}>
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                style={{
                  flex: 1,
                  border: '1px solid rgba(184,146,78,0.22)',
                  background: `linear-gradient(${90 + i * 30}deg, rgba(184,146,78,${0.04 + i * 0.02}), transparent)`,
                }}
              />
            ))}
          </div>
        )}
        {ornament === 'scatter' && (
          <>
            {[0, 1, 2, 3].map(i => {
              const x = 10 + seed(i * 2) * 60;
              const y = 8 + seed(i * 2 + 1) * 70;
              const rot = (seed(i * 3) - 0.5) * 14;
              const size = 28 + seed(i * 5) * 12;
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: `${x}%`,
                    top: `${y}%`,
                    width: `${size}%`,
                    aspectRatio: '4/5',
                    transform: `rotate(${rot}deg)`,
                    background: 'rgba(237,228,212,0.04)',
                    border: '1px solid rgba(184,146,78,0.22)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
                  }}
                />
              );
            })}
          </>
        )}
        {ornament === 'square' && (
          <>
            <div style={{ position: 'absolute', top: '14%', left: '14%', right: '14%', bottom: '14%', border: '1px solid rgba(184,146,78,0.28)' }} />
            <div style={{ position: 'absolute', top: '24%', left: '24%', right: '24%', bottom: '24%', border: '1px solid rgba(184,146,78,0.18)' }} />
            <div style={{ position: 'absolute', top: '44%', left: '44%', right: '44%', bottom: '44%', background: 'rgba(184,146,78,0.12)' }} />
          </>
        )}
        {/* fine grain on the ornament */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.08,
            mixBlendMode: 'overlay',
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            backgroundSize: '160px',
          }}
        />
      </div>

      {/* Caption */}
      <div style={{ flexShrink: 0 }}>
        <div
          style={{
            fontFamily: T.display,
            fontWeight: 500,
            fontSize: '19px',
            letterSpacing: '0.32em',
            textTransform: 'uppercase',
            color: T.gold,
            opacity: 0.85,
            marginBottom: '16.2px',
          }}
        >
          {kicker}
        </div>
        {caption && (
          <p
            style={{
              fontFamily: T.body,
              fontStyle: 'italic',
              fontSize: '25px',
              lineHeight: 1.5,
              color: T.text,
              margin: 0,
            }}
          >
            {caption}
          </p>
        )}
      </div>
    </div>
  );
};

const CoverPage: React.FC<{ page: Extract<Page, { kind: 'cover' }> }> = ({ page }) => {
  const showImage = page.coverImage && !isStockImage(page.coverImage);
  return (
    <PageFrame>
      {showImage && (
        <>
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
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(180deg, rgba(24,19,14,0.4) 0%, rgba(24,19,14,0.55) 50%, rgba(24,19,14,0.85) 100%)',
            }}
          />
        </>
      )}

      {/* Typographic ornament when no real photography is available */}
      {!showImage && (
        <>
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              background: `
                radial-gradient(ellipse 90% 60% at 20% 10%, rgba(184,146,78,0.10) 0%, transparent 65%),
                radial-gradient(ellipse 70% 50% at 90% 95%, rgba(184,146,78,0.06) 0%, transparent 60%)
              `,
            }}
          />
          {/* Centered diamond ornament */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: '34%',
              left: '50%',
              transform: 'translate(-50%, -50%) rotate(45deg)',
              width: '38%',
              aspectRatio: '1/1',
              border: '1px solid rgba(184,146,78,0.32)',
              boxShadow: 'inset 0 0 60px rgba(184,146,78,0.05)',
            }}
          />
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: '34%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '6%',
              aspectRatio: '1/1',
              borderRadius: '50%',
              background: 'rgba(184,146,78,0.4)',
            }}
          />
        </>
      )}

      <PageInner>
        <div style={{ flex: showImage ? 1 : 1.7 }} />
        {page.category && (
          <div
            style={{
              fontFamily: T.display,
              fontWeight: 500,
              fontSize: '20px',
              letterSpacing: '0.36em',
              textTransform: 'uppercase',
              color: T.gold,
              marginBottom: '21.6px',
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
            fontSize: '86.4px',
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
              fontSize: '28px',
              lineHeight: 1.4,
              color: T.textSec,
              marginTop: '20px',
              marginBottom: 0,
            }}
          >
            {page.subtitle}
          </p>
        )}
        {!showImage && <div style={{ flex: 0.4 }} />}
        {page.mark && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: '60.8px',
              right: '60.8px',
              fontFamily: T.display,
              fontSize: '81px',
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
};

const MastheadPage: React.FC<{ page: Extract<Page, { kind: 'masthead' }> }> = ({ page }) => (
  <PageFrame>
    <PageInner>
      <div
        aria-hidden="true"
        style={{
          fontFamily: T.display,
          fontSize: '68px',
          color: T.gold,
          opacity: 0.5,
          lineHeight: 0.8,
          marginBottom: '16.2px',
        }}
      >
        &ldquo;
      </div>
      <p
        style={{
          fontFamily: T.body,
          fontWeight: 400,
          fontStyle: 'italic',
          fontSize: '30px',
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
          fontSize: '19px',
          letterSpacing: '0.08em',
          color: T.textDim,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        {page.author && (
          <span>
            By{' '}
            {page.authorSlug ? (
              <a
                href={`/people/${page.authorSlug}`}
                style={{
                  color: 'inherit',
                  textDecoration: 'none',
                  borderBottom: '1px solid transparent',
                  transition: 'border-color 200ms',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.borderBottomColor = 'rgba(168,135,77,0.4)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.borderBottomColor = 'transparent';
                }}
              >
                {page.author}
              </a>
            ) : (
              page.author
            )}
          </span>
        )}
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
          fontSize: '22px',
          letterSpacing: '0.04em',
          color: T.textDim,
          marginBottom: '29.7px',
          paddingBottom: '20px',
          borderBottom: `1px solid ${T.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, paddingRight: 12 }}>
          {page.head}
        </span>
        <span style={{ fontFamily: T.mono, fontStyle: 'normal', fontSize: '18px', flexShrink: 0 }}>
          {String(page.pageNum).padStart(2, '0')} / {String(page.pageTotal).padStart(2, '0')}
        </span>
      </div>
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '21.6px',
          overflow: 'hidden',
        }}
      >
        {page.paragraphs.map((p, i) => (
          <p
            key={i}
            style={{
              fontFamily: T.body,
              fontWeight: 400,
              fontSize: '27px',
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
          fontSize: '148.5px',
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
          margin: '32.4px 0',
        }}
      />
      <h2
        style={{
          fontFamily: T.display,
          fontStyle: 'italic',
          fontWeight: 400,
          fontSize: '45.9px',
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
          fontSize: '135px',
          color: T.gold,
          opacity: 0.4,
          lineHeight: 0.7,
          marginBottom: '16px',
        }}
      >
        &ldquo;
      </div>
      <blockquote
        style={{
          fontFamily: T.display,
          fontStyle: 'italic',
          fontWeight: 400,
          fontSize: '40.5px',
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
            fontSize: '20px',
            letterSpacing: '0.08em',
            color: T.textDim,
            marginTop: '32.4px',
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

const ImagePage: React.FC<{ page: Extract<Page, { kind: 'image' }> }> = ({ page }) => {
  // Stock placeholder → render typographic plate instead of the photo.
  if (isStockImage(page.url)) {
    return (
      <PageFrame>
        <Plate
          kicker="Plate"
          caption={page.caption || page.alt}
          ornament="square"
        />
        <Watermark />
      </PageFrame>
    );
  }
  return (
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
            padding: '40.5px 60.8px',
            position: 'relative',
            zIndex: 2,
          }}
        >
          <div
            style={{
              fontFamily: T.mono,
              fontSize: '20px',
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
};

const ColophonPage: React.FC<{ page: Extract<Page, { kind: 'colophon' }> }> = ({ page }) => (
  <PageFrame>
    <PageInner>
      <div style={{ flex: 1 }} />
      <div
        style={{
          fontFamily: T.display,
          fontWeight: 500,
          fontSize: '20px',
          letterSpacing: '0.32em',
          textTransform: 'uppercase',
          color: T.gold,
          marginBottom: '29.7px',
        }}
      >
        Colophon
      </div>
      <h2
        style={{
          fontFamily: T.display,
          fontStyle: 'italic',
          fontWeight: 400,
          fontSize: '40px',
          lineHeight: 1.2,
          color: T.text,
          margin: 0,
          marginBottom: '40.5px',
        }}
      >
        {page.title}
      </h2>
      <dl
        style={{
          fontFamily: T.body,
          fontSize: '24px',
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
            <dt style={{ fontFamily: T.mono, fontSize: '19px', letterSpacing: '0.08em', color: T.textDim, textTransform: 'uppercase' as const }}>Author</dt>
            <dd className="m-0" style={{ color: T.text }}>
              {page.authorSlug ? (
                <a
                  href={`/people/${page.authorSlug}`}
                  style={{
                    color: 'inherit',
                    textDecoration: 'none',
                    borderBottom: '1px solid transparent',
                    transition: 'border-color 200ms',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.borderBottomColor = 'rgba(168,135,77,0.4)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.borderBottomColor = 'transparent';
                  }}
                >
                  {page.author}
                </a>
              ) : (
                page.author
              )}
            </dd>
          </>
        )}
        {page.date && (
          <>
            <dt style={{ fontFamily: T.mono, fontSize: '19px', letterSpacing: '0.08em', color: T.textDim, textTransform: 'uppercase' as const }}>Published</dt>
            <dd className="m-0" style={{ color: T.text }}>{page.date}</dd>
          </>
        )}
        {page.category && (
          <>
            <dt style={{ fontFamily: T.mono, fontSize: '19px', letterSpacing: '0.08em', color: T.textDim, textTransform: 'uppercase' as const }}>Section</dt>
            <dd className="m-0" style={{ color: T.text }}>{page.category}</dd>
          </>
        )}
        <dt style={{ fontFamily: T.mono, fontSize: '19px', letterSpacing: '0.08em', color: T.textDim, textTransform: 'uppercase' as const }}>Set in</dt>
        <dd className="m-0" style={{ color: T.text }}>Cormorant Garamond &amp; Lora</dd>
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
            fontSize: '108px',
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
            fontSize: '30px',
            color: T.textSec,
            marginTop: '29.7px',
          }}
        >
          End of <span style={{ color: T.text }}>{page.title}</span>
        </div>
        <div
          style={{
            fontFamily: T.mono,
            fontSize: '19px',
            letterSpacing: '0.32em',
            textTransform: 'uppercase',
            color: T.textDim,
            marginTop: '56px',
          }}
        >
          Teajia · Journal
        </div>
      </div>
      <div style={{ flex: 1.4 }} />
    </PageInner>
  </PageFrame>
);

// ─── New page renderers (block-derived) ──────────────────────────────────────

// Single paragraph rendered with variant-specific typography.
const ParagraphStyledPage: React.FC<{ page: Extract<Page, { kind: 'paragraph_styled' }> }> = ({ page }) => {
  const v = page.variant;
  const baseStyle: React.CSSProperties = {
    fontFamily: T.body,
    fontSize: '27px',
    lineHeight: 1.62,
    color: T.text,
    margin: 0,
  };
  let extra: React.CSSProperties = {};
  let firstChar: React.ReactNode = null;
  let textForRender = page.text;

  if (v === 'justified') extra.textAlign = 'justify';
  else if (v === 'center') extra.textAlign = 'center';

  if (v === 'drop_cap') {
    const first = page.text.charAt(0);
    const rest = page.text.slice(1);
    textForRender = rest;
    firstChar = (
      <span
        style={{
          fontFamily: T.display,
          fontStyle: 'italic',
          fontWeight: 400,
          fontSize: '96px',
          lineHeight: 0.85,
          color: T.gold,
          float: 'left',
          marginRight: '12px',
          marginTop: '4.1px',
          opacity: 0.85,
        }}
      >
        {first}
      </span>
    );
  }

  return (
    <PageFrame>
      <PageInner>
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: v === 'center' ? 'center' : 'flex-start',
            paddingTop: v === 'center' ? 0 : '32.4px',
          }}
        >
          <div style={{ maxWidth: v === 'justified' ? '92%' : '100%' }}>
            <p style={{ ...baseStyle, ...extra }}>
              {firstChar}
              {textForRender}
            </p>
          </div>
        </div>
      </PageInner>
      <Watermark />
    </PageFrame>
  );
};

// Chapter divider: large numeral, title, optional subtitle.
const BlockChapterPage: React.FC<{ page: Extract<Page, { kind: 'block_chapter' }> }> = ({ page }) => (
  <PageFrame>
    <PageInner>
      <div style={{ flex: 1 }} />
      {page.number && (
        <div
          style={{
            fontFamily: T.display,
            fontWeight: 300,
            fontSize: '189px',
            color: T.gold,
            opacity: 0.55,
            lineHeight: 1,
            letterSpacing: '0.04em',
          }}
        >
          {page.number}
        </div>
      )}
      <div aria-hidden="true" style={{ width: 64, height: 1, background: T.border, margin: '36px 0' }} />
      <h2
        style={{
          fontFamily: T.display,
          fontStyle: 'italic',
          fontWeight: 400,
          fontSize: '45.9px',
          lineHeight: 1.15,
          color: T.text,
          margin: 0,
          maxWidth: '85%',
        }}
      >
        {page.title}
      </h2>
      {page.subtitle && (
        <p
          style={{
            fontFamily: T.body,
            fontStyle: 'italic',
            fontSize: '26px',
            color: T.textSec,
            margin: '20px 0 0',
            maxWidth: '78%',
          }}
        >
          {page.subtitle}
        </p>
      )}
      <div style={{ flex: 1.4 }} />
    </PageInner>
    <Watermark />
  </PageFrame>
);

// Q&A page: typically 1-2 question/answer pairs per page.
const QAPage: React.FC<{ page: Extract<Page, { kind: 'qa' }> }> = ({ page }) => (
  <PageFrame>
    <PageInner>
      <div
        style={{
          fontFamily: T.display,
          fontStyle: 'italic',
          fontWeight: 400,
          fontSize: '22px',
          letterSpacing: '0.04em',
          color: T.textDim,
          marginBottom: '29.7px',
          paddingBottom: '20px',
          borderBottom: `1px solid ${T.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
        }}
      >
        <span>In Conversation</span>
        {page.pageTotal > 1 && (
          <span style={{ fontFamily: T.mono, fontStyle: 'normal', fontSize: '18px' }}>
            {String(page.pageNum).padStart(2, '0')} / {String(page.pageTotal).padStart(2, '0')}
          </span>
        )}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '32.4px', overflow: 'hidden' }}>
        {page.items.map((item, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '13.5px' }}>
            <div
              style={{
                fontFamily: T.display,
                fontStyle: 'italic',
                fontSize: '27px',
                color: T.gold,
                lineHeight: 1.35,
                margin: 0,
              }}
            >
              {item.q}
            </div>
            <div
              style={{
                fontFamily: T.body,
                fontSize: '26px',
                color: T.text,
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              {item.a}
            </div>
          </div>
        ))}
      </div>
    </PageInner>
    <Watermark />
  </PageFrame>
);

// Pull sidebar: title and aside text. Layout flips for left/right; image variant
// shows a small image above the title.
const PullSidebarPage: React.FC<{ page: Extract<Page, { kind: 'pull_sidebar' }> }> = ({ page }) => (
  <PageFrame>
    <PageInner>
      {page.side === 'image' && page.image && !isStockImage(page.image) && (
        <div
          style={{
            width: '100%',
            aspectRatio: '16/9',
            backgroundImage: `url("${page.image}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            marginBottom: '29.7px',
            borderRadius: 2,
          }}
          aria-hidden="true"
        />
      )}
      {page.side === 'image' && page.image && isStockImage(page.image) && (
        <div
          aria-hidden="true"
          style={{
            width: '100%',
            aspectRatio: '16/9',
            marginBottom: '29.7px',
            borderRadius: 2,
            border: '1px solid var(--tea-border)',
            background: 'linear-gradient(135deg, rgba(40,33,26,0.55) 0%, rgba(24,19,14,0.85) 100%)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '38%',
              aspectRatio: '1/1',
              borderRadius: '50%',
              border: '1px solid rgba(184,146,78,0.32)',
            }}
          />
        </div>
      )}
      <div
        style={{
          fontFamily: T.display,
          fontWeight: 500,
          fontSize: '20px',
          letterSpacing: '0.32em',
          textTransform: 'uppercase',
          color: T.gold,
          marginBottom: '20px',
        }}
      >
        Aside
      </div>
      <h2
        style={{
          fontFamily: T.display,
          fontStyle: 'italic',
          fontWeight: 400,
          fontSize: '40px',
          lineHeight: 1.18,
          color: T.text,
          margin: '0 0 24.3px',
        }}
      >
        {page.body}
      </h2>
      <p
        style={{
          fontFamily: T.body,
          fontSize: '25px',
          lineHeight: 1.6,
          color: T.textSec,
          margin: 0,
          flex: 1,
          overflow: 'hidden',
        }}
      >
        {page.sidebar}
      </p>
    </PageInner>
    <Watermark />
  </PageFrame>
);

const EpiloguePage: React.FC<{ page: Extract<Page, { kind: 'epilogue' }> }> = ({ page }) => (
  <PageFrame>
    <PageInner>
      <div style={{ flex: 1 }} />
      <div
        aria-hidden="true"
        style={{
          fontFamily: T.display,
          fontSize: '68px',
          color: T.gold,
          opacity: 0.45,
          lineHeight: 0.8,
          marginBottom: '20px',
          textAlign: 'center',
        }}
      >
        ⁕
      </div>
      <p
        style={{
          fontFamily: T.body,
          fontStyle: 'italic',
          fontSize: '28px',
          lineHeight: 1.55,
          color: T.text,
          margin: 0,
          textAlign: 'center',
          maxWidth: '88%',
          alignSelf: 'center',
        }}
      >
        {page.text}
      </p>
      {page.signature && (
        <div
          style={{
            fontFamily: T.mono,
            fontSize: '20px',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: T.textDim,
            textAlign: 'center',
            marginTop: '40.5px',
          }}
        >
          {page.signature}
        </div>
      )}
      <div style={{ flex: 1.2 }} />
    </PageInner>
    <Watermark />
  </PageFrame>
);

const StatPage: React.FC<{ page: Extract<Page, { kind: 'stat' }> }> = ({ page }) => (
  <PageFrame>
    <PageInner>
      <div style={{ flex: 1 }} />
      <div
        style={{
          fontFamily: T.display,
          fontWeight: 300,
          fontSize: '189px',
          color: T.text,
          lineHeight: 1,
          letterSpacing: '-0.02em',
        }}
      >
        {page.value}
      </div>
      <div
        style={{
          fontFamily: T.display,
          fontStyle: 'italic',
          fontSize: '32px',
          color: T.gold,
          marginTop: '20px',
          maxWidth: '80%',
        }}
      >
        {page.label}
      </div>
      {page.context && (
        <div
          style={{
            fontFamily: T.body,
            fontSize: '26px',
            lineHeight: 1.55,
            color: T.textSec,
            marginTop: '32.4px',
            maxWidth: '85%',
          }}
        >
          {page.context}
        </div>
      )}
      <div style={{ flex: 1.4 }} />
    </PageInner>
    <Watermark />
  </PageFrame>
);

const DefinitionPage: React.FC<{ page: Extract<Page, { kind: 'definition' }> }> = ({ page }) => (
  <PageFrame>
    <PageInner>
      <div style={{ flex: 1 }} />
      <div
        style={{
          fontFamily: T.display,
          fontWeight: 500,
          fontSize: '20px',
          letterSpacing: '0.32em',
          textTransform: 'uppercase',
          color: T.gold,
          marginBottom: '16.2px',
        }}
      >
        Term
      </div>
      <h2
        style={{
          fontFamily: T.display,
          fontStyle: 'italic',
          fontWeight: 400,
          fontSize: '64.8px',
          lineHeight: 1.05,
          color: T.text,
          margin: 0,
        }}
      >
        {page.term}
      </h2>
      {page.etymology && (
        <div
          style={{
            fontFamily: T.mono,
            fontSize: '20px',
            color: T.textDim,
            marginTop: '16.2px',
            letterSpacing: '0.05em',
          }}
        >
          {page.etymology}
        </div>
      )}
      <div aria-hidden="true" style={{ width: 56, height: 1, background: T.border, margin: '36px 0' }} />
      <p
        style={{
          fontFamily: T.body,
          fontSize: '27px',
          lineHeight: 1.6,
          color: T.text,
          margin: 0,
        }}
      >
        {page.body}
      </p>
      <div style={{ flex: 1.2 }} />
    </PageInner>
    <Watermark />
  </PageFrame>
);

const RecipePage: React.FC<{ page: Extract<Page, { kind: 'recipe' }> }> = ({ page }) => (
  <PageFrame>
    <PageInner>
      <div
        style={{
          fontFamily: T.display,
          fontWeight: 500,
          fontSize: '20px',
          letterSpacing: '0.32em',
          textTransform: 'uppercase',
          color: T.gold,
          marginBottom: '16.2px',
        }}
      >
        Method
      </div>
      <h2
        style={{
          fontFamily: T.display,
          fontStyle: 'italic',
          fontWeight: 400,
          fontSize: '40px',
          lineHeight: 1.15,
          color: T.text,
          margin: '0 0 28px',
        }}
      >
        {page.title}
      </h2>
      <ol
        style={{
          fontFamily: T.body,
          fontSize: '24px',
          lineHeight: 1.55,
          color: T.text,
          margin: 0,
          padding: 0,
          listStyle: 'none',
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        {page.steps.map((step, i) => (
          <li key={i} style={{ display: 'flex', gap: '16.2px', alignItems: 'baseline' }}>
            <span
              style={{
                fontFamily: T.mono,
                fontSize: '18px',
                color: T.gold,
                opacity: 0.7,
                flexShrink: 0,
                minWidth: '1.5em',
                letterSpacing: '0.04em',
              }}
            >
              {String(i + 1).padStart(2, '0')}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      {page.pairing && (
        <div
          style={{
            fontFamily: T.body,
            fontStyle: 'italic',
            fontSize: '22px',
            color: T.textDim,
            marginTop: '24.3px',
            paddingTop: '20px',
            borderTop: `1px solid ${T.border}`,
          }}
        >
          Pairs with {page.pairing}
        </div>
      )}
    </PageInner>
    <Watermark />
  </PageFrame>
);

const TastingNotesPage: React.FC<{ page: Extract<Page, { kind: 'tasting_notes' }> }> = ({ page }) => (
  <PageFrame>
    <PageInner>
      <div
        style={{
          fontFamily: T.display,
          fontWeight: 500,
          fontSize: '20px',
          letterSpacing: '0.32em',
          textTransform: 'uppercase',
          color: T.gold,
          marginBottom: '28px',
        }}
      >
        Tasting Notes
      </div>
      <dl
        style={{
          flex: 1,
          margin: 0,
          display: 'grid',
          gridTemplateColumns: '1fr 2fr',
          columnGap: '28px',
          rowGap: '24.3px',
          alignContent: 'flex-start',
          overflow: 'hidden',
        }}
      >
        {page.items.map((item, i) => (
          <React.Fragment key={i}>
            <dt
              style={{
                fontFamily: T.display,
                fontStyle: 'italic',
                fontSize: '26px',
                color: T.gold,
                margin: 0,
                lineHeight: 1.3,
              }}
            >
              {item.label}
            </dt>
            <dd
              style={{
                fontFamily: T.body,
                fontSize: '24px',
                lineHeight: 1.55,
                color: T.text,
                margin: 0,
              }}
            >
              {item.note}
            </dd>
          </React.Fragment>
        ))}
      </dl>
    </PageInner>
    <Watermark />
  </PageFrame>
);

const PoemPage: React.FC<{ page: Extract<Page, { kind: 'poem' }> }> = ({ page }) => (
  <PageFrame>
    <PageInner>
      <div style={{ flex: 1 }} />
      <p
        style={{
          fontFamily: T.display,
          fontStyle: 'italic',
          fontSize: '30px',
          lineHeight: 1.55,
          color: T.text,
          margin: 0,
          textAlign: 'center',
          maxWidth: '85%',
          alignSelf: 'center',
          whiteSpace: 'pre-wrap',
        }}
      >
        {page.text}
      </p>
      <div style={{ flex: 1.2 }} />
    </PageInner>
    <Watermark />
  </PageFrame>
);

const MapPage: React.FC<{ page: Extract<Page, { kind: 'map' }> }> = ({ page }) => (
  <PageFrame>
    <PageInner>
      <div style={{ flex: 1 }} />
      <div
        style={{
          fontFamily: T.display,
          fontWeight: 500,
          fontSize: '20px',
          letterSpacing: '0.32em',
          textTransform: 'uppercase',
          color: T.gold,
          marginBottom: '20px',
        }}
      >
        Region
      </div>
      {page.caption && (
        <h2
          style={{
            fontFamily: T.display,
            fontStyle: 'italic',
            fontWeight: 400,
            fontSize: '40px',
            lineHeight: 1.15,
            color: T.text,
            margin: '0 0 36px',
          }}
        >
          {page.caption}
        </h2>
      )}
      <ul
        style={{
          fontFamily: T.body,
          fontSize: '27px',
          lineHeight: 1.7,
          color: T.text,
          margin: 0,
          padding: 0,
          listStyle: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: '8.1px',
        }}
      >
        {page.locations.map((loc, i) => (
          <li key={i} style={{ display: 'flex', alignItems: 'baseline', gap: '20px' }}>
            <span style={{ fontFamily: T.mono, fontSize: '18px', color: T.gold, opacity: 0.7, minWidth: '1.6em', letterSpacing: '0.05em' }}>
              {String(i + 1).padStart(2, '0')}
            </span>
            <span>{loc}</span>
          </li>
        ))}
      </ul>
      <div style={{ flex: 1.6 }} />
    </PageInner>
    <Watermark />
  </PageFrame>
);

const ListPage: React.FC<{ page: Extract<Page, { kind: 'list' }> }> = ({ page }) => (
  <PageFrame>
    <PageInner>
      <div
        style={{
          fontFamily: T.display,
          fontWeight: 500,
          fontSize: '20px',
          letterSpacing: '0.32em',
          textTransform: 'uppercase',
          color: T.gold,
          marginBottom: '16.2px',
        }}
      >
        {page.variant === 'timeline' ? 'Timeline' : 'Checklist'}
      </div>
      {page.title && (
        <h2
          style={{
            fontFamily: T.display,
            fontStyle: 'italic',
            fontWeight: 400,
            fontSize: '40px',
            lineHeight: 1.15,
            color: T.text,
            margin: '0 0 32.4px',
          }}
        >
          {page.title}
        </h2>
      )}
      <ul
        style={{
          fontFamily: T.body,
          fontSize: '26px',
          lineHeight: 1.55,
          color: T.text,
          margin: 0,
          padding: 0,
          listStyle: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: '16.2px',
          flex: 1,
          overflow: 'hidden',
        }}
      >
        {page.items.map((item, i) => (
          <li key={i} style={{ display: 'flex', alignItems: 'baseline', gap: '20px' }}>
            <span
              aria-hidden="true"
              style={{
                width: 12,
                height: 12,
                border: `1px solid ${T.gold}`,
                borderRadius: page.variant === 'timeline' ? '50%' : 0,
                opacity: 0.5,
                flexShrink: 0,
                marginTop: 4,
              }}
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </PageInner>
    <Watermark />
  </PageFrame>
);

// Embed page: shows a static thumbnail + caption. Embed rendering on Instagram
// shares becomes a still image with a play-icon overlay; on the live reader we
// could lazy-load the actual iframe but for shareability the still is correct.
const EmbedPage: React.FC<{ page: Extract<Page, { kind: 'embed' }> }> = ({ page }) => {
  // Real video thumbnails will go here once Cloudinary/real externalIds are
  // wired in. For now: typographic plate with a play affordance — no stock
  // YouTube thumbnail.
  return (
    <PageFrame>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: `
            radial-gradient(ellipse 80% 60% at 50% 30%, rgba(184,146,78,0.08) 0%, transparent 65%),
            linear-gradient(180deg, rgba(40,33,26,0.4) 0%, rgba(24,19,14,0.85) 100%)
          `,
        }}
      />
      {/* concentric ring ornament behind the play icon */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '38%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '52%',
          aspectRatio: '1/1',
          borderRadius: '50%',
          border: '1px solid rgba(184,146,78,0.18)',
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '38%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '34%',
          aspectRatio: '1/1',
          borderRadius: '50%',
          border: '1px solid rgba(184,146,78,0.28)',
        }}
      />
      <PageInner>
        <div style={{ flex: 1 }} />
        <div
          aria-hidden="true"
          style={{
            alignSelf: 'center',
            width: '96px',
            height: '96px',
            borderRadius: '50%',
            border: `1.5px solid ${T.gold}`,
            background: 'rgba(24,19,14,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            zIndex: 2,
          }}
        >
          <span className="ml-1" style={{ color: T.gold, fontSize: '36px', lineHeight: 1 }}>▶</span>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ position: 'relative', zIndex: 2 }}>
          {page.caption && (
            <div
              style={{
                fontFamily: T.display,
                fontStyle: 'italic',
                fontSize: '32px',
                lineHeight: 1.25,
                color: T.text,
                margin: 0,
                marginBottom: '16px',
              }}
            >
              {page.caption}
            </div>
          )}
          {page.description && (
            <div
              style={{
                fontFamily: T.body,
                fontSize: '24px',
                lineHeight: 1.5,
                color: T.textSec,
              }}
            >
              {page.description}
            </div>
          )}
          <div
            style={{
              fontFamily: T.mono,
              fontSize: '19px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: T.textDim,
              marginTop: '20px',
            }}
          >
            {page.platform === 'youtube' ? 'Video on YouTube' : 'Video on Instagram'}
          </div>
        </div>
      </PageInner>
      <Watermark />
    </PageFrame>
  );
};

const BackMatterPage: React.FC<{ page: Extract<Page, { kind: 'back_matter' }> }> = ({ page }) => (
  <PageFrame>
    <PageInner>
      <div style={{ flex: 1 }} />
      <div
        style={{
          fontFamily: T.display,
          fontWeight: 500,
          fontSize: '20px',
          letterSpacing: '0.32em',
          textTransform: 'uppercase',
          color: T.gold,
          marginBottom: '28px',
          textAlign: 'center',
        }}
      >
        {page.variant === 'dedication' ? 'Dedication' : 'Colophon'}
      </div>
      <div
        style={{
          fontFamily: T.body,
          fontStyle: page.variant === 'dedication' ? 'italic' : 'normal',
          fontSize: '24px',
          lineHeight: 1.7,
          color: T.textSec,
          textAlign: 'center',
          alignSelf: 'center',
          maxWidth: '88%',
        }}
      >
        {page.lines.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>
      <div style={{ flex: 1.4 }} />
    </PageInner>
    <Watermark />
  </PageFrame>
);

// ─── Image variants — extend ImagePage to handle multi-image layouts ─────────
const MultiImagePage: React.FC<{ page: Extract<Page, { kind: 'image' }> }> = ({ page }) => {
  const variant = page.variant;
  const imgs = page.images ?? (page.url ? [page.url] : []);
  if (!imgs.length) return null;

  // Stock placeholder → render typographic plate with the variant's geometric
  // ornament. Real photography (non-Unsplash URLs) takes the original path.
  const allStock = imgs.every(isStockImage);
  if (allStock) {
    const ornamentMap: Record<string, PlateProps['ornament']> = {
      split_vertical: 'split',
      film_strip: 'strip',
      polaroid_scatter: 'scatter',
      circle_mask: 'circle',
      arch_mask: 'arch',
      full_bleed: 'square',
      caption_bottom: 'square',
    };
    const ornament = ornamentMap[variant ?? ''] ?? 'square';
    return (
      <PageFrame>
        <Plate
          kicker="Plate"
          caption={page.caption || page.alt}
          ornament={ornament}
          index={imgs[0]?.length ?? 0}
        />
        <Watermark />
      </PageFrame>
    );
  }

  // split_vertical: two images side-by-side
  if (variant === 'split_vertical') {
    return (
      <PageFrame>
        <PageInner padded={false}>
          <div style={{ flex: 1, display: 'flex' }}>
            {imgs.slice(0, 2).map((url, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  backgroundImage: `url("${url}")`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  borderRight: i === 0 ? `1px solid ${T.bg}` : 'none',
                }}
                aria-hidden="true"
              />
            ))}
          </div>
          {page.caption && (
            <div
              style={{
                padding: '27px 60.8px',
                fontFamily: T.mono,
                fontSize: '20px',
                color: T.textDim,
                background: T.bg,
                borderTop: `1px solid ${T.border}`,
              }}
            >
              {page.caption}
            </div>
          )}
        </PageInner>
        <Watermark />
      </PageFrame>
    );
  }

  // film_strip: vertical sequence of images with thin gaps
  if (variant === 'film_strip') {
    return (
      <PageFrame>
        <PageInner padded={false}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1, padding: '27px' }}>
            {imgs.slice(0, 4).map((url, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  backgroundImage: `url("${url}")`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  filter: 'saturate(0.85) brightness(0.92)',
                }}
                aria-hidden="true"
              />
            ))}
          </div>
        </PageInner>
        <Watermark />
      </PageFrame>
    );
  }

  // polaroid_scatter: 3-4 images at slight rotations
  if (variant === 'polaroid_scatter') {
    const rotations = ['-3deg', '2deg', '-1.5deg', '4deg'];
    return (
      <PageFrame>
        <PageInner>
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            {imgs.slice(0, 4).map((url, i) => {
              const positions: React.CSSProperties[] = [
                { top: '8%', left: '6%' },
                { top: '12%', right: '6%' },
                { bottom: '14%', left: '10%' },
                { bottom: '8%', right: '8%' },
              ];
              return (
                <div
                  key={i}
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    width: '46%',
                    aspectRatio: '4/5',
                    background: '#fff',
                    padding: '13.5px 13.5px 40.5px',
                    boxShadow: '0 6px 16px rgba(0,0,0,0.5)',
                    transform: `rotate(${rotations[i]})`,
                    ...positions[i],
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      backgroundImage: `url("${url}")`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  />
                </div>
              );
            })}
          </div>
        </PageInner>
        <Watermark />
      </PageFrame>
    );
  }

  // circle_mask: image rendered inside a circle, centered
  if (variant === 'circle_mask') {
    return (
      <PageFrame>
        <PageInner>
          <div style={{ flex: 1 }} />
          <div
            aria-hidden="true"
            style={{
              alignSelf: 'center',
              width: '72%',
              aspectRatio: '1/1',
              borderRadius: '50%',
              backgroundImage: `url("${imgs[0]}")`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              boxShadow: '0 12px 32px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(200,170,120,0.15)',
            }}
          />
          {page.caption && (
            <div
              style={{
                fontFamily: T.mono,
                fontSize: '20px',
                color: T.textDim,
                textAlign: 'center',
                marginTop: '36px',
                letterSpacing: '0.04em',
              }}
            >
              {page.caption}
            </div>
          )}
          <div style={{ flex: 1 }} />
        </PageInner>
        <Watermark />
      </PageFrame>
    );
  }

  // arch_mask: image inside arched (top-rounded) frame
  if (variant === 'arch_mask') {
    return (
      <PageFrame>
        <PageInner>
          <div style={{ flex: 1 }} />
          <div
            aria-hidden="true"
            style={{
              alignSelf: 'center',
              width: '78%',
              aspectRatio: '3/4',
              borderRadius: '50% 50% 4px 4px / 30% 30% 4px 4px',
              backgroundImage: `url("${imgs[0]}")`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
            }}
          />
          {page.caption && (
            <div
              style={{
                fontFamily: T.mono,
                fontSize: '20px',
                color: T.textDim,
                textAlign: 'center',
                marginTop: '28px',
                letterSpacing: '0.04em',
              }}
            >
              {page.caption}
            </div>
          )}
          <div style={{ flex: 0.6 }} />
        </PageInner>
        <Watermark />
      </PageFrame>
    );
  }

  // Default: full-bleed (existing ImagePage handles this)
  return <ImagePage page={page} />;
};

// ─── Dispatcher ──────────────────────────────────────────────────────────────

const PageDispatch: React.FC<{ page: Page }> = ({ page }) => {
  switch (page.kind) {
    // Synthetic
    case 'cover':           return <CoverPage page={page} />;
    case 'masthead':        return <MastheadPage page={page} />;
    case 'colophon':        return <ColophonPage page={page} />;
    case 'end':             return <EndPage page={page} />;
    // Original kinds, kept as fallbacks (synthetic body never created now)
    case 'body':            return <BodyPage page={page} />;
    case 'section':         return <SectionPage page={page} />;
    case 'quote':           return <QuotePage page={page} />;
    case 'image':           return <MultiImagePage page={page} />;
    // New block-derived kinds
    case 'paragraph_styled':return <ParagraphStyledPage page={page} />;
    case 'block_cover':     return <CoverPage page={{ kind: 'cover', title: page.title, subtitle: page.subtitle, coverImage: page.image, mark: '茶' }} />;
    case 'block_chapter':   return <BlockChapterPage page={page} />;
    case 'qa':              return <QAPage page={page} />;
    case 'pull_sidebar':    return <PullSidebarPage page={page} />;
    case 'epilogue':        return <EpiloguePage page={page} />;
    case 'stat':            return <StatPage page={page} />;
    case 'definition':      return <DefinitionPage page={page} />;
    case 'recipe':          return <RecipePage page={page} />;
    case 'tasting_notes':   return <TastingNotesPage page={page} />;
    case 'poem':            return <PoemPage page={page} />;
    case 'map':             return <MapPage page={page} />;
    case 'list':            return <ListPage page={page} />;
    case 'embed':           return <EmbedPage page={page} />;
    case 'back_matter':     return <BackMatterPage page={page} />;
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

  // Read the restored page index synchronously so we don't start at 0 and
  // then jump (which causes the scroll-snap engine to animate across pages).
  const initialPage = useMemo(() => {
    if (!article) return 0;
    const saved = localStorage.getItem(`teajia_article_${article.id}`);
    if (!saved) return 0;
    const n = parseInt(saved, 10);
    return isNaN(n) || n <= 0 ? 0 : n;
  }, [article]);

  const [current, setCurrent] = useState(initialPage);
  const [showShare, setShowShare] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const restoredRef = useRef(false);

  // Sync state with the restored value when the article first loads.
  useEffect(() => {
    if (!article) return;
    setCurrent(initialPage);
    restoredRef.current = false;
  }, [article, initialPage]);

  useEffect(() => {
    if (!article) return;
    localStorage.setItem(`teajia_article_${article.id}`, String(current));
  }, [current, article]);

  // Restore scroll position synchronously, BEFORE the browser paints, with
  // scroll-snap temporarily disabled so the jump is instant and silent.
  // Runs once per article load (guarded by restoredRef).
  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el || total === 0 || restoredRef.current) return;
    if (initialPage <= 0 || initialPage >= total) {
      restoredRef.current = true;
      return;
    }
    const prevSnap = el.style.scrollSnapType;
    const prevBehavior = el.style.scrollBehavior;
    el.style.scrollSnapType = 'none';
    el.style.scrollBehavior = 'auto';
    el.scrollLeft = initialPage * el.clientWidth;
    // Re-enable snap on the next frame so the user's subsequent swipes work.
    requestAnimationFrame(() => {
      el.style.scrollSnapType = prevSnap || 'x mandatory';
      el.style.scrollBehavior = prevBehavior;
      restoredRef.current = true;
    });
  }, [total, initialPage]);

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
      if (e.key === 'Escape') {
        if (showShare) { setShowShare(false); return; }
        navigate('/read');
        return;
      }
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); scrollTo(Math.min(total - 1, current + 1)); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); scrollTo(Math.max(0, current - 1)); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, total, scrollTo, navigate, showShare]);

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
          onClick={() => navigate('/read')}
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

  // Article JSON-LD for AI/search — mirrors the Product schema on ProductPage.
  const articleSlug = (article as any).slug || article.id;
  const articleAuthor = article.author_name || formatAuthor(article.author_id);
  const articleStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    ...(description && { description }),
    ...(article.cover_image_url && { image: article.cover_image_url }),
    ...(article.published_at && { datePublished: article.published_at }),
    ...((article.updated_at || article.created_at) && { dateModified: article.updated_at || article.created_at }),
    ...(articleAuthor && { author: { '@type': 'Person', name: articleAuthor } }),
    publisher: { '@type': 'Organization', name: 'Teajia' },
    mainEntityOfPage: `https://teajia.com/article/${articleSlug}`,
  };

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
        <script type="application/ld+json">{JSON.stringify(articleStructuredData)}</script>
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
            onClick={() => navigate('/read')}
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
          <button
            onClick={() => setShowShare(true)}
            aria-label="Share"
            style={{
              color: T.textSec,
              padding: 10,
              background: 'none',
              border: 0,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 8a2 2 0 100-4 2 2 0 000 4zm8-4a2 2 0 100-4 2 2 0 000 4zm0 12a2 2 0 100-4 2 2 0 000 4zM5.6 7.2L10.4 4M5.6 8.8L10.4 12" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
            </svg>
          </button>
        </header>

        {showShare && (
          <SharePanel
            page={(pages[current] ?? null) as SharePage | null}
            article={article}
            onClose={() => setShowShare(false)}
          />
        )}

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
                  background: 'var(--tea-accent-sub)',
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
