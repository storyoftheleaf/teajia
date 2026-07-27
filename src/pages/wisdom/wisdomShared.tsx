/**
 * Shared parts of the public tea reference (/wisdom).
 *
 * The reference reads the wisdom base and nothing else. It holds no copy of a
 * tea-type list, no local region table, and no prose of its own about a plant.
 * Everything here is either presentation or a read helper over `src/wisdom`.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Search } from 'lucide-react';
import {
  CULTIVARS,
  REGIONS,
  TEA_TYPES,
  findRegion,
  loadCultivarStory,
  normalizeTeaType,
  type CultivarStory,
  type Region,
  type TeaType,
} from '../../wisdom';
import { authorshipLine } from '../../wisdom/authorship';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';

/** The one address corrections arrive at. Governance is one editor with an inbox. */
export const WISDOM_INBOX = 'hello@teajia.com';

export const mailtoWisdom = (subject?: string): string =>
  `mailto:${WISDOM_INBOX}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`;

/** Reused class strings, so the two pages cannot drift apart. */
export const EYEBROW = `${TYPOGRAPHY_CLASSES.label} text-tea-text-dim`;
export const META = `${TYPOGRAPHY_CLASSES.label} text-tea-text-sec`;
export const QUIET_LINK =
  'text-tea-readgold underline underline-offset-4 decoration-tea-gold/40 hover:decoration-tea-gold transition-colors';

// ─── Section head ────────────────────────────────────────────────────────────

/** A marker, a hairline, a name. The one section device this reference uses. */
export const SectionHead: React.FC<{ glyph: string; label: string; count?: number }> = ({ glyph, label, count }) => (
  <div className="flex items-center gap-4 mb-6">
    <span className="font-display italic text-ui-20 text-tea-readgold leading-none">{glyph}</span>
    <span className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-sec whitespace-nowrap`}>{label}</span>
    <span aria-hidden className="flex-1 h-px bg-tea-border" />
    {count != null && <span className="font-mono text-ui-11 tabular-nums text-tea-text-dim">{count}</span>}
  </div>
);

// ─── Authorship ──────────────────────────────────────────────────────────────

/**
 * The rung this entry sits on, said plainly. Most of the corpus was AI-drafted
 * from research and published before a human read it line by line. That is
 * stated, not hidden and not apologised for.
 *
 * Pass an entity `id` on a detail page to report that entity's own rung via
 * `authorshipLine`. Omitted on an index page, where no single id applies and
 * the rung defaults to "drafted", true of nearly everything in the base today.
 */
export const AuthorshipNote: React.FC<{ id?: string | null; className?: string }> = ({ id = null, className = '' }) => (
  <p className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-dim leading-relaxed ${className}`}>
    {authorshipLine(id)} Corrections are applied by hand and credited.
  </p>
);

// ─── The invitation ──────────────────────────────────────────────────────────

/** Adrian's standard, stated as a direction rather than a claim. */
export const Invitation: React.FC<{ subject?: string }> = ({ subject }) => (
  <aside className="mt-16 pt-8 border-t border-tea-border">
    <p className={`${TYPOGRAPHY_CLASSES.subtitle} text-tea-text max-w-[52ch]`}>
      This is not everything. The goal is to be everything. If you know something that isn&rsquo;t here,{' '}
      <a href={mailtoWisdom(subject)} className={QUIET_LINK}>
        send it
      </a>
      .
    </p>
    <p className={`${EYEBROW} mt-4`}>One address, one editor, every correction credited in the entry</p>
  </aside>
);

// ─── Navigation ──────────────────────────────────────────────────────────────

/** The one back-link device every reference page uses, above the fold, top-left. */
export const BackLink: React.FC<{ to: string; label: string }> = ({ to, label }) => (
  <Link
    to={to}
    className="inline-flex items-center gap-2 min-h-[44px] text-tea-text-sec hover:text-tea-text transition-colors"
  >
    <ArrowLeft size={16} strokeWidth={1.5} aria-hidden />
    <span className={TYPOGRAPHY_CLASSES.label}>{label}</span>
  </Link>
);

/**
 * Every holding the reference covers, in the order the front door lists them.
 * The one place this list is written, so the sub-nav and the front door cannot
 * drift out of step with each other.
 */
export interface WisdomSection {
  id: string;
  label: string;
  path: string;
}

export const WISDOM_SECTIONS: WisdomSection[] = [
  { id: 'overview', label: 'Overview', path: '/wisdom' },
  { id: 'cultivars', label: 'Plants', path: '/wisdom/cultivars' },
  { id: 'producers', label: 'Producers', path: '/wisdom/producers' },
  { id: 'marks', label: 'Marks', path: '/wisdom/marks' },
  { id: 'styles', label: 'Styles', path: '/wisdom/styles' },
  { id: 'named', label: 'Named', path: '/wisdom/named' },
];

/**
 * The persistent way around. Every page in the reference carries this strip so
 * a reader can move between holdings without returning to the front door
 * first. Same tab treatment the admin Wisdom view uses (serif, gold when
 * active), so the public reference reads with the same density.
 */
export const WisdomSubNav: React.FC<{ active: WisdomSection['id'] }> = ({ active }) => (
  <nav
    aria-label="The wisdom base"
    className="flex flex-wrap items-baseline gap-x-6 gap-y-2 border-b border-tea-border pb-3 mb-8"
  >
    {WISDOM_SECTIONS.map(section => {
      const isActive = section.id === active;
      return (
        <Link
          key={section.id}
          to={section.path}
          aria-current={isActive ? 'page' : undefined}
          className={`min-h-[44px] inline-flex items-center font-display text-ui-16 tracking-[0.02em] transition-colors ${
            isActive ? 'text-tea-gold' : 'text-tea-text-sec hover:text-tea-text'
          }`}
        >
          {section.label}
        </Link>
      );
    })}
  </nav>
);

// ─── Finding a holding ───────────────────────────────────────────────────────

/** A real search field, restyled from the admin's SearchBox to the public palette. */
export const WisdomSearchBox: React.FC<{ value: string; onChange: (value: string) => void; placeholder: string }> = ({
  value,
  onChange,
  placeholder,
}) => (
  <div className="relative mt-6">
    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-tea-text-dim" aria-hidden />
    <input
      type="search"
      value={value}
      onChange={event => onChange(event.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className="w-full bg-tea-surface border border-tea-border rounded-md text-tea-text pl-9 pr-3 py-2.5 min-h-[44px] font-body text-ui-14 placeholder:text-tea-text-dim focus:outline-none focus:border-tea-gold/40"
    />
  </div>
);

/** How much of a holding a filter is showing, updated live. */
export const CountLine: React.FC<{ visible: number; total: number; noun: string }> = ({ visible, total, noun }) => (
  <p className={`${EYEBROW} mt-3 mb-1`}>
    {visible} of {total} {noun}
  </p>
);

// ─── One row of a holding ────────────────────────────────────────────────────

/**
 * The tight, two-axis row density the admin browsers use: serif name (plus a
 * Chinese name when recorded) on the lead line, a dim second fact beneath it,
 * and one fact right-aligned so the eye can track a second column down the
 * list. 52 to 64px tall, not the much taller card the reference used before.
 */
export const HoldingRow: React.FC<{
  to: string;
  name: string;
  chineseName?: string;
  meta?: string;
  aside?: string;
}> = ({ to, name, chineseName, meta, aside }) => (
  <li className="border-t border-tea-border first:border-t-0">
    <Link
      to={to}
      className="group flex items-center justify-between gap-3 py-3 min-h-[52px] hover:bg-tea-gold/6 transition-colors -mx-2 px-2 rounded-md"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-display text-ui-17 leading-snug text-tea-text group-hover:text-tea-gold-lt transition-colors truncate">
            {name}
          </span>
          {chineseName && <span className="font-display text-ui-13 text-tea-text-dim shrink-0">{chineseName}</span>}
        </div>
        {meta && <p className={`${EYEBROW} mt-0.5 truncate`}>{meta}</p>}
      </div>
      {aside && <span className={`${EYEBROW} shrink-0 text-right`}>{aside}</span>}
    </Link>
  </li>
);

/** A holding's id did not resolve. Same shape on every detail page in the reference. */
export const HoldingNotFound: React.FC<{
  heading: string;
  backTo: string;
  backLabel: string;
  subject: string;
}> = ({ heading, backTo, backLabel, subject }) => (
  <article className="w-full max-w-3xl mx-auto pt-10 pb-nav">
    <Helmet>
      <title>Not found · Teajia</title>
    </Helmet>
    <BackLink to={backTo} label={backLabel} />
    <h1 className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text mt-8`}>{heading}</h1>
    <p className={`${TYPOGRAPHY_CLASSES.body} text-tea-text-sec mt-4 max-w-[56ch]`}>
      Nothing in the reference answers to that name yet.{' '}
      <Link to={backTo} className={QUIET_LINK}>
        {backLabel}
      </Link>
      , or send the one you were looking for.
    </p>
    <Invitation subject={subject} />
  </article>
);

// ─── Facts ───────────────────────────────────────────────────────────────────

/** A labelled line. Used for every fact that is a phrase rather than a paragraph. */
export const Fact: React.FC<{ label: string; children?: React.ReactNode }> = ({ label, children }) => {
  if (!children) return null;
  return (
    <div className="py-3 border-t border-tea-border flex flex-wrap gap-x-8 gap-y-1 justify-between">
      <span className={`${EYEBROW} shrink-0`}>{label}</span>
      <span className={`${TYPOGRAPHY_CLASSES.bodyLight} text-tea-text max-w-[54ch] sm:text-right`}>{children}</span>
    </div>
  );
};

// ─── Skeleton ────────────────────────────────────────────────────────────────

export const ProseSkeleton: React.FC<{ lines?: number }> = ({ lines = 3 }) => (
  <div className="space-y-3" aria-hidden>
    {Array.from({ length: lines }).map((_, index) => (
      <div key={index} className="shimmer-warm h-3" style={{ width: `${92 - index * 11}%` }} />
    ))}
  </div>
);

// ─── Reading the wisdom base ─────────────────────────────────────────────────

/**
 * Loads the prose for one plant. The 128 KB corpus is code-split, so the header
 * and the lineage tree render from the lean index while this is still in flight.
 */
export function useCultivarStory(id: string | undefined): { story: CultivarStory | null; loading: boolean } {
  const [story, setStory] = useState<CultivarStory | null>(null);
  const [loading, setLoading] = useState(Boolean(id));

  useEffect(() => {
    if (!id) {
      setStory(null);
      setLoading(false);
      return;
    }
    let live = true;
    setLoading(true);
    loadCultivarStory(id).then(result => {
      if (!live) return;
      setStory(result);
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [id]);

  return { story, loading };
}

/**
 * Tea type is not a field on a cultivar, and correctly so: a plant is not a
 * type of tea, it is a plant several types get made from. It is read back out
 * of the named expressions in the story, which is why the type facet waits for
 * the corpus while the origin facet is instant.
 */
export function useCultivarTypes(): { byId: Map<string, TeaType[]> | null; loading: boolean } {
  const [byId, setById] = useState<Map<string, TeaType[]> | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all(CULTIVARS.map(async cultivar => [cultivar.id, teaTypesOf(await loadCultivarStory(cultivar.id))] as const))
      .then(entries => {
        if (live) setById(new Map(entries));
      })
      .catch(() => {
        if (live) setById(new Map());
      });
    return () => {
      live = false;
    };
  }, []);

  return { byId, loading: byId === null };
}

/**
 * Reads canonical tea types out of an expression family name such as
 * "Wuyi Rock Oolong (Yancha)" or "Japanese Black/Oolong".
 *
 * Rules, in order:
 *   1. Conjunctions ("/" and "&") name genuinely separate teas, so each side is read.
 *   2. Within a side, the LAST resolvable word wins, because "Modern Green Style
 *      Oolong" is an oolong made in a green style, not a green tea.
 *   3. A parenthetical is only consulted when the head resolves to nothing, so
 *      "Anxi Oolong (Green Style)" stays an oolong but "Kamairicha (Pan-Fired
 *      Green Tea)" is still found.
 *
 * Every word is resolved through `normalizeTeaType`. No list lives here.
 */
export function teaTypesOf(story: CultivarStory | null | undefined): TeaType[] {
  if (!story?.expressions) return [];
  const found = new Set<TeaType>();

  for (const family of Object.keys(story.expressions)) {
    const head = family.split('(')[0] ?? '';
    const parenthetical = family.slice(head.length);
    const before = found.size;
    readSides(head, found);
    if (found.size === before) readSides(parenthetical, found);
  }

  return TEA_TYPES.filter(type => found.has(type));
}

function readSides(text: string, into: Set<TeaType>): void {
  for (const side of text.split(/[/&]/)) {
    let last: TeaType | null = null;
    for (const word of side.split(/[^A-Za-z']+/)) {
      last = normalizeTeaType(word) ?? last;
    }
    if (last) into.add(last);
  }
}

// ─── Places ──────────────────────────────────────────────────────────────────

const placeKey = (value: string) => value.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '');

/**
 * A cultivar records its origin the way a grower writes it ("Anji (Zhejiang)"),
 * while altitude and climate are held against the researched county name ("Anji
 * County, Zhejiang"). This walks the written form back to the researched place
 * on an exact or leading match only. It never falls through to a containment
 * match, because that would file every Yunnan plant under one prefecture.
 */
export function growingPlace(originRegion: string | null | undefined): Region | null {
  if (!originRegion) return null;

  const direct = findRegion(originRegion);
  if (direct?.altitude || direct?.climate) return direct;

  for (const token of originRegion.split(/[(),/]+/).map(part => part.trim()).filter(Boolean)) {
    const key = placeKey(token);
    if (key.length < 3) continue;
    const exact = REGIONS.find(region => placeKey(region.name) === key && (region.altitude || region.climate));
    if (exact) return exact;
    const leading = REGIONS.find(region => placeKey(region.name).startsWith(key) && (region.altitude || region.climate));
    if (leading) return leading;
  }

  return direct;
}
