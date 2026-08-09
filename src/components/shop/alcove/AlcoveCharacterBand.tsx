import React from 'react';
import type { InventoryItem } from '../../../types';
import { resolveTermLabel, TASTING_CATEGORY_ORDER } from '../../../data/tastingTaxonomy';
import { starredNotes } from '../../../lib/noteEntries';
import { AlcoveSectionHeading } from './AlcoveSectionHeading';
import type { ProductResearchResolution } from '../../../wisdom/productResearch';

/** Converts a string to Title Case */
function toTitleCase(str: string): string {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

interface TermRef {
  termId: string;
  label: string;
  categoryId: string;
}

interface AlcoveCharacterBandProps {
  item: InventoryItem;
  /** Legacy free-text tags (item.tags): taste-line fallback when no structured flavor terms exist. */
  legacyNotes: string[];
  isAdmin?: boolean;
  onEditProductTasting?: (item: InventoryItem) => void;
  onTermClick?: (termId: string, categoryId: string) => void;
  potentialResearch?: ProductResearchResolution | null;
}

const POTENTIAL_LABELS: Record<string, string> = {
  body: 'Body',
  finish: 'Finish',
  feeling: 'Feeling',
  flavor: 'Taste',
  'liquor-color': 'Liquor',
  brewing: 'Brewing',
};

function wisdomEntryPath({ entryKind, entryId }: ProductResearchResolution): string {
  const segment = entryKind === 'namedTea' ? 'named' : entryKind;
  return `/wisdom/${segment}/${entryId}`;
}

/** One centered label + serif term line, terms separated by gold middots. */
const TermLine: React.FC<{
  label: string;
  terms: TermRef[];
  onTermClick?: (termId: string, categoryId: string) => void;
}> = ({ label, terms, onTermClick }) => (
  <div className="grp">
    <div className="font-sans text-ui-9 uppercase tracking-[0.24em] indent-[0.24em] text-tea-text-dim">
      {label}
    </div>
    <div className="mt-[3px] font-display text-[19px] leading-[1.4] text-tea-text">
      {terms.map((term, i) => (
        <React.Fragment key={term.termId}>
          {i > 0 && (
            <span aria-hidden="true" className="px-2 text-ui-15 text-tea-gold-lt">
              ·
            </span>
          )}
          {onTermClick ? (
            <button
              type="button"
              className="alcove-term-btn"
              onClick={() => onTermClick(term.termId, term.categoryId)}
            >
              {term.label}
            </button>
          ) : (
            <span>{term.label}</span>
          )}
        </React.Fragment>
      ))}
    </div>
  </div>
);

/**
 * "Character": the one chapter that gathers everything sensory: the taste
 * line, the feel line, and Adrian's starred notes together in a faint tonal
 * band. Renders only when there are customer-facing tasting terms or starred
 * notes (or, for admins, so the tasting editor stays reachable).
 */
export const AlcoveCharacterBand: React.FC<AlcoveCharacterBandProps> = ({
  item,
  legacyNotes,
  isAdmin,
  onEditProductTasting,
  onTermClick,
  potentialResearch,
}) => {
  const tasting = item.tasting;

  // Shopper-facing terms: flavor → TASTE, feeling → FEEL. Body / finish /
  // liquor-color are journaling data, noisy on a product page.
  const flavorTerms: TermRef[] = (tasting?.flavor ?? []).map(termId => ({
    termId,
    label: resolveTermLabel(termId),
    categoryId: 'flavor',
  }));
  const feelingTerms: TermRef[] = (tasting?.feeling ?? []).map(termId => ({
    termId,
    label: resolveTermLabel(termId),
    categoryId: 'feeling',
  }));

  // Legacy tags fall back into the taste line when no structured terms exist.
  const tasteTerms: TermRef[] =
    flavorTerms.length > 0
      ? flavorTerms
      : legacyNotes.map(note => ({
          termId: note.toLowerCase().trim().replace(/\s+/g, '-'),
          label: toTitleCase(note),
          categoryId: 'flavor',
        }));

  const starred = starredNotes(tasting);
  const hasVisibleStructuredTerms = flavorTerms.length > 0 || feelingTerms.length > 0;
  const hasTerms = tasteTerms.length > 0 || feelingTerms.length > 0;
  const hasAny = hasTerms || starred.length > 0 || Boolean(potentialResearch);

  // No sensory data and no admin editor: no band, no empty heading.
  if (!hasAny && !(isAdmin && onEditProductTasting)) return null;

  return (
    <section aria-label="Character" className="alcove-band relative mt-[22px] px-6 pb-[18px] pt-4">
      <AlcoveSectionHeading label="Character" className="mb-3" />

      {isAdmin && onEditProductTasting && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onEditProductTasting(item); }}
          className="tap-target absolute right-2 top-1 font-sans text-ui-9 uppercase tracking-[0.15em] text-tea-text-dim transition-colors hover:text-tea-gold"
          aria-label="Edit product tasting"
        >
          Edit tasting
        </button>
      )}

      {hasTerms && (
        <div className="text-center [&_.grp+.grp]:mt-3">
          {tasteTerms.length > 0 && (
            <TermLine label="Taste" terms={tasteTerms} onTermClick={onTermClick} />
          )}
          {feelingTerms.length > 0 && (
            <TermLine label="Feel" terms={feelingTerms} onTermClick={onTermClick} />
          )}
          {item.tastingSource === 'common' && hasVisibleStructuredTerms && (
            <p className="mt-2 font-sans text-ui-11 text-tea-text-dim">Potential profile</p>
          )}
          {item.tastingSource === 'source' && hasVisibleStructuredTerms && (
            <p className="mt-2 font-sans text-ui-11 text-tea-text-dim">Source-described profile</p>
          )}
        </div>
      )}

      {starred.map((note, i) => {
        const attribution = note.sourceAuthor
          ? note.sourceAuthor.initial || note.sourceAuthor.accountName || 'Community'
          : 'Adrian';
        return (
          <figure
            key={note.id}
            className={`mx-0 mb-0 px-1 text-center ${i === 0 && hasTerms ? 'mt-3.5' : i === 0 ? 'mt-1' : 'mt-3.5'}`}
          >
            <blockquote className="m-0 font-display text-ui-17 not-italic leading-[1.5] text-tea-text">
              &ldquo;{note.text}&rdquo;
            </blockquote>
            <figcaption className="mt-2 font-sans text-ui-9 uppercase tracking-[0.2em] text-tea-text-dim">
              {attribution}
            </figcaption>
          </figure>
        );
      })}

      {potentialResearch && (
        <div className={`border-t border-tea-border px-1 text-center ${hasTerms || starred.length ? 'mt-4 pt-4' : 'pt-1'}`}>
          <p className="font-sans text-ui-9 uppercase tracking-[0.24em] indent-[0.24em] text-tea-text-dim">
            Potential character
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-x-6 gap-y-3">
            {TASTING_CATEGORY_ORDER.map(category => {
              const terms = potentialResearch.profile.tasting[category];
              if (!terms?.length) return null;
              return (
                <div key={category} className="max-w-full">
                  <p className="font-sans text-ui-9 uppercase tracking-[0.15em] text-tea-text-dim">
                    {POTENTIAL_LABELS[category]}
                  </p>
                  <p className="mt-1 font-display text-ui-17 leading-[1.4] text-tea-text">
                    {terms.map(resolveTermLabel).join(' · ')}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="mt-3 font-sans text-ui-11 leading-relaxed text-tea-text-sec">
            Cited shared research
            {potentialResearch.sources.length > 0 && ` from ${potentialResearch.sources.map(source => source.publisher).join(', ')}`}
            {'. '}
            <a
              href={wisdomEntryPath(potentialResearch)}
              className="inline-flex min-h-[44px] items-center rounded-md underline decoration-tea-text-dim underline-offset-4 transition-colors hover:text-tea-gold hover:decoration-tea-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50"
            >
              Research context
            </a>
          </p>
        </div>
      )}
    </section>
  );
};
