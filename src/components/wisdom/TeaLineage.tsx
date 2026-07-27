import React, { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  findCultivarById,
  findRegion,
  loadCultivarStory,
  matchCultivar,
  type Cultivar,
  type CultivarStory,
  type Region,
} from '../../wisdom';
import { authorshipLine } from '../../wisdom/authorship';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';

/**
 * The subset of a product's own fields needed to resolve the plant and place
 * it is made from. Kept narrow and decoupled from `InventoryItem` so this
 * component can be dropped onto any surface that sells a tea, not just the
 * product page.
 */
export interface TeaLineageProduct {
  name: string;
  chineseName?: string | null;
  origin?: string | null;
  /** A cultivar id or a freeform name recorded directly on the product, when known. */
  cultivar?: string | null;
}

export interface TeaLineageResolution {
  cultivar: Cultivar | null;
  region: Region | null;
}

/** One label/value pair in the expanded reference grid. */
export interface LineageFact {
  label: string;
  value: string;
}

/**
 * Values at or under this length share a row on a wide screen; longer ones take
 * the full width so a bred-from sentence never sets itself in a 190px gutter.
 */
const SHORT_FACT_CHARS = 32;

/**
 * Four type roles, and only four. Reference sits beneath the shop's own voice,
 * so nothing here is gold and nothing here is a sentence in capitals.
 *
 *   LABEL      section marker and field labels
 *   SUMMARY    the plant's name, the one thing read at a glance
 *   META       the place, and the authorship note
 *   REFERENCE  field values and the opening line of the story
 */
const LABEL = 'font-sans text-ui-11 uppercase tracking-[0.08em] text-tea-text-dim';
const META = 'font-sans text-ui-13 text-tea-text-sec';
const REFERENCE = 'text-ui-14 text-tea-text-sec leading-relaxed';

/** Shared geometry for the summary row, so the static and disclosure forms are identical. */
const SUMMARY_ROW = 'w-full flex items-center justify-between gap-3 min-h-[44px] py-1 text-left';

/**
 * Resolves the plant and place a product is made from, without guessing.
 *
 * Resolution order for the plant: a directly recorded cultivar wins (by id,
 * falling back to a name match on the same stored string); otherwise the
 * product's own names are matched against the wisdom base. A blank result is
 * correct when nothing is known. A wrong lineage is worse than no lineage.
 *
 * The growing region is resolved independently, from the product's own
 * recorded origin, so a product can show altitude/climate for where it was
 * actually grown even when its cultivar's home region differs.
 */
export function resolveLineage(product: TeaLineageProduct): TeaLineageResolution {
  const cultivar = product.cultivar
    ? findCultivarById(product.cultivar) ?? matchCultivar(product.cultivar)
    : matchCultivar(product.name, product.chineseName);
  const region = findRegion(product.origin);
  return { cultivar, region };
}

/**
 * The opening of a story, not the full paragraph.
 *
 * Most entries open with a gloss of the name ("'Jade'.", "'Cassia/Cinnamon'."),
 * so taking literally the first sentence left six cultivars showing seven
 * characters. This reads on to the first sentence boundary past MIN, then keeps
 * extending while it stays under MAX, so the line is always worth the space it
 * takes and never runs to an essay.
 */
export function openingLine(text: string | undefined | null): string {
  const full = (text ?? '').trim();
  const MIN = 60;
  const MAX = 190;
  if (!full || full.length <= MAX) return full;

  let firstPastMin = 0;
  let lastUnderMax = 0;
  for (const match of full.matchAll(/[.!?](?=\s)/g)) {
    const end = (match.index ?? 0) + 1;
    if (end < MIN) continue;
    if (!firstPastMin) firstPastMin = end;
    if (end > MAX) break;
    lastUnderMax = end;
  }
  return full.slice(0, lastUnderMax || firstPastMin || full.length);
}

/**
 * What the base can say about this plant beyond its name and home.
 *
 * Short values are listed before long ones so the two-column grid pairs cleanly
 * instead of leaving a hole beside a spanning sentence. The sort is stable, so
 * declaration order (which is importance order) survives inside each group.
 */
export function lineageFacts(cultivar: Cultivar | null, region: Region | null): LineageFact[] {
  if (!cultivar) return [];
  const facts: LineageFact[] = [];
  if (cultivar.parentage) facts.push({ label: 'Bred from', value: cultivar.parentage });
  if (cultivar.developedYear) facts.push({ label: 'Developed', value: String(cultivar.developedYear) });
  if (region?.altitude) facts.push({ label: 'Altitude', value: region.altitude });
  if (region?.climate) facts.push({ label: 'Where it grows', value: region.climate });
  if (cultivar.altNames.length) facts.push({ label: 'Also called', value: cultivar.altNames.join(', ') });
  const isLong = (fact: LineageFact) => Number(fact.value.length > SHORT_FACT_CHARS);
  return facts.sort((left, right) => isLong(left) - isLong(right));
}

/**
 * Shows the shared background a tea is made from, beneath the shop's own words
 * about the product. This is reference, not voice: written once in the wisdom
 * base and improved everywhere the day it is corrected. Renders nothing when
 * the plant cannot be resolved, a blank is correct here.
 *
 * Two states, one geometry. The summary row is the same height and the same
 * width whether or not there is anything to expand, and the chevron sits in a
 * slot that is reserved even when empty, so the row never moves when the story
 * finishes loading and the disclosure appears.
 */
export const TeaLineage: React.FC<{ product: TeaLineageProduct }> = ({ product }) => {
  const { cultivar, region } = resolveLineage(product);
  const [story, setStory] = useState<CultivarStory | null>(null);
  // Settled, not loading: expandability is decided once, on complete information,
  // so the disclosure never appears and then withdraws.
  const [storySettled, setStorySettled] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setExpanded(false);
    if (!cultivar) {
      setStory(null);
      setStorySettled(true);
      return;
    }
    let live = true;
    setStorySettled(false);
    loadCultivarStory(cultivar.id).then(result => {
      if (!live) return;
      setStory(result);
      setStorySettled(true);
    });
    return () => {
      live = false;
    };
  }, [cultivar?.id]);

  if (!cultivar) return null;

  const headingId = `lineage-heading-${cultivar.id}`;
  const panelId = `lineage-detail-${cultivar.id}`;
  const plantOrigin = [cultivar.originRegion, cultivar.originCountry].filter(Boolean).join(', ');
  const facts = lineageFacts(cultivar, region);
  const storyLine = openingLine(story?.description);
  // When the base holds only a name and a place there is nothing behind the
  // chevron worth the tap, so the row is simply a line of reference and stops.
  const hasDetail = storySettled && (facts.length > 0 || Boolean(storyLine));

  const summary = (
    <>
      {/* Spans, not divs and paragraphs: this whole fragment is also the content
          of a <button>, whose content model is phrasing only. */}
      <span className="block min-w-0 flex-1">
        {/* Wrapping happens between whole names, never inside one, so the Chinese
            name cannot break against the Latin name at a narrow width. */}
        <span className={`${TYPOGRAPHY_CLASSES.bodyLight} flex flex-wrap items-baseline gap-x-2 text-tea-text`}>
          <span className="whitespace-nowrap">{cultivar.name}</span>
          {cultivar.chineseName && (
            <span className="whitespace-nowrap text-tea-text-sec">{cultivar.chineseName}</span>
          )}
        </span>
        {plantOrigin && <span className={`${META} mt-0.5 block`}>{plantOrigin}</span>}
      </span>
      <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center" aria-hidden>
        {hasDetail && (
          <ChevronDown
            className={`h-4 w-4 text-tea-text-dim transition-transform duration-200 group-hover:text-tea-text-sec ${expanded ? 'rotate-180' : ''}`}
          />
        )}
      </span>
    </>
  );

  return (
    <section aria-labelledby={headingId} className="mb-5 border-t border-tea-border pt-4">
      <h3 id={headingId} className={`${LABEL} font-medium mb-1.5`}>
        Lineage
      </h3>

      {hasDetail ? (
        <button
          type="button"
          onClick={() => setExpanded(open => !open)}
          aria-expanded={expanded}
          // Only points at the panel while the panel is in the DOM.
          aria-controls={expanded ? panelId : undefined}
          className={`${SUMMARY_ROW} group rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tea-gold/50`}
        >
          {summary}
        </button>
      ) : (
        <div className={SUMMARY_ROW}>{summary}</div>
      )}

      {hasDetail && expanded && (
        <div id={panelId} className="mt-3 space-y-3 animate-fadeIn">
          {facts.length > 0 && (
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {facts.map(fact => (
                <div key={fact.label} className={fact.value.length > SHORT_FACT_CHARS ? 'sm:col-span-2' : undefined}>
                  <dt className={`${LABEL} mb-0.5`}>{fact.label}</dt>
                  <dd className={REFERENCE}>{fact.value}</dd>
                </div>
              ))}
            </dl>
          )}

          {storyLine && <p className={REFERENCE}>{storyLine}</p>}

          {/* The line that earns trust for everything above it. A readable
              sentence, never fine print. */}
          <p className={`${META} pt-1`}>{authorshipLine(cultivar.id)}</p>
        </div>
      )}
    </section>
  );
};

export default TeaLineage;
