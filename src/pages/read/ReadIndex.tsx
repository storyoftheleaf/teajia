/**
 * The Art of Tea — Read-section index.
 * A quiet cover-card landing for the four immersive long-reads, in the same
 * espresso-and-gold register. Each card is a full link into its article.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { DbArticle } from '../../types';
import { C, F, ImmersiveRoot, ProgressTrack, useReadingProgress, useImmersiveChrome, useReveals, grainCss, ACCENTS } from './immersive';

type Piece = {
  to: string;
  no: string;
  kind: string;
  title: string;
  blurb: string;
  art: React.ReactNode; // small SVG/typographic plate
};

// The rest of the site, surfaced inside Read as a quiet explore row. Labels are
// curated (e.g. "Sessions", not the route's "events"); routes match the site nav.
const EXPLORE: { label: string; to: string }[] = [
  { label: 'Craft', to: '/craft' },
  { label: 'Advise', to: '/advise' },
  { label: 'Shop', to: '/shop' },
  { label: 'Sessions', to: '/events' },
  { label: 'About', to: '/about' },
];

const pieces: Piece[] = [
  {
    to: '/read/leaf-to-liquor/manuscript', no: 'N°01', kind: 'Template · Manuscript', title: 'From Leaf to Liquor',
    blurb: 'The manuscript template — drop caps, marginalia, the long classic read.',
    art: (
      <svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid meet" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <g fill="none" stroke="rgba(168,135,77,0.4)" strokeWidth="1.1">
          <path d="M160 40 C 128 80, 128 150, 160 180 C 192 150, 192 80, 160 40 Z" />
          <line x1="160" y1="56" x2="160" y2="170" />
          <path d="M160 90 C 144 98, 136 108, 132 122" /><path d="M160 124 C 178 132, 186 144, 190 158" />
        </g>
        <circle cx="160" cy="34" r="3.4" fill={C.gold} />
      </svg>
    ),
  },
  // The other four templates of the same piece — each its own article-link.
  ...([
    { key: 'gallery', label: 'Gallery', blurb: 'The gallery template — image-led, plates and captions carry the read.' },
    { key: 'folio', label: 'Folio', blurb: 'The folio template — data and meters, a measured technical layout.' },
    { key: 'thread', label: 'Thread', blurb: 'The thread template — a single drawn line threads the story down the page.' },
    { key: 'reverie', label: 'Reverie', blurb: 'The reverie template — one idea per screen, slow and spacious.' },
  ] as const).map((t) => ({
    to: `/read/leaf-to-liquor/${t.key}`, no: 'N°01', kind: `Template · ${t.label}`, title: 'From Leaf to Liquor',
    blurb: t.blurb,
    art: (
      <svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid meet" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <g fill="none" stroke="rgba(168,135,77,0.4)" strokeWidth="1.1">
          <path d="M160 40 C 128 80, 128 150, 160 180 C 192 150, 192 80, 160 40 Z" />
          <line x1="160" y1="56" x2="160" y2="170" />
          <path d="M160 90 C 144 98, 136 108, 132 122" /><path d="M160 124 C 178 132, 186 144, 190 158" />
        </g>
        <circle cx="160" cy="34" r="3.4" fill={C.gold} />
      </svg>
    ),
  })),
  // The three hand-built showcase stories (Rock Remembers, Earth Water Fire,
  // Before the Mist) were removed from the Read display — they carried the old
  // magazine's built picture-art. Their pages stay alive at their /read/* URLs;
  // they're just no longer listed here. The Leaf-to-Liquor template cards above
  // and the published editor articles below are what Read shows now.
];

const ReadIndex: React.FC = () => {
  // Read stays on the gold accent (the colour picker was retired).
  useImmersiveChrome(ACCENTS[0]);

  // Published articles authored in the editor, shown in the same card register
  // as the four hand-built showcases so Read reads as one collection. They link
  // to /article/:slug, which opens the immersive or carousel reader per template.
  const { data: published } = useQuery<DbArticle[]>({
    queryKey: ['read-published-articles'],
    queryFn: async () => {
      const res = await api.articles.listPublished(40, 0);
      const list = Array.isArray(res) ? res : (res?.articles ?? res?.data ?? []);
      return list as DbArticle[];
    },
  });

  // Re-arm the scroll reveals once the articles land so their cards fade in too.
  const rootRef = useReveals([published?.length ?? 0]);
  const progress = useReadingProgress();

  return (
    <ImmersiveRoot rootRef={rootRef}>
      <Helmet><title>The Art of Tea · Read · Teajia</title></Helmet>

      {/* NAV */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '13px clamp(18px,4vw,40px)', background: 'rgba(20,16,11,0.72)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', borderBottom: '1px solid rgba(168,135,77,0.12)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontFamily: F.display, fontWeight: 600, fontSize: 19, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.ink }}>Teajia</span>
          <span style={{ fontFamily: F.mono, fontSize: 10.5, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.dim, whiteSpace: 'nowrap' }}>/ Read</span>
        </div>
        <span style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dim }}>The Art of Tea</span>
        <ProgressTrack progress={progress} />
      </nav>

      {/* HERO */}
      <header style={{ position: 'relative', padding: 'clamp(64px,11vw,150px) clamp(24px,6vw,72px) clamp(40px,6vw,72px)', overflow: 'hidden', textAlign: 'center' }}>
        <div aria-hidden="true" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-54%)', fontFamily: F.cn, fontWeight: 200, fontSize: 'min(54vw,520px)', lineHeight: 1, color: 'rgba(168,135,77,0.045)', pointerEvents: 'none', userSelect: 'none' }}>讀</div>
        <div style={{ position: 'relative', maxWidth: 760, margin: '0 auto' }}>
          {/* masthead — gold rule + italic eyebrow, in the Magazine register */}
          <div aria-hidden="true" style={{ width: 30, height: 1, background: C.gold, opacity: 0.55, margin: '0 auto 18px' }} />
          <div style={{ fontFamily: F.display, fontStyle: 'italic', fontSize: 16, letterSpacing: '0.04em', color: C.gold, marginBottom: 22 }}>The Reading Room</div>
          <h1 style={{ fontFamily: F.display, fontWeight: 400, fontStyle: 'italic', fontSize: 'clamp(46px,9vw,100px)', lineHeight: 0.98, letterSpacing: '-0.015em', color: C.cream, margin: 0 }}>The Art of Tea</h1>
          <p style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 'clamp(16px,2.2vw,21px)', lineHeight: 1.5, color: C.taupe, margin: '26px auto 0', maxWidth: 520 }}>
            Long, slow reads on the people and the patience behind the cup. Each one a magazine you wish would never end.
          </p>

          {/* explore row — the rest of the site, in the museum-caption register */}
          <nav aria-label="Explore Teajia" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'baseline', gap: '0 18px', margin: 'clamp(34px,5vw,52px) auto 0', maxWidth: 560 }}>
            {EXPLORE.map((e, i) => (
              <React.Fragment key={e.to}>
                {i > 0 && <span aria-hidden="true" style={{ width: 1, height: 11, background: 'rgba(168,135,77,0.28)', alignSelf: 'center' }} />}
                <Link
                  to={e.to}
                  className="tj-explore-link"
                  style={{ fontFamily: F.display, fontStyle: 'italic', fontSize: 16, letterSpacing: '0.02em', color: C.taupe, textDecoration: 'none', padding: '6px 0', whiteSpace: 'nowrap' }}
                >
                  {e.label}
                </Link>
              </React.Fragment>
            ))}
          </nav>
        </div>
      </header>

      {/* CARD GRID */}
      <section style={{ maxWidth: 1180, margin: '0 auto', padding: '0 clamp(20px,5vw,56px) clamp(72px,11vw,140px)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,320px),1fr))', gap: 'clamp(16px,2.6vw,28px)' }}>
          {pieces.map((p) => (
            <Link
              key={p.to}
              to={p.to}
              data-reveal
              className="tj-morecard"
              style={{ textDecoration: 'none', color: 'inherit', border: '1px solid rgba(168,135,77,0.16)', borderRadius: 5, overflow: 'hidden', background: 'linear-gradient(160deg,#1b160f,#15110b)', display: 'flex', flexDirection: 'column' }}
            >
              {/* plate */}
              <div style={{ position: 'relative', aspectRatio: '16/9', overflow: 'hidden', background: 'linear-gradient(155deg,#2a2117 0%,#14100b 80%)', borderBottom: '1px solid rgba(168,135,77,0.14)' }}>
                <div aria-hidden="true" style={{ ...grainCss('0.85', 130), opacity: 0.07 }} />
                <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 60% at 50% 35%, rgba(168,135,77,0.1), transparent 66%)' }} />
                {p.art}
                <div style={{ position: 'absolute', left: 16, top: 14, fontFamily: F.mono, fontSize: 'clamp(26px,4vw,40px)', fontWeight: 400, lineHeight: 0.9, color: 'rgba(168,135,77,0.34)', letterSpacing: '-0.02em' }}>{p.no}</div>
              </div>
              {/* meta */}
              <div style={{ padding: 'clamp(20px,3vw,28px)' }}>
                <div style={{ fontFamily: F.ui, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.gold, marginBottom: 14 }}>{p.kind}</div>
                <div style={{ fontFamily: F.display, fontSize: 'clamp(26px,3vw,32px)', lineHeight: 1.05, color: C.cream }}>{p.title}</div>
                <p style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 14.5, lineHeight: 1.55, color: C.dim, margin: '12px 0 0' }}>{p.blurb}</p>
              </div>
            </Link>
          ))}

          {/* Editor-authored articles, in the same card register. */}
          {(published ?? []).map((a) => (
            <Link
              key={a.id}
              to={`/article/${a.slug}`}
              data-reveal
              className="tj-morecard"
              style={{ textDecoration: 'none', color: 'inherit', border: '1px solid rgba(168,135,77,0.16)', borderRadius: 5, overflow: 'hidden', background: 'linear-gradient(160deg,#1b160f,#15110b)', display: 'flex', flexDirection: 'column' }}
            >
              {/* plate — real cover image when present, else the espresso plate */}
              <div style={{ position: 'relative', aspectRatio: '16/9', overflow: 'hidden', background: 'linear-gradient(155deg,#2a2117 0%,#14100b 80%)', borderBottom: '1px solid rgba(168,135,77,0.14)' }}>
                {a.cover_image_url ? (
                  <img src={a.cover_image_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.92 }} />
                ) : (
                  <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 60% at 50% 35%, rgba(168,135,77,0.1), transparent 66%)' }} />
                )}
                <div aria-hidden="true" style={{ ...grainCss('0.85', 130), opacity: 0.07 }} />
              </div>
              {/* meta */}
              <div style={{ padding: 'clamp(20px,3vw,28px)' }}>
                {a.category && (
                  <div style={{ fontFamily: F.ui, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.gold, marginBottom: 14 }}>{a.category}</div>
                )}
                <div style={{ fontFamily: F.display, fontSize: 'clamp(26px,3vw,32px)', lineHeight: 1.05, color: C.cream }}>{a.title}</div>
                {a.subtitle && (
                  <p style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 14.5, lineHeight: 1.55, color: C.dim, margin: '12px 0 0' }}>{a.subtitle}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </ImmersiveRoot>
  );
};

export default ReadIndex;
