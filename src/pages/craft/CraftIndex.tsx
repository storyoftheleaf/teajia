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
 * Every row answers to `craftLive.ts`, Craft's own state map, because
 * Adrian's rule (2026-09-22) is that a visitor sees only what he wrote or
 * has promised: the six finished pieces as links, seven more as a photograph
 * and a title with no way in, the rest (his own workshop) not at all. Flip a
 * key in that map and the row moves between the three in one edit.
 *
 * Row numbering (N°01…) is NOT baked into the data: it is computed at render
 * time over the LIVE rows only, in document order, so the count in the
 * masthead, the count in the Contents header, and every row's own N° can
 * never disagree.
 *
 * Photos: the page carries its own inline-edit slots through
 * StoryEditProvider slug="craft", the same mechanism HomeV2Page uses for its
 * table photograph, so Adrian can drop a real photograph into any cover or
 * any "coming soon" panel and publish it, no code change required.
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
import { StoryEditProvider } from '../read/storyEdit';
import EditablePhoto from '../read/EditablePhoto';
import StoryEditorBar from '../read/StoryEditorBar';
import { CRAFT_STATE, type CraftState } from './craftLive';

// ── Gate. A row's state comes from craftLive.ts, keyed by the row's own
// `key` (not its href, since a "soon" row may have no href at all). A
// /read/* row additionally has to clear Read's own gate, `isArticleVisible`,
// so Craft can never send a visitor to an article Read itself would refuse
// to show them: a row named `live` there but not actually published in Read
// reads here as `draft`, honestly, for owner and visitor alike. A key
// missing from CRAFT_STATE reads as `draft`, the same fail-closed default as
// articleLive.ts, so a new row cannot go public by being forgotten. ────────
function isCraftReadHref(href?: string): boolean {
  return !!href && href.startsWith('/read/');
}
function craftReadGatePasses(item: CraftItem): boolean {
  if (!isCraftReadHref(item.href)) return true;
  return isArticleVisible(item.href as string, false);
}
function craftEffectiveState(item: CraftItem): CraftState {
  const state = CRAFT_STATE[item.key] ?? 'draft';
  if (state === 'live' && !craftReadGatePasses(item)) return 'draft';
  return state;
}
function craftItemVisible(item: CraftItem, isOwner: boolean): boolean {
  return isOwner || craftEffectiveState(item) !== 'draft';
}

// ── Data ──────────────────────────────────────────────────────────────────
type CraftItem = { key: string; rubric: string; title: string; dek: string; href?: string };
type CraftGroup = { label: string; note: string; items: CraftItem[] };

function buildCraftGroups(): CraftGroup[] {
  const glossaryCount = GLOSSARY_TERMS.length;
  const today = termOfTheDay();
  return [
    {
      label: 'Brew',
      note: 'the kettle, the leaf, the vessel',
      items: [
        { key: 'ritual', rubric: 'ritual', title: 'Seven Steeps', dek: 'The same leaves, brewed seven ways, scroll to pour.', href: '/read/ritual' },
        { key: 'field-study', rubric: 'water', title: 'Water Before Leaf', dek: 'A field study. What the water brings before the tea does.', href: '/read/field-study' },
        { key: 'porcelain', rubric: 'teaware', title: 'Porcelain and Tea', dek: 'The renewal of a material, and what it does to the cup.', href: '/read/porcelain-and-tea' },
        { key: 'pot', rubric: 'teaware', title: 'The Pot That Remembers', dek: 'Yixing clay, seasoning, and one tea per pot.', href: '/read/craft' },
        { key: 'brew-by-type', rubric: 'guides', title: 'Brewing by Tea Type', dek: "Green, white, oolong, black, pu'er, yellow. Leaf, water, time." },
      ],
    },
    {
      label: 'Taste',
      note: 'the palate, shaped',
      items: [
        { key: 'tasting', rubric: 'tasting', title: 'The Vocabulary of Taste', dek: 'A turning flavour wheel and a tasting radar.', href: '/read/tasting' },
        { key: 'journeys', rubric: 'guided', title: 'Three Journeys', dek: 'Guided tastings, step by step, to shape your palate.', href: '/craft?v=journeys' },
        { key: 'discover', rubric: 'tool', title: 'Discover Your Tea', dek: 'A few quiet questions, and where to begin.', href: '/discover' },
      ],
    },
    {
      label: 'Know',
      note: 'the reference',
      items: [
        { key: 'reference', rubric: 'reference', title: 'The Tea Reference', dek: 'Cultivars, regions, producers, styles, marks and named teas.', href: '/wisdom' },
        { key: 'glossary', rubric: `${glossaryCount} terms`, title: 'The Glossary', dek: `${glossaryCount} terms. Today: ${today.term}.`, href: '/craft?v=glossary' },
        { key: 'foundations', rubric: 'lessons', title: 'Six Foundations', dek: 'Leaf, water, origin, ceremony, vessel, culture. Short reads.', href: '/craft?v=course' },
        { key: 'reading', rubric: 'list', title: 'Reading and Listening', dek: 'Books and voices worth your evenings.', href: '/craft?v=reading' },
      ],
    },
    {
      label: 'Room',
      note: 'the place you sit',
      items: [
        { key: 'spaces', rubric: 'spaces', title: 'Six Tea Spaces', dek: 'A corner, a shelf, a table. What each needs.', href: '/craft?v=spaces' },
        { key: 'shared-wisdom', rubric: 'voices', title: 'Shared Wisdom', dek: 'Reflections, tips and rituals from people at the table.', href: '/craft?v=wisdom' },
        { key: 'playlists', rubric: 'listening', title: 'Playlists', dek: 'Music for tea time, an hour at a time.' },
      ],
    },
  ];
}

// Every key the contents actually carries, read once at module load so
// craftLive.ts's map can be checked against the real rows rather than a
// second, hand-typed list. Exported for CraftIndex.test.tsx.
const CRAFT_GROUPS_SEED = buildCraftGroups();
export const CRAFT_ROW_KEYS: string[] = CRAFT_GROUPS_SEED.flatMap((g) => g.items.map((it) => it.key));

// ── Index row. Three states, three renderings: `live` is a real link,
// `draft` is unchanged (owner-only, dimmed, tagged), `soon` shows a title
// and a dek with no way in for a visitor, and, for the owner, a real link
// when one exists so he can reach the construction he is building. ────────
const CraftRow: React.FC<{ item: CraftItem; n: string; state: CraftState; isOwner: boolean }> = ({ item, n, state, isOwner }) => {
  const [hovered, setHovered] = useState(false);
  const isSoon = state === 'soon';
  const isDraft = state === 'draft';
  const asLink = isSoon ? (isOwner && !!item.href) : !!item.href;
  const hoverable = asLink && !isSoon;
  const numberLabel = isSoon ? 'soon' : n;
  const rubricLabel = isSoon ? 'coming soon' : item.rubric;

  const rowStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '48px 1fr auto',
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
      <span style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: '0.06em', color: isSoon ? C.dim : (hoverable && hovered ? C.goldLt : C.gold), paddingTop: 5, transition: 'color 240ms' }}>
        {numberLabel}
      </span>
      <span>
        <span style={{ display: 'block', fontFamily: F.display, fontSize: 'clamp(22px,2.4vw,27px)', lineHeight: 1.08, color: hoverable && hovered ? 'var(--tj-read-hover-ink)' : 'var(--tj-read-ink)', transition: 'color 240ms' }}>
          {item.title}
        </span>
        <span style={{ display: 'block', fontFamily: F.body, fontStyle: 'italic', fontSize: 13, lineHeight: 1.45, color: C.dim, marginTop: 4 }}>
          {item.dek}
        </span>
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, paddingTop: 6 }}>
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
        onMouseOver={() => hoverable && setHovered(true)}
        onMouseOut={() => hoverable && setHovered(false)}
      >
        {inner}
      </Link>
    );
  }
  return (
    <div style={rowStyle} aria-label={isSoon ? `${item.title}, coming soon` : undefined}>
      {inner}
    </div>
  );
};

// ── Group block. Renders nothing when no row in it is visible to the
// current audience (the same "a group with no visible rows renders nothing"
// rule Read's GroupBlock follows). ──────────────────────────────────────────
const CraftGroupBlock: React.FC<{ group: CraftGroup; isOwner: boolean; numberByKey: Map<string, string> }> = ({ group, isOwner, numberByKey }) => {
  const visible = group.items.filter((it) => craftItemVisible(it, isOwner));
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
          key={item.key}
          item={item}
          n={numberByKey.get(item.key) ?? ''}
          state={craftEffectiveState(item)}
          isOwner={isOwner}
        />
      ))}
    </div>
  );
};

// ── Lead cover: the first live row in the rail's order of preference.
// Photographed slots exist for three of the four: Discover, Seven Steeps
// (ritual) and the Tea Reference. The Glossary, once the only piece Adrian
// had written and so the long-standing lead, drops to a text-only fallback
// now that three photographed pieces lead ahead of it; it still reclaims the
// rail the day any of the three ahead of it stops being live. ─────────────
type CoverSpec = { to: string; kicker: string; title: React.ReactNode; line: string; slot?: string; placeholder?: string };

/** Same photograph HomeV2Page's opener uses for the table shot. Copied here
 *  (not imported across pages/) so Seven Steeps' cover carries a real
 *  photograph rather than a stock stand-in. */
const RITUAL_COVER_PHOTO = '/api/media/site/2021-06-27_IMG_7745_Original_ehkz30.jpg';

const COVERS: CoverSpec[] = [
  { to: '/discover', kicker: 'Tool', title: <>Discover <span style={{ fontStyle: 'italic', color: C.gold }}>your tea</span></>, line: 'A few quiet questions, and a first tea to brew tonight.', slot: 'cover-discover', placeholder: '/home/standin-tea.webp' },
  { to: '/read/ritual', kicker: 'Ritual', title: <>Seven <span style={{ fontStyle: 'italic', color: C.gold }}>Steeps</span></>, line: 'The same leaves, brewed seven ways.', slot: 'cover-ritual', placeholder: RITUAL_COVER_PHOTO },
  { to: '/wisdom', kicker: 'Reference', title: <>The Tea <span style={{ fontStyle: 'italic', color: C.gold }}>Reference</span></>, line: 'Cultivars, regions, producers, styles, marks and named teas.', slot: 'cover-reference', placeholder: '/home/standin-piece.webp' },
  { to: '/craft?v=glossary', kicker: 'Terms', title: <>The <span style={{ fontStyle: 'italic', color: C.gold }}>Glossary</span></>, line: 'The language of tea, one word at a time. Start with today’s.' },
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
// doesn't link in, so people don't get into the construction side." Three
// panels, one photograph, one ghost sketch of the surface being built, one
// line of real type. Never a link. ──────────────────────────────────────
type GhostKind = 'playlists' | 'brew' | 'journeys';
type SoonPanelSpec = { key: string; slot: string; placeholder: string; title: string; dek: string; ghost: GhostKind };

const SOON_PANELS: SoonPanelSpec[] = [
  { key: 'playlists', slot: 'soon-playlists', placeholder: '/home/standin-consult.webp', title: 'Playlists', dek: 'Music for tea time, an hour at a time.', ghost: 'playlists' },
  { key: 'brew-by-type', slot: 'soon-brew', placeholder: '/home/standin-tea.webp', title: 'Brewing by Tea Type', dek: "Green, white, oolong, black, pu'er, yellow.", ghost: 'brew' },
  { key: 'journeys', slot: 'soon-journeys', placeholder: '/home/standin-piece.webp', title: 'Three Journeys', dek: 'Guided tastings, step by step, to shape your palate.', ghost: 'journeys' },
];

const GHOST_LINE = 'rgb(var(--tj-read-gold-rgb) / 0.22)';

const GhostTemplate: React.FC<{ kind: GhostKind }> = ({ kind }) => {
  if (kind === 'playlists') {
    return (
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, padding: '16px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 9 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${GHOST_LINE}`, paddingBottom: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', border: `1px solid ${GHOST_LINE}` }} />
            <span style={{ width: 26, height: 2, background: GHOST_LINE }} />
          </div>
        ))}
      </div>
    );
  }
  if (kind === 'brew') {
    return (
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, padding: '16px 18px', display: 'grid', gridTemplateRows: 'auto 1fr 1fr', gap: 9 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
          {[0, 1, 2].map((i) => <span key={i} style={{ height: 2, width: '55%', background: GHOST_LINE }} />)}
        </div>
        {[0, 1].map((r) => (
          <div key={r} style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, borderTop: `1px solid ${GHOST_LINE}`, paddingTop: 7 }}>
            {[0, 1, 2].map((c) => <span key={c} style={{ height: 2, width: '38%', background: GHOST_LINE }} />)}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, padding: '16px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 13 }}>
      {[0.7, 0.55, 0.4].map((w, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 9, height: 9, border: `1px solid ${GHOST_LINE}` }} />
          <span style={{ height: 2, width: `${w * 100}%`, background: GHOST_LINE }} />
        </div>
      ))}
    </div>
  );
};

const ComingSoonPanel: React.FC<Omit<SoonPanelSpec, 'key'>> = ({ slot, placeholder, title, dek, ghost }) => (
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
        placeholder={<img src={placeholder} alt="" className="absolute inset-0 w-full h-full object-cover" />}
      />
    </div>
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'rgb(var(--tj-read-bg-rgb) / 0.78)' }} />
    <GhostTemplate kind={ghost} />
    <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '16px 18px' }}>
      <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.gold, marginBottom: 6 }}>
        Coming soon
      </div>
      <div style={{ fontFamily: F.display, fontSize: 24, lineHeight: 1.06, color: 'var(--tj-read-cream)' }}>
        {title}
      </div>
      <div style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 13, lineHeight: 1.4, color: 'var(--tj-read-taupe)', marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
const CRAFT_ROOM_RESPONSIVE_STYLE = `
  @media (max-width: 900px) {
    .tj-craft-room { grid-template-columns: 1fr !important; gap: 48px !important; }
    .tj-craft-rail { position: static !important; order: -1; }
  }
  .tj-craft-photo img { filter: saturate(0.85); }
`;

// ── Main component ───────────────────────────────────────────────────────
const CraftIndex: React.FC = () => {
  useImmersiveChrome(ACCENTS[0]);

  const isOwner = useIsReadOwner();
  const groups = useMemo(() => buildCraftGroups(), []);

  const itemsByKey = useMemo(() => {
    const map = new Map<string, CraftItem>();
    for (const group of groups) for (const item of group.items) map.set(item.key, item);
    return map;
  }, [groups]);
  const itemsByHref = useMemo(() => {
    const map = new Map<string, CraftItem>();
    for (const group of groups) for (const item of group.items) if (item.href) map.set(item.href, item);
    return map;
  }, [groups]);

  // Every LIVE row, in document order, numbered continuously across groups.
  // "soon" and "draft" rows carry no number: this is what the eyebrow's
  // piece count, the Contents header count, and every row's own N° all read
  // from, so none of the three can ever disagree.
  const numberByKey = useMemo(() => {
    const map = new Map<string, string>();
    let i = 0;
    for (const group of groups) {
      for (const item of group.items) {
        if (craftEffectiveState(item) !== 'live') continue;
        i += 1;
        map.set(item.key, `N°${String(i).padStart(2, '0')}`);
      }
    }
    return map;
  }, [groups]);

  const liveCount = numberByKey.size;
  const soonCount = useMemo(() => {
    let n = 0;
    for (const group of groups) for (const item of group.items) if (craftEffectiveState(item) === 'soon') n += 1;
    return n;
  }, [groups]);
  const visibleCount = useMemo(
    () => groups.reduce((acc, g) => acc + g.items.filter((it) => craftItemVisible(it, isOwner)).length, 0),
    [groups, isOwner],
  );

  const piecesLabel = `${numberWord(liveCount)} ${liveCount === 1 ? 'piece' : 'pieces'}`;
  const eyebrowLabel = soonCount > 0 ? `${piecesLabel} · ${numberWord(soonCount)} coming` : piecesLabel;

  // The rail shows only covers the viewer can open (a soon or draft row
  // never earns a photographed cover), lead first, in the order COVERS
  // prefers, so the owner's rail and a visitor's rail both lead with
  // something that exists for them.
  const canSee = (href: string) => {
    const item = itemsByHref.get(href);
    return !!item && craftItemVisible(item, isOwner) && craftEffectiveState(item) === 'live';
  };
  const railCovers = COVERS.filter((cover) => canSee(cover.to));
  const numberForHref = (href: string) => {
    const item = itemsByHref.get(href);
    return item ? numberByKey.get(item.key) ?? '' : '';
  };

  const rootRef = useReveals([isOwner]);
  const progress = useReadingProgress();

  return (
    <StoryEditProvider slug="craft">
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
              <CraftGroupBlock key={group.label} group={group} isOwner={isOwner} numberByKey={numberByKey} />
            ))}
            {!isOwner && visibleCount === 0 && (
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

            {railCovers[0] && <LeadCover cover={railCovers[0]} n={numberForHref(railCovers[0].to)} />}

            {railCovers.length > 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
                {railCovers.slice(1, 3).map((cover) => (
                  <SecondaryCover
                    key={cover.to}
                    to={cover.to}
                    kicker={`${cover.kicker} · ${numberForHref(cover.to)}`}
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
                      ghost={panel.ghost}
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

export default CraftIndex;
