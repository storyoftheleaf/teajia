/**
 * Shared parts of the public tea reference (/wisdom).
 *
 * The reference reads the wisdom base and nothing else. It holds no copy of a
 * tea-type list, no local region table, and no prose of its own about a plant.
 * Everything here is either presentation or a read helper over `src/wisdom`.
 */
import React, { useEffect, useState } from 'react';
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
 */
export const AuthorshipNote: React.FC<{ className?: string }> = ({ className = '' }) => (
  <p className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-dim leading-relaxed ${className}`}>
    Drafted by AI from research, not yet read line by line. Corrections are applied by hand and credited.
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
