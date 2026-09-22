/**
 * Advise: The Spaces to Share.
 *
 * Built in the exact frame `ReadIndex.tsx` and `CraftIndex.tsx` established
 * (ImmersiveRoot, the masthead, the two-column contents + sticky cover rail,
 * the same reveal and owner-draft behaviour), rather than a second design
 * invented from scratch. What differs is content: Advise is Adrian's
 * consulting page, three services (design, sourcing, sessions) each with a
 * short sub-ledger of what sits under it, every row either a real link or a
 * button that opens the inquiry form with the interest already ticked. There
 * is no article-publish gate here (nothing links into /read/*), and no
 * numbering: this page never had a Contents count, so it doesn't invent one.
 *
 * Every row answers to `adviseLive.ts`, this page's own state map, the same
 * three-state contract Craft's rows carry: `live` is a real link or a real
 * button, `soon` is a title and a short line with no way in for a visitor
 * (the owner still reaches it, because the row's own href doubles as the
 * owner's destination once the gate for a visitor turns it off), and `draft`
 * is the owner's own workshop, never shown to a visitor at all.
 *
 * The verb in the right-hand corner of each row ("open" / "ask" / "coming
 * soon") is drawn by CSS, `content: attr(data-act)`, not written as page
 * text: the row carries only `data-act`, and a `soon` row's own stylesheet
 * rule overrides that content to "coming soon" purely visually. The one
 * place the words "coming soon" actually land in the markup is the `soon`
 * row's own `aria-label`, so a screen reader hears it once, not twice, and a
 * visitor's page carries the phrase exactly as many times as it has soon
 * rows, not double that.
 *
 * Photos: the page carries its own inline-edit slots through
 * StoryEditProvider slug="advise", the same mechanism Craft and the Home
 * table photograph use, so Adrian can drop a real photograph into the
 * conversation cover, the two service covers, or either coming-soon panel
 * and publish it, no code change required. Nothing here carries a
 * placeholder image: an empty slot is the bare gradient plate, no ticks, no
 * label, until a real photograph is dropped in.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  C, F, ImmersiveRoot, useImmersiveChrome, useReveals, useReadingProgress,
  ProgressTrack, ACCENTS,
} from '../read/immersive';
import { useIsReadOwner } from '../read/publishGate';
import { StoryEditProvider } from '../read/storyEdit';
import EditablePhoto from '../read/EditablePhoto';
import StoryEditorBar from '../read/StoryEditorBar';
import { InquiryForm } from '../../components/advise/InquiryForm';
import { adviseTestimonials } from '../../data/adviseTestimonials';
import { ADVISE_STATE, type AdviseState } from './adviseLive';

// ── Data ──────────────────────────────────────────────────────────────────
type AdviseSubRowData = {
  key: string;
  title: string;
  dek: string;
  verb: 'open' | 'ask';
  /** Real navigation target when live-linked, or the owner-reachable
   *  destination when this row is `soon` (a visitor never follows it, the
   *  soon gate below decides that regardless of whether it is present). */
  href?: string;
  /** Preselect this row opens the inquiry form with, when it has no href. */
  ask?: string;
};
type AdviseService = {
  rubric: string;
  title: string;
  dek: string;
  /** Preselect the block's own title opens the form with. */
  ask: string;
  quiet?: boolean;
  rows: AdviseSubRowData[];
};

function buildAdviseServices(): AdviseService[] {
  return [
    {
      rubric: 'Design',
      title: 'Tea House Design & Curation',
      dek: 'From concept through opening. Design, curation, tea selection, training, and operations.',
      ask: 'Space design or tea integration',
      rows: [
        { key: 'for-your-space', title: 'For Your Space', dek: 'Hotels, studios, and teams.', verb: 'open', href: '/for-your-space' },
        { key: 'projects', title: 'Selected Projects', dek: 'Intaaya Resort, a private tea room, an office.', verb: 'open', href: '/advise?v=projects' },
      ],
    },
    {
      rubric: 'Sourcing',
      title: 'Tea Curation & Sourcing',
      dek: 'Direct sourcing from Taiwan, China, and trusted origins, for collectors, spaces, and communities.',
      ask: 'Tea sourcing',
      rows: [
        { key: 'sourcing-collection', title: 'For a Collection', dek: 'Rare and aged teas, found for you.', verb: 'ask', ask: 'Tea sourcing' },
        { key: 'sourcing-space', title: 'For a Space', dek: 'A menu sourced and kept in stock.', verb: 'ask', ask: 'Tea sourcing' },
        { key: 'journeys', title: 'Sourcing Journeys', dek: 'Taiwan, Yunnan, Fujian. Travel to origin.', verb: 'ask', href: '/advise?v=projects' },
      ],
    },
    {
      rubric: 'Sessions',
      title: 'Sessions & Guidance',
      dek: 'In the Bali studio or wherever you are.',
      ask: 'A session or practice guidance',
      quiet: true,
      rows: [
        { key: 'open-sit', title: 'Open Sit', dek: 'Share tea at the studio. Event based or appointment.', verb: 'ask', ask: 'A session or practice guidance' },
        { key: 'practice-setup', title: 'Guided Practice Setup', dek: 'Two hours and more. Leave fully equipped.', verb: 'ask', ask: 'A session or practice guidance' },
        { key: 'group-ceremonial', title: 'Group Ceremonial', dek: 'Up to twenty-four across two tearooms.', verb: 'ask', ask: 'An event or group experience' },
        { key: 'private-events', title: 'Private & Events', dek: 'Your gathering, your venue or ours.', verb: 'ask', ask: 'An event or group experience' },
        { key: 'sessions', title: 'Upcoming Sessions', dek: 'Dates at the table, as they are set.', verb: 'open', href: '/events' },
      ],
    },
  ];
}

// Every key the ledger actually carries, read once at module load so
// adviseLive.ts's map can be checked against the real rows rather than a
// second, hand-typed list. Exported for AdviseIndex.test.tsx.
const ADVISE_SERVICES_SEED = buildAdviseServices();
export const ADVISE_ROW_KEYS: string[] = ADVISE_SERVICES_SEED.flatMap((s) => s.rows.map((r) => r.key));

// ── Sub-ledger row. Three states: `live` is a real link or a real button
// that opens the inquiry form with its interest already ticked; `soon` is a
// title and a short line with no way in for a visitor, and, for the owner, a
// real link when the row carries one; `draft` is the owner's own workshop,
// filtered out for a visitor entirely before this ever renders. ───────────
const AdviseSubRow: React.FC<{
  row: AdviseSubRowData;
  state: AdviseState;
  isOwner: boolean;
  onAsk: (preselect: string) => void;
}> = ({ row, state, isOwner, onAsk }) => {
  const isSoon = state === 'soon';
  const isDraft = state === 'draft';
  const opensLink = isSoon ? (isOwner && !!row.href) : !!row.href;
  const opensForm = !isSoon && !opensLink && !!row.ask;
  const hoverable = (opensLink || opensForm) && !isSoon;

  const classNames = ['tj-advise-row'];
  if (hoverable) classNames.push('tj-advise-hoverable');
  if (isSoon) classNames.push('tj-advise-soon');
  if (isDraft) classNames.push('tj-advise-draft');
  const className = classNames.join(' ');

  const content = (
    <>
      <span className="tj-advise-row-title">{row.title}</span>
      <span className="tj-advise-row-sd">{row.dek}</span>
      <span className="tj-advise-verb-wrap">
        <span className="tj-advise-verb" data-act={row.verb} />
        {isDraft && (
          <span style={{ fontFamily: F.mono, fontSize: 8.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.gold, border: '1px solid rgb(var(--tj-read-gold-rgb) / 0.4)', borderRadius: 2, padding: '1px 5px', whiteSpace: 'nowrap' }}>
            Draft
          </span>
        )}
      </span>
    </>
  );

  if (opensLink && row.href) {
    return <Link to={row.href} className={className}>{content}</Link>;
  }
  if (opensForm && row.ask) {
    return (
      <button type="button" className={className} onClick={() => onAsk(row.ask as string)}>
        {content}
      </button>
    );
  }
  return (
    <div className={className} aria-label={isSoon ? `${row.title}, coming soon` : undefined}>
      {content}
    </div>
  );
};

// ── Service block: rubric, the title (itself a button opening the form with
// the block's own preselect), the dek, then the sub-ledger. ────────────────
const AdviseServiceBlock: React.FC<{
  service: AdviseService;
  isOwner: boolean;
  onAsk: (preselect: string) => void;
}> = ({ service, isOwner, onAsk }) => {
  const visibleRows = service.rows.filter((r) => {
    const state = ADVISE_STATE[r.key] ?? 'draft';
    return isOwner || state !== 'draft';
  });
  if (visibleRows.length === 0) return null;
  return (
    <div className={service.quiet ? 'tj-advise-svc tj-advise-quiet' : 'tj-advise-svc'} style={{ marginTop: 38 }}>
      <div style={{ fontFamily: F.ui, fontSize: 9, fontWeight: 500, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dim, marginBottom: 10 }}>
        {service.rubric}
      </div>
      <button
        type="button"
        className="tj-advise-svc-title"
        onClick={() => onAsk(service.ask)}
        style={{
          display: 'block',
          textAlign: 'left',
          background: 'none',
          border: 'none',
          padding: 0,
          margin: 0,
          cursor: 'pointer',
          fontFamily: F.display,
          fontSize: service.quiet ? 'clamp(24px,2.6vw,30px)' : 'clamp(28px,3.2vw,38px)',
          lineHeight: 1.04,
          color: service.quiet ? 'var(--tj-read-warm)' : 'var(--tj-read-ink)',
        }}
      >
        {service.title}
      </button>
      <p style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 14, lineHeight: 1.55, color: 'var(--tj-read-taupe)', margin: '10px 0 0', maxWidth: 520 }}>
        {service.dek}
      </p>
      <div className="tj-advise-subs">
        {visibleRows.map((row) => (
          <AdviseSubRow key={row.key} row={row} state={ADVISE_STATE[row.key] ?? 'draft'} isOwner={isOwner} onAsk={onAsk} />
        ))}
      </div>
    </div>
  );
};

// ── Lead cover: "Start here". A button, not a link, since it opens the
// inquiry form rather than navigating. Its accessible name is fixed at
// "Start a conversation" via aria-label, matched exactly by
// tests/inquiry-delivery.spec.ts. ───────────────────────────────────────────
const AdviseLeadCover: React.FC<{ onOpen: () => void }> = ({ onOpen }) => (
  <button
    type="button"
    aria-label="Start a conversation"
    onClick={onOpen}
    className="tj-advise-frame"
    style={{
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      minHeight: 'clamp(320px,40vw,400px)',
      width: '100%',
      border: '1px solid rgb(var(--tj-read-gold-rgb) / 0.24)',
      overflow: 'hidden',
      textDecoration: 'none',
      color: 'inherit',
      background: 'linear-gradient(158deg,var(--tj-read-card-from) 0%,var(--tj-read-card-to) 56%,var(--tj-read-bg) 100%)',
      cursor: 'pointer',
      padding: 0,
      font: 'inherit',
      textAlign: 'left',
    }}
  >
    <div className="tj-advise-photo" style={{ position: 'absolute', inset: 0 }}>
      <EditablePhoto slot="cover-conversation" alt="" fill placeholderBg="var(--tj-read-bg)" />
    </div>
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 64% 56% at 60% 28%, rgb(var(--tj-read-gold-rgb) / 0.10), transparent 64%)' }} />
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, rgb(var(--tj-read-bg-rgb) / 0.92), transparent 52%)' }} />
    <div style={{ position: 'relative', padding: 'clamp(24px,3vw,32px)' }}>
      <div style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: '0.26em', textTransform: 'uppercase', color: C.gold, marginBottom: 14 }}>
        Start here
      </div>
      <div style={{ fontFamily: F.display, fontWeight: 400, fontSize: 'clamp(34px,4.4vw,46px)', lineHeight: 0.98, color: 'var(--tj-read-cream)' }}>
        Start a <span style={{ fontStyle: 'italic', color: C.gold }}>conversation</span>
      </div>
      <div style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 14, lineHeight: 1.5, color: 'var(--tj-read-taupe)', marginTop: 14, maxWidth: 330 }}>
        Every engagement begins with one. Tell me what you are hoping for.
      </div>
    </div>
  </button>
);

// ── Secondary cover, reused for the Design / Sourcing / Projects slots.
// Renders a Link when `to` is given (Projects, once live), a button opening
// the form otherwise. ───────────────────────────────────────────────────────
const AdviseSecondaryCover: React.FC<{
  kicker: string;
  title: React.ReactNode;
  slot: string;
  to?: string;
  onClick?: () => void;
}> = ({ kicker, title, slot, to, onClick }) => {
  const inner = (
    <>
      <div className="tj-advise-photo" style={{ position: 'absolute', inset: 0 }}>
        <EditablePhoto slot={slot} alt="" fill placeholderBg="var(--tj-read-bg)" />
      </div>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, rgb(var(--tj-read-bg-rgb) / 0.86), transparent 64%)' }} />
      <div style={{ position: 'relative', padding: '16px 18px' }}>
        <div style={{ fontFamily: F.mono, fontSize: 8.5, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.gold, marginBottom: 7 }}>
          {kicker}
        </div>
        <div style={{ fontFamily: F.display, fontSize: 25, lineHeight: 1, color: 'var(--tj-read-cream)' }}>
          {title}
        </div>
      </div>
    </>
  );
  const sharedStyle: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    minHeight: 150,
    width: '100%',
    border: '1px solid rgb(var(--tj-read-gold-rgb) / 0.18)',
    overflow: 'hidden',
    textDecoration: 'none',
    color: 'inherit',
    background: 'linear-gradient(150deg,var(--tj-read-card-from),var(--tj-read-card-to))',
    cursor: 'pointer',
    padding: 0,
    font: 'inherit',
    textAlign: 'left',
  };
  if (to) {
    return <Link to={to} className="tj-advise-frame" style={sharedStyle}>{inner}</Link>;
  }
  return (
    <button type="button" className="tj-advise-frame" style={sharedStyle} onClick={onClick}>
      {inner}
    </button>
  );
};

// ── Coming soon strip. Same device Craft uses: a photograph, a ghost sketch
// of the surface being built, one line of real type, never a link. ────────
type AdviseGhostKind = 'projects' | 'journeys';
const ADVISE_GHOST_LINE = 'rgb(var(--tj-read-gold-rgb) / 0.22)';

const AdviseGhostTemplate: React.FC<{ kind: AdviseGhostKind }> = ({ kind }) => {
  if (kind === 'projects') {
    return (
      <div aria-hidden="true" style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: '38%', padding: '16px 18px', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, alignContent: 'center' }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ aspectRatio: '4/5', border: `1px solid ${ADVISE_GHOST_LINE}` }} />
        ))}
      </div>
    );
  }
  return (
    <div aria-hidden="true" style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: '38%', padding: '16px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 13 }}>
      {[0.7, 0.55, 0.4].map((w, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 9, height: 9, border: `1px solid ${ADVISE_GHOST_LINE}` }} />
          <span style={{ height: 2, width: `${w * 100}%`, background: ADVISE_GHOST_LINE }} />
        </div>
      ))}
    </div>
  );
};

const AdviseComingSoonPanel: React.FC<{ slot: string; title: string; dek: string; ghost: AdviseGhostKind }> = ({ slot, title, dek, ghost }) => (
  <div style={{ position: 'relative', minHeight: 150, border: '1px solid rgb(var(--tj-read-gold-rgb) / 0.16)', overflow: 'hidden' }}>
    <div className="tj-advise-photo" style={{ position: 'absolute', inset: 0 }}>
      <EditablePhoto slot={slot} alt="" fill placeholderBg="var(--tj-read-bg)" />
    </div>
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'rgb(var(--tj-read-bg-rgb) / 0.78)' }} />
    <AdviseGhostTemplate kind={ghost} />
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

// ── Responsive rule for the two-column room collapse, and the ledger's own
// hover/verb mechanics. Scoped to this page so it never fights the
// identically-shaped rules ReadIndex and CraftIndex inject for their own
// pages. The verb text ("open" / "ask" / "coming soon") is CSS-generated
// content, never React text, so a visitor's markup carries the words
// "coming soon" exactly once per soon row (in that row's own aria-label),
// not twice. ─────────────────────────────────────────────────────────────
const ADVISE_ROOM_RESPONSIVE_STYLE = `
  @media (max-width: 900px) {
    .tj-advise-room { grid-template-columns: minmax(0,1fr) !important; gap: 48px !important; }
    .tj-advise-rail { position: static !important; order: -1; }
  }
  .tj-advise-photo img { filter: saturate(0.85); }

  .tj-advise-frame { transition: border-color 240ms; }
  .tj-advise-frame:hover { border-color: rgb(var(--tj-read-gold-rgb) / 0.5); }

  .tj-advise-svc-title { transition: color 240ms; }
  .tj-advise-svc-title:hover { color: var(--tj-read-hover-ink); }

  .tj-advise-subs { margin: 18px 0 0; padding: 0; border-top: 1px solid rgb(var(--tj-read-gold-rgb) / 0.10); }

  .tj-advise-row {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0,auto) minmax(0,1fr) auto;
    align-items: baseline;
    gap: 14px;
    padding: 11px 8px 11px 0;
    border-bottom: 1px solid rgb(var(--tj-read-gold-rgb) / 0.10);
    text-decoration: none;
    color: inherit;
    background: none;
    border-left: none;
    border-right: none;
    border-top: none;
    font: inherit;
    text-align: left;
    width: 100%;
    cursor: default;
  }
  .tj-advise-row.tj-advise-hoverable {
    cursor: pointer;
    transition: padding-left 260ms cubic-bezier(.22,1,.36,1);
  }
  .tj-advise-row.tj-advise-hoverable:hover { padding-left: 10px; }
  .tj-advise-row::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    bottom: -1px;
    width: 1px;
    background: var(--tj-gold, var(--tj-read-gold-default));
    transform: scaleY(0);
    transform-origin: top;
    transition: transform 260ms cubic-bezier(.22,1,.36,1);
  }
  .tj-advise-row.tj-advise-hoverable:hover::before { transform: scaleY(1); }
  .tj-advise-row-title {
    position: relative;
    font-family: var(--font-display);
    font-size: 19px;
    line-height: 1.1;
    color: var(--tj-read-warm);
    white-space: nowrap;
    background: linear-gradient(var(--tj-gold, var(--tj-read-gold-default)), var(--tj-gold, var(--tj-read-gold-default))) no-repeat left 100% / 0 1px;
    transition: color 240ms, background-size 320ms cubic-bezier(.22,1,.36,1);
    padding-bottom: 1px;
  }
  .tj-advise-row.tj-advise-hoverable:hover .tj-advise-row-title {
    color: var(--tj-read-hover-ink);
    background-size: 100% 1px;
  }
  .tj-advise-row-sd {
    font-family: var(--font-body);
    font-style: italic;
    font-size: 12.5px;
    line-height: 1.4;
    color: var(--tj-read-dim);
  }
  .tj-advise-verb-wrap { display: flex; align-items: center; gap: 6px; justify-self: end; }
  .tj-advise-verb {
    display: inline-flex;
    align-items: baseline;
    gap: 6px;
    font-family: var(--font-sans);
    font-size: 8.5px;
    font-weight: 500;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--tj-gold, var(--tj-read-gold-default));
    white-space: nowrap;
  }
  .tj-advise-verb::before { content: attr(data-act); }
  .tj-advise-verb::after {
    content: "→";
    font-family: var(--font-body);
    font-size: 12px;
    letter-spacing: 0;
    color: var(--tj-gold-lt, var(--tj-read-gold-lt-default));
    opacity: 0;
    transform: translateX(-6px);
    transition: opacity 240ms, transform 260ms cubic-bezier(.22,1,.36,1);
  }
  .tj-advise-row.tj-advise-hoverable:hover .tj-advise-verb::after {
    opacity: 1;
    transform: translateX(0);
  }

  .tj-advise-row.tj-advise-soon { opacity: 0.62; }
  .tj-advise-row.tj-advise-soon .tj-advise-row-title {
    color: var(--tj-read-dim);
    background-size: 0 1px !important;
  }
  .tj-advise-row.tj-advise-soon .tj-advise-verb { color: var(--tj-read-dim); }
  .tj-advise-row.tj-advise-soon .tj-advise-verb::before { content: "coming soon"; }
  .tj-advise-row.tj-advise-soon .tj-advise-verb::after { display: none; }

  .tj-advise-row.tj-advise-draft { opacity: 0.5; }

  .tj-advise-quiet .tj-advise-row-title { font-size: 17px; }

  @media (max-width: 520px) {
    .tj-advise-row { grid-template-columns: minmax(0,1fr) auto; row-gap: 2px; }
    .tj-advise-row-title { grid-row: 1; grid-column: 1; }
    .tj-advise-verb-wrap { grid-row: 1; grid-column: 2; }
    .tj-advise-row-sd { grid-row: 2; grid-column: 1 / -1; }
  }
`;

// ── Main component ───────────────────────────────────────────────────────
const AdviseIndex: React.FC = () => {
  useImmersiveChrome(ACCENTS[0]);

  const isOwner = useIsReadOwner();
  const services = useMemo(() => buildAdviseServices(), []);

  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [inquiryPreselect, setInquiryPreselect] = useState('');
  const openInquiry = useCallback((preselect: string) => {
    setInquiryPreselect(preselect);
    setInquiryOpen(true);
  }, []);

  const projectsLive = ADVISE_STATE.projects === 'live';
  const soonPanels = useMemo(() => {
    const panels: { key: string; slot: string; title: string; dek: string; ghost: AdviseGhostKind }[] = [];
    if (ADVISE_STATE.projects === 'soon') {
      panels.push({ key: 'projects', slot: 'soon-projects', title: 'Selected Projects', dek: 'Intaaya Resort, a private tea room, an office.', ghost: 'projects' });
    }
    if (ADVISE_STATE.journeys === 'soon') {
      panels.push({ key: 'journeys', slot: 'soon-journeys', title: 'Sourcing Journeys', dek: 'Taiwan, Yunnan, Fujian.', ghost: 'journeys' });
    }
    return panels;
  }, []);

  const testimonial = adviseTestimonials[0];

  const rootRef = useReveals([isOwner]);
  const progress = useReadingProgress();

  return (
    <StoryEditProvider slug="advise">
    <ImmersiveRoot rootRef={rootRef}>
      <Helmet>
        <title>Advise · Teajia</title>
        <meta name="description" content="Tea house design and curation, tea sourcing, and sessions in the Bali studio. Every engagement begins with a conversation." />
      </Helmet>

      <style>{ADVISE_ROOM_RESPONSIVE_STYLE}</style>

      {/* NAV: same chrome as the Read and Craft index, no back arrow, no
          owner toggle */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '13px clamp(18px,4vw,44px)', background: 'rgb(var(--tj-read-bg-rgb) / 0.72)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', borderBottom: '1px solid rgb(var(--tj-read-gold-rgb) / 0.12)' }}>
        <span style={{ fontFamily: F.display, fontWeight: 600, fontSize: 18, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.ink }}>Teajia</span>
        <span style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dim, whiteSpace: 'nowrap' }}>Advise · The Spaces to Share</span>
        <ProgressTrack progress={progress} />
      </nav>

      <article style={{ position: 'relative', zIndex: 1 }}>

        {/* MASTHEAD */}
        <header style={{ position: 'relative', maxWidth: 1240, margin: '0 auto', padding: 'clamp(54px,9vw,118px) clamp(24px,5vw,56px) clamp(34px,5vw,56px)', overflow: 'hidden' }}>
          <div aria-hidden="true" style={{ position: 'absolute', top: '-12%', right: '-2%', fontFamily: F.cn, fontWeight: 200, fontSize: 'min(46vw,440px)', lineHeight: 1, color: 'rgb(var(--tj-read-gold-rgb) / 0.05)', pointerEvents: 'none', userSelect: 'none' }}>茶</div>
          <div style={{ position: 'relative', maxWidth: 760 }}>
            <div style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: '0.42em', textTransform: 'uppercase', color: C.gold, marginBottom: 26 }}>
              A conversation · design, sourcing, guidance
            </div>
            <h1 style={{ fontFamily: F.display, fontWeight: 500, fontSize: 'clamp(54px,10vw,124px)', lineHeight: 0.92, letterSpacing: '0.01em', color: 'var(--tj-read-cream)', margin: 0 }}>
              The Spaces{' '}
              <span style={{ fontStyle: 'italic', color: C.gold, whiteSpace: 'nowrap' }}>to Share</span>
            </h1>
            <p style={{ fontFamily: F.display, fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(19px,2.4vw,27px)', lineHeight: 1.45, color: 'var(--tj-read-taupe)', margin: '26px 0 0', maxWidth: 540 }}>
              Twenty years in tea culture. Taiwan, China, Japan, Bali, and beyond.
            </p>
          </div>
        </header>

        {/* ROOM: two-column services ledger + cover rail */}
        <div
          className="tj-advise-room"
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
          {/* LEFT: SERVICES */}
          <section>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 8 }}>
              <span style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.26em', textTransform: 'uppercase', color: C.dim }}>Services</span>
              <span style={{ flex: 1, height: 1, background: 'rgb(var(--tj-read-gold-rgb) / 0.18)' }} />
              <span style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: '0.1em', color: C.dim }}>every engagement begins with a conversation</span>
            </div>

            {services.map((service) => (
              <AdviseServiceBlock key={service.title} service={service} isOwner={isOwner} onAsk={openInquiry} />
            ))}

            <div style={{ marginTop: 38, maxWidth: 520 }}>
              <div style={{ fontFamily: F.ui, fontSize: 9.5, fontWeight: 500, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim, marginBottom: 12 }}>
                The practice
              </div>
              <p style={{ fontFamily: F.body, fontSize: 14, lineHeight: 1.85, color: 'var(--tj-read-taupe)', margin: '0 0 14px' }}>
                We work with individuals deepening their personal tea practice, with collectors seeking rare and aged teas, and with retreat centers, hotels, and private residences ready to bring tea culture into their spaces. For larger projects, that means everything from room design and teaware curation to tea sourcing and staff training.
              </p>
              <p style={{ fontFamily: F.body, fontSize: 14, lineHeight: 1.85, color: 'var(--tj-read-taupe)', margin: 0 }}>
                A background in design and visual art shapes every detail. Two decades of sourcing relationships across Asia ground every recommendation. An international practice rooted in Bali.
              </p>
            </div>
          </section>

          {/* RIGHT: COVER RAIL (sticky) */}
          <aside className="tj-advise-rail" style={{ position: 'sticky', top: 88 }}>
            <div style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.26em', textTransform: 'uppercase', color: C.dim, marginBottom: 18 }}>
              Start here
            </div>

            <AdviseLeadCover onOpen={() => openInquiry('')} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
              <AdviseSecondaryCover
                kicker="Design"
                title={<>Tea House Design <span style={{ fontStyle: 'italic', color: C.gold }}>&amp; Curation</span></>}
                slot="cover-design"
                onClick={() => openInquiry('Space design or tea integration')}
              />
              <AdviseSecondaryCover
                kicker="Sourcing"
                title={<>Tea Curation <span style={{ fontStyle: 'italic', color: C.gold }}>&amp; Sourcing</span></>}
                slot="cover-sourcing"
                onClick={() => openInquiry('Tea sourcing')}
              />
              {projectsLive && (
                <AdviseSecondaryCover
                  kicker="Projects"
                  title={<>Selected <span style={{ fontStyle: 'italic', color: C.gold }}>Projects</span></>}
                  slot="cover-projects"
                  to="/advise?v=projects"
                />
              )}
            </div>

            {/* COMING SOON: an image of what will be built, then "coming
                soon", never a link. */}
            {soonPanels.length > 0 && (
              <div style={{ marginTop: 28 }}>
                <div style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.26em', textTransform: 'uppercase', color: C.dim, marginBottom: 14 }}>
                  Coming soon
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {soonPanels.map((panel) => (
                    <AdviseComingSoonPanel key={panel.key} slot={panel.slot} title={panel.title} dek={panel.dek} ghost={panel.ghost} />
                  ))}
                </div>
              </div>
            )}

            <p style={{ fontFamily: F.display, fontStyle: 'italic', fontSize: 17, lineHeight: 1.5, color: C.dim, margin: '24px 2px 0' }}>
              “{testimonial.quote}”
              <span style={{ display: 'block', fontFamily: F.ui, fontStyle: 'normal', fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.dim, marginTop: 8 }}>
                {testimonial.name} · {testimonial.title}
              </span>
            </p>
          </aside>
        </div>

        {/* Footer is rendered globally by App.tsx for all browse pages, no
            page-local footer here, or it double-renders. */}

      </article>
    </ImmersiveRoot>
    <InquiryForm isOpen={inquiryOpen} onClose={() => setInquiryOpen(false)} preselect={inquiryPreselect} />
    <StoryEditorBar />
    </StoryEditProvider>
  );
};

export default AdviseIndex;
