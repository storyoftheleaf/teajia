import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
import { FactGrid, orderFacts, type Fact } from './FactGrid';
import { BODY, HEADING, LABEL, LABEL_GAP, SECTION } from './typeRoles';

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
export type LineageFact = Fact;

/** The public address of a plant. One place, so the link and the JSON-LD agree. */
export const cultivarPath = (id: string) => `/wisdom/cultivar/${id}`;

/** Shared geometry for the summary row, so the static and disclosure forms are identical. */
const SUMMARY_ROW = 'flex items-start justify-between gap-3';

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
 * Declaration order is importance order; `orderFacts` then floats the short
 * values ahead of the long ones so the grid pairs without a hole.
 */
export function lineageFacts(cultivar: Cultivar | null, region: Region | null): LineageFact[] {
  if (!cultivar) return [];
  const facts: LineageFact[] = [];
  if (cultivar.parentage) facts.push({ label: 'Bred from', value: cultivar.parentage });
  if (cultivar.developedYear) facts.push({ label: 'Developed', value: String(cultivar.developedYear) });
  if (region?.altitude) facts.push({ label: 'Altitude', value: region.altitude });
  if (region?.climate) facts.push({ label: 'Where it grows', value: region.climate });
  if (cultivar.altNames.length) facts.push({ label: 'Also called', value: cultivar.altNames.join(', ') });
  return orderFacts(facts);
}

/**
 * Shows the shared background a tea is made from, beneath the shop's own words
 * about the product. This is reference, not voice: written once in the wisdom
 * base and improved everywhere the day it is corrected. Renders nothing when
 * the plant cannot be resolved, a blank is correct here.
 *
 * The plant's name is a link to its own public page, so background is a
 * doorway rather than a dead end. The disclosure is a separate control beside
 * it, because a link inside a button is neither a link nor a button.
 *
 * Two states, one geometry. The summary row is the same height whether or not
 * there is anything to expand, and the chevron sits in a slot that is reserved
 * even when empty, so the row never moves when the story finishes loading.
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

  return (
    <section aria-labelledby={headingId} className={SECTION}>
      <h2 id={headingId} className={`${LABEL} ${LABEL_GAP} text-tea-text-dim`}>
        Lineage
      </h2>

      <div className={SUMMARY_ROW}>
        <Link
          to={cultivarPath(cultivar.id)}
          className="group flex min-h-[44px] min-w-0 flex-1 flex-col justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tea-gold/50"
        >
          {/* Wrapping happens between whole names, never inside one, so the
              Chinese name cannot break against the Latin name at 390px. */}
          <span className={`${HEADING} flex flex-wrap items-baseline gap-x-2 text-tea-text transition-colors group-hover:text-tea-gold`}>
            {/* Underlined at rest, on the page's one link setting: on a phone
                nothing hovers, so a link that only announces itself to a mouse
                is not a link at all. */}
            <span className="whitespace-nowrap underline decoration-1 decoration-tea-text-dim underline-offset-4 transition-colors group-hover:decoration-tea-gold">
              {cultivar.name}
            </span>
            {cultivar.chineseName && (
              <span className="whitespace-nowrap text-tea-text-sec transition-colors group-hover:text-tea-gold">
                {cultivar.chineseName}
              </span>
            )}
          </span>
          {plantOrigin && <span className={`${BODY} mt-0.5 block text-tea-text-dim`}>{plantOrigin}</span>}
        </Link>

        {/* Reserved slot: present at the same width whether or not it holds a
            control, so the name never shifts when the story settles. */}
        <span className="flex min-h-[44px] w-11 flex-shrink-0 items-center justify-center">
          {hasDetail && (
            <button
              type="button"
              onClick={() => setExpanded(open => !open)}
              aria-expanded={expanded}
              // Only points at the panel while the panel is in the DOM.
              aria-controls={expanded ? panelId : undefined}
              aria-label={expanded ? `Hide what is recorded about ${cultivar.name}` : `Show what is recorded about ${cultivar.name}`}
              className="tap-target rounded-md text-tea-text-dim hover:text-tea-text-sec focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tea-gold/50"
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
              />
            </button>
          )}
        </span>
      </div>

      {hasDetail && expanded && (
        <div id={panelId} className="mt-3 space-y-3 animate-fadeIn">
          <FactGrid facts={facts} />

          {storyLine && <p className={`${BODY} text-tea-text-sec`}>{storyLine}</p>}

          {/* The line that earns trust for everything above it. Readable, never
              fine print, and one tone quieter than on the reference page: here
              it describes a block of background, not the page you came for. */}
          <p className={`${BODY} pt-1 text-tea-text-dim`}>{authorshipLine(cultivar.id)}</p>
        </div>
      )}
    </section>
  );
};

export default TeaLineage;
