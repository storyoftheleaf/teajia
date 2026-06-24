/**
 * The Art of Tea — Read-section index.
 * "The Reading Room" — magazine layout ported from the Claude Design mockup
 * (saved at docs/_design-import/tea-article-redesign/).
 *
 * Two-column layout: LEFT = curated 14-piece contents index (4 themed groups);
 * RIGHT = sticky cover rail (lead cover + 2 secondary covers).
 * OWNER-ONLY: Templates Room section (dashed border, grid background, 4 draft
 * placeholder cards) — gated by real login, never a demo toggle.
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAppStore } from '../../lib/store';
import { getTokenClaims } from '../../lib/api';
import type { DbArticle } from '../../types';
import {
  C, F, ImmersiveRoot, ProgressTrack,
  useReadingProgress, useImmersiveChrome, useReveals,
  ACCENTS,
} from './immersive';

// ── Seed-article filter (kept from original ReadIndex) ───────────────────────
const SEED_ARTICLE_TITLES = new Set([
  'Into the Wuyi Mountains',
  'Laoshan Green',
  'A Conversation with Master Lin',
  'Tea in the Kitchen',
  'Origin Story',
]);
function isRealArticle(a: { title?: string }): boolean {
  return !!a.title && !SEED_ARTICLE_TITLES.has(a.title.trim());
}

// Spell small counts as words for the editorial masthead ("Three pieces"),
// falling back to digits past the curated set.
const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen'];
function numberWord(n: number): string {
  const w = NUMBER_WORDS[n];
  return w ? w.charAt(0).toUpperCase() + w.slice(1) : String(n);
}

// ── Curated contents index data ──────────────────────────────────────────────
// Faithfully converted from the design's groups() controller method.
// Hrefs repointed to real /read/* routes (all design-file refs removed).
// `live` is the publish gate. A visitor sees only `live: true` pieces; the
// owner sees every piece (drafts dimmed + tagged). Flip a piece live by adding
// `live: true` to its row below — that one change publishes it. Nothing else.
type IndexItem = { n: string; rubric: string; title: string; dek: string; href: string; live?: boolean };
type IndexGroup = { label: string; glyph: string; items: IndexItem[] };

const INDEX_GROUPS: IndexGroup[] = [
  {
    label: 'The interactive issue',
    glyph: '◇',
    items: [
      { n: 'N°05', rubric: 'Ritual',    title: 'Seven Steeps',           dek: 'The same leaves, brewed seven ways, scroll to pour.',          href: '/read/ritual', live: true },
      { n: 'N°06', rubric: 'Geography', title: 'A Map of Mountains',     dek: 'An interactive atlas of China’s tea terroir.',             href: '/read/atlas', live: true },
      { n: 'N°07', rubric: 'History',   title: 'Ten Thousand Mornings',  dek: 'Five thousand years of tea, along one moving line.',           href: '/read/history' },
      { n: 'N°08', rubric: 'Tasting',   title: 'The Vocabulary of Taste',dek: 'A turning flavour wheel and a tasting radar.',                 href: '/read/tasting', live: true },
    ],
  },
  {
    label: 'Conversations over tea',
    glyph: '¶',
    items: [
      { n: 'N°02', rubric: 'Conversation', title: 'The Rock Remembers', dek: 'A Wuyi roaster on fire, patience and lineage.',               href: '/read/rock-remembers' },
      { n: 'N°03', rubric: 'Conversation', title: 'Earth, Water, Fire', dek: 'A Jingdezhen potter on the vessels that hold tea.',           href: '/read/earth-water-fire' },
      { n: 'N°09', rubric: 'A Tea House',  title: 'Quiet Hours',        dek: 'Building a Melbourne tea house, told in two voices.',         href: '/read/tea-house' },
    ],
  },
  {
    label: 'Journeys & field notes',
    glyph: '∞',
    items: [
      { n: 'N°04', rubric: 'Field Notes', title: 'Before the Mist',          dek: 'A photo essay from a Yunnan spring dawn.',              href: '/read/before-the-mist' },
      { n: 'N°10', rubric: 'First Person', title: 'The Long Way to the Cup',  dek: 'From Hong Kong to Bali, learning to taste.',           href: '/read/essay' },
      { n: 'N°11', rubric: 'Field Notes', title: 'Two Rooms in Bali',         dek: 'Jackfruit wood, charcoal and bonsai light.',            href: '/read/field-notes' },
    ],
  },
  {
    label: 'Long reads',
    glyph: '◊',
    items: [
      { n: 'N°12', rubric: 'Field Study', title: 'The Water Before the Leaf', dek: 'The overlooked half of every cup, water.',             href: '/read/field-study' },
      { n: 'N°13', rubric: 'Legend',      title: 'The Immortals’ Cliff', dek: 'The Da Hong Pao mother trees of Wuyi.',                href: '/read/legend' },
      { n: 'N°14', rubric: 'The Craft',   title: 'The Pot That Remembers',    dek: 'Yixing purple clay, and pots that age with you.',      href: '/read/craft' },
    ],
  },
];

// ── Index row component ──────────────────────────────────────────────────────
// Mirrors the design's inline onmouseover/onmouseout handlers with React state.
// `draft` = shown to the owner but not yet live: dimmed, carries a Draft tag.
const IndexRow: React.FC<{ item: IndexItem; draft?: boolean }> = ({ item, draft }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      to={item.href}
      style={{
        display: 'grid',
        gridTemplateColumns: '48px 1fr auto',
        alignItems: 'baseline',
        gap: 16,
        padding: hovered ? '15px 6px 15px 14px' : '15px 6px',
        borderBottom: '1px solid rgba(168,135,77,0.10)',
        textDecoration: 'none',
        color: 'inherit',
        opacity: draft ? 0.5 : 1,
        transition: 'padding-left 240ms, opacity 240ms',
      }}
      onMouseOver={() => setHovered(true)}
      onMouseOut={() => setHovered(false)}
    >
      <span style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: '0.06em', color: hovered ? 'var(--tj-gold-lt,#c6a667)' : 'var(--tj-gold,#a8874d)', paddingTop: 5, transition: 'color 240ms' }}>
        {item.n}
      </span>
      <span>
        <span style={{ display: 'block', fontFamily: F.display, fontSize: 'clamp(22px,2.4vw,27px)', lineHeight: 1.08, color: hovered ? '#fff7ea' : '#ede4d4', transition: 'color 240ms' }}>
          {item.title}
        </span>
        <span style={{ display: 'block', fontFamily: F.body, fontStyle: 'italic', fontSize: 13, lineHeight: 1.45, color: C.dim, marginTop: 4 }}>
          {item.dek}
        </span>
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, paddingTop: 6 }}>
        <span style={{ fontFamily: F.ui, fontSize: 9, fontWeight: 500, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.dim, whiteSpace: 'nowrap' }}>
          {item.rubric}
        </span>
        {draft && (
          <span style={{ fontFamily: F.mono, fontSize: 8.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.gold, border: '1px solid rgba(168,135,77,0.4)', borderRadius: 2, padding: '1px 5px', whiteSpace: 'nowrap' }}>
            Draft
          </span>
        )}
      </span>
    </Link>
  );
};

// ── Group block component ────────────────────────────────────────────────────
// `isAdmin` decides the audience: the owner sees every row (drafts dimmed +
// tagged); a visitor sees only live rows. A group with no visible rows for the
// current audience renders nothing.
const GroupBlock: React.FC<{ group: IndexGroup; isAdmin: boolean }> = ({ group, isAdmin }) => {
  const visible = isAdmin ? group.items : group.items.filter((it) => it.live);
  if (visible.length === 0) return null;
  return (
    <div style={{ marginTop: 38 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6 }}>
        <span style={{ fontFamily: F.display, fontStyle: 'italic', fontSize: 24, color: C.gold, lineHeight: 1 }}>
          {group.glyph}
        </span>
        <span style={{ fontFamily: F.ui, fontSize: 9.5, fontWeight: 500, letterSpacing: '0.24em', textTransform: 'uppercase', color: '#9e8f76' }}>
          {group.label}
        </span>
        <span style={{ flex: 1, height: 1, background: 'rgba(168,135,77,0.14)' }} />
        <span style={{ fontFamily: F.mono, fontSize: 10, color: C.dim }}>
          {String(visible.length).padStart(2, '0')}
        </span>
      </div>
      {visible.map((item) => (
        <IndexRow key={item.href} item={item} draft={isAdmin && !item.live} />
      ))}
    </div>
  );
};

// ── Lead cover (hover handled inline via React state) ────────────────────────
const LeadCover: React.FC = () => {
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      to="/read/leaf-to-liquor"
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        minHeight: 'clamp(320px,40vw,400px)',
        border: `1px solid ${hovered ? 'rgba(168,135,77,0.5)' : 'rgba(168,135,77,0.24)'}`,
        overflow: 'hidden',
        textDecoration: 'none',
        color: 'inherit',
        background: 'linear-gradient(158deg,#3a2a18 0%,#241810 56%,#14100b 100%)',
        transition: 'border-color 240ms',
      }}
      onMouseOver={() => setHovered(true)}
      onMouseOut={() => setHovered(false)}
    >
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 64% 56% at 60% 28%, rgba(190,140,70,0.26), transparent 64%)' }} />
      <svg viewBox="0 0 420 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.55 }}>
        <g fill="none" stroke="rgba(168,135,77,0.26)" strokeWidth="1">
          <path d="M-20 110 C 120 84, 240 96, 460 56" />
          <path d="M-20 170 C 120 142, 260 154, 460 110" />
          <path d="M-20 230 C 140 198, 280 210, 460 164" />
        </g>
        <g fill="rgba(168,135,77,0.42)">
          <circle cx="150" cy="130" r="3" />
          <circle cx="184" cy="138" r="3" />
          <circle cx="218" cy="130" r="3" />
          <circle cx="252" cy="140" r="3" />
        </g>
      </svg>
      <div aria-hidden="true" style={{ position: 'absolute', right: -18, top: -30, fontFamily: F.cn, fontWeight: 200, fontSize: 230, lineHeight: 1, color: 'rgba(168,135,77,0.08)' }}>茶</div>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, rgba(20,16,11,0.92), transparent 52%)' }} />
      <div style={{ position: 'relative', padding: 'clamp(24px,3vw,32px)' }}>
        <div style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: '0.26em', textTransform: 'uppercase', color: C.gold, marginBottom: 14 }}>
          The Lead · N°01 · in five readings
        </div>
        <div style={{ fontFamily: F.display, fontWeight: 400, fontSize: 'clamp(34px,4.4vw,46px)', lineHeight: 0.98, color: '#f3ead9' }}>
          From Leaf{' '}
          <span style={{ fontStyle: 'italic', color: C.gold }}>to Liquor</span>
        </div>
        <div style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 14, lineHeight: 1.5, color: '#cdc0a8', marginTop: 14, maxWidth: 330 }}>
          How a single leaf becomes the six colours of tea, told five different ways, from manuscript to reverie.
        </div>
      </div>
    </Link>
  );
};

// ── Secondary cover (reusable for both secondary slots) ─────────────────────
const SecondaryCover: React.FC<{
  to: string;
  kicker: string;
  title: React.ReactNode;
  svgPaths: React.ReactNode;
  svgOpacity: number;
  bgGradient: string;
  strokeColor: string;
}> = ({ to, kicker, title, svgPaths, svgOpacity, bgGradient, strokeColor: _strokeColor }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      to={to}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        minHeight: 128,
        border: `1px solid ${hovered ? 'rgba(168,135,77,0.45)' : 'rgba(168,135,77,0.18)'}`,
        overflow: 'hidden',
        textDecoration: 'none',
        color: 'inherit',
        background: bgGradient,
        transition: 'border-color 240ms',
      }}
      onMouseOver={() => setHovered(true)}
      onMouseOut={() => setHovered(false)}
    >
      <svg viewBox="0 0 420 128" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: svgOpacity }}>
        {svgPaths}
      </svg>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, rgba(20,16,11,0.86), transparent 64%)' }} />
      <div style={{ position: 'relative', padding: '16px 18px' }}>
        <div style={{ fontFamily: F.mono, fontSize: 8.5, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.gold, marginBottom: 7 }}>
          {kicker}
        </div>
        <div style={{ fontFamily: F.display, fontSize: 25, lineHeight: 1, color: '#f3ead9' }}>
          {title}
        </div>
      </div>
    </Link>
  );
};

// ── Draft placeholder card (Templates Room) ──────────────────────────────────
const DraftCard: React.FC<{ label: string; title: string; dek: string }> = ({ label, title, dek }) => (
  <div style={{ position: 'relative', border: '1px dashed rgba(168,135,77,0.35)', padding: 22, opacity: 0.78, overflow: 'hidden' }}>
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(135deg, rgba(168,135,77,0.05) 0 7px, transparent 7px 14px)' }} />
    <div style={{ position: 'relative' }}>
      <div style={{ fontFamily: F.mono, fontSize: 8.5, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dim, marginBottom: 18 }}>
        {label}
      </div>
      <div style={{ fontFamily: F.display, fontSize: 23, lineHeight: 1.05, color: '#b6a888', marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 12.5, lineHeight: 1.5, color: C.dim }}>
        {dek}
      </div>
    </div>
  </div>
);

// ── Responsive media query for the two-column room layout ────────────────────
// Inline styles can't express media queries, so we inject a scoped <style> tag.
const ROOM_RESPONSIVE_STYLE = `
  @media (max-width: 900px) {
    .tj-room { grid-template-columns: 1fr !important; gap: 48px !important; }
    .tj-rail { position: static !important; order: -1; }
  }
`;

// ── Main component ────────────────────────────────────────────────────────────
const ReadIndex: React.FC = () => {
  useImmersiveChrome(ACCENTS[0]);

  // Owner login gate — real auth, never a toggle. Read the signed-in role
  // straight from the stored token's claims: this works on the standalone Read
  // page (which doesn't run the admin login flow, so the store's platformRole
  // isn't populated here) and has no hydration-timing race. The dev-admin
  // toggle stays as a fallback for local development.
  const isDevAdmin = useAppStore((s) => s.isDevAdmin);
  const isAdmin = React.useMemo(() => {
    const claims = getTokenClaims();
    const role = claims?.role;
    const platformRole = claims?.platform_role;
    return (
      role === 'owner' ||
      role === 'admin' ||
      platformRole === 'platform_owner' ||
      platformRole === 'platform_admin' ||
      isDevAdmin
    );
  }, [isDevAdmin]);

  // Published articles from the DB — machinery kept from original ReadIndex.
  // The primary content surface is now the curated 14-piece index, but the
  // query is retained so published articles remain available if needed.
  const { data: published } = useQuery<DbArticle[]>({
    queryKey: ['read-published-articles'],
    queryFn: async () => {
      const res = await api.articles.listPublished(40, 0);
      const list = Array.isArray(res) ? res : (res?.articles ?? res?.data ?? []);
      return list as DbArticle[];
    },
  });

  // Suppress unused-variable warning — the query is kept for future use.
  void published;
  void isRealArticle;

  // How many pieces the current audience can see. A visitor counts only live
  // pieces; the owner counts all of them. Drives the masthead + contents labels.
  const allItems = INDEX_GROUPS.flatMap((g) => g.items);
  const liveCount = allItems.filter((it) => it.live).length;
  const shownCount = isAdmin ? allItems.length : liveCount;
  const piecesLabel = `${numberWord(shownCount)} ${shownCount === 1 ? 'piece' : 'pieces'}`;
  // Is the piece at this route published (live) yet? Used to gate the feature
  // covers for visitors while the owner always sees the full designed rail.
  const isLive = (href: string) => allItems.some((it) => it.href === href && it.live);

  const rootRef = useReveals([isAdmin]);
  const progress = useReadingProgress();

  return (
    <ImmersiveRoot rootRef={rootRef}>
      <Helmet><title>The Art of Tea · Read · Teajia</title></Helmet>

      {/* Responsive rule for two-column → one-column room collapse */}
      <style>{ROOM_RESPONSIVE_STYLE}</style>

      {/* NAV — index variant: no back arrow, no owner toggle */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '13px clamp(18px,4vw,44px)', background: 'rgba(20,16,11,0.72)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', borderBottom: '1px solid rgba(168,135,77,0.12)' }}>
        <span style={{ fontFamily: F.display, fontWeight: 600, fontSize: 18, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.ink }}>Teajia</span>
        <span style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dim, whiteSpace: 'nowrap' }}>Read · The Art of Tea</span>
        <ProgressTrack progress={progress} />
      </nav>

      <article style={{ position: 'relative', zIndex: 1 }}>

        {/* MASTHEAD */}
        <header style={{ position: 'relative', maxWidth: 1240, margin: '0 auto', padding: 'clamp(54px,9vw,118px) clamp(24px,5vw,56px) clamp(34px,5vw,56px)', overflow: 'hidden' }}>
          <div aria-hidden="true" style={{ position: 'absolute', top: '-12%', right: '-2%', fontFamily: F.cn, fontWeight: 200, fontSize: 'min(46vw,440px)', lineHeight: 1, color: 'rgba(168,135,77,0.05)', pointerEvents: 'none', userSelect: 'none' }}>茶</div>
          <div style={{ position: 'relative', maxWidth: 760 }}>
            <div style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: '0.42em', textTransform: 'uppercase', color: C.gold, marginBottom: 26 }}>
              A reading room · {piecesLabel.toLowerCase()}
            </div>
            <h1 style={{ fontFamily: F.display, fontWeight: 500, fontSize: 'clamp(54px,10vw,124px)', lineHeight: 0.92, letterSpacing: '0.01em', color: '#f3ead9', margin: 0 }}>
              The Art{' '}
              <span style={{ fontStyle: 'italic', color: C.gold }}>of Tea</span>
            </h1>
            <p style={{ fontFamily: F.display, fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(19px,2.4vw,27px)', lineHeight: 1.45, color: '#cdc0a8', margin: '26px 0 0', maxWidth: 540 }}>
              Long, slow pieces on the people and patience behind the world&rsquo;s oldest drink. Sit. The kettle is on.
            </p>
          </div>
        </header>

        {/* READING ROOM: two-column index + cover rail */}
        <div
          className="tj-room"
          data-reveal
          style={{
            maxWidth: 1240,
            margin: '0 auto',
            padding: 'clamp(20px,3vw,40px) clamp(24px,5vw,56px) clamp(40px,6vw,80px)',
            display: 'grid',
            gridTemplateColumns: 'minmax(0,1.55fr) minmax(0,1fr)',
            gap: 'clamp(36px,5vw,76px)',
            alignItems: 'start',
          }}
        >
          {/* LEFT: CONTENTS INDEX */}
          <section>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 8 }}>
              <span style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.26em', textTransform: 'uppercase', color: C.dim }}>Contents</span>
              <span style={{ flex: 1, height: 1, background: 'rgba(168,135,77,0.18)' }} />
              <span style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: '0.1em', color: C.dim }}>{piecesLabel}</span>
            </div>
            {INDEX_GROUPS.map((group) => (
              <GroupBlock key={group.label} group={group} isAdmin={isAdmin} />
            ))}
            {/* Public empty state — only when a visitor has no live pieces yet. */}
            {!isAdmin && liveCount === 0 && (
              <p style={{ fontFamily: F.display, fontStyle: 'italic', fontSize: 18, lineHeight: 1.55, color: C.dim, margin: '38px 2px 0', maxWidth: 460 }}>
                The first pieces are being set in type. Come back soon, the kettle is on.
              </p>
            )}
          </section>

          {/* RIGHT: COVER RAIL (sticky). The featured covers are the owner's
              "This Issue" picks. A visitor only sees a featured cover if its
              piece is live; the owner always sees the full designed rail. When
              a visitor has no live featured pieces, the rail hides entirely so
              the page never shows a broken or empty feature. */}
          <aside className="tj-rail" style={{ position: 'sticky', top: 88, display: (isAdmin || isLive('/read/leaf-to-liquor') || isLive('/read/legend') || isLive('/read/tea-house')) ? 'block' : 'none' }}>
            <div style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.26em', textTransform: 'uppercase', color: C.dim, marginBottom: 18 }}>
              This issue
            </div>

            {(isAdmin || isLive('/read/leaf-to-liquor')) && <LeadCover />}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
              {(isAdmin || isLive('/read/legend')) && (
              <SecondaryCover
                to="/read/legend"
                kicker="Legend · N°13"
                title={<>The Immortals&rsquo; <span style={{ fontStyle: 'italic', color: C.gold }}>Cliff</span></>}
                svgOpacity={0.5}
                bgGradient="linear-gradient(150deg,#3a2418,#181009)"
                strokeColor="rgba(190,110,60,0.3)"
                svgPaths={
                  <g fill="none" stroke="rgba(190,110,60,0.3)" strokeWidth="1">
                    <path d="M-20 48 C 120 34, 240 42, 460 18" />
                    <path d="M-20 84 C 120 66, 260 74, 460 48" />
                  </g>
                }
              />
              )}
              {(isAdmin || isLive('/read/tea-house')) && (
              <SecondaryCover
                to="/read/tea-house"
                kicker="A Tea House · N°09"
                title={<>Quiet <span style={{ fontStyle: 'italic', color: C.gold }}>Hours</span></>}
                svgOpacity={0.45}
                bgGradient="linear-gradient(150deg,#22271a,#13120b)"
                strokeColor="rgba(168,135,77,0.26)"
                svgPaths={
                  <g fill="none" stroke="rgba(168,135,77,0.26)" strokeWidth="1">
                    <path d="M-20 54 C 120 40, 240 48, 460 24" />
                    <path d="M-20 90 C 120 72, 260 80, 460 54" />
                  </g>
                }
              />
              )}
            </div>

            <p style={{ fontFamily: F.display, fontStyle: 'italic', fontSize: 16, lineHeight: 1.5, color: C.dim, margin: '22px 2px 0' }}>
              New pieces are set in type as they are finished. The index below holds them all.
            </p>
          </aside>
        </div>

        {/* TEMPLATES ROOM — owner only, real login gate */}
        {isAdmin && (
          <section style={{ position: 'relative', borderTop: '1px dashed rgba(168,135,77,0.4)', background: '#100d09', backgroundImage: 'linear-gradient(rgba(168,135,77,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(168,135,77,0.04) 1px, transparent 1px)', backgroundSize: '26px 26px' }}>
            <div style={{ maxWidth: 1240, margin: '0 auto', padding: 'clamp(40px,6vw,72px) clamp(24px,5vw,56px) clamp(48px,7vw,88px)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
                <span style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: '0.26em', textTransform: 'uppercase', color: C.gold }}>Owner only · Unpublished</span>
                <span style={{ flex: 1, borderTop: '1px dashed rgba(168,135,77,0.3)' }} />
                <span style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: '0.1em', color: C.dim }}>Not on the public page</span>
              </div>
              <h2 style={{ fontFamily: F.display, fontWeight: 400, fontStyle: 'italic', fontSize: 'clamp(28px,4vw,42px)', lineHeight: 1, color: '#9e8f76', margin: '0 0 8px' }}>
                The Templates Room
              </h2>
              <p style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 15, lineHeight: 1.55, color: C.dim, margin: '0 0 32px', maxWidth: 520 }}>
                Unpublished article layouts, kept behind the curtain. Only you can see these. Duplicate one to begin a new piece.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap: 16 }}>
                <DraftCard label="Draft · T1" title="Interview layout"    dek="Two voices, pull quotes, a single portrait plate." />
                <DraftCard label="Draft · T2" title="Photo essay layout"  dek="Full bleed plates, minimal caption furniture." />
                <DraftCard label="Draft · T3" title="Interactive timeline" dek="Scroll driven, the whole story on one moving line." />
                <DraftCard label="Draft · T4" title="Tasting &amp; radar"  dek="A flavour wheel and a tasting radar, side by side." />
              </div>
            </div>
          </section>
        )}

        {/* COLOPHON */}
        <footer style={{ borderTop: '1px solid rgba(168,135,77,0.14)', padding: 'clamp(44px,6vw,76px) clamp(24px,5vw,56px) clamp(64px,9vw,110px)', textAlign: 'center' }}>
          <div aria-hidden="true" style={{ fontFamily: F.cn, fontSize: 38, fontWeight: 200, color: C.gold, opacity: 0.7, marginBottom: 24 }}>茶</div>
          <p style={{ fontFamily: F.display, fontStyle: 'italic', fontSize: 'clamp(18px,2.4vw,24px)', lineHeight: 1.5, color: '#cdc0a8', margin: '0 auto', maxWidth: 560 }}>
            To learn tea is to learn where to stop. The rest, the leaf will teach you.
          </p>
          <div style={{ marginTop: 30, fontFamily: F.mono, fontSize: 10, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim, lineHeight: 2 }}>
            Teajia · Read · The Art of Tea
          </div>
        </footer>

      </article>
    </ImmersiveRoot>
  );
};

export default ReadIndex;
