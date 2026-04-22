import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Story } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

type PageKind = 'cover' | 'masthead' | 'divider' | 'body' | 'qa' | 'pull' | 'sidebar' | 'epilogue' | 'end';

interface QAPair {
  q: string;
  a: string;
}

interface SidebarItem {
  name: string;
  sub: string;
  note: string;
}

interface ArticlePage {
  kind: PageKind;
  label?: string;
  head?: string;
  body?: string[];
  image?: string;
  qas?: QAPair[];
  quote?: string;
  footer?: string;
  items?: SidebarItem[];
  tail?: string;
  numeral?: string;
  title?: string;
  sub?: string;
  mark?: string;
}

interface PlanEntry {
  kind: 'native' | 'chapter';
  page: ArticlePage;
  blocks?: string[];
  isFirstSub?: boolean;
  isLastSub?: boolean;
  subIndex?: number;
  subTotal?: number;
}

// ─── CSS tokens ───────────────────────────────────────────────────────────────

const T = {
  bg: 'var(--tea-bg)',
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

// ─── Content parser ───────────────────────────────────────────────────────────
// Converts story.content: string[] to structured ArticlePage[]

const MAX_CHARS_PER_PAGE = 480;

function parseStoryToPages(story: Story): ArticlePage[] {
  const content = story.content ?? [];
  const result: ArticlePage[] = [];
  let bodyAccumulator: string[] = [];
  let chapterCount = 0;

  const flushBody = () => {
    if (!bodyAccumulator.length) return;
    result.push({ kind: 'body', label: 'Reading', head: story.title, body: bodyAccumulator.slice() });
    bodyAccumulator = [];
  };

  // Magazine cover from story metadata
  result.push({ kind: 'cover', title: story.title, sub: story.subtitle, image: story.thumbnailUrl, mark: '器' });

  // Masthead from description
  if (story.description) {
    result.push({ kind: 'masthead', body: [story.description] });
  }

  content.forEach(item => {
    const m = item.match(/^:::(\w+):::([\s\S]*)/);
    const variant = m?.[1] ?? null;
    const rawBody = (m?.[2] ?? item).trim();
    if (!rawBody && !variant) return;

    // Cover variants — already built from story metadata
    if (variant === 'COVER_SPLIT' || variant === 'COVER_MAIN' || variant === 'COVER_MINIMAL' ||
        variant === 'COVER_TYPOGRAPHIC' || variant === 'COVER_PHOTO_INSET') return;

    // Chapter dividers
    if (variant === 'CHAPTER_BOLD' || variant === 'CHAPTER_MINIMAL' || variant === 'CHAPTER_CENTERED_SMALL' ||
        variant === 'CHAPTER_LARGE_NUMBER' || variant === 'CHAPTER_SPLIT' || variant === 'CHAPTER_IMAGE_BG') {
      flushBody();
      chapterCount++;
      const parts = rawBody.split('|');
      const numerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
      result.push({
        kind: 'divider',
        numeral: numerals[chapterCount - 1] ?? String(chapterCount),
        title: parts[0] || `Chapter ${chapterCount}`,
        sub: parts[1] || '',
      });
      return;
    }

    // Q&A interview blocks
    if (variant === 'MAGAZINE_INTERVIEW_Q_A') {
      flushBody();
      const pairs = parseQAPairs(rawBody);
      if (pairs.length) {
        result.push({ kind: 'qa', label: 'In Conversation', head: truncate(pairs[0].q, 55), qas: pairs });
      }
      return;
    }

    // Pull quotes
    if (variant === 'QUOTE_MINIMAL' || variant === 'QUOTE_BIG' || variant === 'QUOTE_CENTERED' ||
        variant === 'QUOTE_PULLOUT') {
      flushBody();
      const parts = rawBody.split('|');
      result.push({ kind: 'pull', label: 'On Tea', quote: parts[0], footer: parts[1] || '', mark: '水' });
      return;
    }

    // Sidebar / reference blocks
    if (variant === 'TEXT_SIDEBAR_RIGHT' || variant === 'TEXT_SIDEBAR_LEFT') {
      flushBody();
      const parts = rawBody.split('|');
      result.push({
        kind: 'sidebar',
        label: 'Reference',
        head: parts[0] || 'Notes',
        items: [{ name: parts[0] || '', sub: '', note: parts[1] || '' }],
        tail: '',
      });
      return;
    }

    // Epilogue
    if (variant === 'EPILOGUE_CENTERED') {
      flushBody();
      result.push({ kind: 'epilogue', label: 'Coda', head: 'Postscript', body: [rawBody] });
      return;
    }

    // Copyright / end matter — skip
    if (variant === 'COPYRIGHT_PAGE') return;

    // Image-only blocks — skip (no real images in placeholder mode)
    if (variant && (variant.startsWith('IMG_') || variant === 'IMG_WITH_CAPTION_BOTTOM' ||
        variant === 'IMG_FILM_STRIP_VERTICAL' || variant === 'IMG_ARCH_MASK' ||
        variant === 'IMG_POLAROID_SCATTER')) return;

    // Regular text — accumulate paragraphs
    const parts = rawBody.split('|');
    parts.forEach(p => {
      const text = p.trim();
      if (text && !text.startsWith('http')) bodyAccumulator.push(text);
    });
  });

  flushBody();
  result.push({ kind: 'end' });
  return result;
}

function parseQAPairs(text: string): QAPair[] {
  const lines = text.split('\n').filter(l => l.trim());
  const pairs: QAPair[] = [];
  let q = '';

  lines.forEach(line => {
    const parts = line.split('|');
    if (parts.length < 2) return;
    const content = parts.slice(1).join('|').trim();
    if (!q) { q = content; }
    else { pairs.push({ q, a: content }); q = ''; }
  });

  return pairs;
}

function splitBodyIntoSubPages(paragraphs: string[]): string[][] {
  const pages: string[][] = [];
  let current: string[] = [];
  let chars = 0;

  paragraphs.forEach(p => {
    if (current.length > 0 && chars + p.length > MAX_CHARS_PER_PAGE) {
      pages.push(current);
      current = [];
      chars = 0;
    }
    current.push(p);
    chars += p.length;
  });

  if (current.length) pages.push(current);
  return pages.length ? pages : [[]];
}

function buildPlan(pages: ArticlePage[]): PlanEntry[] {
  const plan: PlanEntry[] = [];

  pages.forEach(page => {
    if (page.kind === 'body' && page.body?.length) {
      const subs = splitBodyIntoSubPages(page.body);
      subs.forEach((blocks, idx) => {
        plan.push({
          kind: 'chapter', page, blocks,
          isFirstSub: idx === 0, isLastSub: idx === subs.length - 1,
          subIndex: idx, subTotal: subs.length,
        });
      });
    } else if (page.kind === 'qa' && page.qas?.length) {
      const MAX_QA = 1;
      for (let i = 0; i < page.qas.length; i += MAX_QA) {
        const chunk = page.qas.slice(i, i + MAX_QA);
        const total = Math.ceil(page.qas.length / MAX_QA);
        plan.push({
          kind: 'chapter', page: { ...page, qas: chunk },
          isFirstSub: i === 0, isLastSub: i + MAX_QA >= page.qas.length,
          subIndex: i / MAX_QA, subTotal: total,
        });
      }
    } else {
      plan.push({ kind: 'native', page });
    }
  });

  return plan;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1).trim() + '…' : s;
}

// ─── Primitive components ─────────────────────────────────────────────────────

function Flourish() {
  return (
    <svg width="88" height="10" viewBox="0 0 88 10" fill="none">
      <path d="M2 5h28M58 5h28" stroke={T.gold} strokeWidth="0.6" strokeLinecap="round" />
      <circle cx="44" cy="5" r="2" fill="none" stroke={T.gold} strokeWidth="0.6" />
      <circle cx="44" cy="5" r="0.8" fill={T.gold} />
    </svg>
  );
}

function PageDot({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Go to page"
      style={{
        width: active ? 22 : 6, height: 6, borderRadius: 4,
        background: active ? T.gold : T.textDim,
        opacity: active ? 1 : 0.4, transition: 'all .3s',
        border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0,
      }}
    />
  );
}

function ChineseMark({ char = '器', size = 220, opacity = 0.06 }: { char?: string; size?: number; opacity?: number }) {
  return (
    <span aria-hidden="true" style={{
      fontFamily: "'Ma Shan Zheng', cursive",
      fontSize: size, lineHeight: 1, color: T.gold, opacity,
      userSelect: 'none', pointerEvents: 'none', display: 'block',
    }}>
      {char}
    </span>
  );
}

function TeaLeaf({ size = 180, opacity = 0.1 }: { size?: number; opacity?: number }) {
  return (
    <svg width={size} height={size * 1.5} viewBox="0 0 80 120" fill="none"
         aria-hidden="true" style={{ display: 'block', color: T.gold, opacity }}>
      <path d="M40 6 C22 20,10 48,16 78 C22 102,34 116,40 118 C46 116,58 102,64 78 C70 48,58 20,40 6Z"
            stroke="currentColor" strokeWidth="0.7" />
      <line x1="40" y1="6" x2="40" y2="118" stroke="currentColor" strokeWidth="0.4" />
      <path d="M40 30 Q28 40 22 46" stroke="currentColor" strokeWidth="0.35" />
      <path d="M40 30 Q52 40 58 46" stroke="currentColor" strokeWidth="0.35" />
      <path d="M40 55 Q26 65 20 72" stroke="currentColor" strokeWidth="0.35" />
      <path d="M40 55 Q54 65 60 72" stroke="currentColor" strokeWidth="0.35" />
      <path d="M40 80 Q32 88 29 93" stroke="currentColor" strokeWidth="0.35" />
      <path d="M40 80 Q48 88 51 93" stroke="currentColor" strokeWidth="0.35" />
      <path d="M40 118 Q39 122 37 126" stroke="currentColor" strokeWidth="0.5" strokeLinecap="round" />
    </svg>
  );
}

function TeaBowl({ size = 180, opacity = 0.1 }: { size?: number; opacity?: number }) {
  return (
    <svg width={size} height={size * 0.75} viewBox="0 0 160 120" fill="none"
         aria-hidden="true" style={{ display: 'block', color: T.gold, opacity }}>
      <path d="M28 36 Q32 88 80 92 Q128 88 132 36Z" stroke="currentColor" strokeWidth="0.9" />
      <ellipse cx="80" cy="36" rx="52" ry="10" stroke="currentColor" strokeWidth="0.9" />
      <ellipse cx="80" cy="94" rx="28" ry="6" stroke="currentColor" strokeWidth="0.7" />
      <ellipse cx="80" cy="104" rx="60" ry="11" stroke="currentColor" strokeWidth="0.9" />
      <path d="M62 24 C60 17 64 11 62 5" stroke="currentColor" strokeWidth="0.7" strokeLinecap="round" />
      <path d="M80 20 C78 13 82 7 80 1"  stroke="currentColor" strokeWidth="0.7" strokeLinecap="round" />
      <path d="M98 24 C96 17 100 11 98 5" stroke="currentColor" strokeWidth="0.7" strokeLinecap="round" />
    </svg>
  );
}

function Barcode() {
  const bars: number[] = [];
  let seed = 7;
  for (let i = 0; i < 44; i++) { seed = (seed * 9301 + 49297) % 233280; bars.push(1 + (seed % 4)); }
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 36 }}>
      {bars.map((w, i) => (
        <div key={i} style={{ width: w, height: i % 7 === 0 ? 36 : 30, background: T.textSec, opacity: 0.75 }} />
      ))}
    </div>
  );
}

// ─── Shared layout constants ──────────────────────────────────────────────────

const wrap: React.CSSProperties = { maxWidth: 680, margin: '0 auto', padding: '24px 22px 40px', position: 'relative' };

const headStyle: React.CSSProperties = {
  fontFamily: T.display, fontStyle: 'italic', fontWeight: 400,
  fontSize: 'clamp(32px,8vw,44px)', lineHeight: 1.08, margin: '10px 0 4px',
  letterSpacing: '-0.01em', color: T.text,
};

const labelStyle: React.CSSProperties = {
  fontFamily: T.ui, fontSize: 10.5, fontWeight: 400,
  letterSpacing: '0.22em', textTransform: 'uppercase', color: T.textSec,
};

function GoldRule() {
  return <div style={{ width: 24, height: 1, background: T.gold, flexShrink: 0 }} />;
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '28px 0 14px' }}>
      <GoldRule />
      <span style={labelStyle}>{label}</span>
    </div>
  );
}

// ─── Page renderers ───────────────────────────────────────────────────────────

function CoverPage({ story }: { story: Story }) {
  return (
    <div style={{ position: 'relative', height: '100%', overflow: 'hidden', background: '#120d09' }}>
      {story.thumbnailUrl ? (
        <>
          <img
            src={story.thumbnailUrl}
            alt=""
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(18,13,9,0.1) 0%,rgba(18,13,9,0.55) 55%,rgba(18,13,9,0.98) 100%)' }} />
        </>
      ) : (
        <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(-42deg,rgba(184,146,78,0.08) 0 1px,transparent 1px 14px),linear-gradient(160deg,#3a2c1e,#1f1813 70%)' }} />
      )}

      {/* Giant Chinese mark */}
      <div style={{ position: 'absolute', top: 80, left: -30, pointerEvents: 'none' }}>
        <ChineseMark char="器" size={480} opacity={0.2} />
      </div>

      {/* Masthead band */}
      <div style={{ position: 'relative', padding: '22px 22px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(184,146,78,0.25)' }}>
        <span style={{ fontFamily: T.mono, fontSize: 10, color: T.gold }}>VOL.IV · SPR 26</span>
        <div style={{ fontFamily: T.display, fontWeight: 500, fontSize: 28, letterSpacing: '0.42em', color: T.gold, paddingLeft: '0.42em', textAlign: 'center' }}>TEAJIA</div>
        <span style={{ fontFamily: T.mono, fontSize: 10, color: T.gold }}>№ 04</span>
      </div>
      <div style={{ position: 'relative', padding: '8px 22px 0', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: T.mono, fontSize: 9, color: T.textDim, letterSpacing: '0.2em' }}>THE JOURNAL OF VESSELS &amp; VOICES</span>
        <span style={{ fontFamily: T.mono, fontSize: 9, color: T.textDim }}>SPRING 2026</span>
      </div>

      {/* Cover title anchored to bottom */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 110, padding: '0 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <GoldRule />
          <span style={{ ...labelStyle, color: T.gold }}>
            Cover Story · {story.category || 'Interview'}
          </span>
        </div>
        <h1 style={{
          fontFamily: T.display, fontWeight: 400, fontStyle: 'italic',
          fontSize: 'clamp(56px,17vw,120px)', lineHeight: 0.9, margin: '0 0 12px',
          letterSpacing: '-0.015em', textShadow: '0 2px 18px rgba(0,0,0,0.5)', color: T.text,
        }}>
          {story.title}
        </h1>
        {/* subtitle: font-body text-[17px] font-normal italic leading-[1.4] */}
        <p className="font-body text-[17px] font-normal italic leading-[1.4]" style={{ color: T.textSec, margin: '0 0 22px', maxWidth: '34ch' }}>
          {story.subtitle}
        </p>
      </div>

      {/* Bottom: barcode + price */}
      <div style={{ position: 'absolute', left: 22, right: 22, bottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <Barcode />
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: T.mono, fontSize: 9, color: T.textDim }}>ISSN 2970-4418</div>
          <div style={{ fontFamily: T.mono, fontSize: 9, color: T.textDim, marginTop: 2 }}>¥128 / $18 / €16</div>
        </div>
      </div>

      {/* Swipe hint */}
      <div style={{ position: 'absolute', right: 22, bottom: 66, display: 'flex', alignItems: 'center', gap: 8, color: T.gold }}>
        <span style={{ fontFamily: T.mono, fontSize: 10 }}>swipe</span>
        <div className="mpg-breath" style={{ width: 4, height: 4, borderRadius: 4, background: T.gold }} />
      </div>
    </div>
  );
}

function MastheadPage({ page, story }: { page: ArticlePage; story: Story }) {
  return (
    <div style={wrap}>
      <div style={{ paddingTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <TeaBowl size={110} opacity={0.28} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
          <Flourish />
        </div>
        <div style={{ height: 1, background: `linear-gradient(90deg,transparent,${T.border} 20%,${T.border} 80%,transparent)`, marginBottom: 28 }} />
        {/* label: font-sans text-[11px] uppercase tracking-[1.2px] */}
        <div className="font-sans text-[11px] font-normal uppercase tracking-[1.2px] leading-[1.4]" style={{ textAlign: 'center', marginBottom: 10, color: T.textSec }}>A letter before you begin</div>
        {/* h2: font-display text-[clamp(24px,3.5vw,32px)] font-medium leading-[1.2] */}
        <h2 className="font-display text-[clamp(24px,3.5vw,32px)] font-medium leading-[1.2] tracking-[0.01em]" style={{ fontStyle: 'italic', textAlign: 'center', margin: '0 0 28px', color: T.text }}>
          For the guest who stayed
        </h2>
        {/* body: font-body text-[17px] leading-[1.7] — responsive on mobile */}
        <p className="font-body text-[15px] md:text-[17px] font-normal leading-[1.7]" style={{ color: T.text }}>
          {page.body?.[0] ?? story.description}
        </p>
        {story.author && (
          <div style={{ marginTop: 32, display: 'flex', alignItems: 'center', gap: 10 }}>
            <GoldRule />
            <span style={{ fontFamily: T.body, fontStyle: 'italic', fontSize: 14, color: T.textSec }}>
              {story.author.name}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function DividerPage({ page }: { page: ArticlePage }) {
  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', padding: '40px 26px' }}>
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <div style={{ ...labelStyle, textAlign: 'center', marginBottom: 40, letterSpacing: '0.28em' }}>MOVEMENT</div>
        <div style={{
          fontFamily: T.display, fontStyle: 'italic', fontWeight: 300,
          fontSize: 'clamp(120px,32vw,200px)', lineHeight: 0.85, color: T.gold,
          margin: '0 0 30px', letterSpacing: '-0.02em',
        }}>
          {page.numeral}
        </div>
        <div style={{ width: 28, height: 1, background: T.gold, margin: '0 auto 26px' }} />
        <h2 style={{
          fontFamily: T.display, fontStyle: 'italic', fontWeight: 400,
          fontSize: 'clamp(36px,8vw,52px)', lineHeight: 1.1, margin: '0 0 16px', color: T.text,
        }}>
          {page.title}
        </h2>
        {page.sub && (
          <p style={{ fontFamily: T.body, fontSize: 16, lineHeight: 1.55, color: T.textSec, margin: 0, fontStyle: 'italic' }}>
            {page.sub}
          </p>
        )}
      </div>
    </div>
  );
}

function PullQuotePage({ page }: { page: ArticlePage }) {
  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', padding: '40px 22px', position: 'relative' }}>
      {/* Background Chinese mark */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <ChineseMark char={page.mark ?? '水'} size={340} opacity={0.05} />
      </div>
      <div style={{ width: '100%', maxWidth: 680, margin: '0 auto', position: 'relative' }}>
        {/* Large quote mark */}
        <div style={{
          position: 'absolute', top: -50, left: -8,
          fontFamily: T.display, fontStyle: 'italic', fontWeight: 400,
          fontSize: 220, lineHeight: 0.8, color: T.gold, opacity: 0.5,
          pointerEvents: 'none', letterSpacing: '-0.05em',
        }}>&ldquo;</div>
        {page.label && (
          <div style={{ ...labelStyle, color: T.gold, marginBottom: 28, position: 'relative' }}>
            {page.label}
          </div>
        )}
        <blockquote style={{
          fontFamily: T.display, fontStyle: 'italic', fontWeight: 400,
          fontSize: 'clamp(28px,6.5vw,46px)', lineHeight: 1.1, margin: 0,
          letterSpacing: '-0.015em', color: T.text, position: 'relative',
        }}>
          {page.quote}
        </blockquote>
        {page.footer && (
          <>
            <div style={{ width: 24, height: 1, background: T.gold, marginTop: 32, marginBottom: 16 }} />
            {/* label: attribution uses uppercase label style */}
            <p className="font-sans text-[11px] font-normal uppercase tracking-[1.2px] leading-[1.4]" style={{ color: T.textDim, maxWidth: '44ch', margin: 0 }}>
              {page.footer}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function QAPage({ entry }: { entry: PlanEntry }) {
  const { page, isFirstSub } = entry;
  return (
    <div style={{ ...wrap, height: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', right: -10, bottom: 20, pointerEvents: 'none', zIndex: 0 }}>
        <ChineseMark char="問" size={220} opacity={0.04} />
      </div>
      <div style={{ position: 'relative', zIndex: 1 }}>
        {isFirstSub ? (
          <>
            <SectionLabel label={page.label ?? 'In Conversation'} />
            {page.head && <h2 style={headStyle}>{page.head}</h2>}
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '28px 0 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <GoldRule />
              <span style={labelStyle}>{page.label} · continued</span>
            </div>
            <span style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim }}>
              {(entry.subIndex ?? 0) + 1}/{entry.subTotal}
            </span>
          </div>
        )}
        <div style={{ marginTop: 18 }}>
          {(page.qas ?? []).map((qa, n) => (
            <div key={n} style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <span style={{ fontFamily: T.display, fontStyle: 'italic', fontSize: 22, color: T.gold, flexShrink: 0, lineHeight: 1.3 }}>Q.</span>
                {/* Q: subtitle — italic body */}
                <p className="font-body text-[17px] font-normal italic leading-[1.4]" style={{ margin: 0, color: T.textSec }}>{qa.q}</p>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <span style={{ fontFamily: T.display, fontStyle: 'italic', fontSize: 22, color: T.text, flexShrink: 0, lineHeight: 1.3 }}>A.</span>
                {/* A: body — responsive size */}
                <p className="font-body text-[15px] md:text-[17px] font-normal leading-[1.7]" style={{ margin: 0, color: T.text }}>{qa.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BodyPage({ entry, story }: { entry: PlanEntry; story: Story }) {
  const { page, blocks = [], isFirstSub, subIndex = 0, subTotal = 1 } = entry;

  if (isFirstSub) {
    const hasThumb = !!story.thumbnailUrl;
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Hero zone — image or tea illustration */}
        <div style={{
          flex: '0 0 42%', position: 'relative', overflow: 'hidden',
          background: hasThumb ? undefined : 'linear-gradient(150deg,#2a1e12,#1a1209)',
        }}>
          {hasThumb ? (
            <img src={story.thumbnailUrl!} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
          ) : (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TeaLeaf size={130} opacity={0.32} />
            </div>
          )}
          {/* Fade to page bg at bottom */}
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg,transparent 30%,${T.bg} 100%)` }} />
          {/* Article label + title overlaid */}
          <div style={{ position: 'absolute', bottom: 0, left: 22, right: 22, paddingBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <GoldRule />
              <span style={{ ...labelStyle, color: T.gold }}>{page.label ?? 'Reading'}</span>
            </div>
            {page.head && (
              <h2 style={{ ...headStyle, fontSize: 'clamp(22px,5.5vw,32px)', margin: 0 }}>{page.head}</h2>
            )}
          </div>
        </div>
        {/* Text zone */}
        <div style={{ flex: 1, overflow: 'hidden', padding: '16px 22px 20px' }}>
          {blocks.map((text, n) => (
            <p key={n}
               className={`font-body text-[15px] md:text-[17px] font-normal leading-[1.7]${n === 0 ? ' drop-cap' : ''}`}
               style={{ margin: '0 0 14px', color: T.text }}>
              {text}
            </p>
          ))}
          {subTotal > 1 && (
            <div style={{ position: 'absolute', bottom: 14, right: 22 }}>
              <span style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim }}>1/{subTotal}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Subsequent sub-pages — watermark for visual depth
  return (
    <div style={{ ...wrap, height: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', right: -10, bottom: 30, pointerEvents: 'none', zIndex: 0 }}>
        <ChineseMark char="茶" size={240} opacity={0.05} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '28px 0 18px', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <GoldRule />
          <span style={labelStyle}>{page.label} · continued</span>
        </div>
        <span style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim }}>{subIndex + 1}/{subTotal}</span>
      </div>
      {blocks.map((text, n) => (
        <p key={n}
           className="font-body text-[15px] md:text-[17px] font-normal leading-[1.7]"
           style={{ margin: '0 0 14px', color: T.text, position: 'relative', zIndex: 1 }}>
          {text}
        </p>
      ))}
    </div>
  );
}

function SidebarPage({ page }: { page: ArticlePage }) {
  return (
    <div style={wrap}>
      <SectionLabel label={page.label ?? 'Reference'} />
      {page.head && <h2 style={headStyle}>{page.head}</h2>}
      <div style={{ marginTop: 24 }}>
        {(page.items ?? []).map((item, n) => (
          <div key={n} style={{ padding: '18px 0', borderTop: `1px solid ${T.border}` }}>
            {item.name && (
              <div style={{ fontFamily: T.display, fontStyle: 'italic', fontSize: 24, color: T.gold, marginBottom: 6 }}>
                {item.name}
              </div>
            )}
            <p style={{ fontFamily: T.body, fontSize: 15.5, lineHeight: 1.65, margin: 0, color: T.text }}>{item.note}</p>
          </div>
        ))}
        {page.tail && (
          <p style={{ fontFamily: T.body, fontSize: 15.5, lineHeight: 1.65, marginTop: 22, color: T.textSec, fontStyle: 'italic', borderTop: `1px solid ${T.border}`, paddingTop: 18 }}>
            {page.tail}
          </p>
        )}
      </div>
    </div>
  );
}

function EpiloguePage({ page }: { page: ArticlePage }) {
  return (
    <div style={{ ...wrap, paddingTop: 40 }}>
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <TeaLeaf size={80} opacity={0.3} />
        </div>
      </div>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <Flourish />
      </div>
      {page.label && (
        <div style={{ ...labelStyle, textAlign: 'center', marginBottom: 14 }}>{page.label}</div>
      )}
      {page.head && <h2 style={{ ...headStyle, textAlign: 'center' }}>{page.head}</h2>}
      {(page.body ?? []).map((t, n) => (
        <p key={n} className="font-body text-[15px] md:text-[17px] font-normal italic leading-[1.4]" style={{ margin: '0 0 16px', textAlign: 'center', color: T.text }}>{t}</p>
      ))}
    </div>
  );
}

function EndPage({ story }: { story: Story }) {
  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '40px 22px 60px' }}>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <TeaBowl size={100} opacity={0.3} />
        </div>
      </div>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <Flourish />
      </div>
      <div style={{ ...labelStyle, color: T.gold, textAlign: 'center', marginBottom: 14 }}>End of story</div>
      <h2 style={{ fontFamily: T.display, fontStyle: 'italic', fontWeight: 400, fontSize: 32, lineHeight: 1.15, textAlign: 'center', margin: '0 0 14px', color: T.text }}>
        {story.title}
      </h2>
      <p style={{ textAlign: 'center', fontFamily: T.body, color: T.textSec, fontSize: 15.5, lineHeight: 1.65, margin: '0 0 36px', maxWidth: '42ch', marginLeft: 'auto', marginRight: 'auto' }}>
        {story.subtitle}
      </p>
      <div style={{ textAlign: 'center', marginTop: 40 }}>
        <div style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: '0.2em', color: T.textDim }}>TEAJIA JOURNAL · ISSUE 04</div>
        {story.author && (
          <div style={{ fontFamily: T.mono, fontSize: 9, marginTop: 6, opacity: 0.7, color: T.textDim }}>By {story.author.name}</div>
        )}
      </div>
    </div>
  );
}

// ─── Share ────────────────────────────────────────────────────────────────────

type ShareComposition =
  | { type: 'quote'; content: string; footer?: string }
  | { type: 'passage'; head: string; text?: string }
  | { type: 'qa'; head: string; qa?: QAPair }
  | { type: 'cover'; title: string; subtitle?: string };

function compositionForPage(page: ArticlePage | null, story: Story): ShareComposition {
  if (!page || page.kind === 'cover' || page.kind === 'masthead' || page.kind === 'end') {
    return { type: 'cover', title: story.title, subtitle: story.subtitle };
  }
  if (page.kind === 'pull' && page.quote) {
    return { type: 'quote', content: page.quote, footer: page.footer };
  }
  if (page.kind === 'qa' && page.qas?.length) {
    return { type: 'qa', head: page.head ?? 'In Conversation', qa: page.qas[0] };
  }
  if ((page.kind === 'body' || page.kind === 'epilogue') && page.body?.length) {
    return { type: 'passage', head: page.head ?? story.title, text: page.body[0] };
  }
  if (page.kind === 'sidebar' && page.items?.length) {
    return { type: 'passage', head: page.head ?? story.title, text: page.items[0].note };
  }
  if (page.kind === 'divider') {
    return { type: 'passage', head: page.title ?? '', text: page.sub };
  }
  return { type: 'cover', title: story.title, subtitle: story.subtitle };
}

function shortPageLabel(page: ArticlePage | null): string {
  if (!page) return '—';
  if (page.kind === 'cover') return 'Cover';
  if (page.kind === 'masthead') return 'Letter before you begin';
  if (page.kind === 'end') return 'End of story';
  if (page.kind === 'divider') return `${page.numeral} · ${page.title}`;
  if (page.head) return page.head;
  if (page.quote) return '\u201c' + truncate(page.quote, 32) + '\u201d';
  return page.kind;
}

function trunc(s: string | undefined, n: number): string {
  if (!s) return '';
  return s.length > n ? s.slice(0, n - 1).trim() + '…' : s;
}

// Wraps text to fit maxWidth using the current canvas font context
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(test).width > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// Renders the share poster to an 800×1000 canvas using the page's loaded fonts
async function renderPosterToCanvas(comp: ShareComposition, story: Story): Promise<HTMLCanvasElement> {
  await document.fonts.ready;
  const W = 800, H = 1000, PAD = 52;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const root = getComputedStyle(document.documentElement);
  const C = {
    bg:      root.getPropertyValue('--tea-bg').trim()       || '#18130e',
    text:    root.getPropertyValue('--tea-text').trim()     || '#ede4d6',
    textSec: root.getPropertyValue('--tea-text-sec').trim() || '#b5a79a',
    textDim: root.getPropertyValue('--tea-text-dim').trim() || '#7a6e66',
    gold:    root.getPropertyValue('--tea-gold').trim()     || '#b8924e',
  };
  const displayFam = root.getPropertyValue('--font-display').trim() || "'Cormorant Garamond', Georgia, serif";
  const bodyFam    = root.getPropertyValue('--font-body').trim()    || "'Lora', serif";
  const monoFam    = root.getPropertyValue('--font-mono').trim()    || "'IBM Plex Mono', monospace";

  const setDisplay = (size: number, style = 'normal') => { ctx.font = `${style} 400 ${size}px ${displayFam}`; };
  const setBody    = (size: number, style = 'normal') => { ctx.font = `${style} 400 ${size}px ${bodyFam}`; };
  const setMono    = (size: number)                   => { ctx.font = `400 ${size}px ${monoFam}`; };

  // Background
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  // Top mast
  setMono(10);
  ctx.fillStyle = C.gold;
  ctx.textAlign = 'left';
  ctx.fillText('TEAJIA · JOURNAL', PAD, PAD + 12);
  ctx.fillStyle = C.textDim;
  ctx.textAlign = 'right';
  ctx.fillText('ISSUE 04', W - PAD, PAD + 12);
  ctx.textAlign = 'left';

  const bodyTop = PAD + 60;
  const bodyW   = W - PAD * 2;

  if (comp.type === 'cover') {
    // Watermark
    ctx.font = `400 280px "Ma Shan Zheng", serif`;
    ctx.fillStyle = C.gold;
    ctx.globalAlpha = 0.12;
    ctx.textAlign = 'right';
    ctx.fillText('器', W - PAD + 24, bodyTop + 210);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
    // Label
    setMono(10);
    ctx.fillStyle = C.gold;
    ctx.fillText('COVER STORY · ISSUE 04', PAD, bodyTop + 30);
    // Title
    setDisplay(68, 'italic');
    ctx.fillStyle = C.text;
    const titleLines = wrapText(ctx, trunc(comp.title, 36), bodyW);
    let y = bodyTop + 96;
    for (const line of titleLines) { ctx.fillText(line, PAD, y); y += 76; }
    // Subtitle
    if (comp.subtitle) {
      setBody(17);
      ctx.fillStyle = C.textSec;
      const subLines = wrapText(ctx, trunc(comp.subtitle, 140), bodyW * 0.8);
      y += 8;
      for (const line of subLines.slice(0, 5)) { ctx.fillText(line, PAD, y); y += 27; }
    }

  } else if (comp.type === 'quote') {
    // Decorative opening mark
    setDisplay(180, 'italic');
    ctx.fillStyle = C.gold;
    ctx.globalAlpha = 0.38;
    ctx.fillText('\u201c', PAD - 10, bodyTop + 80);
    ctx.globalAlpha = 1;
    // Vertically centred quote
    setDisplay(26, 'italic');
    ctx.fillStyle = C.text;
    const qLines = wrapText(ctx, trunc(comp.content, 160), bodyW);
    const lineH = 38;
    const midY = bodyTop + (H - PAD - 120 - bodyTop) / 2;
    let y = midY - (qLines.length * lineH) / 2;
    for (const line of qLines) { ctx.fillText(line, PAD, y); y += lineH; }
    // Rule
    ctx.fillStyle = C.gold;
    ctx.fillRect(PAD, y + 20, 40, 1);
    // Attribution
    setBody(15, 'italic');
    ctx.fillStyle = C.textSec;
    ctx.fillText(`\u2014 ${story.title}`, PAD, y + 46);

  } else if (comp.type === 'passage') {
    setDisplay(32, 'italic');
    ctx.fillStyle = C.text;
    const headLines = wrapText(ctx, trunc(comp.head, 60), bodyW);
    let y = bodyTop + 50;
    for (const line of headLines) { ctx.fillText(line, PAD, y); y += 42; }
    y += 14;
    if (comp.text) {
      setBody(17);
      ctx.fillStyle = C.textSec;
      const bodyLines = wrapText(ctx, trunc(comp.text, 210), bodyW);
      for (const line of bodyLines.slice(0, 9)) { ctx.fillText(line, PAD, y); y += 27; }
    }

  } else if (comp.type === 'qa') {
    setDisplay(26, 'italic');
    ctx.fillStyle = C.text;
    const headLines = wrapText(ctx, trunc(comp.head, 48), bodyW);
    let y = bodyTop + 50;
    for (const line of headLines) { ctx.fillText(line, PAD, y); y += 34; }
    y += 20;
    if (comp.qa) {
      setBody(16, 'italic');
      ctx.fillStyle = C.gold;
      const qLines = wrapText(ctx, `Q. ${trunc(comp.qa.q, 100)}`, bodyW);
      for (const line of qLines.slice(0, 4)) { ctx.fillText(line, PAD, y); y += 25; }
      y += 14;
      setBody(16);
      ctx.fillStyle = C.textSec;
      const aLines = wrapText(ctx, `A. ${trunc(comp.qa.a, 180)}`, bodyW);
      for (const line of aLines.slice(0, 7)) { ctx.fillText(line, PAD, y); y += 25; }
    }
  }

  // Bottom mast
  const btmY = H - PAD - 72;
  ctx.strokeStyle = 'rgba(184,146,78,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(PAD, btmY); ctx.lineTo(W - PAD, btmY); ctx.stroke();
  setDisplay(18, 'italic');
  ctx.fillStyle = C.text;
  ctx.fillText(story.title, PAD, btmY + 28);
  setMono(9);
  ctx.fillStyle = C.textDim;
  ctx.fillText('teajia · journal', PAD, btmY + 50);

  return canvas;
}

function SharePoster({ comp, story }: { comp: ShareComposition; story: Story }) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      padding: '6.5cqi 6.5cqi 6cqi',
      display: 'flex', flexDirection: 'column',
      containerType: 'inline-size',
    } as React.CSSProperties}>
      {/* Top mast */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ fontFamily: T.mono, fontSize: '2.6cqi' as string, color: T.gold, letterSpacing: '0.28em' }}>TEAJIA · JOURNAL</span>
        <span style={{ fontFamily: T.mono, fontSize: '2.6cqi' as string, color: T.textDim }}>ISSUE 04</span>
      </div>
      {/* Body */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4cqi 0' } as React.CSSProperties}>
        {comp.type === 'quote' && (
          <div style={{ textAlign: 'left', position: 'relative', width: '100%' }}>
            <div style={{ position: 'absolute', top: '-7cqi' as string, left: '-2cqi' as string, fontFamily: T.display, fontStyle: 'italic', fontSize: '26cqi' as string, color: T.gold, opacity: 0.4, lineHeight: 0.8, pointerEvents: 'none' }}>&ldquo;</div>
            <p style={{ fontFamily: T.display, fontStyle: 'italic', fontWeight: 400, fontSize: '6.2cqi' as string, lineHeight: 1.18, margin: 0, color: T.text, position: 'relative' }}>{trunc(comp.content, 160)}</p>
            <div style={{ width: '6cqi' as string, height: 1, background: T.gold, margin: '5cqi 0 2.5cqi' as string }} />
            <p style={{ fontFamily: T.body, fontStyle: 'italic', fontSize: '3.2cqi' as string, color: T.textSec, margin: 0 }}>— {story.title}</p>
          </div>
        )}
        {comp.type === 'passage' && (
          <div style={{ width: '100%' }}>
            <h3 style={{ fontFamily: T.display, fontStyle: 'italic', fontWeight: 400, fontSize: '7.2cqi' as string, lineHeight: 1.08, margin: '0 0 3.5cqi' as string, color: T.text }}>{trunc(comp.head, 60)}</h3>
            <p style={{ fontFamily: T.body, fontSize: '3.6cqi' as string, lineHeight: 1.55, margin: 0, color: T.textSec }}>{trunc(comp.text, 210)}</p>
          </div>
        )}
        {comp.type === 'qa' && (
          <div style={{ width: '100%' }}>
            <h3 style={{ fontFamily: T.display, fontStyle: 'italic', fontWeight: 400, fontSize: '6.2cqi' as string, lineHeight: 1.1, margin: '0 0 4.5cqi' as string, color: T.text }}>{trunc(comp.head, 48)}</h3>
            <p style={{ fontFamily: T.body, fontStyle: 'italic', fontSize: '3.5cqi' as string, lineHeight: 1.5, margin: '0 0 3cqi' as string, color: T.gold }}>Q. {trunc(comp.qa?.q, 100)}</p>
            <p style={{ fontFamily: T.body, fontSize: '3.5cqi' as string, lineHeight: 1.55, margin: 0, color: T.textSec }}>A. {trunc(comp.qa?.a, 180)}</p>
          </div>
        )}
        {comp.type === 'cover' && (
          <div style={{ width: '100%', textAlign: 'left', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '-6cqi' as string, right: '-2cqi' as string, fontFamily: "'Ma Shan Zheng',cursive", fontSize: '52cqi' as string, color: T.gold, opacity: 0.14, lineHeight: 0.8, pointerEvents: 'none' }}>器</div>
            <div style={{ ...labelStyle, color: T.gold, marginBottom: '4cqi' as string, position: 'relative' }}>Cover story · Issue 04</div>
            <h3 style={{ fontFamily: T.display, fontStyle: 'italic', fontWeight: 400, fontSize: '11cqi' as string, lineHeight: 0.98, margin: '0 0 3.5cqi' as string, color: T.text, letterSpacing: '-0.01em' }}>{trunc(comp.title, 36)}</h3>
            <p style={{ fontFamily: T.body, fontSize: '3.5cqi' as string, lineHeight: 1.55, margin: 0, color: T.textSec, maxWidth: '30ch' }}>{trunc(comp.subtitle, 140)}</p>
          </div>
        )}
      </div>
      {/* Bottom mast */}
      <div style={{ borderTop: '1px solid rgba(184,146,78,0.25)', paddingTop: '3.5cqi' as string, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '3cqi' as string, flexShrink: 0 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: T.display, fontStyle: 'italic', fontSize: '4cqi' as string, lineHeight: 1.1, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{story.title}</div>
          <div style={{ fontFamily: T.mono, fontSize: '2.4cqi' as string, color: T.textDim, marginTop: '0.8cqi' as string }}>teajia · journal</div>
        </div>
      </div>
    </div>
  );
}

function ShareTab({ active, disabled, onClick, label, sub }: { active: boolean; disabled?: boolean; onClick: () => void; label: string; sub: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1, textAlign: 'left', padding: '12px 2px 14px',
        marginBottom: -1,
        opacity: disabled ? 0.35 : 1,
        display: 'flex', flexDirection: 'column', gap: 4,
        background: 'none', border: 'none', borderBottom: active ? `1px solid ${T.gold}` : '1px solid transparent',
        cursor: disabled ? 'default' : 'pointer', font: 'inherit',
      } as React.CSSProperties}
    >
      <span style={{ ...labelStyle, color: active ? T.gold : T.textSec }}>{label}</span>
      <span style={{ fontFamily: T.display, fontStyle: 'italic', fontSize: 15, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{sub}</span>
    </button>
  );
}

function ShareDest({ icon, label, onClick, active }: { icon: React.ReactNode; label: string; onClick?: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        padding: '12px 4px', border: `1px solid ${active ? T.gold : T.border}`, borderRadius: 3,
        background: active ? 'rgba(184,146,78,0.08)' : 'transparent',
        cursor: onClick ? 'pointer' : 'default', font: 'inherit',
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      <span style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', color: active ? T.gold : T.text }}>{icon}</span>
      <span style={{ ...labelStyle, fontSize: 9, letterSpacing: '0.16em', color: active ? T.gold : T.textSec, whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  );
}

// Destination icons (line-art)
const IcCopy = () => <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d="M5 4V2.5A1.5 1.5 0 016.5 1h7A1.5 1.5 0 0115 2.5v7A1.5 1.5 0 0113.5 11H12M2.5 5h7A1.5 1.5 0 0111 6.5v7A1.5 1.5 0 019.5 15h-7A1.5 1.5 0 011 13.5v-7A1.5 1.5 0 012.5 5z" stroke="currentColor" strokeWidth="1.1"/></svg>;
const IcSave = () => <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d="M8 2v9M8 11l-3-3M8 11l3-3M3 13h10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const IcMsg  = () => <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d="M2 4a2 2 0 012-2h8a2 2 0 012 2v6a2 2 0 01-2 2H7l-3 3v-3a2 2 0 01-2-2V4z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/></svg>;
const IcMore = () => <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><circle cx="3" cy="8" r="1.2" fill="currentColor"/><circle cx="8" cy="8" r="1.2" fill="currentColor"/><circle cx="13" cy="8" r="1.2" fill="currentColor"/></svg>;
const IcIG   = () => <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="3" stroke="currentColor" strokeWidth="1.1"/><circle cx="8" cy="8" r="2.8" stroke="currentColor" strokeWidth="1.1"/><circle cx="11.6" cy="4.4" r="0.7" fill="currentColor"/></svg>;
const IcX    = () => <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>;
const IcMail = () => <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><rect x="2" y="3.5" width="12" height="9" rx="1" stroke="currentColor" strokeWidth="1.1"/><path d="M2.5 4.5l5.5 4 5.5-4" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/></svg>;
const IcFolio = () => <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d="M2 3.5A1.5 1.5 0 013.5 2H7l1.5 1.5h4A1.5 1.5 0 0114 5v7a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 12V3.5z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/></svg>;

function SharePanel({ page, story, onClose, isSaved, onToggleSave }: {
  page: ArticlePage | null;
  story: Story;
  onClose: () => void;
  isSaved?: boolean;
  onToggleSave?: () => void;
}) {
  const [scope, setScope] = useState<'page' | 'article'>(page ? 'page' : 'article');
  const effectiveScope = (!page && scope === 'page') ? 'article' : scope;
  const [status, setStatus] = useState<string | null>(null);

  // Poster blob is pre-generated as soon as the panel opens (or scope changes).
  // All share actions pull from this cached blob — zero per-click render cost.
  const [posterBlob, setPosterBlob] = useState<Blob | null>(null);

  const comp = useMemo<ShareComposition>(() => {
    if (effectiveScope === 'article') return { type: 'cover', title: story.title, subtitle: story.subtitle };
    return compositionForPage(page, story);
  }, [effectiveScope, page, story]);

  useEffect(() => {
    setPosterBlob(null);
    let cancelled = false;
    renderPosterToCanvas(comp, story)
      .then(canvas => new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png')))
      .then(blob => { if (!cancelled && blob) setPosterBlob(blob); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [comp, story]);

  const shareUrl = window.location.href;
  const shareText = `${story.title}${story.subtitle ? ` — ${story.subtitle}` : ''} · Teajia Journal`;

  const flash = (msg: string) => {
    setStatus(msg);
    setTimeout(() => setStatus(null), 2800);
  };

  // ── Shared primitives ────────────────────────────────────────────────────────

  // Tries Web Share Level 2 (with poster image) then Level 1 (text + URL only).
  // Returns 'success' | 'cancelled' | 'unavailable' so callers know whether to
  // fall through to a platform-specific desktop fallback.
  const nativeShare = async (blob: Blob | null): Promise<'success' | 'cancelled' | 'unavailable'> => {
    if (!navigator.share) return 'unavailable';
    const data: ShareData = { title: story.title, text: shareText, url: shareUrl };
    if (blob) {
      const file = new File([blob], `teajia-${story.id}.png`, { type: 'image/png' });
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        data.files = [file];
      }
    }
    try {
      await navigator.share(data);
      return 'success';
    } catch (e) {
      return (e as Error).name === 'AbortError' ? 'cancelled' : 'unavailable';
    }
  };

  // Writes the poster image to the system clipboard (Chrome 76+ / Safari 13.1+).
  const copyImageToClipboard = async (blob: Blob): Promise<boolean> => {
    if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) return false;
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      return true;
    } catch {
      return false;
    }
  };

  // ── Button handlers ──────────────────────────────────────────────────────────

  // Copy link — URL only (image goes via Save Image or native share)
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      flash('Link copied');
    } catch {
      flash('Could not copy — select the URL bar manually');
    }
  };

  // Save image — instant blob download, no re-render
  const handleSaveImage = async () => {
    if (!posterBlob) { flash('Still preparing image…'); return; }
    const url = URL.createObjectURL(posterBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `teajia-${story.id || 'journal'}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    flash('Image saved');
  };

  // Messages — native share (poster + link) → SMS text fallback
  const handleMessages = async () => {
    const result = await nativeShare(posterBlob);
    if (result === 'success' || result === 'cancelled') return;
    window.open(`sms:?&body=${encodeURIComponent(`${shareText} ${shareUrl}`)}`);
  };

  // More… — native share sheet (poster + link) → copy link fallback
  const handleMore = async () => {
    const result = await nativeShare(posterBlob);
    if (result === 'success' || result === 'cancelled') return;
    try { await navigator.clipboard.writeText(shareUrl); flash('Link copied'); }
    catch { flash('Use the Copy link button'); }
  };

  // Instagram — native share with image (Instagram appears in sheet on iOS/Android).
  // Desktop: copy poster to clipboard → open Instagram (paste into Stories).
  const handleInstagram = async () => {
    const result = await nativeShare(posterBlob);
    if (result === 'success' || result === 'cancelled') return;
    if (posterBlob) {
      const copied = await copyImageToClipboard(posterBlob);
      window.open('https://www.instagram.com', '_blank', 'noopener');
      flash(copied
        ? 'Poster copied — paste into your Instagram story'
        : 'Save the image first, then share on Instagram');
      return;
    }
    window.open('https://www.instagram.com', '_blank', 'noopener');
  };

  // X — native share with image on mobile.
  // Desktop: copy poster to clipboard so user can paste into the tweet, then open composer.
  const handleX = async () => {
    const result = await nativeShare(posterBlob);
    if (result === 'success' || result === 'cancelled') return;
    const t = encodeURIComponent(shareText);
    const u = encodeURIComponent(shareUrl);
    if (posterBlob) {
      const copied = await copyImageToClipboard(posterBlob);
      window.open(`https://x.com/intent/tweet?text=${t}&url=${u}`, '_blank', 'noopener');
      flash(copied ? 'Poster copied — paste it into your post on X' : 'Link opened in X');
    } else {
      window.open(`https://x.com/intent/tweet?text=${t}&url=${u}`, '_blank', 'noopener');
    }
  };

  // Email — native share with image on mobile.
  // Desktop: copy poster to clipboard, open mailto pre-filled so user can paste.
  const handleEmail = async () => {
    const result = await nativeShare(posterBlob);
    if (result === 'success' || result === 'cancelled') return;
    const subject = encodeURIComponent(story.title);
    const body = encodeURIComponent(`${shareText}\n\n${shareUrl}`);
    if (posterBlob) {
      const copied = await copyImageToClipboard(posterBlob);
      window.location.href = `mailto:?subject=${subject}&body=${body}`;
      if (copied) flash('Poster copied — paste it into your email');
    } else {
      window.location.href = `mailto:?subject=${subject}&body=${body}`;
    }
  };

  // My Folio — save/unsave to reading collection
  const handleFolio = () => {
    onToggleSave?.();
    flash(isSaved ? 'Removed from your folio' : 'Saved to your folio');
  };

  const posterReady = posterBlob !== null;

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(10,7,4,0.85)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 520, maxHeight: '92vh',
          background: T.bg, borderTop: `1px solid ${T.border}`,
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 -20px 60px rgba(24,19,14,0.6)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 18px 4px' }}>
          <span style={labelStyle}>Share</span>
          <button onClick={onClose} aria-label="Close" style={{ color: T.textDim, fontSize: 18, lineHeight: 1, padding: 4, background: 'none', border: 0, cursor: 'pointer', font: 'inherit' }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', padding: '0 18px', borderBottom: `1px solid ${T.border}` }}>
          <ShareTab active={effectiveScope === 'page'} disabled={!page} onClick={() => setScope('page')} label="This page" sub={shortPageLabel(page)} />
          <ShareTab active={effectiveScope === 'article'} onClick={() => setScope('article')} label="The article" sub={story.title} />
        </div>

        {/* Poster preview — dims + shows label while blob is being prepared */}
        <div style={{ flex: '0 1 auto', padding: '18px 18px 8px', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 0, overflow: 'hidden' }}>
          <div style={{
            aspectRatio: '4/5', maxHeight: '46vh', width: 'auto', maxWidth: '100%',
            background: T.bg, border: `1px solid ${posterReady ? T.border : 'rgba(184,146,78,0.2)'}`,
            position: 'relative', overflow: 'hidden',
            boxShadow: '0 10px 30px rgba(24,19,14,0.4)',
            transition: 'border-color 0.4s',
          }}>
            <div style={{ opacity: posterReady ? 1 : 0.55, transition: 'opacity 0.4s' }}>
              <SharePoster comp={comp} story={story} />
            </div>
            {!posterReady && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', padding: 10, pointerEvents: 'none' }}>
                <span style={{ fontFamily: T.mono, fontSize: 8, color: T.gold, letterSpacing: '0.12em', opacity: 0.7 }}>Preparing…</span>
              </div>
            )}
          </div>
        </div>

        {/* Destination grid */}
        <div style={{ padding: '10px 14px 8px', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
          <ShareDest icon={<IcCopy />}  label="Copy link"                         onClick={handleCopyLink} />
          <ShareDest icon={<IcSave />}  label={posterReady ? 'Save image' : '…'}  onClick={posterReady ? handleSaveImage : undefined} />
          <ShareDest icon={<IcMsg  />}  label="Messages"                           onClick={handleMessages} />
          <ShareDest icon={<IcMore />}  label="More…"                              onClick={handleMore} />
          <ShareDest icon={<IcIG   />}  label="Instagram"                          onClick={handleInstagram} />
          <ShareDest icon={<IcX    />}  label="X"                                  onClick={handleX} />
          <ShareDest icon={<IcMail />}  label="Email"                              onClick={handleEmail} />
          <ShareDest icon={<IcFolio />} label={isSaved ? 'Saved' : 'My Folio'}    onClick={handleFolio} active={isSaved} />
        </div>

        {/* Status line / footer */}
        <div style={{ padding: '8px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, borderTop: `1px solid ${T.border}`, marginTop: 6, paddingBottom: 'calc(18px + env(safe-area-inset-bottom, 0px))' }}>
          <div style={{ fontFamily: T.mono, fontSize: 9.5, color: status ? T.gold : T.textDim, transition: 'color 0.2s', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {status ?? `TEAJIA · ${story.title.toUpperCase()}`}
          </div>
          <button
            onClick={handleMore}
            style={{ fontFamily: T.mono, fontSize: 9.5, color: T.gold, background: 'none', border: 0, cursor: 'pointer', letterSpacing: '0.1em', textTransform: 'uppercase' as const, flexShrink: 0 }}
          >
            Share ↗
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page view dispatcher ─────────────────────────────────────────────────────

function PageView({ entry, story }: { entry: PlanEntry; story: Story }) {
  const { kind } = entry.page;
  if (kind === 'cover') return <CoverPage story={story} />;
  if (kind === 'masthead') return <MastheadPage page={entry.page} story={story} />;
  if (kind === 'divider') return <DividerPage page={entry.page} />;
  if (kind === 'pull') return <PullQuotePage page={entry.page} />;
  if (kind === 'epilogue') return <EpiloguePage page={entry.page} />;
  if (kind === 'end') return <EndPage story={story} />;
  if (kind === 'sidebar') return <SidebarPage page={entry.page} />;
  if (kind === 'qa') return <QAPage entry={entry} />;
  if (kind === 'body') return <BodyPage entry={entry} story={story} />;
  return null;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export interface MagazinePageReaderProps {
  story: Story;
  onBack: () => void;
  isSaved?: boolean;
  onToggleSave?: () => void;
}

export function MagazinePageReader({ story, onBack, isSaved, onToggleSave }: MagazinePageReaderProps) {
  const articlePages = useMemo(() => parseStoryToPages(story), [story]);
  const plan = useMemo(() => buildPlan(articlePages), [articlePages]);
  const total = plan.length;

  const [current, setCurrent] = useState(0);
  const [showShare, setShowShare] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  // The ArticlePage object corresponding to the current swipe position
  const currentPage = plan[current]?.page ?? null;

  // Restore reading progress
  useEffect(() => {
    const saved = localStorage.getItem(`teajia_mag_${story.id}`);
    if (saved) {
      const n = parseInt(saved, 10);
      if (!isNaN(n) && n > 0 && n < plan.length) setCurrent(n);
    }
  }, [story.id, plan.length]);

  useEffect(() => {
    localStorage.setItem(`teajia_mag_${story.id}`, String(current));
  }, [current, story.id]);

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

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'Escape') { if (showShare) { setShowShare(false); return; } onBack(); return; }
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); scrollTo(Math.min(total - 1, current + 1)); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); scrollTo(Math.max(0, current - 1)); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, total, scrollTo, onBack, showShare]);

  const showDots = total <= 22;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: T.bg, display: 'flex', flexDirection: 'column',
      overflow: 'hidden', fontFamily: T.body, color: T.text,
    }}>
      {/* Grain overlay */}
      <div aria-hidden="true" style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 999, opacity: 0.06,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      }} />

      {/* Top bar */}
      <div style={{
        position: 'relative', zIndex: 40, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 18px 12px',
        background: 'linear-gradient(180deg,rgba(24,19,14,0.92),rgba(24,19,14,0.6) 70%,transparent)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}>
        <button
          onClick={onBack}
          aria-label="Back to journal"
          style={{ display: 'flex', alignItems: 'center', gap: 6, color: T.textSec, padding: '6px 4px', background: 'none', border: 0, cursor: 'pointer', font: 'inherit' }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M13 8H3M6.5 11.5L3 8l3.5-3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ ...labelStyle, color: 'inherit' }}>Journal</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: T.display, fontWeight: 500, letterSpacing: '0.18em', fontSize: 12, textTransform: 'uppercase', color: T.text }}>
            Teajia
          </span>
        </div>

        <button
          onClick={() => setShowShare(true)}
          aria-label="Share"
          style={{ color: T.textSec, padding: 10, background: 'none', border: 0, cursor: 'pointer' }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 8a2 2 0 100-4 2 2 0 000 4zm8-4a2 2 0 100-4 2 2 0 000 4zm0 12a2 2 0 100-4 2 2 0 000 4zM5.6 7.2L10.4 4M5.6 8.8L10.4 12" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Share panel */}
      {showShare && (
        <SharePanel
          page={currentPage}
          story={story}
          onClose={() => setShowShare(false)}
          isSaved={isSaved}
          onToggleSave={onToggleSave}
        />
      )}

      {/* Horizontal scroll track */}
      <div
        ref={trackRef}
        onScroll={handleScroll}
        style={{
          flex: 1, minHeight: 0, display: 'flex',
          overflowX: 'auto', overflowY: 'hidden',
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        } as React.CSSProperties}
      >
        {plan.map((entry, idx) => (
          <section
            key={idx}
            style={{
              flex: '0 0 100%', scrollSnapAlign: 'start',
              height: '100%', alignSelf: 'stretch',
              overflowY: 'hidden', overflowX: 'hidden',
              scrollbarWidth: 'none',
              position: 'relative',
            } as React.CSSProperties}
          >
            <PageView entry={entry} story={story} />
          </section>
        ))}
      </div>

      {/* Bottom navigation — flex sibling so it reserves space (never overlaps content) */}
      <div style={{
        flexShrink: 0,
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        gap: 18, padding: '12px 18px',
        paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
        background: T.bg, borderTop: `1px solid ${T.border}`,
      }}>
        <button
          onClick={() => scrollTo(Math.max(0, current - 1))}
          disabled={current === 0}
          aria-label="Previous page"
          style={{ opacity: current === 0 ? 0.3 : 1, color: T.textSec, padding: 8, background: 'none', border: 0, cursor: 'pointer', font: 'inherit', flexShrink: 0 }}
        >
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {showDots ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', maxWidth: '65vw', justifyContent: 'center' }}>
            {plan.map((_, n) => (
              <PageDot key={n} active={n === current} onClick={() => scrollTo(n)} />
            ))}
          </div>
        ) : (
          // Progress rail for long articles
          <div style={{ flex: 1, minWidth: 60, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, height: 2, background: 'rgba(184,146,78,0.18)', borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
              <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, background: T.gold, width: `${total ? ((current + 1) / total) * 100 : 0}%`, transition: 'width .35s cubic-bezier(.4,0,.2,1)', borderRadius: 2 }} />
            </div>
            <span style={{ fontFamily: T.mono, fontSize: 11, color: T.textSec, whiteSpace: 'nowrap' }}>
              {String(current + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
            </span>
          </div>
        )}

        <button
          onClick={() => scrollTo(Math.min(total - 1, current + 1))}
          disabled={current === total - 1}
          aria-label="Next page"
          style={{ opacity: current === total - 1 ? 0.3 : 1, color: T.textSec, padding: 8, background: 'none', border: 0, cursor: 'pointer', font: 'inherit', flexShrink: 0 }}
        >
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
            <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
