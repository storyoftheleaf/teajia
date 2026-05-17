import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useQuery } from '@tanstack/react-query';
import { Story, ContentType, Person } from '../types';
import type { DbArticle } from '../types';
import { api } from '../lib/api';
import { LogoEmblem } from './Logos';
import { Icons } from './Icons';
import { ContributorDrawer } from './ContributorDrawer';

// ── Types ──────────────────────────────────────────────────────
type CardStyle = 'split' | 'hero' | 'mixed' | 'covers' | 'offset' | 'zigzag';
type MagazineTab = 'articles' | 'visual' | 'tea-inspire';

// A lightweight preview shape shared between code-defined stories and DB articles.
// DB articles carry `isDbArticle: true` and a `slug` so the click handler can
// route to /article/:slug instead of opening the overlay viewer.
export interface FeedItem {
  id: string;
  title: string;
  subtitle: string;
  thumbnailUrl?: string;
  durationOrTime: string;
  category?: string;
  type: ContentType;
  status: 'published';
  author?: Person;
  publishedDate?: string;
  // DB-article extras
  isDbArticle?: true;
  slug?: string;
}

function dbArticleToFeedItem(a: DbArticle): FeedItem {
  return {
    id: a.id,
    title: a.title,
    subtitle: a.subtitle ?? '',
    thumbnailUrl: a.cover_image_url,
    durationOrTime: a.reading_time_mins ? `${a.reading_time_mins} min` : '',
    category: a.category,
    type: ContentType.Article,
    status: 'published',
    author: a.author_id
      ? { id: a.author_id, name: a.author_name ?? '', role: '', bio: '' }
      : undefined,
    publishedDate: a.published_at ?? a.created_at,
    isDbArticle: true,
    slug: a.slug,
  };
}

interface MagazineTabbedProps {
  stories: Story[];
  savedStoryIds: Record<string, boolean>;
  watchedStoryIds: Record<string, boolean>;
  onCardClick: (story: Story) => void;
  onToggleSave: (id: string) => void;
  onShare: (story: Story) => void;
  defaultTab?: MagazineTab;
  onCartClick?: () => void;
  onAccountClick?: () => void;
  cartItemCount?: number;
  isContentLoading?: boolean;
}

// ── Helpers ────────────────────────────────────────────────────
function getStoryMark(story: FeedItem): string {
  if (story.type === ContentType.PhotoEssay) return '光';
  if (story.type === ContentType.Reel) return '音';
  if (story.type === ContentType.Audio) return '聲';
  const c = (story.category ?? '').toString().toLowerCase();
  switch (c) {
    case 'interview':   return '器';  // vessel — conversation
    case 'teaching':    return '師';  // teacher
    case 'journey':     return '山';  // mountain
    case 'reflection':  return '水';  // water
    case 'story':       return '時';  // time
    case 'field notes': return '岩';  // stone
    default:            return '文';  // letters — generic
  }
}

// Editorial register set — kept in sync with ArticleEditorModal CATEGORIES.
// These describe the *nature* of the reading (Interview, Teaching, Journey,
// Reflection, Story, Field Notes), not the format. Format previously lived
// in this switch (PhotoEssay / Reel / Audio) but is now ignored here — it
// belongs in a separate badge on the article page.
const EDITORIAL_REGISTERS = ['Interview', 'Teaching', 'Journey', 'Reflection', 'Story', 'Field Notes'] as const;

function getDisplayType(story: FeedItem): string | null {
  const c = (story.category ?? '').toString().trim();
  if (!c) return null;
  // Match case-insensitively against the canonical list; pass through unknowns
  // unchanged so legacy rows still render their existing label rather than
  // disappearing while migration is in flight.
  const match = EDITORIAL_REGISTERS.find(r => r.toLowerCase() === c.toLowerCase());
  return match ?? c;
}

const PH_GRADIENT =
  'repeating-linear-gradient(-42deg,rgba(184,146,78,0.08) 0 1px,transparent 1px 14px),' +
  'radial-gradient(ellipse 80% 60% at 30% 30%,rgba(184,146,78,0.15),transparent 60%),' +
  'radial-gradient(ellipse 60% 70% at 75% 70%,rgba(90,60,30,0.4),transparent 60%),' +
  'linear-gradient(160deg,#3a2c1e,#1f1813 70%)';

// Editorial eyebrow — Cormorant italic small-caps, bronze.
// Replaces the Jakarta-uppercase chrome that read as dashboard label.
// Small-caps gives the museum-caption / wine-list register the brand wants.
const EYEBROW_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: 15,
  fontStyle: 'italic',
  fontWeight: 500,
  fontVariant: 'all-small-caps',
  letterSpacing: '0.05em',
  color: 'var(--tea-gold)',
};

// Technical metadata — read time, dates. Reserved for genuinely technical readout.
const MONO_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  letterSpacing: '0.04em',
  color: 'var(--tea-text-dim)',
};

// Editorial byline — Lora italic, prefixed with "by". Distinct voice from
// the technical mono readout above.
const BYLINE_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 13,
  fontStyle: 'italic',
  fontWeight: 400,
  color: 'var(--tea-text-sec)',
};

// Promoted byline — sits above the title as the primary signpost.
// Clickable name routes to the contributor drawer; click is stopped from
// bubbling to the parent card click handler.
//
// Note: rendered as a span (not button) because it lives inside the card's
// outer <button>. Nested interactive controls aren't ideal HTML; a future
// pass should convert the card outer to a clickable div.
function Byline({
  author,
  onAuthorClick,
  className = '',
  style,
}: {
  author: Person;
  onAuthorClick: (p: Person) => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={className} style={{ ...BYLINE_STYLE, ...style }}>
      <span style={{ color: 'var(--tea-text-dim)' }}>by </span>
      <span
        role="link"
        tabIndex={0}
        onClick={(e) => { e.stopPropagation(); onAuthorClick(author); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            onAuthorClick(author);
          }
        }}
        className="cursor-pointer hover:text-tea-gold transition-colors"
        style={{ borderBottom: '1px solid transparent', paddingBottom: 1 }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLSpanElement).style.borderBottomColor = 'var(--tea-gold)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLSpanElement).style.borderBottomColor = 'transparent'; }}
      >
        {author.name}
      </span>
    </div>
  );
}

// ── StoryImage ─────────────────────────────────────────────────
interface StoryImageProps {
  src?: string;
  aspectRatio?: string;
  className?: string;
  style?: React.CSSProperties;
}

// Stock placeholders (Unsplash) are detected here too; they get replaced
// with a typographic card surface so previews stay on-brand. When real
// photography arrives, the original image path renders normally.
function isStockImage(url?: string | null): boolean {
  if (!url) return false;
  return /images\.unsplash\.com|source\.unsplash\.com/i.test(url);
}

// Small ornamental surface used in card previews when no real photo exists.
// Lighter than the full-page Plate component used inside articles; tuned
// for thumbnail scale.
function CardOrnament({ seed = 0 }: { seed?: number }) {
  const variant = seed % 4;
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0"
      style={{
        background: `
          radial-gradient(ellipse 90% 60% at 30% 20%, rgba(184,146,78,0.08) 0%, transparent 65%),
          linear-gradient(135deg, rgba(40,33,26,0.7) 0%, rgba(24,19,14,0.92) 100%)
        `,
      }}
    >
      {variant === 0 && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '54%',
            aspectRatio: '1/1',
            borderRadius: '50%',
            border: '1px solid rgba(184,146,78,0.32)',
          }}
        />
      )}
      {variant === 1 && (
        <>
          <div style={{ position: 'absolute', top: '18%', left: '18%', right: '18%', bottom: '18%', border: '1px solid rgba(184,146,78,0.28)' }} />
          <div style={{ position: 'absolute', top: '42%', left: '42%', right: '42%', bottom: '42%', background: 'rgba(184,146,78,0.18)' }} />
        </>
      )}
      {variant === 2 && (
        <div
          style={{
            position: 'absolute',
            bottom: '12%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '54%',
            aspectRatio: '3/4',
            borderRadius: '50% 50% 2px 2px / 35% 35% 2px 2px',
            border: '1px solid rgba(184,146,78,0.32)',
            borderBottom: 'none',
          }}
        />
      )}
      {variant === 3 && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%) rotate(45deg)',
            width: '44%',
            aspectRatio: '1/1',
            border: '1px solid rgba(184,146,78,0.32)',
          }}
        />
      )}
      {/* fine grain */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.06,
          mixBlendMode: 'overlay',
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: '120px',
        }}
      />
    </div>
  );
}

function StoryImage({ src, aspectRatio = '3/4', className = '', style }: StoryImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  // Stock placeholder → render an ornament instead of fetching the photo.
  // Pseudo-stable seed from the URL string so the same card always shows
  // the same ornament variant (no shuffle on re-renders).
  if (isStockImage(src)) {
    const seed = src ? src.split('').reduce((a, c) => a + c.charCodeAt(0), 0) : 0;
    return (
      <div className={`relative overflow-hidden ${className}`} style={{ aspectRatio, ...style }}>
        <CardOrnament seed={seed} />
      </div>
    );
  }

  const hasImg = src && !error;
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ aspectRatio, ...style }}>
      {hasImg ? (
        <>
          {!loaded && <div className="absolute inset-0" style={{ background: PH_GRADIENT }} />}
          <img
            src={src}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover"
            style={{ filter: loaded ? 'brightness(1.02)' : 'saturate(0)', transition: 'filter 0.4s ease' }}
            onLoad={() => setLoaded(true)}
            onError={() => { setLoaded(true); setError(true); }}
          />
        </>
      ) : (
        <div className="absolute inset-0" style={{ background: PH_GRADIENT }} />
      )}
    </div>
  );
}

// ── MiniBarcode (decorative) ───────────────────────────────────
function MiniBarcode() {
  const bars: number[] = [];
  let seed = 13;
  for (let i = 0; i < 22; i++) { seed = (seed * 9301 + 49297) % 233280; bars.push(1 + (seed % 3)); }
  return (
    <div className="flex items-end" style={{ height: 20, gap: 2, opacity: 0.6 }}>
      {bars.map((w, i) => (
        <div key={i} style={{ width: w, height: i % 5 === 0 ? 20 : 16, background: 'var(--tea-text-dim)' }} />
      ))}
    </div>
  );
}

// ── LAYOUT: Editorial Split ────────────────────────────────────
// Default. Horizontal rows: portrait image left (38%), text right.
function EditorialSplit({ stories, onCardClick, onAuthorClick }: { stories: FeedItem[]; onCardClick: (s: FeedItem) => void; onAuthorClick: (p: Person) => void }) {
  return (
    <div className="max-w-2xl mx-auto px-5">
      {stories.map((story, i) => (
        <button
          key={story.id}
          onClick={() => onCardClick(story)}
          className="w-full text-left grid items-center py-5 border-b border-tea-border active:bg-tea-elevated/20 transition-colors duration-150"
          style={{ gridTemplateColumns: '38% 1fr', gap: 18, animation: `revealUp 0.45s ease-out ${i * 0.06}s both` }}
        >
          {/* Image with mark stamp */}
          <div className="relative">
            <StoryImage src={story.thumbnailUrl} aspectRatio="3/4" className="rounded-sm" />
            <div
              className="absolute pointer-events-none"
              style={{ bottom: 8, right: 8, fontFamily: "'Ma Shan Zheng','Noto Serif SC',cursive", fontSize: 42, color: 'var(--tea-gold)', opacity: 0.18, lineHeight: 0.8 }}
            >
              {getStoryMark(story)}
            </div>
          </div>

          {/* Text — three-line stack: eyebrow / title / byline */}
          <div className="flex flex-col justify-center min-w-0">
            {getDisplayType(story) && (
              <span style={{ ...EYEBROW_STYLE, marginBottom: 6 }}>{getDisplayType(story)}</span>
            )}
            <h3 style={{
              fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 400,
              fontSize: 'clamp(20px,5.5vw,26px)', lineHeight: 1.1,
              margin: 0, letterSpacing: '-0.005em', color: 'var(--tea-text)',
            }}>
              {story.title}
            </h3>
            {story.author?.name && (
              <Byline author={story.author} onAuthorClick={onAuthorClick} style={{ marginTop: 8 }} />
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

// ── LAYOUT: Hero Cards ─────────────────────────────────────────
// Full-bleed portrait cards, title overlaid at bottom.
function HeroCards({ stories, onCardClick, onAuthorClick }: { stories: FeedItem[]; onCardClick: (s: FeedItem) => void; onAuthorClick: (p: Person) => void }) {
  return (
    <div className="flex flex-col gap-5 px-5 max-w-2xl mx-auto">
      {stories.map((story, i) => (
        <button
          key={story.id}
          onClick={() => onCardClick(story)}
          className="w-full text-left relative overflow-hidden rounded-sm border border-tea-border active:opacity-90 transition-opacity"
          style={{ animation: `revealUp 0.5s ease-out ${i * 0.08}s both` }}
        >
          <StoryImage src={story.thumbnailUrl} aspectRatio="4/5" />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,transparent 35%,rgba(18,13,9,0.85))' }} />
          {/* Large mark watermark top-right */}
          <div
            className="absolute top-4 right-4 pointer-events-none"
            style={{ fontFamily: "'Ma Shan Zheng','Noto Serif SC',cursive", fontSize: 80, color: 'var(--tea-gold)', opacity: 0.2, lineHeight: 0.8 }}
          >
            {getStoryMark(story)}
          </div>
          {/* Overlay content — eyebrow / title / byline */}
          <div className="absolute left-0 right-0 bottom-0" style={{ padding: '18px 20px 22px' }}>
            {getDisplayType(story) && (
              <span style={{ ...EYEBROW_STYLE, marginBottom: 8, display: 'inline-block' }}>{getDisplayType(story)}</span>
            )}
            <h2 style={{
              fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 400,
              fontSize: 'clamp(28px,8vw,40px)', lineHeight: 1.05,
              margin: 0, letterSpacing: '-0.005em', color: 'var(--tea-text)',
            }}>
              {story.title}
            </h2>
            {story.author?.name && (
              <Byline author={story.author} onAuthorClick={onAuthorClick} style={{ marginTop: 10 }} />
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

// ── LAYOUT: Mixed Grid ─────────────────────────────────────────
// First article is a hero, rest are a 2-col grid.
function MixedGrid({ stories, onCardClick, onAuthorClick }: { stories: FeedItem[]; onCardClick: (s: FeedItem) => void; onAuthorClick: (p: Person) => void }) {
  const [hero, ...rest] = stories;
  return (
    <div className="max-w-2xl mx-auto px-5">
      {hero && (
        <button
          onClick={() => onCardClick(hero)}
          className="w-full text-left relative overflow-hidden rounded-sm border border-tea-border mb-4 active:opacity-90 transition-opacity"
          style={{ animation: 'revealUp 0.5s ease-out both' }}
        >
          <StoryImage src={hero.thumbnailUrl} aspectRatio="3/4" />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,transparent 40%,rgba(18,13,9,0.9))' }} />
          <div className="absolute left-0 right-0 bottom-0" style={{ padding: '18px 20px 22px' }}>
            {getDisplayType(hero) && (
              <span style={{ ...EYEBROW_STYLE, marginBottom: 8, display: 'inline-block' }}>{getDisplayType(hero)}</span>
            )}
            <h2 style={{
              fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 400,
              fontSize: 'clamp(28px,8vw,40px)', lineHeight: 1.05,
              margin: 0, color: 'var(--tea-text)',
            }}>
              {hero.title}
            </h2>
            {hero.author?.name && (
              <Byline author={hero.author} onAuthorClick={onAuthorClick} style={{ marginTop: 10 }} />
            )}
          </div>
        </button>
      )}
      <div className="grid grid-cols-2 gap-3.5">
        {rest.map((story, i) => (
          <button
            key={story.id}
            onClick={() => onCardClick(story)}
            className="flex flex-col text-left rounded-sm overflow-hidden border border-tea-border active:opacity-90 transition-opacity"
            style={{ animation: `revealUp 0.45s ease-out ${(i + 1) * 0.06}s both` }}
          >
            <StoryImage src={story.thumbnailUrl} aspectRatio="1/1" />
            <div style={{ padding: '12px 14px 16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
              {getDisplayType(story) && (
                <span style={{ ...EYEBROW_STYLE, marginBottom: 4 }}>{getDisplayType(story)}</span>
              )}
              <h3 style={{
                fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 400,
                fontSize: 20, lineHeight: 1.12, margin: 0, color: 'var(--tea-text)',
              }}>
                {story.title}
              </h3>
              {story.author?.name && (
                <Byline author={story.author} onAuthorClick={onAuthorClick} style={{ marginTop: 6 }} />
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── LAYOUT: Stacked Covers ─────────────────────────────────────
// Each card looks like a mini magazine cover with masthead, mark, and barcode.
function StackedCovers({ stories, onCardClick, onAuthorClick }: { stories: FeedItem[]; onCardClick: (s: FeedItem) => void; onAuthorClick: (p: Person) => void }) {
  return (
    <div className="flex flex-col gap-6 px-5 max-w-2xl mx-auto">
      {stories.map((story, i) => (
        <button
          key={story.id}
          onClick={() => onCardClick(story)}
          className="w-full text-left relative overflow-hidden active:opacity-90 transition-opacity"
          style={{
            borderRadius: 2,
            border: '1px solid var(--tea-border)',
            animation: `revealUp 0.5s ease-out ${i * 0.07}s both`,
          }}
        >
          <StoryImage src={story.thumbnailUrl} aspectRatio="5/7" />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,transparent 30%,rgba(18,13,9,0.5) 60%,rgba(18,13,9,0.95))' }} />
          {/* Masthead bar */}
          <div
            className="absolute top-0 left-0 right-0 flex justify-between items-center"
            style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--tea-border)' }}
          >
            <span style={{ ...MONO_STYLE, fontSize: 9.5, color: 'var(--tea-gold)', letterSpacing: '0.2em' }}>TEAJIA</span>
            <span style={MONO_STYLE}>The Magazine</span>
          </div>
          {/* Centered mark */}
          <div
            className="absolute pointer-events-none"
            style={{
              top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
              fontFamily: "'Ma Shan Zheng','Noto Serif SC',cursive",
              fontSize: 160, color: 'var(--tea-gold)', opacity: 0.14, lineHeight: 0.8,
            }}
          >
            {getStoryMark(story)}
          </div>
          {/* Bottom content — eyebrow / title / byline, with cover barcode below */}
          <div className="absolute left-0 right-0 bottom-0" style={{ padding: '16px 18px 20px' }}>
            {getDisplayType(story) && (
              <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                <div style={{ width: 18, height: 1, background: 'var(--tea-gold)' }} />
                <span style={EYEBROW_STYLE}>{getDisplayType(story)}</span>
              </div>
            )}
            <h2 style={{
              fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 400,
              fontSize: 'clamp(26px,7.5vw,38px)', lineHeight: 1.05,
              margin: 0, color: 'var(--tea-text)',
            }}>
              {story.title}
            </h2>
            {story.author?.name && (
              <Byline author={story.author} onAuthorClick={onAuthorClick} style={{ marginTop: 8 }} />
            )}
            <div className="flex justify-end" style={{ marginTop: 12 }}>
              <MiniBarcode />
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

// ── LAYOUT: Offset Inset ───────────────────────────────────────
// Small image floated right, text wraps naturally. Asymmetric warmth.
function OffsetInset({ stories, onCardClick, onAuthorClick }: { stories: FeedItem[]; onCardClick: (s: FeedItem) => void; onAuthorClick: (p: Person) => void }) {
  return (
    <div className="max-w-2xl mx-auto px-5">
      {stories.map((story, i) => (
        <button
          key={story.id}
          onClick={() => onCardClick(story)}
          className="w-full text-left block py-6 border-b border-tea-border active:bg-tea-elevated/20 transition-colors duration-150"
          style={{ animation: `revealUp 0.45s ease-out ${i * 0.06}s both` }}
        >
          {/* Floated image inset */}
          <div style={{ float: 'right', width: 100, height: 130, marginLeft: 18, marginBottom: 8, position: 'relative' }}>
            <div className="w-full h-full relative overflow-hidden rounded-sm" style={{ background: PH_GRADIENT }}>
              {story.thumbnailUrl && !isStockImage(story.thumbnailUrl) && (
                <img src={story.thumbnailUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
              )}
              {story.thumbnailUrl && isStockImage(story.thumbnailUrl) && (
                <CardOrnament seed={story.thumbnailUrl.length} />
              )}
            </div>
            <div
              className="absolute pointer-events-none"
              style={{ top: -8, left: -8, fontFamily: "'Ma Shan Zheng','Noto Serif SC',cursive", fontSize: 36, color: 'var(--tea-gold)', opacity: 0.2, lineHeight: 0.8 }}
            >
              {getStoryMark(story)}
            </div>
          </div>

          {getDisplayType(story) && (
            <span style={{ ...EYEBROW_STYLE, marginBottom: 6, display: 'inline-block' }}>{getDisplayType(story)}</span>
          )}
          <h3 style={{
            fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 400,
            fontSize: 'clamp(22px,6vw,30px)', lineHeight: 1.08,
            margin: 0, letterSpacing: '-0.005em', color: 'var(--tea-text)', clear: 'both',
          }}>
            {story.title}
          </h3>
          {story.author?.name && (
            <Byline author={story.author} onAuthorClick={onAuthorClick} style={{ marginTop: 8, clear: 'both' }} />
          )}
        </button>
      ))}
    </div>
  );
}

// ── LAYOUT: Alternating Margin ─────────────────────────────────
// Zig-zag: even rows image-left/text-right, odd rows text-left/image-right.
function AlternatingMargin({ stories, onCardClick, onAuthorClick }: { stories: FeedItem[]; onCardClick: (s: FeedItem) => void; onAuthorClick: (p: Person) => void }) {
  return (
    <div className="max-w-2xl mx-auto px-5">
      {stories.map((story, i) => {
        const imgLeft = i % 2 === 0;
        return (
          <button
            key={story.id}
            onClick={() => onCardClick(story)}
            className="w-full text-left grid items-center py-5 border-b border-tea-border active:bg-tea-elevated/20 transition-colors duration-150"
            style={{
              gridTemplateColumns: imgLeft ? '40% 1fr' : '1fr 40%',
              gap: 18,
              animation: `revealUp 0.45s ease-out ${i * 0.06}s both`,
            }}
          >
            {imgLeft && (
              <div className="relative">
                <StoryImage src={story.thumbnailUrl} aspectRatio="3/4" className="rounded-sm" />
                <div
                  className="absolute pointer-events-none"
                  style={{ bottom: 8, right: 8, fontFamily: "'Ma Shan Zheng','Noto Serif SC',cursive", fontSize: 48, color: 'var(--tea-gold)', opacity: 0.16, lineHeight: 0.8 }}
                >
                  {getStoryMark(story)}
                </div>
              </div>
            )}
            <div className="flex flex-col justify-center min-w-0">
              {getDisplayType(story) && (
                <span style={{ ...EYEBROW_STYLE, marginBottom: 6 }}>{getDisplayType(story)}</span>
              )}
              <h3 style={{
                fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 400,
                fontSize: 'clamp(20px,5.8vw,28px)', lineHeight: 1.08,
                margin: 0, letterSpacing: '-0.005em', color: 'var(--tea-text)',
              }}>
                {story.title}
              </h3>
              {story.author?.name && (
                <Byline author={story.author} onAuthorClick={onAuthorClick} style={{ marginTop: 8 }} />
              )}
            </div>
            {!imgLeft && (
              <div className="relative">
                <StoryImage src={story.thumbnailUrl} aspectRatio="3/4" className="rounded-sm" />
                <div
                  className="absolute pointer-events-none"
                  style={{ bottom: 8, right: 8, fontFamily: "'Ma Shan Zheng','Noto Serif SC',cursive", fontSize: 48, color: 'var(--tea-gold)', opacity: 0.16, lineHeight: 0.8 }}
                >
                  {getStoryMark(story)}
                </div>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Tweaks Panel ───────────────────────────────────────────────
function TweaksPanel({
  cardStyle,
  onSetStyle,
  onClose,
}: {
  cardStyle: CardStyle;
  onSetStyle: (s: CardStyle) => void;
  onClose: () => void;
}) {
  const options: { k: CardStyle; n: string; d: string }[] = [
    { k: 'split',  n: 'Editorial split',  d: 'Image left, text right — clean rows' },
    { k: 'hero',   n: 'Hero cards',        d: 'Full-bleed image, one per scroll' },
    { k: 'mixed',  n: 'Mixed grid',        d: 'Hero + 2-col grid below' },
    { k: 'covers', n: 'Stacked covers',    d: 'Mini magazine-cover cards' },
    { k: 'offset', n: 'Offset inset',      d: 'Floated image, text wraps around' },
    { k: 'zigzag', n: 'Alternating',       d: 'Image zig-zags left/right' },
  ];

  return (
    <div
      className="fixed right-3.5 bottom-3.5 z-50 overflow-y-auto"
      style={{
        width: 280,
        maxHeight: 'calc(100vh - 100px)',
        background: 'rgba(28,22,18,0.96)',
        border: '1px solid var(--tea-border)',
        borderRadius: 4,
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        boxShadow: '0 20px 50px rgba(24,19,14,0.6)',
        padding: 18,
        animation: 'panelReveal 0.3s ease-out',
      }}
    >
      <div className="flex justify-between items-center mb-3.5">
        <div className="flex items-center gap-2">
          <LogoEmblem size={14} className="text-tea-gold opacity-80" />
          <span style={{ ...EYEBROW_STYLE, color: 'var(--tea-gold)' }}>Layout</span>
        </div>
        <button onClick={onClose} className="text-tea-text-sec hover:text-tea-text transition-colors text-sm">✕</button>
      </div>
      {options.map(o => (
        <button
          key={o.k}
          onClick={() => onSetStyle(o.k)}
          className="block w-full text-left mb-1.5 transition-colors duration-150"
          style={{
            padding: '10px 12px',
            background: cardStyle === o.k ? 'var(--tea-accent-sub)' : 'transparent',
            border: `1px solid ${cardStyle === o.k ? 'var(--tea-gold)' : 'var(--tea-border)'}`,
            borderRadius: 2,
          }}
        >
          <div style={{
            fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 17,
            color: cardStyle === o.k ? 'var(--tea-gold)' : 'var(--tea-text)',
          }}>
            {o.n}
          </div>
          <div style={MONO_STYLE}>{o.d}</div>
        </button>
      ))}
    </div>
  );
}

// ── Loading Skeleton ───────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-5 mt-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="grid items-center py-5 border-b border-tea-border animate-pulse"
          style={{ gridTemplateColumns: '38% 1fr', gap: 18 }}
        >
          <div className="rounded-sm bg-tea-surface" style={{ aspectRatio: '3/4' }} />
          <div className="flex flex-col gap-2">
            <div className="h-2 w-14 bg-tea-surface rounded-sm" />
            <div className="h-5 w-4/5 bg-tea-surface rounded-sm" />
            <div className="h-3 w-full bg-tea-elevated rounded-sm" />
            <div className="h-3 w-3/4 bg-tea-elevated rounded-sm" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────
export const MagazineTabbed: React.FC<MagazineTabbedProps> = ({
  stories,
  savedStoryIds: _savedStoryIds,
  watchedStoryIds: _watchedStoryIds,
  onCardClick,
  onToggleSave: _onToggleSave,
  onShare: _onShare,
  onCartClick,
  onAccountClick,
  cartItemCount = 0,
  isContentLoading = false,
}) => {
  const navigate = useNavigate();
  const [cardStyle, setCardStyle] = useState<CardStyle>(
    () => (localStorage.getItem('teajia.browse.style') as CardStyle | null) ?? 'split',
  );
  const [filter, setFilter] = useState('All');
  const [transitioning, setTransitioning] = useState(false);
  const [tweaksOpen, setTweaksOpen] = useState(false);
  const [selectedAuthor, setSelectedAuthor] = useState<Person | null>(null);

  // Fetch published DB articles
  const { data: dbArticles = [] } = useQuery<DbArticle[]>({
    queryKey: ['public-articles'],
    queryFn: () => api.articles.listPublished(20, 0),
    staleTime: 5 * 60 * 1000,
  });

  const setStyle = (s: CardStyle) => {
    setCardStyle(s);
    localStorage.setItem('teajia.browse.style', s);
  };

  // Magazine listing now sources exclusively from DB articles.
  // The legacy code-defined Story system has been retired; see
  // docs/_archive/ARTICLE_UNIFICATION_PLAN.md.
  const allPublished = useMemo<FeedItem[]>(() => {
    const dbItems: FeedItem[] = dbArticles.map(dbArticleToFeedItem);
    return [...dbItems].sort((a, b) => {
      if (a.publishedDate && b.publishedDate)
        return new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime();
      return 0;
    });
  }, [dbArticles]);

  // Unique filter labels derived from content (skip uncategorized)
  const filterTypes = useMemo(() => {
    const seen = new Set<string>();
    allPublished.forEach(s => {
      const t = getDisplayType(s);
      if (t) seen.add(t);
    });
    return ['All', ...Array.from(seen)];
  }, [allPublished]);

  const filtered = useMemo(() => {
    if (filter === 'All') return allPublished;
    return allPublished.filter(s => getDisplayType(s) === filter);
  }, [allPublished, filter]);

  const handleCardClick = (item: FeedItem) => {
    if (item.slug) navigate(`/article/${item.slug}`);
  };

  const FEEDS: Record<
    CardStyle,
    React.FC<{ stories: FeedItem[]; onCardClick: (s: FeedItem) => void; onAuthorClick: (p: Person) => void }>
  > = {
    split:  EditorialSplit,
    hero:   HeroCards,
    mixed:  MixedGrid,
    covers: StackedCovers,
    offset: OffsetInset,
    zigzag: AlternatingMargin,
  };
  const Feed = FEEDS[cardStyle];

  return (
    <div className="dark w-full min-h-screen flex flex-col">
      <Helmet>
        <title>Magazine — Teajia</title>
        <meta name="description" content="Long-form stories, photo essays, and deep dives into tea culture, craft, and the people behind the leaf." />
      </Helmet>

      {/* ── Top bar ── */}
      <div
        className="sticky top-0 z-dropdown flex items-center justify-between pt-[14px] pb-[12px] px-4 md:px-6 -mx-4 md:-mx-6 lg:h-16 lg:py-0 lg:px-10 lg:-mx-10 border-b border-tea-border"
        style={{
          background: 'rgba(24,19,14,0.9)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <h1
          className="font-serif font-normal text-2xl lg:text-3xl text-tea-text leading-tight tracking-[0.02em]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Magazine
        </h1>

        <div className="flex items-center">
          {onCartClick && (
            <button
              onClick={onCartClick}
              className="relative p-2.5 text-tea-text-sec hover:text-tea-text transition-colors"
              aria-label="Cart"
            >
              <Icons.Bag className="w-4 h-4" />
              {cartItemCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-3.5 h-3.5 bg-tea-gold rounded-full text-ui-8 font-sans font-semibold text-tea-bg flex items-center justify-center leading-none">
                  {cartItemCount}
                </span>
              )}
            </button>
          )}
          {onAccountClick && (
            <button
              onClick={onAccountClick}
              className="p-2.5 text-tea-text-sec hover:text-tea-text transition-colors"
              aria-label="Your Table"
            >
              <Icons.User className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setTweaksOpen(v => !v)}
            className={`p-2.5 transition-colors ${tweaksOpen ? 'text-tea-gold' : 'text-tea-text-sec hover:text-tea-text'}`}
            aria-label="Change layout"
          >
            <Icons.Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Masthead ── */}
      <div className="px-5 pt-5 max-w-2xl mx-auto w-full">
        <div className="flex items-center gap-2.5 mb-3.5">
          <div style={{ width: 24, height: 1, background: 'var(--tea-gold)', flexShrink: 0 }} />
          <span style={{ ...EYEBROW_STYLE, fontSize: 16, letterSpacing: '0.08em' }}>The Magazine · Spring 2026</span>
        </div>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 400,
          fontSize: 'clamp(38px,10vw,56px)', lineHeight: 0.95,
          margin: '0 0 10px', letterSpacing: '-0.01em', color: 'var(--tea-text)',
        }}>
          Voices in Tea
        </h1>
        <p style={{ fontSize: 17, lineHeight: 1.55, color: 'var(--tea-text-sec)', margin: '0 0 24px', maxWidth: '36ch', fontFamily: 'var(--font-body)' }}>
          Stories of the people, places, and practices behind the cup.
        </p>
      </div>

      {/* ── Filter row ── Typographic, not pill-shaped: museum-caption register.
          Items separated by a hairline; active item is bronze + underlined. */}
      <nav
        aria-label="Filter articles"
        className="flex items-baseline max-w-2xl mx-auto w-full"
        style={{ padding: '0 20px 22px', overflowX: 'auto', scrollbarWidth: 'none' }}
      >
        {filterTypes.map((t, i) => {
          const active = filter === t;
          return (
            <React.Fragment key={t}>
              {i > 0 && (
                <span
                  aria-hidden="true"
                  className="flex-none"
                  style={{
                    width: 1,
                    height: 12,
                    background: 'var(--tea-border)',
                    margin: '0 14px',
                    alignSelf: 'center',
                  }}
                />
              )}
              <button
                onClick={() => setFilter(t)}
                className="flex-none transition-colors duration-200"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontStyle: 'italic',
                  fontWeight: active ? 500 : 400,
                  fontVariant: 'all-small-caps',
                  fontSize: 15,
                  letterSpacing: '0.04em',
                  color: active ? 'var(--tea-gold)' : 'var(--tea-text-sec)',
                  borderBottom: `1px solid ${active ? 'var(--tea-gold)' : 'transparent'}`,
                  paddingBottom: 2,
                  whiteSpace: 'nowrap',
                  background: 'transparent',
                }}
                onMouseEnter={e => {
                  if (!active) (e.currentTarget as HTMLButtonElement).style.color = 'var(--tea-text)';
                }}
                onMouseLeave={e => {
                  if (!active) (e.currentTarget as HTMLButtonElement).style.color = 'var(--tea-text-sec)';
                }}
              >
                {t}
              </button>
            </React.Fragment>
          );
        })}
      </nav>

      {/* ── Article feed ── */}
      <div className="flex-1 pb-[calc(44px+env(safe-area-inset-bottom,0px))] lg:pb-12">
        {isContentLoading ? (
          <LoadingSkeleton />
        ) : filtered.length > 0 ? (
          <Feed stories={filtered} onCardClick={handleCardClick} onAuthorClick={setSelectedAuthor} />
        ) : (
          <div className="flex flex-col items-center justify-center py-24 px-4">
            <p className="font-display text-xl italic text-tea-text mb-2">Nothing here yet</p>
            <p className="font-body text-tea-text-sec text-sm text-center max-w-xs leading-relaxed">
              Stories are being prepared. Check back soon.
            </p>
          </div>
        )}
      </div>

      {/* ── Transition overlay ── */}
      <div
        className="fixed inset-0 z-50"
        style={{
          background: 'var(--tea-bg)',
          opacity: transitioning ? 1 : 0,
          transition: 'opacity 0.35s ease',
          pointerEvents: transitioning ? 'all' : 'none',
        }}
      />

      {/* ── Tweaks panel ── */}
      {tweaksOpen && (
        <TweaksPanel cardStyle={cardStyle} onSetStyle={setStyle} onClose={() => setTweaksOpen(false)} />
      )}

      {/* ── Contributor drawer ── */}
      {selectedAuthor && (
        <ContributorDrawer
          person={selectedAuthor}
          stories={stories}
          onClose={() => setSelectedAuthor(null)}
          onStoryClick={onCardClick}
        />
      )}
    </div>
  );
};
