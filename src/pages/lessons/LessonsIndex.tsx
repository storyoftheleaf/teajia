/**
 * Lessons: Read's second shelf (/read/lessons), between Stories and Wisdom.
 *
 * This was the Craft index. Craft left the bar on 2026-11-27 and Adrian chose
 * "Read: Stories, Lessons, Wisdom": the magazine stays a magazine, the things
 * you work through step by step come here, and the things you look up live in
 * the Wisdom Base. Where each Craft piece went:
 *
 *   Stories (/read): Seven Steeps, Water Before the Leaf, Porcelain and Tea,
 *     The Pot That Remembers, The Vocabulary of Taste. Unchanged, they were
 *     always Read articles.
 *   Lessons (here): Discover Your Tea, Six Foundations, Brewing by Tea Type,
 *     Three Journeys, Reading and Listening.
 *   Wisdom (/wisdom): The Tea Reference, and the Glossary at /wisdom/glossary.
 *   Room pieces, waiting for their sections: Six Tea Spaces and Playlists go
 *     to Tea house, Shared Wisdom (renamed) to Tea table. Until those pages
 *     take them, Tea Spaces and Shared Wisdom stay reachable to the owner at
 *     /read/lessons?v=spaces and ?v=wisdom, and Playlists was never built.
 *
 * Built in the exact frame `ReadIndex.tsx` established (ImmersiveRoot, the
 * masthead, the two-column contents + sticky cover rail, the same reveal and
 * owner-draft behaviour). Every row answers to `lessonsLive.ts`: a visitor
 * sees live rows as links, soon rows as a title with no way in, and never a
 * draft. Photos: the page keeps StoryEditProvider slug="craft" on purpose, so
 * every photograph Adrian already placed on Craft's covers stays where it is.
 */
import React, { useMemo, useState } from 'react';
import { ReadShelves } from '../../components/shared/ReadShelves';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  C, F, ImmersiveRoot, useImmersiveChrome, useReveals, useReadingProgress,
  ProgressTrack, ACCENTS,
} from '../read/immersive';
import { isArticleVisible, useIsReadOwner, useKnownReadOverrides } from '../read/publishGate';
import type { ReadPublishOverrides } from '../read/articleLive';
import { numberWord } from '../read/ReadIndex';
import { StoryEditProvider } from '../read/storyEdit';
import EditablePhoto from '../read/EditablePhoto';
import StoryEditorBar from '../read/StoryEditorBar';
import { LESSON_STATE, type LessonState } from './lessonsLive';

// ── Gate. A row's state comes from lessonsLive.ts, keyed by the row's own
// `key` (not its href, since a "soon" row may have no href at all). A
// /read/* row additionally has to clear Read's own gate, `isArticleVisible`,
// so Lessons can never send a visitor to an article Read itself would refuse
// to show them: a row named `live` there but not actually published in Read
// reads here as `draft`, honestly, for owner and visitor alike. A key
// missing from LESSON_STATE reads as `draft`, the same fail-closed default as
// articleLive.ts, so a new row cannot go public by being forgotten. ────────
function isLessonReadHref(href?: string): boolean {
  return !!href && href.startsWith('/read/');
}
function lessonReadGatePasses(item: LessonItem, states?: ReadPublishOverrides): boolean {
  if (!isLessonReadHref(item.href)) return true;
  return isArticleVisible(item.href as string, false, states);
}
function lessonEffectiveState(item: LessonItem, states?: ReadPublishOverrides): LessonState {
  const state = LESSON_STATE[item.key] ?? 'draft';
  if (state === 'live' && !lessonReadGatePasses(item, states)) return 'draft';
  return state;
}
function lessonItemVisible(item: LessonItem, isOwner: boolean, states?: ReadPublishOverrides): boolean {
  return isOwner || lessonEffectiveState(item, states) !== 'draft';
}

// ── Data ──────────────────────────────────────────────────────────────────
type LessonItem = { key: string; rubric: string; title: string; dek: string; href?: string };
type LessonGroup = { label: string; note: string; items: LessonItem[] };

function buildLessonGroups(): LessonGroup[] {
  return [
    {
      label: 'Begin',
      note: 'where to start',
      items: [
        { key: 'discover', rubric: 'tool', title: 'Discover Your Tea', dek: 'A few quiet questions, and where to begin.', href: '/discover' },
        { key: 'foundations', rubric: 'lessons', title: 'Six Foundations', dek: 'Leaf, water, origin, ceremony, vessel, culture. Short reads.', href: '/read/lessons?v=course' },
      ],
    },
    {
      label: 'Practise',
      note: 'the kettle and the palate',
      items: [
        { key: 'brew-by-type', rubric: 'guides', title: 'Brewing by Tea Type', dek: "Green, white, oolong, black, pu'er, yellow. Leaf, water, time." },
        { key: 'journeys', rubric: 'guided', title: 'Three Journeys', dek: 'Guided tastings, step by step, to shape your palate.', href: '/read/lessons?v=journeys' },
      ],
    },
    {
      label: 'Go further',
      note: 'books and voices',
      items: [
        { key: 'reading', rubric: 'list', title: 'Reading and Listening', dek: 'Books and voices worth your evenings.', href: '/read/lessons?v=reading' },
      ],
    },
  ];
}

// Every key the contents actually carries, read once at module load so
// lessonsLive.ts's map can be checked against the real rows rather than a
// second, hand-typed list. Exported for LessonsIndex.test.tsx.
const LESSON_GROUPS_SEED = buildLessonGroups();
export const LESSON_ROW_KEYS: string[] = LESSON_GROUPS_SEED.flatMap((g) => g.items.map((it) => it.key));

// ── Index row. Three states, three renderings: `live` is a real link,
// `draft` is unchanged (owner-only, dimmed, tagged), `soon` shows a title
// and a dek with no way in for a visitor, and, for the owner, a real link
// when one exists so he can reach the construction he is building. ────────
const LessonRow: React.FC<{ item: LessonItem; state: LessonState; isOwner: boolean }> = ({ item, state, isOwner }) => {
  const [hovered, setHovered] = useState(false);
  const isSoon = state === 'soon';
  const isDraft = state === 'draft';
  const asLink = isSoon ? (isOwner && !!item.href) : !!item.href;
  const hoverable = asLink && !isSoon;
  const rubricLabel = isSoon ? 'coming soon' : item.rubric;

  const rowStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    alignItems: 'baseline',
    gap: 16,
    padding: hoverable && hovered ? '15px 6px 15px 14px' : '15px 6px',
    borderBottom: '1px solid rgb(var(--tj-read-gold-rgb) / 0.10)',
    textDecoration: 'none',
    color: 'inherit',
    opacity: isDraft ? 0.5 : isSoon ? 0.62 : 1,
    transition: 'padding-left 240ms, opacity 240ms',
    cursor: isSoon && !asLink ? 'default' : undefined,
  };

  const inner = (
    <>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontFamily: F.display, fontSize: 'clamp(22px,2.4vw,27px)', lineHeight: 1.08, color: hoverable && hovered ? 'var(--tj-read-hover-ink)' : 'var(--tj-read-ink)', transition: 'color 240ms' }}>
          {item.title}
        </span>
        <span style={{ display: 'block', fontFamily: F.body, fontStyle: 'italic', fontSize: 13, lineHeight: 1.45, color: C.dim, marginTop: 4 }}>
          {item.dek}
        </span>
      </span>
      <span className="tj-craft-rubric" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, paddingTop: 6 }}>
        <span style={{ fontFamily: F.ui, fontSize: 9, fontWeight: 500, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.dim, whiteSpace: 'nowrap' }}>
          {rubricLabel}
        </span>
        {isDraft && (
          <span style={{ fontFamily: F.mono, fontSize: 8.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.gold, border: '1px solid rgb(var(--tj-read-gold-rgb) / 0.4)', borderRadius: 2, padding: '1px 5px', whiteSpace: 'nowrap' }}>
            Draft
          </span>
        )}
      </span>
    </>
  );

  if (asLink && item.href) {
    return (
      <Link
        to={item.href}
        style={rowStyle}
        className="tj-craft-row"
        onMouseOver={() => hoverable && setHovered(true)}
        onMouseOut={() => hoverable && setHovered(false)}
      >
        {inner}
      </Link>
    );
  }
  return (
    <div style={rowStyle} className="tj-craft-row" aria-label={isSoon ? `${item.title}, coming soon` : undefined}>
      {inner}
    </div>
  );
};

// ── Group block. Renders nothing when no row in it is visible to the
// current audience (the same "a group with no visible rows renders nothing"
// rule Read's GroupBlock follows). ──────────────────────────────────────────
const LessonGroupBlock: React.FC<{ group: LessonGroup; isOwner: boolean; states: ReadPublishOverrides }> = ({ group, isOwner, states }) => {
  const visible = group.items.filter((it) => lessonItemVisible(it, isOwner, states));
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
        <LessonRow
          key={item.key}
          item={item}
          state={lessonEffectiveState(item, states)}
          isOwner={isOwner}
        />
      ))}
    </div>
  );
};

// ── Lead cover: the first live row in the rail's order of preference.
// Discover Your Tea is the one live lesson today, so it leads alone. Seven
// Steeps and the Tea Reference covers left with their pieces (Stories and
// Wisdom). Add a lesson's cover here when it goes live. ───────────────────
type CoverSpec = { to: string; kicker: string; title: React.ReactNode; line: string; slot?: string; placeholder?: string };

const COVERS: CoverSpec[] = [
  { to: '/discover', kicker: 'Tool', title: <>Discover <span style={{ fontStyle: 'italic', color: C.gold }}>your tea</span></>, line: 'A few quiet questions, and a first tea to brew tonight.', slot: 'cover-discover', placeholder: '/home/standin-tea.webp' },
];

const LeadCover: React.FC<{ cover: CoverSpec }> = ({ cover }) => {
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
      {cover.slot && (
        <div className="tj-craft-photo" style={{ position: 'absolute', inset: 0 }}>
          <EditablePhoto
            slot={cover.slot}
            alt=""
            fill
            placeholderBg="var(--tj-read-bg)"
            placeholder={<img src={cover.placeholder} alt="" className="absolute inset-0 w-full h-full object-cover" />}
          />
        </div>
      )}
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 64% 56% at 60% 28%, rgb(var(--tj-read-gold-rgb) / 0.10), transparent 64%)' }} />
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, rgb(var(--tj-read-bg-rgb) / 0.92), transparent 52%)' }} />
      <div style={{ position: 'relative', padding: 'clamp(24px,3vw,32px)' }}>
        <div style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: '0.26em', textTransform: 'uppercase', color: C.gold, marginBottom: 14 }}>
          {cover.kicker}
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
const SecondaryCover: React.FC<{ to: string; kicker: string; title: React.ReactNode; slot?: string; placeholder?: string }> = ({ to, kicker, title, slot, placeholder }) => {
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
      {slot && (
        <div className="tj-craft-photo" style={{ position: 'absolute', inset: 0 }}>
          <EditablePhoto
            slot={slot}
            alt=""
            fill
            placeholderBg="var(--tj-read-bg)"
            placeholder={<img src={placeholder} alt="" className="absolute inset-0 w-full h-full object-cover" />}
          />
        </div>
      )}
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

// ── Coming soon strip. Adrian's words, 2026-09-22: "even if it's coming
// soon, we have an image of what will be built, then 'coming soon', and in
// the background the template that displays what we're building, but it
// doesn't link in, so people don't get into the construction side." Two
// panels, one photograph and one line of real type. Never a link. The ghost
// sketch of the surface being built was taken out 2026-09-24: under the
// 2026-09-23 rule for empty plates, nothing is drawn where content is not. ──────────────────────────────────────
type SoonPanelSpec = { key: string; slot: string; placeholder: string; title: string; dek: string; /** focal point of the photo, as CSS object-position */ position?: string };

const SOON_PANELS: SoonPanelSpec[] = [
  { key: 'brew-by-type', slot: 'soon-brew', placeholder: '/home/standin-tea.webp', title: 'Brewing by Tea Type', dek: "Green, white, oolong, black, pu'er, yellow." },
  { key: 'journeys', slot: 'soon-journeys', placeholder: '/craft/three-journeys.jpg', position: '50% 74%', title: 'Three Journeys', dek: 'Guided tastings, step by step, to shape your palate.' },
];

const ComingSoonPanel: React.FC<Omit<SoonPanelSpec, 'key'>> = ({ slot, placeholder, position, title, dek }) => (
  <div
    aria-label={`${title}, coming soon`}
    style={{
      position: 'relative',
      minHeight: 150,
      border: '1px solid rgb(var(--tj-read-gold-rgb) / 0.16)',
      overflow: 'hidden',
    }}
  >
    <div className="tj-craft-photo" style={{ position: 'absolute', inset: 0 }}>
      <EditablePhoto
        slot={slot}
        alt=""
        fill
        placeholderBg="var(--tj-read-bg)"
        placeholder={<img src={placeholder} alt="" className="absolute inset-0 w-full h-full object-cover" style={position ? { objectPosition: position } : undefined} />}
      />
    </div>
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'rgb(var(--tj-read-bg-rgb) / 0.78)' }} />
    <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '16px 18px' }}>
      <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.gold, marginBottom: 6 }}>
        Coming soon
      </div>
      <div style={{ fontFamily: F.display, fontSize: 24, lineHeight: 1.06, color: 'var(--tj-read-cream)' }}>
        {title}
      </div>
      <div style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 13, lineHeight: 1.4, color: 'var(--tj-read-taupe)', marginTop: 6, maxWidth: '58%' }}>
        {dek}
      </div>
    </div>
  </div>
);

// ── Responsive rule for the two-column room collapse, scoped to this page
// so it never fights the identically-named rule ReadIndex injects for /read.
// The saturate rule is the homepage's own photo treatment ([&_img]:saturate-
// [.85]), reapplied inline-style-fashion since these frames are built as
// plain style objects rather than Tailwind classes. ────────────────────────
const LESSONS_RESPONSIVE_STYLE = `
  @media (max-width: 900px) {
    .tj-craft-room { grid-template-columns: minmax(0,1fr) !important; gap: 48px !important; }
    .tj-craft-rail { position: static !important; order: -1; }
  }
  .tj-craft-photo img { filter: saturate(0.85); }
`;

// ── Main component ───────────────────────────────────────────────────────
const LessonsIndex: React.FC = () => {
  useImmersiveChrome(ACCENTS[0]);

  const isOwner = useIsReadOwner();
  // A Read story published or taken down from its own page counts here too,
  // once this browser has read those states (see useKnownReadOverrides).
  const states = useKnownReadOverrides();
  const groups = useMemo(() => buildLessonGroups(), []);

  const itemsByKey = useMemo(() => {
    const map = new Map<string, LessonItem>();
    for (const group of groups) for (const item of group.items) map.set(item.key, item);
    return map;
  }, [groups]);
  const itemsByHref = useMemo(() => {
    const map = new Map<string, LessonItem>();
    for (const group of groups) for (const item of group.items) if (item.href) map.set(item.href, item);
    return map;
  }, [groups]);

  // Nothing on this page is numbered: the count of live rows is only used
  // for the "six pieces" line.
  const liveCount = useMemo(() => {
    let n = 0;
    for (const group of groups) for (const item of group.items) if (lessonEffectiveState(item, states) === 'live') n += 1;
    return n;
  }, [groups, states]);
  const soonCount = useMemo(() => {
    let n = 0;
    for (const group of groups) for (const item of group.items) if (lessonEffectiveState(item, states) === 'soon') n += 1;
    return n;
  }, [groups, states]);
  const visibleCount = useMemo(
    () => groups.reduce((acc, g) => acc + g.items.filter((it) => lessonItemVisible(it, isOwner, states)).length, 0),
    [groups, isOwner, states],
  );

  const piecesLabel = `${numberWord(liveCount)} ${liveCount === 1 ? 'piece' : 'pieces'}`;
  const eyebrowLabel = soonCount > 0 ? `${piecesLabel} · ${numberWord(soonCount)} coming` : piecesLabel;

  // The rail shows only covers the viewer can open (a soon or draft row
  // never earns a photographed cover), lead first, in the order COVERS
  // prefers, so the owner's rail and a visitor's rail both lead with
  // something that exists for them.
  const canSee = (href: string) => {
    const item = itemsByHref.get(href);
    return !!item && lessonItemVisible(item, isOwner, states) && lessonEffectiveState(item, states) === 'live';
  };
  const railCovers = COVERS.filter((cover) => canSee(cover.to));

  const rootRef = useReveals([isOwner]);
  const progress = useReadingProgress();

  return (
    <StoryEditProvider slug="craft">
    <ImmersiveRoot rootRef={rootRef}>
      <Helmet>
        <title>Lessons · Teajia</title>
        <meta name="description" content="Lessons for your tea practice: where to begin, brewing and tasting step by step, and books and voices to go further." />
      </Helmet>

      <style>{LESSONS_RESPONSIVE_STYLE}</style>

      {/* NAV: same chrome as the Read index, no back arrow, no owner toggle */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '13px clamp(18px,4vw,44px)', background: 'rgb(var(--tj-read-bg-rgb) / 0.72)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', borderBottom: '1px solid rgb(var(--tj-read-gold-rgb) / 0.12)' }}>
        <span style={{ fontFamily: F.display, fontWeight: 600, fontSize: 18, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.ink }}>Teajia</span>
        <span style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dim, whiteSpace: 'nowrap' }}>Read · Lessons</span>
        <ProgressTrack progress={progress} />
      </nav>

      <article style={{ position: 'relative', zIndex: 1 }}>

        <ReadShelves here="lessons" />

        {/* MASTHEAD */}
        <header style={{ position: 'relative', maxWidth: 1240, margin: '0 auto', padding: 'clamp(54px,9vw,118px) clamp(24px,5vw,56px) clamp(34px,5vw,56px)', overflow: 'hidden' }}>
          <div aria-hidden="true" style={{ position: 'absolute', top: '-12%', right: '-2%', fontFamily: F.cn, fontWeight: 200, fontSize: 'min(46vw,440px)', lineHeight: 1, color: 'rgb(var(--tj-read-gold-rgb) / 0.05)', pointerEvents: 'none', userSelect: 'none' }}>茶</div>
          <div style={{ position: 'relative', maxWidth: 760 }}>
            <div style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: '0.42em', textTransform: 'uppercase', color: C.gold, marginBottom: 26 }}>
              Lessons · {eyebrowLabel.toLowerCase()}
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
              <LessonGroupBlock key={group.label} group={group} isOwner={isOwner} states={states} />
            ))}
            {!isOwner && visibleCount === 0 && (
              <p style={{ fontFamily: F.display, fontStyle: 'italic', fontSize: 18, lineHeight: 1.55, color: C.dim, margin: '38px 2px 0', maxWidth: 460 }}>
                The lessons are being set up. Come back soon, the kettle is on.
              </p>
            )}
          </section>

          {/* RIGHT: COVER RAIL (sticky) */}
          <aside className="tj-craft-rail" style={{ position: 'sticky', top: 88, display: railCovers.length > 0 ? 'block' : 'none' }}>
            <div style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.26em', textTransform: 'uppercase', color: C.dim, marginBottom: 18 }}>
              Start here
            </div>

            {railCovers[0] && <LeadCover cover={railCovers[0]} />}

            {railCovers.length > 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
                {railCovers.slice(1, 3).map((cover) => (
                  <SecondaryCover
                    key={cover.to}
                    to={cover.to}
                    kicker={cover.kicker}
                    title={cover.title}
                    slot={cover.slot}
                    placeholder={cover.placeholder}
                  />
                ))}
              </div>
            )}

            {/* COMING SOON: an image of what will be built, then "coming
                soon", never a link. */}
            <div style={{ marginTop: 28 }}>
              <div style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.26em', textTransform: 'uppercase', color: C.dim, marginBottom: 14 }}>
                Coming soon
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {SOON_PANELS.map((panel) => {
                  const item = itemsByKey.get(panel.key);
                  return (
                    <ComingSoonPanel
                      key={panel.key}
                      slot={panel.slot}
                      placeholder={panel.placeholder}
                      position={panel.position}
                      title={item?.title ?? panel.title}
                      dek={item?.dek ?? panel.dek}
                    />
                  );
                })}
              </div>
            </div>

            <p style={{ fontFamily: F.display, fontStyle: 'italic', fontSize: 16, lineHeight: 1.5, color: C.dim, margin: '22px 2px 0' }}>
              New pieces are set in type as they are finished. The contents hold them all.
            </p>
          </aside>
        </div>

        {/* Footer is rendered globally by App.tsx for all browse pages, no
            page-local footer here, or it double-renders. */}

      </article>
    </ImmersiveRoot>
    <StoryEditorBar />
    </StoryEditProvider>
  );
};

export default LessonsIndex;
