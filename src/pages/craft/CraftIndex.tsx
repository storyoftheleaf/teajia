/**
 * The Work of Tea: Craft-section index.
 *
 * Built in the exact frame `ReadIndex.tsx` established (ImmersiveRoot, the
 * masthead, the two-column contents + sticky cover rail, the same reveal and
 * owner-draft behaviour), rather than a second design invented from scratch.
 * What differs is content: Craft gathers everything a practitioner needs
 * (brewing, tasting, reference, the room they sit in), not the magazine's
 * long reads, and unlike Read, most of its rows point at other parts of the
 * site (a /craft?v= sub-view, /wisdom, /discover) rather than at another
 * /read/* article.
 *
 * Every row answers to `craftLive.ts`, Craft's own live/draft map, because
 * Adrian's rule (2026-09-22) is that a visitor sees only what he wrote: the
 * glossary to begin with, the rest as each is finished. A /read/* row must
 * also be published in Read. The owner sees every row, drafts dimmed and
 * tagged, so the whole workshop is visible to the one person setting it up.
 *
 * Row numbering (N°01…) is NOT baked into the data the way Read's is: it is
 * computed at render time over the rows the current viewer can see, in
 * document order, so a visitor's first piece is really the first piece they
 * can open, and the owner's numbering runs over the drafts too.
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  C, F, ImmersiveRoot, useImmersiveChrome, useReveals, useReadingProgress,
  ProgressTrack, ACCENTS,
} from '../read/immersive';
import { isArticleVisible, useIsReadOwner } from '../read/publishGate';
import { numberWord } from '../read/ReadIndex';
import { GLOSSARY_TERMS, termOfTheDay } from '../../data/glossary';
import { CRAFT_LIVE } from './craftLive';

// ── Gate. A row is live for a visitor when craftLive.ts says so, and, for a
// /read/* row, when Read publishes the piece as well. The owner sees every
// row; the ones a visitor would not get are drafts, dimmed and tagged. A row
// missing from the map reads as a draft, the same fail-closed default as
// articleLive.ts, so a new row cannot go public by being forgotten. ─────────
function isCraftReadHref(href: string): boolean {
  return href.startsWith('/read/');
}
function craftItemLiveForVisitor(href: string): boolean {
  if (CRAFT_LIVE[href] !== true) return false;
  if (isCraftReadHref(href)) return isArticleVisible(href, false);
  return true;
}
function craftItemVisible(href: string, isOwner: boolean): boolean {
  return isOwner || craftItemLiveForVisitor(href);
}
function craftItemIsDraft(href: string, isOwner: boolean): boolean {
  return isOwner && !craftItemLiveForVisitor(href);
}

// ── Data ──────────────────────────────────────────────────────────────────
type CraftItem = { rubric: string; title: string; dek: string; href: string };
type CraftGroup = { label: string; note: string; items: CraftItem[] };

function buildCraftGroups(): CraftGroup[] {
  const glossaryCount = GLOSSARY_TERMS.length;
  const today = termOfTheDay();
  return [
    {
      label: 'Brew',
      note: 'the kettle, the leaf, the vessel',
      items: [
        { rubric: 'ritual', title: 'Seven Steeps', dek: 'The same leaves, brewed seven ways, scroll to pour.', href: '/read/ritual' },
        { rubric: 'water', title: 'Water Before Leaf', dek: 'A field study. What the water brings before the tea does.', href: '/read/field-study' },
        { rubric: 'teaware', title: 'Porcelain and Tea', dek: 'The renewal of a material, and what it does to the cup.', href: '/read/porcelain-and-tea' },
        { rubric: 'teaware', title: 'The Pot That Remembers', dek: 'Yixing clay, seasoning, and one tea per pot.', href: '/read/craft' },
      ],
    },
    {
      label: 'Taste',
      note: 'the palate, shaped',
      items: [
        { rubric: 'tasting', title: 'The Vocabulary of Taste', dek: 'A turning flavour wheel and a tasting radar.', href: '/read/tasting' },
        { rubric: 'guided', title: 'Three Journeys', dek: 'Guided tastings, step by step, to shape your palate.', href: '/craft?v=journeys' },
        { rubric: 'tool', title: 'Discover Your Tea', dek: 'A few quiet questions, and where to begin.', href: '/discover' },
      ],
    },
    {
      label: 'Know',
      note: 'the reference',
      items: [
        { rubric: 'reference', title: 'The Tea Reference', dek: 'Cultivars, regions, producers, styles, marks and named teas.', href: '/wisdom' },
        { rubric: `${glossaryCount} terms`, title: 'The Glossary', dek: `${glossaryCount} terms. Today: ${today.term}.`, href: '/craft?v=glossary' },
        { rubric: 'lessons', title: 'Six Foundations', dek: 'Leaf, water, origin, ceremony, vessel, culture. Short reads.', href: '/craft?v=course' },
        { rubric: 'list', title: 'Reading and Listening', dek: 'Books and voices worth your evenings.', href: '/craft?v=reading' },
      ],
    },
    {
      label: 'Room',
      note: 'the place you sit',
      items: [
        { rubric: 'spaces', title: 'Six Tea Spaces', dek: 'A corner, a shelf, a table. What each needs.', href: '/craft?v=spaces' },
        { rubric: 'voices', title: 'Shared Wisdom', dek: 'Reflections, tips and rituals from people at the table.', href: '/craft?v=wisdom' },
      ],
    },
  ];
}

// ── Index row ─────────────────────────────────────────────────────────────
const CraftRow: React.FC<{ item: CraftItem; n: string; draft?: boolean }> = ({ item, n, draft }) => {
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
        borderBottom: '1px solid rgb(var(--tj-read-gold-rgb) / 0.10)',
        textDecoration: 'none',
        color: 'inherit',
        opacity: draft ? 0.5 : 1,
        transition: 'padding-left 240ms, opacity 240ms',
      }}
      onMouseOver={() => setHovered(true)}
      onMouseOut={() => setHovered(false)}
    >
      <span style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: '0.06em', color: hovered ? C.goldLt : C.gold, paddingTop: 5, transition: 'color 240ms' }}>
        {n}
      </span>
      <span>
        <span style={{ display: 'block', fontFamily: F.display, fontSize: 'clamp(22px,2.4vw,27px)', lineHeight: 1.08, color: hovered ? 'var(--tj-read-hover-ink)' : 'var(--tj-read-ink)', transition: 'color 240ms' }}>
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
          <span style={{ fontFamily: F.mono, fontSize: 8.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.gold, border: '1px solid rgb(var(--tj-read-gold-rgb) / 0.4)', borderRadius: 2, padding: '1px 5px', whiteSpace: 'nowrap' }}>
            Draft
          </span>
        )}
      </span>
    </Link>
  );
};

// ── Group block. Renders nothing when no row in it is visible to the
// current audience (the same "a group with no visible rows renders nothing"
// rule Read's GroupBlock follows). ──────────────────────────────────────────
const CraftGroupBlock: React.FC<{ group: CraftGroup; isOwner: boolean; numberByHref: Map<string, string> }> = ({ group, isOwner, numberByHref }) => {
  const visible = group.items.filter((it) => craftItemVisible(it.href, isOwner));
  if (visible.length === 0) return null;
  return (
    <div style={{ marginTop: 38 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 4 }}>
        <span style={{ fontFamily: F.ui, fontSize: 9.5, fontWeight: 500, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--tj-read-dim)' }}>
          {group.label}
        </span>
        <span style={{ flex: 1, height: 1, background: 'rgb(var(--tj-read-gold-rgb) / 0.14)' }} />
        <span style={{ fontFamily: F.mono, fontSize: 10, color: C.dim }}>
          {String(visible.length).padStart(2, '0')}
        </span>
      </div>
      <p style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 12.5, lineHeight: 1.5, color: C.dim, margin: '0 0 6px' }}>
        {group.note}
      </p>
      {visible.map((item) => (
        <CraftRow
          key={item.href}
          item={item}
          n={numberByHref.get(item.href) ?? ''}
          draft={craftItemIsDraft(item.href, isOwner)}
        />
      ))}
    </div>
  );
};

// ── Lead cover: the first live row in the rail's order of preference. Today
// that is the Glossary, the one piece Adrian wrote; Discover Your Tea takes
// the lead back the day it goes live in craftLive.ts. ──────────────────────
type CoverSpec = { to: string; kicker: string; title: React.ReactNode; line: string };
const COVERS: CoverSpec[] = [
  { to: '/discover', kicker: 'Tool', title: <>Discover <span style={{ fontStyle: 'italic', color: C.gold }}>your tea</span></>, line: 'A few quiet questions, and a first tea to brew tonight.' },
  { to: '/craft?v=glossary', kicker: 'Terms', title: <>The <span style={{ fontStyle: 'italic', color: C.gold }}>Glossary</span></>, line: 'The language of tea, one word at a time. Start with today’s.' },
  { to: '/read/ritual', kicker: 'Ritual', title: <>Seven <span style={{ fontStyle: 'italic', color: C.gold }}>Steeps</span></>, line: 'The same leaves, brewed seven ways.' },
  { to: '/wisdom', kicker: 'Reference', title: <>The Tea <span style={{ fontStyle: 'italic', color: C.gold }}>Reference</span></>, line: 'Cultivars, regions, producers, styles, marks and named teas.' },
];

const LeadCover: React.FC<{ cover: CoverSpec; n: string }> = ({ cover, n }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      to={cover.to}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        minHeight: 'clamp(320px,40vw,400px)',
        border: `1px solid ${hovered ? 'rgb(var(--tj-read-gold-rgb) / 0.5)' : 'rgb(var(--tj-read-gold-rgb) / 0.24)'}`,
        overflow: 'hidden',
        textDecoration: 'none',
        color: 'inherit',
        background: 'linear-gradient(158deg,var(--tj-read-card-from) 0%,var(--tj-read-card-to) 56%,var(--tj-read-bg) 100%)',
        transition: 'border-color 240ms',
      }}
      onMouseOver={() => setHovered(true)}
      onMouseOut={() => setHovered(false)}
    >
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 64% 56% at 60% 28%, rgb(var(--tj-read-gold-rgb) / 0.10), transparent 64%)' }} />
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, rgb(var(--tj-read-bg-rgb) / 0.92), transparent 52%)' }} />
      <div style={{ position: 'relative', padding: 'clamp(24px,3vw,32px)' }}>
        <div style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: '0.26em', textTransform: 'uppercase', color: C.gold, marginBottom: 14 }}>
          Start here · {n}
        </div>
        <div style={{ fontFamily: F.display, fontWeight: 400, fontSize: 'clamp(34px,4.4vw,46px)', lineHeight: 0.98, color: 'var(--tj-read-cream)' }}>
          {cover.title}
        </div>
        <div style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 14, lineHeight: 1.5, color: 'var(--tj-read-taupe)', marginTop: 14, maxWidth: 330 }}>
          {cover.line}
        </div>
      </div>
    </Link>
  );
};

// ── Secondary cover, reused for both slots ───────────────────────────────
const SecondaryCover: React.FC<{ to: string; kicker: string; title: React.ReactNode }> = ({ to, kicker, title }) => {
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
        border: `1px solid ${hovered ? 'rgb(var(--tj-read-gold-rgb) / 0.45)' : 'rgb(var(--tj-read-gold-rgb) / 0.18)'}`,
        overflow: 'hidden',
        textDecoration: 'none',
        color: 'inherit',
        background: 'linear-gradient(150deg,var(--tj-read-card-from),var(--tj-read-card-to))',
        transition: 'border-color 240ms',
      }}
      onMouseOver={() => setHovered(true)}
      onMouseOut={() => setHovered(false)}
    >
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, rgb(var(--tj-read-bg-rgb) / 0.86), transparent 64%)' }} />
      <div style={{ position: 'relative', padding: '16px 18px' }}>
        <div style={{ fontFamily: F.mono, fontSize: 8.5, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.gold, marginBottom: 7 }}>
          {kicker}
        </div>
        <div style={{ fontFamily: F.display, fontSize: 25, lineHeight: 1, color: 'var(--tj-read-cream)' }}>
          {title}
        </div>
      </div>
    </Link>
  );
};

// ── Responsive rule for the two-column room collapse, scoped to this page
// so it never fights the identically-named rule ReadIndex injects for /read.
const CRAFT_ROOM_RESPONSIVE_STYLE = `
  @media (max-width: 900px) {
    .tj-craft-room { grid-template-columns: 1fr !important; gap: 48px !important; }
    .tj-craft-rail { position: static !important; order: -1; }
  }
`;

// ── Main component ───────────────────────────────────────────────────────
const CraftIndex: React.FC = () => {
  useImmersiveChrome(ACCENTS[0]);

  const isOwner = useIsReadOwner();
  const groups = useMemo(() => buildCraftGroups(), []);

  // Every row visible to the current audience, in document order, numbered
  // continuously across groups. This is what the eyebrow's piece count and
  // every row's N° both read from, so the two can never disagree.
  const numberByHref = useMemo(() => {
    const map = new Map<string, string>();
    let i = 0;
    for (const group of groups) {
      for (const item of group.items) {
        if (!craftItemVisible(item.href, isOwner)) continue;
        i += 1;
        map.set(item.href, `N°${String(i).padStart(2, '0')}`);
      }
    }
    return map;
  }, [groups, isOwner]);

  const shownCount = numberByHref.size;
  const piecesLabel = `${numberWord(shownCount)} ${shownCount === 1 ? 'piece' : 'pieces'}`;
  // "One piece, to begin": the masthead says out loud that the workshop is
  // opening with a single piece, rather than counting to one in silence.
  const eyebrowLabel = shownCount === 1 ? `${piecesLabel}, to begin` : piecesLabel;
  const canSee = (href: string) => craftItemVisible(href, isOwner);
  // The rail shows only covers the viewer can open, lead first, in the
  // order COVERS prefers, so the owner's rail and a visitor's rail both lead
  // with something that exists for them.
  const railCovers = COVERS.filter((cover) => canSee(cover.to));

  const rootRef = useReveals([isOwner]);
  const progress = useReadingProgress();

  return (
    <ImmersiveRoot rootRef={rootRef}>
      <Helmet>
        <title>Craft · Teajia</title>
        <meta name="description" content="A workshop for your tea practice. Brew, taste, know, and the room you sit in." />
      </Helmet>

      <style>{CRAFT_ROOM_RESPONSIVE_STYLE}</style>

      {/* NAV: same chrome as the Read index, no back arrow, no owner toggle */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '13px clamp(18px,4vw,44px)', background: 'rgb(var(--tj-read-bg-rgb) / 0.72)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', borderBottom: '1px solid rgb(var(--tj-read-gold-rgb) / 0.12)' }}>
        <span style={{ fontFamily: F.display, fontWeight: 600, fontSize: 18, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.ink }}>Teajia</span>
        <span style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dim, whiteSpace: 'nowrap' }}>Craft · The Work of Tea</span>
        <ProgressTrack progress={progress} />
      </nav>

      <article style={{ position: 'relative', zIndex: 1 }}>

        {/* MASTHEAD */}
        <header style={{ position: 'relative', maxWidth: 1240, margin: '0 auto', padding: 'clamp(54px,9vw,118px) clamp(24px,5vw,56px) clamp(34px,5vw,56px)', overflow: 'hidden' }}>
          <div aria-hidden="true" style={{ position: 'absolute', top: '-12%', right: '-2%', fontFamily: F.cn, fontWeight: 200, fontSize: 'min(46vw,440px)', lineHeight: 1, color: 'rgb(var(--tj-read-gold-rgb) / 0.05)', pointerEvents: 'none', userSelect: 'none' }}>茶</div>
          <div style={{ position: 'relative', maxWidth: 760 }}>
            <div style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: '0.42em', textTransform: 'uppercase', color: C.gold, marginBottom: 26 }}>
              A workshop · {eyebrowLabel.toLowerCase()}
            </div>
            <h1 style={{ fontFamily: F.display, fontWeight: 500, fontSize: 'clamp(54px,10vw,124px)', lineHeight: 0.92, letterSpacing: '0.01em', color: 'var(--tj-read-cream)', margin: 0 }}>
              The Work{' '}
              <span style={{ fontStyle: 'italic', color: C.gold }}>of Tea</span>
            </h1>
            <p style={{ fontFamily: F.display, fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(19px,2.4vw,27px)', lineHeight: 1.45, color: 'var(--tj-read-taupe)', margin: '26px 0 0', maxWidth: 540 }}>
              Everything I wish someone had given me when I started. Take what you need.
            </p>
          </div>
        </header>

        {/* WORKSHOP: two-column index + cover rail */}
        <div
          className="tj-craft-room"
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
              <span style={{ flex: 1, height: 1, background: 'rgb(var(--tj-read-gold-rgb) / 0.18)' }} />
              <span style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: '0.1em', color: C.dim }}>{piecesLabel}</span>
            </div>
            {groups.map((group) => (
              <CraftGroupBlock key={group.label} group={group} isOwner={isOwner} numberByHref={numberByHref} />
            ))}
            {!isOwner && shownCount === 0 && (
              <p style={{ fontFamily: F.display, fontStyle: 'italic', fontSize: 18, lineHeight: 1.55, color: C.dim, margin: '38px 2px 0', maxWidth: 460 }}>
                The workshop is being set up. Come back soon, the kettle is on.
              </p>
            )}
          </section>

          {/* RIGHT: COVER RAIL (sticky) */}
          <aside className="tj-craft-rail" style={{ position: 'sticky', top: 88, display: railCovers.length > 0 ? 'block' : 'none' }}>
            <div style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.26em', textTransform: 'uppercase', color: C.dim, marginBottom: 18 }}>
              Start here
            </div>

            {railCovers[0] && <LeadCover cover={railCovers[0]} n={numberByHref.get(railCovers[0].to) ?? ''} />}

            {railCovers.length > 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
                {railCovers.slice(1, 3).map((cover) => (
                  <SecondaryCover
                    key={cover.to}
                    to={cover.to}
                    kicker={`${cover.kicker} · ${numberByHref.get(cover.to) ?? ''}`}
                    title={cover.title}
                  />
                ))}
              </div>
            )}

            <p style={{ fontFamily: F.display, fontStyle: 'italic', fontSize: 16, lineHeight: 1.5, color: C.dim, margin: '22px 2px 0' }}>
              New pieces are set in type as they are finished. The contents hold them all.
            </p>
          </aside>
        </div>

        {/* Footer is rendered globally by App.tsx for all browse pages, no
            page-local footer here, or it double-renders. */}

      </article>
    </ImmersiveRoot>
  );
};

export default CraftIndex;
